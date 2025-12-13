#!/usr/bin/env python3
"""
Process BAG (Basisregistratie Adressen en Gebouwen) data to Parquet.

Memory-optimized version that processes files in batches and uses
streaming XML parsing to avoid loading everything into memory.

This script:
1. Parses all BAG XML files (VBO for residential units, PND for buildings)
2. Joins with addresses.parquet to get province/city information
3. Splits output by province
4. Separates big cities (Amsterdam, Rotterdam, Den Haag, Utrecht) into own files
5. Outputs to data/processed/bag_properties/

Output structure:
    data/processed/bag_properties/
        properties_amsterdam.parquet
        properties_rotterdam.parquet
        properties_den_haag.parquet
        properties_utrecht_city.parquet
        properties_drenthe.parquet
        ... (one file per province)
"""

import sys
import io
import gc
import polars as pl
from pathlib import Path
from typing import Dict, List, Optional, Iterator
from tqdm import tqdm
import xml.etree.ElementTree as ET
from collections import defaultdict

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
BAG_DIR = DATA_DIR / "raw" / "bag_extract" / "xml"
ADDRESSES_FILE = DATA_DIR / "processed" / "addresses.parquet"
OUTPUT_DIR = DATA_DIR / "processed" / "bag_properties"
TEMP_DIR = OUTPUT_DIR / "temp"

# BAG XML namespaces (need to handle both with and without protocol)
BAG_NS = {
    'Objecten': 'www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601',
    'Objecten-ref': 'www.kadaster.nl/schemas/lvbag/imbag/objecten-ref/v20200601',
    'gml': 'http://www.opengis.net/gml/3.2'
}

# Big cities to separate into their own files
BIG_CITIES = {
    'Amsterdam': 'amsterdam',
    'Rotterdam': 'rotterdam',
    "'s-Gravenhage": 'den_haag',
    'Den Haag': 'den_haag',
    'Utrecht': 'utrecht_city'
}

# Province name normalization
PROVINCE_NAMES = {
    'Drenthe': 'drenthe',
    'Flevoland': 'flevoland',
    'Friesland': 'friesland',
    'Fryslân': 'friesland',
    'Gelderland': 'gelderland',
    'Groningen': 'groningen',
    'Limburg': 'limburg',
    'Noord-Brabant': 'noord_brabant',
    'Noord-Holland': 'noord_holland',
    'Overijssel': 'overijssel',
    'Utrecht': 'utrecht',
    'Zeeland': 'zeeland',
    'Zuid-Holland': 'zuid_holland',
}

# Batch size for processing
BATCH_SIZE = 50  # Process 50 files at a time


def iter_parse_vbo(xml_file: Path) -> Iterator[Dict]:
    """
    Parse VBO XML file using iterative parsing to save memory.
    Yields one record at a time.
    """
    try:
        # Use iterparse to avoid loading entire file
        context = ET.iterparse(str(xml_file), events=('end',))

        for event, elem in context:
            # Look for Verblijfsobject elements
            if elem.tag.endswith('Verblijfsobject'):
                record = _extract_vbo_element(elem)
                if record:
                    yield record
                # Clear element to free memory
                elem.clear()

    except Exception as e:
        print(f"Error parsing {xml_file.name}: {e}")


def _extract_vbo_element(vbo: ET.Element) -> Optional[Dict]:
    """Extract data from single VBO element."""

    def find_text(elem, local_name):
        """Find text in element, handling namespaces."""
        for child in elem.iter():
            if child.tag.endswith(local_name):
                return child.text
        return None

    def find_elem(elem, local_name):
        """Find child element by local name."""
        for child in elem.iter():
            if child.tag.endswith(local_name):
                return child
        return None

    # BAG ID
    bag_id = find_text(vbo, 'identificatie')
    if not bag_id:
        return None

    # Status - skip non-active
    status = find_text(vbo, 'status')
    if status and 'ingetrokken' in status.lower():
        return None

    # Address reference
    num_id = None
    hoofdadres = find_elem(vbo, 'heeftAlsHoofdadres')
    if hoofdadres is not None:
        num_id = find_text(hoofdadres, 'NummeraanduidingRef')

    # Building reference
    pand_id = None
    pand_ref = find_elem(vbo, 'maaktDeelUitVan')
    if pand_ref is not None:
        pand_id = find_text(pand_ref, 'PandRef')

    # Surface area
    surface_text = find_text(vbo, 'oppervlakte')
    surface_area = int(surface_text) if surface_text else None

    # Usage type
    usage_type = find_text(vbo, 'gebruiksdoel')

    # Coordinates
    rd_x, rd_y = None, None
    pos_text = find_text(vbo, 'pos')
    if pos_text:
        coords = pos_text.split()
        if len(coords) >= 2:
            try:
                rd_x, rd_y = float(coords[0]), float(coords[1])
            except ValueError:
                pass

    return {
        'bag_id': bag_id,
        'nummeraanduiding_id': num_id,
        'pand_id': pand_id,
        'surface_area_m2': surface_area,
        'status': status,
        'usage_type': usage_type,
        'rd_x': rd_x,
        'rd_y': rd_y
    }


def iter_parse_pnd(xml_file: Path) -> Iterator[Dict]:
    """Parse PND XML file using iterative parsing."""
    try:
        context = ET.iterparse(str(xml_file), events=('end',))

        for event, elem in context:
            if elem.tag.endswith('Pand'):
                record = _extract_pnd_element(elem)
                if record:
                    yield record
                elem.clear()

    except Exception as e:
        print(f"Error parsing {xml_file.name}: {e}")


def _extract_pnd_element(pand: ET.Element) -> Optional[Dict]:
    """Extract data from single Pand element."""

    def find_text(elem, local_name):
        for child in elem.iter():
            if child.tag.endswith(local_name):
                return child.text
        return None

    pand_id = find_text(pand, 'identificatie')
    if not pand_id:
        return None

    # Building year
    year_text = find_text(pand, 'oorspronkelijkBouwjaar')
    building_year = int(year_text) if year_text else None

    # Status - skip demolished
    status = find_text(pand, 'status')
    if status and 'gesloopt' in status.lower():
        return None

    return {
        'pand_id': pand_id,
        'building_year': building_year,
        'pand_status': status
    }


def iter_parse_num(xml_file: Path) -> Iterator[Dict]:
    """Parse NUM XML file using iterative parsing."""
    try:
        context = ET.iterparse(str(xml_file), events=('end',))

        for event, elem in context:
            if elem.tag.endswith('Nummeraanduiding'):
                record = _extract_num_element(elem)
                if record:
                    yield record
                elem.clear()

    except Exception as e:
        print(f"Error parsing {xml_file.name}: {e}")


def _extract_num_element(num: ET.Element) -> Optional[Dict]:
    """Extract data from single Nummeraanduiding element."""

    def find_text(elem, local_name):
        for child in elem.iter():
            if child.tag.endswith(local_name):
                return child.text
        return None

    num_id = find_text(num, 'identificatie')
    if not num_id:
        return None

    # Status - only active
    status = find_text(num, 'status')
    if status and status != "Naamgeving uitgegeven":
        return None

    # Postal code
    postal_code = find_text(num, 'postcode')

    # House number
    hn_text = find_text(num, 'huisnummer')
    house_number = int(hn_text) if hn_text else None

    # House letter and addition
    house_letter = find_text(num, 'huisletter')
    house_addition = find_text(num, 'huisnummertoevoeging')

    return {
        'nummeraanduiding_id': num_id,
        'postal_code': postal_code,
        'house_number': house_number,
        'house_letter': house_letter,
        'house_addition': house_addition
    }


def process_batch_to_temp(files: List[Path], parse_func, batch_num: int,
                          output_prefix: str) -> int:
    """Process a batch of files and save to temp parquet."""
    records = []

    for f in files:
        for record in parse_func(f):
            records.append(record)

    if records:
        df = pl.DataFrame(records)
        temp_file = TEMP_DIR / f"{output_prefix}_batch_{batch_num:04d}.parquet"
        df.write_parquet(temp_file, compression='snappy')
        count = len(records)
        del records, df
        gc.collect()
        return count

    return 0


def get_output_key(city: Optional[str], province: Optional[str]) -> str:
    """Determine output file key based on city and province."""
    if city and city in BIG_CITIES:
        return BIG_CITIES[city]
    if province and province in PROVINCE_NAMES:
        return PROVINCE_NAMES[province]
    return 'unknown'


def main():
    """Main processing function."""
    print("=" * 70)
    print("BAG Properties Processing - Memory Optimized")
    print("=" * 70)

    # Create directories
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    # Find all XML files
    vbo_files = sorted(list(BAG_DIR.glob("*VBO*.xml"))) if BAG_DIR.exists() else []
    pnd_files = sorted(list(BAG_DIR.glob("*PND*.xml"))) if BAG_DIR.exists() else []
    num_files = sorted(list(BAG_DIR.glob("*NUM*.xml"))) if BAG_DIR.exists() else []

    print(f"\nFound XML files:")
    print(f"  VBO (residential units): {len(vbo_files)}")
    print(f"  PND (buildings): {len(pnd_files)}")
    print(f"  NUM (addresses): {len(num_files)}")

    if not vbo_files:
        print("\nNo VBO XML files found. Please extract BAG data first.")
        return

    # Load addresses for province/city lookup
    print(f"\nLoading addresses from {ADDRESSES_FILE}...")
    if not ADDRESSES_FILE.exists():
        print(f"Addresses file not found: {ADDRESSES_FILE}")
        return

    addresses_df = pl.read_parquet(ADDRESSES_FILE)
    print(f"Loaded {len(addresses_df):,} addresses")

    # =========================================================================
    # Step 1: Parse VBO files in batches
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 1: Parsing VBO files in batches...")
    print("=" * 70)

    total_vbos = 0
    num_batches = (len(vbo_files) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in tqdm(range(num_batches), desc="VBO batches"):
        start_idx = i * BATCH_SIZE
        end_idx = min((i + 1) * BATCH_SIZE, len(vbo_files))
        batch_files = vbo_files[start_idx:end_idx]

        count = process_batch_to_temp(batch_files, iter_parse_vbo, i, 'vbo')
        total_vbos += count
        gc.collect()

    print(f"Extracted {total_vbos:,} residential units")

    # =========================================================================
    # Step 2: Parse PND files for building year
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 2: Parsing PND files in batches...")
    print("=" * 70)

    total_pnds = 0
    num_batches = (len(pnd_files) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in tqdm(range(num_batches), desc="PND batches"):
        start_idx = i * BATCH_SIZE
        end_idx = min((i + 1) * BATCH_SIZE, len(pnd_files))
        batch_files = pnd_files[start_idx:end_idx]

        count = process_batch_to_temp(batch_files, iter_parse_pnd, i, 'pnd')
        total_pnds += count
        gc.collect()

    print(f"Extracted {total_pnds:,} buildings")

    # =========================================================================
    # Step 3: Parse NUM files for address linking
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 3: Parsing NUM files in batches...")
    print("=" * 70)

    total_nums = 0
    num_batches = (len(num_files) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in tqdm(range(num_batches), desc="NUM batches"):
        start_idx = i * BATCH_SIZE
        end_idx = min((i + 1) * BATCH_SIZE, len(num_files))
        batch_files = num_files[start_idx:end_idx]

        count = process_batch_to_temp(batch_files, iter_parse_num, i, 'num')
        total_nums += count
        gc.collect()

    print(f"Extracted {total_nums:,} address mappings")

    # =========================================================================
    # Step 4: Merge temp files and join data
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 4: Merging temp files...")
    print("=" * 70)

    # Load all VBO batches
    print("Loading VBO data...")
    vbo_temp_files = sorted(TEMP_DIR.glob("vbo_batch_*.parquet"))
    if vbo_temp_files:
        vbo_df = pl.concat([pl.read_parquet(f) for f in vbo_temp_files])
        print(f"  VBO records: {len(vbo_df):,}")
    else:
        print("No VBO temp files found!")
        return

    # Load and join PND data
    print("Loading and joining PND data...")
    pnd_temp_files = sorted(TEMP_DIR.glob("pnd_batch_*.parquet"))
    if pnd_temp_files:
        pnd_df = pl.concat([pl.read_parquet(f) for f in pnd_temp_files])
        print(f"  PND records: {len(pnd_df):,}")

        vbo_df = vbo_df.join(
            pnd_df.select(['pand_id', 'building_year']),
            on='pand_id',
            how='left'
        )
        del pnd_df
        gc.collect()

        with_year = vbo_df.filter(pl.col('building_year').is_not_null()).height
        print(f"  Joined building years: {with_year:,}")

    # Load and join NUM data
    print("Loading and joining NUM data...")
    num_temp_files = sorted(TEMP_DIR.glob("num_batch_*.parquet"))
    if num_temp_files:
        num_df = pl.concat([pl.read_parquet(f) for f in num_temp_files])
        print(f"  NUM records: {len(num_df):,}")

        vbo_df = vbo_df.join(
            num_df,
            on='nummeraanduiding_id',
            how='left'
        )
        del num_df
        gc.collect()

        with_postal = vbo_df.filter(pl.col('postal_code').is_not_null()).height
        print(f"  Joined addresses: {with_postal:,}")

    # =========================================================================
    # Step 5: Enrich with city/province from addresses
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 5: Enriching with city/province...")
    print("=" * 70)

    # Prepare join
    vbo_df = vbo_df.with_columns([
        pl.col('house_number').cast(pl.Int64)
    ])

    addr_lookup = addresses_df.select([
        'postal_code', 'house_number', 'house_letter', 'house_addition',
        'city', 'municipality', 'province', 'latitude', 'longitude'
    ])

    enriched_df = vbo_df.join(
        addr_lookup,
        on=['postal_code', 'house_number', 'house_letter', 'house_addition'],
        how='left'
    )

    del vbo_df, addr_lookup, addresses_df
    gc.collect()

    with_city = enriched_df.filter(pl.col('city').is_not_null()).height
    with_province = enriched_df.filter(pl.col('province').is_not_null()).height
    print(f"Enriched with city: {with_city:,}")
    print(f"Enriched with province: {with_province:,}")

    # =========================================================================
    # Step 6: Split by province and big cities
    # =========================================================================
    print("\n" + "=" * 70)
    print("Step 6: Splitting by province and big cities...")
    print("=" * 70)

    # Create output key column using a more efficient method
    def map_output_key(city: str, province: str) -> str:
        if city and city in BIG_CITIES:
            return BIG_CITIES[city]
        if province and province in PROVINCE_NAMES:
            return PROVINCE_NAMES[province]
        return 'unknown'

    # Use when/then/otherwise for efficient categorization
    city_col = pl.col('city')
    province_col = pl.col('province')

    # Build expression for big cities first
    output_expr = pl.lit('unknown')

    for city_name, file_key in BIG_CITIES.items():
        output_expr = pl.when(city_col == city_name).then(pl.lit(file_key)).otherwise(output_expr)

    for prov_name, file_key in PROVINCE_NAMES.items():
        output_expr = pl.when(
            (province_col == prov_name) & (~city_col.is_in(list(BIG_CITIES.keys())))
        ).then(pl.lit(file_key)).otherwise(output_expr)

    enriched_df = enriched_df.with_columns([
        output_expr.alias('output_key')
    ])

    # Get unique keys
    output_keys = enriched_df['output_key'].unique().to_list()
    print(f"Output files to create: {len(output_keys)}")

    # Save each partition
    total_saved = 0
    for key in sorted([k for k in output_keys if k]):
        partition = enriched_df.filter(pl.col('output_key') == key)

        if len(partition) == 0:
            continue

        partition = partition.drop('output_key')

        output_file = OUTPUT_DIR / f"properties_{key}.parquet"
        partition.write_parquet(output_file, compression='snappy')

        file_size = output_file.stat().st_size / (1024 * 1024)
        print(f"  {key}: {len(partition):,} properties ({file_size:.1f} MB)")
        total_saved += len(partition)

        del partition
        gc.collect()

    # =========================================================================
    # Cleanup temp files
    # =========================================================================
    print("\n" + "=" * 70)
    print("Cleaning up temp files...")
    print("=" * 70)

    for f in TEMP_DIR.glob("*.parquet"):
        f.unlink()
    try:
        TEMP_DIR.rmdir()
    except OSError:
        pass

    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    print(f"Total properties processed: {len(enriched_df):,}")
    print(f"Total properties saved: {total_saved:,}")
    print(f"Output directory: {OUTPUT_DIR}")

    # List output files
    print("\nOutput files:")
    total_size = 0
    for f in sorted(OUTPUT_DIR.glob("*.parquet")):
        size = f.stat().st_size / (1024 * 1024)
        total_size += size
        print(f"  {f.name}: {size:.1f} MB")
    print(f"\nTotal size: {total_size:.1f} MB")

    # Statistics
    print("\n" + "=" * 70)
    print("Statistics")
    print("=" * 70)

    with_surface = enriched_df.filter(pl.col('surface_area_m2').is_not_null()).height
    with_year = enriched_df.filter(pl.col('building_year').is_not_null()).height
    with_coords = enriched_df.filter(pl.col('latitude').is_not_null()).height

    print(f"Properties with surface area: {with_surface:,} ({100*with_surface/len(enriched_df):.1f}%)")
    print(f"Properties with building year: {with_year:,} ({100*with_year/len(enriched_df):.1f}%)")
    print(f"Properties with coordinates: {with_coords:,} ({100*with_coords/len(enriched_df):.1f}%)")


if __name__ == "__main__":
    main()
