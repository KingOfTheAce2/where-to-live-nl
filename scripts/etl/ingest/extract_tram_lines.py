"""
Extract tram and metro line geometries from GTFS data.

Reads routes, trips, and shapes from GTFS to create GeoJSON LineStrings
for tram and metro lines from HTM, GVB, RET, and other Dutch operators.
"""

import csv
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime


GTFS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "gtfs"
OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"

# Route types: 0=Tram, 1=Metro/Subway
TRAM_METRO_TYPES = {'0', '1'}

# Key operators for urban transit
TARGET_OPERATORS = {'GVB', 'HTM', 'RET', 'UOV'}

# Line colors for styling
LINE_COLORS = {
    # GVB Amsterdam Trams
    'GVB:1': '#006699',
    'GVB:2': '#FF6600',
    'GVB:3': '#009900',
    'GVB:4': '#00CCCC',
    'GVB:5': '#FFCC00',
    'GVB:7': '#9900CC',
    'GVB:12': '#CC0066',
    'GVB:13': '#663300',
    'GVB:14': '#336699',
    'GVB:17': '#999999',
    'GVB:19': '#006666',
    'GVB:24': '#FF3366',
    'GVB:25': '#669900',
    'GVB:26': '#333399',
    'GVB:27': '#FF9933',
    # GVB Amsterdam Metro
    'GVB:50': '#187a36',  # Green line
    'GVB:51': '#FF6600',  # Orange line
    'GVB:52': '#00adef',  # Blue line (Noord/Zuid)
    'GVB:53': '#d81118',  # Red line
    'GVB:54': '#fff200',  # Yellow line
    # HTM The Hague Trams
    'HTM:1': '#1E90FF',
    'HTM:2': '#FF4500',
    'HTM:3': '#be1fa1',
    'HTM:4': '#ef7100',
    'HTM:6': '#228B22',
    'HTM:9': '#8B008B',
    'HTM:10': '#DC143C',
    'HTM:11': '#FFD700',
    'HTM:12': '#00CED1',
    'HTM:15': '#708090',
    'HTM:16': '#FF69B4',
    'HTM:17': '#20B2AA',
    'HTM:19': '#9370DB',
    # RET Rotterdam Trams
    'RET:1': '#E30613',
    'RET:2': '#00A1E4',
    'RET:3': '#FFC917',
    'RET:4': '#6CBB3C',
    'RET:5': '#ED6EA7',
    'RET:6': '#9063CD',
    'RET:7': '#00B5B8',
    'RET:8': '#F39200',
    'RET:11': '#B4008E',
    'RET:12': '#95C11F',
    # RET Rotterdam Metro
    'RET:A': '#00b43f',
    'RET:B': '#ffdd00',
    'RET:C': '#e32119',
    'RET:D': '#34b4e4',
    'RET:E': '#003a8c',
}


def get_default_color(operator, line_name, route_type):
    """Get a default color based on operator and type."""
    if route_type == '1':  # Metro
        return '#0066CC'
    # Tram colors by operator
    colors = {
        'GVB': '#2196F3',  # Blue
        'HTM': '#4CAF50',  # Green
        'RET': '#F44336',  # Red
        'UOV': '#FF9800',  # Orange
    }
    return colors.get(operator, '#9C27B0')


def main():
    print("=== Extracting Tram/Metro Lines from GTFS ===")

    # Step 1: Read routes and filter for tram/metro
    print("\n1. Reading routes...")
    tram_metro_routes = {}

    with open(GTFS_DIR / "routes.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['route_type'] in TRAM_METRO_TYPES:
                route_id = row['route_id']
                tram_metro_routes[route_id] = {
                    'route_id': route_id,
                    'agency_id': row['agency_id'],
                    'route_short_name': row['route_short_name'],
                    'route_long_name': row['route_long_name'],
                    'route_type': row['route_type'],
                    'route_color': row.get('route_color', ''),
                    'route_text_color': row.get('route_text_color', ''),
                }

    print(f"   Found {len(tram_metro_routes)} tram/metro routes")

    # Step 2: Read trips to get shape_ids for these routes
    print("\n2. Reading trips to get shape IDs...")
    route_shapes = defaultdict(set)  # route_id -> set of shape_ids
    shape_to_route = {}  # shape_id -> route_id (first occurrence)

    with open(GTFS_DIR / "trips.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_id = row['route_id']
            if route_id in tram_metro_routes:
                shape_id = row.get('shape_id', '')
                if shape_id:
                    route_shapes[route_id].add(shape_id)
                    if shape_id not in shape_to_route:
                        shape_to_route[shape_id] = route_id

    all_shape_ids = set()
    for shapes in route_shapes.values():
        all_shape_ids.update(shapes)

    print(f"   Found {len(all_shape_ids)} unique shapes for tram/metro")

    # Step 3: Read shapes for the relevant shape_ids
    print("\n3. Reading shapes (this may take a moment)...")
    shapes_data = defaultdict(list)  # shape_id -> list of (seq, lat, lon)

    with open(GTFS_DIR / "shapes.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            shape_id = row['shape_id']
            if shape_id in all_shape_ids:
                try:
                    seq = int(row['shape_pt_sequence'])
                    lat = float(row['shape_pt_lat'])
                    lon = float(row['shape_pt_lon'])
                    shapes_data[shape_id].append((seq, lat, lon))
                except (ValueError, KeyError):
                    continue

    print(f"   Loaded {len(shapes_data)} shapes")

    # Step 4: Convert to GeoJSON
    print("\n4. Converting to GeoJSON...")
    features = []
    routes_processed = set()

    for route_id, shape_ids in route_shapes.items():
        route = tram_metro_routes[route_id]
        agency = route['agency_id']
        line_name = route['route_short_name']
        route_type = route['route_type']

        # Get the longest shape for this route (most complete geometry)
        best_shape_id = None
        best_length = 0

        for shape_id in shape_ids:
            if shape_id in shapes_data and len(shapes_data[shape_id]) > best_length:
                best_length = len(shapes_data[shape_id])
                best_shape_id = shape_id

        if not best_shape_id:
            continue

        # Sort points by sequence and create coordinates
        points = shapes_data[best_shape_id]
        points.sort(key=lambda x: x[0])
        coordinates = [[p[2], p[1]] for p in points]  # [lon, lat]

        if len(coordinates) < 2:
            continue

        # Get color
        color_key = f"{agency}:{line_name}"
        color = LINE_COLORS.get(color_key)
        if not color and route['route_color']:
            color = f"#{route['route_color']}"
        if not color:
            color = get_default_color(agency, line_name, route_type)

        feature = {
            'type': 'Feature',
            'properties': {
                'route_id': route_id,
                'operator': agency,
                'line_name': line_name,
                'line_long_name': route['route_long_name'],
                'transport_type': 'metro' if route_type == '1' else 'tram',
                'color': color,
                'text_color': f"#{route['route_text_color']}" if route['route_text_color'] else '#FFFFFF',
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': coordinates
            }
        }
        features.append(feature)
        routes_processed.add(route_id)

    # Create the GeoJSON
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }

    # Summary by operator
    by_operator = defaultdict(lambda: {'tram': 0, 'metro': 0})
    for feature in features:
        op = feature['properties']['operator']
        tt = feature['properties']['transport_type']
        by_operator[op][tt] += 1

    print(f"\n   Created {len(features)} line features:")
    for op, counts in sorted(by_operator.items()):
        print(f"      {op}: {counts['tram']} tram, {counts['metro']} metro")

    # Save the GeoJSON
    output_path = OUTPUT_DIR / "tram_metro_lines.json"
    result = {
        'metadata': {
            'source': 'GTFS OVapi (gtfs.ovapi.nl)',
            'description': 'Tram and metro line geometries for Netherlands',
            'downloaded_at': datetime.utcnow().isoformat(),
            'total_lines': len(features),
            'operators': list(by_operator.keys()),
            'license': 'CC0 (Open Data)',
        },
        'geojson': geojson
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"\n5. Saved to {output_path}")
    print(f"   File size: {output_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
