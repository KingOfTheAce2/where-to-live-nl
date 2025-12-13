"""
Transform DUO schools JSON to Parquet format.

Converts the raw JSON school data to optimized Parquet format with proper data types.
"""

import json
import pandas as pd
from pathlib import Path
import click

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log


def clean_postal_code(pc: str) -> str:
    """
    Clean and normalize postal code.

    Args:
        pc: Raw postal code

    Returns:
        Normalized postal code (e.g., "1234AB")
    """
    if not pc:
        return None

    # Remove spaces and convert to uppercase
    pc = pc.replace(' ', '').upper()

    # Dutch postal codes are 4 digits + 2 letters
    if len(pc) >= 6:
        return pc[:6]

    return pc


def classify_ho_school(name: str) -> tuple[str, str]:
    """
    Classify higher education (HO) school as HBO or WO.

    Args:
        name: School name

    Returns:
        Tuple of (school_type, school_type_label)
    """
    if not name:
        return 'hbo', 'HBO (Universities of Applied Sciences)'

    name_lower = name.lower()

    # HBO indicators - check first as some HBO schools have "university" in name
    if 'hogeschool' in name_lower:
        return 'hbo', 'HBO (Universities of Applied Sciences)'
    if 'university of applied sciences' in name_lower:
        return 'hbo', 'HBO (Universities of Applied Sciences)'

    # WO indicators - research universities
    if 'universiteit' in name_lower or 'university' in name_lower:
        return 'wo', 'WO (Research Universities)'

    # Default to HBO for ambiguous cases
    return 'hbo', 'HBO (Universities of Applied Sciences)'


# Map DUO school types to UI-friendly types
SCHOOL_TYPE_MAP = {
    'po': ('primary', 'Primary School'),
    'vo': ('secondary', 'Secondary School'),
    'so': ('special', 'Special Education'),
    'mbo': ('mbo', 'MBO (Vocational Education)'),
    # Note: 'ho' will be split into 'hbo' and 'wo' separately
}


@click.command()
@click.option(
    "--input",
    "input_file",
    type=click.Path(exists=True),
    default="../../data/raw/schools_duo_complete.json",
    help="Input JSON file"
)
@click.option(
    "--output",
    "output_file",
    type=click.Path(),
    default="../../data/processed/schools.parquet",
    help="Output Parquet file"
)
def main(input_file: str, output_file: str):
    """
    Transform DUO schools JSON to Parquet.

    Reads the JSON file created by duo_schools_complete.py and converts it
    to an optimized Parquet format for fast lookups.
    """
    log.info("=== DUO Schools JSON to Parquet ===")

    input_path = Path(input_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load JSON
    log.info(f"Loading: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    schools = data.get('data', [])
    metadata = data.get('metadata', {})

    log.info(f"Loaded {len(schools):,} schools")
    log.info(f"Source: {metadata.get('source')}")
    log.info(f"Downloaded: {metadata.get('downloaded_at')}")

    # Convert to DataFrame
    log.info("Converting to DataFrame...")
    df = pd.DataFrame(schools)

    # Clean and normalize data
    log.info("Cleaning data...")

    # Normalize postal codes
    if 'postal_code' in df.columns:
        df['postal_code'] = df['postal_code'].apply(clean_postal_code)

    # Convert coordinates to float (if present)
    if 'latitude' in df.columns:
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    if 'longitude' in df.columns:
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

    # Remap school types to UI-friendly names and split HO into HBO/WO
    log.info("Remapping school types...")
    def remap_school_type(row):
        original_type = row.get('school_type', '')
        school_name = row.get('school_name', '')

        if original_type == 'ho':
            # Split higher education into HBO and WO
            new_type, new_label = classify_ho_school(school_name)
            return pd.Series([new_type, new_label])
        elif original_type in SCHOOL_TYPE_MAP:
            new_type, new_label = SCHOOL_TYPE_MAP[original_type]
            return pd.Series([new_type, new_label])
        else:
            # Keep original if not in map
            return pd.Series([original_type, row.get('school_type_label', original_type)])

    # Apply remapping
    df[['school_type', 'school_type_label']] = df.apply(remap_school_type, axis=1)

    # Ensure all text fields are string type (handle None values)
    text_fields = [
        'brin_nummer', 'vestigingsnummer', 'school_name', 'street',
        'house_number', 'postal_code', 'city', 'municipality', 'province',
        'phone', 'website', 'school_type', 'school_type_label',
        'file_type', 'denomination'
    ]

    for field in text_fields:
        if field in df.columns:
            df[field] = df[field].astype('string')

    # Remove duplicates based on BRIN + vestigingsnummer (or just BRIN for institutions)
    log.info("Removing duplicates...")
    before_count = len(df)

    # Create unique key
    df['unique_key'] = df.apply(
        lambda row: f"{row.get('brin_nummer', '')}_{row.get('vestigingsnummer', '')}_{row.get('postal_code', '')}",
        axis=1
    )

    df = df.drop_duplicates(subset=['unique_key'], keep='first')
    df = df.drop(columns=['unique_key'])

    after_count = len(df)
    duplicates_removed = before_count - after_count

    if duplicates_removed > 0:
        log.info(f"Removed {duplicates_removed:,} duplicate records")

    # Show statistics
    log.info("\n=== Data Statistics ===")
    log.info(f"Total schools: {len(df):,}")

    if 'school_type' in df.columns:
        log.info("\nSchools by type:")
        type_counts = df['school_type'].value_counts()
        for school_type, count in type_counts.items():
            log.info(f"  {school_type}: {count:,}")

    if 'postal_code' in df.columns:
        valid_pc = df['postal_code'].notna().sum()
        log.info(f"\nWith valid postal code: {valid_pc:,} ({valid_pc/len(df)*100:.1f}%)")

    if 'latitude' in df.columns and 'longitude' in df.columns:
        valid_coords = ((df['latitude'].notna()) & (df['longitude'].notna())).sum()
        log.info(f"With coordinates: {valid_coords:,} ({valid_coords/len(df)*100:.1f}%)")

    # Save to Parquet
    log.info(f"\nSaving to: {output_path}")
    df.to_parquet(
        output_path,
        engine='pyarrow',
        compression='snappy',
        index=False
    )

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.success(f"Saved {len(df):,} schools ({file_size_mb:.1f} MB)")

    # Show sample
    log.info("\n=== Sample Records ===")
    print(df.head(3).to_string(max_colwidth=30))

    log.success("\n✅ Schools Parquet conversion complete!")


if __name__ == "__main__":
    main()
