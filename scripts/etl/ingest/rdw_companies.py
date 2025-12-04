"""
Ingest RDW Recognized Companies data (APK stations, vehicle registration, etc.)

Source: https://opendata.rdw.nl/en/widgets/5k74-3jha
API: https://opendata.rdw.nl/resource/5k74-3jha.json

This dataset contains RDW-recognized businesses including:
- APK inspection stations
- Vehicle registration offices
- Fleet management companies
"""

import json
import requests
import polars as pl
from pathlib import Path

# Paths
RAW_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def fetch_rdw_companies(limit: int = 100000) -> list:
    """Fetch RDW recognized companies from Open Data API."""
    print(f"Fetching RDW companies data (limit: {limit})...")

    url = "https://opendata.rdw.nl/resource/5k74-3jha.json"
    all_data = []
    offset = 0
    batch_size = 10000

    while offset < limit:
        params = {
            "$limit": min(batch_size, limit - offset),
            "$offset": offset,
        }

        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()

        batch = response.json()
        if not batch:
            break

        all_data.extend(batch)
        print(f"  Fetched {len(all_data)} records...")
        offset += batch_size

        if len(batch) < batch_size:
            break

    print(f"Total RDW companies fetched: {len(all_data)}")
    return all_data


def process_rdw_companies(raw_data: list) -> pl.DataFrame:
    """Process raw RDW companies data into structured DataFrame."""
    print("Processing RDW companies data...")

    records = []

    for item in raw_data:
        # Build postal code from numeric + alpha parts
        postal_num = item.get("postcode_numeriek", "")
        postal_alpha = item.get("postcode_alfanumeriek", "")
        postal_code = f"{postal_num}{postal_alpha}" if postal_num and postal_alpha else None

        record = {
            "id": item.get("volgnummer"),
            "company_name": item.get("naam_bedrijf"),
            "display_name": item.get("gevelnaam"),  # Shop front name
            "street": item.get("straat"),
            "house_number": item.get("huisnummer"),
            "postal_code": postal_code,
            "city": item.get("plaats"),
            "api_link": item.get("api_bedrijf_erkenningen"),  # Link to recognitions API
        }
        records.append(record)

    df = pl.DataFrame(records)

    # Filter out records without essential data
    df = df.filter(pl.col("company_name").is_not_null())

    print(f"Processed {df.height} RDW recognized companies")
    return df


def save_data(raw_data: list, processed_df: pl.DataFrame):
    """Save raw and processed data."""
    # Save raw JSON
    raw_path = RAW_DIR / "rdw_companies.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)
    print(f"Saved raw data to {raw_path}")

    # Save processed Parquet
    processed_path = PROCESSED_DIR / "rdw_companies.parquet"
    processed_df.write_parquet(processed_path)
    print(f"Saved processed data to {processed_path}")


def main():
    """Main ingestion function."""
    print("=" * 60)
    print("RDW Recognized Companies Data Ingestion")
    print("=" * 60)

    # Fetch data
    raw_data = fetch_rdw_companies(limit=100000)

    # Process data
    processed_df = process_rdw_companies(raw_data)

    # Save data
    save_data(raw_data, processed_df)

    print("\nDone!")
    print(f"Total RDW companies: {processed_df.height}")

    # Show sample cities
    if processed_df.height > 0:
        cities = processed_df.select("city").unique().head(10).to_series().to_list()
        print(f"\nSample cities: {cities}")


if __name__ == "__main__":
    main()
