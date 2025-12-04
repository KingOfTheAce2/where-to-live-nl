"""
Transform CBS Demographics JSON to optimized Parquet format.

Converts CBS neighborhood statistics from JSON to Parquet for efficient querying.
Includes 124+ fields per neighborhood: population, age, income, housing, facilities.
"""

import json
from pathlib import Path
from typing import Optional
import click
import polars as pl

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log


@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/cbs_demographics.json",
    help="Input JSON file from CBS demographics ingestion"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/processed/cbs_demographics.parquet",
    help="Output Parquet file"
)
def main(input: str, output: str):
    """
    Transform CBS Demographics JSON to Parquet format.

    Optimizations:
    - Converts to columnar format (faster queries)
    - Compresses data (60-80% size reduction)
    - Optimizes data types for memory efficiency
    - Adds calculated fields (age percentages, density, etc.)

    Examples:
        python -m transform.cbs_demographics_to_parquet
        python -m transform.cbs_demographics_to_parquet --input custom.json
    """
    log.info("=== CBS Demographics JSON → Parquet Transformation ===")

    # Load JSON data
    input_path = Path(input)
    log.info(f"Reading {input_path}...")

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    metadata = data.get("metadata", {})
    records = data.get("data", [])

    log.info(f"Loaded {len(records)} records")
    log.info(f"Source: {metadata.get('source')}")
    log.info(f"Dataset: {metadata.get('dataset')}")
    log.info(f"Table ID: {metadata.get('table_id')}")
    log.info(f"Year: {metadata.get('year')}")

    if not records:
        log.error("No records found in input file!")
        return

    # Create Polars DataFrame
    log.info("Creating Polars DataFrame...")
    # Use infer_schema_length=None to scan all rows for schema inference
    # This prevents type conflicts when CBS data has inconsistent types
    df = pl.DataFrame(records, infer_schema_length=None)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns ({len(df.columns)}): {df.columns[:10]}... (showing first 10)")

    # Show sample
    log.info("\n=== Sample Data ===")
    sample_cols = ["WijkenEnBuurten", "Gemeentenaam_1", "AantalInwoners_5", "HuishoudensTotaal_29", "GemiddeldeWOZWaardeVanWoningen_39"]
    available_sample_cols = [col for col in sample_cols if col in df.columns]
    log.info(df.select(available_sample_cols).head(3))

    # Data cleaning and optimization
    log.info("\n=== Data Optimization ===")

    # Rename key columns for easier use
    column_mapping = {
        "WijkenEnBuurten": "area_code",
        "Gemeentenaam_1": "municipality",
        "SoortRegio_2": "region_type",
        "Codering_3": "code",
        "AantalInwoners_5": "population",
        "Mannen_6": "males",
        "Vrouwen_7": "females",
        "k_0Tot15Jaar_8": "age_0_15",
        "k_15Tot25Jaar_9": "age_15_25",
        "k_25Tot45Jaar_10": "age_25_45",
        "k_45Tot65Jaar_11": "age_45_65",
        "k_65JaarOfOuder_12": "age_65_plus",
        "Ongehuwd_13": "unmarried",
        "Gehuwd_14": "married",
        "Gescheiden_15": "divorced",
        "Verweduwd_16": "widowed",
        "HuishoudensTotaal_29": "households_total",
        "Eenpersoonshuishoudens_30": "households_single",
        "HuishoudensZonderKinderen_31": "households_no_children",
        "HuishoudensMetKinderen_32": "households_with_children",
        "GemiddeldeHuishoudensgrootte_33": "avg_household_size",
        "Woningvoorraad_35": "housing_stock",
        "GemiddeldeWOZWaardeVanWoningen_39": "avg_woz_value_k",  # in €1000s
        "PercentageEengezinswoning_40": "pct_single_family_homes",
        "PercentageMeergezinswoning_45": "pct_multi_family_homes",
        "Koopwoningen_47": "pct_owner_occupied",
        "HuurwoningenTotaal_48": "pct_rental",
        "GemiddeldInkomenPerInwoner_78": "avg_income_per_resident",
        "HuishoudensMetEenLaagInkomen_84": "pct_low_income_households",
        "AfstandTotHuisartsenpraktijk_112": "dist_to_gp_km",
        "AfstandTotGroteSupermarkt_113": "dist_to_supermarket_km",
        "AfstandTotKinderdagverblijf_114": "dist_to_daycare_km",
        "AfstandTotSchool_115": "dist_to_school_km",
        "PersonenautoSTotaal_106": "total_cars",
        "PersonenautoSPerHuishouden_109": "cars_per_household",
    }

    # Rename columns that exist
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns:
            df = df.rename({old_name: new_name})

    # Optimize data types
    log.info("Optimizing data types...")

    # String columns
    string_cols = ["area_code", "municipality", "region_type", "code"]
    for col in string_cols:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Utf8))

    # Integer columns (population, counts, etc.)
    int_cols = [
        "population", "males", "females",
        "age_0_15", "age_15_25", "age_25_45", "age_45_65", "age_65_plus",
        "unmarried", "married", "divorced", "widowed",
        "households_total", "households_single", "households_no_children", "households_with_children",
        "housing_stock", "total_cars"
    ]
    for col in int_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Int32))
            except:
                log.warning(f"Could not convert {col} to Int32")

    # Float columns (averages, percentages, distances)
    float_cols = [
        "avg_household_size", "avg_woz_value_k",
        "pct_single_family_homes", "pct_multi_family_homes",
        "pct_owner_occupied", "pct_rental",
        "avg_income_per_resident", "pct_low_income_households",
        "dist_to_gp_km", "dist_to_supermarket_km", "dist_to_daycare_km", "dist_to_school_km",
        "cars_per_household"
    ]
    for col in float_cols:
        if col in df.columns:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float32))
            except:
                log.warning(f"Could not convert {col} to Float32")

    # Add calculated fields
    log.info("Adding calculated fields...")

    # Calculate age percentages
    if "population" in df.columns and df["population"].sum() > 0:
        if "age_0_15" in df.columns:
            df = df.with_columns(
                (pl.col("age_0_15") / pl.col("population") * 100).alias("pct_age_0_15")
            )
        if "age_15_25" in df.columns:
            df = df.with_columns(
                (pl.col("age_15_25") / pl.col("population") * 100).alias("pct_age_15_25")
            )
        if "age_25_45" in df.columns:
            df = df.with_columns(
                (pl.col("age_25_45") / pl.col("population") * 100).alias("pct_age_25_45")
            )
        if "age_45_65" in df.columns:
            df = df.with_columns(
                (pl.col("age_45_65") / pl.col("population") * 100).alias("pct_age_45_65")
            )
        if "age_65_plus" in df.columns:
            df = df.with_columns(
                (pl.col("age_65_plus") / pl.col("population") * 100).alias("pct_age_65_plus")
            )

    # Convert WOZ value from thousands to actual euros
    if "avg_woz_value_k" in df.columns:
        df = df.with_columns(
            (pl.col("avg_woz_value_k") * 1000).cast(pl.Int32).alias("avg_woz_value_euro")
        )

    # Calculate household type percentages
    if "households_total" in df.columns and df["households_total"].sum() > 0:
        if "households_single" in df.columns:
            df = df.with_columns(
                (pl.col("households_single") / pl.col("households_total") * 100).alias("pct_households_single")
            )
        if "households_with_children" in df.columns:
            df = df.with_columns(
                (pl.col("households_with_children") / pl.col("households_total") * 100).alias("pct_households_with_children")
            )

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
    log.info(f"Records: {len(df)}")
    log.info(f"Columns: {len(df.columns)}")

    # Statistics
    log.info("\n=== Data Statistics ===")
    stats_cols = ["population", "households_total", "avg_woz_value_euro", "avg_income_per_resident"]
    available_stats_cols = [col for col in stats_cols if col in df.columns]
    if available_stats_cols:
        log.info(df.select(available_stats_cols).describe())

    # Sample neighborhoods
    log.info("\n=== Sample Neighborhoods ===")
    display_cols = ["area_code", "municipality", "population", "households_total", "avg_woz_value_euro"]
    available_display_cols = [col for col in display_cols if col in df.columns]
    if available_display_cols:
        log.info(df.select(available_display_cols).head(5))

    log.info("\n=== Example Queries ===")
    log.info("# Load data:")
    log.info(f'df = pl.read_parquet("{output_path}")')
    log.info("")
    log.info("# Find most populous neighborhoods:")
    log.info('populous = df.filter(pl.col("population") > 0).sort("population", descending=True).head(10)')
    log.info("")
    log.info("# Get specific neighborhood:")
    log.info('neighborhood = df.filter(pl.col("area_code") == "BU03630001")')
    log.info("")
    log.info("# Find family-friendly areas (high % children):")
    log.info('family_friendly = df.filter(pl.col("pct_households_with_children") > 40).sort("pct_households_with_children", descending=True)')
    log.info("")
    log.info("# Find affordable areas (low WOZ, high income):")
    log.info('affordable = df.filter((pl.col("avg_woz_value_euro") < 300000) & (pl.col("avg_income_per_resident") > 30000))')


if __name__ == "__main__":
    main()
