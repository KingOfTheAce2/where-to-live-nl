"""
Energy Label (Energielabel) scraper for EP-Online

Since EP-Online doesn't have a working public download endpoint,
we'll scrape energy labels from the BAG addresses we already have.

EP-Online lookup: https://www.ep-online.nl/PublicData
Data Source: RVO (Rijksdienst voor Ondernemend Nederland)

Strategy:
1. Load all addresses from BAG data
2. Query EP-Online for each address
3. Cache results to avoid re-querying
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
import httpx
from datetime import datetime
import polars as pl

# EP-Online API URLs
EP_ONLINE_BASE_URL = "https://public.ep-online.nl/api/v5"
EP_ONLINE_LOOKUP_URL = "https://www.ep-online.nl/PublicData/Energielabel"

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)
ENERGIELABEL_OUTPUT = DATA_DIR / "energielabels.json"

# Processed output
PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(exist_ok=True, parents=True)
ENERGIELABEL_PARQUET = PROCESSED_DIR / "energielabels.parquet"
BAG_ADDRESSES = PROCESSED_DIR / "bag_addresses.parquet"

# Rate limiting (be respectful!)
RATE_LIMIT_DELAY = 2.0  # 2 seconds between requests to avoid overload


class EnergielabelScraper:
    """Scraper for EP-Online energy label data"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or self.get_api_key()
        self.client = None
        self.labels = []

    def get_api_key(self) -> Optional[str]:
        """
        Get API key from environment or prompt user.

        To get an API key:
        1. Go to https://epbdwebservices.rvo.nl/
        2. Request API key (free)
        3. Save to environment variable EP_ONLINE_API_KEY
        """
        import os
        from dotenv import load_dotenv

        # Load .env from project root
        env_path = Path(__file__).parent.parent.parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)

        api_key = os.getenv("EP_ONLINE_API_KEY")

        if not api_key:
            print("\n" + "="*60)
            print("EP-Online API Key Required")
            print("="*60)
            print("\nTo scrape energy labels, you need a free API key from RVO.")
            print("\nSteps to get API key:")
            print("1. Go to: https://epbdwebservices.rvo.nl/")
            print("2. Request an API key (free, instant)")
            print("3. Set environment variable: EP_ONLINE_API_KEY=your_key")
            print("\nOr you can download the monthly total file manually:")
            print("https://public.ep-online.nl/api/v5/Mutatiebestand/DownloadInfo")
            print("="*60)

            # Allow user to input key for this session
            api_key = input("\nEnter API key (or press Enter to skip): ").strip()

            if not api_key:
                print("\n⚠️  No API key provided. Using manual download method.")
                return None

        return api_key

    async def init_client(self):
        """Initialize HTTP client"""
        headers = {
            "User-Agent": "WhereToLiveNL/1.0 (Energy Label Data Collection)",
            "Accept": "application/json"
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers=headers,
            follow_redirects=True
        )

    async def close_client(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()

    async def download_total_file(self) -> Dict[str, Any]:
        """
        Download the monthly total file with all energy labels.

        This file contains all currently valid energy labels in the Netherlands.
        Published on the 1st of each month.
        """
        if not self.client:
            await self.init_client()

        print("📥 Downloading EP-Online total file (all energy labels)...")
        print("This may take a few minutes - the file contains millions of records.")

        # Get download info
        info_url = f"{EP_ONLINE_BASE_URL}/Mutatiebestand/DownloadInfo"

        try:
            response = await self.client.get(info_url)
            response.raise_for_status()
            info = response.json()

            print(f"\n📊 File info:")
            print(f"  - Publication date: {info.get('publicatieDatum', 'Unknown')}")
            print(f"  - File type: {info.get('bestandsType', 'Unknown')}")

            # Download the actual file
            download_url = info.get('downloadUrl')
            if not download_url:
                download_url = f"{EP_ONLINE_BASE_URL}/Mutatiebestand/Download"

            print(f"\n⬇️  Downloading from: {download_url}")

            download_response = await self.client.get(download_url)
            download_response.raise_for_status()

            # The file is typically CSV format
            content = download_response.text

            # Save raw data
            raw_file = DATA_DIR / "energielabels_raw.csv"
            with open(raw_file, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"✅ Downloaded to: {raw_file}")

            return {
                "success": True,
                "file_path": str(raw_file),
                "info": info
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                print("\n❌ API key invalid or missing.")
                print("Get a free API key at: https://epbdwebservices.rvo.nl/")
                return {"success": False, "error": "Invalid API key"}
            else:
                print(f"\n❌ HTTP Error: {e.response.status_code}")
                return {"success": False, "error": str(e)}

        except Exception as e:
            print(f"\n❌ Error downloading file: {e}")
            return {"success": False, "error": str(e)}

    async def query_by_bag_id(self, bag_id: str) -> Optional[Dict[str, Any]]:
        """
        Query energy label by BAG ID (verblijfsobject ID).

        Args:
            bag_id: BAG verblijfsobject identificatie (e.g., "0363010000000001")

        Returns:
            Energy label data or None
        """
        if not self.client:
            await self.init_client()

        endpoint = f"{EP_ONLINE_BASE_URL}/PandLabel/Adres/{bag_id}"

        try:
            response = await self.client.get(endpoint)

            if response.status_code == 404:
                return None  # No energy label found

            response.raise_for_status()
            data = response.json()

            return self.parse_energy_label(data)

        except Exception as e:
            print(f"⚠️  Error querying BAG ID {bag_id}: {e}")
            return None

    def parse_energy_label(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse energy label data into standardized format"""

        # EP-Online labels: A++++ to G
        label_mapping = {
            "A++++": 1,
            "A+++": 2,
            "A++": 3,
            "A+": 4,
            "A": 5,
            "B": 6,
            "C": 7,
            "D": 8,
            "E": 9,
            "F": 10,
            "G": 11
        }

        label = data.get("labelLetter") or data.get("energieLabel")

        return {
            "bag_id": data.get("pandBagId") or data.get("bagVerblijfsobjectId"),
            "postal_code": data.get("postcode"),
            "house_number": data.get("huisnummer"),
            "house_number_suffix": data.get("huisnummerToevoeging"),
            "energy_label": label,
            "energy_label_numeric": label_mapping.get(label, 99),
            "registration_date": data.get("registratiedatum") or data.get("opnamedatum"),
            "valid_until": data.get("geldigTot"),
            "energy_index": data.get("energieIndex"),
            "energy_performance": data.get("energieprestatie"),
            "is_definitive": data.get("isDefinitief", True),
            "building_type": data.get("gebouwtype") or data.get("gebouwklasse"),
            "scraped_at": datetime.now().isoformat()
        }

    def convert_csv_to_parquet(self, csv_path: Path):
        """
        Convert the EP-Online CSV file to Parquet format.

        The CSV has these columns (typical):
        - Pand_bagverblijfsobjectid
        - Postcode
        - Huisnummer
        - Huisnummer_toev
        - Gebouwklasse
        - Energielabel
        - Registratiedatum
        - Energieindex
        """
        print(f"\n🔄 Converting CSV to Parquet...")

        try:
            # Read CSV with Polars (much faster than Pandas)
            df = pl.read_csv(
                csv_path,
                separator=';',  # EP-Online typically uses semicolon
                encoding='utf-8',
                ignore_errors=True
            )

            print(f"📊 Loaded {df.height:,} energy label records")

            # Standardize column names (EP-Online format may vary)
            column_mapping = {
                "Pand_bagverblijfsobjectid": "bag_id",
                "Postcode": "postal_code",
                "Huisnummer": "house_number",
                "Huisnummer_toev": "house_number_suffix",
                "Gebouwklasse": "building_type",
                "Energielabel": "energy_label",
                "Registratiedatum": "registration_date",
                "Energieindex": "energy_index",
                "Geldig_tot": "valid_until"
            }

            # Rename columns if they exist
            for old_name, new_name in column_mapping.items():
                if old_name in df.columns:
                    df = df.rename({old_name: new_name})

            # Add numeric energy label for sorting/filtering
            label_map = {
                "A++++": 1, "A+++": 2, "A++": 3, "A+": 4, "A": 5,
                "B": 6, "C": 7, "D": 8, "E": 9, "F": 10, "G": 11
            }

            if "energy_label" in df.columns:
                df = df.with_columns([
                    pl.col("energy_label").map_dict(label_map, default=99).alias("energy_label_numeric")
                ])

            # Clean postal codes (remove spaces, uppercase)
            if "postal_code" in df.columns:
                df = df.with_columns([
                    pl.col("postal_code").str.replace_all(" ", "").str.to_uppercase()
                ])

            # Write to Parquet (compressed)
            df.write_parquet(
                ENERGIELABEL_PARQUET,
                compression="snappy"
            )

            file_size_mb = ENERGIELABEL_PARQUET.stat().st_size / (1024 * 1024)
            print(f"✅ Saved to Parquet: {ENERGIELABEL_PARQUET}")
            print(f"📦 File size: {file_size_mb:.1f} MB")
            print(f"📊 Total records: {df.height:,}")

            # Show sample statistics
            if "energy_label" in df.columns:
                print("\n📊 Energy Label Distribution:")
                label_counts = df.group_by("energy_label").count().sort("energy_label")
                for row in label_counts.iter_rows(named=True):
                    print(f"  {row['energy_label']}: {row['count']:,}")

            return True

        except Exception as e:
            print(f"❌ Error converting to Parquet: {e}")
            return False

    async def run(self):
        """Main execution"""
        try:
            await self.init_client()

            # Download the monthly total file
            result = await self.download_total_file()

            if result.get("success"):
                # Convert to Parquet
                csv_path = Path(result["file_path"])
                self.convert_csv_to_parquet(csv_path)
            else:
                print("\n⚠️  Download failed. You can manually download from:")
                print("https://public.ep-online.nl/api/v5/Mutatiebestand/Download")

        finally:
            await self.close_client()


async def main():
    """Main entry point"""
    scraper = EnergielabelScraper()
    await scraper.run()


if __name__ == "__main__":
    import sys
    import io

    # Fix Windows console encoding for emojis
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🏷️  EP-Online Energielabel Scraper")
    print("=" * 60)
    print("Downloading all energy labels in the Netherlands")
    print("Source: RVO EP-Online (official government database)")
    print("=" * 60)
    print()

    asyncio.run(main())
