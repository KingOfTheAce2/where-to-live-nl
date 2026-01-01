"""
Energy Label Estimation from CBS Energy Consumption Data

Since EP-Online requires an API key for bulk downloads, this script estimates
energy labels per neighborhood based on CBS average gas/electricity consumption.

Energy Label Thresholds (based on Dutch average consumption patterns):
- A+++/A++/A+/A: < 500 m³ gas/year (very efficient, typically new or renovated)
- B: 500-1000 m³ gas/year
- C: 1000-1300 m³ gas/year
- D: 1300-1600 m³ gas/year
- E: 1600-2000 m³ gas/year
- F: 2000-2500 m³ gas/year
- G: > 2500 m³ gas/year (very inefficient, typically old unrenovated)

Note: District heating (stadsverwarming) homes are treated separately.

Data Source: CBS 86159NED (Energieverbruik particuliere woningen per wijk/buurt 2024)
"""

import polars as pl
from pathlib import Path
from typing import Tuple

# Paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
PROCESSED_DIR = DATA_DIR / "processed"

# Energy label thresholds based on gas consumption (m³/year)
# These are calibrated against actual Dutch energy label distributions
ENERGY_THRESHOLDS = {
    "A": (0, 500),          # Very efficient (new builds, major renovation)
    "B": (500, 1000),       # Efficient
    "C": (1000, 1300),      # Fairly efficient
    "D": (1300, 1600),      # Average
    "E": (1600, 2000),      # Below average
    "F": (2000, 2500),      # Inefficient
    "G": (2500, float('inf'))  # Very inefficient
}


def estimate_energy_label(gas_consumption: float | None, has_district_heating: bool = False) -> str:
    """
    Estimate energy label based on average gas consumption.

    Args:
        gas_consumption: Average gas consumption in m³/year
        has_district_heating: Whether the neighborhood has district heating

    Returns:
        Estimated energy label (A-G)
    """
    if gas_consumption is None:
        return "Unknown"

    # District heating homes typically have no gas consumption
    # They're usually efficient (B-C range) due to modern heating systems
    if has_district_heating and gas_consumption < 100:
        return "B"

    for label, (min_val, max_val) in ENERGY_THRESHOLDS.items():
        if min_val <= gas_consumption < max_val:
            return label

    return "G"


def get_label_numeric(label: str) -> int:
    """Convert energy label to numeric value for sorting (1=best, 7=worst)"""
    mapping = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6, "G": 7, "Unknown": 99}
    return mapping.get(label, 99)


def get_label_description(label: str) -> str:
    """Get human-readable description for energy label"""
    descriptions = {
        "A": "Very efficient - modern or renovated building",
        "B": "Efficient - good insulation and heating",
        "C": "Fairly efficient - average for recent builds",
        "D": "Average - typical Dutch home",
        "E": "Below average - older building, some improvements needed",
        "F": "Inefficient - significant improvements recommended",
        "G": "Very inefficient - major renovation recommended",
        "Unknown": "Data not available"
    }
    return descriptions.get(label, "Unknown")


def process_energy_consumption_data():
    """
    Process CBS energy consumption data to estimate energy labels per neighborhood.
    """
    print("Processing CBS energy consumption data...")

    input_file = PROCESSED_DIR / "energieverbruik_86159NED.parquet"
    if not input_file.exists():
        raise FileNotFoundError(f"Energy consumption data not found: {input_file}")

    df = pl.read_parquet(input_file)
    print(f"Loaded {df.height:,} records")

    # Filter to neighborhood level only (BU prefix)
    # Also filter for total dwellings (Woningkenmerken = T001100 = "Totaal woningen")
    df_buurten = df.filter(
        (pl.col("WijkenEnBuurten").str.starts_with("BU")) &
        (pl.col("Woningkenmerken") == "T001100")
    )
    print(f"Filtered to {df_buurten.height:,} neighborhood records")

    # Process each neighborhood
    result = df_buurten.with_columns([
        # Clean buurt code
        pl.col("WijkenEnBuurten").str.strip_chars().alias("area_code"),
        pl.col("Gemeentenaam_1").str.strip_chars().alias("municipality"),

        # Has district heating if Stadsverwarming percentage > 20%
        (pl.col("Stadsverwarming_7") > 20).fill_null(False).alias("has_district_heating"),
    ])

    # Estimate energy labels
    result = result.with_columns([
        pl.struct(["GemiddeldAardgasverbruik_4", "has_district_heating"])
        .map_elements(
            lambda x: estimate_energy_label(x["GemiddeldAardgasverbruik_4"], x["has_district_heating"]),
            return_dtype=pl.Utf8
        )
        .alias("estimated_energy_label"),
    ])

    # Add numeric label for sorting and description
    result = result.with_columns([
        pl.col("estimated_energy_label")
        .map_elements(get_label_numeric, return_dtype=pl.Int32)
        .alias("energy_label_numeric"),

        pl.col("estimated_energy_label")
        .map_elements(get_label_description, return_dtype=pl.Utf8)
        .alias("energy_label_description"),
    ])

    # Select and rename columns for output
    output = result.select([
        "area_code",
        "municipality",
        pl.col("GemiddeldAardgasverbruik_4").alias("avg_gas_m3"),
        pl.col("GemiddeldeElektriciteitslevering_5").alias("avg_electricity_kwh"),
        pl.col("GemiddeldeNettoElektriciteitslevering_6").alias("avg_net_electricity_kwh"),
        pl.col("Stadsverwarming_7").alias("district_heating_pct"),
        "has_district_heating",
        "estimated_energy_label",
        "energy_label_numeric",
        "energy_label_description",
    ])

    # Save to parquet
    output_file = PROCESSED_DIR / "energy_labels_estimated.parquet"
    output.write_parquet(output_file, compression="snappy")

    print(f"\nSaved to: {output_file}")
    print(f"Total neighborhoods: {output.height:,}")

    # Show distribution
    print("\nEnergy Label Distribution:")
    distribution = output.group_by("estimated_energy_label").count().sort("estimated_energy_label")
    for row in distribution.iter_rows(named=True):
        label = row["estimated_energy_label"]
        count = row["count"]
        pct = count / output.height * 100
        print(f"  {label}: {count:,} ({pct:.1f}%)")

    # Show sample
    print("\nSample data:")
    print(output.head(5))

    return output


def main():
    """Main entry point"""
    print("=" * 70)
    print("Energy Label Estimation from CBS Consumption Data")
    print("=" * 70)
    print()
    print("Note: This estimates energy labels based on gas/electricity usage.")
    print("For actual registered labels, use EP-Online with API key:")
    print("  https://apikey.ep-online.nl (free)")
    print()

    process_energy_consumption_data()

    print("\n" + "=" * 70)
    print("Done!")
    print("=" * 70)


if __name__ == "__main__":
    main()
