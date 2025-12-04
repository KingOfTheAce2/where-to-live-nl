"""
Transform Amenities (OSM) JSON to optimized Parquet format.

Converts OpenStreetMap amenity data (supermarkets, healthcare, playgrounds, etc.)
from JSON to Parquet for efficient spatial queries.
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
    required=True,
    help="Input JSON file with amenity data"
)
@click.option(
    "--output",
    type=click.Path(),
    required=True,
    help="Output Parquet file"
)
@click.option(
    "--amenity-type",
    type=str,
    help="Type of amenity (supermarket, healthcare, playground, park, school)"
)
def main(input: str, output: str, amenity_type: str = None):
    """
    Transform Amenities JSON to Parquet format.

    Amenities include: supermarkets, healthcare facilities, playgrounds, parks, schools.

    Optimizations:
    - Converts to columnar format (faster spatial queries)
    - Compresses data (60-80% size reduction)
    - Optimizes data types for memory efficiency

    Examples:
        python -m transform.amenities_to_parquet --input ../../data/raw/amenities_supermarkets.json --output ../../data/processed/supermarkets.parquet --amenity-type supermarket
        python -m transform.amenities_to_parquet --input ../../data/raw/amenities_healthcare.json --output ../../data/processed/healthcare.parquet --amenity-type healthcare
    """
    log.info(f"=== Amenities JSON → Parquet Transformation ===")

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
        records = data.get("elements", data.get("data", []))
    else:
        records = []

    log.info(f"Loaded {len(records)} {amenity_type or 'amenity'} locations")

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

    # Standardize column names
    column_mapping = {
        "lat": "latitude",
        "lon": "longitude",
    }

    for old_name, new_name in column_mapping.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename({old_name: new_name})

    # Extract tags if they exist (OSM data structure)
    if "tags" in df.columns:
        log.info("Extracting OSM tags...")
        # Convert tags dict to individual columns for common fields
        tags_to_extract = ["name", "brand", "amenity", "shop", "leisure", "healthcare"]

        for tag in tags_to_extract:
            try:
                df = df.with_columns(
                    pl.col("tags").map_elements(
                        lambda x: x.get(tag) if isinstance(x, dict) else None,
                        return_dtype=pl.Utf8
                    ).alias(tag)
                )
            except:
                pass

    # Optimize data types
    log.info("Optimizing data types...")

    # String columns
    string_cols = ["name", "brand", "amenity", "shop", "leisure", "healthcare", "type"]
    for col in string_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Utf8))
            except:
                pass

    # Integer columns
    int_cols = ["id"]
    for col in int_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Int64))
            except:
                pass

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
            pl.col("longitude").is_not_null()
        )
        after_count = len(df)
        removed = before_count - after_count
        if removed > 0:
            log.info(f"Removed {removed} locations with missing coordinates")

    # Add amenity type column if specified
    if amenity_type and "amenity_type" not in df.columns:
        df = df.with_columns(pl.lit(amenity_type).alias("amenity_type"))

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
    if "name" in df.columns:
        named_count = df.filter(pl.col("name").is_not_null()).height
        log.info(f"Locations with names: {named_count}/{len(df)} ({named_count/len(df)*100:.1f}%)")

    if "brand" in df.columns:
        top_brands = df.group_by("brand").agg(pl.count()).sort("count", descending=True).head(10)
        log.info("\nTop brands:")
        log.info(top_brands)

    if "latitude" in df.columns and "longitude" in df.columns:
        log.info("\nCoordinate ranges:")
        log.info(f"Latitude: {df['latitude'].min():.6f} to {df['latitude'].max():.6f}")
        log.info(f"Longitude: {df['longitude'].min():.6f} to {df['longitude'].max():.6f}")

    log.info("\n=== Example Queries ===")
    log.info("# Load data:")
    log.info(f'df = pl.read_parquet("{output_path}")')
    log.info("")
    log.info("# Find by brand (if applicable):")
    log.info('albert_heijn = df.filter(pl.col("brand") == "Albert Heijn")')
    log.info("")
    log.info("# Spatial query (bounding box):")
    log.info('in_area = df.filter((pl.col("latitude").is_between(52.3, 52.4)) & (pl.col("longitude").is_between(4.8, 4.9)))')


if __name__ == "__main__":
    main()
