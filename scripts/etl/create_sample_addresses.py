"""
Create sample BAG addresses using PDOK Locatieserver (no API key needed).

This is a quick alternative to the full BAG API which now requires authentication.
"""

import json
from pathlib import Path
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent))

from common.logger import log

LOCATIESERVER_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


@click.command()
@click.option(
    "--municipality",
    type=str,
    required=True,
    help="Municipality name (e.g., 'Amsterdam')"
)
@click.option(
    "--sample",
    type=int,
    default=100,
    help="Number of addresses to fetch"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/bag.json",
    help="Output JSON file"
)
def main(municipality: str, sample: int, output: str):
    """
    Fetch sample addresses using PDOK Locatieserver.

    Examples:
        python create_sample_addresses.py --municipality Amsterdam --sample 50
        python create_sample_addresses.py --municipality Utrecht --sample 100
    """
    log.info(f"=== Fetching {sample} addresses from {municipality} ===")

    addresses = []
    client = httpx.Client(timeout=30)

    # Fetch addresses in batches
    rows_per_request = 100
    start = 0

    with tqdm(total=sample, desc="Fetching addresses") as pbar:
        while len(addresses) < sample:
            try:
                # Query locatieserver
                params = {
                    "q": municipality,
                    "fq": f"woonplaatsnaam:{municipality} AND type:adres",
                    "rows": min(rows_per_request, sample - len(addresses)),
                    "start": start
                }

                response = client.get(LOCATIESERVER_URL, params=params)
                response.raise_for_status()
                data = response.json()

                docs = data.get("response", {}).get("docs", [])

                if not docs:
                    log.warning(f"No more addresses found after {len(addresses)} addresses")
                    break

                # Process addresses
                for doc in docs:
                    # Extract address components
                    centroide = doc.get("centroide_ll", "")
                    lat, lon = None, None
                    if centroide and "," in centroide:
                        try:
                            parts = centroide.split(",")
                            if len(parts) >= 2:
                                lat = parts[0].strip()
                                lon = parts[1].strip()
                        except:
                            pass

                    addr = {
                        "id": doc.get("id"),
                        "street": doc.get("straatnaam"),
                        "house_number": doc.get("huisnummer"),
                        "house_letter": doc.get("huisletter", ""),
                        "house_addition": doc.get("huisnummertoevoeging", ""),
                        "postal_code": doc.get("postcode"),
                        "city": doc.get("woonplaatsnaam"),
                        "municipality": doc.get("gemeentenaam"),
                        "province": doc.get("provincienaam"),
                        "latitude": lat,
                        "longitude": lon,
                    }

                    addresses.append(addr)
                    pbar.update(1)

                    if len(addresses) >= sample:
                        break

                start += rows_per_request

            except Exception as e:
                log.error(f"Error fetching addresses: {e}")
                break

    client.close()

    if not addresses:
        log.error("No addresses fetched!")
        return

    log.success(f"Fetched {len(addresses)} addresses")

    # Save to JSON
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(addresses, f, ensure_ascii=False, indent=2)

    log.success(f"Saved to {output_path}")
    log.info(f"File size: {output_path.stat().st_size / 1024:.1f} KB")

    # Show sample
    log.info("\nSample addresses:")
    for addr in addresses[:5]:
        log.info(f"  {addr['street']} {addr['house_number']}, {addr['postal_code']} {addr['city']}")


if __name__ == "__main__":
    main()
