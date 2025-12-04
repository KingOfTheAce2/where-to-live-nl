"""
Complete DUO Schools data ingestion (All education levels - 2025).

Downloads school locations from DUO (Dienst Uitvoering Onderwijs) Open Data portal.
Covers ALL education levels:
- PO (Primair Onderwijs): Primary schools, ages 4-12
- VO (Voortgezet Onderwijs): Secondary schools, ages 12-18
- SO (Speciaal Onderwijs): Special education
- MBO (Middelbaar Beroepsonderwijs): Secondary vocational education
- HO (Hoger Onderwijs): Higher education (Universities & HBO)

Data source: https://onderwijsdata.duo.nl/
License: CC-BY 4.0
Updated: January 2025
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

# DUO Open Data Portal - Direct CSV URLs (verified January 2025)
# These URLs are stable and maintained by the Dutch Ministry of Education

DATASETS = {
    "po": {
        "name": "Primair Onderwijs (Primary Education)",
        "description": "All primary school locations (basisscholen) ages 4-12",
        "files": {
            "vestigingen": "https://onderwijsdata.duo.nl/dataset/786f12ea-6224-42fd-ab72-de4d7d879535/resource/dcc9c9a5-6d01-410b-967f-810557588ba4/download/vestigingenbo.csv",
            "instellingen": "https://onderwijsdata.duo.nl/dataset/786f12ea-6224-42fd-ab72-de4d7d879535/resource/9801fdea-01bc-43cc-8e4e-3e03a2bbbbf8/download/instellingenbo.csv",
        }
    },
    "vo": {
        "name": "Voortgezet Onderwijs (Secondary Education)",
        "description": "All secondary school locations ages 12-18",
        "files": {
            "vestigingen": "https://onderwijsdata.duo.nl/dataset/c8e6ffdd-cc2b-44ee-880f-0ff03f72e868/resource/5187f8d5-ff9c-4284-8e06-4311f0354956/download/vestigingenvo.csv",
            "instellingen": "https://onderwijsdata.duo.nl/dataset/c8e6ffdd-cc2b-44ee-880f-0ff03f72e868/resource/0ef14f5e-89bf-4e92-b28e-8d323b7b8dbc/download/instellingenvo.csv",
        }
    },
    "so": {
        "name": "Speciaal Onderwijs (Special Education)",
        "description": "Special education schools",
        "files": {
            "vestigingen": "https://onderwijsdata.duo.nl/dataset/033ab279-8e6f-44a2-8455-6ad42147762f/resource/8f0f1639-712d-4adb-bb59-cabd43730dc8/download/vestigingenso.csv",
            "instellingen": "https://onderwijsdata.duo.nl/dataset/033ab279-8e6f-44a2-8455-6ad42147762f/resource/c4bf5233-0b93-425e-8f93-3cb609e097df/download/instellingenso.csv",
        }
    },
    "mbo": {
        "name": "Middelbaar Beroepsonderwijs (Vocational Education)",
        "description": "MBO institutions (ROC)",
        "files": {
            "instellingen": "https://onderwijsdata.duo.nl/dataset/099507d2-df05-4dc3-8510-a55c26a7c13f/resource/bb3e73ff-38d5-4ce4-9426-17650266013f/download/instellingenmbo.csv",
        }
    },
    "ho": {
        "name": "Hoger Onderwijs (Higher Education)",
        "description": "Universities and HBO institutions",
        "files": {
            "instellingen": "https://onderwijsdata.duo.nl/dataset/4bb6ae5a-1f76-4e39-a369-ec1beb6bac51/resource/9db9d6a2-39cb-465b-9973-2f6995572324/download/instellingenho.csv",
        }
    }
}


class DUOSchoolsDownloader:
    """Client for downloading DUO school data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize downloader.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; DUO-Schools-Scraper/2.0)",
                "Accept": "text/csv, application/csv, */*",
            }
        )

    def download_csv(self, url: str) -> List[Dict]:
        """
        Download CSV file from URL.

        Args:
            url: Direct URL to CSV file

        Returns:
            List of records as dictionaries
        """
        try:
            log.info(f"Downloading: {url}")
            response = self.client.get(url)
            response.raise_for_status()

            # Parse CSV - DUO uses UTF-8 with BOM sometimes
            content = response.content.decode('utf-8-sig')

            # DUO CSVs use comma delimiter with quoted fields
            csv_reader = csv.DictReader(
                io.StringIO(content),
                delimiter=',',
                quotechar='"'
            )

            records = []
            for row in csv_reader:
                # Clean up the record (remove extra whitespace)
                cleaned = {
                    k.strip(): v.strip() if v else None
                    for k, v in row.items()
                }
                records.append(cleaned)

            log.success(f"Downloaded {len(records):,} records")
            return records

        except Exception as e:
            log.error(f"Error downloading CSV from {url}: {e}")
            raise

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def normalize_field_name(field: str) -> str:
    """
    Normalize DUO field names (they use different cases).

    Args:
        field: Raw field name

    Returns:
        Normalized lowercase field name
    """
    return field.lower().replace(' ', '_').replace('-', '_')


def transform_school_record(record: Dict, school_type: str, file_type: str) -> Optional[Dict]:
    """
    Transform DUO record to unified format.

    Args:
        record: Raw CSV record
        school_type: Type of school (po, vo, so, mbo, ho)
        file_type: File type (vestigingen or instellingen)

    Returns:
        Unified school record or None if invalid
    """
    # Normalize all field names (convert to lowercase with underscores)
    normalized = {normalize_field_name(k): v for k, v in record.items()}

    # Extract common fields (DUO uses various naming conventions across datasets)
    # Try both normalized names and original uppercase versions
    brin_nummer = (
        normalized.get('brin_nummer') or
        normalized.get('instellingscode') or
        normalized.get('brin') or
        record.get('BRIN NUMMER') or
        record.get('INSTELLINGSCODE')
    )

    # Vestigingsnummer only in vestigingen files
    vestigingsnummer = (
        normalized.get('vestigingsnummer') or
        normalized.get('vestigingscode') or
        record.get('VESTIGINGSCODE')
    )

    # School/institution name
    naam = (
        normalized.get('instellingsnaam') or
        normalized.get('vestigingsnaam') or
        normalized.get('naam_instelling') or
        normalized.get('naam') or
        record.get('INSTELLINGSNAAM') or
        record.get('VESTIGINGSNAAM')
    )

    # Address fields
    straatnaam = (
        normalized.get('straatnaam') or
        normalized.get('straat') or
        record.get('STRAATNAAM')
    )

    huisnummer = (
        normalized.get('huisnummer_toevoeging') or
        normalized.get('huisnummer') or
        record.get('HUISNUMMER-TOEVOEGING') or
        record.get('HUISNUMMER')
    )

    postcode = (
        normalized.get('postcode') or
        normalized.get('postcode_vestiging') or
        record.get('POSTCODE')
    )

    plaatsnaam = (
        normalized.get('plaatsnaam') or
        normalized.get('plaats') or
        record.get('PLAATSNAAM')
    )

    gemeentenaam = (
        normalized.get('gemeentenaam') or
        normalized.get('gemeente') or
        record.get('GEMEENTENAAM')
    )

    provincie = normalized.get('provincie') or record.get('PROVINCIE')

    # Contact info
    telefoonnummer = normalized.get('telefoonnummer') or record.get('TELEFOONNUMMER')
    internetadres = (
        normalized.get('internetadres') or
        normalized.get('website') or
        record.get('INTERNETADRES')
    )

    # Additional fields
    denominatie = normalized.get('denominatie') or record.get('DENOMINATIE')

    # Skip if no valid address
    if not postcode or not plaatsnaam:
        return None

    return {
        "brin_nummer": brin_nummer,
        "vestigingsnummer": vestigingsnummer,
        "school_name": naam,
        "street": straatnaam,
        "house_number": huisnummer,
        "postal_code": postcode,
        "city": plaatsnaam,
        "municipality": gemeentenaam,
        "province": provincie,
        "phone": telefoonnummer,
        "website": internetadres,
        "school_type": school_type,
        "school_type_label": DATASETS[school_type]["name"],
        "file_type": file_type,  # vestigingen (locations) or instellingen (institutions)
        "denomination": denominatie,
        # Will be enriched later with coordinates
        "latitude": None,
        "longitude": None,
    }


@click.command()
@click.option(
    "--types",
    default="po,vo,so,mbo,ho",
    help="Comma-separated list of school types to download (po,vo,so,mbo,ho)"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/schools_duo_complete.json",
    help="Output JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N schools for testing"
)
def main(
    types: str,
    output: str,
    sample: Optional[int]
):
    """
    Download ALL school locations from DUO Open Data portal.

    School types:
    - po: Primary schools (basisscholen) - Ages 4-12
    - vo: Secondary schools (voortgezet onderwijs) - Ages 12-18
    - so: Special education schools
    - mbo: Vocational education (ROC)
    - ho: Universities and HBO

    Examples:
        # Download all schools
        python -m ingest.duo_schools_complete

        # Download only primary and secondary
        python -m ingest.duo_schools_complete --types po,vo

        # Test with sample
        python -m ingest.duo_schools_complete --sample 100 --types po
    """
    log.info("=== DUO Complete Schools Data Ingestion (2025) ===")
    log.info("Data source: https://onderwijsdata.duo.nl/")
    log.info("License: CC-BY 4.0")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Parse types to download
    types_to_download = [t.strip().lower() for t in types.split(',')]

    # Validate types
    valid_types = set(DATASETS.keys())
    invalid_types = set(types_to_download) - valid_types
    if invalid_types:
        log.error(f"Invalid school types: {invalid_types}")
        log.info(f"Valid types: {', '.join(valid_types)}")
        return

    all_schools = []
    metadata = {
        "source": "DUO (Dienst Uitvoering Onderwijs)",
        "portal": "https://onderwijsdata.duo.nl/",
        "downloaded_at": datetime.now().isoformat(),
        "license": "CC-BY 4.0",
        "types": {},
    }

    # Download each type
    with DUOSchoolsDownloader() as downloader:
        for school_type in types_to_download:
            dataset_info = DATASETS[school_type]
            log.info(f"\n{'='*60}")
            log.info(f"Downloading: {dataset_info['name']}")
            log.info(f"{'='*60}")

            type_count = 0

            # Download each file (vestigingen, instellingen, etc.)
            for file_type, url in dataset_info["files"].items():
                log.info(f"\nFile type: {file_type}")

                try:
                    records = downloader.download_csv(url)
                    log.info(f"Processing {len(records):,} records...")

                    # Transform records
                    for record in tqdm(records, desc=f"Transforming {school_type}/{file_type}"):
                        transformed = transform_school_record(record, school_type, file_type)
                        if transformed:
                            all_schools.append(transformed)
                            type_count += 1

                except Exception as e:
                    log.error(f"Failed to download {school_type}/{file_type}: {e}")
                    log.warning("Continuing with other files...")

            # Store metadata
            metadata["types"][school_type] = {
                "count": type_count,
                "description": dataset_info["description"],
                "name": dataset_info["name"]
            }

            log.success(f"Total for {school_type}: {type_count:,} schools")

    log.info(f"\n{'='*60}")
    log.success(f"Total schools downloaded: {len(all_schools):,}")
    log.info(f"{'='*60}")

    # Apply sample limit
    if sample:
        all_schools = all_schools[:sample]
        log.info(f"Limited to {sample} schools for testing")

    metadata["total_schools"] = len(all_schools)

    # Save
    result = {
        "metadata": metadata,
        "data": all_schools
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"\nSaved {len(all_schools):,} schools to {output_path}")

    # Show breakdown by type
    if len(types_to_download) > 1:
        log.info("\n=== Schools by Type ===")
        from collections import Counter
        type_counts = Counter(s.get("school_type") for s in all_schools)
        for stype, count in sorted(type_counts.items()):
            type_label = DATASETS.get(stype, {}).get("name", stype)
            log.info(f"{stype.upper()}: {count:,} ({type_label})")

    # Show sample schools
    if all_schools:
        log.info("\n=== Sample Schools ===")
        for i, school in enumerate(all_schools[:5]):
            log.info(f"\n{i+1}. {school.get('school_name')}")
            log.info(f"   Type: {school.get('school_type_label')} ({school.get('school_type')})")
            log.info(f"   Address: {school.get('street')} {school.get('house_number')}")
            log.info(f"   {school.get('postal_code')} {school.get('city')}")
            if school.get('brin_nummer'):
                log.info(f"   BRIN: {school.get('brin_nummer')}")

    # File size
    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")

    log.success("\n✅ DUO complete school data ingestion finished!")
    log.info("\nNext steps:")
    log.info("1. Enrich with coordinates: python enrich_schools_with_coordinates.py")
    log.info("2. Convert to Parquet: python transform/schools_to_parquet.py")


if __name__ == "__main__":
    main()
