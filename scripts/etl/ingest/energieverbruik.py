"""
Energy Consumption (Energieverbruik) Data Ingestion

Fetches comprehensive energy consumption data from CBS (Statistics Netherlands):
1. Energy consumption by house type, surface area, construction year (85140NED)
2. Energy consumption by region (81528NED)
3. Energy consumption by neighborhood 2024 (86159NED)

Data Source: CBS OpenData (https://opendata.cbs.nl)
License: CC-BY 4.0
Update Frequency: Annually
"""

import requests
import json
import polars as pl
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# CBS OpenData API endpoints
CBS_API_BASE = "https://opendata.cbs.nl/ODataApi/odata"

DATASETS = {
    "by_type_surface_year": {
        "id": "85140NED",
        "name": "Energieverbruik woningen - woningtype, oppervlakte, bouwjaar",
        "url": f"{CBS_API_BASE}/85140NED",
        "description": "Energy consumption by dwelling type, surface area, construction year"
    },
    "by_region": {
        "id": "81528NED",
        "name": "Energieverbruik particuliere woningen - woningtype en regio's",
        "url": f"{CBS_API_BASE}/81528NED",
        "description": "Energy consumption by dwelling type and regions"
    },
    "by_neighborhood_2024": {
        "id": "86159NED",
        "name": "Energieverbruik particuliere woningen - wijken en buurten 2024",
        "url": f"{CBS_API_BASE}/86159NED",
        "description": "Energy consumption by neighborhoods and districts 2024"
    }
}

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)

PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(exist_ok=True, parents=True)


class EnergieVerbruikFetcher:
    """Fetcher for CBS energy consumption data"""

    def __init__(self):
        # Fix Windows console encoding
        import sys
        import io
        if sys.stdout.encoding != 'utf-8':
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "WhereToLiveNL/1.0 (Energy Consumption Data Collection)",
            "Accept": "application/json"
        })

    def fetch_dataset_metadata(self, dataset_id: str) -> Dict[str, Any]:
        """
        Fetch metadata about a CBS dataset.

        Returns information about tables, dimensions, and available data.
        """
        url = f"{CBS_API_BASE}/{dataset_id}"

        print(f"\n📊 Fetching metadata for dataset {dataset_id}...")

        try:
            response = self.session.get(url)
            response.raise_for_status()
            metadata = response.json()

            print(f"✅ Metadata fetched successfully")

            # Show available tables
            if "value" in metadata:
                print(f"\n📋 Available tables:")
                for table in metadata["value"]:
                    print(f"  - {table.get('name', 'Unknown')}: {table.get('url', '')}")

            return metadata

        except Exception as e:
            print(f"❌ Error fetching metadata: {e}")
            return {}

    def fetch_table_data(self, dataset_id: str, table_name: str, batch_size: int = 1000) -> List[Dict[str, Any]]:
        """
        Fetch data from a specific table within a CBS dataset.

        Args:
            dataset_id: CBS dataset ID (e.g., "85140NED")
            table_name: Table name (e.g., "TypedDataSet")
            batch_size: Number of records per batch (max 10000, but use smaller for safety)

        Returns:
            List of records
        """
        url = f"{CBS_API_BASE}/{dataset_id}/{table_name}"

        print(f"\n⬇️  Fetching data from {table_name}...")

        all_records = []
        skip = 0

        while True:
            try:
                # CBS OData API requires smaller batch sizes with $skip and $top
                params = {
                    "$skip": skip,
                    "$top": batch_size
                }

                response = self.session.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                records = data.get("value", [])

                if not records:
                    break

                all_records.extend(records)
                print(f"  Fetched {len(all_records):,} records so far...")

                skip += batch_size

                # Check if we've reached the end
                if len(records) < batch_size:
                    break

            except requests.HTTPError as e:
                if "10000 records" in str(e):
                    print(f"⚠️  Hit 10K record limit at skip={skip}. CBS API limitation.")
                    print(f"   Fetched {len(all_records):,} records total.")
                    break
                else:
                    print(f"❌ Error fetching data: {e}")
                    break
            except Exception as e:
                print(f"❌ Error fetching data: {e}")
                break

        print(f"✅ Total records fetched: {len(all_records):,}")
        return all_records

    def fetch_dimensions(self, dataset_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch dimension tables (lookups) for a CBS dataset.

        These provide human-readable labels for dimension codes.
        """
        print(f"\n📋 Fetching dimensions for {dataset_id}...")

        dimensions = {}

        # Common dimension table names in CBS datasets
        dimension_tables = [
            "Woningtype",           # Dwelling type
            "Perioden",             # Time periods
            "RegioS",               # Regions
            "WijkenEnBuurten",      # Neighborhoods
            "Oppervlakteklasse",    # Surface area classes
            "Bouwjaarklasse",       # Construction year classes
            "Bewoning"              # Occupancy
        ]

        for table in dimension_tables:
            try:
                url = f"{CBS_API_BASE}/{dataset_id}/{table}"
                response = self.session.get(url)

                if response.status_code == 200:
                    data = response.json()
                    dimensions[table] = data.get("value", [])
                    print(f"  ✅ {table}: {len(dimensions[table])} entries")

            except Exception as e:
                # Some datasets may not have all dimension tables
                continue

        return dimensions

    def process_neighborhood_data(self, dataset_id: str) -> pl.DataFrame:
        """
        Process neighborhood-level energy consumption data.

        Returns a Polars DataFrame with cleaned and standardized data.
        """
        print(f"\n🔄 Processing neighborhood data from {dataset_id}...")

        # Fetch dimensions first
        dimensions = self.fetch_dimensions(dataset_id)

        # Fetch main data
        records = self.fetch_table_data(dataset_id, "TypedDataSet")

        if not records:
            print("⚠️  No records found")
            return pl.DataFrame()

        # Convert to Polars DataFrame
        df = pl.DataFrame(records)

        print(f"\n📊 Raw data shape: {df.shape}")
        print(f"Columns: {df.columns}")

        # Save raw data
        raw_file = DATA_DIR / f"energieverbruik_{dataset_id}_raw.json"
        with open(raw_file, 'w', encoding='utf-8') as f:
            json.dump({
                "dataset_id": dataset_id,
                "fetched_at": datetime.now().isoformat(),
                "dimensions": dimensions,
                "records": records[:100]  # Save sample for inspection
            }, f, indent=2, ensure_ascii=False)

        print(f"💾 Raw data sample saved to: {raw_file}")

        return df

    def convert_to_parquet(self, df: pl.DataFrame, dataset_id: str):
        """
        Convert DataFrame to Parquet format with compression.
        """
        if df.is_empty():
            print("⚠️  Empty DataFrame, skipping Parquet conversion")
            return

        output_file = PROCESSED_DIR / f"energieverbruik_{dataset_id}.parquet"

        print(f"\n💾 Saving to Parquet: {output_file}")

        df.write_parquet(
            output_file,
            compression="snappy"
        )

        file_size_mb = output_file.stat().st_size / (1024 * 1024)
        print(f"✅ Saved {df.height:,} records ({file_size_mb:.2f} MB)")

    def run(self):
        """
        Main execution: fetch and process all energy consumption datasets.
        """
        print("=" * 70)
        print("CBS Energy Consumption Data Fetcher")
        print("=" * 70)

        for key, dataset_info in DATASETS.items():
            print(f"\n{'=' * 70}")
            print(f"📥 Fetching: {dataset_info['name']}")
            print(f"Dataset ID: {dataset_info['id']}")
            print(f"Description: {dataset_info['description']}")
            print(f"{'=' * 70}")

            # Fetch metadata first
            metadata = self.fetch_dataset_metadata(dataset_info['id'])

            # Process the data
            df = self.process_neighborhood_data(dataset_info['id'])

            # Convert to Parquet
            if not df.is_empty():
                self.convert_to_parquet(df, dataset_info['id'])

            print(f"\n✅ Completed processing {dataset_info['id']}")

        print("\n" + "=" * 70)
        print("✅ ALL DATASETS PROCESSED")
        print("=" * 70)

        # Summary
        print("\n📊 Summary:")
        for file in PROCESSED_DIR.glob("energieverbruik_*.parquet"):
            size_mb = file.stat().st_size / (1024 * 1024)
            print(f"  - {file.name}: {size_mb:.2f} MB")


def main():
    """Entry point"""
    fetcher = EnergieVerbruikFetcher()
    fetcher.run()


if __name__ == "__main__":
    main()
