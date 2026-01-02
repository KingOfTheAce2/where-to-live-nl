"""
Scrape ALL WOZ values for Netherlands - The Ultimate Marathon Script.

This script is designed to run for MONTHS continuously.
It handles:
- Automatic checkpointing (saves every 1000 addresses)
- Resume capability (can stop and restart anytime)
- Incremental saves split by postal code prefix
- Progress tracking and ETA
- Error resilience

Output structure:
    data/public/woz/
        woz_1xxx.parquet
        woz_2xxx.parquet
        ...
        woz_9xxx.parquet

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
import io

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.append(str(Path(__file__).parent))

from ingest.woz import WOZScraper
from common.logger import log

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
PUBLIC_DIR = DATA_DIR / "public"
WOZ_DIR = PUBLIC_DIR / "woz"
CHECKPOINT_DIR = DATA_DIR / "checkpoints"

# Dutch postal code prefixes
POSTAL_PREFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']


def load_checkpoint(checkpoint_path: Path) -> dict:
    """Load progress checkpoint."""
    if not checkpoint_path.exists():
        return {
            "last_index": 0,
            "total_scraped": 0,
            "total_failed": 0,
            "started_at": datetime.now().isoformat(),
            "by_prefix": {p: {"scraped": 0, "failed": 0} for p in POSTAL_PREFIXES}
        }

    with open(checkpoint_path, "r") as f:
        data = json.load(f)
        # Ensure by_prefix exists for backward compatibility
        if "by_prefix" not in data:
            data["by_prefix"] = {p: {"scraped": 0, "failed": 0} for p in POSTAL_PREFIXES}
        return data


def save_checkpoint(checkpoint_path: Path, data: dict):
    """Save progress checkpoint."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    data["last_updated"] = datetime.now().isoformat()

    with open(checkpoint_path, "w") as f:
        json.dump(data, f, indent=2)


def get_postal_prefix(postal_code: str) -> str:
    """Get the first digit of a postal code."""
    if postal_code and len(postal_code) >= 1:
        return postal_code[0]
    return "0"


def append_to_parquet_by_prefix(new_data: list[dict], output_dir: Path):
    """Append new data to existing Parquet files, split by postal prefix."""
    if not new_data:
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Group data by postal prefix
    by_prefix = {}
    for record in new_data:
        prefix = get_postal_prefix(record.get("postal_code", ""))
        if prefix not in by_prefix:
            by_prefix[prefix] = []
        by_prefix[prefix].append(record)

    # Append to each prefix file
    for prefix, records in by_prefix.items():
        if not records:
            continue

        output_path = output_dir / f"woz_{prefix}xxx.parquet"

        # Use infer_schema_length=None to scan all rows for schema inference
        new_df = pl.DataFrame(records, infer_schema_length=None)

        if output_path.exists():
            # Load existing and concatenate
            existing_df = pl.read_parquet(output_path)

            # Align columns
            all_columns = set(existing_df.columns) | set(new_df.columns)

            for col in all_columns:
                if col not in existing_df.columns:
                    existing_df = existing_df.with_columns(pl.lit(None).alias(col))
                if col not in new_df.columns:
                    new_df = new_df.with_columns(pl.lit(None).alias(col))

            sorted_columns = sorted(all_columns)
            existing_df = existing_df.select(sorted_columns)
            new_df = new_df.select(sorted_columns)

            combined_df = pl.concat([existing_df, new_df], how="vertical_relaxed")
            combined_df.write_parquet(
                output_path,
                compression="snappy",
                statistics=True,
                use_pyarrow=True
            )
        else:
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


def show_output_stats(output_dir: Path):
    """Show statistics for output files."""
    log.info("\nOutput file statistics:")
    total_records = 0
    total_size = 0

    for prefix in POSTAL_PREFIXES:
        output_path = output_dir / f"woz_{prefix}xxx.parquet"
        if output_path.exists():
            df = pl.scan_parquet(output_path)
            count = df.select(pl.len()).collect().item()
            size_mb = output_path.stat().st_size / (1024 * 1024)
            total_records += count
            total_size += size_mb
            log.info(f"  {prefix}xxx: {count:,} records ({size_mb:.2f} MB)")

    log.info(f"  TOTAL: {total_records:,} records ({total_size:.1f} MB)")


@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/netherlands_all_addresses.json",
    help="Input addresses JSON file"
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
    "--resume/--no-resume",
    default=True,
    help="Resume from checkpoint (default: True)"
)
@click.option(
    "--prefix",
    type=str,
    default=None,
    help="Only process addresses starting with this prefix (1-9)"
)
def main(input: str, rate_limit: float, save_every: int, resume: bool, prefix: str):
    """
    Scrape WOZ values for ALL Netherlands addresses.

    Output is split by postal code prefix into data/public/woz/

    Examples:
        # Start the marathon (all addresses)
        python scrape_all_woz.py --rate-limit 5.0

        # Only scrape 9xxx postal codes (Groningen/Drenthe)
        python scrape_all_woz.py --rate-limit 5.0 --prefix 9

        # Resume after interruption
        python scrape_all_woz.py --rate-limit 5.0 --resume
    """
    log.info("="*70)
    log.info("WOZ SCRAPER - Split by Postal Code")
    log.info("="*70)

    input_path = Path(input)
    checkpoint_path = CHECKPOINT_DIR / "woz_netherlands_progress.json"

    # Create output directory
    WOZ_DIR.mkdir(parents=True, exist_ok=True)

    # Load addresses
    log.info(f"Loading addresses from {input_path}...")
    with open(input_path, "r") as f:
        all_addresses = json.load(f)

    # Filter by prefix if specified
    if prefix:
        log.info(f"Filtering for postal codes starting with {prefix}...")
        all_addresses = [
            addr for addr in all_addresses
            if addr.get("postal_code", "").startswith(prefix)
        ]
        log.info(f"Filtered to {len(all_addresses):,} addresses")

    total_addresses = len(all_addresses)
    log.info(f"Total addresses to process: {total_addresses:,}")

    # Load checkpoint
    checkpoint = load_checkpoint(checkpoint_path)
    start_index = checkpoint["last_index"] if resume else 0

    if start_index > 0:
        log.info(f"Resuming from index {start_index:,}")
        log.info(f"Already scraped: {checkpoint['total_scraped']:,} WOZ values")
        log.info(f"Failed: {checkpoint['total_failed']:,}")

    # Show current output stats
    show_output_stats(WOZ_DIR)

    # Calculate estimates
    remaining = total_addresses - start_index
    time_per_address = (1.0 / rate_limit) + 0.5
    estimated_hours = (remaining * time_per_address) / 3600
    estimated_days = estimated_hours / 24

    log.info(f"\nESTIMATES:")
    log.info(f"  Remaining addresses: {remaining:,}")
    log.info(f"  Rate: {rate_limit} req/sec")
    log.info(f"  Estimated time: {estimated_days:.1f} days ({estimated_hours:.1f} hours)")
    log.info(f"  Expected completion: {(datetime.now() + timedelta(hours=estimated_hours)).strftime('%Y-%m-%d %H:%M')}")

    log.warning(f"\nThis will take approximately {estimated_days:.0f} DAYS to complete!")
    log.warning(f"Output directory: {WOZ_DIR}")

    import builtins
    builtins.input(f"\nPress ENTER to start, or Ctrl+C to cancel...")

    # Start scraping
    log.info(f"\n{'='*70}")
    log.info("STARTING WOZ SCRAPING")
    log.info(f"{'='*70}\n")

    batch_results = []
    start_time = time.time()
    scrape_start_time = start_time
    consecutive_429s = 0
    backoff_time = 60

    with WOZScraper(rate_limit=rate_limit) as scraper:
        with tqdm(total=total_addresses, initial=start_index, desc="Scraping WOZ", unit=" addr") as pbar:
            for i in range(start_index, total_addresses):
                addr = all_addresses[i]

                if not addr.get("postal_code") or not addr.get("house_number"):
                    checkpoint["total_failed"] += 1
                    pbar.update(1)
                    continue

                # Check if we need extended backoff due to rate limiting
                if consecutive_429s > 10:
                    log.warning(f"Too many 429s ({consecutive_429s}). Taking {backoff_time}s break...")
                    time.sleep(backoff_time)
                    backoff_time = min(backoff_time * 2, 600)
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

                        # Track by prefix
                        postal_prefix = get_postal_prefix(addr["postal_code"])
                        if postal_prefix in checkpoint["by_prefix"]:
                            checkpoint["by_prefix"][postal_prefix]["scraped"] += 1

                        consecutive_429s = 0
                        backoff_time = 60
                    else:
                        checkpoint["total_failed"] += 1
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
                    log.info(f"\nSaving batch of {len(batch_results)} records...")

                    append_to_parquet_by_prefix(batch_results, WOZ_DIR)
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
        log.info(f"\nSaving final batch of {len(batch_results)} records...")
        append_to_parquet_by_prefix(batch_results, WOZ_DIR)

    # Final statistics
    total_time = time.time() - scrape_start_time
    success_rate = (checkpoint["total_scraped"] / total_addresses * 100) if total_addresses > 0 else 0

    log.success(f"\n{'='*70}")
    log.success("SCRAPING COMPLETE!")
    log.success(f"{'='*70}")
    log.success(f"Total addresses processed: {total_addresses:,}")
    log.success(f"WOZ values found: {checkpoint['total_scraped']:,}")
    log.success(f"Failed/Not found: {checkpoint['total_failed']:,}")
    log.success(f"Success rate: {success_rate:.1f}%")
    log.success(f"Total time: {total_time/3600:.1f} hours")

    # Show final output stats
    show_output_stats(WOZ_DIR)

    log.success(f"\nOutput: {WOZ_DIR}")
    log.success(f"{'='*70}")


if __name__ == "__main__":
    main()
