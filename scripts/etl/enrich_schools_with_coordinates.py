"""
Enrich schools Parquet file with coordinates from PDOK Locatieserver API.

This script takes the schools.parquet file and enriches it with lat/lon coordinates
by looking up each school's address using the PDOK API.

Much faster than downloading from DUO API with coordinates!
"""

import pandas as pd
from pathlib import Path
import click
import httpx
from tqdm import tqdm
import time

import sys
sys.path.append(str(Path(__file__).parent))

from common.logger import log

LOCATIESERVER_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


def parse_point_coordinates(point_str: str) -> tuple[float, float] | tuple[None, None]:
    """
    Parse POINT(lon lat) format from PDOK API.

    Example: "POINT(4.8942242 52.37302144)" -> (52.37302144, 4.8942242)

    Returns:
        (latitude, longitude) or (None, None) if parsing fails
    """
    if not point_str or not point_str.startswith("POINT("):
        return None, None

    try:
        # Format: "POINT(4.8942242 52.37302144)"
        coords = point_str.replace("POINT(", "").replace(")", "").strip()
        parts = coords.split()

        if len(parts) == 2:
            lon = float(parts[0])  # Longitude first in POINT format
            lat = float(parts[1])  # Latitude second
            return lat, lon
    except Exception as e:
        log.debug(f"Failed to parse coordinates: {point_str} - {e}")

    return None, None


def lookup_coordinates(client: httpx.Client, postal_code: str, house_number: str,
                       city: str = "") -> tuple[float, float] | tuple[None, None]:
    """
    Look up coordinates for a school address using PDOK API.

    Args:
        client: HTTP client
        postal_code: Postal code (e.g., "1012JS")
        house_number: House number (can include letters/additions like "13-A")
        city: Optional city name for better matching

    Returns:
        (latitude, longitude) or (None, None) if not found
    """
    try:
        # Build query
        query = f"{postal_code} {house_number}"
        if city:
            query += f" {city}"

        params = {
            "q": query,
            "fq": f"postcode:{postal_code} AND type:adres",
            "rows": 1
        }

        response = client.get(LOCATIESERVER_URL, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        # Check if we got results
        if not data.get("response") or not data["response"].get("docs"):
            return None, None

        doc = data["response"]["docs"][0]

        # Extract centroide_ll (center point in lat/lon format)
        point_str = doc.get("centroide_ll")

        if point_str:
            lat, lon = parse_point_coordinates(point_str)
            return lat, lon

    except Exception as e:
        log.debug(f"Failed to lookup coordinates for {postal_code} {house_number}: {e}")

    return None, None


@click.command()
@click.option(
    "--input",
    "input_file",
    type=click.Path(exists=True),
    default="../../data/processed/schools.parquet",
    help="Input schools Parquet file"
)
@click.option(
    "--output",
    "output_file",
    type=click.Path(),
    default="../../data/processed/schools.parquet",
    help="Output schools Parquet file (can be same as input)"
)
@click.option(
    "--rate-limit",
    type=float,
    default=10.0,
    help="Max requests per second (default: 10)"
)
@click.option(
    "--sample",
    type=int,
    help="Only enrich first N schools (for testing)"
)
def main(input_file: str, output_file: str, rate_limit: float, sample: int):
    """
    Enrich schools with coordinates from PDOK Locatieserver API.

    This script:
    1. Loads schools.parquet
    2. For each school without coordinates, looks up address in PDOK API
    3. Updates the parquet file with coordinates
    4. Saves back to parquet

    Examples:
        # Enrich all schools
        python enrich_schools_with_coordinates.py

        # Test with sample
        python enrich_schools_with_coordinates.py --sample 100

        # Slower rate limit (be nice to the API)
        python enrich_schools_with_coordinates.py --rate-limit 5
    """
    log.info("=== Schools Coordinate Enrichment ===")
    log.info(f"Input: {input_file}")
    log.info(f"Rate limit: {rate_limit} req/sec")

    input_path = Path(input_file)
    output_path = Path(output_file)

    # Load schools
    log.info("Loading schools...")
    df = pd.read_parquet(input_path)

    total_schools = len(df)
    log.info(f"Loaded {total_schools:,} schools")

    # Check how many already have coordinates
    has_coords = ((df['latitude'].notna()) & (df['longitude'].notna())).sum()
    needs_coords = total_schools - has_coords

    log.info(f"Schools with coordinates: {has_coords:,}")
    log.info(f"Schools needing coordinates: {needs_coords:,}")

    if needs_coords == 0:
        log.success("All schools already have coordinates!")
        return

    # Apply sample limit
    if sample:
        df = df.head(sample)
        log.info(f"Limited to {sample} schools for testing")

    # Setup HTTP client
    client = httpx.Client(
        timeout=30,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; NL-School-Enrichment/1.0)"
        }
    )

    # Rate limiting
    delay = 1.0 / rate_limit if rate_limit > 0 else 0

    # Enrich schools
    log.info(f"\nEnriching schools (delay: {delay:.3f}s per request)...")

    success_count = 0
    failed_count = 0
    skipped_count = 0

    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Enriching"):
        # Skip if already has coordinates
        if pd.notna(row['latitude']) and pd.notna(row['longitude']):
            skipped_count += 1
            continue

        postal_code = row.get('postal_code')
        house_number = row.get('house_number')
        city = row.get('city')

        if not postal_code or not house_number:
            failed_count += 1
            continue

        # Lookup coordinates
        lat, lon = lookup_coordinates(client, postal_code, house_number, city)

        if lat and lon:
            df.at[idx, 'latitude'] = lat
            df.at[idx, 'longitude'] = lon
            success_count += 1
        else:
            failed_count += 1

        # Rate limiting
        if delay > 0:
            time.sleep(delay)

    client.close()

    log.info(f"\n=== Enrichment Results ===")
    log.info(f"Successfully enriched: {success_count:,}")
    log.info(f"Failed to find: {failed_count:,}")
    log.info(f"Already had coordinates: {skipped_count:,}")

    # Calculate final stats
    final_has_coords = ((df['latitude'].notna()) & (df['longitude'].notna())).sum()
    coverage = (final_has_coords / len(df)) * 100

    log.info(f"\nFinal coverage: {final_has_coords:,}/{len(df):,} ({coverage:.1f}%)")

    # Save
    log.info(f"\nSaving to: {output_path}")
    df.to_parquet(
        output_path,
        engine='pyarrow',
        compression='snappy',
        index=False
    )

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.success(f"Saved enriched schools ({file_size_mb:.1f} MB)")

    # Show sample
    log.info("\n=== Sample Enriched Schools ===")
    enriched = df[df['latitude'].notna()].head(3)
    for idx, school in enriched.iterrows():
        log.info(f"\n{school['school_name']}")
        log.info(f"  Address: {school['street']} {school['house_number']}, {school['postal_code']} {school['city']}")
        log.info(f"  Coordinates: {school['latitude']:.6f}, {school['longitude']:.6f}")
        log.info(f"  Type: {school['school_type_label']}")

    log.success("\n✅ Schools coordinate enrichment complete!")


if __name__ == "__main__":
    main()
