"""
Download ALL addresses from the Netherlands using PDOK Locatieserver.

Strategy: Query by postal code ranges to get complete coverage.
Netherlands has ~8-10 million addresses across postal codes 1000-9999.
"""

import json
from pathlib import Path
import click
import httpx
from tqdm import tqdm
import time

import sys
sys.path.append(str(Path(__file__).parent))

from common.logger import log

LOCATIESERVER_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


def load_checkpoint(checkpoint_path: Path) -> set:
    """Load completed postal codes from checkpoint."""
    if not checkpoint_path.exists():
        return set()

    with open(checkpoint_path, "r") as f:
        data = json.load(f)
        return set(data.get("completed_postal_codes", []))


def save_checkpoint(checkpoint_path: Path, completed_codes: set):
    """Save checkpoint of completed postal codes."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    with open(checkpoint_path, "w") as f:
        json.dump({
            "completed_postal_codes": list(completed_codes),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, indent=2)


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/netherlands_all_addresses.json",
    help="Output JSON file"
)
@click.option(
    "--resume",
    is_flag=True,
    help="Resume from checkpoint"
)
@click.option(
    "--batch-save",
    type=int,
    default=10000,
    help="Save to disk every N addresses"
)
def main(output: str, resume: bool, batch_save: int):
    """
    Download ALL addresses from Netherlands by postal code.

    This will take several hours but gets complete coverage.

    Examples:
        # Fresh start
        python download_all_netherlands_addresses.py

        # Resume interrupted download
        python download_all_netherlands_addresses.py --resume
    """
    log.info("=== Downloading ALL Netherlands Addresses ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    checkpoint_path = Path("../../data/checkpoints/address_download.json")

    # Load existing addresses if resuming
    all_addresses = []
    if resume and output_path.exists():
        log.info("Loading existing addresses...")
        with open(output_path, "r") as f:
            all_addresses = json.load(f)
        log.info(f"Loaded {len(all_addresses)} existing addresses")

    # Load checkpoint
    completed_codes = load_checkpoint(checkpoint_path) if resume else set()
    log.info(f"Resuming from {len(completed_codes)} completed postal codes")

    # Netherlands postal codes: 1000-9999 (4 digits)
    # We'll query all combinations
    total_codes = 9000  # 1000 to 9999

    client = httpx.Client(timeout=30)
    batch_addresses = []

    log.info(f"Processing {total_codes} postal code ranges...")
    log.info(f"This will take approximately 6-8 hours")

    with tqdm(total=total_codes, initial=len(completed_codes), desc="Postal codes") as pbar:
        for postal_prefix in range(1000, 10000):
            postal_code_start = f"{postal_prefix}"

            # Skip if already completed
            if postal_code_start in completed_codes:
                pbar.update(1)
                continue

            # Query all addresses with this postal code prefix
            start = 0
            rows = 100

            while True:
                try:
                    params = {
                        "q": postal_code_start,
                        "fq": f"postcode:{postal_code_start}* AND type:adres",
                        "rows": rows,
                        "start": start
                    }

                    response = client.get(LOCATIESERVER_URL, params=params)
                    response.raise_for_status()
                    data = response.json()

                    docs = data.get("response", {}).get("docs", [])

                    if not docs:
                        break  # No more results for this postal code

                    # Process addresses
                    for doc in docs:
                        # Extract coordinates from POINT(lon lat) format
                        centroide = doc.get("centroide_ll", "")
                        lat, lon = None, None
                        if centroide and centroide.startswith("POINT("):
                            try:
                                # Format: "POINT(4.8942242 52.37302144)"
                                coords = centroide.replace("POINT(", "").replace(")", "").strip()
                                parts = coords.split()
                                if len(parts) == 2:
                                    lon = float(parts[0])  # Longitude first in POINT format
                                    lat = float(parts[1])  # Latitude second
                            except Exception as e:
                                log.debug(f"Failed to parse coordinates: {centroide} - {e}")
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

                        batch_addresses.append(addr)

                    start += rows

                    # Check if there are more pages
                    num_found = data.get("response", {}).get("numFound", 0)
                    if start >= num_found:
                        break

                    # Small delay to be respectful
                    time.sleep(0.1)

                except Exception as e:
                    log.error(f"Error fetching postal code {postal_code_start}: {e}")
                    break

            # Mark postal code as completed
            completed_codes.add(postal_code_start)

            # Save batch periodically
            if len(batch_addresses) >= batch_save:
                all_addresses.extend(batch_addresses)

                # Save to file
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(all_addresses, f, ensure_ascii=False, indent=2)

                # Save checkpoint
                save_checkpoint(checkpoint_path, completed_codes)

                log.info(f"Saved batch: {len(all_addresses)} total addresses")
                batch_addresses = []

            pbar.update(1)

            # Progress update every 100 codes
            if len(completed_codes) % 100 == 0:
                log.info(f"Progress: {len(all_addresses)} addresses collected")

    # Save remaining batch
    if batch_addresses:
        all_addresses.extend(batch_addresses)

    # Final save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_addresses, f, ensure_ascii=False, indent=2)

    client.close()

    log.success(f"\n{'='*60}")
    log.success(f"Download complete!")
    log.success(f"Total addresses: {len(all_addresses):,}")
    log.success(f"Output: {output_path}")
    log.success(f"File size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
    log.success(f"{'='*60}")

    # Clean up checkpoint
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        log.info("Checkpoint file deleted (download completed)")


if __name__ == "__main__":
    main()
