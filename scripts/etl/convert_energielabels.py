"""
Convert EP-Online energy labels CSV to Parquet and merge with properties.

This script:
1. Reads the 1.5GB CSV file
2. Converts to Parquet format (compressed)
3. Merges with properties.parquet based on postal_code + house_number
"""

import polars as pl
import pandas as pd
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
CSV_FILE = DATA_DIR / "raw" / "energielabels_raw.csv"
ENERGIELABEL_PARQUET = DATA_DIR / "processed" / "energielabels.parquet"
PROPERTIES_FILE = DATA_DIR / "processed" / "properties.parquet"

def main():
    import sys
    import io

    # Fix Windows console encoding
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🏷️  EP-Online Energy Labels Converter")
    print("=" * 60)

    # Step 1: Read CSV
    print(f"\n📂 Step 1: Reading CSV file (1.5 GB)...")
    print(f"   File: {CSV_FILE}")

    if not CSV_FILE.exists():
        print(f"❌ CSV file not found: {CSV_FILE}")
        return

    # Read CSV with Polars (much faster than Pandas)
    # First 2 rows are metadata, actual data starts at row 3
    # Use latin1 encoding which accepts all byte values
    try:
        df = pl.read_csv(
            CSV_FILE,
            separator=';',
            skip_rows=2,  # Skip metadata rows
            encoding='utf-8',
            ignore_errors=True,
            null_values=['', 'NULL', 'null']
        )
    except Exception as e:
        print(f"⚠️  UTF-8 failed, trying with latin1 encoding...")
        df = pl.read_csv(
            CSV_FILE,
            separator=';',
            skip_rows=2,
            encoding='latin1',  # Accepts all byte values
            ignore_errors=True,
            null_values=['', 'NULL', 'null']
        )

    print(f"✅ Loaded {df.height:,} energy label records")
    print(f"\n📋 Columns: {df.columns[:10]}...")

    # Step 2: Clean and standardize
    print("\n🔧 Step 2: Cleaning and standardizing data...")

    # Rename columns to English
    column_mapping = {
        "Postcode": "postal_code",
        "Huisnummer": "house_number",
        "Huisletter": "house_letter",
        "Huisnummertoevoeging": "house_addition",
        "BAGVerblijfsobjectID": "bag_id",
        "Energieklasse": "energy_label",
        "Registratiedatum": "registration_date",
        "GeldigTot": "valid_until",
        "Gebouwtype": "building_type",
        "Gebouwklasse": "building_class",
        "Bouwjaar": "building_year",
        "GebruiksoppervlakteThermischeZone": "surface_area_m2",
        "EnergieIndex": "energy_index",
        "Status": "status"
    }

    # Rename columns
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns:
            df = df.rename({old_name: new_name})

    # Select relevant columns
    columns_to_keep = [
        'postal_code', 'house_number', 'house_letter', 'house_addition',
        'bag_id', 'energy_label', 'registration_date', 'valid_until',
        'building_type', 'building_class', 'building_year',
        'surface_area_m2', 'energy_index', 'status'
    ]

    # Filter to only columns that exist
    columns_to_keep = [col for col in columns_to_keep if col in df.columns]
    df = df.select(columns_to_keep)

    # Clean postal codes (remove spaces, uppercase)
    if "postal_code" in df.columns:
        df = df.with_columns([
            pl.col("postal_code").str.replace_all(" ", "").str.to_uppercase()
        ])

    # Add numeric energy label for sorting/filtering
    label_map = {
        "A+++++": 1, "A++++": 2, "A+++": 3, "A++": 4, "A+": 5, "A": 6,
        "B": 7, "C": 8, "D": 9, "E": 10, "F": 11, "G": 12
    }

    if "energy_label" in df.columns:
        df = df.with_columns([
            pl.col("energy_label").replace(label_map, default=99).alias("energy_label_numeric")
        ])

    # Cast house_number to Int32
    if "house_number" in df.columns:
        df = df.with_columns([
            pl.col("house_number").cast(pl.Int32, strict=False)
        ])

    # Filter to only active labels (Status = "Bestaand")
    if "status" in df.columns:
        print(f"   Before status filter: {df.height:,} records")
        df = df.filter(pl.col("status") == "Bestaand")
        print(f"   After status filter: {df.height:,} records")

    print(f"✅ Cleaned data")

    # Step 3: Save to Parquet
    print("\n💾 Step 3: Saving to Parquet...")

    df.write_parquet(
        ENERGIELABEL_PARQUET,
        compression="snappy"
    )

    file_size_mb = ENERGIELABEL_PARQUET.stat().st_size / (1024 * 1024)
    print(f"✅ Saved to: {ENERGIELABEL_PARQUET}")
    print(f"📦 File size: {file_size_mb:.1f} MB (compressed from 1.5 GB)")
    print(f"📊 Total records: {df.height:,}")

    # Show energy label distribution
    if "energy_label" in df.columns:
        print("\n📊 Energy Label Distribution:")
        label_counts = df.group_by("energy_label").count().sort("energy_label")
        for row in label_counts.head(15).iter_rows(named=True):
            print(f"  {row['energy_label']}: {row['count']:,}")

    # Step 4: Merge with properties.parquet
    print("\n🔗 Step 4: Merging with properties.parquet...")

    if not PROPERTIES_FILE.exists():
        print(f"⚠️  Properties file not found: {PROPERTIES_FILE}")
        print("Run merge_bag_with_addresses.py first to create properties.parquet")
        return

    properties_df = pl.read_parquet(PROPERTIES_FILE)
    print(f"✅ Loaded {len(properties_df):,} properties")

    # Merge based on postal_code + house_number + house_letter + house_addition
    # Use left join to keep all properties, add energy labels where available
    enriched_df = properties_df.join(
        df.select([
            'postal_code', 'house_number', 'house_letter', 'house_addition',
            'energy_label', 'energy_label_numeric', 'energy_index',
            'bag_id', 'building_year', 'building_type'
        ]),
        on=['postal_code', 'house_number', 'house_letter', 'house_addition'],
        how='left',
        suffix='_energielabel'
    )

    # Update properties columns with energy label data where available
    if 'energy_label_energielabel' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('energy_label'), pl.col('energy_label_energielabel')]).alias('energy_label')
        ])

    if 'building_year_energielabel' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('building_year'), pl.col('building_year_energielabel')]).alias('building_year')
        ])

    if 'building_type_energielabel' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('building_type'), pl.col('building_type_energielabel')]).alias('building_type')
        ])

    # Add energy_label_numeric if it doesn't exist
    if 'energy_label_numeric' not in enriched_df.columns and 'energy_label_numeric' in df.columns:
        enriched_df = enriched_df.with_columns([
            pl.col('energy_label_numeric')
        ])

    # Add energy_index if it doesn't exist
    if 'energy_index' not in enriched_df.columns and 'energy_index' in df.columns:
        enriched_df = enriched_df.with_columns([
            pl.col('energy_index')
        ])

    # Drop duplicate columns
    enriched_df = enriched_df.select([
        col for col in enriched_df.columns
        if not col.endswith('_energielabel')
    ])

    # Show statistics
    print(f"\n📊 Enriched Properties Statistics:")
    print(f"  Total properties: {len(enriched_df):,}")
    print(f"  With energy labels: {enriched_df.filter(pl.col('energy_label').is_not_null()).height:,}")
    print(f"  With building year: {enriched_df.filter(pl.col('building_year').is_not_null()).height:,}")

    # Save enriched properties
    enriched_df.write_parquet(PROPERTIES_FILE, compression='snappy')

    file_size_mb = PROPERTIES_FILE.stat().st_size / (1024 * 1024)
    print(f"\n✅ Updated properties.parquet")
    print(f"📦 File size: {file_size_mb:.1f} MB")

    # Show sample
    print("\n📋 Sample Enriched Properties:")
    print(enriched_df.select([
        'postal_code', 'house_number', 'city',
        'energy_label', 'building_year', 'surface_area_m2'
    ]).head(10))

    print("\n" + "=" * 60)
    print("✅ Energy labels successfully converted and merged!")
    print("=" * 60)


if __name__ == "__main__":
    main()
