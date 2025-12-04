"""
Air Quality data ingestion from RIVM Luchtmeetnet.

Downloads air quality measurements from Dutch national monitoring network.
Includes NO2, PM10, PM2.5, O3 and other pollutants from 100+ stations.

Data sources:
- API (real-time): https://api.luchtmeetnet.nl/open_api
- RIVM bulk data (historical): https://data.rivm.nl/data/luchtmeetnet/

RIVM bulk data structure:
- Actueel-jaar/: Current year data (updated daily)
- Vastgesteld-jaar/: Validated historical data
- Voorlopig-jaar/: Provisional data

File naming: YYYY_MM_POLLUTANT.csv (e.g., 2025_01_NO2.csv)

License: Open data (RIVM/Luchtmeetnet)
"""

import json
import csv
import io
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import click
import httpx
from tqdm import tqdm
import time

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# Luchtmeetnet API
LUCHTMEETNET_API_BASE = "https://api.luchtmeetnet.nl/open_api"

# RIVM bulk data base URL
RIVM_BULK_BASE = "https://data.rivm.nl/data/luchtmeetnet"

# Key pollutants to track (with RIVM file codes)
POLLUTANTS = {
    "NO2": "Nitrogen Dioxide",
    "PM10": "Particulate Matter 10µm",
    "PM25": "Particulate Matter 2.5µm",
    "O3": "Ozone",
    "SO2": "Sulfur Dioxide",
    "CO": "Carbon Monoxide"
}

# All pollutants available in RIVM bulk data
RIVM_POLLUTANTS = ["BC", "NO", "NO2", "NOx", "O3", "PM10", "PM25", "SO2"]


class LuchtmeetnetClient:
    """Client for Luchtmeetnet API."""

    def __init__(self, timeout: int = 30):
        """
        Initialize Luchtmeetnet client.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; WhereToLiveNL/1.0)",
                "Accept": "application/json"
            }
        )
        self.base_url = LUCHTMEETNET_API_BASE

    def get_stations(self) -> List[Dict]:
        """Get all monitoring stations."""
        try:
            url = f"{self.base_url}/stations"
            log.info(f"Fetching stations from {url}")
            response = self.client.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            log.error(f"Error fetching stations: {e}")
            return []

    def get_latest_measurements(self, station_number: str) -> Dict:
        """
        Get latest measurements for a station.

        Args:
            station_number: Station identifier (e.g., "NL10131")

        Returns:
            Dict with latest measurements
        """
        try:
            url = f"{self.base_url}/stations/{station_number}/measurements"
            response = self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            log.warning(f"Error fetching measurements for {station_number}: {e}")
            return {}

    def get_station_info(self, station_number: str) -> Dict:
        """Get detailed info for a specific station."""
        try:
            url = f"{self.base_url}/stations/{station_number}"
            response = self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            log.warning(f"Error fetching info for {station_number}: {e}")
            return {}

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class RIVMBulkClient:
    """Client for downloading RIVM bulk air quality data."""

    def __init__(self, timeout: int = 60):
        """
        Initialize RIVM bulk data client.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; WhereToLiveNL/1.0)",
            }
        )
        self.base_url = RIVM_BULK_BASE

    def download_month(
        self,
        year: int,
        month: int,
        pollutant: str,
        data_type: str = "Actueel-jaar"
    ) -> List[Dict]:
        """
        Download air quality data for a specific month and pollutant.

        Args:
            year: Year (e.g., 2025)
            month: Month (1-12)
            pollutant: Pollutant code (NO2, PM10, PM25, O3, etc.)
            data_type: Data folder (Actueel-jaar, Vastgesteld-jaar, Voorlopig-jaar)

        Returns:
            List of measurement records
        """
        filename = f"{year}_{month:02d}_{pollutant}.csv"
        url = f"{self.base_url}/{data_type}/{filename}"

        try:
            log.info(f"Downloading {url}")
            response = self.client.get(url)
            response.raise_for_status()

            # Parse CSV content - skip comment lines and use semicolon delimiter
            content = response.text
            lines = [line for line in content.split('\n') if line and not line.startswith('#')]

            if not lines:
                log.warning(f"No data lines in {filename}")
                return []

            # Parse with semicolon delimiter
            reader = csv.DictReader(io.StringIO('\n'.join(lines)), delimiter=';')
            records = list(reader)
            log.info(f"Downloaded {len(records)} records for {pollutant} {year}-{month:02d}")
            return records

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                log.warning(f"File not found: {filename}")
            else:
                log.error(f"HTTP error downloading {filename}: {e}")
            return []
        except Exception as e:
            log.error(f"Error downloading {filename}: {e}")
            return []

    def download_year(
        self,
        year: int,
        pollutants: List[str] = None,
        data_type: str = "Actueel-jaar"
    ) -> Dict[str, List[Dict]]:
        """
        Download air quality data for an entire year.

        Args:
            year: Year to download
            pollutants: List of pollutants (default: all available)
            data_type: Data folder type

        Returns:
            Dict mapping pollutant -> list of records
        """
        if pollutants is None:
            pollutants = RIVM_POLLUTANTS

        results = {}
        current_month = datetime.now().month if year == datetime.now().year else 12

        for pollutant in pollutants:
            all_records = []
            for month in range(1, current_month + 1):
                records = self.download_month(year, month, pollutant, data_type)
                all_records.extend(records)
                time.sleep(0.2)  # Be nice to the server

            results[pollutant] = all_records
            log.info(f"Total {pollutant} records for {year}: {len(all_records)}")

        return results

    def get_station_averages(self, records: List[Dict], station_coords: Dict[str, Dict] = None) -> Dict[str, Dict]:
        """
        Calculate average values per station from measurement records.

        Args:
            records: List of measurement records from RIVM CSV
            station_coords: Optional dict mapping station_id -> {lat, lon, name}

        Returns:
            Dict mapping station_number -> {avg_value, count, lat, lon}
        """
        station_data = {}

        for record in records:
            # RIVM CSV column name is 'meetlocatie_id' (e.g., NL10107)
            station = record.get("meetlocatie_id") or record.get("Station_Nummer") or record.get("station_number")
            if not station:
                continue

            try:
                # RIVM CSV column name is 'waarde'
                value_str = record.get("waarde") or record.get("Waarde") or record.get("value") or ""
                if not value_str:
                    continue
                value = float(value_str)
            except (ValueError, TypeError):
                continue

            if station not in station_data:
                # Try to get coordinates from station_coords if provided
                coords = station_coords.get(station, {}) if station_coords else {}
                station_data[station] = {
                    "values": [],
                    "lat": coords.get("lat"),
                    "lon": coords.get("lon"),
                    "name": coords.get("name") or coords.get("location"),
                    "city": coords.get("city"),
                }

            station_data[station]["values"].append(value)

        # Calculate averages
        result = {}
        for station, data in station_data.items():
            values = data["values"]
            if values:
                result[station] = {
                    "station_number": station,
                    "station_name": data["name"],
                    "city": data.get("city"),
                    "lat": data["lat"],
                    "lon": data["lon"],
                    "avg_value": sum(values) / len(values),
                    "min_value": min(values),
                    "max_value": max(values),
                    "measurement_count": len(values)
                }

        return result

    def get_station_metadata(self) -> Dict[str, Dict]:
        """
        Download station metadata with coordinates from RIVM.

        Returns:
            Dict mapping station_id -> {lat, lon, name, city}
        """
        url = f"{self.base_url}/Metadata/luchtmeetnet_meetlocaties.csv"
        try:
            log.info(f"Downloading station metadata from {url}")
            response = self.client.get(url)
            response.raise_for_status()

            # Parse CSV - skip comment lines, use semicolon delimiter
            content = response.text
            lines = [line for line in content.split('\n') if line and not line.startswith('#')]

            reader = csv.DictReader(io.StringIO('\n'.join(lines)), delimiter=';')
            stations = {}

            for record in reader:
                station_id = record.get("meetlocatie_id")
                if not station_id:
                    continue

                try:
                    lat = float(record.get("breedtegraad") or 0)
                    lon = float(record.get("lengtegraad") or 0)
                except (ValueError, TypeError):
                    continue

                if lat and lon:
                    stations[station_id] = {
                        "lat": lat,
                        "lon": lon,
                        "name": record.get("meetlocatie_naam"),
                        "city": record.get("plaatsnaam"),
                        "height": record.get("hoogte"),
                        "source": record.get("bron_id"),
                    }

            log.info(f"Loaded metadata for {len(stations)} stations")
            return stations

        except Exception as e:
            log.error(f"Error downloading station metadata: {e}")
            return {}

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.group()
def cli():
    """Air quality data ingestion tools."""
    pass


@cli.command("api")
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/air_quality.json",
    help="Output JSON file"
)
@click.option(
    "--include-measurements/--stations-only",
    default=True,
    help="Include latest measurements for each station"
)
def download_api(
    output: str,
    include_measurements: bool
):
    """
    Download real-time air quality data from Luchtmeetnet API.

    This script fetches:
    - All monitoring stations in the Netherlands
    - Station metadata (location, type, pollutants measured)
    - Latest measurements (optional)

    Examples:
        python -m ingest.air_quality api
        python -m ingest.air_quality api --stations-only
    """
    log.info("=== Luchtmeetnet Air Quality Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with LuchtmeetnetClient() as client:
        # Fetch all stations
        log.info("Fetching monitoring stations...")
        stations = client.get_stations()

        if not stations:
            log.error("No stations found!")
            return

        log.info(f"Found {len(stations)} monitoring stations")

        # Enrich with measurements if requested
        if include_measurements:
            log.info("Fetching latest measurements for each station...")
            enriched_stations = []

            for station in tqdm(stations, desc="Enriching stations"):
                station_number = station.get("number")
                if not station_number:
                    enriched_stations.append(station)
                    continue

                # Get latest measurements
                measurements = client.get_latest_measurements(station_number)

                # Add measurements to station data
                station_data = {
                    **station,
                    "latest_measurements": measurements.get("data", {})
                }

                enriched_stations.append(station_data)

                # Be nice to the API
                time.sleep(0.1)

            stations = enriched_stations

    # Save results
    result = {
        "metadata": {
            "source": "Luchtmeetnet (RIVM)",
            "description": "Dutch national air quality monitoring network",
            "downloaded_at": datetime.now().isoformat(),
            "total_stations": len(stations),
            "includes_measurements": include_measurements,
            "pollutants": POLLUTANTS,
            "license": "Open data",
            "attribution_required": True
        },
        "data": stations
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(stations)} stations to {output_path}")

    # Statistics
    if stations:
        log.info("\n=== Sample Station ===")
        sample = stations[0]
        log.info(f"Station: {sample.get('number')} - {sample.get('location')}")
        log.info(f"Type: {sample.get('type')}")
        log.info(f"Municipality: {sample.get('municipality')}")
        log.info(f"Coordinates: {sample.get('geometry', {}).get('coordinates')}")

        if include_measurements and "latest_measurements" in sample:
            log.info("\n=== Latest Measurements ===")
            measurements = sample.get("latest_measurements", {})
            if isinstance(measurements, dict):
                for component, value in list(measurements.items())[:5]:
                    log.info(f"  {component}: {value}")
            elif isinstance(measurements, list) and measurements:
                log.info(f"  Found {len(measurements)} measurements")
                for m in measurements[:3]:
                    log.info(f"  {m}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")


@cli.command("rivm")
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/air_quality_rivm.json",
    help="Output JSON file"
)
@click.option(
    "--year",
    type=int,
    default=None,
    help="Year to download (default: current year)"
)
@click.option(
    "--pollutants",
    type=str,
    default="NO2,PM10,PM25,O3",
    help="Comma-separated list of pollutants to download"
)
@click.option(
    "--data-type",
    type=click.Choice(["Actueel-jaar", "Vastgesteld-jaar", "Voorlopig-jaar"]),
    default="Actueel-jaar",
    help="Data type/folder to download from"
)
def download_rivm(
    output: str,
    year: Optional[int],
    pollutants: str,
    data_type: str
):
    """
    Download bulk historical air quality data from RIVM.

    Downloads CSV data from https://data.rivm.nl/data/luchtmeetnet/
    and calculates station averages for each pollutant.

    Examples:
        python -m ingest.air_quality rivm
        python -m ingest.air_quality rivm --year 2024 --pollutants NO2,PM10
        python -m ingest.air_quality rivm --data-type Vastgesteld-jaar
    """
    log.info("=== RIVM Bulk Air Quality Data Ingestion ===")

    if year is None:
        year = datetime.now().year

    pollutant_list = [p.strip() for p in pollutants.split(",")]
    log.info(f"Downloading {year} data for pollutants: {pollutant_list}")
    log.info(f"Data type: {data_type}")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with RIVMBulkClient() as client:
        # First, fetch station coordinates from RIVM metadata
        log.info("Fetching station coordinates from RIVM metadata...")
        station_coords = client.get_station_metadata()

        # Download data for each pollutant
        all_data = client.download_year(year, pollutant_list, data_type)

        # Calculate station averages for each pollutant
        station_averages = {}
        for pollutant, records in all_data.items():
            if records:
                averages = client.get_station_averages(records, station_coords)
                station_averages[pollutant] = averages
                log.info(f"{pollutant}: {len(averages)} stations with data")

    # Combine into station-centric format
    all_stations = {}
    for pollutant, stations in station_averages.items():
        for station_id, data in stations.items():
            if station_id not in all_stations:
                all_stations[station_id] = {
                    "station_number": station_id,
                    "station_name": data.get("station_name"),
                    "city": data.get("city"),
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "pollutants": {}
                }

            all_stations[station_id]["pollutants"][pollutant] = {
                "avg": round(data["avg_value"], 2),
                "min": round(data["min_value"], 2),
                "max": round(data["max_value"], 2),
                "count": data["measurement_count"]
            }

    # Save results
    result = {
        "metadata": {
            "source": "RIVM Luchtmeetnet (bulk data)",
            "url": f"{RIVM_BULK_BASE}/{data_type}/",
            "description": "Dutch national air quality monitoring - historical averages",
            "downloaded_at": datetime.now().isoformat(),
            "year": year,
            "data_type": data_type,
            "pollutants": pollutant_list,
            "total_stations": len(all_stations),
            "license": "Open data",
            "attribution_required": True
        },
        "data": list(all_stations.values())
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(all_stations)} stations to {output_path}")

    # Show sample
    if all_stations:
        sample = list(all_stations.values())[0]
        log.info(f"\n=== Sample Station ===")
        log.info(f"Station: {sample['station_number']} - {sample['station_name']}")
        log.info(f"Location: {sample['lat']}, {sample['lon']}")
        log.info("Pollutant averages:")
        for poll, values in sample["pollutants"].items():
            log.info(f"  {poll}: avg={values['avg']}, min={values['min']}, max={values['max']} ({values['count']} measurements)")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.2f} MB")


# Legacy command for backward compatibility
@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/air_quality.json",
    help="Output JSON file"
)
@click.option(
    "--include-measurements/--stations-only",
    default=True,
    help="Include latest measurements for each station"
)
def main(output: str, include_measurements: bool):
    """Legacy entry point - calls download_api."""
    ctx = click.Context(download_api)
    ctx.invoke(download_api, output=output, include_measurements=include_measurements)


if __name__ == "__main__":
    cli()
