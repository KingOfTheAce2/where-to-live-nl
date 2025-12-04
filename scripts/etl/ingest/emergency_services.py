"""
Ingest emergency services from OpenStreetMap.

This script fetches:
- Fire stations (amenity=fire_station)
- Police stations (amenity=police)
- Hospitals (amenity=hospital)

Data source: OpenStreetMap via Overpass API
License: ODbL (Open Database License)
"""

import requests
import polars as pl
from pathlib import Path
import time
from typing import List, Dict
import click

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NETHERLANDS_BBOX = "50.7,3.3,53.6,7.3"


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


def fetch_fire_stations() -> List[Dict]:
    """Fetch all fire stations in Netherlands."""
    print("[*] Fetching fire stations...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="fire_station"]({NETHERLANDS_BBOX});
      way["amenity"="fire_station"]({NETHERLANDS_BBOX});
      relation["amenity"="fire_station"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    fire_stations = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        fire_stations.append({
            "id": f"fire_{element['id']}",
            "name": tags.get("name", "Brandweerkazerne"),
            "type": "fire_station",
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "operator": tags.get("operator"),
            "emergency": "fire"
        })

    print(f"[+] Found {len(fire_stations)} fire stations")
    return fire_stations


def fetch_police_stations() -> List[Dict]:
    """Fetch all police stations in Netherlands."""
    print("[*] Fetching police stations...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="police"]({NETHERLANDS_BBOX});
      way["amenity"="police"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    police_stations = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        police_stations.append({
            "id": f"police_{element['id']}",
            "name": tags.get("name", "Politiebureau"),
            "type": "police",
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "operator": tags.get("operator"),
            "emergency": "police"
        })

    print(f"[+] Found {len(police_stations)} police stations")
    return police_stations


def fetch_hospitals() -> List[Dict]:
    """Fetch all hospitals in Netherlands."""
    print("[*] Fetching hospitals...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="hospital"]({NETHERLANDS_BBOX});
      way["amenity"="hospital"]({NETHERLANDS_BBOX});
      relation["amenity"="hospital"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    hospitals = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        hospitals.append({
            "id": f"hospital_{element['id']}",
            "name": tags.get("name", "Ziekenhuis"),
            "type": "hospital",
            "lat": lat,
            "lng": lon,
            "street": tags.get("addr:street"),
            "house_number": tags.get("addr:housenumber"),
            "postal_code": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "website": tags.get("website"),
            "phone": tags.get("phone"),
            "operator": tags.get("operator"),
            "emergency": tags.get("emergency"),
            "beds": tags.get("beds"),
            "healthcare": tags.get("healthcare"),
        })

    print(f"[+] Found {len(hospitals)} hospitals")
    return hospitals


@click.command()
@click.option('--output-dir', default='../../../data/processed', help='Output directory')
@click.option('--services', default='fire,police,hospital', help='Comma-separated: fire,police,hospital')
def main(output_dir: str, services: str):
    """
    Ingest emergency services from OpenStreetMap.

    Examples:
        python emergency_services.py  # All services
        python emergency_services.py --services fire  # Fire stations only
    """
    print("Emergency Services Ingestion")
    print("=" * 60)
    print("Source: OpenStreetMap (ODbL License)")
    print("=" * 60)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    services_list = [s.strip() for s in services.split(',')]
    all_services = []

    if 'fire' in services_list:
        all_services.extend(fetch_fire_stations())
        time.sleep(2)

    if 'police' in services_list:
        all_services.extend(fetch_police_stations())
        time.sleep(2)

    if 'hospital' in services_list:
        all_services.extend(fetch_hospitals())

    if not all_services:
        print("[!] No services fetched")
        return

    # Convert to DataFrame with explicit schema handling
    df = pl.DataFrame(all_services, infer_schema_length=10000)

    # Save combined file
    output_file = output_path / "emergency_services.parquet"
    df.write_parquet(output_file, compression="snappy")

    print(f"\n[+] Saved {len(df)} emergency services to {output_file}")
    print(f"[*] Breakdown:")
    print(df.group_by("type").count().sort("count", descending=True))

    # Save separate files
    for service_type in df["type"].unique():
        type_df = df.filter(pl.col("type") == service_type)
        type_file = output_path / f"{service_type}s.parquet"
        type_df.write_parquet(type_file, compression="snappy")
        print(f"[+] Saved {len(type_df)} {service_type}s")

    print("\n" + "=" * 60)
    print("[+] Emergency services ingestion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
