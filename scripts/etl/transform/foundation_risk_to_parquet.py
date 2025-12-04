"""
Transform Foundation Risk JSON to optimized Parquet format.

Converts foundation risk assessment data from JSON to Parquet for efficient querying.
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
    default="../../data/raw/foundation_risk.json",
    help="Input JSON file with foundation risk data"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/foundation_risk.parquet",
    help="Output Parquet file"
)
def main(input: str, output: str):
    """
    Transform Foundation Risk JSON to Parquet format.

    Foundation risk is critical for property assessment in the Netherlands,
    especially in areas with soil subsidence.

    Optimizations:
    - Converts to columnar format (faster queries)
    - Compresses data (60-80% size reduction)
    - Optimizes data types for memory efficiency

    Examples:
        python -m transform.foundation_risk_to_parquet
    """
    log.info("=== Foundation Risk JSON → Parquet Transformation ===")

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
        records = data.get("data", data.get("features", []))
    else:
        records = []

    log.info(f"Loaded {len(records)} foundation risk records")

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
        "postcode": "postal_code",
        "risico": "risk_level",
        "funderingstype": "foundation_type",
    }

    for old_name, new_name in column_mapping.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename({old_name: new_name})

    # Optimize data types
    log.info("Optimizing data types...")

    # String columns
    string_cols = ["postal_code", "risk_level", "foundation_type", "municipality", "province"]
    for col in string_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Utf8))
            except:
                pass

    # Float columns (coordinates)
    float_cols = ["latitude", "longitude"]
    for col in float_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
            except:
                pass

    # Remove rows with null coordinates (if coordinate columns exist)
    if "latitude" in df.columns and "longitude" in df.columns:
        before_count = len(df)
        df = df.filter(
            pl.col("latitude").is_not_null() &
            pl.col("longitude").is_not_null()
        )
        after_count = len(df)
        removed = before_count - after_count
        if removed > 0:
            log.info(f"Removed {removed} records with missing coordinates")

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
    if "risk_level" in df.columns:
        risk_distribution = df.group_by("risk_level").agg(pl.count()).sort("count", descending=True)
        log.info("Risk level distribution:")
        log.info(risk_distribution)

    if "foundation_type" in df.columns:
        foundation_types = df.group_by("foundation_type").agg(pl.count()).sort("count", descending=True)
        log.info("\nFoundation type distribution:")
        log.info(foundation_types)

    log.info("\n=== Example Queries ===")
    log.info("# Load data:")
    log.info(f'df = pl.read_parquet("{output_path}")')
    log.info("")
    log.info("# Find high-risk areas:")
    log.info('high_risk = df.filter(pl.col("risk_level").is_in(["hoog", "zeer hoog"]))')
    log.info("")
    log.info("# Find by postal code:")
    log.info('area = df.filter(pl.col("postal_code") == "1012AB")')


if __name__ == "__main__":
    main()
