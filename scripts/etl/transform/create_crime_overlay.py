"""
Create Crime Overlay GeoJSON by joining crime statistics with CBS buurt boundaries.

This script:
1. Loads crime statistics from parquet
2. Aggregates total crimes per buurt (neighborhood)
3. Joins with CBS buurt boundary geometries
4. Outputs a GeoJSON file suitable for map overlays
"""

import json
from pathlib import Path
import polars as pl
import click


def simplify_coords(coords, precision=5):
    """Round coordinates to specified precision."""
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], precision), round(coords[1], precision)]
    else:
        return [simplify_coords(c, precision) for c in coords]


def simplify_ring(ring, max_points=100):
    """Reduce points in a ring while keeping shape."""
    if len(ring) <= max_points:
        return ring
    step = max(1, len(ring) // max_points)
    simplified = ring[::step]
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified


def simplify_geometry(geometry, precision=5):
    """Simplify a GeoJSON geometry for smaller file size."""
    if not geometry:
        return None

    geo_type = geometry.get('type')
    coords = geometry.get('coordinates', [])

    if geo_type == 'Polygon':
        new_coords = []
        for ring in coords:
            simplified = simplify_ring(ring)
            simplified = simplify_coords(simplified, precision)
            if len(simplified) >= 4:
                new_coords.append(simplified)
        return {'type': geo_type, 'coordinates': new_coords} if new_coords else None

    elif geo_type == 'MultiPolygon':
        new_coords = []
        for polygon in coords:
            new_poly = []
            for ring in polygon:
                simplified = simplify_ring(ring)
                simplified = simplify_coords(simplified, precision)
                if len(simplified) >= 4:
                    new_poly.append(simplified)
            if new_poly:
                new_coords.append(new_poly)
        return {'type': geo_type, 'coordinates': new_coords} if new_coords else None

    return {'type': geo_type, 'coordinates': simplify_coords(coords, precision)}


@click.command()
@click.option('--crime-parquet', default='../../../data/processed/crime.parquet', help='Path to crime parquet')
@click.option('--boundaries-parquet', default='../../../data/processed/neighborhood_boundaries.parquet', help='Path to boundaries parquet')
@click.option('--output', default='../../../data/raw/crime_overlay.json', help='Output GeoJSON path')
@click.option('--simplify/--no-simplify', default=True, help='Simplify geometries for smaller file')
def main(crime_parquet: str, boundaries_parquet: str, output: str, simplify: bool):
    """Create Crime Overlay GeoJSON."""

    print("=== Creating Crime Overlay GeoJSON ===")

    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    crime_path = (script_dir / crime_parquet).resolve()
    boundaries_path = (script_dir / boundaries_parquet).resolve()
    output_path = (script_dir / output).resolve()

    # Load crime data
    print(f"\n1. Loading crime data from {crime_path}...")
    crime_df = pl.read_parquet(crime_path)
    print(f"   Loaded {len(crime_df):,} crime records")

    # Filter to buurt level only (BU codes)
    crime_df = crime_df.with_columns(
        pl.col('area_code').str.strip_chars().alias('area_code')
    )
    buurt_crime = crime_df.filter(pl.col('area_code').str.starts_with('BU'))
    print(f"   Filtered to {len(buurt_crime):,} buurt-level records")

    # Get total crimes per buurt (sum of GeregistreerdeMisdrijven_1 for all crime types)
    # Filter to total crimes (SoortMisdrijf = "0.0.0") to avoid double counting
    total_crime = buurt_crime.filter(
        pl.col('SoortMisdrijf').str.strip_chars() == '0.0.0'
    )

    crime_per_buurt = total_crime.group_by('area_code').agg([
        pl.col('GeregistreerdeMisdrijven_1').sum().alias('total_crimes'),
        pl.col('year').max().alias('year')
    ])
    print(f"   Aggregated to {len(crime_per_buurt):,} buurten with crime data")

    # Load boundaries
    print(f"\n2. Loading boundaries from {boundaries_path}...")
    boundaries_df = pl.read_parquet(boundaries_path)
    print(f"   Loaded {len(boundaries_df):,} buurt boundaries")

    # Join crime data with boundaries
    print("\n3. Joining crime data with boundaries...")
    joined = boundaries_df.join(
        crime_per_buurt,
        left_on='buurtcode',
        right_on='area_code',
        how='left'
    ).filter(
        ~pl.col('is_foreign')  # Exclude foreign areas
    ).filter(
        pl.col('water') != 'W'  # Exclude water areas
    )

    # Fill nulls for buurten without crime data
    joined = joined.with_columns([
        pl.col('total_crimes').fill_null(0),
        pl.col('year').fill_null(2024)
    ])

    print(f"   Joined to {len(joined):,} buurten")

    # Calculate crime statistics for scoring
    crime_stats = joined.filter(pl.col('total_crimes') > 0)['total_crimes'].describe()
    print(f"\n   Crime statistics:")
    print(f"   - Mean: {joined['total_crimes'].mean():.1f}")
    print(f"   - Max: {joined['total_crimes'].max()}")
    print(f"   - Buurten with crimes: {len(joined.filter(pl.col('total_crimes') > 0))}")

    # Create GeoJSON
    print("\n4. Creating GeoJSON features...")
    features = []
    skipped = 0

    for row in joined.iter_rows(named=True):
        geometry_json = row.get('geometry_json')
        if not geometry_json:
            skipped += 1
            continue

        try:
            geometry = json.loads(geometry_json)

            if simplify:
                geometry = simplify_geometry(geometry)
                if not geometry:
                    skipped += 1
                    continue

            feature = {
                'type': 'Feature',
                'properties': {
                    'id': row['buurtcode'],
                    'area_code': row['buurtcode'],
                    'area_name': row['buurtnaam'],
                    'municipality': row['gemeentenaam'],
                    'crime_count': int(row['total_crimes']),
                    'year': str(int(row['year']))
                },
                'geometry': geometry
            }
            features.append(feature)
        except (json.JSONDecodeError, TypeError) as e:
            skipped += 1
            continue

    print(f"   Created {len(features):,} features (skipped {skipped})")

    # Build GeoJSON
    geojson = {
        'type': 'FeatureCollection',
        'metadata': {
            'source': 'CBS/Politie.nl',
            'level': 'buurt',
            'year': '2024',
            'total_features': len(features),
            'description': 'Crime statistics per neighborhood (buurt)'
        },
        'features': features
    }

    # Save
    print(f"\n5. Saving to {output_path}...")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, separators=(',', ':'))

    file_size = output_path.stat().st_size / 1024 / 1024
    print(f"   Saved {file_size:.1f} MB")

    print("\n[OK] Crime overlay GeoJSON created successfully!")
    print(f"   Output: {output_path}")


if __name__ == '__main__':
    main()
