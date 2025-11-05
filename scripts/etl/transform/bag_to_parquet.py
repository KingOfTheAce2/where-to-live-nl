"""
Transform BAG JSON data to optimized Parquet format.

Performs:
- Data cleaning (remove invalid coordinates)
- Type conversions (strings to categorical)
- Column standardization
- Compression (Snappy)
"""

import json
from pathlib import Path
from typing import Optional
import click
import polars as pl

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

def clean_bag_data(df: pl.DataFrame) -> pl.DataFrame:
    """
    Clean and validate BAG data.

    Args:
        df: Input DataFrame

    Returns:
        Cleaned DataFrame
    """
    log.info("Cleaning BAG data...")

    original_rows = len(df)

    # Remove rows with invalid coordinates
    df = df.filter(
        (pl.col("latitude").is_not_null()) &
        (pl.col("longitude").is_not_null()) &
        (pl.col("latitude").is_between(-90, 90)) &
        (pl.col("longitude").is_between(-180, 180))
    )

    removed_rows = original_rows - len(df)
    if removed_rows > 0:
        log.warning(f"Removed {removed_rows} rows with invalid coordinates")

    # Remove rows with missing essential fields
    df = df.filter(
        (pl.col("postal_code").is_not_null()) &
        (pl.col("city").is_not_null())
    )

    # Standardize postal codes (remove spaces, uppercase)
    df = df.with_columns(
        pl.col("postal_code").str.replace_all(" ", "").str.to_uppercase()
    )

    # Convert categorical columns for better compression
    categorical_cols = ["province", "municipality", "city", "status"]
    for col in categorical_cols:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Categorical))

    log.success(f"Cleaned data: {len(df)} rows remaining")
    return df

def add_spatial_index_columns(df: pl.DataFrame) -> pl.DataFrame:
    """
    Add columns for spatial indexing (for faster geo queries).

    Creates:
    - geohash: Approximate location (for quick filtering)
    - lat_grid: Latitude grid cell (100x100m)
    - lon_grid: Longitude grid cell (100x100m)

    Args:
        df: Input DataFrame

    Returns:
        DataFrame with spatial index columns
    """
    log.info("Adding spatial index columns...")

    # Simple grid-based indexing (can be replaced with proper geohash)
    # 100m grid cells at Netherlands latitude ≈ 0.001° lat, 0.0015° lon
    df = df.with_columns([
        (pl.col("latitude") * 1000).cast(pl.Int32).alias("lat_grid"),
        (pl.col("longitude") * 1000).cast(pl.Int32).alias("lon_grid")
    ])

    return df

@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/bag.json",
    help="Input BAG JSON file"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/bag-addresses.parquet",
    help="Output Parquet file"
)
@click.option(
    "--compression",
    type=click.Choice(["snappy", "gzip", "lz4", "zstd"]),
    default="snappy",
    help="Compression algorithm"
)
def main(input: str, output: str, compression: str):
    """
    Transform BAG JSON to optimized Parquet format.

    Example:
        python -m transform.bag_to_parquet
    """
    log.info("=== BAG to Parquet Transformation ===")

    input_path = Path(input)
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load JSON
    log.info(f"Loading {input_path}...")
    with open(input_path, "r") as f:
        data = json.load(f)

    log.info(f"Loaded {len(data)} addresses")

    # Convert to Polars DataFrame
    df = pl.DataFrame(data)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns: {df.columns}")

    # Clean data
    df = clean_bag_data(df)

    # Add spatial indexes
    df = add_spatial_index_columns(df)

    # Optimize data types
    log.info("Optimizing data types...")

    # Convert integer columns
    int_cols = ["house_number", "lat_grid", "lon_grid"]
    for col in int_cols:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Int32))

    # Convert float columns
    float_cols = ["latitude", "longitude"]
    for col in float_cols:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Float64))

    # Write to Parquet
    log.info(f"Writing Parquet file with {compression} compression...")

    df.write_parquet(
        output_path,
        compression=compression,
        statistics=True,  # Include column statistics for faster queries
        use_pyarrow=True
    )

    # Show file size comparison
    input_size_mb = input_path.stat().st_size / 1024 / 1024
    output_size_mb = output_path.stat().st_size / 1024 / 1024
    reduction = (1 - output_size_mb / input_size_mb) * 100

    log.success(f"Saved to {output_path}")
    log.info(f"Input size: {input_size_mb:.1f} MB")
    log.info(f"Output size: {output_size_mb:.1f} MB")
    log.info(f"Size reduction: {reduction:.1f}%")

    # Show schema
    log.info("\nOutput schema:")
    print(df.schema)

    # Show sample
    log.info("\nSample data (first 5 rows):")
    print(df.head(5))

if __name__ == "__main__":
    main()
