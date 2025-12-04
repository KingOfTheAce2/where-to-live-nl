"""
DUO Schools data ingestion (2025 - Modern API).

Downloads school locations from DUO (Dienst Uitvoering Onderwijs) Open Data portal.
Covers primary schools (basisonderwijs), secondary schools (voortgezet onderwijs),
and special education.

Data source: https://onderwijsdata.duo.nl/
API: JSON/CSV downloads available
License: CC-0 (Public Domain)

Updated: January 2025
"""

import json
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# DUO Open Data Portal (2025)
# New portal: onderwijsdata.duo.nl with CKAN API
DUO_API_BASE = "https://onderwijsdata.duo.nl"

# Dataset URLs (verified January 2025)
DATASETS = {
    "primary": {
        "name": "Basisonderwijs (Primary Education)",
        "url": f"{DUO_API_BASE}/datasets/adressen_bo",
        "api_id": "adressen_bo",
        "description": "All primary school locations (basisscholen) ages 4-12"
    },
    "secondary": {
        "name": "Voortgezet Onderwijs (Secondary Education)",
        "url": f"{DUO_API_BASE}/datasets/adressen_vo",
        "api_id": "adressen_vo",
        "description": "All secondary school locations ages 12-18"
    },
    "special": {
        "name": "Speciaal Onderwijs (Special Education)",
        "url": f"{DUO_API_BASE}/datasets/adressen_so",
        "api_id": "adressen_so",
        "description": "Special education schools"
    },
    "higher": {
        "name": "Hoger Onderwijs (Higher Education)",
        "url": f"{DUO_API_BASE}/datasets/adressen_ho",
        "api_id": "adressen_ho",
        "description": "Universities and colleges"
    }
}


class DUOSchoolsClient:
    """Client for DUO Open Data API (CKAN-based)."""

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
                "User-Agent": "Mozilla/5.0 (compatible; DUO-Schools-Scraper/1.0)",
                "Accept": "application/json, text/csv, */*",
            }
        )

    def get_dataset_resources(self, dataset_id: str) -> List[Dict]:
        """
        Get available resources (files) for a dataset.

        Args:
            dataset_id: Dataset identifier (e.g., "adressen_bo")

        Returns:
            List of resource metadata
        """
        try:
            # CKAN API endpoint
            url = f"{DUO_API_BASE}/api/3/action/package_show"
            params = {"id": dataset_id}

            log.info(f"Fetching dataset metadata for: {dataset_id}")
            response = self.client.get(url, params=params)
            response.raise_for_status()

            data = response.json()

            if data.get("success"):
                resources = data.get("result", {}).get("resources", [])
                log.success(f"Found {len(resources)} resources")
                return resources
            else:
                log.error(f"API returned success=false")
                return []

        except Exception as e:
            log.error(f"Error fetching dataset metadata: {e}")
            return []

    def download_csv_resource(self, resource_url: str) -> List[Dict]:
        """
        Download CSV resource.

        Args:
            resource_url: Direct URL to CSV file

        Returns:
            List of records as dictionaries
        """
        try:
            import csv
            import io

            log.info(f"Downloading CSV from {resource_url}")
            response = self.client.get(resource_url)
            response.raise_for_status()

            # Parse CSV
            content = response.text
            csv_reader = csv.DictReader(io.StringIO(content))

            records = []
            for row in csv_reader:
                records.append(dict(row))

            log.success(f"Downloaded {len(records)} records")
            return records

        except Exception as e:
            log.error(f"Error downloading CSV: {e}")
            raise

    def get_latest_school_data(self, dataset_id: str, format: str = "json") -> List[Dict]:
        """
        Get latest school data for a dataset.

        Args:
            dataset_id: Dataset identifier
            format: Preferred format (json or csv)

        Returns:
            List of school records
        """
        resources = self.get_dataset_resources(dataset_id)

        if not resources:
            raise ValueError(f"No resources found for dataset: {dataset_id}")

        # Find the latest resource with desired format
        json_resources = [r for r in resources if format.lower() in r.get("format", "").lower()]

        # Find school LOCATIONS resource (not boards/besturen)
        # Look for "vestigingen" (locations) or "instellingen" (institutions)
        location_resources = [
            r for r in resources
            if "vestiging" in r.get("name", "").lower() or
               "instelling" in r.get("name", "").lower()
        ]

        if location_resources:
            # Prefer "alle vestigingen" (all locations) over "hoofdvestigingen" (main only)
            alle_resources = [r for r in location_resources if "alle" in r.get("name", "").lower()]
            if alle_resources:
                target_resource = alle_resources[0]
                log.info("Found 'alle vestigingen' (all locations)")
            else:
                target_resource = location_resources[0]
                log.info("Using location resource")
        elif not json_resources:
            log.warning(f"No location resources found, using last available (often the most complete)")
            target_resource = resources[-1]  # Last resource is often "all locations"
        else:
            target_resource = json_resources[0]

        log.info(f"Using resource: {target_resource.get('name', 'Unknown')}")
        log.info(f"Format: {target_resource.get('format')}")
        log.info(f"Last modified: {target_resource.get('last_modified', 'Unknown')}")

        resource_url = target_resource.get("url")

        if not resource_url:
            raise ValueError("Resource has no download URL")

        # Download based on format (DUO often mislabels CSV as JSON)
        # Always try CSV first as it's the most common format
        return self.download_csv_resource(resource_url)

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_school_record(record: Dict, school_type: str) -> Dict:
    """
    Transform DUO record to simplified format.

    Args:
        record: Raw API record
        school_type: Type of school (primary, secondary, etc.)

    Returns:
        Simplified school record
    """
    # DUO uses different field names - try common variants
    return {
        "brin_number": record.get("BRIN NUMMER") or record.get("brin_nummer") or record.get("brin"),
        "vestiging_number": record.get("VESTIGINGSNUMMER") or record.get("vestigingsnummer"),
        "school_name": (
            record.get("INSTELLINGSNAAM") or
            record.get("VESTIGINGSNAAM") or
            record.get("instellingsnaam") or
            record.get("vestigingsnaam") or
            record.get("naam")
        ),
        "street": record.get("STRAATNAAM") or record.get("straatnaam") or record.get("straat"),
        "house_number": (
            record.get("HUISNUMMER-TOEVOEGING") or
            record.get("huisnummer_toevoeging") or
            record.get("huisnummer")
        ),
        "postal_code": record.get("POSTCODE") or record.get("postcode"),
        "city": record.get("PLAATSNAAM") or record.get("plaatsnaam") or record.get("plaats"),
        "municipality": record.get("GEMEENTENAAM") or record.get("gemeentenaam") or record.get("gemeente"),
        "province": record.get("PROVINCIE") or record.get("provincie"),
        "phone": record.get("TELEFOONNUMMER") or record.get("telefoonnummer"),
        "website": record.get("INTERNETADRES") or record.get("internetadres") or record.get("website"),
        "school_type": school_type,
        "denomination": record.get("DENOMINATIE") or record.get("denominatie"),
        "board_name": record.get("BESTUURSNAAM") or record.get("bestuursnaam"),
        "latitude": record.get("latitude") or record.get("lat"),
        "longitude": record.get("longitude") or record.get("lon") or record.get("lng"),
    }


@click.command()
@click.option(
    "--type",
    "school_type",
    type=click.Choice(list(DATASETS.keys())),
    default="primary",
    help="Type of schools to download"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/schools_duo.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N schools for testing"
)
@click.option(
    "--all-types",
    is_flag=True,
    help="Download all school types (primary + secondary + special)"
)
def main(
    school_type: str,
    output: str,
    sample: Optional[int],
    all_types: bool
):
    """
    Download school locations from DUO Open Data portal.

    School types:
    - primary: Primary schools (basisscholen) - Ages 4-12
    - secondary: Secondary schools (voortgezet onderwijs) - Ages 12-18
    - special: Special education schools
    - higher: Universities and colleges

    Examples:
        python -m ingest.duo_schools
        python -m ingest.duo_schools --type secondary
        python -m ingest.duo_schools --all-types
        python -m ingest.duo_schools --sample 100
    """
    log.info("=== DUO Schools Data Ingestion (2025) ===")
    log.info(f"Data source: {DUO_API_BASE}")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Determine which types to download
    if all_types:
        types_to_download = list(DATASETS.keys())
    else:
        types_to_download = [school_type]

    all_schools = []
    metadata = {
        "source": "DUO (Dienst Uitvoering Onderwijs)",
        "portal": DUO_API_BASE,
        "downloaded_at": datetime.now().isoformat(),
        "license": "CC-0 (Public Domain)",
        "types": {},
    }

    # Download each type
    with DUOSchoolsClient() as client:
        for stype in types_to_download:
            dataset_info = DATASETS[stype]
            log.info(f"\n=== Downloading: {dataset_info['name']} ===")

            try:
                # Get latest data
                records = client.get_latest_school_data(dataset_info["api_id"], format="json")

                log.info(f"Downloaded {len(records)} {stype} school records")

                # Transform records
                log.info("Transforming records...")
                for record in tqdm(records, desc=f"Processing {stype}"):
                    transformed = transform_school_record(record, stype)
                    all_schools.append(transformed)

                metadata["types"][stype] = {
                    "count": len(records),
                    "description": dataset_info["description"],
                    "dataset_url": dataset_info["url"]
                }

            except Exception as e:
                log.error(f"Failed to download {stype} schools: {e}")
                log.warning(f"Continuing with other types...")

    log.info(f"\n=== Total schools downloaded: {len(all_schools)} ===")

    # Apply sample limit
    if sample:
        all_schools = all_schools[:sample]
        log.info(f"Limited to {sample} schools")

    metadata["total_schools"] = len(all_schools)

    # Save
    result = {
        "metadata": metadata,
        "data": all_schools
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(all_schools)} schools to {output_path}")

    # Show sample
    if all_schools:
        log.info("\n=== Sample Schools ===")
        for i, school in enumerate(all_schools[:3]):
            log.info(f"\n{i+1}. {school.get('school_name')}")
            log.info(f"   Type: {school.get('school_type')}")
            log.info(f"   Address: {school.get('street')} {school.get('house_number')}, {school.get('city')}")
            log.info(f"   Postal Code: {school.get('postal_code')}")

    # Show breakdown by type
    if all_types:
        log.info("\n=== Schools by Type ===")
        from collections import Counter
        type_counts = Counter(s.get("school_type") for s in all_schools)
        for stype, count in type_counts.items():
            log.info(f"{stype}: {count:,} schools")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")

    log.success("\n✅ DUO school data ingestion complete!")
    log.info("Next step: Transform to Parquet with transform/schools_to_parquet.py")


if __name__ == "__main__":
    main()
