"""
Ingest BAG property details using PDOK BAG API.

This is faster than parsing the entire 1.2GB XML file.
We'll query the API for addresses we care about.

API: https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/
"""

import polars as pl
import httpx
from pathlib import Path
from typing import Optional, Dict
from tqdm import tqdm
import time

# Output
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "processed" / "properties.parquet"

# PDOK BAG API
BAG_API_BASE = "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2"

# Load addresses to enrich
ADDRESSES_FILE = DATA_DIR / "processed" / "addresses.parquet"


def get_property_details(postal_code: str, house_number: int,
                         house_letter: str = None, addition: str = None) -> Optional[Dict]:
    """
    Get property details from BAG API.

    Args:
        postal_code: Postal code (e.g., "1011AB")
        house_number: House number
        house_letter: Optional letter suffix
        addition: Optional addition

    Returns:
        Property details or None
    """
    # Clean postal code
    postal_code = postal_code.replace(" ", "").upper()

    # Build query
    url = f"{BAG_API_BASE}/adressen"
    params = {
        "postcode": postal_code,
        "huisnummer": house_number
    }

    if house_letter:
        params["huisletter"] = house_letter
    if addition:
        params["huisnummertoevoeging"] = addition

    try:
        response = httpx.get(url, params=params, timeout=10)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        data = response.json()

        # Extract verblijfsobject (residential unit) ID
        if "_embedded" not in data or "adressen" not in data["_embedded"]:
            return None

        addresses = data["_embedded"]["adressen"]
        if not addresses:
            return None

        address = addresses[0]

        # Get verblijfsobject details
        vbo_link = address.get("_links", {}).get("adresseerbaarObject", {}).get("href")
        if not vbo_link:
            return None

        # Fetch verblijfsobject
        vbo_response = httpx.get(vbo_link, timeout=10)
        vbo_response.raise_for_status()
        vbo_data = vbo_response.json()

        # Extract property details
        return {
            "bag_id": vbo_data.get("identificatie"),
            "surface_area_m2": vbo_data.get("oppervlakte"),
            "status": vbo_data.get("status"),
            "usage_type": vbo_data.get("gebruiksdoel", [None])[0] if vbo_data.get("gebruiksdoel") else None,
        }

    except Exception as e:
        return None


def main():
    """Create properties dataset."""
    import sys
    import io

    # Fix encoding
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🏠 Creating Properties Dataset from BAG API")
    print("=" * 60)

    # Load addresses
    if not ADDRESSES_FILE.exists():
        print(f"❌ Addresses file not found: {ADDRESSES_FILE}")
        return

    print(f"📂 Loading addresses from {ADDRESSES_FILE}")
    addresses_df = pl.read_parquet(ADDRESSES_FILE)

    print(f"✅ Loaded {len(addresses_df):,} addresses")

    # Sample for testing
    sample_size = 1000
    print(f"\n⚠️  Processing sample of {sample_size} addresses for testing")
    sample_df = addresses_df.head(sample_size)

    properties = []

    print("\n🔍 Fetching property details from BAG API...")
    for row in tqdm(sample_df.iter_rows(named=True), total=len(sample_df)):
        details = get_property_details(
            row["postal_code"],
            row["house_number"],
            row.get("house_letter"),
            row.get("house_addition")
        )

        if details:
            properties.append({
                **row,  # Include address fields
                **details  # Add property details
            })

        # Rate limiting
        time.sleep(0.1)  # 10 req/sec

    print(f"\n✅ Retrieved details for {len(properties):,} properties")

    if not properties:
        print("❌ No properties retrieved")
        return

    # Convert to DataFrame
    props_df = pl.DataFrame(properties)

    # Show statistics
    print("\n📊 Properties Statistics:")
    print(f"  Total: {len(props_df):,}")
    print(f"  With surface area: {props_df.filter(pl.col('surface_area_m2').is_not_null()).height:,}")

    if props_df.filter(pl.col('surface_area_m2').is_not_null()).height > 0:
        print(f"\n  Surface Area Stats (m²):")
        print(f"    Mean: {props_df['surface_area_m2'].mean():.1f}")
        print(f"    Median: {props_df['surface_area_m2'].median():.1f}")
        print(f"    Min: {props_df['surface_area_m2'].min():.1f}")
        print(f"    Max: {props_df['surface_area_m2'].max():.1f}")

    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    props_df.write_parquet(OUTPUT_FILE, compression='snappy')

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"\n✅ Saved to: {OUTPUT_FILE}")
    print(f"📦 File size: {file_size_mb:.2f} MB")

    # Show sample
    print("\n📋 Sample Properties:")
    print(props_df.select(['postal_code', 'house_number', 'surface_area_m2', 'usage_type']).head(5))

    print("\n⚠️  Note: This is a SAMPLE dataset (1000 properties)")
    print("For full dataset, remove the sample_size limit and run overnight.")


if __name__ == "__main__":
    main()
