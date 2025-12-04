"""
Train Stations (NS and regional) scraper from OpenStreetMap

Since the GTFS feed is not available, we'll use OpenStreetMap data
which has comprehensive railway station information for the Netherlands.

Data includes:
- All NS (Nederlandse Spoorwegen) stations
- Regional train stations
- Station names (Dutch and international)
- Coordinates
- Operator information
"""

import requests
import json
from pathlib import Path
from typing import List, Dict, Any
import time

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_FILE = DATA_DIR / "train_stations.json"

# Processed output
PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_PARQUET = PROCESSED_DIR / "train_stations.parquet"


def fetch_train_stations() -> List[Dict[str, Any]]:
    """
    Fetch all train stations in the Netherlands from OpenStreetMap.

    Returns:
        List of train station dictionaries
    """
    # Fix Windows console encoding
    import sys
    import io
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    # Overpass QL query for railway stations in Netherlands
    overpass_query = """
    [out:json][timeout:60];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["railway"="station"](area);
      node["railway"="halt"](area);
    );
    out body;
    >;
    out skel qt;
    """

    print("🚂 Fetching train stations from OpenStreetMap...")
    print(f"Query: Railway stations and halts in Netherlands")

    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": overpass_query},
            timeout=120
        )
        response.raise_for_status()

        data = response.json()
        elements = data.get("elements", [])

        print(f"✅ Fetched {len(elements)} railway elements")

        # Process and clean the data
        stations = []
        for element in elements:
            if element.get("type") != "node":
                continue

            tags = element.get("tags", {})

            # Only include actual stations (not technical nodes)
            if "name" not in tags:
                continue

            station = {
                "id": element["id"],
                "name": tags.get("name"),
                "name_en": tags.get("name:en"),
                "name_nl": tags.get("name:nl"),
                "lat": element.get("lat"),
                "lon": element.get("lon"),
                "railway_type": tags.get("railway"),  # station or halt
                "operator": tags.get("operator", "NS"),  # Default to NS
                "network": tags.get("network"),
                "station_code": tags.get("uic_ref") or tags.get("ref"),  # Station code
                "wheelchair": tags.get("wheelchair"),
                "platforms": tags.get("platforms"),
                "local_ref": tags.get("local_ref"),
                "wikidata": tags.get("wikidata"),
                "wikipedia": tags.get("wikipedia")
            }

            stations.append(station)

        print(f"✅ Processed {len(stations)} train stations")

        # Show some statistics
        operators = {}
        for station in stations:
            op = station.get("operator", "Unknown")
            operators[op] = operators.get(op, 0) + 1

        print("\n📊 Stations by operator:")
        for op, count in sorted(operators.items(), key=lambda x: x[1], reverse=True):
            print(f"  {op}: {count}")

        return stations

    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
        return []


def save_to_json(stations: List[Dict[str, Any]]):
    """Save stations to JSON file"""
    print(f"\n💾 Saving to {OUTPUT_FILE}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(stations, f, indent=2, ensure_ascii=False)

    file_size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"✅ Saved {len(stations)} stations ({file_size_kb:.1f} KB)")


def convert_to_parquet(stations: List[Dict[str, Any]]):
    """Convert to Parquet format for fast queries"""
    try:
        import polars as pl

        print(f"\n🔄 Converting to Parquet...")

        # Increase schema inference length to handle all variations
        df = pl.DataFrame(stations, infer_schema_length=len(stations))

        df.write_parquet(
            OUTPUT_PARQUET,
            compression="snappy"
        )

        file_size_kb = OUTPUT_PARQUET.stat().st_size / 1024
        print(f"✅ Saved to Parquet: {OUTPUT_PARQUET}")
        print(f"📦 File size: {file_size_kb:.1f} KB")
        print(f"📊 Total stations: {df.height}")

        # Show sample
        print("\n📋 Sample stations:")
        sample = df.head(10)
        for row in sample.iter_rows(named=True):
            operator = row.get('operator') or 'Unknown'
            print(f"  - {row['name']} ({operator})")

    except ImportError:
        print("⚠️  Polars not installed. Skipping Parquet conversion.")
        print("   Install with: pip install polars")


def main():
    """Main execution"""
    # Fix Windows console encoding
    import sys
    import io
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    print("=" * 70)
    print("🚂 Train Stations Data Fetcher (OpenStreetMap)")
    print("=" * 70)
    print()

    # Fetch stations
    stations = fetch_train_stations()

    if not stations:
        print("\n❌ No stations fetched. Exiting.")
        return

    # Save to JSON
    save_to_json(stations)

    # Convert to Parquet
    convert_to_parquet(stations)

    print("\n" + "=" * 70)
    print("✅ COMPLETE")
    print("=" * 70)
    print(f"\nFiles created:")
    print(f"  - {OUTPUT_FILE}")
    print(f"  - {OUTPUT_PARQUET}")
    print()


if __name__ == "__main__":
    main()
