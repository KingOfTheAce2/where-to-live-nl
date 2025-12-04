"""
Enrich existing addresses JSON file with coordinates from PDOK API.

This script takes an existing addresses file (without coordinates) and enriches it
by looking up coordinates from the PDOK Locatieserver API using postal code + house number.

Much faster than re-downloading everything from scratch!
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
    """Load processed address indices from checkpoint."""
    if not checkpoint_path.exists():
        return set()

    with open(checkpoint_path, "r") as f:
        data = json.load(f)
        return set(data.get("processed_indices", []))


def save_checkpoint(checkpoint_path: Path, processed_indices: set):
    """Save checkpoint of processed indices."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    with open(checkpoint_path, "w") as f:
        json.dump({
            "processed_indices": list(processed_indices),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, indent=2)


def parse_point_coordinates(point_str: str) -> tuple[float, float] | tuple[None, None]:
    """
    Parse POINT(lon lat) format from PDOK API.

    Example: "POINT(4.8942242 52.37302144)" -> (52.37302144, 4.8942242)

    Returns:
        (latitude, longitude) or (None, None) if parsing fails
    """
    if not point_str or not point_str.startswith("POINT("):
        return None, None

    try:
        # Format: "POINT(4.8942242 52.37302144)"
        coords = point_str.replace("POINT(", "").replace(")", "").strip()
        parts = coords.split()

        if len(parts) == 2:
            lon = float(parts[0])  # Longitude first in POINT format
            lat = float(parts[1])  # Latitude second
            return lat, lon
    except Exception as e:
        log.debug(f"Failed to parse coordinates: {point_str} - {e}")

    return None, None


def lookup_coordinates(client: httpx.Client, postal_code: str, house_number: int,
                       house_letter: str = "", house_addition: str = "") -> tuple[float, float] | tuple[None, None]:
    """
    Look up coordinates for an address using PDOK API.

    Args:
        client: HTTP client
        postal_code: Postal code (e.g., "1012JS")
        house_number: House number
        house_letter: Optional house letter
        house_addition: Optional house addition

    Returns:
        (latitude, longitude) or (None, None) if not found
    """
    try:
        # Build query
        query = f"{postal_code} {house_number}"
        if house_letter:
            query += house_letter
        if house_addition:
            query += house_addition

        params = {
            "q": query,
            "fq": f"postcode:{postal_code} AND type:adres",
            "rows": 1
        }

        response = client.get(LOCATIESERVER_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        docs = data.get("response", {}).get("docs", [])

        if docs:
            centroide = docs[0].get("centroide_ll", "")
            return parse_point_coordinates(centroide)

    except Exception as e:
        log.debug(f"Error looking up {postal_code} {house_number}: {e}")

    return None, None


@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/netherlands_all_addresses.json",
    help="Input addresses JSON file (without coordinates)"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/netherlands_all_addresses_with_coords.json",
    help="Output enriched addresses JSON file"
)
@click.option(
    "--resume",
    is_flag=True,
    default=True,
    help="Resume from checkpoint (default: True)"
)
@click.option(
    "--save-every",
    type=int,
    default=5000,
    help="Save progress every N addresses"
)
@click.option(
    "--rate-limit",
    type=float,
    default=0.2,
    help="Delay between API requests in seconds (default: 0.2 = 5 req/sec)"
)
@click.option(
    "--sample",
    type=int,
    help="Only process first N addresses (for testing)"
)
def main(input: str, output: str, resume: bool, save_every: int, rate_limit: float, sample: int):
    """
    Enrich existing addresses with coordinates from PDOK API.

    This is MUCH faster than re-downloading all addresses from scratch!

    Examples:
        # Test with 100 addresses first
        python enrich_addresses_with_coordinates.py --sample 100

        # Run full enrichment (takes 3-5 hours)
        python enrich_addresses_with_coordinates.py

        # Resume after interruption
        python enrich_addresses_with_coordinates.py --resume
    """
    log.info("="*70)
    log.info("🗺️  ENRICHING ADDRESSES WITH COORDINATES")
    log.info("="*70)

    input_path = Path(input)
    output_path = Path(output)
    checkpoint_path = Path("../../data/checkpoints/coordinate_enrichment.json")

    # Load addresses
    log.info(f"Loading addresses from {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        addresses = json.load(f)

    total = len(addresses)
    log.info(f"Loaded {total:,} addresses")

    if sample:
        addresses = addresses[:sample]
        total = len(addresses)
        log.info(f"Using sample of {total:,} addresses")

    # Load checkpoint
    processed_indices = load_checkpoint(checkpoint_path) if resume else set()

    if processed_indices:
        log.info(f"Resuming from checkpoint: {len(processed_indices):,} already processed")

    # Count how many already have coordinates
    with_coords = sum(1 for addr in addresses if addr.get("latitude") is not None)
    log.info(f"Addresses already with coordinates: {with_coords:,}")

    # Estimate time
    remaining = total - len(processed_indices)
    estimated_seconds = remaining * rate_limit
    estimated_hours = estimated_seconds / 3600

    log.info(f"\n📊 ESTIMATES:")
    log.info(f"  Addresses to process: {remaining:,}")
    log.info(f"  Rate limit: {rate_limit}s/request ({1/rate_limit:.1f} req/sec)")
    log.info(f"  Estimated time: {estimated_hours:.1f} hours")

    # Start enrichment
    client = httpx.Client(timeout=30)
    success_count = 0
    failed_count = 0

    log.info(f"\n{'='*70}")
    log.info("🚀 STARTING COORDINATE ENRICHMENT")
    log.info(f"{'='*70}\n")

    try:
        with tqdm(total=total, initial=len(processed_indices), desc="Enriching addresses", unit=" addr") as pbar:
            for idx, addr in enumerate(addresses):
                # Skip if already processed
                if idx in processed_indices:
                    pbar.update(1)
                    continue

                # Skip if already has coordinates
                if addr.get("latitude") is not None:
                    processed_indices.add(idx)
                    pbar.update(1)
                    continue

                # Look up coordinates
                postal_code = addr.get("postal_code")
                house_number = addr.get("house_number")
                house_letter = addr.get("house_letter", "")
                house_addition = addr.get("house_addition", "")

                if postal_code and house_number:
                    lat, lon = lookup_coordinates(
                        client,
                        postal_code,
                        house_number,
                        house_letter,
                        house_addition
                    )

                    if lat and lon:
                        addr["latitude"] = lat
                        addr["longitude"] = lon
                        success_count += 1
                    else:
                        failed_count += 1

                    # Rate limiting
                    time.sleep(rate_limit)

                processed_indices.add(idx)
                pbar.update(1)

                # Save progress periodically
                if len(processed_indices) % save_every == 0:
                    log.info(f"\n💾 Saving progress...")

                    # Save enriched addresses
                    with open(output_path, "w", encoding="utf-8") as f:
                        json.dump(addresses, f, ensure_ascii=False, indent=2)

                    # Save checkpoint
                    save_checkpoint(checkpoint_path, processed_indices)

                    success_rate = (success_count / len(processed_indices) * 100) if processed_indices else 0
                    log.info(f"   Processed: {len(processed_indices):,}/{total:,}")
                    log.info(f"   Success: {success_count:,} ({success_rate:.1f}%)")
                    log.info(f"   Failed: {failed_count:,}")
                    log.info(f"   Progress saved to {output_path}\n")

    finally:
        # Final save
        log.info(f"\n💾 Saving final results...")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(addresses, f, ensure_ascii=False, indent=2)

        client.close()

    # Final statistics
    success_rate = (success_count / total * 100) if total > 0 else 0

    log.success(f"\n{'='*70}")
    log.success("🎉 ENRICHMENT COMPLETE!")
    log.success(f"{'='*70}")
    log.success(f"Total addresses: {total:,}")
    log.success(f"Successfully enriched: {success_count:,} ({success_rate:.1f}%)")
    log.success(f"Failed to find coordinates: {failed_count:,}")
    log.success(f"Output: {output_path}")
    log.success(f"File size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
    log.success(f"{'='*70}")

    # Clean up checkpoint
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        log.info("✓ Checkpoint deleted (enrichment complete)")


if __name__ == "__main__":
    main()
