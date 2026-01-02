#!/usr/bin/env python3
"""
Split large parquet files by postal code prefix for GitHub upload.

Dutch postal codes start with 1-9 (no 0xxx codes exist).
This splits files into 9 parts, keeping each under GitHub's 100MB limit.

Output structure:
    data/public/
        energielabels/
            energielabels_1xxx.parquet  (~4MB)
            energielabels_2xxx.parquet
            ...
        properties/
            properties_1xxx.parquet
            properties_2xxx.parquet
            ...
        addresses/
            addresses_1xxx.parquet
            ...

Usage:
    python scripts/etl/transform/split_data_by_postal_code.py
    python scripts/etl/transform/split_data_by_postal_code.py --dataset energielabels
    python scripts/etl/transform/split_data_by_postal_code.py --dataset all
"""

import sys
import io
import argparse
from pathlib import Path
from typing import Optional

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    import polars as pl
except ImportError:
    print("Error: polars is required. Install with: pip install polars")
    sys.exit(1)

# Paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
PROCESSED_DIR = DATA_DIR / "processed"
PUBLIC_DIR = DATA_DIR / "public"

# Dataset configurations
DATASETS = {
    'energielabels': {
        'source': PROCESSED_DIR / 'energielabels.parquet',
        'output_dir': PUBLIC_DIR / 'energielabels',
        'postal_col': 'postal_code',
        'description': 'Energy labels for buildings'
    },
    'properties': {
        'source': PROCESSED_DIR / 'properties.parquet',
        'output_dir': PUBLIC_DIR / 'properties',
        'postal_col': 'postal_code',
        'description': 'Property details from BAG'
    },
    'addresses': {
        'source': PROCESSED_DIR / 'addresses.parquet',
        'output_dir': PUBLIC_DIR / 'addresses',
        'postal_col': 'postal_code',
        'description': 'All Netherlands addresses'
    },
    'woz': {
        'source': PROCESSED_DIR / 'woz-netherlands-complete.parquet',
        'output_dir': PUBLIC_DIR / 'woz',
        'postal_col': 'postal_code',
        'description': 'WOZ property valuations'
    },
}

# Dutch postal code prefixes (1-9, no 0xxx exists)
POSTAL_PREFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']


def split_by_postal_prefix(
    source_file: Path,
    output_dir: Path,
    postal_col: str,
    dataset_name: str
) -> dict:
    """
    Split a parquet file by postal code prefix.

    Returns dict with statistics for each prefix.
    """
    print(f"\nProcessing {dataset_name}...")
    print(f"  Source: {source_file}")

    if not source_file.exists():
        print(f"  ERROR: Source file not found!")
        return {}

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load data lazily
    df = pl.scan_parquet(source_file)

    # Get total count
    total = df.select(pl.len()).collect().item()
    print(f"  Total records: {total:,}")

    stats = {}

    for prefix in POSTAL_PREFIXES:
        # Filter by prefix
        filtered = df.filter(
            pl.col(postal_col).cast(str).str.starts_with(prefix)
        ).collect()

        count = len(filtered)
        if count == 0:
            print(f"  {prefix}xxx: No records")
            continue

        # Save to parquet
        output_file = output_dir / f"{dataset_name}_{prefix}xxx.parquet"
        filtered.write_parquet(output_file, compression='snappy')

        # Get file size
        size_mb = output_file.stat().st_size / (1024 * 1024)

        print(f"  {prefix}xxx: {count:,} records ({size_mb:.2f} MB)")
        stats[prefix] = {'count': count, 'size_mb': size_mb}

        # Warn if file is too large for GitHub
        if size_mb > 100:
            print(f"    WARNING: File exceeds 100MB! Consider further splitting.")

    return stats


def verify_split(source_file: Path, output_dir: Path, dataset_name: str) -> bool:
    """Verify that split files contain all records from source."""
    print(f"\nVerifying {dataset_name} split...")

    # Count source records
    source_count = pl.scan_parquet(source_file).select(pl.len()).collect().item()

    # Count split records
    split_count = 0
    for f in output_dir.glob(f"{dataset_name}_*.parquet"):
        split_count += pl.scan_parquet(f).select(pl.len()).collect().item()

    match = source_count == split_count
    status = "✓" if match else "✗"
    print(f"  Source: {source_count:,} | Split total: {split_count:,} | {status}")

    return match


def main():
    parser = argparse.ArgumentParser(description='Split parquet files by postal code prefix')
    parser.add_argument(
        '--dataset', '-d',
        choices=['energielabels', 'properties', 'addresses', 'woz', 'all'],
        default='all',
        help='Which dataset to process (default: all)'
    )
    parser.add_argument(
        '--verify', '-v',
        action='store_true',
        help='Verify split completeness'
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Splitting data files by postal code prefix")
    print("=" * 60)

    datasets_to_process = (
        DATASETS.keys() if args.dataset == 'all'
        else [args.dataset]
    )

    all_stats = {}

    for name in datasets_to_process:
        config = DATASETS[name]

        if not config['source'].exists():
            print(f"\nSkipping {name}: source file not found")
            print(f"  Expected: {config['source']}")
            continue

        stats = split_by_postal_prefix(
            source_file=config['source'],
            output_dir=config['output_dir'],
            postal_col=config['postal_col'],
            dataset_name=name
        )
        all_stats[name] = stats

        if args.verify:
            verify_split(config['source'], config['output_dir'], name)

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_size = 0
    for name, stats in all_stats.items():
        if stats:
            dataset_size = sum(s['size_mb'] for s in stats.values())
            dataset_count = sum(s['count'] for s in stats.values())
            total_size += dataset_size
            print(f"  {name}: {dataset_count:,} records in {len(stats)} files ({dataset_size:.1f} MB)")

    print(f"\n  Total size: {total_size:.1f} MB")
    print(f"  Output directory: {PUBLIC_DIR}")

    # Check for files over 100MB
    large_files = []
    for name, stats in all_stats.items():
        for prefix, info in stats.items():
            if info['size_mb'] > 100:
                large_files.append(f"{name}_{prefix}xxx.parquet")

    if large_files:
        print(f"\n  WARNING: These files exceed 100MB and need further splitting:")
        for f in large_files:
            print(f"    - {f}")
    else:
        print(f"\n  ✓ All files are under 100MB - ready for GitHub!")


if __name__ == '__main__':
    main()
