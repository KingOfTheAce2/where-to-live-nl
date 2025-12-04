"""
CBS Demographics data ingestion.

Downloads demographic statistics from Statistics Netherlands (CBS).
Includes population, age distribution, household composition, income levels.

Data source: https://opendata.cbs.nl/
License: CC-BY 4.0 (attribution required)
"""

import json
from pathlib import Path
from typing import Optional, List, Dict
import click
import httpx
from tqdm import tqdm
import time

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# CBS Open Data API
CBS_API_BASE = "https://opendata.cbs.nl/ODataApi/odata"

# Key demographic datasets
# Updated January 2025 - verified working table IDs
DATASETS = {
    "neighborhoods": "85984NED",  # Kerncijfers wijken en buurten 2024 - RECOMMENDED
    "population": "85039NED",  # Bevolking; kerncijfers per gemeente
    "income": "84641NED",  # Inkomen van huishoudens; gemeente
    "households": "71486NED",  # Huishoudens; grootte, samenstelling, positie in het huishouden
}


class CBSDemographicsClient:
    """Client for CBS Demographics API."""

    def __init__(self, timeout: int = 60):
        """
        Initialize CBS client.

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

    def get_table_info(self, table_id: str) -> Dict:
        """Get metadata about a CBS table."""
        try:
            url = f"{CBS_API_BASE}/{table_id}"
            response = self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            log.error(f"Error fetching table info: {e}")
            raise

    def get_data_paginated(
        self,
        table_id: str,
        filters: Optional[Dict[str, str]] = None,
        select: Optional[List[str]] = None,
        page_size: int = 1000,
        max_records: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch data with pagination.

        Args:
            table_id: CBS table identifier
            filters: OData filters
            select: Columns to select
            page_size: Records per page (reduced to 1000 to avoid 10k limit)
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

                if filters:
                    filter_parts = []
                    for key, value in filters.items():
                        # Handle special function filters (like startswith)
                        if key.startswith("startswith("):
                            filter_parts.append(key)  # Use key as-is (it's the full filter expression)
                        elif isinstance(value, str) and value:
                            filter_parts.append(f"{key} eq '{value}'")
                        elif not isinstance(value, str):
                            filter_parts.append(f"{key} eq {value}")
                    if filter_parts:
                        params["$filter"] = " and ".join(filter_parts)

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
                    log.error(f"Error at skip={skip}: {e}")
                    break

        log.success(f"Fetched {len(all_records)} records")
        return all_records

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.command()
@click.option(
    "--dataset",
    type=click.Choice(list(DATASETS.keys())),
    default="neighborhoods",
    help="Dataset to download"
)
@click.option(
    "--year",
    type=str,
    default="2024",
    help="Year (if applicable)"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/cbs_demographics.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit records for testing"
)
def main(
    dataset: str,
    year: str,
    output: str,
    sample: Optional[int]
):
    """
    Download demographic statistics from CBS.

    Datasets available:
    - neighborhoods: Population, age distribution per neighborhood
    - population: Population by municipality
    - income: Household income by municipality
    - households: Household size and composition

    Examples:
        python -m ingest.cbs_demographics
        python -m ingest.cbs_demographics --dataset population
        python -m ingest.cbs_demographics --sample 100
    """
    log.info("=== CBS Demographics Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    table_id = DATASETS[dataset]
    log.info(f"Dataset: {dataset}")
    log.info(f"Table: {table_id}")

    with CBSDemographicsClient() as client:
        log.info("Fetching table metadata...")
        table_info = client.get_table_info(table_id)
        log.info(f"Title: {table_info.get('Title', 'Unknown')}")

        # Build filters based on dataset
        filters = {}

        # For neighborhoods dataset, filter to only buurt (neighborhood) level
        # This avoids the 10k record limit by excluding national/province/municipality/district levels
        if dataset == "neighborhoods":
            log.info("Filtering for neighborhood-level data only (BU* codes)...")
            # Use startswith filter to get only neighborhoods (codes starting with "BU")
            # This is implemented in the OData query as: startswith(WijkenEnBuurten,'BU')
            filters["startswith(WijkenEnBuurten,'BU')"] = ""  # Special filter syntax

        if "Perioden" in str(table_info):
            # Try to filter by year if the table supports it
            year_code = f"{year}JJ00"  # CBS yearly format
            filters["Perioden"] = year_code

        # Fetch data with pagination
        records = client.get_data_paginated(
            table_id=table_id,
            filters=filters if filters else None,
            max_records=sample  # Pass sample as max_records to stop early
        )

    log.info(f"Downloaded {len(records)} records")

    # Save
    result = {
        "metadata": {
            "source": "CBS (Statistics Netherlands)",
            "dataset": dataset,
            "table_id": table_id,
            "year": year,
            "downloaded_at": json.dumps({"ISO": "now"}),  # Placeholder
            "total_records": len(records),
            "license": "CC-BY 4.0",
            "attribution_required": True
        },
        "data": records
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(records)} records to {output_path}")

    if records:
        log.info("\n=== Sample Record ===")
        log.info(json.dumps(records[0], indent=2, ensure_ascii=False)[:500])

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")


if __name__ == "__main__":
    main()
