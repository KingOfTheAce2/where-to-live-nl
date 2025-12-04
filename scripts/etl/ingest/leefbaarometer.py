"""
Leefbaarometer (Livability Index) data ingestion.

Downloads livability scores from the Leefbaarometer WFS API.
Provides scores from grid level (100x100m) to municipality level.

Data source: https://www.leefbaarometer.nl/
WFS API: https://geo.leefbaarometer.nl/lbm3/ows
License: Open Data
"""

import json
import time
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
import click
import httpx
from tqdm import tqdm
import xml.etree.ElementTree as ET

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# Leefbaarometer WFS endpoint
LBM_WFS_BASE = "https://geo.leefbaarometer.nl/lbm3/ows"

# Available layers (measurements) - Updated January 2025
# Layer naming convention: {level}score{year}
LAYERS = {
    "grid_100m": "lbm3:clippedgridscore24",  # 100x100m grid (most detailed) - LARGE!
    "postal_code_4": "lbm3:pc4score24",  # 4-digit postal code areas
    "neighborhood": "lbm3:buurtscore24",  # Neighborhood (buurt) - RECOMMENDED
    "district": "lbm3:wijkscore24",  # District (wijk)
    "municipality": "lbm3:gemeentescore24"  # Municipality (gemeente)
}


class LeefbarometerClient:
    """Client for Leefbaarometer WFS API."""

    def __init__(self, timeout: int = 60):
        """
        Initialize Leefbaarometer client.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/html, */*",
                "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Referer": "https://www.leefbaarometer.nl/"
            }
        )

    def get_capabilities(self) -> str:
        """
        Get WFS capabilities (available layers).

        Returns:
            XML string with capabilities
        """
        try:
            response = self.client.get(
                LBM_WFS_BASE,
                params={
                    "service": "WFS",
                    "version": "2.0.0",
                    "request": "GetCapabilities"
                }
            )
            response.raise_for_status()
            return response.text

        except Exception as e:
            log.error(f"Error fetching capabilities: {e}")
            raise

    def get_features(
        self,
        layer: str,
        max_features: Optional[int] = None,
        bbox: Optional[tuple] = None,
        output_format: str = "application/json"
    ) -> Dict:
        """
        Get features from a layer using WFS.

        Args:
            layer: Layer name (e.g., "lbm3:v_lbm_2024_100m")
            max_features: Maximum number of features to return
            bbox: Bounding box (min_lon, min_lat, max_lon, max_lat)
            output_format: Output format (default: GeoJSON)

        Returns:
            GeoJSON FeatureCollection
        """
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": layer,
            "outputFormat": output_format
        }

        if max_features:
            params["count"] = max_features

        if bbox:
            # Format: minx,miny,maxx,maxy,CRS
            params["bbox"] = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},EPSG:4326"

        try:
            log.info(f"Fetching features from layer: {layer}")
            response = self.client.get(LBM_WFS_BASE, params=params)
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            log.error(f"HTTP error {e.response.status_code}: {layer}")
            log.error(f"Response: {e.response.text[:500]}")
            raise
        except Exception as e:
            log.error(f"Error fetching features from {layer}: {e}")
            raise

    def get_features_paginated(
        self,
        layer: str,
        page_size: int = 5000,
        max_total: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch features with pagination (for large datasets).

        Args:
            layer: Layer name
            page_size: Number of features per page
            max_total: Maximum total features to fetch

        Returns:
            List of GeoJSON features
        """
        all_features = []
        start_index = 0

        with tqdm(desc=f"Fetching {layer}", unit=" features") as pbar:
            while True:
                # Check if we've reached the limit
                if max_total and len(all_features) >= max_total:
                    break

                # WFS 2.0 uses startIndex for pagination
                params = {
                    "service": "WFS",
                    "version": "2.0.0",
                    "request": "GetFeature",
                    "typeName": layer,
                    "outputFormat": "application/json",
                    "count": page_size,
                    "startIndex": start_index
                }

                try:
                    response = self.client.get(LBM_WFS_BASE, params=params)
                    response.raise_for_status()

                    data = response.json()
                    features = data.get("features", [])

                    if not features:
                        break  # No more data

                    all_features.extend(features)
                    pbar.update(len(features))

                    # Check if there are more features
                    total_features = data.get("totalFeatures", 0)
                    if start_index + len(features) >= total_features:
                        break

                    start_index += page_size
                    time.sleep(0.1)  # Be nice to the server

                except Exception as e:
                    log.error(f"Error fetching page at index {start_index}: {e}")
                    break

        log.success(f"Fetched {len(all_features)} features from {layer}")
        return all_features

    def close(self):
        """Close HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_feature(feature: Dict) -> Dict:
    """
    Transform GeoJSON feature to simplified format.

    Args:
        feature: GeoJSON feature

    Returns:
        Simplified feature dictionary
    """
    props = feature.get("properties", {})
    geometry = feature.get("geometry", {})

    # Field mapping for 2024 data:
    # kscore = categorical score (1-9, where 5=average)
    # kafw/kfys/konv/ksoc/kvrz/kwon = categorical scores for dimensions
    # afw/fys/onv/soc/vrz/won = continuous deviation from national average

    return {
        "id": props.get("id"),
        "area_code": props.get("id"),  # BU/WK/GM code
        "area_name": props.get("name"),
        "municipality": props.get("gemeente"),
        "scale": props.get("scale"),  # buurt/wijk/gemeente
        "year": props.get("year", "2024"),

        # Categorical scores (1-9, where 5 is national average)
        "score_total": props.get("kscore"),  # Overall livability
        "score_deviation": props.get("kafw"),  # Overall deviation category
        "score_physical": props.get("kfys"),  # Physical environment
        "score_nuisance": props.get("konv"),  # Nuisance/safety (overlast/veiligheid)
        "score_social": props.get("ksoc"),  # Social cohesion
        "score_facilities": props.get("kvrz"),  # Facilities (voorzieningen)
        "score_housing": props.get("kwon"),  # Housing stock

        # Continuous deviation scores (from national average)
        "deviation_total": props.get("afw"),
        "deviation_physical": props.get("fys"),
        "deviation_nuisance": props.get("onv"),
        "deviation_social": props.get("soc"),
        "deviation_facilities": props.get("vrz"),
        "deviation_housing": props.get("won"),

        "geometry": geometry
    }


@click.command()
@click.option(
    "--layer",
    type=click.Choice(list(LAYERS.keys())),
    default="neighborhood",
    help="Geographic level to download"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/leefbaarometer.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N features for testing"
)
@click.option(
    "--geojson",
    is_flag=True,
    help="Save as GeoJSON instead of simplified JSON"
)
def main(
    layer: str,
    output: str,
    sample: Optional[int],
    geojson: bool
):
    """
    Download Leefbaarometer (livability) scores from WFS API.

    Examples:
        # Download neighborhood-level data
        python -m ingest.leefbaarometer

        # Download 100x100m grid (very detailed, large file!)
        python -m ingest.leefbaarometer --layer grid_100m

        # Test with 100 features
        python -m ingest.leefbaarometer --sample 100

        # Save as GeoJSON (for GIS tools)
        python -m ingest.leefbaarometer --geojson
    """
    log.info("=== Leefbaarometer Data Ingestion ===")

    # Create output directory
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    layer_name = LAYERS[layer]
    log.info(f"Layer: {layer} ({layer_name})")

    # Fetch data
    with LeefbarometerClient() as client:
        # Get capabilities (for debugging)
        log.info("Fetching WFS capabilities...")
        capabilities = client.get_capabilities()
        log.debug(f"Capabilities XML length: {len(capabilities)} bytes")

        # Fetch features
        if sample and sample < 5000:
            # Single request for small samples
            geojson_data = client.get_features(
                layer=layer_name,
                max_features=sample
            )
            features = geojson_data.get("features", [])
        else:
            # Paginated fetch for large datasets
            features = client.get_features_paginated(
                layer=layer_name,
                max_total=sample
            )

            geojson_data = {
                "type": "FeatureCollection",
                "features": features
            }

    log.info(f"Downloaded {len(features)} features")

    # Save data
    if geojson:
        # Save as GeoJSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)
        log.success(f"Saved GeoJSON to {output_path}")
    else:
        # Transform to simplified format
        simplified = []
        for feature in tqdm(features, desc="Transforming features"):
            simplified.append(transform_feature(feature))

        # Add metadata
        result = {
            "metadata": {
                "source": "Leefbaarometer",
                "layer": layer,
                "measurement_year": 2024,
                "downloaded_at": datetime.utcnow().isoformat(),
                "total_features": len(simplified)
            },
            "data": simplified
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        log.success(f"Saved {len(simplified)} livability scores to {output_path}")

    # Show sample
    if features:
        log.info("\n=== Sample Feature ===")
        sample_feature = features[0]
        props = sample_feature.get("properties", {})
        log.info(f"  Area: {props.get('name')} ({props.get('id')})")
        log.info(f"  Municipality: {props.get('gemeente')}")
        log.info(f"  Total score: {props.get('kscore')} (1=worst, 5=average, 9=best)")
        log.info(f"  Physical environment: {props.get('kfys')}")
        log.info(f"  Nuisance/Safety: {props.get('konv')}")
        log.info(f"  Social cohesion: {props.get('ksoc')}")
        log.info(f"  Facilities: {props.get('kvrz')}")
        log.info(f"  Housing: {props.get('kwon')}")

    # File size
    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"Output file size: {file_size_mb:.1f} MB")


if __name__ == "__main__":
    main()
