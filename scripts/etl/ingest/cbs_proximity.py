"""
CBS Proximity to Facilities Data (Nabijheid Voorzieningen)

Fetches average distances to various facilities at neighborhood/municipality level.
Dataset: 86134NED - Proximity to facilities; distance/location, districts and neighborhoods 2024

Data includes distances to:
- Schools (primary, secondary)
- General practitioners (huisartsen)
- Libraries (bibliotheken)
- Restaurants
- Train stations
- Childcare (kinderdagverblijven)
- Museums
- Performance venues (podiumkunsten)
- Concert halls (poppodium)
- Supermarkets
- And more...

Source: CBS OpenData
License: CC-BY 4.0
"""

import requests
import json
import polars as pl
from pathlib import Path
from typing import List, Dict, Any
import time

# CBS OData API endpoint
CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata/86134NED"

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_FILE = DATA_DIR / "cbs_proximity.json"

PROCESSED_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_PARQUET = PROCESSED_DIR / "cbs_proximity.parquet"


def fetch_table_info():
    """Get metadata about the table structure"""
    print("📊 Fetching table metadata...")

    url = f"{CBS_ODATA_BASE}/TableInfos"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    data = response.json()
    print(f"✅ Table: {data['value'][0].get('Title', 'Unknown')}")
    return data


def fetch_dimension(dimension_name: str) -> List[Dict[str, Any]]:
    """Fetch a dimension table (e.g., WijkenEnBuurten, Perioden)"""
    print(f"📥 Fetching dimension: {dimension_name}")

    url = f"{CBS_ODATA_BASE}/{dimension_name}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    data = response.json()
    items = data.get('value', [])
    print(f"   Found {len(items)} items")
    return items


def fetch_typed_dataset() -> List[Dict[str, Any]]:
    """Fetch the main data using TypedDataSet endpoint"""
    print("📥 Fetching proximity data...")

    all_data = []
    skip = 0
    top = 5000  # Smaller batch size to avoid API limits

    while True:
        # Add filter to get valid records only (skip totals/aggregates)
        url = f"{CBS_ODATA_BASE}/TypedDataSet?$skip={skip}&$top={top}"
        print(f"   Fetching batch {skip // top + 1} (skip={skip})...")

        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()

            data = response.json()
            items = data.get('value', [])

            if not items:
                break

            all_data.extend(items)
            print(f"   Retrieved {len(items)} records (total: {len(all_data)})")

            # Check if there are more results
            if len(items) < top:
                break

            skip += top
            time.sleep(0.5)  # Be nice to the API

        except requests.exceptions.HTTPError as e:
            if '500' in str(e) and 'not allowed' in str(e):
                # Hit API limit - try with even smaller batch
                if top > 1000:
                    top = 1000
                    print(f"   ⚠️  Reducing batch size to {top}")
                    continue
                else:
                    print(f"   ℹ️  Reached API limit at {len(all_data)} records")
                    break
            raise

    print(f"✅ Total records fetched: {len(all_data)}")
    return all_data


def process_data(raw_data: List[Dict], area_map: Dict) -> List[Dict]:
    """Process and enrich the raw data"""
    print("\n🔄 Processing and enriching data...")

    processed = []
    for record in raw_data:
        # Get area code and name
        area_key = record.get('WijkenEnBuurten')
        area_name = area_map.get(area_key, 'Unknown')

        # This dataset is for 2024 only (no period dimension)
        period = '2024'

        # Extract area type (GM = gemeente, WK = wijk, BU = buurt)
        if area_key:
            if area_key.startswith('GM'):
                area_type = 'Municipality'
            elif area_key.startswith('WK'):
                area_type = 'Wijk'
            elif area_key.startswith('BU'):
                area_type = 'Buurt'
            else:
                area_type = 'Other'
        else:
            area_type = 'Unknown'

        processed_record = {
            'area_code': area_key,
            'area_name': area_name,
            'area_type': area_type,
            'period': period,

            # Healthcare distances (in km)
            'dist_to_gp_km': record.get('AfstandTotHuisartsenpraktijk_5'),
            'gp_within_1km': record.get('Binnen1Km_6'),
            'gp_within_3km': record.get('Binnen3Km_7'),
            'gp_within_5km': record.get('Binnen5Km_8'),
            'dist_to_gp_emergency_km': record.get('AfstandTotHuisartsenpost_9'),
            'dist_to_pharmacy_km': record.get('AfstandTotApotheek_10'),
            'dist_to_hospital_km': record.get('AfstandTotZiekenhuis_11'),
            'hospital_within_5km': record.get('Binnen5Km_12'),
            'hospital_within_10km': record.get('Binnen10Km_13'),
            'hospital_within_20km': record.get('Binnen20Km_14'),

            # Shopping
            'dist_to_supermarket_km': record.get('AfstandTotGroteSupermarkt_24'),
            'supermarket_within_1km': record.get('Binnen1Km_25'),
            'supermarket_within_3km': record.get('Binnen3Km_26'),
            'supermarket_within_5km': record.get('Binnen5Km_27'),
            'dist_to_daily_groceries_km': record.get('AfstandTotOvDagelLevensmiddelen_28'),
            'daily_groceries_within_1km': record.get('Binnen1Km_29'),
            'daily_groceries_within_3km': record.get('Binnen3Km_30'),
            'daily_groceries_within_5km': record.get('Binnen5Km_31'),
            'dist_to_department_store_km': record.get('AfstandTotWarenhuis_32'),

            # Dining & Entertainment
            'dist_to_cafe_km': record.get('AfstandTotCafeED_36'),
            'cafe_within_1km': record.get('Binnen1Km_37'),
            'cafe_within_3km': record.get('Binnen3Km_38'),
            'dist_to_cafetaria_km': record.get('AfstandTotCafetariaED_40'),
            'dist_to_restaurant_km': record.get('AfstandTotRestaurant_44'),
            'restaurant_within_1km': record.get('Binnen1Km_45'),
            'restaurant_within_3km': record.get('Binnen3Km_46'),
            'dist_to_hotel_km': record.get('AfstandTotHotelED_48'),

            # Childcare & Education
            'dist_to_daycare_km': record.get('AfstandTotKinderdagverblijf_52'),
            'daycare_within_1km': record.get('Binnen1Km_53'),
            'daycare_within_3km': record.get('Binnen3Km_54'),
            'dist_to_after_school_km': record.get('AfstandTotBuitenschoolseOpvang_56'),
            'dist_to_primary_school_km': record.get('AfstandTotSchool_60'),
            'primary_school_within_1km': record.get('Binnen1Km_61'),
            'primary_school_within_3km': record.get('Binnen3Km_62'),
            'dist_to_secondary_school_km': record.get('AfstandTotSchool_64'),  # VMBO/HAVO/VWO combined
            'dist_to_mbo_km': record.get('AfstandTotSchool_72'),

            # Transport
            'dist_to_train_station_km': record.get('AfstandTotTreinstationsTotaal_90'),
            'dist_to_major_train_station_km': record.get('AfstandTotBelangrijkOverstapstation_91'),
            'dist_to_highway_onramp_km': record.get('AfstandTotOpritHoofdverkeersweg_89'),

            # Culture & Recreation
            'dist_to_library_km': record.get('AfstandTotBibliotheek_92'),
            'dist_to_swimming_pool_km': record.get('AfstandTotBinnenzwembad_93'),
            'dist_to_ice_rink_km': record.get('AfstandTotKunstijsbaan_94'),
            'dist_to_museum_km': record.get('AfstandTotMuseum_95'),
            'museum_within_5km': record.get('Binnen5Km_96'),
            'museum_within_10km': record.get('Binnen10Km_97'),
            'museum_within_20km': record.get('Binnen20Km_98'),
            'dist_to_theater_km': record.get('AfstandTotPodiumkunstenTotaal_99'),
            'theater_within_5km': record.get('Binnen5Km_100'),
            'theater_within_10km': record.get('Binnen10Km_101'),
            'dist_to_concert_hall_km': record.get('AfstandTotPoppodium_103'),
            'dist_to_cinema_km': record.get('AfstandTotBioscoop_104'),
            'cinema_within_5km': record.get('Binnen5Km_105'),
            'cinema_within_10km': record.get('Binnen10Km_106'),
            'dist_to_attraction_km': record.get('AfstandTotAttractie_110'),
            'attraction_within_10km': record.get('Binnen10Km_111'),
            'attraction_within_20km': record.get('Binnen20Km_112'),
        }

        processed.append(processed_record)

    print(f"✅ Processed {len(processed)} records")
    return processed


def save_to_json(data: List[Dict]):
    """Save data to JSON file"""
    print(f"\n💾 Saving to {OUTPUT_FILE}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"✅ Saved {len(data)} records ({file_size_mb:.2f} MB)")


def convert_to_parquet(data: List[Dict]):
    """Convert to Parquet format for fast queries"""
    print(f"\n🔄 Converting to Parquet...")

    df = pl.DataFrame(data)

    # No need to filter - this dataset is 2024 only
    df.write_parquet(
        OUTPUT_PARQUET,
        compression="snappy"
    )

    file_size_kb = OUTPUT_PARQUET.stat().st_size / 1024
    print(f"✅ Saved to Parquet: {OUTPUT_PARQUET}")
    print(f"📦 File size: {file_size_kb:.1f} KB")
    print(f"📊 Total records: {df.height}")

    # Show sample statistics
    print("\n📋 Sample data by area type:")
    summary = df.group_by('area_type').agg([
        pl.count('area_code').alias('count'),
        pl.mean('dist_to_train_station_km').alias('avg_dist_to_train'),
        pl.mean('dist_to_supermarket_km').alias('avg_dist_to_supermarket'),
    ])
    print(summary)


def main():
    """Main execution"""
    import sys
    import io
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    print("=" * 80)
    print("📍 CBS Proximity to Facilities Data Fetcher")
    print("=" * 80)
    print()

    try:
        # Fetch metadata
        fetch_table_info()

        # Fetch dimension tables
        areas = fetch_dimension('WijkenEnBuurten')

        # Create lookup maps (no periods dimension for this dataset)
        area_map = {item['Key']: item['Title'] for item in areas}
        print(f"\n✅ Created lookup map ({len(area_map)} areas)")

        # Fetch main data
        raw_data = fetch_typed_dataset()

        if not raw_data:
            print("\n❌ No data fetched. Exiting.")
            return

        # Process and enrich
        processed_data = process_data(raw_data, area_map)

        # Save to JSON
        save_to_json(processed_data)

        # Convert to Parquet
        convert_to_parquet(processed_data)

        print("\n" + "=" * 80)
        print("✅ COMPLETE")
        print("=" * 80)
        print(f"\nFiles created:")
        print(f"  - {OUTPUT_FILE}")
        print(f"  - {OUTPUT_PARQUET}")
        print()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
