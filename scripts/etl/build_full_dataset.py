#!/usr/bin/env python3
"""
Build complete Netherlands property dataset with all addresses.

This script:
1. Downloads ALL addresses from PDOK Locatieserver (~9 million)
2. Enriches with energy labels from RVO
3. Joins with BAG building data
4. Outputs split by postal code prefix to data/public/

Output structure:
    data/public/
        properties/
            properties_1xxx.parquet
            properties_2xxx.parquet
            ...
        energielabels/
            energielabels_1xxx.parquet
            ...

Usage:
    # Download addresses only
    python build_full_dataset.py download-addresses

    # Build properties from existing data
    python build_full_dataset.py build-properties

    # Full pipeline
    python build_full_dataset.py full

    # Process specific postal prefix
    python build_full_dataset.py download-addresses --prefix 9
"""

import json
import sys
import io
from pathlib import Path
from typing import Optional
from datetime import datetime
import time

import click
import httpx
import polars as pl
from tqdm import tqdm

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
PUBLIC_DIR = DATA_DIR / "public"
CHECKPOINT_DIR = DATA_DIR / "checkpoints"

# Dutch postal code prefixes
POSTAL_PREFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

# PDOK Locatieserver API
LOCATIESERVER_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


def load_checkpoint(name: str) -> dict:
    """Load checkpoint file."""
    checkpoint_path = CHECKPOINT_DIR / f"{name}.json"
    if checkpoint_path.exists():
        with open(checkpoint_path, "r") as f:
            return json.load(f)
    return {}


def save_checkpoint(name: str, data: dict):
    """Save checkpoint file."""
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint_path = CHECKPOINT_DIR / f"{name}.json"
    data["last_updated"] = datetime.now().isoformat()
    with open(checkpoint_path, "w") as f:
        json.dump(data, f, indent=2)


def get_postal_prefix(postal_code: str) -> str:
    """Get first digit of postal code."""
    if postal_code and len(postal_code) >= 1:
        return postal_code[0]
    return "0"


@click.group()
def cli():
    """Build complete Netherlands property dataset."""
    pass


@cli.command()
@click.option("--prefix", type=str, default=None, help="Only process this prefix (1-9)")
@click.option("--resume/--no-resume", default=True, help="Resume from checkpoint")
@click.option("--rate-limit", type=float, default=10.0, help="Requests per second")
def download_addresses(prefix: Optional[str], resume: bool, rate_limit: float):
    """
    Download ALL addresses from PDOK Locatieserver.

    Downloads ~9 million addresses, saves directly split by postal prefix.
    """
    click.echo("=" * 70)
    click.echo("DOWNLOADING ALL NETHERLANDS ADDRESSES")
    click.echo("=" * 70)

    output_dir = PUBLIC_DIR / "addresses"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load checkpoint
    checkpoint = load_checkpoint("address_download") if resume else {}
    completed_codes = set(checkpoint.get("completed_postal_codes", []))

    # Determine which prefixes to process
    prefixes_to_process = [prefix] if prefix else POSTAL_PREFIXES

    # Track progress per prefix
    prefix_stats = checkpoint.get("prefix_stats", {p: {"count": 0} for p in POSTAL_PREFIXES})

    client = httpx.Client(timeout=30)
    delay = 1.0 / rate_limit

    try:
        for current_prefix in prefixes_to_process:
            click.echo(f"\nProcessing prefix {current_prefix}xxx...")

            # All 4-digit codes starting with this prefix
            codes_to_process = [
                f"{current_prefix}{i:03d}"
                for i in range(0, 1000)
                if f"{current_prefix}{i:03d}" not in completed_codes
            ]

            if not codes_to_process:
                click.echo(f"  Already completed {current_prefix}xxx")
                continue

            click.echo(f"  {len(codes_to_process)} postal codes to process")

            addresses_batch = []
            batch_size = 5000

            with tqdm(codes_to_process, desc=f"{current_prefix}xxx") as pbar:
                for postal_code_4digit in pbar:
                    # Query all addresses for this 4-digit code
                    start = 0
                    rows = 100

                    while True:
                        try:
                            params = {
                                "q": postal_code_4digit,
                                "fq": f"postcode:{postal_code_4digit}* AND type:adres",
                                "rows": rows,
                                "start": start,
                                "fl": "id,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,gemeentenaam,provincienaam,centroide_ll"
                            }

                            response = client.get(LOCATIESERVER_URL, params=params)
                            response.raise_for_status()
                            data = response.json()

                            docs = data.get("response", {}).get("docs", [])
                            if not docs:
                                break

                            for doc in docs:
                                # Parse coordinates from POINT(lon lat) format
                                centroide = doc.get("centroide_ll", "")
                                lat, lon = None, None
                                if centroide and centroide.startswith("POINT("):
                                    try:
                                        coords = centroide.replace("POINT(", "").replace(")", "").strip()
                                        parts = coords.split()
                                        if len(parts) == 2:
                                            lon = float(parts[0])
                                            lat = float(parts[1])
                                    except:
                                        pass

                                addresses_batch.append({
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
                                })

                            start += rows
                            num_found = data.get("response", {}).get("numFound", 0)
                            if start >= num_found:
                                break

                            time.sleep(delay)

                        except Exception as e:
                            click.echo(f"\n  Error for {postal_code_4digit}: {e}")
                            break

                    completed_codes.add(postal_code_4digit)

                    # Save batch periodically
                    if len(addresses_batch) >= batch_size:
                        _save_addresses_batch(addresses_batch, output_dir)
                        prefix_stats[current_prefix]["count"] = prefix_stats.get(current_prefix, {}).get("count", 0) + len(addresses_batch)

                        checkpoint["completed_postal_codes"] = list(completed_codes)
                        checkpoint["prefix_stats"] = prefix_stats
                        save_checkpoint("address_download", checkpoint)

                        pbar.set_postfix({"saved": prefix_stats[current_prefix]["count"]})
                        addresses_batch = []

            # Save remaining batch for this prefix
            if addresses_batch:
                _save_addresses_batch(addresses_batch, output_dir)
                prefix_stats[current_prefix]["count"] = prefix_stats.get(current_prefix, {}).get("count", 0) + len(addresses_batch)

                checkpoint["completed_postal_codes"] = list(completed_codes)
                checkpoint["prefix_stats"] = prefix_stats
                save_checkpoint("address_download", checkpoint)

    finally:
        client.close()

    # Show summary
    click.echo("\n" + "=" * 70)
    click.echo("DOWNLOAD COMPLETE")
    click.echo("=" * 70)
    _show_output_stats(output_dir, "addresses")


def _save_addresses_batch(addresses: list, output_dir: Path):
    """Save a batch of addresses, appending to existing files by prefix."""
    if not addresses:
        return

    # Group by prefix
    by_prefix = {}
    for addr in addresses:
        prefix = get_postal_prefix(addr.get("postal_code", ""))
        if prefix not in by_prefix:
            by_prefix[prefix] = []
        by_prefix[prefix].append(addr)

    # Append to each file
    for prefix, records in by_prefix.items():
        if not records:
            continue

        output_path = output_dir / f"addresses_{prefix}xxx.parquet"
        new_df = pl.DataFrame(records)

        if output_path.exists():
            existing_df = pl.read_parquet(output_path)
            combined_df = pl.concat([existing_df, new_df], how="vertical_relaxed")
            combined_df.write_parquet(output_path, compression="snappy")
        else:
            new_df.write_parquet(output_path, compression="snappy")


@cli.command()
@click.option("--prefix", type=str, default=None, help="Only process this prefix (1-9)")
def build_properties(prefix: Optional[str]):
    """
    Build properties dataset by joining addresses with energy labels and BAG data.
    """
    click.echo("=" * 70)
    click.echo("BUILDING PROPERTIES DATASET")
    click.echo("=" * 70)

    addresses_dir = PUBLIC_DIR / "addresses"
    energielabels_dir = PUBLIC_DIR / "energielabels"
    output_dir = PUBLIC_DIR / "properties"
    output_dir.mkdir(parents=True, exist_ok=True)

    prefixes_to_process = [prefix] if prefix else POSTAL_PREFIXES

    for current_prefix in prefixes_to_process:
        click.echo(f"\nProcessing {current_prefix}xxx...")

        addr_file = addresses_dir / f"addresses_{current_prefix}xxx.parquet"
        energy_file = energielabels_dir / f"energielabels_{current_prefix}xxx.parquet"
        output_file = output_dir / f"properties_{current_prefix}xxx.parquet"

        if not addr_file.exists():
            click.echo(f"  Skipping - no addresses file")
            continue

        # Load addresses
        addresses = pl.read_parquet(addr_file)
        click.echo(f"  Loaded {len(addresses):,} addresses")

        # Join with energy labels if available
        if energy_file.exists():
            energy = pl.read_parquet(energy_file)
            click.echo(f"  Joining with {len(energy):,} energy labels")

            # Create join key
            addresses = addresses.with_columns([
                (pl.col("postal_code").cast(str) + "_" +
                 pl.col("house_number").cast(str) + "_" +
                 pl.col("house_letter").fill_null("")).alias("join_key")
            ])

            energy = energy.with_columns([
                (pl.col("postal_code").cast(str) + "_" +
                 pl.col("house_number").cast(str) + "_" +
                 pl.col("house_letter").fill_null("")).alias("join_key")
            ])

            # Select relevant energy columns
            energy_cols = ["join_key", "energy_label", "energy_label_numeric",
                          "energy_index", "building_year", "surface_area_m2",
                          "building_type", "registration_date"]
            energy_subset = energy.select([c for c in energy_cols if c in energy.columns])

            # Left join
            properties = addresses.join(
                energy_subset,
                on="join_key",
                how="left",
                suffix="_energy"
            ).drop("join_key")

            # Use energy data for building_year and surface_area if available
            if "building_year" in properties.columns and "building_year_energy" in properties.columns:
                properties = properties.with_columns([
                    pl.coalesce(["building_year", "building_year_energy"]).alias("building_year")
                ]).drop("building_year_energy")

            if "surface_area_m2" in properties.columns and "surface_area_m2_energy" in properties.columns:
                properties = properties.with_columns([
                    pl.coalesce(["surface_area_m2", "surface_area_m2_energy"]).alias("surface_area_m2")
                ]).drop("surface_area_m2_energy")

        else:
            properties = addresses
            click.echo("  No energy labels file - using addresses only")

        # Save
        properties.write_parquet(output_file, compression="snappy")
        size_mb = output_file.stat().st_size / (1024 * 1024)
        click.echo(f"  Saved {len(properties):,} properties ({size_mb:.2f} MB)")

    click.echo("\n" + "=" * 70)
    click.echo("BUILD COMPLETE")
    click.echo("=" * 70)
    _show_output_stats(output_dir, "properties")


@cli.command()
@click.option("--prefix", type=str, default=None, help="Only process this prefix (1-9)")
@click.option("--rate-limit", type=float, default=10.0, help="Requests per second for downloads")
def full(prefix: Optional[str], rate_limit: float):
    """
    Run full pipeline: download addresses, then build properties.
    """
    click.echo("=" * 70)
    click.echo("FULL PIPELINE")
    click.echo("=" * 70)

    # Step 1: Download addresses
    ctx = click.Context(download_addresses)
    ctx.invoke(download_addresses, prefix=prefix, resume=True, rate_limit=rate_limit)

    # Step 2: Build properties
    ctx = click.Context(build_properties)
    ctx.invoke(build_properties, prefix=prefix)


@cli.command()
def stats():
    """Show statistics for all output files."""
    click.echo("=" * 70)
    click.echo("OUTPUT STATISTICS")
    click.echo("=" * 70)

    for dataset in ["addresses", "properties", "energielabels", "woz"]:
        output_dir = PUBLIC_DIR / dataset
        if output_dir.exists():
            click.echo(f"\n{dataset.upper()}:")
            _show_output_stats(output_dir, dataset)


def _show_output_stats(output_dir: Path, dataset_name: str):
    """Show statistics for output files."""
    total_records = 0
    total_size = 0

    for prefix in POSTAL_PREFIXES:
        output_path = output_dir / f"{dataset_name}_{prefix}xxx.parquet"
        if output_path.exists():
            try:
                df = pl.scan_parquet(output_path)
                count = df.select(pl.len()).collect().item()
                size_mb = output_path.stat().st_size / (1024 * 1024)
                total_records += count
                total_size += size_mb
                click.echo(f"  {prefix}xxx: {count:>10,} records ({size_mb:>6.2f} MB)")
            except Exception as e:
                click.echo(f"  {prefix}xxx: Error reading - {e}")

    if total_records > 0:
        click.echo(f"  {'TOTAL':>5}: {total_records:>10,} records ({total_size:>6.1f} MB)")


@cli.command()
@click.option("--prefix", type=str, default=None, help="Only dedupe this prefix (1-9)")
def dedupe(prefix: Optional[str]):
    """Remove duplicate records from output files."""
    click.echo("=" * 70)
    click.echo("DEDUPLICATING FILES")
    click.echo("=" * 70)

    prefixes_to_process = [prefix] if prefix else POSTAL_PREFIXES

    for dataset in ["addresses", "properties"]:
        output_dir = PUBLIC_DIR / dataset
        if not output_dir.exists():
            continue

        click.echo(f"\n{dataset.upper()}:")

        for current_prefix in prefixes_to_process:
            output_path = output_dir / f"{dataset}_{current_prefix}xxx.parquet"
            if not output_path.exists():
                continue

            df = pl.read_parquet(output_path)
            before = len(df)

            # Dedupe by postal_code + house_number + house_letter
            df = df.unique(subset=["postal_code", "house_number", "house_letter"], keep="last")

            after = len(df)
            if before != after:
                df.write_parquet(output_path, compression="snappy")
                click.echo(f"  {current_prefix}xxx: {before:,} -> {after:,} (removed {before - after:,} dupes)")
            else:
                click.echo(f"  {current_prefix}xxx: {after:,} (no dupes)")


if __name__ == "__main__":
    cli()
