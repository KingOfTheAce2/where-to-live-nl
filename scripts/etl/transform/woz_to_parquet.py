"""
Transform WOZ JSON data to optimized Parquet format.

Handles historical WOZ data (2014-2025) from the new API-based scraper.

Performs:
- Data flattening (convert valuations array to wide format)
- Data cleaning (remove invalid entries)
- Type conversions
- Compression (Snappy)
- Privacy filtering (optional - remove personal data)
"""

import json
from pathlib import Path
from datetime import datetime
import click
import polars as pl

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

def flatten_historical_woz(data: list[dict]) -> pl.DataFrame:
    """
    Flatten historical WOZ data from nested structure to wide format.

    Input structure:
    {
        "postal_code": "1012AB",
        "house_number": 1,
        "valuations": [
            {"valuation_date": "2014-01-01", "woz_value": 400000},
            {"valuation_date": "2015-01-01", "woz_value": 420000},
            ...
        ]
    }

    Output columns:
    postal_code, house_number, woz_2014, woz_2015, ..., woz_2025

    Args:
        data: List of WOZ records with nested valuations

    Returns:
        Flattened DataFrame
    """
    log.info("Flattening historical WOZ data...")

    flattened_records = []

    for record in data:
        flat_record = {
            "postal_code": record.get("postal_code"),
            "house_number": record.get("house_number"),
            "house_letter": record.get("house_letter", ""),
            "nummeraanduiding_id": record.get("nummeraanduiding_id"),
            "scraped_at": record.get("scraped_at")
        }

        # Flatten valuations into separate columns
        valuations = record.get("valuations", [])
        for val in valuations:
            val_date = val.get("valuation_date", "")
            # Extract year from date (e.g., "2014-01-01" -> "2014")
            year = val_date.split("-")[0] if val_date else None

            if year:
                col_name = f"woz_{year}"
                flat_record[col_name] = val.get("woz_value")

        flattened_records.append(flat_record)

    df = pl.DataFrame(flattened_records)

    log.success(f"Flattened {len(df)} records")
    log.info(f"Columns: {df.columns}")

    return df

def clean_woz_data(df: pl.DataFrame) -> pl.DataFrame:
    """
    Clean and validate WOZ data.

    Args:
        df: Input DataFrame

    Returns:
        Cleaned DataFrame
    """
    log.info("Cleaning WOZ data...")

    original_rows = len(df)

    # Remove rows with missing essential fields
    df = df.filter(
        (pl.col("postal_code").is_not_null()) &
        (pl.col("house_number").is_not_null())
    )

    # Standardize postal codes (remove spaces, uppercase)
    df = df.with_columns(
        pl.col("postal_code").str.replace_all(" ", "").str.to_uppercase()
    )

    # Find WOZ value columns (woz_2014, woz_2015, etc.)
    woz_cols = [col for col in df.columns if col.startswith("woz_")]

    if woz_cols:
        # Check that at least one WOZ value exists per row
        has_value_condition = None
        for col in woz_cols:
            condition = (pl.col(col).is_not_null()) & (pl.col(col) > 0)
            has_value_condition = condition if has_value_condition is None else has_value_condition | condition

        if has_value_condition is not None:
            df = df.filter(has_value_condition)

    removed_rows = original_rows - len(df)
    if removed_rows > 0:
        log.warning(f"Removed {removed_rows} rows with invalid data")

    log.success(f"Cleaned data: {len(df)} rows remaining")
    return df

def remove_personal_data(df: pl.DataFrame) -> pl.DataFrame:
    """
    Remove any personal data columns (GDPR compliance).

    Note: WOZ values tied to addresses are generally OK,
    but owner names/birthdates should NOT be stored.

    Args:
        df: Input DataFrame

    Returns:
        DataFrame with personal data removed
    """
    log.info("Checking for personal data columns...")

    # List of columns that might contain personal data
    personal_data_cols = [
        "owner_name",
        "owner_dob",
        "owner_birthdate",
        "resident_name",
        "marital_status"
    ]

    removed_cols = []
    for col in personal_data_cols:
        if col in df.columns:
            df = df.drop(col)
            removed_cols.append(col)

    if removed_cols:
        log.warning(f"Removed personal data columns: {removed_cols}")
        log.warning("⚠️ GDPR compliance: Do not store personal information in bulk!")
    else:
        log.success("✓ No personal data columns found")

    return df

@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/woz.json",
    help="Input WOZ JSON file"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/woz-values.parquet",
    help="Output Parquet file"
)
@click.option(
    "--compression",
    type=click.Choice(["snappy", "gzip", "lz4", "zstd"]),
    default="snappy",
    help="Compression algorithm"
)
@click.option(
    "--strip-personal-data",
    is_flag=True,
    default=True,
    help="Remove personal data columns (GDPR compliance)"
)
def main(
    input: str,
    output: str,
    compression: str,
    strip_personal_data: bool
):
    """
    Transform WOZ JSON to optimized Parquet format.

    Handles historical WOZ data (2014-2025) and flattens to wide format.

    Example:
        python -m transform.woz_to_parquet
    """
    log.info("=== WOZ to Parquet Transformation ===")

    input_path = Path(input)
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load JSON
    log.info(f"Loading {input_path}...")
    with open(input_path, "r") as f:
        data = json.load(f)

    if not data:
        log.error("No WOZ data found in input file!")
        return

    log.info(f"Loaded {len(data)} WOZ records")

    # Flatten historical data
    df = flatten_historical_woz(data)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns: {df.columns}")

    # Remove personal data (GDPR compliance)
    if strip_personal_data:
        df = remove_personal_data(df)

    # Clean data
    df = clean_woz_data(df)

    # Optimize data types
    log.info("Optimizing data types...")

    # Integer columns
    if "house_number" in df.columns:
        df = df.with_columns(pl.col("house_number").cast(pl.Int32))

    # Cast all WOZ value columns to Int32
    woz_cols = [col for col in df.columns if col.startswith("woz_")]
    for col in woz_cols:
        df = df.with_columns(pl.col(col).cast(pl.Int32))

    # Parse scraped_at timestamp
    if "scraped_at" in df.columns:
        df = df.with_columns(
            pl.col("scraped_at").str.strptime(pl.Datetime, "%Y-%m-%dT%H:%M:%S", strict=False)
        )

    # Add metadata
    df = df.with_columns([
        pl.lit(datetime.utcnow().isoformat()).alias("processed_at"),
        pl.lit("where-to-live-nl").alias("source")
    ])

    # Write to Parquet
    log.info(f"Writing Parquet file with {compression} compression...")

    df.write_parquet(
        output_path,
        compression=compression,
        statistics=True,
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

    # Show statistics for all WOZ years
    log.info("\nWOZ Value Statistics (by year):")
    woz_cols = sorted([col for col in df.columns if col.startswith("woz_")])

    if woz_cols:
        for col in woz_cols:
            year = col.replace("woz_", "")
            stats = df.select([
                pl.col(col).count().alias("count"),
                pl.col(col).min().alias("min"),
                pl.col(col).max().alias("max"),
                pl.col(col).mean().alias("mean"),
                pl.col(col).median().alias("median")
            ])
            print(f"\n{year}: ", end="")
            print(stats)
    else:
        log.warning("No WOZ value columns found!")

    # Show schema
    log.info("\nOutput schema:")
    print(df.schema)

    # Show sample
    log.info("\nSample data (first 5 rows):")
    print(df.head(5))

    # Privacy check
    log.info("\n⚖️ Privacy Check:")
    if strip_personal_data:
        log.success("✓ Personal data removed (GDPR compliant)")
    else:
        log.warning("⚠️ Personal data may be present - review before production!")

if __name__ == "__main__":
    main()
