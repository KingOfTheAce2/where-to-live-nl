"""
Simplify crime overlay geometries for faster loading.

Reduces coordinate precision and simplifies polygons while preserving shape.
"""

import json
from pathlib import Path

def simplify_coords(coords, precision=5):
    """Round coordinates to specified precision."""
    if isinstance(coords[0], (int, float)):
        # Single coordinate pair
        return [round(coords[0], precision), round(coords[1], precision)]
    else:
        # Nested list of coordinates
        return [simplify_coords(c, precision) for c in coords]

def simplify_ring(ring, tolerance=0.0001):
    """
    Simplify a ring using Douglas-Peucker-like point reduction.
    Keep every Nth point based on ring size.
    """
    if len(ring) <= 10:
        return ring

    # For larger rings, keep fewer points
    if len(ring) > 1000:
        step = max(1, len(ring) // 200)  # Keep ~200 points max
    elif len(ring) > 500:
        step = max(1, len(ring) // 150)
    elif len(ring) > 100:
        step = max(1, len(ring) // 80)
    else:
        step = max(1, len(ring) // 50)

    simplified = ring[::step]
    # Ensure ring is closed
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])

    return simplified

def simplify_geometry(geometry, precision=5):
    """Simplify a GeoJSON geometry."""
    if not geometry:
        return geometry

    geo_type = geometry.get('type')
    coords = geometry.get('coordinates', [])

    if geo_type == 'Polygon':
        # Simplify each ring
        new_coords = []
        for ring in coords:
            simplified = simplify_ring(ring)
            simplified = simplify_coords(simplified, precision)
            if len(simplified) >= 4:  # Valid polygon needs at least 4 points
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

    else:
        # Just reduce precision for other types
        return {'type': geo_type, 'coordinates': simplify_coords(coords, precision)}

def main():
    input_path = Path('/workspaces/where-to-live-nl/data/raw/crime_overlay.json')
    output_path = Path('/workspaces/where-to-live-nl/data/raw/crime_overlay_optimized.json')

    print(f'Loading: {input_path}')
    with open(input_path, 'r') as f:
        data = json.load(f)

    print(f'Features: {len(data["features"])}')

    # Simplify all geometries
    print('Simplifying geometries...')
    simplified_features = []
    for feature in data['features']:
        geo = simplify_geometry(feature.get('geometry'), precision=5)
        if geo:
            simplified_features.append({
                'type': 'Feature',
                'properties': feature['properties'],
                'geometry': geo
            })

    output_data = {
        'type': 'FeatureCollection',
        'metadata': data.get('metadata', {}),
        'features': simplified_features
    }

    # Count new coordinates
    total_coords = 0
    for f in simplified_features:
        geo = f.get('geometry', {})
        if geo.get('type') == 'MultiPolygon':
            for poly in geo.get('coordinates', []):
                for ring in poly:
                    total_coords += len(ring)
        elif geo.get('type') == 'Polygon':
            for ring in geo.get('coordinates', []):
                total_coords += len(ring)

    print(f'Simplified to {total_coords:,} coordinate points')
    print(f'Retained {len(simplified_features)} features')

    # Save
    print(f'Saving to: {output_path}')
    with open(output_path, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))  # Compact JSON

    # Also save to the original path (backup first)
    backup_path = input_path.with_suffix('.json.bak')
    print(f'Backing up original to: {backup_path}')
    input_path.rename(backup_path)

    print(f'Replacing original file')
    with open(input_path, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))

    import os
    new_size = os.path.getsize(input_path)
    old_size = os.path.getsize(backup_path)
    print(f'Size reduced from {old_size/1024/1024:.1f}MB to {new_size/1024/1024:.1f}MB ({100*(1-new_size/old_size):.1f}% reduction)')
    print('✅ Done!')

if __name__ == '__main__':
    main()
