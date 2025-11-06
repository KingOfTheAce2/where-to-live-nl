"""
NS Stations (Train Stations) data ingestion.

Downloads all train stations in the Netherlands from NS API.
Critical for expats - distance to train station is a major factor.

Data source: NS API (Nederlandse Spoorwegen)
Alternative: GTFS feed or OpenStreetMap
License: Open Data
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# NS API endpoints
NS_API_BASE = "https://gateway.apiportal.ns.nl"
NS_STATIONS_ENDPOINT = "/reisinformatie-api/api/v2/stations"

# Alternative: GTFS feed (more reliable, no API key needed)
GTFS_STATIONS_URL = "https://gtfs.ovapi.nl/nl/stops.txt"

# OVapi (real-time public transport data)
OVAPI_BASE = "http://v0.ovapi.nl"


class NSStationsClient:
    """Client for NS Stations data."""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 60):
        """
        Initialize NS client.

        Args:
            api_key: NS API key (optional - will try GTFS fallback)
            timeout: HTTP request timeout
        """
        self.api_key = api_key

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/csv, */*",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        }

        if api_key:
            headers["Ocp-Apim-Subscription-Key"] = api_key

        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers=headers
        )

    def get_stations_from_ns(self) -> List[Dict]:
        """
        Get stations from NS API (requires API key).

        Returns:
            List of station records
        """
        if not self.api_key:
            raise ValueError("NS API key required for this method")

        try:
            log.info("Fetching stations from NS API...")
            response = self.client.get(f"{NS_API_BASE}{NS_STATIONS_ENDPOINT}")
            response.raise_for_status()

            data = response.json()
            stations = data.get("payload", [])

            log.success(f"Fetched {len(stations)} stations from NS API")
            return stations

        except Exception as e:
            log.error(f"Error fetching from NS API: {e}")
            raise

    def get_stations_from_gtfs(self) -> List[Dict]:
        """
        Get stations from GTFS feed (no API key needed).

        GTFS stops.txt format:
        stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,location_type,parent_station

        Returns:
            List of station records
        """
        try:
            log.info("Downloading GTFS stops.txt...")
            response = self.client.get(GTFS_STATIONS_URL)
            response.raise_for_status()

            # Parse CSV
            lines = response.text.strip().split('\n')
            headers = lines[0].split(',')

            stations = []
            for line in tqdm(lines[1:], desc="Parsing stations"):
                if not line.strip():
                    continue

                fields = line.split(',')
                if len(fields) < 6:
                    continue

                # Filter for train stations (NS)
                stop_name = fields[2]

                # Only include train stations (exclude bus/tram/metro)
                if 'Station' in stop_name or 'station' in stop_name:
                    station = {
                        "stop_id": fields[0],
                        "stop_code": fields[1] if len(fields) > 1 else None,
                        "name": fields[2],
                        "description": fields[3] if len(fields) > 3 else None,
                        "lat": float(fields[4]) if fields[4] else None,
                        "lng": float(fields[5]) if fields[5] else None,
                        "location_type": fields[6] if len(fields) > 6 else None,
                        "parent_station": fields[7] if len(fields) > 7 else None,
                    }
                    stations.append(station)

            log.success(f"Parsed {len(stations)} train stations from GTFS")
            return stations

        except Exception as e:
            log.error(f"Error fetching from GTFS: {e}")
            raise

    def get_stations_from_ovapi(self) -> List[Dict]:
        """
        Get stations from OVapi (another open data source).

        Returns:
            List of station records
        """
        try:
            log.info("Fetching stations from OVapi...")
            # OVapi provides data per city/region
            # This is a fallback method
            response = self.client.get(f"{OVAPI_BASE}/stopareainfo")
            response.raise_for_status()

            data = response.json()
            # Parse OVapi format (nested structure)
            # This would need more detailed parsing

            return []

        except Exception as e:
            log.warning(f"OVapi fallback failed: {e}")
            return []

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_station(station: Dict, source: str) -> Dict:
    """
    Transform station record to unified format.

    Args:
        station: Raw station record
        source: Data source ("ns_api", "gtfs", etc.)

    Returns:
        Unified station record
    """
    if source == "ns_api":
        return {
            "code": station.get("code"),
            "uic_code": station.get("UICCode"),
            "name": station.get("namen", {}).get("lang"),
            "name_short": station.get("namen", {}).get("kort"),
            "name_medium": station.get("namen", {}).get("middel"),
            "country": station.get("land"),
            "type": station.get("stationType"),
            "lat": station.get("lat"),
            "lng": station.get("lng"),
            "synonyms": station.get("synoniemen", []),
            "has_facilities": station.get("heeftFaciliteiten", False),
            "has_travel_assistance": station.get("heeftReisassistentie", False),
            "has_departure_times": station.get("heeftVertrektijden", False),
            "source": "ns_api"
        }
    elif source == "gtfs":
        # Clean up station name (remove extra info)
        name = station.get("name", "")
        # Extract main station name
        if "," in name:
            name = name.split(",")[0]

        return {
            "code": station.get("stop_code"),
            "uic_code": None,
            "name": name,
            "name_short": name,
            "name_medium": name,
            "country": "NL",
            "type": "MEGA_STATION" if any(x in name.lower() for x in ['centraal', 'central']) else "KNOOPPUNT_STOPTREINSTATION",
            "lat": station.get("lat"),
            "lng": station.get("lng"),
            "synonyms": [],
            "has_facilities": None,
            "has_travel_assistance": None,
            "has_departure_times": True,
            "source": "gtfs",
            "gtfs_stop_id": station.get("stop_id")
        }

    return station


@click.command()
@click.option(
    "--api-key",
    type=str,
    help="NS API key (optional - will use GTFS fallback if not provided)"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/ns_stations.json",
    help="Output JSON file"
)
@click.option(
    "--method",
    type=click.Choice(["ns_api", "gtfs", "auto"]),
    default="auto",
    help="Data source method"
)
def main(api_key: Optional[str], output: str, method: str):
    """
    Download NS train station locations.

    Train station proximity is crucial for expats!

    Methods:
    - ns_api: Official NS API (requires API key)
    - gtfs: GTFS feed (no key needed, but less metadata)
    - auto: Try NS API first, fallback to GTFS

    Examples:
        # Using GTFS (no API key needed)
        python -m ingest.ns_stations --method gtfs

        # Using NS API (requires key)
        python -m ingest.ns_stations --api-key YOUR_KEY

        # Auto (tries both)
        python -m ingest.ns_stations
    """
    log.info("=== NS Stations Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    stations = []
    source_used = None

    with NSStationsClient(api_key=api_key) as client:
        if method == "ns_api" or (method == "auto" and api_key):
            try:
                stations = client.get_stations_from_ns()
                source_used = "ns_api"
            except Exception as e:
                log.warning(f"NS API failed: {e}")
                if method == "auto":
                    log.info("Falling back to GTFS...")
                    method = "gtfs"
                else:
                    raise

        if method == "gtfs" or (method == "auto" and not stations):
            try:
                stations = client.get_stations_from_gtfs()
                source_used = "gtfs"
            except Exception as e:
                log.error(f"GTFS also failed: {e}")
                raise

    if not stations:
        log.error("No stations found from any source!")
        return

    log.info(f"Downloaded {len(stations)} stations using {source_used}")

    # Transform to unified format
    log.info("Transforming records...")
    transformed = []
    for station in tqdm(stations, desc="Processing stations"):
        transformed.append(transform_station(station, source_used))

    # Save
    result = {
        "metadata": {
            "source": source_used,
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_stations": len(transformed),
            "license": "Open Data",
            "note": "Train stations in the Netherlands"
        },
        "data": transformed
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(transformed)} stations to {output_path}")

    # Statistics
    log.info("\n=== Statistics ===")

    # Count by type
    types = {}
    for s in transformed:
        t = s.get("type", "UNKNOWN")
        types[t] = types.get(t, 0) + 1

    log.info("Station types:")
    for station_type, count in sorted(types.items(), key=lambda x: x[1], reverse=True):
        log.info(f"  {station_type}: {count}")

    # Show sample stations
    log.info("\nSample stations:")
    major_stations = [s for s in transformed if 'Centraal' in s.get('name', '')][:5]
    for station in major_stations:
        log.info(f"  {station.get('name')} - {station.get('lat')}, {station.get('lng')}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")


if __name__ == "__main__":
    main()
