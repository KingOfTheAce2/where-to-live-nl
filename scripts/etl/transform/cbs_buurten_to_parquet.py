#!/usr/bin/env python3
"""
Convert CBS Buurten GeoJSON to Parquet files split by province.

The CBS buurten boundaries file is ~327MB as JSON.
This script splits it by province and converts to Parquet for efficient storage.

Netherlands provinces:
- Drenthe
- Flevoland
- Friesland (Fryslân)
- Gelderland
- Groningen
- Limburg
- Noord-Brabant
- Noord-Holland
- Overijssel
- Utrecht
- Zeeland
- Zuid-Holland
"""

import json
import os
import sys
from pathlib import Path

# Province codes mapping (GM code prefix to province)
# Dutch municipalities have codes like GM0014 where first 2 digits indicate province
PROVINCE_MAPPING = {
    # Province codes based on CBS municipality codes
    'Groningen': ['00'],
    'Friesland': ['00', '01'],  # Some overlap
    'Drenthe': ['01'],
    'Overijssel': ['01', '02'],
    'Flevoland': ['03'],
    'Gelderland': ['02', '03'],
    'Utrecht': ['03'],
    'Noord-Holland': ['03', '04', '05'],
    'Zuid-Holland': ['05', '06'],
    'Zeeland': ['06'],
    'Noord-Brabant': ['07', '08'],
    'Limburg': ['08', '09'],
}

# Better approach: use province name from data if available
PROVINCE_NAMES = [
    'Groningen',
    'Friesland', 'Fryslân',
    'Drenthe',
    'Overijssel',
    'Flevoland',
    'Gelderland',
    'Utrecht',
    'Noord-Holland',
    'Zuid-Holland',
    'Zeeland',
    'Noord-Brabant',
    'Limburg',
]


def load_geojson(filepath: str) -> dict:
    """Load GeoJSON file."""
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_province_from_feature(feature: dict) -> str:
    """Extract province from feature properties."""
    props = feature.get('properties', {})

    # Try different property names
    for key in ['provincienaam', 'province', 'PROV', 'provincieNaam', 'GM_NAAM']:
        if key in props and props[key]:
            return props[key]

    # Try to extract from gemeente code
    gm_code = props.get('gemeentecode', props.get('GM_CODE', ''))
    if gm_code:
        # Map gemeente code to province (simplified)
        code = gm_code.replace('GM', '')[:2]
        if code.startswith('0'):
            return 'Noord'  # North Netherlands
        elif code.startswith('1'):
            return 'Oost'   # East Netherlands
        elif code.startswith('2'):
            return 'Oost'   # East Netherlands
        elif code.startswith('3'):
            return 'Midden' # Central Netherlands
        elif code.startswith('4'):
            return 'West'   # West Netherlands
        elif code.startswith('5'):
            return 'West'   # West Netherlands
        elif code.startswith('6'):
            return 'Zuid'   # South Netherlands
        elif code.startswith('7'):
            return 'Zuid'   # South Netherlands
        elif code.startswith('8'):
            return 'Zuid'   # South Netherlands
        elif code.startswith('9'):
            return 'Zuid'   # South Netherlands

    return 'Unknown'


def split_by_region(data: dict) -> dict:
    """Split features by region (North/East/South/West/Central)."""
    regions = {
        'Noord': [],      # Groningen, Friesland, Drenthe
        'Oost': [],       # Overijssel, Gelderland, Flevoland
        'Midden': [],     # Utrecht
        'West': [],       # Noord-Holland, Zuid-Holland, Zeeland
        'Zuid': [],       # Noord-Brabant, Limburg
        'Unknown': [],
    }

    features = data.get('features', [])
    print(f"Processing {len(features)} features...")

    for feature in features:
        region = get_province_from_feature(feature)
        if region in regions:
            regions[region].append(feature)
        else:
            regions['Unknown'].append(feature)

    return regions


def features_to_records(features: list) -> list:
    """Convert GeoJSON features to flat records for Parquet."""
    records = []

    for feature in features:
        props = feature.get('properties', {})
        geom = feature.get('geometry', {})

        record = {
            'buurtcode': props.get('buurtcode', props.get('BU_CODE', '')),
            'buurtnaam': props.get('buurtnaam', props.get('BU_NAAM', '')),
            'wijkcode': props.get('wijkcode', props.get('WK_CODE', '')),
            'gemeentecode': props.get('gemeentecode', props.get('GM_CODE', '')),
            'gemeentenaam': props.get('gemeentenaam', props.get('GM_NAAM', '')),
            'geometry_type': geom.get('type', ''),
            'geometry': json.dumps(geom) if geom else None,
        }

        # Add any numeric properties
        for key, value in props.items():
            if isinstance(value, (int, float)) and key not in record:
                record[key] = value

        records.append(record)

    return records


def save_to_parquet(records: list, output_path: str):
    """Save records to Parquet file."""
    try:
        import pandas as pd
        import pyarrow as pa
        import pyarrow.parquet as pq

        df = pd.DataFrame(records)
        table = pa.Table.from_pandas(df)
        pq.write_table(table, output_path, compression='snappy')
        print(f"  Saved {len(records)} records to {output_path}")

    except ImportError:
        # Fallback to JSON if pyarrow not available
        json_path = output_path.replace('.parquet', '.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(records, f)
        print(f"  Saved {len(records)} records to {json_path} (pyarrow not available)")


def save_geojson(features: list, output_path: str, original_crs: dict = None):
    """Save features as GeoJSON file."""
    geojson = {
        'type': 'FeatureCollection',
        'features': features,
    }
    if original_crs:
        geojson['crs'] = original_crs

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  Saved {len(features)} features to {output_path} ({size_mb:.1f} MB)")


def main():
    # Paths
    script_dir = Path(__file__).parent.parent.parent
    input_file = script_dir / 'data' / 'raw' / 'cbs_boundaries_buurten.json'

    # Also check scripts/data location
    if not input_file.exists():
        input_file = script_dir / 'scripts' / 'data' / 'raw' / 'cbs_boundaries_buurten.json'

    if not input_file.exists():
        # Try from project root
        input_file = Path('D:/GitHub/where-to-live-nl/scripts/data/raw/cbs_boundaries_buurten.json')

    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        print("Please provide the path to cbs_boundaries_buurten.json as argument")
        if len(sys.argv) > 1:
            input_file = Path(sys.argv[1])
        else:
            sys.exit(1)

    output_dir = Path('D:/GitHub/where-to-live-nl/data/processed/cbs_buurten')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load data
    data = load_geojson(str(input_file))
    original_crs = data.get('crs')

    # Split by region
    regions = split_by_region(data)

    # Save each region
    print("\nSaving split files:")
    for region_name, features in regions.items():
        if not features:
            continue

        # Save as smaller GeoJSON files
        geojson_path = output_dir / f'cbs_buurten_{region_name.lower()}.geojson'
        save_geojson(features, str(geojson_path), original_crs)

        # Also save as Parquet (much smaller)
        records = features_to_records(features)
        parquet_path = output_dir / f'cbs_buurten_{region_name.lower()}.parquet'
        save_to_parquet(records, str(parquet_path))

    print("\nDone! Files saved to:", output_dir)
    print("\nFile sizes:")
    for f in output_dir.glob('*'):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name}: {size_mb:.1f} MB")


if __name__ == '__main__':
    main()
