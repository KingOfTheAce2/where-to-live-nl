"""
Download CBS Wijken & Buurten (neighborhoods) boundaries and convert to Parquet.

This script downloads the complete CBS neighborhoods dataset from PDOK WFS
and stores it locally as Parquet for fast offline access.

Data source: CBS Wijken en Buurten 2024
License: CC-BY 4.0
Size: ~20MB compressed, ~12,000 neighborhoods
"""

import httpx
import polars as pl
import json
from pathlib import Path
from typing import Dict, Any
import time

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Output files
RAW_JSON_FILE = RAW_DIR / "cbs_boundaries_buurten.json"
PARQUET_FILE = PROCESSED_DIR / "neighborhood_boundaries.parquet"

# PDOK WFS endpoint
WFS_URL = "https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0"


def download_all_boundaries():
    """
    Download all neighborhood boundaries from CBS WFS.

    Uses pagination to fetch all ~12,000 neighborhoods.
    """
    print("[*] Downloading CBS neighborhood boundaries from PDOK...")

    all_features = []
    start_index = 0
    page_size = 1000  # WFS maximum

    while True:
        print(f"   Fetching records {start_index} to {start_index + page_size}...")

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "buurten",  # Neighborhoods (smallest unit)
            "outputFormat": "json",
            "srsName": "EPSG:4326",  # WGS84 lat/lng
            "startIndex": start_index,
            "count": page_size
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.get(WFS_URL, params=params)
                response.raise_for_status()
                data = response.json()

                features = data.get("features", [])
                if not features:
                    break  # No more data

                all_features.extend(features)
                print(f"   [OK] Retrieved {len(features)} features (total: {len(all_features)})")

                # If we got less than page_size, we're done
                if len(features) < page_size:
                    break

                start_index += page_size
                time.sleep(0.5)  # Be nice to the server

        except httpx.HTTPError as e:
            print(f"   [ERROR] HTTP error: {e}")
            break
        except Exception as e:
            print(f"   [ERROR] Error: {e}")
            break

    print(f"[OK] Downloaded {len(all_features)} neighborhoods")

    # Save raw JSON
    print(f"[SAVE] Saving raw JSON to {RAW_JSON_FILE}...")
    with open(RAW_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            "type": "FeatureCollection",
            "features": all_features
        }, f, ensure_ascii=False)

    return all_features


def extract_geometry_bounds(geometry: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract bounding box from geometry for quick filtering.
    """
    coords = geometry.get("coordinates", [])

    if geometry.get("type") == "Polygon":
        all_coords = coords[0] if coords else []
    elif geometry.get("type") == "MultiPolygon":
        all_coords = []
        for polygon in coords:
            all_coords.extend(polygon[0] if polygon else [])
    else:
        return {"min_lng": None, "max_lng": None, "min_lat": None, "max_lat": None}

    if not all_coords:
        return {"min_lng": None, "max_lng": None, "min_lat": None, "max_lat": None}

    lngs = [c[0] for c in all_coords]
    lats = [c[1] for c in all_coords]

    return {
        "min_lng": min(lngs),
        "max_lng": max(lngs),
        "min_lat": min(lats),
        "max_lat": max(lats)
    }


def convert_to_parquet(features: list):
    """
    Convert GeoJSON features to Parquet with optimized schema.

    Schema:
    - buurtcode: Unique neighborhood code (e.g., "BU03630000")
    - buurtnaam: Neighborhood name
    - wijkcode: District code
    - gemeentecode: Municipality code
    - gemeentenaam: Municipality name
    - geometry_json: Full GeoJSON geometry as string
    - geometry_type: Polygon or MultiPolygon
    - min_lng, max_lng, min_lat, max_lat: Bounding box for quick filtering
    - is_foreign: Boolean flag for Belgian enclaves (Buitenland)
    - centroid_lng, centroid_lat: Approximate center point
    """
    print(f"[PROCESS] Converting {len(features)} features to Parquet...")

    records = []

    for feature in features:
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})

        # Calculate bounding box
        bounds = extract_geometry_bounds(geometry)

        # Calculate centroid (simple average of bbox)
        centroid_lng = (bounds["min_lng"] + bounds["max_lng"]) / 2 if bounds["min_lng"] else None
        centroid_lat = (bounds["min_lat"] + bounds["max_lat"]) / 2 if bounds["min_lat"] else None

        # Detect foreign territory
        is_foreign = (
            props.get("buurtcode") == "BU09989999" or
            props.get("gemeentenaam") == "Buitenland" or
            props.get("buurtnaam") == "Buitenland"
        )

        records.append({
            "buurtcode": props.get("buurtcode"),
            "buurtnaam": props.get("buurtnaam"),
            "wijkcode": props.get("wijkcode"),
            "gemeentecode": props.get("gemeentecode"),
            "gemeentenaam": props.get("gemeentenaam"),
            "geometry_json": json.dumps(geometry, ensure_ascii=False),
            "geometry_type": geometry.get("type"),
            "min_lng": bounds["min_lng"],
            "max_lng": bounds["max_lng"],
            "min_lat": bounds["min_lat"],
            "max_lat": bounds["max_lat"],
            "centroid_lng": centroid_lng,
            "centroid_lat": centroid_lat,
            "is_foreign": is_foreign,
            "water": props.get("water") == "JA",  # Is this a water body?
            "postcode": props.get("meestVoorkomendePostcode"),
        })

    # Create Polars DataFrame
    df = pl.DataFrame(records)

    # Show statistics
    print("\n[STATS] Dataset Statistics:")
    print(f"   Total neighborhoods: {len(df)}")
    print(f"   Unique municipalities: {df['gemeentenaam'].n_unique()}")
    print(f"   Foreign territories: {df.filter(pl.col('is_foreign')).height}")
    print(f"   Water bodies: {df.filter(pl.col('water')).height}")
    print(f"   Polygons: {df.filter(pl.col('geometry_type') == 'Polygon').height}")
    print(f"   MultiPolygons: {df.filter(pl.col('geometry_type') == 'MultiPolygon').height}")

    # Save to Parquet with compression
    print(f"\n[SAVE] Saving to {PARQUET_FILE}...")
    df.write_parquet(
        PARQUET_FILE,
        compression="zstd",
        compression_level=3
    )

    # Show file size
    file_size_mb = PARQUET_FILE.stat().st_size / (1024 * 1024)
    print(f"[OK] Saved {len(df)} records ({file_size_mb:.2f} MB)")

    # Show sample
    print("\n[SAMPLE] Sample records:")
    print(df.select([
        "buurtcode", "buurtnaam", "gemeentenaam",
        "is_foreign", "geometry_type", "centroid_lng", "centroid_lat"
    ]).head(5))

    return df


def test_lookups(df: pl.DataFrame):
    """
    Test various lookup patterns to verify data quality.
    """
    print("\n[TEST] Testing lookups...")

    # Test 1: Lookup by buurtcode
    test_code = "BU07771008"  # Example neighborhood
    result = df.filter(pl.col("buurtcode") == test_code)
    print(f"\n   Test 1 - Lookup by code {test_code}:")
    if result.height > 0:
        print(f"   [OK] Found: {result['buurtnaam'][0]}, {result['gemeentenaam'][0]}")
    else:
        print(f"   [ERROR] Not found")

    # Test 2: Lookup by coordinates (bounding box)
    test_lng, test_lat = 4.635, 51.576  # Etten-Leur coordinates
    result = df.filter(
        (pl.col("min_lng") <= test_lng) &
        (pl.col("max_lng") >= test_lng) &
        (pl.col("min_lat") <= test_lat) &
        (pl.col("max_lat") >= test_lat)
    )
    print(f"\n   Test 2 - Lookup by coordinates ({test_lng}, {test_lat}):")
    if result.height > 0:
        print(f"   [OK] Found {result.height} potential matches:")
        for i in range(min(3, result.height)):
            print(f"      - {result['buurtnaam'][i]}, {result['gemeentenaam'][i]}")
    else:
        print(f"   [ERROR] Not found")

    # Test 3: Find foreign territories
    foreign = df.filter(pl.col("is_foreign"))
    print(f"\n   Test 3 - Foreign territories:")
    print(f"   [OK] Found {foreign.height} foreign territories:")
    for i in range(min(5, foreign.height)):
        print(f"      - {foreign['buurtnaam'][i]} ({foreign['gemeentenaam'][i]})")

    # Test 4: Find Baarle-Nassau neighborhoods
    baarle = df.filter(pl.col("gemeentenaam") == "Baarle-Nassau")
    print(f"\n   Test 4 - Baarle-Nassau neighborhoods:")
    print(f"   [OK] Found {baarle.height} neighborhoods in Baarle-Nassau:")
    for i in range(min(10, baarle.height)):
        foreign_flag = "[BE]" if baarle['is_foreign'][i] else "[NL]"
        print(f"      {foreign_flag} {baarle['buurtnaam'][i]} ({baarle['buurtcode'][i]})")


def main():
    print("=" * 70)
    print("CBS NEIGHBORHOOD BOUNDARIES INGESTION")
    print("=" * 70)
    print()

    # Step 1: Download data
    features = download_all_boundaries()

    if not features:
        print("[ERROR] No data downloaded. Exiting.")
        return

    print()

    # Step 2: Convert to Parquet
    df = convert_to_parquet(features)

    print()

    # Step 3: Test lookups
    test_lookups(df)

    print()
    print("=" * 70)
    print("[OK] INGESTION COMPLETE!")
    print("=" * 70)
    print()
    print(f"[FILE] Raw JSON: {RAW_JSON_FILE}")
    print(f"[FILE] Parquet: {PARQUET_FILE}")
    print()
    print("Next steps:")
    print("1. Update backend/api_server.py to use Parquet instead of WFS")
    print("2. Add spatial index for faster coordinate lookups")
    print("3. Test boundary display in frontend")


if __name__ == "__main__":
    main()
