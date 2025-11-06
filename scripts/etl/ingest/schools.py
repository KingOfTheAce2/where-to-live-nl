"""
Schools data ingestion from DUO (Dienst Uitvoering Onderwijs).

Downloads school locations and information from the Dutch education ministry.
Includes primary schools, secondary schools, and international schools.

Data source: https://duo.nl/open_onderwijsdata/
License: Open Data
"""

import json
from pathlib import Path
from typing import Optional, List, Dict
import click
import httpx
from tqdm import tqdm
import csv
import io

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# DUO Open Data endpoints
DUO_API_BASE = "https://duo.nl/open_onderwijsdata/api/v1"

# School register (BASIS) - all schools
SCHOOL_REGISTER_URL = "https://duo.nl/open_onderwijsdata/databestanden/po/adressen/adressen-po-3.csv"

# School types
SCHOOL_TYPES = {
    "primary": "po",  # Primair onderwijs (basisscholen)
    "secondary": "vo",  # Voortgezet onderwijs
    "mbo": "mbo",  # Middelbaar beroepsonderwijs
}


class DUOSchoolsClient:
    """Client for DUO Schools data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize DUO client.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Referer": "https://duo.nl/open_onderwijsdata/"
            }
        )

    def download_csv(self, url: str) -> List[Dict]:
        """
        Download and parse CSV file from DUO.

        Args:
            url: CSV file URL

        Returns:
            List of dictionaries (one per row)
        """
        try:
            log.info(f"Downloading CSV from {url}...")
            response = self.client.get(url)
            response.raise_for_status()

            # Parse CSV
            content = response.text
            csv_reader = csv.DictReader(io.StringIO(content), delimiter=';')

            records = []
            for row in csv_reader:
                records.append(dict(row))

            log.success(f"Downloaded {len(records)} records")
            return records

        except Exception as e:
            log.error(f"Error downloading CSV: {e}")
            raise

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_school_record(record: Dict) -> Dict:
    """
    Transform DUO CSV record to simplified format.

    Args:
        record: Raw CSV record

    Returns:
        Simplified school record
    """
    # DUO CSV has many columns - extract key ones
    return {
        "brin_number": record.get("BRIN NUMMER"),
        "school_name": record.get("INSTELLINGSNAAM") or record.get("VESTIGINGSNAAM"),
        "street": record.get("STRAATNAAM"),
        "house_number": record.get("HUISNUMMER-TOEVOEGING"),
        "postal_code": record.get("POSTCODE"),
        "city": record.get("PLAATSNAAM"),
        "municipality": record.get("GEMEENTENAAM"),
        "province": record.get("PROVINCIE"),
        "phone": record.get("TELEFOONNUMMER"),
        "website": record.get("INTERNETADRES"),
        "school_type": record.get("SOORT PO"),  # e.g., "Basisonderwijs"
        "denomination": record.get("DENOMINATIE"),  # Religious affiliation
        "board_name": record.get("BESTUURSNAAM"),
    }


@click.command()
@click.option(
    "--type",
    "school_type",
    type=click.Choice(list(SCHOOL_TYPES.keys())),
    default="primary",
    help="Type of schools to download"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/schools.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N schools for testing"
)
def main(
    school_type: str,
    output: str,
    sample: Optional[int]
):
    """
    Download school locations from DUO Open Data.

    School types:
    - primary: Primary schools (basisscholen) - Ages 4-12
    - secondary: Secondary schools (middelbare scholen) - Ages 12-18
    - mbo: Vocational education

    Examples:
        python -m ingest.schools
        python -m ingest.schools --type secondary
        python -m ingest.schools --sample 100
    """
    log.info("=== DUO Schools Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    log.info(f"School type: {school_type}")

    # Download schools data
    with DUOSchoolsClient() as client:
        # For primary schools, we have a direct CSV URL
        if school_type == "primary":
            url = SCHOOL_REGISTER_URL
            records = client.download_csv(url)
        else:
            # For other types, would need different URLs
            # This is a placeholder - actual URLs may differ
            log.warning(f"School type '{school_type}' not fully implemented yet!")
            log.warning("Using primary schools data as fallback")
            url = SCHOOL_REGISTER_URL
            records = client.download_csv(url)

    log.info(f"Downloaded {len(records)} school records")

    # Transform records
    log.info("Transforming records...")
    schools = []
    for record in tqdm(records, desc="Processing schools"):
        transformed = transform_school_record(record)
        schools.append(transformed)

    # Apply sample limit
    if sample:
        schools = schools[:sample]
        log.info(f"Limited to {sample} schools")

    # Save
    result = {
        "metadata": {
            "source": "DUO (Dienst Uitvoering Onderwijs)",
            "school_type": school_type,
            "downloaded_at": "now",  # Placeholder
            "total_schools": len(schools),
            "license": "Open Data",
            "url": SCHOOL_REGISTER_URL if school_type == "primary" else "N/A"
        },
        "data": schools
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(schools)} schools to {output_path}")

    # Show sample
    if schools:
        log.info("\n=== Sample School ===")
        sample_school = schools[0]
        log.info(f"Name: {sample_school.get('school_name')}")
        log.info(f"Address: {sample_school.get('street')} {sample_school.get('house_number')}")
        log.info(f"City: {sample_school.get('city')}")
        log.info(f"Type: {sample_school.get('school_type')}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")


if __name__ == "__main__":
    main()
