"""
Foundation Risk & Soil Problems data ingestion.

Downloads data about foundation problems, soil subsidence, and ground conditions.
CRITICAL for Dutch housing - foundation issues can cost €50k-150k to fix!

Data sources:
- PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek (official government data)
- Funderingsmonitor (foundation monitoring)
- AHN (Actueel Hoogtebestand Nederland) - elevation data
- DINO (geological data)
- Municipal foundation risk maps

License: Open Data / Public Domain
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx
from tqdm import tqdm
import polars as pl

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# PDOK Official Foundation Risk Areas (Indicatieve Aandachtsgebieden Funderingsproblematiek)
# Source: https://data.overheid.nl/en/dataset/11058-indicatieve-aandachtsgebieden-funderingsproblematiek
PDOK_FOUNDATION_WFS = "https://geodata.nationaalgeoregister.nl/indgebfunderingsproblematiek/wfs"
PDOK_FOUNDATION_WMS = "https://geodata.nationaalgeoregister.nl/indgebfunderingsproblematiek/wms"

# Foundation risk APIs
FOUNDATION_MONITOR_API = "https://funderingsmonitor.nl/api"  # If available

# PDOK elevation data (AHN)
AHN_WMS = "https://service.pdok.nl/rws/ahn/wms/v1_0"
AHN_WCS = "https://service.pdok.nl/rws/ahn/wcs/v1_0"

# Kadaster foundation risk areas (if available)
KADASTER_FOUNDATION_API = "https://service.pdok.nl/kadaster/foundation/wfs/v1_0"

# Known foundation risk areas (manually compiled from municipal reports)
KNOWN_RISK_AREAS = {
    "amsterdam": [
        {"area": "Jordaan", "risk": "high", "reason": "Wooden pile foundations from 1600s-1800s"},
        {"area": "De Pijp", "risk": "high", "reason": "Wooden pile foundations, water level changes"},
        {"area": "Oud-West", "risk": "medium", "reason": "Mixed foundation types"},
        {"area": "Zuid", "risk": "medium", "reason": "Some wooden piles"},
    ],
    "rotterdam": [
        {"area": "Kralingen", "risk": "medium", "reason": "Soft soil, some subsidence"},
        {"area": "IJsselmonde", "risk": "medium", "reason": "Peat soil, subsidence"},
        {"area": "Centrum", "risk": "low", "reason": "Modern foundations post-WWII"},
    ],
    "den_haag": [
        {"area": "Scheveningen", "risk": "low", "reason": "Sandy soil"},
        {"area": "Centrum", "risk": "medium", "reason": "Historic buildings, varied foundations"},
    ],
    "gouda": [
        {"area": "Historic center", "risk": "high", "reason": "Wooden piles in peat soil"},
    ],
    "delft": [
        {"area": "Historic center", "risk": "high", "reason": "Canal houses on wooden piles"},
    ],
}


class FoundationRiskClient:
    """Client for foundation risk data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize foundation risk client.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (Foundation Risk Data Collection)",
                "Accept": "application/json, */*",
            }
        )

    def get_pdok_foundation_risk_areas(self, max_features: int = 10000) -> List[Dict]:
        """
        Get official foundation risk areas from PDOK WFS.

        This is the official government dataset "Indicatieve Aandachtsgebieden Funderingsproblematiek"
        which identifies areas where foundation problems may occur in homes built before 1970.

        Returns:
            List of risk area features with geometry
        """
        log.info("Fetching official PDOK foundation risk areas...")

        # WFS GetFeature request for GeoJSON
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "indgebfunderingsproblematiek:indgebfunderingsproblematiek",
            "outputFormat": "application/json",
            "count": str(max_features),
            "srsName": "EPSG:4326"  # WGS84 for easy use
        }

        try:
            response = self.client.get(PDOK_FOUNDATION_WFS, params=params)
            response.raise_for_status()

            data = response.json()
            features = data.get("features", [])

            log.success(f"Downloaded {len(features)} foundation risk areas from PDOK")

            # Parse features into standardized format
            risk_areas = []
            for feature in features:
                props = feature.get("properties", {})
                geometry = feature.get("geometry", {})

                risk_areas.append({
                    "id": feature.get("id"),
                    "geometry": geometry,
                    "geometry_type": geometry.get("type"),
                    "risk_level": "attention",  # This dataset marks "attention areas"
                    "source": "PDOK/RVO",
                    "description": props.get("omschrijving", "Foundation attention area"),
                    "municipality": props.get("gemeentenaam"),
                    "province": props.get("provincienaam"),
                    "needs_inspection": True,
                    "note": "This area is marked as having potential foundation problems for buildings built before 1970"
                })

            return risk_areas

        except httpx.HTTPStatusError as e:
            log.error(f"HTTP error fetching PDOK data: {e.response.status_code}")
            return []
        except Exception as e:
            log.error(f"Error fetching PDOK foundation data: {e}")
            return []

    def check_point_in_risk_area(self, lat: float, lng: float) -> Optional[Dict]:
        """
        Check if a specific point (lat/lng) is within a foundation risk area.

        Uses PDOK WFS with spatial filter.

        Args:
            lat: Latitude (WGS84)
            lng: Longitude (WGS84)

        Returns:
            Risk area info if point is in a risk area, None otherwise
        """
        # CQL filter for point intersection
        cql_filter = f"INTERSECTS(geometry, POINT({lng} {lat}))"

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "indgebfunderingsproblematiek:indgebfunderingsproblematiek",
            "outputFormat": "application/json",
            "CQL_FILTER": cql_filter,
            "srsName": "EPSG:4326"
        }

        try:
            response = self.client.get(PDOK_FOUNDATION_WFS, params=params)
            response.raise_for_status()

            data = response.json()
            features = data.get("features", [])

            if features:
                feature = features[0]
                props = feature.get("properties", {})
                return {
                    "in_risk_area": True,
                    "risk_level": "attention",
                    "municipality": props.get("gemeentenaam"),
                    "source": "PDOK/RVO Official Data",
                    "warning": "This location is in an official foundation attention area. Buildings built before 1970 may have foundation problems.",
                    "recommendation": "Get a professional foundation inspection (bouwkundig rapport) before purchasing."
                }

            return {"in_risk_area": False}

        except Exception as e:
            log.warning(f"Could not check foundation risk for point: {e}")
            return None

    def get_known_risk_areas(self) -> List[Dict]:
        """
        Get known foundation risk areas from manual compilation.

        Returns:
            List of risk areas
        """
        all_risks = []

        for city, areas in KNOWN_RISK_AREAS.items():
            for area in areas:
                all_risks.append({
                    "city": city,
                    "area": area["area"],
                    "risk_level": area["risk"],
                    "reason": area["reason"],
                    "source": "manual_compilation",
                    "needs_inspection": area["risk"] in ["high", "medium"],
                })

        return all_risks

    def get_elevation_data(self, bbox: tuple) -> Optional[Dict]:
        """
        Get elevation data from AHN (for flood risk / subsidence indicators).

        Args:
            bbox: Bounding box (minx, miny, maxx, maxy)

        Returns:
            Elevation data
        """
        # This would query AHN WCS for elevation raster
        # For now, just placeholder
        log.warning("AHN elevation query not yet implemented")
        return None

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/foundation_risk.json",
    help="Output JSON file"
)
@click.option(
    "--fetch-pdok/--no-fetch-pdok",
    default=True,
    help="Fetch official PDOK foundation risk areas"
)
@click.option(
    "--output-geojson",
    type=click.Path(),
    default="../../data/processed/foundation_risk_areas.geojson",
    help="Output GeoJSON file for map display"
)
def main(output: str, fetch_pdok: bool, output_geojson: str):
    """
    Download foundation risk and soil problem data.

    Foundation issues are HUGE in Netherlands:
    - Wooden piles rot after 50-100 years below water table
    - Peat soil subsidence (bodemdaling)
    - Cost: €50,000 - €150,000 to repair!

    Risk factors:
    - Building age (pre-1950 = higher risk)
    - Soil type (peat = high risk, sand = low risk)
    - Water table changes
    - Location (Amsterdam Jordaan = high risk)

    Examples:
        python -m ingest.foundation_risk
        python -m ingest.foundation_risk --no-fetch-pdok

    Data sources:
    - PDOK official government foundation attention areas
    - Manually compiled risk data from municipal reports
    """
    log.info("=== Foundation Risk Data Ingestion ===")
    log.warning("⚠️  Foundation issues can cost €50k-150k to repair!")
    log.warning("⚠️  Critical data for expats buying property in NL!")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    geojson_path = Path(output_geojson)
    geojson_path.parent.mkdir(parents=True, exist_ok=True)

    pdok_risk_areas = []

    with FoundationRiskClient() as client:
        # Fetch official PDOK data
        if fetch_pdok:
            log.info("Fetching official PDOK foundation risk areas...")
            pdok_risk_areas = client.get_pdok_foundation_risk_areas()

            if pdok_risk_areas:
                # Save as GeoJSON for map display
                geojson_data = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "id": area.get("id"),
                            "geometry": area.get("geometry"),
                            "properties": {
                                "risk_level": area.get("risk_level"),
                                "municipality": area.get("municipality"),
                                "province": area.get("province"),
                                "source": area.get("source"),
                                "needs_inspection": area.get("needs_inspection"),
                                "note": area.get("note")
                            }
                        }
                        for area in pdok_risk_areas
                        if area.get("geometry")
                    ]
                }

                with open(geojson_path, "w", encoding="utf-8") as f:
                    json.dump(geojson_data, f, ensure_ascii=False)
                log.success(f"Saved {len(geojson_data['features'])} areas to {geojson_path}")

        # Get known risk areas (manual compilation)
        log.info("Loading manually compiled foundation risk areas...")
        risk_areas = client.get_known_risk_areas()

    log.success(f"Loaded {len(risk_areas)} manually compiled risk areas")
    log.success(f"Loaded {len(pdok_risk_areas)} official PDOK risk areas")

    # Add general risk factors
    general_risk_factors = {
        "high_risk_indicators": [
            "Building built before 1950",
            "Located in historic city center",
            "Wooden pile foundations",
            "Peat soil (veen)",
            "Near canals or waterways",
            "Visible cracks in walls",
            "Doors/windows don't close properly",
            "Sloping floors",
        ],
        "medium_risk_indicators": [
            "Building built 1950-1970",
            "Mixed soil conditions",
            "Near former water bodies",
            "Neighborhood has reported issues",
        ],
        "low_risk_indicators": [
            "Building built after 1980",
            "Sandy soil",
            "Modern concrete foundations",
            "Flat terrain",
        ],
        "inspection_advice": {
            "high_risk": "ALWAYS get professional foundation inspection (bouwkundig rapport)",
            "medium_risk": "Strongly recommended to get inspection",
            "low_risk": "Standard inspection sufficient, but mention foundation"
        },
        "typical_costs": {
            "inspection": "€500-1500",
            "minor_repairs": "€5,000-15,000",
            "major_renovation": "€50,000-150,000",
            "full_replacement": "€100,000-250,000+"
        },
        "warning_signs": [
            "Scheuren in muren (cracks in walls)",
            "Deuren die niet sluiten (doors not closing)",
            "Scheve vloeren (sloping floors)",
            "Scheuren boven ramen/deuren (cracks above windows/doors)",
            "Vochtproblemen (moisture problems)",
        ]
    }

    # Save
    result = {
        "metadata": {
            "source": "PDOK Official Data + Manual compilation from municipal reports",
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_manual_risk_areas": len(risk_areas),
            "total_pdok_risk_areas": len(pdok_risk_areas),
            "coverage": "Netherlands-wide (PDOK) + detailed major cities (manual)",
            "note": "Foundation issues are common in historic Dutch buildings!",
            "warning": "ALWAYS get professional inspection for pre-1970 buildings in attention areas",
            "license": "Open Data / Public Domain"
        },
        "manual_risk_areas": risk_areas,
        "pdok_summary": {
            "total_areas": len(pdok_risk_areas),
            "geojson_file": str(geojson_path) if pdok_risk_areas else None,
            "wfs_endpoint": PDOK_FOUNDATION_WFS,
            "wms_endpoint": PDOK_FOUNDATION_WMS
        },
        "risk_factors": general_risk_factors,
        "resources": {
            "pdok_data": "https://data.overheid.nl/en/dataset/11058-indicatieve-aandachtsgebieden-funderingsproblematiek",
            "funderingsmonitor": "https://www.funderingsmonitor.nl/",
            "fundermaps": "https://fundermaps.com/",
            "kcaf": "https://www.kcaf.nl/",
            "amsterdam_foundation_map": "https://maps.amsterdam.nl/funderingen/",
            "knowledgebase": "https://www.verbeterjehuis.nl/kennisbank/fundering/",
        }
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved foundation risk data to {output_path}")

    # Statistics
    log.info("\n=== Foundation Risk by City ===")
    for city in KNOWN_RISK_AREAS.keys():
        areas = [a for a in risk_areas if a["city"] == city]
        high_risk = len([a for a in areas if a["risk_level"] == "high"])
        log.info(f"{city.title()}: {len(areas)} areas ({high_risk} high risk)")

    log.info("\n💡 Important for Expats:")
    log.info("- Foundation inspection is NOT included in standard viewing")
    log.info("- Seller not required to disclose foundation issues")
    log.info("- Budget €1000-1500 for professional bouwkundig rapport")
    log.info("- Pre-1950 buildings in Amsterdam/Gouda/Delft = HIGH RISK")
    log.info("- Repairs can cost more than the house is worth!")

    log.info("\n🔍 Red Flags:")
    log.info("- Price significantly below market (may have foundation issues)")
    log.info("- Recent 'cosmetic' renovations (hiding problems)")
    log.info("- Seller refuses foundation clause in contract")

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"\nFile size: {file_size_kb:.1f} KB")


if __name__ == "__main__":
    main()
