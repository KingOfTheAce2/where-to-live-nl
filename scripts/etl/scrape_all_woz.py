"""
Scrape ALL WOZ values for Netherlands - The Ultimate Marathon Script.

This script is designed to run for MONTHS continuously.
It handles:
- Automatic checkpointing (saves every 1000 addresses)
- Resume capability (can stop and restart anytime)
- Incremental Parquet saves (won't lose data if crashed)
- Progress tracking and ETA
- Error resilience

Estimated time: 90-120 days at 1 req/sec
"""

import json
from pathlib import Path
import click
import polars as pl
from tqdm import tqdm
import time
from datetime import datetime, timedelta

import sys
sys.path.append(str(Path(__file__).parent))

from ingest.woz import WOZScraper
from common.logger import log


def load_checkpoint(checkpoint_path: Path) -> dict:
    """Load progress checkpoint."""
    if not checkpoint_path.exists():
        return {
            "last_index": 0,
            "total_scraped": 0,
            "total_failed": 0,
            "started_at": datetime.now().isoformat()
        }

    with open(checkpoint_path, "r") as f:
        return json.load(f)


def save_checkpoint(checkpoint_path: Path, data: dict):
    """Save progress checkpoint."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    data["last_updated"] = datetime.now().isoformat()

    with open(checkpoint_path, "w") as f:
        json.dump(data, f, indent=2)


def append_to_parquet(new_data: list[dict], output_path: Path):
    """Append new data to existing Parquet file."""
    if not new_data:
        return

    new_df = pl.DataFrame(new_data)

    if output_path.exists():
        # Load existing and concatenate
        existing_df = pl.read_parquet(output_path)
        combined_df = pl.concat([existing_df, new_df])
        combined_df.write_parquet(
            output_path,
            compression="snappy",
            statistics=True,
            use_pyarrow=True
        )
    else:
        # Create new file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        new_df.write_parquet(
            output_path,
            compression="snappy",
            statistics=True,
            use_pyarrow=True
        )


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


@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/netherlands_all_addresses.json",
    help="Input addresses JSON file"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/woz-netherlands-complete.parquet",
    help="Output Parquet file"
)
@click.option(
    "--rate-limit",
    type=float,
    default=0.5,
    help="Requests per second (default: 0.5 - slower but safer)"
)
@click.option(
    "--save-every",
    type=int,
    default=1000,
    help="Save to Parquet every N addresses"
)
@click.option(
    "--resume",
    is_flag=True,
    default=True,
    help="Resume from checkpoint (default: True)"
)
def main(input: str, output: str, rate_limit: float, save_every: int, resume: bool):
    """
    Scrape WOZ values for ALL Netherlands addresses.

    This is THE BIG ONE. Designed to run for months.

    Examples:
        # Start the marathon
        python scrape_all_woz.py

        # Resume after interruption (automatically resumes by default)
        python scrape_all_woz.py --resume

        # Faster (2 req/sec - use with caution)
        python scrape_all_woz.py --rate-limit 2.0
    """
    log.info("="*70)
    log.info("🇳🇱 SCRAPING ALL WOZ VALUES FOR THE NETHERLANDS 🇳🇱")
    log.info("="*70)

    input_path = Path(input)
    output_path = Path(output)
    checkpoint_path = Path("../../data/checkpoints/woz_netherlands_progress.json")

    # Load addresses
    log.info(f"Loading addresses from {input_path}...")
    with open(input_path, "r") as f:
        addresses = json.load(f)

    total_addresses = len(addresses)
    log.info(f"Total addresses to process: {total_addresses:,}")

    # Load checkpoint
    checkpoint = load_checkpoint(checkpoint_path)
    start_index = checkpoint["last_index"] if resume else 0

    if start_index > 0:
        log.info(f"Resuming from index {start_index:,}")
        log.info(f"Already scraped: {checkpoint['total_scraped']:,} WOZ values")
        log.info(f"Failed: {checkpoint['total_failed']:,}")

    # Calculate estimates
    remaining = total_addresses - start_index
    time_per_address = (1.0 / rate_limit) + 0.5  # accounting for API overhead
    estimated_hours = (remaining * time_per_address) / 3600
    estimated_days = estimated_hours / 24

    log.info(f"\n📊 ESTIMATES:")
    log.info(f"  Remaining addresses: {remaining:,}")
    log.info(f"  Rate: {rate_limit} req/sec")
    log.info(f"  Estimated time: {estimated_days:.1f} days ({estimated_hours:.1f} hours)")
    log.info(f"  Expected completion: {(datetime.now() + timedelta(hours=estimated_hours)).strftime('%Y-%m-%d %H:%M')}")

    # Ask for confirmation
    log.warning(f"\n⚠️  This will take approximately {estimated_days:.0f} DAYS to complete!")
    log.warning(f"⚠️  Make sure:")
    log.warning(f"     - Your computer can run continuously")
    log.warning(f"     - You have stable internet")
    log.warning(f"     - You have enough disk space (~2-3 GB)")

    import builtins
    builtins.input(f"\n➤ Press ENTER to start the marathon, or Ctrl+C to cancel...")

    # Start scraping
    log.info(f"\n{'='*70}")
    log.info("🚀 STARTING WOZ SCRAPING MARATHON 🚀")
    log.info(f"{'='*70}\n")

    batch_results = []
    start_time = time.time()
    scrape_start_time = start_time
    consecutive_429s = 0
    backoff_time = 60  # Start with 60 seconds backoff

    with WOZScraper(rate_limit=rate_limit) as scraper:
        with tqdm(total=total_addresses, initial=start_index, desc="Scraping WOZ", unit=" addr") as pbar:
            for i in range(start_index, total_addresses):
                addr = addresses[i]

                if not addr.get("postal_code") or not addr.get("house_number"):
                    checkpoint["total_failed"] += 1
                    pbar.update(1)
                    continue

                # Check if we need extended backoff due to rate limiting
                if consecutive_429s > 10:
                    log.warning(f"⚠️  Too many 429s ({consecutive_429s}). Taking {backoff_time}s break...")
                    time.sleep(backoff_time)
                    backoff_time = min(backoff_time * 2, 600)  # Max 10 minutes
                    consecutive_429s = 0

                try:
                    woz_data = scraper.lookup_woz(
                        postal_code=addr["postal_code"],
                        house_number=addr["house_number"],
                        house_letter=addr.get("house_letter", "")
                    )

                    if woz_data and woz_data.get("valuations"):
                        flat = flatten_woz(woz_data)
                        batch_results.append(flat)
                        checkpoint["total_scraped"] += 1
                        consecutive_429s = 0  # Reset on success
                        backoff_time = 60  # Reset backoff time
                    else:
                        checkpoint["total_failed"] += 1
                        # Check if it was a 429 (would be logged)
                        consecutive_429s += 1

                except Exception as e:
                    log.error(f"Error at index {i}: {e}")
                    checkpoint["total_failed"] += 1
                    if "429" in str(e):
                        consecutive_429s += 1

                checkpoint["last_index"] = i + 1
                pbar.update(1)

                # Save batch periodically
                if len(batch_results) >= save_every:
                    log.info(f"\n💾 Saving batch of {len(batch_results)} records...")

                    append_to_parquet(batch_results, output_path)
                    save_checkpoint(checkpoint_path, checkpoint)

                    # Calculate statistics
                    elapsed = time.time() - start_time
                    rate_actual = len(batch_results) / elapsed if elapsed > 0 else 0
                    success_rate = (checkpoint["total_scraped"] / checkpoint["last_index"] * 100) if checkpoint["last_index"] > 0 else 0

                    log.info(f"   Total scraped: {checkpoint['total_scraped']:,}")
                    log.info(f"   Success rate: {success_rate:.1f}%")
                    log.info(f"   Actual rate: {rate_actual:.2f} records/sec")

                    # Calculate new ETA
                    remaining_addrs = total_addresses - checkpoint["last_index"]
                    if rate_actual > 0:
                        eta_seconds = remaining_addrs / rate_actual
                        eta_time = datetime.now() + timedelta(seconds=eta_seconds)
                        log.info(f"   New ETA: {eta_time.strftime('%Y-%m-%d %H:%M')} ({eta_seconds/3600/24:.1f} days)")

                    batch_results = []
                    start_time = time.time()

    # Save final batch
    if batch_results:
        log.info(f"\n💾 Saving final batch of {len(batch_results)} records...")
        append_to_parquet(batch_results, output_path)

    # Final statistics
    total_time = time.time() - scrape_start_time
    success_rate = (checkpoint["total_scraped"] / total_addresses * 100)

    log.success(f"\n{'='*70}")
    log.success("🎉 MARATHON COMPLETE! 🎉")
    log.success(f"{'='*70}")
    log.success(f"Total addresses processed: {total_addresses:,}")
    log.success(f"WOZ values found: {checkpoint['total_scraped']:,}")
    log.success(f"Failed/Not found: {checkpoint['total_failed']:,}")
    log.success(f"Success rate: {success_rate:.1f}%")
    log.success(f"Total time: {total_time/3600/24:.1f} days")
    log.success(f"Output: {output_path}")
    log.success(f"{'='*70}")

    # Clean up checkpoint
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        log.info("Checkpoint deleted (scraping complete)")


if __name__ == "__main__":
    main()
