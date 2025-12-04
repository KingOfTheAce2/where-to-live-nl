"""
Create minimal properties.parquet as a starting point.

This creates a basic structure that can be enriched later with:
- BAG building details
- Energy labels
- Building year
etc.

For now it's just addresses with placeholders for property data.
"""

import polars as pl
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
ADDRESSES_FILE = DATA_DIR / "processed" / "addresses.parquet"
OUTPUT_FILE = DATA_DIR / "processed" / "properties.parquet"


def main():
    import sys
    import io

    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🏠 Creating Minimal Properties Dataset")
    print("=" * 60)

    # Load addresses
    print(f"📂 Loading {ADDRESSES_FILE}")
    df = pl.read_parquet(ADDRESSES_FILE)

    print(f"✅ Loaded {len(df):,} addresses")

    # Add placeholder columns for property details
    # These will be filled in later when we have the data
    df = df.with_columns([
        pl.lit(None, dtype=pl.Int32).alias("surface_area_m2"),
        pl.lit(None, dtype=pl.Int32).alias("building_year"),
        pl.lit(None, dtype=pl.Utf8).alias("building_type"),
        pl.lit(None, dtype=pl.Int32).alias("num_rooms"),
        pl.lit(None, dtype=pl.Utf8).alias("energy_label"),
        pl.lit(None, dtype=pl.Boolean).alias("monument"),
        pl.lit(None, dtype=pl.Utf8).alias("status"),
    ])

    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUTPUT_FILE, compression='snappy')

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)

    print(f"\n✅ Created properties.parquet")
    print(f"📦 File size: {file_size_mb:.2f} MB")
    print(f"📊 Records: {len(df):,}")

    print("\n📋 Schema:")
    print(df.schema)

    print("\n📝 Sample (first 3 rows):")
    print(df.select([
        'postal_code', 'house_number', 'city',
        'surface_area_m2', 'building_year', 'energy_label'
    ]).head(3))

    print("\n" + "=" * 60)
    print("✅ Minimal properties dataset created!")
    print("\nThis is a placeholder dataset. To enrich it:")
    print("1. Run BAG ingestion for building details")
    print("2. Run EP-Online ingestion for energy labels")
    print("3. Merge the data together")
    print("=" * 60)


if __name__ == "__main__":
    main()
