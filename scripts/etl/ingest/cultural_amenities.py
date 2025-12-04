"""
Ingest cultural amenities from OpenStreetMap.

This script fetches:
- Museums (tourism=museum)
- Libraries (amenity=library)
- Theaters (amenity=theatre)
- Cinemas (amenity=cinema)
- Art galleries (tourism=gallery)

Data source: OpenStreetMap via Overpass API
License: ODbL (Open Database License)
"""

import requests
import polars as pl
from pathlib import Path
import time
from typing import List, Dict
import click

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Netherlands bounding box
NETHERLANDS_BBOX = "50.7,3.3,53.6,7.3"  # min_lat, min_lon, max_lat, max_lon


def query_overpass(query: str, max_retries: int = 3) -> dict:
    """Query Overpass API with retry logic."""
    for attempt in range(max_retries):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=300
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 10
                print(f"[!] Request failed, retrying in {wait_time}s... ({e})")
                time.sleep(wait_time)
            else:
                raise
    return {}


def fetch_museums() -> List[Dict]:
    """Fetch all museums in Netherlands."""
    print("[*] Fetching museums...")

    query = f"""
    [out:json][timeout:300];
    (
      node["tourism"="museum"]({NETHERLANDS_BBOX});
      way["tourism"="museum"]({NETHERLANDS_BBOX});
      relation["tourism"="museum"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    museums = []

    for element in data.get("elements", []):
        # Get coordinates
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        museums.append({
            "id": f"museum_{element['id']}",
            "name": tags.get("name", "Unnamed Museum"),
            "type": "museum",
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "opening_hours": tags.get("opening_hours"),
            "wheelchair": tags.get("wheelchair"),
            "museum_type": tags.get("museum:type"),
        })

    print(f"[+] Found {len(museums)} museums")
    return museums


def fetch_libraries() -> List[Dict]:
    """Fetch all libraries in Netherlands."""
    print("[*] Fetching libraries...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="library"]({NETHERLANDS_BBOX});
      way["amenity"="library"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    libraries = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        libraries.append({
            "id": f"library_{element['id']}",
            "name": tags.get("name", "Unnamed Library"),
            "type": "library",
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "opening_hours": tags.get("opening_hours"),
            "wheelchair": tags.get("wheelchair"),
        })

    print(f"[+] Found {len(libraries)} libraries")
    return libraries


def fetch_theaters() -> List[Dict]:
    """Fetch theaters and cinemas."""
    print("[*] Fetching theaters and cinemas...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="theatre"]({NETHERLANDS_BBOX});
      way["amenity"="theatre"]({NETHERLANDS_BBOX});
      node["amenity"="cinema"]({NETHERLANDS_BBOX});
      way["amenity"="cinema"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    theaters = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})
        amenity_type = tags.get("amenity", "theatre")

        theaters.append({
            "id": f"{amenity_type}_{element['id']}",
            "name": tags.get("name", f"Unnamed {amenity_type.title()}"),
            "type": amenity_type,
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "opening_hours": tags.get("opening_hours"),
            "wheelchair": tags.get("wheelchair"),
            "screens": tags.get("screens"),  # For cinemas
        })

    print(f"[+] Found {len(theaters)} theaters/cinemas")
    return theaters


@click.command()
@click.option('--output-dir', default='../../../data/processed', help='Output directory for parquet files')
def main(output_dir: str):
    """
    Ingest cultural amenities from OpenStreetMap.

    Fetches museums, libraries, theaters, and cinemas for the Netherlands.
    """
    print("Cultural Amenities Ingestion")
    print("=" * 60)
    print("Source: OpenStreetMap (ODbL License)")
    print("=" * 60)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Fetch all cultural amenities
    all_amenities = []

    all_amenities.extend(fetch_museums())
    time.sleep(2)  # Rate limiting

    all_amenities.extend(fetch_libraries())
    time.sleep(2)

    all_amenities.extend(fetch_theaters())

    # Convert to Polars DataFrame with explicit schema handling
    df = pl.DataFrame(all_amenities, infer_schema_length=10000)

    # Save to Parquet
    output_file = output_path / "cultural_amenities.parquet"
    df.write_parquet(output_file, compression="snappy")

    print(f"\n[+] Saved {len(df)} cultural amenities to {output_file}")
    print(f"[*] Breakdown:")
    print(df.group_by("type").count().sort("count", descending=True))

    # Also save separate files for each type
    for amenity_type in df["type"].unique():
        type_df = df.filter(pl.col("type") == amenity_type)
        type_file = output_path / f"{amenity_type}s.parquet"
        type_df.write_parquet(type_file, compression="snappy")
        print(f"[+] Saved {len(type_df)} {amenity_type}s to {type_file}")

    print("\n" + "=" * 60)
    print("[+] Cultural amenities ingestion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
