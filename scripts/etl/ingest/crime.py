"""
Crime Statistics data ingestion from CBS/Politie.nl.

Downloads registered crime data at neighborhood (buurt) and district (wijk) level.
Data source: https://politieopendata.cbs.nl/ (CBS Open Data Portal)

License: Open Data (no attribution required)
"""

import json
import time
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# CBS/Politie.nl OData API (hosted on CBS infrastructure)
# Data source: https://data.politie.nl/
# Dashboard: https://www.cbs.nl/nl-nl/visualisaties/politie/dashboard-misdrijven-in-de-buurt
CBS_API_BASE = "https://dataderden.cbs.nl/ODataApi/odata"

# Available crime datasets (OData table IDs)
# Updated January 2025 - verified working endpoints
DATASETS = {
    "neighborhood": "47018NED",  # Geregistreerde misdrijven; wijk, buurt (neighborhood level) - RECOMMENDED
    "municipality": "47022NED",  # Geregistreerde misdrijven; soort misdrijf, gemeente (municipality level)
}

# Crime categories we're interested in
CRIME_TYPES = {
    "Total": "TotaalMisdrijven",
    "Burglary": "WoninginbraakDiefstal",
    "StreetRobbery": "StraatroofOverval",
    "VehicleTheft": "DiefstalUitVanAuto",
    "Vandalism": "VernielingStraatgeweld",
    "DrugCrimes": "Drugsmisdrijven",
}


class CrimeDataClient:
    """Client for CBS Crime Statistics API."""

    def __init__(self, timeout: int = 60):
        """
        Initialize crime data client.

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
                "Referer": "https://opendata.cbs.nl/"
            }
        )

    def get_table_info(self, table_id: str) -> Dict:
        """
        Get metadata about a CBS table.

        Args:
            table_id: CBS table identifier (e.g., "85452NED")

        Returns:
            Table metadata
        """
        try:
            url = f"{CBS_API_BASE}/{table_id}"
            response = self.client.get(url)
            response.raise_for_status()
            return response.json()

        except Exception as e:
            log.error(f"Error fetching table info for {table_id}: {e}")
            raise

    def get_typed_data(
        self,
        table_id: str,
        filters: Optional[Dict[str, str]] = None,
        select: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Get typed dataset from CBS OData API.

        Args:
            table_id: CBS table identifier
            filters: OData filters (e.g., {"Perioden": "2023JJ00"})
            select: Columns to select

        Returns:
            List of records
        """
        url = f"{CBS_API_BASE}/{table_id}/TypedDataSet"

        params = {}

        # Build $filter query
        if filters:
            filter_parts = []
            for key, value in filters.items():
                if isinstance(value, str):
                    filter_parts.append(f"{key} eq '{value}'")
                else:
                    filter_parts.append(f"{key} eq {value}")

            if filter_parts:
                params["$filter"] = " and ".join(filter_parts)

        # Build $select query
        if select:
            params["$select"] = ",".join(select)

        try:
            log.info(f"Fetching data from {table_id}...")
            if params:
                log.debug(f"Params: {params}")

            response = self.client.get(url, params=params)
            response.raise_for_status()

            data = response.json()
            return data.get("value", [])

        except Exception as e:
            log.error(f"Error fetching typed data from {table_id}: {e}")
            raise

    def get_data_paginated(
        self,
        table_id: str,
        filters: Optional[Dict[str, str]] = None,
        select: Optional[List[str]] = None,
        page_size: int = 10000,
        max_records: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch data with pagination.

        Args:
            table_id: CBS table identifier
            filters: OData filters
            select: Columns to select
            page_size: Records per page
            max_records: Maximum total records to fetch (for sampling)

        Returns:
            List of all records
        """
        all_records = []
        skip = 0

        with tqdm(desc=f"Fetching {table_id}", unit=" records") as pbar:
            while True:
                # Stop if we've reached max_records
                if max_records and len(all_records) >= max_records:
                    break

                url = f"{CBS_API_BASE}/{table_id}/TypedDataSet"

                # Adjust page size if approaching max_records
                current_page_size = page_size
                if max_records:
                    remaining = max_records - len(all_records)
                    current_page_size = min(page_size, remaining)

                params = {
                    "$skip": skip,
                    "$top": current_page_size
                }

                # Add filters
                if filters:
                    filter_parts = []
                    for key, value in filters.items():
                        if isinstance(value, str):
                            filter_parts.append(f"{key} eq '{value}'")
                        else:
                            filter_parts.append(f"{key} eq {value}")

                    if filter_parts:
                        params["$filter"] = " and ".join(filter_parts)

                # Add select
                if select:
                    params["$select"] = ",".join(select)

                try:
                    response = self.client.get(url, params=params)
                    response.raise_for_status()

                    data = response.json()
                    records = data.get("value", [])

                    if not records:
                        break

                    all_records.extend(records)
                    pbar.update(len(records))

                    # Check if there are more records
                    if len(records) < current_page_size:
                        break

                    skip += len(records)
                    time.sleep(0.1)  # Be nice to the server

                except Exception as e:
                    log.error(f"Error fetching page at skip={skip}: {e}")
                    break

        log.success(f"Fetched {len(all_records)} records")
        return all_records

    def close(self):
        """Close HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.command()
@click.option(
    "--level",
    type=click.Choice(list(DATASETS.keys())),
    default="neighborhood",
    help="Geographic level (neighborhood or municipality)"
)
@click.option(
    "--year",
    type=str,
    default="2024",
    help="Year to download (e.g., 2024). Available: 2012-2024"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/crime.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N records for testing"
)
def main(
    level: str,
    year: str,
    output: str,
    sample: Optional[int]
):
    """
    Download crime statistics from CBS/Politie.nl Open Data.

    Data includes:
    - Total registered crimes
    - Burglary (woninginbraak)
    - Street robbery
    - Vehicle theft
    - Vandalism
    - Drug crimes

    Examples:
        # Download neighborhood-level data for 2023
        python -m ingest.crime

        # Test with limited records
        python -m ingest.crime --sample 100

        # Download municipality-level data
        python -m ingest.crime --level municipality --year 2023
    """
    log.info("=== Crime Statistics Data Ingestion ===")

    # Create output directory
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    table_id = DATASETS[level]
    log.info(f"Table: {table_id} ({level} level)")
    log.info(f"Year: {year}")

    # Fetch data
    with CrimeDataClient() as client:
        # Get table info
        log.info("Fetching table metadata...")
        table_info = client.get_table_info(table_id)
        log.debug(f"Table: {table_info.get('Title', 'Unknown')}")

        # Construct year filter (CBS uses format like "2023JJ00" for yearly data)
        year_code = f"{year}JJ00"

        # Fetch crime data
        filters = {
            "Perioden": year_code
        }

        # Always use paginated fetch to respect API's 10k limit
        records = client.get_data_paginated(
            table_id=table_id,
            filters=filters,
            page_size=200,  # Use smaller pages to be nice to the server
            max_records=sample  # Pass sample as max_records to stop early
        )

    log.info(f"Downloaded {len(records)} records")

    if not records:
        log.warning("No records found! Check year and table_id.")
        return

    # Save data
    result = {
        "metadata": {
            "source": "CBS/Politie.nl",
            "table_id": table_id,
            "level": level,
            "year": year,
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_records": len(records)
        },
        "data": records
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(records)} crime records to {output_path}")

    # Show sample
    if records:
        log.info("\n=== Sample Record ===")
        sample_record = records[0]
        log.info(json.dumps(sample_record, indent=2, ensure_ascii=False))

    # File size
    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nOutput file size: {file_size_mb:.1f} MB")

    # Statistics
    if level == "neighborhood":
        log.info("\nTip: Records contain crime counts per neighborhood (buurt)")
        log.info("Fields: WijkenEnBuurten (area code), various crime types")
    else:
        log.info("\nTip: Records contain crime counts per municipality (gemeente)")
        log.info("Fields: RegioS (region code), various crime types")


if __name__ == "__main__":
    main()
