"""
Monument Status Check - Rijksmonumentenregister & Gemeentelijke Monumenten.

Check if a property/location is a registered monument (rijksmonument or gemeentelijk monument).
This is CRITICAL for buyers - monument status means:
- Renovation restrictions
- Potential subsidies for restoration
- Higher maintenance costs
- Historic value (can increase or decrease market value)

Data sources:
- PDOK: Rijksmonumenten (INSPIRE geharmoniseerd) WFS
- Rijksdienst voor het Cultureel Erfgoed (RCE)
- Municipal monument registers (varies by gemeente)

License: Open Data / Public Domain
"""

import json
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import click
import httpx

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# PDOK OGC API endpoints for monument data (new API as of 2024)
# Source: https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1/
PDOK_MONUMENTS_OGC = "https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1"
PDOK_MONUMENTS_POINTS = f"{PDOK_MONUMENTS_OGC}/collections/rce_inspire_points/items"
PDOK_MONUMENTS_POLYGONS = f"{PDOK_MONUMENTS_OGC}/collections/rce_inspire_polygons/items"

# Legacy WFS endpoints (deprecated, may not work)
PDOK_MONUMENTS_WFS = "https://service.pdok.nl/rce/ps/wfs/v1_0"
RCE_MONUMENTEN_WFS = "https://services.rce.geovoorziening.nl/rce/ps/wfs"
PDOK_BESCHERMD_WFS = "https://service.pdok.nl/rce/beschermdestadsdorpsgezichten/wfs/v1_0"


class MonumentStatusClient:
    """Client for checking monument status via PDOK/RCE."""

    def __init__(self, timeout: int = 30):
        """Initialize monument status client."""
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (Monument Status Check)",
                "Accept": "application/json, application/geo+json, */*",
            }
        )

    def check_monument_status(self, lat: float, lng: float) -> Dict:
        """
        Check if a location is a registered monument.

        Args:
            lat: Latitude (WGS84)
            lng: Longitude (WGS84)

        Returns:
            Dictionary with monument status and details
        """
        result = {
            "is_rijksmonument": False,
            "is_gemeentelijk_monument": False,
            "is_beschermd_stadsgezicht": False,
            "monument_details": None,
            "protected_area": None,
            "checked_at": datetime.utcnow().isoformat(),
            "sources": ["PDOK/RCE Rijksmonumentenregister"]
        }

        # Check rijksmonumenten
        rijksmonument = self._check_rijksmonument(lat, lng)
        if rijksmonument:
            result["is_rijksmonument"] = True
            result["monument_details"] = rijksmonument

        # Check protected cityscapes (beschermd stads-/dorpsgezicht)
        beschermd = self._check_beschermd_stadsgezicht(lat, lng)
        if beschermd:
            result["is_beschermd_stadsgezicht"] = True
            result["protected_area"] = beschermd

        return result

    def _check_rijksmonument(self, lat: float, lng: float) -> Optional[Dict]:
        """
        Check if location is a rijksmonument via PDOK WFS.

        Uses CQL spatial filter to check point intersection.
        """
        # Build WFS GetFeature request with CQL filter
        # Note: WFS uses x,y (lng,lat) order for Point
        cql_filter = f"INTERSECTS(geometry, POINT({lng} {lat}))"

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "ps:ProtectedSite",
            "outputFormat": "application/json",
            "CQL_FILTER": cql_filter,
            "srsName": "EPSG:4326",
            "count": "5"
        }

        try:
            response = self.client.get(PDOK_MONUMENTS_WFS, params=params)
            response.raise_for_status()

            data = response.json()
            features = data.get("features", [])

            if features:
                feature = features[0]
                props = feature.get("properties", {})

                return {
                    "monument_number": props.get("inspireId") or props.get("rijksmonumentnummer"),
                    "name": props.get("siteName") or props.get("naam"),
                    "type": props.get("siteDesignation") or "Rijksmonument",
                    "description": props.get("description"),
                    "legal_foundation": props.get("legalFoundationDocument"),
                    "registration_date": props.get("legalFoundationDate"),
                    "source": "Rijksmonumentenregister (RCE)",
                    "more_info": f"https://monumentenregister.cultureelerfgoed.nl/"
                }

            return None

        except httpx.HTTPStatusError as e:
            log.warning(f"HTTP error checking rijksmonument: {e.response.status_code}")
            return None
        except Exception as e:
            log.warning(f"Error checking rijksmonument: {e}")
            return None

    def _check_beschermd_stadsgezicht(self, lat: float, lng: float) -> Optional[Dict]:
        """
        Check if location is within a protected cityscape/village view.

        These are areas with special protection for their historic character.
        """
        cql_filter = f"INTERSECTS(geometry, POINT({lng} {lat}))"

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "beschermdestadsdorpsgezichten:beschermdestadsdorpsgezichten",
            "outputFormat": "application/json",
            "CQL_FILTER": cql_filter,
            "srsName": "EPSG:4326",
            "count": "5"
        }

        try:
            response = self.client.get(PDOK_BESCHERMD_WFS, params=params)
            response.raise_for_status()

            data = response.json()
            features = data.get("features", [])

            if features:
                feature = features[0]
                props = feature.get("properties", {})

                return {
                    "area_name": props.get("naam") or props.get("name"),
                    "type": "Beschermd Stads- of Dorpsgezicht",
                    "description": props.get("omschrijving") or props.get("description"),
                    "municipality": props.get("gemeente"),
                    "designation_date": props.get("aanwijzingsdatum"),
                    "note": "This location is in a protected historic area. Building permits may be subject to additional review.",
                    "source": "PDOK/RCE"
                }

            return None

        except Exception as e:
            log.warning(f"Error checking beschermd stadsgezicht: {e}")
            return None

    def get_monument_by_address(self, postal_code: str, house_number: str) -> Optional[Dict]:
        """
        Look up monument status by address (uses geocoding first).

        Note: This requires geocoding the address to coordinates first.
        For now, use check_monument_status with coordinates directly.
        """
        # TODO: Implement address-based lookup via BAG geocoding
        log.warning("Address-based monument lookup not yet implemented. Use coordinates.")
        return None

    def close(self):
        self.client.close()

    def download_all_monuments(self, max_features: int = 100000) -> List[Dict]:
        """
        Download ALL rijksmonumenten from PDOK OGC API for local storage.

        There are ~63,000 rijksmonumenten in the Netherlands.
        This downloads them all for fast local lookups.

        Returns:
            List of monument features with geometry
        """
        log.info("Downloading all rijksmonumenten from PDOK OGC API...")

        all_features = []
        page_size = 1000  # OGC API max per request
        next_url = f"{PDOK_MONUMENTS_POINTS}?limit={page_size}"

        while next_url and len(all_features) < max_features:
            try:
                response = self.client.get(next_url, headers={"Accept": "application/geo+json"})
                response.raise_for_status()

                data = response.json()
                features = data.get("features", [])

                if not features:
                    break

                all_features.extend(features)
                log.info(f"Downloaded {len(all_features)} monuments so far...")

                # Find next link for pagination
                next_url = None
                for link in data.get("links", []):
                    if link.get("rel") == "next":
                        next_url = link.get("href")
                        break

            except Exception as e:
                log.error(f"Error downloading monuments: {e}")
                break

        log.success(f"Downloaded {len(all_features)} total monuments")
        return all_features

    def download_beschermde_gezichten(self, max_features: int = 10000) -> List[Dict]:
        """
        Download all beschermde stads-/dorpsgezichten (protected cityscapes).

        These are polygon areas from the OGC API.
        Note: The polygons collection includes both monuments and protected areas.
        """
        log.info("Downloading beschermde gebieden (polygons)...")

        all_features = []
        page_size = 1000
        next_url = f"{PDOK_MONUMENTS_POLYGONS}?limit={page_size}"

        while next_url and len(all_features) < max_features:
            try:
                response = self.client.get(next_url, headers={"Accept": "application/geo+json"})
                response.raise_for_status()

                data = response.json()
                features = data.get("features", [])

                if not features:
                    break

                all_features.extend(features)
                log.info(f"Downloaded {len(all_features)} polygon features so far...")

                # Find next link for pagination
                next_url = None
                for link in data.get("links", []):
                    if link.get("rel") == "next":
                        next_url = link.get("href")
                        break

            except Exception as e:
                log.error(f"Error downloading polygons: {e}")
                break

        log.success(f"Downloaded {len(all_features)} total polygon features")
        return all_features

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.command()
@click.option("--download", is_flag=True, help="Download full monument dataset")
@click.option("--lat", type=float, help="Latitude to check (single point)")
@click.option("--lng", type=float, help="Longitude to check (single point)")
@click.option(
    "--output-dir",
    type=click.Path(),
    default="../../data/processed",
    help="Output directory for downloaded data"
)
def main(download: bool, lat: Optional[float], lng: Optional[float], output_dir: str):
    """
    Monument status - download dataset or check single location.

    DOWNLOAD MODE (recommended):
        python -m ingest.monument_status --download

        Downloads ~63,000 rijksmonumenten and ~500 protected cityscapes
        to data/processed/ for fast local lookups.

    CHECK MODE:
        python -m ingest.monument_status --lat 52.3676 --lng 4.9041

    Monument status is important for:
    - Understanding renovation restrictions
    - Knowing about potential restoration subsidies
    - Assessing maintenance costs
    - Historic value assessment
    """
    log.info("=== Monument Status Tool ===")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    with MonumentStatusClient(timeout=120) as client:

        if download:
            # Download full datasets
            log.info("Downloading full monument datasets for local storage...")

            # 1. Download rijksmonumenten
            monuments = client.download_all_monuments()

            if monuments:
                geojson = {
                    "type": "FeatureCollection",
                    "features": monuments,
                    "metadata": {
                        "source": "PDOK/RCE Rijksmonumentenregister",
                        "downloaded_at": datetime.utcnow().isoformat(),
                        "total_count": len(monuments),
                        "license": "Public Domain / CC0"
                    }
                }

                monuments_file = output_path / "rijksmonumenten.geojson"
                with open(monuments_file, "w", encoding="utf-8") as f:
                    json.dump(geojson, f, ensure_ascii=False)
                log.success(f"Saved {len(monuments)} monuments to {monuments_file}")

                # Calculate file size
                size_mb = monuments_file.stat().st_size / (1024 * 1024)
                log.info(f"File size: {size_mb:.1f} MB")

            # 2. Download monument polygons (includes beschermde gezichten)
            polygons = client.download_beschermde_gezichten()

            if polygons:
                geojson = {
                    "type": "FeatureCollection",
                    "features": polygons,
                    "metadata": {
                        "source": "PDOK/RCE Beschermde Gebieden Cultuurhistorie (polygons)",
                        "downloaded_at": datetime.utcnow().isoformat(),
                        "total_count": len(polygons),
                        "license": "CC BY 4.0",
                        "note": "Includes rijksmonumenten polygons and beschermde stads-/dorpsgezichten"
                    }
                }

                polygons_file = output_path / "monumenten_polygons.geojson"
                with open(polygons_file, "w", encoding="utf-8") as f:
                    json.dump(geojson, f, ensure_ascii=False)
                log.success(f"Saved {len(polygons)} polygon features to {polygons_file}")

                # Calculate file size
                size_mb = polygons_file.stat().st_size / (1024 * 1024)
                log.info(f"Polygons file size: {size_mb:.1f} MB")

            log.info("\n✅ Monument data ready for local lookups!")
            log.info("Next: Add lookup function to backend API")

        elif lat is not None and lng is not None:
            # Single point check (real-time API)
            log.info(f"Checking monument status for ({lat}, {lng})...")

            result = client.check_monument_status(lat, lng)

            if result["is_rijksmonument"]:
                log.success("✓ Location IS a Rijksmonument!")
                if result["monument_details"]:
                    details = result["monument_details"]
                    log.info(f"  Name: {details.get('name', 'Unknown')}")
                    log.info(f"  Type: {details.get('type', 'Unknown')}")
            else:
                log.info("✗ Location is NOT a Rijksmonument")

            if result["is_beschermd_stadsgezicht"]:
                log.warning("⚠ Location is in a Beschermd Stads-/Dorpsgezicht!")
            else:
                log.info("✗ Location is NOT in a protected cityscape")

            print(json.dumps(result, indent=2, ensure_ascii=False))

        else:
            log.info("Usage:")
            log.info("  Download data:  python -m ingest.monument_status --download")
            log.info("  Check point:    python -m ingest.monument_status --lat 52.37 --lng 4.88")

    log.info("\n💡 Important for Buyers:")
    log.info("- Rijksmonumenten have strict renovation rules")
    log.info("- Changes require permits from municipality + Rijksdienst")
    log.info("- Subsidies: https://www.cultureelerfgoed.nl/subsidies")


if __name__ == "__main__":
    main()
