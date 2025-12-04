"""
Download and ingest BAG 2.0 enhanced data to enrich addresses.parquet.

This script downloads the official BAG extract and adds:
- oppervlakte (floor area in m²)
- oorspronkelijkBouwjaar (year built)
- gebruiksdoel (building purpose)
- pand.geometrie (building footprint)

Data source: Kadaster BAG 2.0
License: CC0 1.0 Universal
Size: ~8GB compressed, ~50GB uncompressed
"""

import requests
import zipfile
import xml.etree.ElementTree as ET
import polars as pl
from pathlib import Path
import json
from typing import Dict, Any, Optional
from tqdm import tqdm
import tempfile
import os
import sys

# Paths
SCRIPT_DIR = Path(__file__).parent
# Use the main data directory, not scripts/data
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Files
ADDRESSES_FILE = PROCESSED_DIR / "addresses.parquet"
ADDRESSES_ENRICHED_FILE = PROCESSED_DIR / "addresses_enriched.parquet"
BAG_DOWNLOAD_DIR = RAW_DIR / "bag_extract"
BAG_XML_DIR = BAG_DOWNLOAD_DIR / "xml"  # Extract XMLs to subdirectory
BAG_DOWNLOAD_DIR.mkdir(exist_ok=True)
BAG_XML_DIR.mkdir(exist_ok=True)

# BAG Download URL (updated quarterly)
BAG_EXTRACT_URL = "https://service.pdok.nl/lv/bag/atom/downloads/lvbag-extract-nl.zip"

# XML Namespaces
NAMESPACES = {
    'bag': 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601',
    'bag-lvc': 'http://www.kadaster.nl/schemas/imbag/lvc/v20200601',
    'bag-obj': 'http://www.kadaster.nl/schemas/imbag/objecten/v20200601',  # Correct namespace for objects
    'sl': 'http://www.kadaster.nl/schemas/standlevering-generiek/1.0',
    'gml': 'http://www.opengis.net/gml/3.2'
}


def download_bag_extract(skip_confirm=False):
    """
    Download BAG extract from PDOK.

    WARNING: This is an 8GB+ download and will take 30-60 minutes on fast connection!
    """
    print("=" * 70)
    print("BAG 2.0 ENHANCED DATA DOWNLOAD")
    print("=" * 70)
    print()
    print("WARNING: This will download ~8GB of data!")
    print("Estimated download time: 30-90 minutes depending on connection")
    print()

    if not skip_confirm:
        response = input("Continue with download? (yes/no): ")
        if response.lower() != 'yes':
            print("Download cancelled.")
            return False

    print(f"\n[DOWNLOAD] Downloading BAG extract from {BAG_EXTRACT_URL}")
    print("This will take a while... Go get a coffee!")

    zip_file = BAG_DOWNLOAD_DIR / "lvbag-extract-nl.zip"

    try:
        # Stream download with progress bar
        response = requests.get(BAG_EXTRACT_URL, stream=True)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))

        with open(zip_file, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True, desc="Downloading") as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))

        print(f"[OK] Downloaded to {zip_file}")
        print(f"[OK] File size: {zip_file.stat().st_size / (1024**3):.2f} GB")

        return True

    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        return False


def extract_bag_files():
    """
    Extract only the needed files from BAG extract.

    We only need:
    - VerblijfsObject (residential units)
    - Pand (buildings)
    - Nummeraanduiding (address designations)

    The BAG extract contains nested ZIP files that need to be extracted.
    """
    zip_file = BAG_DOWNLOAD_DIR / "lvbag-extract-nl.zip"

    if not zip_file.exists():
        print(f"[ERROR] BAG extract not found at {zip_file}")
        print("Run download_bag_extract() first")
        return False

    print(f"\n[EXTRACT] Extracting BAG files...")
    print("This will take 10-20 minutes...")

    needed_files = [
        '9999VBO',  # VerblijfsObjecten
        '9999PND',  # Panden
        '9999NUM',  # Nummeraanduidingen
    ]

    try:
        # Step 1: Extract nested ZIP files from main archive
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            all_files = zip_ref.namelist()
            files_to_extract = [f for f in all_files if any(needed in f for needed in needed_files)]

            print(f"[OK] Found {len(files_to_extract)} ZIP files to extract")

            for file in tqdm(files_to_extract, desc="Extracting nested ZIPs"):
                zip_ref.extract(file, BAG_DOWNLOAD_DIR)

        # Step 2: Extract XML files from nested ZIPs
        nested_zips = list(BAG_DOWNLOAD_DIR.glob("**/*.zip"))
        # Exclude the main zip
        nested_zips = [z for z in nested_zips if z.name != "lvbag-extract-nl.zip"]

        print(f"\n[EXTRACT] Extracting XML files from {len(nested_zips)} nested ZIPs...")

        for nested_zip in tqdm(nested_zips, desc="Extracting XMLs"):
            try:
                with zipfile.ZipFile(nested_zip, 'r') as zip_ref:
                    # Extract all XML files from this nested zip
                    xml_files = [f for f in zip_ref.namelist() if f.endswith('.xml')]
                    for xml_file in xml_files:
                        zip_ref.extract(xml_file, BAG_XML_DIR)
            except Exception as e:
                print(f"\n[WARNING] Failed to extract {nested_zip.name}: {e}")
                continue

        # Count extracted XML files
        xml_count = len(list(BAG_XML_DIR.glob("**/*.xml")))
        print(f"[OK] Extracted {xml_count} XML files to {BAG_XML_DIR}")
        return True

    except Exception as e:
        print(f"[ERROR] Extraction failed: {e}")
        return False


def parse_verblijfsobjecten():
    """
    Parse VerblijfsObject XML files to extract floor area and purpose.

    Returns DataFrame with:
    - nummeraanduiding_id: Link to address
    - oppervlakte: Floor area in m²
    - gebruiksdoel: Purpose (woonfunctie, etc.)
    - status: Current status
    - pand_id: Building ID
    """
    print("\n[PARSE] Parsing VerblijfsObject files...")

    vbo_files = list(BAG_XML_DIR.glob("**/9999VBO*.xml"))

    if not vbo_files:
        print("[ERROR] No VerblijfsObject files found")
        print(f"Expected location: {BAG_XML_DIR}")
        return None

    print(f"[OK] Found {len(vbo_files)} VBO files")

    records = []

    for vbo_file in tqdm(vbo_files, desc="Processing VBO files"):
        try:
            # Parse XML incrementally to save memory
            for event, elem in ET.iterparse(vbo_file, events=('end',)):
                if elem.tag.endswith('Verblijfsobject'):
                    record = parse_verblijfsobject_element(elem)
                    if record:
                        records.append(record)
                    elem.clear()  # Free memory
        except Exception as e:
            print(f"[WARNING] Error parsing {vbo_file}: {e}")
            continue

    print(f"[OK] Parsed {len(records)} VerblijfsObjecten")

    return pl.DataFrame(records)


def parse_verblijfsobject_element(elem) -> Optional[Dict[str, Any]]:
    """Parse a single VerblijfsObject XML element."""
    try:
        # Correct namespace (note the 'lvbag' in the path)
        ns = '{www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601}'
        ref_ns = '{www.kadaster.nl/schemas/lvbag/imbag/objecten-ref/v20200601}'

        # Extract fields as direct children (not descendants)
        vbo_id = None
        num_id = None
        oppervlakte = None
        gebruiksdoelen = []
        status = None
        pand_ids = []

        for child in elem:
            tag = child.tag.replace(ns, '')

            if tag == 'identificatie':
                vbo_id = child.text
            elif tag == 'heeftAlsHoofdadres':
                # NummeraanduidingRef is a child element containing the ID as text
                for ref_child in child:
                    if 'NummeraanduidingRef' in ref_child.tag:
                        num_id = ref_child.text
                        break
            elif tag == 'oppervlakte':
                try:
                    oppervlakte = int(child.text) if child.text else None
                except ValueError:
                    pass
            elif tag == 'gebruiksdoel':
                if child.text:
                    gebruiksdoelen.append(child.text)
            elif tag == 'status':
                status = child.text
            elif tag == 'maaktDeelUitVan':
                # PandRef is a child element containing the ID as text
                for ref_child in child:
                    if 'PandRef' in ref_child.tag:
                        pand_ids.append(ref_child.text)
                        break

        if not vbo_id or not num_id:
            return None

        return {
            'verblijfsobject_id': vbo_id,
            'nummeraanduiding_id': num_id,
            'oppervlakte_m2': oppervlakte,
            'gebruiksdoel': ','.join(gebruiksdoelen) if gebruiksdoelen else None,
            'status': status,
            'pand_id': pand_ids[0] if pand_ids else None,
        }

    except Exception:
        return None


def parse_panden():
    """
    Parse Pand XML files to extract building year and geometry.

    Returns DataFrame with:
    - pand_id: Building ID
    - building_year: Year built
    - geometry_wkt: Building footprint as WKT
    """
    print("\n[PARSE] Parsing Pand files...")

    pand_files = list(BAG_XML_DIR.glob("**/9999PND*.xml"))

    if not pand_files:
        print("[ERROR] No Pand files found")
        print(f"Expected location: {BAG_XML_DIR}")
        return None

    print(f"[OK] Found {len(pand_files)} Pand files")

    records = []

    for pand_file in tqdm(pand_files, desc="Processing Pand files"):
        try:
            for event, elem in ET.iterparse(pand_file, events=('end',)):
                if elem.tag.endswith('Pand'):
                    record = parse_pand_element(elem)
                    if record:
                        records.append(record)
                    elem.clear()
        except Exception as e:
            print(f"[WARNING] Error parsing {pand_file}: {e}")
            continue

    print(f"[OK] Parsed {len(records)} Panden")

    return pl.DataFrame(records)


def parse_pand_element(elem) -> Optional[Dict[str, Any]]:
    """Parse a single Pand XML element."""
    try:
        pand_id = elem.findtext('.//bag-lvc:identificatie', namespaces=NAMESPACES)

        # Extract building year
        jaar_text = elem.findtext('.//bag-lvc:oorspronkelijkBouwjaar', namespaces=NAMESPACES)
        building_year = int(jaar_text) if jaar_text and jaar_text.isdigit() else None

        # Extract geometry (simplified - just store as string for now)
        # Full parsing would require more complex GML handling
        geometry_elem = elem.find('.//bag-lvc:geometrie', namespaces=NAMESPACES)
        geometry_wkt = None  # TODO: Parse GML to WKT if needed

        status = elem.findtext('.//bag-lvc:status', namespaces=NAMESPACES)

        if not pand_id:
            return None

        return {
            'pand_id': pand_id,
            'building_year': building_year,
            'status': status,
            'geometry_wkt': geometry_wkt,
        }

    except Exception:
        return None


def parse_nummeraanduidingen():
    """
    Parse Nummeraanduiding XML files to get address links.

    Returns DataFrame with:
    - nummeraanduiding_id: ID
    - postcode: Postal code
    - huisnummer: House number
    - huisletter: House letter
    - huisnummertoevoeging: House addition
    """
    print("\n[PARSE] Parsing Nummeraanduiding files...")

    num_files = list(BAG_XML_DIR.glob("**/9999NUM*.xml"))

    if not num_files:
        print("[ERROR] No Nummeraanduiding files found")
        print(f"Expected location: {BAG_XML_DIR}")
        return None

    print(f"[OK] Found {len(num_files)} NUM files")

    records = []

    for num_file in tqdm(num_files, desc="Processing NUM files"):
        try:
            for event, elem in ET.iterparse(num_file, events=('end',)):
                if elem.tag.endswith('Nummeraanduiding'):
                    record = parse_nummeraanduiding_element(elem)
                    if record:
                        records.append(record)
                    elem.clear()
        except Exception as e:
            print(f"[WARNING] Error parsing {num_file}: {e}")
            continue

    print(f"[OK] Parsed {len(records)} Nummeraanduidingen")

    return pl.DataFrame(records)


def parse_nummeraanduiding_element(elem) -> Optional[Dict[str, Any]]:
    """Parse a single Nummeraanduiding XML element."""
    try:
        num_id = elem.findtext('.//bag-lvc:identificatie', namespaces=NAMESPACES)
        postcode = elem.findtext('.//bag-lvc:postcode', namespaces=NAMESPACES)

        huisnummer_text = elem.findtext('.//bag-lvc:huisnummer', namespaces=NAMESPACES)
        huisnummer = int(huisnummer_text) if huisnummer_text else None

        huisletter = elem.findtext('.//bag-lvc:huisletter', namespaces=NAMESPACES)
        huisnummertoevoeging = elem.findtext('.//bag-lvc:huisnummertoevoeging', namespaces=NAMESPACES)

        if not num_id or not postcode or not huisnummer:
            return None

        return {
            'nummeraanduiding_id': num_id,
            'postcode': postcode,
            'huisnummer': huisnummer,
            'huisletter': huisletter,
            'huisnummertoevoeging': huisnummertoevoeging,
        }

    except Exception:
        return None


def enrich_addresses():
    """
    Join BAG data to existing addresses.parquet.
    """
    print("\n[ENRICH] Joining BAG data to addresses...")

    if not ADDRESSES_FILE.exists():
        print(f"[ERROR] addresses.parquet not found at {ADDRESSES_FILE}")
        return False

    # Load existing addresses
    print("[LOAD] Loading addresses.parquet...")
    addresses = pl.read_parquet(ADDRESSES_FILE)
    print(f"[OK] Loaded {len(addresses)} addresses")

    # Load parsed BAG data
    vbo_df = pl.read_parquet(RAW_DIR / "bag_verblijfsobjecten.parquet")
    pand_df = pl.read_parquet(RAW_DIR / "bag_panden.parquet")
    num_df = pl.read_parquet(RAW_DIR / "bag_nummeraanduidingen.parquet")

    # Join chain: addresses → nummeraanduiding → verblijfsobject → pand
    print("[JOIN] Step 1: addresses → nummeraanduiding...")
    enriched = addresses.join(
        num_df,
        left_on=['postal_code', 'house_number'],
        right_on=['postcode', 'huisnummer'],
        how='left'
    )

    print("[JOIN] Step 2: + verblijfsobject...")
    enriched = enriched.join(
        vbo_df,
        on='nummeraanduiding_id',
        how='left'
    )

    print("[JOIN] Step 3: + pand...")
    enriched = enriched.join(
        pand_df,
        on='pand_id',
        how='left'
    )

    # Calculate derived fields
    print("[CALC] Calculating derived fields...")
    enriched = enriched.with_columns([
        # Is this an apartment? (multiple units in same building)
        pl.col('pand_id').is_not_null().alias('has_building_info'),

        # Simplify status
        (pl.col('gebruiksdoel').str.contains('woonfunctie')).alias('is_residential'),
    ])

    # Select final columns
    final_columns = [
        # Original address columns
        'postal_code', 'house_number', 'house_letter', 'house_addition',
        'lat', 'lng', 'street_name', 'city', 'area_code',

        # BAG enrichment
        'verblijfsobject_id',
        'oppervlakte_m2',
        'gebruiksdoel',
        'is_residential',
        'pand_id',
        'building_year',
        'has_building_info',
    ]

    enriched = enriched.select([col for col in final_columns if col in enriched.columns])

    # Save enriched file
    print(f"\n[SAVE] Saving to {ADDRESSES_ENRICHED_FILE}...")
    enriched.write_parquet(
        ADDRESSES_ENRICHED_FILE,
        compression='zstd',
        compression_level=3
    )

    file_size_mb = ADDRESSES_ENRICHED_FILE.stat().st_size / (1024 * 1024)
    print(f"[OK] Saved {len(enriched)} addresses ({file_size_mb:.2f} MB)")

    # Show statistics
    print("\n[STATS] Enrichment Statistics:")
    print(f"   Total addresses: {len(enriched)}")
    print(f"   With floor area: {enriched.filter(pl.col('oppervlakte_m2').is_not_null()).height}")
    print(f"   With building year: {enriched.filter(pl.col('building_year').is_not_null()).height}")
    print(f"   Residential: {enriched.filter(pl.col('is_residential')).height}")

    avg_area = enriched.filter(pl.col('oppervlakte_m2').is_not_null())['oppervlakte_m2'].mean()
    print(f"   Average floor area: {avg_area:.1f} m²")

    return True


def main():
    print("=" * 70)
    print("BAG 2.0 ENHANCED DATA INGESTION")
    print("=" * 70)
    print()

    print("This script will:")
    print("1. Download BAG extract (~8GB, 30-90 min)")
    print("2. Extract needed files (10-20 min)")
    print("3. Parse XML data (60-120 min)")
    print("4. Enrich addresses.parquet")
    print()
    print("Total time: 2-4 hours")
    print()

    # Check for --yes flag to skip confirmation
    skip_confirm = '--yes' in sys.argv or '-y' in sys.argv

    # Step 1: Download
    if not (BAG_DOWNLOAD_DIR / "lvbag-extract-nl.zip").exists():
        if not download_bag_extract(skip_confirm=skip_confirm):
            return
    else:
        print(f"[SKIP] BAG extract already downloaded")

    # Step 2: Extract
    if not list(BAG_XML_DIR.glob("**/9999VBO*.xml")):
        if not extract_bag_files():
            return
    else:
        print(f"[SKIP] BAG files already extracted")

    # Step 3: Parse
    if not (RAW_DIR / "bag_verblijfsobjecten.parquet").exists():
        vbo_df = parse_verblijfsobjecten()
        if vbo_df:
            vbo_df.write_parquet(RAW_DIR / "bag_verblijfsobjecten.parquet")

    if not (RAW_DIR / "bag_panden.parquet").exists():
        pand_df = parse_panden()
        if pand_df:
            pand_df.write_parquet(RAW_DIR / "bag_panden.parquet")

    if not (RAW_DIR / "bag_nummeraanduidingen.parquet").exists():
        num_df = parse_nummeraanduidingen()
        if num_df:
            num_df.write_parquet(RAW_DIR / "bag_nummeraanduidingen.parquet")

    # Step 4: Enrich
    if enrich_addresses():
        print("\n" + "=" * 70)
        print("[OK] ENRICHMENT COMPLETE!")
        print("=" * 70)
        print(f"\n[FILE] {ADDRESSES_ENRICHED_FILE}")
        print("\nNext: Update backend to use addresses_enriched.parquet")


if __name__ == "__main__":
    main()
