"""
BAG (Basisregistraties Adressen en Gebouwen) data ingestion.

Downloads address and building data from PDOK BAG API.
API Documentation: https://api.pdok.nl/bzk/bag/v2/
"""

import json
from pathlib import Path
from typing import Optional
import click
import polars as pl
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.api_client import APIClient
from common.logger import log

BAG_API_BASE = "https://api.pdok.nl/bzk/bag/v2/full"

def fetch_addresses_paginated(
    client: APIClient,
    municipality: Optional[str] = None,
    province: Optional[str] = None,
    limit: Optional[int] = None
) -> list[dict]:
    """
    Fetch addresses from BAG API with pagination.

    Args:
        client: HTTP client
        municipality: Filter by municipality (e.g., "Amsterdam")
        province: Filter by province (e.g., "Noord-Holland")
        limit: Maximum number of addresses to fetch (for testing)

    Returns:
        List of address dictionaries
    """
    addresses = []
    page = 1
    page_size = 100  # BAG API default

    log.info("Starting BAG address download...")

    with tqdm(desc="Downloading addresses", unit=" addresses") as pbar:
        while True:
            # Build query parameters
            params = {
                "page": page,
                "pageSize": page_size
            }

            if municipality:
                params["woonplaatsNaam"] = municipality
            if province:
                params["provincieNaam"] = province

            try:
                # Fetch page
                response = client.get_json("/adressen", params=params)

                # Extract addresses
                page_addresses = response.get("_embedded", {}).get("adressen", [])

                if not page_addresses:
                    break  # No more results

                # Transform to simpler format
                for addr in page_addresses:
                    addresses.append({
                        "id": addr.get("identificatie"),
                        "street": addr.get("openbareRuimteNaam"),
                        "house_number": addr.get("huisnummer"),
                        "house_letter": addr.get("huisletter", ""),
                        "house_addition": addr.get("huisnummertoevoeging", ""),
                        "postal_code": addr.get("postcode"),
                        "city": addr.get("woonplaatsNaam"),
                        "municipality": addr.get("gemeenteNaam"),
                        "province": addr.get("provincieNaam"),
                        "latitude": addr.get("geopoint", {}).get("lat"),
                        "longitude": addr.get("geopoint", {}).get("lon"),
                        "status": addr.get("status"),
                    })

                pbar.update(len(page_addresses))

                # Check limit
                if limit and len(addresses) >= limit:
                    addresses = addresses[:limit]
                    log.info(f"Reached limit of {limit} addresses")
                    break

                # Check if there are more pages
                links = response.get("_links", {})
                if "next" not in links:
                    break

                page += 1

            except Exception as e:
                log.error(f"Error fetching page {page}: {e}")
                break

    log.success(f"Downloaded {len(addresses)} addresses")
    return addresses

def fetch_buildings_for_addresses(
    client: APIClient,
    address_ids: list[str]
) -> list[dict]:
    """
    Fetch building details for given addresses.

    Args:
        client: HTTP client
        address_ids: List of BAG address identifiers

    Returns:
        List of building dictionaries
    """
    buildings = []

    log.info(f"Fetching building details for {len(address_ids)} addresses...")

    for addr_id in tqdm(address_ids, desc="Fetching buildings"):
        try:
            response = client.get_json(f"/adresseerbareobjecten/{addr_id}")

            # Extract building info
            pand_refs = response.get("_links", {}).get("pandrelatering", [])

            for pand_ref in pand_refs:
                pand_id = pand_ref.get("href", "").split("/")[-1]

                # Fetch building (pand) details
                try:
                    pand = client.get_json(f"/panden/{pand_id}")

                    buildings.append({
                        "address_id": addr_id,
                        "building_id": pand.get("identificatie"),
                        "build_year": pand.get("oorspronkelijkBouwjaar"),
                        "status": pand.get("status"),
                        "geometry": pand.get("geometrie"),
                    })
                except Exception as e:
                    log.warning(f"Could not fetch building {pand_id}: {e}")

        except Exception as e:
            log.warning(f"Could not fetch address object {addr_id}: {e}")

    log.success(f"Fetched {len(buildings)} building records")
    return buildings

@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/bag.json",
    help="Output JSON file path"
)
@click.option(
    "--municipality",
    type=str,
    help="Filter by municipality (e.g., 'Amsterdam')"
)
@click.option(
    "--province",
    type=str,
    help="Filter by province (e.g., 'Noord-Holland')"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N addresses for testing"
)
@click.option(
    "--with-buildings",
    is_flag=True,
    help="Also fetch building details (slow!)"
)
def main(
    output: str,
    municipality: Optional[str],
    province: Optional[str],
    sample: Optional[int],
    with_buildings: bool
):
    """
    Download BAG address data from PDOK API.

    Examples:
        # Download all addresses (slow!)
        python -m ingest.bag

        # Sample 1000 addresses
        python -m ingest.bag --sample 1000

        # Amsterdam only
        python -m ingest.bag --municipality Amsterdam

        # With building details
        python -m ingest.bag --sample 100 --with-buildings
    """
    log.info("=== BAG Data Ingestion ===")

    # Create output directory
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize API client
    with APIClient(base_url=BAG_API_BASE, timeout=60) as client:
        # Fetch addresses
        addresses = fetch_addresses_paginated(
            client=client,
            municipality=municipality,
            province=province,
            limit=sample
        )

        if not addresses:
            log.error("No addresses fetched!")
            return

        # Optionally fetch building details
        if with_buildings:
            address_ids = [addr["id"] for addr in addresses if addr["id"]]
            buildings = fetch_buildings_for_addresses(client, address_ids)

            # Merge buildings into addresses
            building_map = {}
            for building in buildings:
                addr_id = building["address_id"]
                if addr_id not in building_map:
                    building_map[addr_id] = []
                building_map[addr_id].append(building)

            for addr in addresses:
                addr["buildings"] = building_map.get(addr["id"], [])

        # Save to JSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(addresses, f, ensure_ascii=False, indent=2)

        log.success(f"Saved {len(addresses)} addresses to {output_path}")
        log.info(f"File size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")

if __name__ == "__main__":
    main()
