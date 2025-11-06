"""
Public Transport Stops (Bus/Tram/Metro) data ingestion.

Downloads all public transport stops in the Netherlands.
Includes: bus, tram, metro, ferry

Critical for expats without cars!

Data source: GTFS feeds from various operators
- GVB (Amsterdam)
- RET (Rotterdam)
- HTM (Den Haag)
- NS (national buses)
- Connexxion, Arriva, etc.

Alternative: OVapi or NDOVloket
License: Open Data
"""

import json
import csv
import io
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# GTFS feeds for major operators
GTFS_FEEDS = {
    "gvb": "https://gtfs.ovapi.nl/gvb/gtfs-gvb-latest.zip",  # Amsterdam
    "ret": "https://gtfs.ovapi.nl/ret/gtfs-ret-latest.zip",  # Rotterdam
    "htm": "https://gtfs.ovapi.nl/htm/gtfs-htm-latest.zip",  # Den Haag
    "all_nl": "https://gtfs.ovapi.nl/nl/stops.txt",  # All Netherlands
}

# OVapi endpoint (real-time, but different format)
OVAPI_STOPS = "http://v0.ovapi.nl/stopareainfo"


class PublicTransportClient:
    """Client for Public Transport data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize PT client.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/csv, application/zip, */*",
                "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            }
        )

    def get_stops_from_gtfs_csv(self, url: str) -> List[Dict]:
        """
        Download and parse GTFS stops.txt file.

        Args:
            url: GTFS stops.txt URL

        Returns:
            List of stop records
        """
        try:
            log.info(f"Downloading GTFS stops from {url}...")
            response = self.client.get(url)
            response.raise_for_status()

            # Parse CSV
            content = response.text
            reader = csv.DictReader(io.StringIO(content))

            stops = []
            for row in reader:
                stops.append(dict(row))

            log.success(f"Downloaded {len(stops)} stops")
            return stops

        except Exception as e:
            log.error(f"Error downloading GTFS: {e}")
            raise

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def classify_stop_type(stop: Dict) -> str:
    """
    Classify stop type based on name and code.

    Args:
        stop: Stop record

    Returns:
        Stop type (bus, tram, metro, ferry, train)
    """
    name = stop.get("stop_name", "").lower()
    code = stop.get("stop_code", "").lower()

    # Train stations
    if "station" in name or "trein" in name:
        return "train"

    # Metro
    if "metro" in name or "metrostation" in name:
        return "metro"

    # Tram
    if "tram" in name:
        return "tram"

    # Ferry
    if "ferry" in name or "veer" in name or "pont" in name:
        return "ferry"

    # Bus (default)
    return "bus"


def transform_stop(stop: Dict) -> Dict:
    """
    Transform GTFS stop to unified format.

    Args:
        stop: Raw GTFS stop

    Returns:
        Transformed stop record
    """
    stop_type = classify_stop_type(stop)

    return {
        "stop_id": stop.get("stop_id"),
        "stop_code": stop.get("stop_code"),
        "name": stop.get("stop_name"),
        "description": stop.get("stop_desc"),
        "lat": float(stop.get("stop_lat")) if stop.get("stop_lat") else None,
        "lng": float(stop.get("stop_lon")) if stop.get("stop_lon") else None,
        "zone_id": stop.get("zone_id"),
        "stop_url": stop.get("stop_url"),
        "location_type": stop.get("location_type"),
        "parent_station": stop.get("parent_station"),
        "stop_timezone": stop.get("stop_timezone"),
        "wheelchair_boarding": stop.get("wheelchair_boarding"),
        "platform_code": stop.get("platform_code"),
        "stop_type": stop_type,
        "source": "gtfs"
    }


@click.command()
@click.option(
    "--region",
    type=click.Choice(["all", "amsterdam", "rotterdam", "den_haag"]),
    default="all",
    help="Region to download"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/public_transport_stops.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N stops for testing"
)
@click.option(
    "--filter-type",
    type=click.Choice(["all", "bus", "tram", "metro", "ferry"]),
    default="all",
    help="Filter by transport type"
)
def main(region: str, output: str, sample: Optional[int], filter_type: str):
    """
    Download public transport stops (bus/tram/metro/ferry).

    Essential for expats relying on public transport!

    Examples:
        # All Netherlands (large file!)
        python -m ingest.public_transport --region all

        # Amsterdam only
        python -m ingest.public_transport --region amsterdam

        # Only metro stops
        python -m ingest.public_transport --filter-type metro

        # Test with 1000 stops
        python -m ingest.public_transport --sample 1000
    """
    log.info("=== Public Transport Stops Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Select GTFS feed based on region
    if region == "all":
        url = GTFS_FEEDS["all_nl"]
        log.info("Downloading ALL Netherlands stops (this may take a while...)")
    elif region == "amsterdam":
        # For Amsterdam, we'd need to extract from ZIP
        # For now, filter from all
        url = GTFS_FEEDS["all_nl"]
        log.info("Downloading Amsterdam stops...")
    elif region == "rotterdam":
        url = GTFS_FEEDS["all_nl"]
        log.info("Downloading Rotterdam stops...")
    elif region == "den_haag":
        url = GTFS_FEEDS["all_nl"]
        log.info("Downloading Den Haag stops...")
    else:
        url = GTFS_FEEDS["all_nl"]

    # Download stops
    with PublicTransportClient() as client:
        stops = client.get_stops_from_gtfs_csv(url)

    log.info(f"Downloaded {len(stops)} raw stops")

    # Transform stops
    log.info("Transforming stops...")
    transformed = []
    for stop in tqdm(stops, desc="Processing stops"):
        t_stop = transform_stop(stop)

        # Apply filters
        if region in ["amsterdam", "rotterdam", "den_haag"]:
            name = t_stop.get("name", "").lower()
            if region not in name:
                continue

        if filter_type != "all":
            if t_stop.get("stop_type") != filter_type:
                continue

        # Exclude train stations (covered by separate scraper)
        if t_stop.get("stop_type") == "train":
            continue

        transformed.append(t_stop)

    # Apply sample limit
    if sample:
        transformed = transformed[:sample]
        log.info(f"Limited to {sample} stops")

    log.success(f"Transformed {len(transformed)} stops")

    # Save
    result = {
        "metadata": {
            "source": "GTFS (gtfs.ovapi.nl)",
            "region": region,
            "filter_type": filter_type,
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_stops": len(transformed),
            "license": "Open Data",
            "note": "Public transport stops (bus/tram/metro/ferry)"
        },
        "data": transformed
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(transformed)} stops to {output_path}")

    # Statistics
    log.info("\n=== Statistics ===")

    # Count by type
    types = {}
    for stop in transformed:
        t = stop.get("stop_type", "unknown")
        types[t] = types.get(t, 0) + 1

    log.info("Stop types:")
    for stop_type, count in sorted(types.items(), key=lambda x: x[1], reverse=True):
        log.info(f"  {stop_type}: {count}")

    # Count by city (rough approximation from name)
    cities = {}
    for stop in transformed:
        name = stop.get("name", "")
        # Try to extract city from stop name
        for city in ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven", "Groningen"]:
            if city in name:
                cities[city] = cities.get(city, 0) + 1
                break

    if cities:
        log.info("\nStops by major city (approximate):")
        for city, count in sorted(cities.items(), key=lambda x: x[1], reverse=True):
            log.info(f"  {city}: {count}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")

    # Show sample stops
    log.info("\nSample stops:")
    for stop in transformed[:5]:
        log.info(f"  [{stop['stop_type']}] {stop['name']}")


if __name__ == "__main__":
    main()
