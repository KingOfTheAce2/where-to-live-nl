"""
Housing Costs (Woonlasten) Data Ingestion

Fetches comprehensive housing costs data from CBS (Statistics Netherlands):
1. Housing costs by municipality (85950NED)
2. Housing costs by household characteristics (85949NED)

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
import time

# CBS OpenData API endpoints
CBS_API_BASE = "https://opendata.cbs.nl/ODataApi/odata"

DATASETS = {
    "by_municipality": {
        "id": "85950NED",
        "name": "Woonlasten huishoudens - kenmerken huishouden, woning, gemeente",
        "url": f"{CBS_API_BASE}/85950NED",
        "description": "Housing costs by household characteristics, dwelling, and municipality"
    },
    "by_household": {
        "id": "85949NED",
        "name": "Woonlasten huishoudens - kenmerken huishouden, woning",
        "url": f"{CBS_API_BASE}/85949NED",
        "description": "Housing costs by household and dwelling characteristics"
    }
}

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)

PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(exist_ok=True, parents=True)


class WoonlastenFetcher:
    """Fetcher for CBS housing costs data"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "WhereToLiveNL/1.0 (Housing Costs Data Collection)",
            "Accept": "application/json"
        })

    def fetch_table_data(self, dataset_id: str, table_name: str, filters: Optional[List[str]] = None, batch_size: int = 1000) -> List[Dict[str, Any]]:
        """
        Fetch data from a CBS table with pagination and optional filters.

        CBS OData API has strict limits, so we use filters and smaller batches.
        """
        url = f"{CBS_API_BASE}/{dataset_id}/{table_name}"
        all_data = []
        skip = 0

        print(f"[*] Fetching {table_name} from {dataset_id}...")
        if filters:
            print(f"    Filters: {filters}")

        while True:
            params = {
                "$skip": skip,
                "$top": batch_size
            }

            # Add filters if provided
            if filters:
                params["$filter"] = " and ".join(filters)

            try:
                response = self.session.get(url, params=params, timeout=120)
                response.raise_for_status()
                data = response.json()

                if "value" not in data or len(data["value"]) == 0:
                    break

                batch = data["value"]
                all_data.extend(batch)

                print(f"    Fetched {len(all_data)} records...")

                # If we got fewer records than batch_size, we're done
                if len(batch) < batch_size:
                    break

                skip += batch_size
                time.sleep(0.5)  # Rate limiting

            except Exception as e:
                print(f"[!] Error fetching batch at skip={skip}: {e}")
                break

        print(f"[+] Fetched {len(all_data)} total records from {table_name}")
        return all_data

    def get_dimension_tables(self, dataset_id: str) -> Dict[str, pl.DataFrame]:
        """
        Fetch dimension tables (lookup tables) for a dataset.

        These contain the labels for codes used in the main data.
        """
        dimensions = {}

        # Common dimension table names
        dimension_names = [
            "Perioden",           # Time periods
            "RegioS",             # Regions/municipalities
            "Woningtype",         # Dwelling type
            "Eigendom",           # Ownership status
            "HuishoudensSamenstelling",  # Household composition
            "HuishoudensGrootte", # Household size
            "HuishoudensInkomen", # Household income
            "Bouwjaar",           # Construction year
            "WoningGrootte"       # Dwelling size
        ]

        print(f"\n[*] Fetching dimension tables for {dataset_id}...")

        for dim_name in dimension_names:
            try:
                url = f"{CBS_API_BASE}/{dataset_id}/{dim_name}"
                response = self.session.get(url, timeout=60)

                if response.status_code == 200:
                    data = response.json()
                    if "value" in data and len(data["value"]) > 0:
                        df = pl.DataFrame(data["value"])
                        dimensions[dim_name] = df
                        print(f"    [+] {dim_name}: {len(df)} items")

                time.sleep(0.2)  # Rate limiting

            except Exception as e:
                # Dimension might not exist for this dataset
                continue

        return dimensions

    def discover_tables(self, dataset_id: str) -> List[str]:
        """
        Discover available tables in a dataset.
        """
        url = f"{CBS_API_BASE}/{dataset_id}"

        try:
            response = self.session.get(url, timeout=60)
            response.raise_for_status()
            metadata = response.json()

            if "value" in metadata:
                tables = [item.get("name") for item in metadata["value"] if "name" in item]
                return tables
        except Exception as e:
            print(f"[!] Error discovering tables: {e}")

        return []

    def fetch_dataset(self, dataset_key: str) -> Optional[pl.DataFrame]:
        """
        Fetch a complete dataset including dimensions and main data.
        """
        dataset = DATASETS[dataset_key]
        dataset_id = dataset["id"]

        print(f"\n{'='*60}")
        print(f"Dataset: {dataset['name']}")
        print(f"ID: {dataset_id}")
        print(f"{'='*60}")

        # Discover available tables
        tables = self.discover_tables(dataset_id)
        print(f"\n[*] Available tables: {tables}")

        # Find the main data table (usually TypedDataSet or ends with Data)
        data_table = None
        for table in tables:
            if table == "TypedDataSet" or table.endswith("Data") or table == dataset_id:
                data_table = table
                break

        if not data_table and tables:
            # Use the last table which is often the main data
            data_table = tables[-1]

        if not data_table:
            print(f"[!] Could not find main data table")
            return None

        print(f"[*] Using data table: {data_table}")

        # Fetch dimension tables first
        dimensions = self.get_dimension_tables(dataset_id)

        # Get available periods to iterate through them
        periods = []
        if "Perioden" in dimensions:
            periods = dimensions["Perioden"]["Key"].to_list()
            print(f"[*] Found {len(periods)} periods: {periods}")

        # Fetch data iteratively by period to avoid CBS API limits
        all_observations = []

        if periods:
            for period in periods:
                print(f"\n[*] Fetching data for period: {period}")
                period_filter = [f"Perioden eq '{period}'"]
                observations = self.fetch_table_data(dataset_id, data_table, filters=period_filter)
                all_observations.extend(observations)
                time.sleep(1)  # Rate limiting
        else:
            # No periods, try without filter (risky)
            print(f"[!] No periods found, attempting direct fetch...")
            all_observations = self.fetch_table_data(dataset_id, data_table)

        if not all_observations:
            print(f"[!] No data found for {dataset_id}")
            return None

        print(f"\n[+] Total observations collected: {len(all_observations)}")

        # Convert to DataFrame
        df = pl.DataFrame(all_observations, infer_schema_length=10000)

        # Enrich with dimension labels
        for dim_name, dim_df in dimensions.items():
            # CBS typically uses "Key" and "Title" columns
            if "Key" in dim_df.columns and "Title" in dim_df.columns:
                # Create mapping
                key_col = f"{dim_name}"
                label_col = f"{dim_name}_Label"

                if key_col in df.columns:
                    # Join to add labels
                    mapping = dim_df.select([
                        pl.col("Key").alias(key_col),
                        pl.col("Title").alias(label_col)
                    ])

                    df = df.join(mapping, on=key_col, how="left")
                    print(f"    [+] Added labels for {dim_name}")

        return df


def main():
    """Main execution function"""
    print("Housing Costs (Woonlasten) Data Ingestion")
    print("="*60)
    print("Source: CBS OpenData (CC-BY 4.0)")
    print("="*60)

    fetcher = WoonlastenFetcher()

    # Fetch both datasets
    for dataset_key in ["by_municipality", "by_household"]:
        dataset_id = DATASETS[dataset_key]["id"]

        try:
            df = fetcher.fetch_dataset(dataset_key)

            if df is not None:
                # Save to parquet
                output_file = PROCESSED_DIR / f"woonlasten_{dataset_id}.parquet"
                df.write_parquet(output_file, compression="snappy")

                print(f"\n[+] Saved {len(df)} records to {output_file}")
                print(f"    Columns: {len(df.columns)}")
                print(f"    File size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

        except Exception as e:
            print(f"[!] Error processing {dataset_id}: {e}")
            continue

        time.sleep(2)  # Rate limiting between datasets

    print("\n" + "="*60)
    print("[+] Housing costs ingestion complete!")
    print("="*60)


if __name__ == "__main__":
    main()
