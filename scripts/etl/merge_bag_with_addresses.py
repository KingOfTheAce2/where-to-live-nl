"""
Merge BAG VBO building details with address information.

This script:
1. Parses NUM (nummeraanduiding) XML files to get address mapping
2. Joins VBO building details with addresses
3. Creates final enriched properties.parquet
"""

import polars as pl
from pathlib import Path
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional
from tqdm import tqdm

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
BAG_DIR = DATA_DIR / "raw" / "bag_extract" / "xml"
ADDRESSES_FILE = DATA_DIR / "processed" / "addresses.parquet"
BAG_VBO_FILE = DATA_DIR / "processed" / "bag_vbo_temp.parquet"
OUTPUT_FILE = DATA_DIR / "processed" / "properties.parquet"

# BAG XML namespaces
BAG_NS = {
    'sl-bag-extract': 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601',
    'Objecten': 'www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601',
    'Objecten-ref': 'www.kadaster.nl/schemas/lvbag/imbag/objecten-ref/v20200601',
}


def extract_num_from_xml(xml_file: Path, limit: Optional[int] = None) -> List[Dict]:
    """
    Extract nummeraanduiding (address) data from BAG NUM XML.

    Args:
        xml_file: Path to BAG NUM XML file
        limit: Optional limit for testing

    Returns:
        List of nummeraanduiding dictionaries
    """
    nummeraanduidingen = []

    try:
        print(f"📂 Parsing {xml_file.name}...")
        tree = ET.parse(xml_file)
        root = tree.getroot()

        # Find all nummeraanduidingen
        nums = root.findall('.//Objecten:Nummeraanduiding', BAG_NS)

        if limit:
            nums = nums[:limit]

        print(f"Found {len(nums)} nummeraanduidingen")

        for num in tqdm(nums, desc="Extracting addresses"):
            try:
                num_data = extract_num_properties(num)
                if num_data:
                    nummeraanduidingen.append(num_data)
            except Exception as e:
                # Skip problematic records
                continue

    except Exception as e:
        print(f"❌ Error parsing XML: {e}")

    return nummeraanduidingen


def extract_num_properties(num: ET.Element) -> Optional[Dict]:
    """Extract address details from a single nummeraanduiding XML element."""
    try:
        # NUM ID
        identificatie = num.find('.//Objecten:identificatie', BAG_NS)
        if identificatie is None:
            return None

        num_id = identificatie.text

        # Status - only include active addresses
        status_elem = num.find('.//Objecten:status', BAG_NS)
        status = status_elem.text if status_elem is not None else None

        # Skip if not active
        if status != "Naamgeving uitgegeven":
            return None

        # Postal code
        postcode_elem = num.find('.//Objecten:postcode', BAG_NS)
        postcode = postcode_elem.text if postcode_elem is not None else None

        # House number
        huisnummer_elem = num.find('.//Objecten:huisnummer', BAG_NS)
        huisnummer = int(huisnummer_elem.text) if huisnummer_elem is not None else None

        # House letter
        huisletter_elem = num.find('.//Objecten:huisletter', BAG_NS)
        huisletter = huisletter_elem.text if huisletter_elem is not None else None

        # House addition
        toevoeging_elem = num.find('.//Objecten:huisnummertoevoeging', BAG_NS)
        toevoeging = toevoeging_elem.text if toevoeging_elem is not None else None

        return {
            'nummeraanduiding_id': num_id,
            'postal_code': postcode,
            'house_number': huisnummer,
            'house_letter': huisletter,
            'house_addition': toevoeging
        }

    except Exception as e:
        return None


def main():
    """Main execution."""
    import sys
    import io

    # Fix Windows console encoding
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🏠 Merging BAG Building Details with Addresses")
    print("=" * 60)

    # Step 1: Load existing BAG VBO data (currently in properties.parquet)
    print("\n📂 Step 1: Loading BAG VBO building details...")

    if not OUTPUT_FILE.exists():
        print(f"❌ BAG VBO file not found: {OUTPUT_FILE}")
        print("Run create_properties_dataset.py first to extract VBO data")
        return

    bag_vbo_df = pl.read_parquet(OUTPUT_FILE)
    print(f"✅ Loaded {len(bag_vbo_df):,} VBO records")

    # Rename to temp file for backup
    print(f"📦 Backing up to: {BAG_VBO_FILE}")
    bag_vbo_df.write_parquet(BAG_VBO_FILE)

    # Step 2: Parse NUM XML files
    print("\n📂 Step 2: Parsing NUM XML files for address mapping...")

    num_files = sorted(list(BAG_DIR.glob("**/*NUM*.xml"))) if BAG_DIR.exists() else []

    if not num_files:
        print(f"❌ No NUM XML files found in {BAG_DIR}")
        return

    print(f"✅ Found {len(num_files)} NUM XML files")

    all_nummeraanduidingen = []

    # Process first 10 files for testing (matching VBO file count)
    max_files = 10
    print(f"\n⚠️  Processing first {max_files} files for testing")

    for num_file in num_files[:max_files]:
        nummeraanduidingen = extract_num_from_xml(num_file, limit=None)
        all_nummeraanduidingen.extend(nummeraanduidingen)

    if not all_nummeraanduidingen:
        print("❌ No nummeraanduidingen extracted")
        return

    print(f"\n✅ Extracted {len(all_nummeraanduidingen):,} address mappings")

    # Convert to DataFrame
    num_df = pl.DataFrame(all_nummeraanduidingen)

    print("\n📋 Sample address mappings:")
    print(num_df.head(5))

    # Step 3: Join VBO with address mapping
    print("\n🔗 Step 3: Joining VBO building details with addresses...")

    merged_df = bag_vbo_df.join(
        num_df,
        on='nummeraanduiding_id',
        how='left'
    )

    print(f"✅ Merged {len(merged_df):,} properties")
    print(f"   With postal codes: {merged_df.filter(pl.col('postal_code').is_not_null()).height:,}")

    # Step 4: Load addresses.parquet and enrich it
    print("\n📂 Step 4: Loading addresses.parquet...")

    if not ADDRESSES_FILE.exists():
        print(f"❌ Addresses file not found: {ADDRESSES_FILE}")
        return

    addresses_df = pl.read_parquet(ADDRESSES_FILE)
    print(f"✅ Loaded {len(addresses_df):,} addresses")

    # Add placeholder columns if they don't exist
    for col in ['surface_area_m2', 'building_year', 'building_type',
                'num_rooms', 'energy_label', 'monument', 'status', 'usage_type']:
        if col not in addresses_df.columns:
            dtype = pl.Int32 if 'area' in col or 'year' in col or 'rooms' in col else (
                pl.Boolean if col == 'monument' else pl.Utf8
            )
            addresses_df = addresses_df.with_columns([
                pl.lit(None, dtype=dtype).alias(col)
            ])

    # Step 5: Merge with addresses.parquet based on postal_code + house_number
    print("\n🔗 Step 5: Enriching addresses with BAG building details...")

    # Prepare merged_df for join (select BAG-specific columns)
    bag_enrichment = merged_df.select([
        'postal_code',
        'house_number',
        'house_letter',
        'house_addition',
        'surface_area_m2',
        'status',
        'usage_type',
        'bag_id',
        'pand_id',
        'rd_x',
        'rd_y'
    ]).filter(
        pl.col('postal_code').is_not_null()
    ).with_columns([
        # Cast house_number to i32 to match addresses_df
        pl.col('house_number').cast(pl.Int32)
    ])

    # Join with addresses
    enriched_df = addresses_df.join(
        bag_enrichment,
        on=['postal_code', 'house_number', 'house_letter', 'house_addition'],
        how='left',
        suffix='_bag'
    )

    # Update null values in addresses with BAG data
    if 'surface_area_m2_bag' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('surface_area_m2'), pl.col('surface_area_m2_bag')]).alias('surface_area_m2')
        ])

    if 'status_bag' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('status'), pl.col('status_bag')]).alias('status')
        ])

    if 'usage_type_bag' in enriched_df.columns:
        enriched_df = enriched_df.with_columns([
            pl.coalesce([pl.col('usage_type'), pl.col('usage_type_bag')]).alias('usage_type')
        ])

    # Add new columns if they don't exist
    if 'bag_id' not in addresses_df.columns and 'bag_id' in enriched_df.columns:
        pass  # Keep bag_id from join

    if 'pand_id' not in addresses_df.columns and 'pand_id' in enriched_df.columns:
        pass  # Keep pand_id from join

    # Drop duplicate columns
    enriched_df = enriched_df.select([
        col for col in enriched_df.columns
        if not col.endswith('_bag')
    ])

    # Show statistics
    print("\n📊 Enriched Properties Statistics:")
    print(f"  Total properties: {len(enriched_df):,}")
    print(f"  With surface area: {enriched_df.filter(pl.col('surface_area_m2').is_not_null()).height:,}")
    print(f"  With BAG ID: {enriched_df.filter(pl.col('bag_id').is_not_null()).height:,}")

    if enriched_df.filter(pl.col('surface_area_m2').is_not_null()).height > 0:
        surface_stats = enriched_df.filter(
            pl.col('surface_area_m2').is_not_null()
        ).select(pl.col('surface_area_m2')).describe()
        print("\n  Surface Area Statistics (m²):")
        print(surface_stats)

    # Save to Parquet
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    enriched_df.write_parquet(OUTPUT_FILE, compression='snappy')

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"\n✅ Saved enriched properties to: {OUTPUT_FILE}")
    print(f"📦 File size: {file_size_mb:.1f} MB")

    # Show sample
    print("\n📋 Sample Enriched Properties:")
    print(enriched_df.select([
        'postal_code', 'house_number', 'city',
        'surface_area_m2', 'usage_type', 'status'
    ]).head(5))


if __name__ == "__main__":
    main()
