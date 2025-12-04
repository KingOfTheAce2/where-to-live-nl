"""
Transform Netherlands Addresses JSON to optimized Parquet format.

Converts BAG address data with coordinates from JSON to Parquet for efficient querying.
"""

import json
from pathlib import Path
import click
import polars as pl

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log


@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/netherlands_all_addresses_with_coords.json",
    help="Input JSON file with address data"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/addresses.parquet",
    help="Output Parquet file"
)
def main(input: str, output: str):
    """
    Transform Netherlands Addresses JSON to Parquet format.

    This is the main dataset with all Dutch addresses including coordinates.

    Optimizations:
    - Converts to columnar format (faster spatial queries)
    - Compresses data (70-80% size reduction)
    - Optimizes data types for memory efficiency

    Examples:
        python -m transform.addresses_to_parquet
    """
    log.info("=== Netherlands Addresses JSON → Parquet Transformation ===")

    # Load JSON data
    input_path = Path(input)
    log.info(f"Reading {input_path}...")
    log.info(f"File size: {input_path.stat().st_size / 1024 / 1024:.1f} MB")

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Handle both array and object with 'data' key
    if isinstance(data, list):
        records = data
    else:
        records = data.get("data", data.get("addresses", []))

    log.info(f"Loaded {len(records)} addresses")

    if not records:
        log.error("No records found in input file!")
        return

    # Create Polars DataFrame
    log.info("Creating Polars DataFrame...")
    # Use infer_schema_length=None to scan all rows for proper schema inference
    df = pl.DataFrame(records, infer_schema_length=None)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns: {df.columns}")

    # Show sample
    log.info("\n=== Sample Data ===")
    log.info(df.head(3))

    # Data cleaning and optimization
    log.info("\n=== Data Optimization ===")

    # Rename columns for consistency
    column_mapping = {
        "postcode": "postal_code",
        "woonplaats": "city",
        "straatnaam": "street",
        "huisnummer": "house_number",
        "huisletter": "house_letter",
        "toevoeging": "addition",
        "provinice": "province",  # Fix typo if exists
        "provincie": "province",
        "gemeente": "municipality",
        "lat": "latitude",
        "lon": "longitude",
        "latitude": "latitude",
        "longitude": "longitude",
    }

    for old_name, new_name in column_mapping.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename({old_name: new_name})

    # Optimize data types
    log.info("Optimizing data types...")

    # String columns
    string_cols = ["postal_code", "city", "street", "house_letter", "addition", "province", "municipality"]
    for col in string_cols:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Utf8))

    # Integer columns
    int_cols = ["house_number"]
    for col in int_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Int32))
            except:
                log.warning(f"Could not convert {col} to Int32")

    # Float columns (coordinates)
    float_cols = ["latitude", "longitude"]
    for col in float_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
            except:
                log.warning(f"Could not convert {col} to Float64")

    # Remove rows with null coordinates
    if "latitude" in df.columns and "longitude" in df.columns:
        before_count = len(df)
        df = df.filter(
            pl.col("latitude").is_not_null() &
            pl.col("longitude").is_not_null() &
            (pl.col("latitude") != 0) &
            (pl.col("longitude") != 0)
        )
        after_count = len(df)
        removed = before_count - after_count
        if removed > 0:
            log.info(f"Removed {removed} addresses with missing/invalid coordinates")

    # Save to Parquet
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    log.info(f"\nSaving to {output_path}...")

    df.write_parquet(
        output_path,
        compression="snappy",
        statistics=True,
        use_pyarrow=True
    )

    # Show results
    input_size = input_path.stat().st_size / 1024 / 1024
    output_size = output_path.stat().st_size / 1024 / 1024
    compression_ratio = (1 - output_size / input_size) * 100

    log.success(f"\n=== Transformation Complete ===")
    log.info(f"Input size: {input_size:.1f} MB (JSON)")
    log.info(f"Output size: {output_size:.1f} MB (Parquet)")
    log.info(f"Compression: {compression_ratio:.1f}% smaller")
    log.info(f"Records: {len(df):,}")

    # Statistics
    log.info("\n=== Data Statistics ===")
    if "latitude" in df.columns and "longitude" in df.columns:
        log.info("Coordinate ranges:")
        log.info(f"Latitude: {df['latitude'].min():.6f} to {df['latitude'].max():.6f}")
        log.info(f"Longitude: {df['longitude'].min():.6f} to {df['longitude'].max():.6f}")

    if "province" in df.columns:
        log.info("\nAddresses by province:")
        province_counts = df.group_by("province").agg(pl.count()).sort("count", descending=True)
        log.info(province_counts.head(12))

    log.info("\n=== Example Queries ===")
    log.info("# Load data:")
    log.info(f'df = pl.read_parquet("{output_path}")')
    log.info("")
    log.info("# Find address by postal code:")
    log.info('address = df.filter(pl.col("postal_code") == "1012JS")')
    log.info("")
    log.info("# Find addresses in city:")
    log.info('amsterdam = df.filter(pl.col("city") == "Amsterdam")')
    log.info("")
    log.info("# Spatial query (bounding box):")
    log.info('in_area = df.filter((pl.col("latitude").is_between(52.3, 52.4)) & (pl.col("longitude").is_between(4.8, 4.9)))')


if __name__ == "__main__":
    main()
