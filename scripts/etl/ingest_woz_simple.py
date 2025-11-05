"""
Simple WOZ scraper - gets pure WOZ values and saves to Parquet.

Scrapes WOZ values from 2014 onwards and outputs directly to Parquet format:
postal_code | house_number | woz_2014 | woz_2015 | ... | woz_2024
"""

import json
from pathlib import Path
from typing import Optional
import click
import polars as pl
from tqdm import tqdm
import time

import sys
sys.path.append(str(Path(__file__).parent))

from ingest.woz import WOZScraper
from common.logger import log


def flatten_to_dict(woz_result: dict) -> dict:
    """
    Flatten WOZ result to simple dict with year columns + metadata.

    Output includes:
    - Address info: postal_code, house_number, house_letter
    - WOZ metadata: woz_object_nummer, adresseerbaar_object_id, nummeraanduiding_id
    - Property info: bouwjaar, gebruiksdoel, oppervlakte, gemeentecode
    - BAG info: bag_pand_id, pand_bouwjaar
    - Historical values: woz_2014, woz_2015, ..., woz_2024
    """
    flat = {
        "postal_code": woz_result["postal_code"],
        "house_number": woz_result["house_number"],
    }

    # Optional address components
    if woz_result.get("house_letter"):
        flat["house_letter"] = woz_result["house_letter"]

    # WOZ identifiers (for joining datasets)
    flat["woz_object_nummer"] = woz_result.get("woz_object_nummer")
    flat["adresseerbaar_object_id"] = woz_result.get("adresseerbaar_object_id")
    flat["nummeraanduiding_id"] = woz_result.get("nummeraanduiding_id")

    # Property characteristics
    flat["bouwjaar"] = woz_result.get("bouwjaar") or woz_result.get("pand_bouwjaar")
    flat["gebruiksdoel"] = woz_result.get("gebruiksdoel")
    flat["oppervlakte"] = woz_result.get("oppervlakte")
    flat["gemeentecode"] = woz_result.get("gemeentecode")

    # BAG identifiers
    flat["bag_pand_id"] = woz_result.get("bag_pand_id")

    # Flatten valuations
    for val in woz_result.get("valuations", []):
        year = val["valuation_date"].split("-")[0]
        flat[f"woz_{year}"] = val["woz_value"]

    return flat


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
    default="../../data/processed/woz-values.parquet",
    help="Output Parquet file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N addresses for testing"
)
@click.option(
    "--rate-limit",
    type=float,
    default=1.0,
    help="Requests per second (default: 1.0)"
)
def main(
    input: str,
    output: str,
    sample: Optional[int],
    rate_limit: float
):
    """
    Scrape WOZ values and save directly to Parquet.

    Output format:
        postal_code | house_number | woz_2014 | woz_2015 | ... | woz_2024

    Examples:
        # Test with 10 addresses
        python ingest_woz_simple.py --sample 10

        # Full run
        python ingest_woz_simple.py
    """
    log.info("=== Simple WOZ Scraper ===")

    # Load BAG addresses
    input_path = Path(input)
    with open(input_path, "r") as f:
        addresses = json.load(f)

    log.info(f"Loaded {len(addresses)} addresses from {input_path}")

    # Apply sample limit
    if sample:
        addresses = addresses[:sample]
        log.info(f"Limited to {sample} addresses")

    # Scrape WOZ values
    results = []
    success_count = 0

    with WOZScraper(rate_limit=rate_limit) as scraper:
        for addr in tqdm(addresses, desc="Scraping WOZ"):
            if not addr.get("postal_code") or not addr.get("house_number"):
                continue

            woz_data = scraper.lookup_woz(
                postal_code=addr["postal_code"],
                house_number=addr["house_number"],
                house_letter=addr.get("house_letter", "")
            )

            if woz_data and woz_data.get("valuations"):
                flat_data = flatten_to_dict(woz_data)
                results.append(flat_data)
                success_count += 1

    log.info(f"Successfully scraped {success_count}/{len(addresses)} addresses")

    if not results:
        log.error("No WOZ data collected!")
        return

    # Convert to Polars DataFrame
    df = pl.DataFrame(results)

    log.info(f"DataFrame shape: {df.shape}")
    log.info(f"Columns: {df.columns}")

    # Save to Parquet
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df.write_parquet(
        output_path,
        compression="snappy",
        statistics=True,
        use_pyarrow=True
    )

    log.success(f"Saved {len(df)} records to {output_path}")

    # Show sample
    log.info("\nSample data (first 5 rows):")
    print(df.head(5))

    # Show summary
    woz_cols = [col for col in df.columns if col.startswith("woz_")]
    log.info(f"\nYears available: {len(woz_cols)}")
    log.info(f"Year range: {woz_cols[0].replace('woz_', '')} - {woz_cols[-1].replace('woz_', '')}")


if __name__ == "__main__":
    main()
