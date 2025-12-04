"""
Create properties dataset with building characteristics from BAG.

This script builds a properties.parquet file with physical building details:
- BAG data: Square meters, building year, type, rooms, monument status
- Energy labels: (to be added when EP-Online API is working)

Note: WOZ valuations remain in separate woz-netherlands-complete.parquet
      Join via postal_code + house_number when needed.

Output: data/processed/properties.parquet
"""

import polars as pl
from pathlib import Path
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional
from tqdm import tqdm

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
BAG_DIR = DATA_DIR / "raw" / "bag_extract" / "xml"
OUTPUT_FILE = DATA_DIR / "processed" / "properties.parquet"

# BAG XML namespaces (updated for 2025 extract format)
BAG_NS = {
    'sl-bag-extract': 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601',
    'Objecten': 'www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601',
    'Objecten-ref': 'www.kadaster.nl/schemas/lvbag/imbag/objecten-ref/v20200601',
    'gml': 'http://www.opengis.net/gml/3.2'
}


def extract_vbo_from_xml(xml_file: Path, limit: Optional[int] = None) -> List[Dict]:
    """
    Extract verblijfsobject (residential unit) data from BAG XML.

    Args:
        xml_file: Path to BAG VBO XML file
        limit: Optional limit for testing

    Returns:
        List of property dictionaries
    """
    properties = []

    try:
        print(f"📂 Parsing {xml_file.name}...")
        tree = ET.parse(xml_file)
        root = tree.getroot()

        # Find all verblijfsobjecten (using correct namespace)
        vbos = root.findall('.//Objecten:Verblijfsobject', BAG_NS)

        if limit:
            vbos = vbos[:limit]

        print(f"Found {len(vbos)} verblijfsobjecten")

        for vbo in tqdm(vbos, desc="Extracting properties"):
            try:
                prop = extract_vbo_properties(vbo)
                if prop:
                    properties.append(prop)
            except Exception as e:
                # Skip problematic records
                continue

    except Exception as e:
        print(f"❌ Error parsing XML: {e}")

    return properties


def extract_vbo_properties(vbo: ET.Element) -> Optional[Dict]:
    """Extract property details from a single verblijfsobject XML element."""
    try:
        # BAG ID
        identificatie = vbo.find('.//Objecten:identificatie', BAG_NS)
        if identificatie is None:
            return None

        bag_id = identificatie.text

        # Address components (nummeraanduiding reference)
        hoofdadres = vbo.find('.//Objecten:heeftAlsHoofdadres', BAG_NS)

        # Extract nested address data
        nummeraanduiding_id = None
        if hoofdadres is not None:
            num_ref = hoofdadres.find('.//Objecten-ref:NummeraanduidingRef', BAG_NS)
            if num_ref is not None:
                nummeraanduiding_id = num_ref.text

        # Surface area (oppervlakte)
        oppervlakte_elem = vbo.find('.//Objecten:oppervlakte', BAG_NS)
        oppervlakte = int(oppervlakte_elem.text) if oppervlakte_elem is not None else None

        # Status
        status_elem = vbo.find('.//Objecten:status', BAG_NS)
        status = status_elem.text if status_elem is not None else None

        # Building year (bouwjaar) - from related pand
        bouwjaar = None
        pand_ref = vbo.find('.//Objecten:maaktDeelUitVan', BAG_NS)
        if pand_ref is not None:
            # Extract pand ID from reference
            pand_id_elem = pand_ref.find('.//Objecten-ref:PandRef', BAG_NS)
            pand_id = pand_id_elem.text if pand_id_elem is not None else None
        else:
            pand_id = None

        # Usage (gebruiksdoel)
        gebruiksdoelen = vbo.findall('.//Objecten:gebruiksdoel', BAG_NS)
        gebruiksdoel = gebruiksdoelen[0].text if gebruiksdoelen else None

        # Coordinates (centroid) - RD coordinates (EPSG:28992)
        geo_point = vbo.find('.//gml:pos', BAG_NS)
        if geo_point is not None:
            coords = geo_point.text.split()
            if len(coords) >= 2:
                # RD coordinates: X, Y (need conversion to lat/lon later)
                rd_x, rd_y = float(coords[0]), float(coords[1])
            else:
                rd_x, rd_y = None, None
        else:
            rd_x, rd_y = None, None

        return {
            'bag_id': bag_id,
            'nummeraanduiding_id': nummeraanduiding_id,
            'pand_id': pand_id,
            'surface_area_m2': oppervlakte,
            'status': status,
            'usage_type': gebruiksdoel,
            'rd_x': rd_x,
            'rd_y': rd_y
        }

    except Exception as e:
        return None


# WOZ merging removed - keep WOZ in separate dataset for cleaner architecture


def main():
    """Main execution."""
    print("🏠 Creating Properties Dataset")
    print("=" * 60)

    # Find VBO XML files
    vbo_files = sorted(list(BAG_DIR.glob("**/*VBO*.xml"))) if BAG_DIR.exists() else []

    if not vbo_files:
        print(f"❌ No VBO XML files found in {BAG_DIR}")
        print("\nExpected files: 9999VBO08112025-*.xml")
        print("Please extract the BAG data first.")
        return

    print(f"✅ Found {len(vbo_files)} VBO XML files")

    all_properties = []

    # Process first 10 files for testing (each has ~5000 properties)
    max_files = 10
    print(f"\n⚠️  Processing first {max_files} files for testing")

    for vbo_file in vbo_files[:max_files]:
        properties = extract_vbo_from_xml(vbo_file, limit=None)  # No limit per file
        all_properties.extend(properties)

    if not all_properties:
        print("❌ No properties extracted")
        return

    print(f"\n✅ Extracted {len(all_properties):,} properties")

    # Convert to Polars DataFrame
    df = pl.DataFrame(all_properties)

    # Show statistics
    print("\n📊 Properties Statistics:")
    print(f"  Total properties: {len(df):,}")
    print(f"  With surface area: {df.filter(pl.col('surface_area_m2').is_not_null()).height:,}")
    print(f"  With coordinates: {df.filter(pl.col('rd_x').is_not_null()).height:,}")
    print(f"  With pand_id: {df.filter(pl.col('pand_id').is_not_null()).height:,}")

    if 'surface_area_m2' in df.columns:
        surface_stats = df.select(pl.col('surface_area_m2')).describe()
        print("\n  Surface Area Statistics (m²):")
        print(surface_stats)

    # Save to Parquet
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUTPUT_FILE, compression='snappy')

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"\n✅ Saved to: {OUTPUT_FILE}")
    print(f"📦 File size: {file_size_mb:.1f} MB")

    # Show sample
    print("\n📋 Sample Properties:")
    print(df.head(5))


if __name__ == "__main__":
    import sys
    import io

    # Fix Windows console encoding
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    main()
