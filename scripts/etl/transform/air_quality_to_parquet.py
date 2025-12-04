"""
Transform Air Quality JSON to optimized Parquet format.

Converts Luchtmeetnet air quality data from JSON to Parquet for efficient querying.
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
    default="../../data/raw/air_quality.json",
    help="Input JSON file with air quality data"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/air_quality.parquet",
    help="Output Parquet file"
)
def main(input: str, output: str):
    """
    Transform Air Quality JSON to Parquet format.

    Optimizations:
    - Converts to columnar format (faster queries)
    - Compresses data (60-80% size reduction)
    - Optimizes data types for memory efficiency

    Examples:
        python -m transform.air_quality_to_parquet
    """
    log.info("=== Air Quality JSON → Parquet Transformation ===")

    # Load JSON data
    input_path = Path(input)
    log.info(f"Reading {input_path}...")
    log.info(f"File size: {input_path.stat().st_size / 1024 / 1024:.1f} MB")

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Handle both array and object with 'data' key
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = data.get("data", data.get("stations", data.get("measurements", [])))
    else:
        records = []

    log.info(f"Loaded {len(records)} air quality records")

    if not records:
        log.error("No records found in input file!")
        return

    # Create Polars DataFrame
    log.info("Creating Polars DataFrame...")
    df = pl.DataFrame(records)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns: {df.columns}")

    # Show sample
    log.info("\n=== Sample Data ===")
    log.info(df.head(3))

    # Data cleaning and optimization
    log.info("\n=== Data Optimization ===")

    # Standardize column names
    column_mapping = {
        "lat": "latitude",
        "lon": "longitude",
        "station_name": "station",
        "location": "station",
    }

    for old_name, new_name in column_mapping.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename({old_name: new_name})

    # Optimize data types
    log.info("Optimizing data types...")

    # String columns
    string_cols = ["station", "location", "municipality", "province"]
    for col in string_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Utf8))
            except:
                pass

    # Float columns (measurements and coordinates)
    float_cols = ["latitude", "longitude", "pm10", "pm25", "no2", "o3"]
    for col in float_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
            except:
                pass

    # Remove rows with null coordinates
    if "latitude" in df.columns and "longitude" in df.columns:
        before_count = len(df)
        df = df.filter(
            pl.col("latitude").is_not_null() &
            pl.col("longitude").is_not_null()
        )
        after_count = len(df)
        removed = before_count - after_count
        if removed > 0:
            log.info(f"Removed {removed} stations with missing coordinates")

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
    measurement_cols = ["pm10", "pm25", "no2", "o3"]
    available_measurement_cols = [col for col in measurement_cols if col in df.columns]
    if available_measurement_cols:
        log.info("Measurement ranges:")
        log.info(df.select(available_measurement_cols).describe())

    log.info("\n=== Example Queries ===")
    log.info("# Load data:")
    log.info(f'df = pl.read_parquet("{output_path}")')
    log.info("")
    log.info("# Find stations with high PM2.5:")
    log.info('high_pm25 = df.filter(pl.col("pm25") > 25).sort("pm25", descending=True)')
    log.info("")
    log.info("# Spatial query (bounding box):")
    log.info('in_area = df.filter((pl.col("latitude").is_between(52.3, 52.4)) & (pl.col("longitude").is_between(4.8, 4.9)))')


if __name__ == "__main__":
    main()
