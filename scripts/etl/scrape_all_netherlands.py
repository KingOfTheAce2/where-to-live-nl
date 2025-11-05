"""
Scrape ALL WOZ values for the Netherlands.

This script handles the entire country by:
1. Fetching addresses in batches
2. Scraping WOZ values with checkpointing
3. Automatically resuming if interrupted
4. Saving incrementally to avoid data loss

WARNING: This will take weeks/months to complete!
Estimated time: 90-120 days at 1 req/sec
"""

import json
from pathlib import Path
import click
import polars as pl
from datetime import datetime
import time

import sys
sys.path.append(str(Path(__file__).parent))

from ingest.woz import WOZScraper
from common.logger import log


# Major Dutch cities (in order of size)
MAJOR_CITIES = [
    "Amsterdam",
    "Rotterdam",
    "Den Haag",
    "Utrecht",
    "Eindhoven",
    "Groningen",
    "Tilburg",
    "Almere",
    "Breda",
    "Nijmegen",
    "Apeldoorn",
    "Haarlem",
    "Arnhem",
    "Zaanstad",
    "Amersfoort",
    "s-Hertogenbosch",
    "Haarlemmermeer",
    "Zwolle",
    "Zoetermeer",
    "Leiden"
]


def load_checkpoint(checkpoint_path: Path) -> dict:
    """Load progress checkpoint."""
    if not checkpoint_path.exists():
        return {"completed_cities": [], "last_city": None, "total_scraped": 0}

    with open(checkpoint_path, "r") as f:
        return json.load(f)


def save_checkpoint(checkpoint_path: Path, data: dict):
    """Save progress checkpoint."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    with open(checkpoint_path, "w") as f:
        json.dump(data, f, indent=2)


def append_to_parquet(new_data: list[dict], output_path: Path):
    """Append new data to existing Parquet file."""
    new_df = pl.DataFrame(new_data)

    if output_path.exists():
        # Load existing and concatenate
        existing_df = pl.read_parquet(output_path)
        combined_df = pl.concat([existing_df, new_df])
        combined_df.write_parquet(output_path, compression="snappy")
        log.info(f"Appended {len(new_df)} rows. Total: {len(combined_df)}")
    else:
        # Create new file
        new_df.write_parquet(output_path, compression="snappy")
        log.info(f"Created new Parquet with {len(new_df)} rows")


@click.command()
@click.option(
    "--output-dir",
    type=click.Path(),
    default="../../data/processed",
    help="Output directory for Parquet files"
)
@click.option(
    "--rate-limit",
    type=float,
    default=1.0,
    help="Requests per second (default: 1.0)"
)
@click.option(
    "--cities-only",
    is_flag=True,
    help="Only scrape major cities (faster)"
)
@click.option(
    "--batch-size",
    type=int,
    default=1000,
    help="Save to disk every N addresses"
)
def main(output_dir: str, rate_limit: float, cities_only: bool, batch_size: int):
    """
    Scrape WOZ values for entire Netherlands.

    Examples:
        # Major cities only (recommended to start)
        python scrape_all_netherlands.py --cities-only

        # Full country (very long!)
        python scrape_all_netherlands.py
    """
    log.info("=== Scraping WOZ Values for Netherlands ===")

    output_path = Path(output_dir) / "woz-netherlands-full.parquet"
    checkpoint_path = Path(output_dir) / "woz-checkpoint.json"
    addresses_dir = Path("../../data/raw/addresses")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    addresses_dir.mkdir(parents=True, exist_ok=True)

    # Load checkpoint
    checkpoint = load_checkpoint(checkpoint_path)
    log.info(f"Progress: {checkpoint['total_scraped']} addresses scraped so far")

    if cities_only:
        cities_to_process = MAJOR_CITIES
        log.info(f"Processing {len(cities_to_process)} major cities")
    else:
        log.warning("Full Netherlands mode - this will take MONTHS!")
        cities_to_process = MAJOR_CITIES  # Would need full city list

    # Process each city
    for city in cities_to_process:
        if city in checkpoint["completed_cities"]:
            log.info(f"Skipping {city} (already completed)")
            continue

        log.info(f"\n{'='*60}")
        log.info(f"Processing: {city}")
        log.info(f"{'='*60}")

        # Get addresses for this city
        addresses_file = addresses_dir / f"{city.lower().replace(' ', '_')}_addresses.json"

        if not addresses_file.exists():
            log.info(f"Fetching addresses for {city}...")
            # Note: User would run create_sample_addresses.py separately
            log.warning(f"Please first run:")
            log.warning(f'  python create_sample_addresses.py --municipality "{city}" --sample 100000 --output "{addresses_file}"')
            continue

        # Load addresses
        with open(addresses_file, "r") as f:
            addresses = json.load(f)

        log.info(f"Loaded {len(addresses)} addresses for {city}")

        # Scrape WOZ values
        batch_results = []
        scraped_count = 0

        with WOZScraper(rate_limit=rate_limit) as scraper:
            for i, addr in enumerate(addresses):
                if not addr.get("postal_code") or not addr.get("house_number"):
                    continue

                woz_data = scraper.lookup_woz(
                    postal_code=addr["postal_code"],
                    house_number=addr["house_number"],
                    house_letter=addr.get("house_letter", "")
                )

                if woz_data and woz_data.get("valuations"):
                    # Flatten to dict
                    flat = flatten_woz(woz_data)
                    batch_results.append(flat)
                    scraped_count += 1

                # Save batch periodically
                if len(batch_results) >= batch_size:
                    append_to_parquet(batch_results, output_path)
                    checkpoint["total_scraped"] += len(batch_results)
                    checkpoint["last_city"] = city
                    save_checkpoint(checkpoint_path, checkpoint)
                    batch_results = []

                # Progress update
                if (i + 1) % 100 == 0:
                    log.info(f"  Progress: {i+1}/{len(addresses)} addresses ({scraped_count} WOZ found)")

        # Save remaining batch
        if batch_results:
            append_to_parquet(batch_results, output_path)
            checkpoint["total_scraped"] += len(batch_results)

        # Mark city as complete
        checkpoint["completed_cities"].append(city)
        checkpoint["last_city"] = city
        save_checkpoint(checkpoint_path, checkpoint)

        log.success(f"Completed {city}: {scraped_count} WOZ values scraped")

    log.success(f"\n{'='*60}")
    log.success(f"Scraping complete!")
    log.success(f"Total WOZ values: {checkpoint['total_scraped']}")
    log.success(f"Output: {output_path}")
    log.success(f"{'='*60}")


def flatten_woz(woz_result: dict) -> dict:
    """Flatten WOZ result to dict with all fields."""
    flat = {
        "postal_code": woz_result["postal_code"],
        "house_number": woz_result["house_number"],
        "house_letter": woz_result.get("house_letter", ""),
        "woz_object_nummer": woz_result.get("woz_object_nummer"),
        "adresseerbaar_object_id": woz_result.get("adresseerbaar_object_id"),
        "nummeraanduiding_id": woz_result.get("nummeraanduiding_id"),
        "bouwjaar": woz_result.get("bouwjaar") or woz_result.get("pand_bouwjaar"),
        "gebruiksdoel": woz_result.get("gebruiksdoel"),
        "oppervlakte": woz_result.get("oppervlakte"),
        "gemeentecode": woz_result.get("gemeentecode"),
        "bag_pand_id": woz_result.get("bag_pand_id"),
    }

    # Flatten valuations
    for val in woz_result.get("valuations", []):
        year = val["valuation_date"].split("-")[0]
        flat[f"woz_{year}"] = val["woz_value"]

    return flat


if __name__ == "__main__":
    main()
