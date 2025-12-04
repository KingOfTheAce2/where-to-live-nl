"""
Enrich air quality data with station coordinates from Luchtmeetnet API.

This script fetches coordinates for all air quality monitoring stations
and adds them to the existing air_quality.json file.
"""

import json
import time
from pathlib import Path
import requests

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"
AIR_QUALITY_FILE = DATA_DIR / "air_quality.json"

def fetch_station_coordinates(station_number: str) -> dict | None:
    """
    Fetch coordinates for a specific station from Luchtmeetnet API.

    Args:
        station_number: Station number (e.g., "NL01491")

    Returns:
        Dict with coordinates if successful, None otherwise
    """
    url = f"https://api.luchtmeetnet.nl/open_api/stations/{station_number}"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()
        geometry = data.get("data", {}).get("geometry", {})
        coordinates = geometry.get("coordinates", [])

        if len(coordinates) == 2:
            return {
                "lng": coordinates[0],
                "lat": coordinates[1]
            }
        else:
            print(f"  WARNING: No coordinates found for {station_number}")
            return None

    except Exception as e:
        print(f"  ERROR fetching {station_number}: {e}")
        return None


def main():
    """Main function to enrich air quality data with coordinates."""

    print("Enriching air quality data with station coordinates...")
    print()

    # Load existing air quality data
    if not AIR_QUALITY_FILE.exists():
        print(f"Error: {AIR_QUALITY_FILE} not found")
        return

    with open(AIR_QUALITY_FILE, 'r', encoding='utf-8') as f:
        air_quality_data = json.load(f)

    stations = air_quality_data.get("data", [])
    total_stations = len(stations)

    print(f"Found {total_stations} stations to enrich")
    print()

    # Fetch coordinates for each station
    enriched_count = 0
    failed_count = 0

    for i, station in enumerate(stations, 1):
        station_number = station.get("number")

        if not station_number:
            print(f"  WARNING: Station {i} has no number, skipping")
            continue

        print(f"[{i}/{total_stations}] Fetching coordinates for {station_number} ({station.get('location', 'Unknown')})")

        coords = fetch_station_coordinates(station_number)

        if coords:
            station["coordinates"] = coords
            enriched_count += 1
            print(f"  SUCCESS: Added coordinates: {coords['lat']:.5f}, {coords['lng']:.5f}")
        else:
            failed_count += 1

        # Be respectful to the API - add a small delay
        if i < total_stations:
            time.sleep(0.5)

        print()

    # Save enriched data
    print(f"Saving enriched data to {AIR_QUALITY_FILE}")

    with open(AIR_QUALITY_FILE, 'w', encoding='utf-8') as f:
        json.dump(air_quality_data, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 60)
    print(f"COMPLETE!")
    print(f"   Enriched: {enriched_count} stations")
    print(f"   Failed: {failed_count} stations")
    print(f"   Total: {total_stations} stations")
    print("=" * 60)


if __name__ == "__main__":
    main()
