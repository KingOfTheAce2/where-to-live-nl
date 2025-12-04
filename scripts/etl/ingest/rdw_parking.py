"""
Ingest RDW Parking locations data.

Source: https://opendata.rdw.nl/Parkeren/Open-Data-Parkeren-PARKEERADRES/ygq4-hh5q
API: https://opendata.rdw.nl/resource/ygq4-hh5q.json

This dataset contains parking facility addresses in the Netherlands.
"""

import json
import requests
import polars as pl
from pathlib import Path
from typing import Optional

# Paths
RAW_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def fetch_parking_data(limit: int = 50000) -> list:
    """Fetch parking data from RDW Open Data API."""
    print(f"Fetching parking data from RDW (limit: {limit})...")

    url = "https://opendata.rdw.nl/resource/ygq4-hh5q.json"
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

    print(f"Total parking records fetched: {len(all_data)}")
    return all_data


def process_parking_data(raw_data: list) -> pl.DataFrame:
    """Process raw parking data into structured DataFrame."""
    print("Processing parking data...")

    records = []
    seen = set()

    for item in raw_data:
        # Only use actual addresses (type A), not postal
        if item.get("parkingaddresstype") != "A":
            continue

        ref = item.get("parkingaddressreference")
        if ref in seen:
            continue
        seen.add(ref)

        record = {
            "id": ref,
            "street": item.get("streetname"),
            "house_number": item.get("housenumber"),
            "postal_code": item.get("zipcode", "").replace(" ", "").upper() if item.get("zipcode") else None,
            "city": item.get("place"),
            "province": item.get("province"),
            "phone": item.get("telephonenumber"),
            "email": item.get("emailaddress"),
        }
        records.append(record)

    df = pl.DataFrame(records)
    print(f"Processed {df.height} unique parking locations")
    return df


def save_data(raw_data: list, processed_df: pl.DataFrame):
    """Save raw and processed data."""
    # Save raw JSON
    raw_path = RAW_DIR / "rdw_parking.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)
    print(f"Saved raw data to {raw_path}")

    # Save processed Parquet
    processed_path = PROCESSED_DIR / "rdw_parking.parquet"
    processed_df.write_parquet(processed_path)
    print(f"Saved processed data to {processed_path}")


def main():
    """Main ingestion function."""
    print("=" * 60)
    print("RDW Parking Data Ingestion")
    print("=" * 60)

    # Fetch data
    raw_data = fetch_parking_data(limit=100000)

    # Process data
    processed_df = process_parking_data(raw_data)

    # Save data
    save_data(raw_data, processed_df)

    print("\nDone!")
    print(f"Total parking locations: {processed_df.height}")

    # Show sample cities
    if processed_df.height > 0:
        cities = processed_df.select("city").unique().head(10).to_series().to_list()
        print(f"\nSample cities: {cities}")


if __name__ == "__main__":
    main()
