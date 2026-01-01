"""
Fast parallel coordinate enrichment for schools using PDOK API.

Uses concurrent requests for 5-10x speed improvement.
"""

import json
import pandas as pd
from pathlib import Path
import asyncio
import aiohttp
from tqdm import tqdm
import time
import click

PDOK_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"


def parse_point(point_str: str):
    """Parse POINT(lon lat) format."""
    if not point_str or not point_str.startswith("POINT("):
        return None, None
    try:
        coords = point_str.replace("POINT(", "").replace(")", "").strip()
        parts = coords.split()
        if len(parts) == 2:
            return float(parts[1]), float(parts[0])  # lat, lon
    except:
        pass
    return None, None


async def lookup_coords(session, postal_code, house_number, street="", city=""):
    """Look up coordinates for an address."""
    if not postal_code:
        return None, None

    try:
        # Try different query strategies
        queries = []

        # Strategy 1: Postal code + house number
        if house_number:
            queries.append(f"{postal_code} {house_number}")

        # Strategy 2: Postal code only
        queries.append(postal_code)

        # Strategy 3: Street + city
        if street and city:
            queries.append(f"{street} {city}")

        for query in queries:
            params = {
                "q": query,
                "rows": 1,
                "fl": "centroide_ll"
            }

            async with session.get(PDOK_URL, params=params, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    docs = data.get("response", {}).get("docs", [])
                    if docs:
                        lat, lon = parse_point(docs[0].get("centroide_ll", ""))
                        if lat and lon:
                            return lat, lon

    except Exception as e:
        pass

    return None, None


async def process_batch(session, schools_batch, pbar):
    """Process a batch of schools concurrently."""
    tasks = []
    for idx, school in schools_batch:
        task = lookup_coords(
            session,
            school.get('postal_code', ''),
            school.get('house_number', ''),
            school.get('street', ''),
            school.get('city', '')
        )
        tasks.append((idx, task))

    results = {}
    for idx, task in tasks:
        lat, lon = await task
        results[idx] = (lat, lon)
        pbar.update(1)

    return results


async def enrich_schools_async(schools: list, batch_size: int = 50, max_concurrent: int = 20):
    """Enrich all schools with coordinates using async requests."""
    results = {}

    connector = aiohttp.TCPConnector(limit=max_concurrent)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with tqdm(total=len(schools), desc="Enriching coordinates") as pbar:
            # Process in batches
            for i in range(0, len(schools), batch_size):
                batch = [(j, schools[j]) for j in range(i, min(i + batch_size, len(schools)))]

                # Process batch concurrently
                tasks = []
                for idx, school in batch:
                    task = asyncio.create_task(lookup_coords(
                        session,
                        school.get('postal_code', ''),
                        school.get('house_number', ''),
                        school.get('street', ''),
                        school.get('city', '')
                    ))
                    tasks.append((idx, task))

                # Wait for batch to complete
                for idx, task in tasks:
                    try:
                        lat, lon = await asyncio.wait_for(task, timeout=15)
                        results[idx] = (lat, lon)
                    except:
                        results[idx] = (None, None)
                    pbar.update(1)

                # Small delay between batches to avoid rate limiting
                await asyncio.sleep(0.1)

    return results


@click.command()
@click.option("--input", "input_file", default="/workspaces/where-to-live-nl/data/processed/schools.parquet")
@click.option("--output", "output_file", default="/workspaces/where-to-live-nl/data/processed/schools.parquet")
@click.option("--batch-size", default=50, help="Batch size for concurrent requests")
@click.option("--max-concurrent", default=20, help="Max concurrent connections")
def main(input_file, output_file, batch_size, max_concurrent):
    """Enrich schools parquet with coordinates from PDOK."""
    print("=== Schools Coordinate Enrichment ===")

    input_path = Path(input_file)
    output_path = Path(output_file)

    # Load parquet
    print(f"Loading: {input_path}")
    df = pd.read_parquet(input_path)
    print(f"Total schools: {len(df):,}")

    # Check current coordinate status
    has_lat = 'latitude' in df.columns and df['latitude'].notna().any()
    has_lon = 'longitude' in df.columns and df['longitude'].notna().any()

    if has_lat and has_lon:
        existing = (df['latitude'].notna() & df['longitude'].notna()).sum()
        print(f"Already have coordinates: {existing:,} ({existing/len(df)*100:.1f}%)")

    # Ensure columns exist
    if 'latitude' not in df.columns:
        df['latitude'] = None
    if 'longitude' not in df.columns:
        df['longitude'] = None

    # Convert to list for processing
    schools = df.to_dict('records')

    # Find schools needing coordinates
    needs_coords = []
    for i, school in enumerate(schools):
        lat = school.get('latitude')
        lon = school.get('longitude')
        if pd.isna(lat) or pd.isna(lon):
            needs_coords.append(i)

    print(f"Schools needing coordinates: {len(needs_coords):,}")

    if not needs_coords:
        print("All schools already have coordinates!")
        return

    # Run async enrichment
    print(f"\nStarting enrichment (batch_size={batch_size}, max_concurrent={max_concurrent})...")
    start_time = time.time()

    # Only process schools that need coordinates
    schools_to_process = [(i, schools[i]) for i in needs_coords]

    # Use batched async requests
    async def run_enrichment():
        results = {}
        connector = aiohttp.TCPConnector(limit=max_concurrent)
        timeout = aiohttp.ClientTimeout(total=30)

        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            with tqdm(total=len(schools_to_process), desc="Enriching") as pbar:
                for batch_start in range(0, len(schools_to_process), batch_size):
                    batch = schools_to_process[batch_start:batch_start + batch_size]

                    tasks = []
                    for idx, school in batch:
                        task = asyncio.create_task(lookup_coords(
                            session,
                            school.get('postal_code', ''),
                            school.get('house_number', ''),
                            school.get('street', ''),
                            school.get('city', '')
                        ))
                        tasks.append((idx, task))

                    for idx, task in tasks:
                        try:
                            lat, lon = await asyncio.wait_for(task, timeout=15)
                            results[idx] = (lat, lon)
                        except:
                            results[idx] = (None, None)
                        pbar.update(1)

                    # Rate limiting
                    await asyncio.sleep(0.05)

        return results

    results = asyncio.run(run_enrichment())

    elapsed = time.time() - start_time
    rate = len(needs_coords) / elapsed
    print(f"\nEnrichment completed in {elapsed:.1f}s ({rate:.1f} schools/sec)")

    # Apply results
    enriched_count = 0
    for idx, (lat, lon) in results.items():
        if lat is not None and lon is not None:
            df.at[idx, 'latitude'] = lat
            df.at[idx, 'longitude'] = lon
            enriched_count += 1

    print(f"Successfully enriched: {enriched_count:,} ({enriched_count/len(needs_coords)*100:.1f}%)")

    # Show final stats
    total_with_coords = (df['latitude'].notna() & df['longitude'].notna()).sum()
    print(f"Total with coordinates: {total_with_coords:,} ({total_with_coords/len(df)*100:.1f}%)")

    # Show by type
    print("\nBy school type:")
    for school_type in df['school_type'].unique():
        type_df = df[df['school_type'] == school_type]
        with_coords = (type_df['latitude'].notna() & type_df['longitude'].notna()).sum()
        print(f"  {school_type}: {with_coords}/{len(type_df)} ({with_coords/len(type_df)*100:.1f}%)")

    # Save
    print(f"\nSaving to: {output_path}")
    df.to_parquet(output_path, engine='pyarrow', compression='snappy', index=False)

    print("\n✅ Schools coordinate enrichment complete!")


if __name__ == "__main__":
    main()
