"""
MBO Schools OSM Enrichment Script

Fetches MBO/vocational education locations from OpenStreetMap to supplement
the limited DUO institution-level data with actual campus locations.

OSM tags used:
- amenity=college (post-secondary vocational education)

Filters applied to get MBO-relevant entries:
- Name contains MBO, ROC, AOC, vakschool, vakopleiding, beroeps keywords
- Excludes international schools, theological seminaries, language schools
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import httpx
from tqdm import tqdm

# Overpass API query for Dutch colleges
OVERPASS_QUERY = """
[out:json][timeout:120];
area["name"="Nederland"]["admin_level"="2"]->.nl;
(
  nwr["amenity"="college"](area.nl);
);
out body center;
"""

# Keywords that indicate MBO/vocational education
MBO_KEYWORDS = [
    'mbo', 'roc', 'aoc', 'vakschool', 'vakopleiding', 'beroeps',
    'college', 'noorderpoort', 'friesland college', 'albeda',
    'zadkine', 'mondriaan', 'roi', 'rijn ijssel', 'deltion',
    'graafschap', 'aventus', 'landstede', 'clusius', 'wellant',
    'citaverde', 'yuverta', 'terra', 'curio', 'scalda', 'davinci',
    'gilde', 'summa', 'vista', 'soma', 'arcus', 'leeuwenborgh',
    'koning willem', 'horizon', 'alfa', 'drenthe', 'nova',
    'regio', 'regionaal opleidingscentrum', 'techniek', 'zorg',
    'horeca', 'groen', 'agrarisch'
]

# Keywords that indicate NON-MBO institutions to exclude
EXCLUDE_KEYWORDS = [
    'university', 'universiteit', 'hogeschool', 'hbo',
    'theological', 'theologisch', 'seminary', 'seminarie',
    'international school', 'internationale school',
    'language school', 'taalschool', 'inburgering',
    'sekolah', 'chinese', 'arabic', 'japanese', 'korean',
    'music', 'dance', 'ballet', 'kunst', 'conservatorium',
    'primary', 'basisschool', 'voortgezet', 'vmbo', 'havo', 'vwo',
    'gymnasium', 'lyceum', 'atheneum'
]


def is_likely_mbo(name: str, tags: Dict) -> bool:
    """Check if an OSM entry is likely an MBO school."""
    name_lower = name.lower()

    # Check exclude keywords first
    for kw in EXCLUDE_KEYWORDS:
        if kw in name_lower:
            return False

    # Check for MBO keywords
    for kw in MBO_KEYWORDS:
        if kw in name_lower:
            return True

    # Check operator tag for ROC names
    operator = (tags.get('operator') or '').lower()
    for kw in MBO_KEYWORDS:
        if kw in operator:
            return True

    # Check isced:level tag (MBO is typically level 3-4)
    isced = tags.get('isced:level', '')
    if isced in ['3', '4', '3;4']:
        return True

    return False


def fetch_osm_colleges() -> List[Dict]:
    """Fetch all colleges from OSM for the Netherlands."""
    print("Fetching colleges from OpenStreetMap...")

    with httpx.Client(timeout=180) as client:
        response = client.post(
            "https://overpass-api.de/api/interpreter",
            data=OVERPASS_QUERY
        )
        response.raise_for_status()
        data = response.json()

    elements = data.get('elements', [])
    print(f"Found {len(elements)} OSM college entries")
    return elements


def transform_osm_to_school(element: Dict) -> Optional[Dict]:
    """Transform OSM element to school record format."""
    tags = element.get('tags', {})
    name = tags.get('name')

    if not name:
        return None

    # Get coordinates (either direct or from center for ways/relations)
    lat = element.get('lat') or element.get('center', {}).get('lat')
    lon = element.get('lon') or element.get('center', {}).get('lon')

    if not lat or not lon:
        return None

    # Check if likely MBO
    if not is_likely_mbo(name, tags):
        return None

    # Build address from OSM tags
    street = tags.get('addr:street', '')
    housenumber = tags.get('addr:housenumber', '')
    postcode = tags.get('addr:postcode', '')
    city = tags.get('addr:city', '')

    return {
        'brin_nummer': None,  # OSM doesn't have BRIN
        'vestigingsnummer': f"OSM-{element.get('id', '')}",
        'school_name': name,
        'street': street,
        'house_number': housenumber,
        'postal_code': postcode,
        'city': city,
        'municipality': None,
        'province': None,
        'phone': tags.get('phone') or tags.get('contact:phone'),
        'website': tags.get('website') or tags.get('contact:website'),
        'school_type': 'mbo',
        'school_type_label': 'MBO (OpenStreetMap)',
        'file_type': 'osm',
        'denomination': None,
        'latitude': lat,
        'longitude': lon,
        'osm_id': element.get('id'),
        'osm_type': element.get('type'),
        'source': 'OpenStreetMap'
    }


def load_existing_schools(path: Path) -> List[Dict]:
    """Load existing geocoded schools."""
    if not path.exists():
        return []

    with open(path) as f:
        return json.load(f)


def deduplicate_schools(existing: List[Dict], new_schools: List[Dict],
                        distance_threshold: float = 0.001) -> List[Dict]:
    """
    Deduplicate new schools against existing ones.
    Uses coordinate proximity (about 100m at NL latitude).
    """
    unique_new = []

    for new in new_schools:
        new_lat = new['latitude']
        new_lon = new['longitude']
        new_name = new['school_name'].lower()

        is_duplicate = False
        for existing_school in existing:
            if existing_school.get('school_type') != 'mbo':
                continue

            ex_lat = existing_school.get('latitude', 0)
            ex_lon = existing_school.get('longitude', 0)
            ex_name = (existing_school.get('school_name') or '').lower()

            # Check coordinate proximity
            if abs(new_lat - ex_lat) < distance_threshold and \
               abs(new_lon - ex_lon) < distance_threshold:
                is_duplicate = True
                break

            # Check name similarity (simple substring match)
            if len(new_name) > 5 and len(ex_name) > 5:
                if new_name in ex_name or ex_name in new_name:
                    # Also check if coordinates are reasonably close (within 5km)
                    if abs(new_lat - ex_lat) < 0.05 and abs(new_lon - ex_lon) < 0.05:
                        is_duplicate = True
                        break

        if not is_duplicate:
            unique_new.append(new)

    return unique_new


def main():
    """Main function to enrich MBO data with OSM."""
    print("=" * 60)
    print("MBO Schools OSM Enrichment")
    print("=" * 60)

    # Paths
    script_dir = Path(__file__).parent.parent.parent
    data_dir = script_dir.parent / 'data'
    existing_path = data_dir / 'processed' / 'schools_geocoded.json'
    output_path = data_dir / 'processed' / 'schools_geocoded.json'

    # Fetch OSM data
    osm_elements = fetch_osm_colleges()

    # Transform to school records
    print("\nFiltering and transforming OSM data...")
    osm_schools = []
    for element in tqdm(osm_elements, desc="Processing"):
        school = transform_osm_to_school(element)
        if school:
            osm_schools.append(school)

    print(f"Found {len(osm_schools)} likely MBO schools in OSM")

    # Load existing schools
    existing_schools = load_existing_schools(existing_path)
    existing_mbo = [s for s in existing_schools if s.get('school_type') == 'mbo']
    print(f"Existing MBO schools: {len(existing_mbo)}")

    # Deduplicate
    unique_osm = deduplicate_schools(existing_schools, osm_schools)
    print(f"Unique new MBO schools from OSM: {len(unique_osm)}")

    # Merge
    merged_schools = existing_schools + unique_osm
    new_mbo_count = len([s for s in merged_schools if s.get('school_type') == 'mbo'])

    print(f"\nTotal schools after merge: {len(merged_schools)}")
    print(f"Total MBO schools: {new_mbo_count} (was {len(existing_mbo)}, +{new_mbo_count - len(existing_mbo)})")

    # Save
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(merged_schools, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to: {output_path}")

    # Show sample new entries
    if unique_osm:
        print("\nSample new MBO locations from OSM:")
        for school in unique_osm[:10]:
            print(f"  - {school['school_name'][:50]}")
            print(f"    {school['city'] or 'Unknown city'} | {school['latitude']:.4f}, {school['longitude']:.4f}")


if __name__ == "__main__":
    main()
