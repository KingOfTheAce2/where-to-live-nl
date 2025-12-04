"""
Expand healthcare dataset with pharmacies, GPs, and dentists.

This script fetches additional healthcare facilities from OpenStreetMap:
- Pharmacies (amenity=pharmacy)
- GPs/Doctors (amenity=doctors)
- Dentists (amenity=dentist)
- Clinics (amenity=clinic)

Merges with existing healthcare data for comprehensive coverage.

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
                print(f"[!] Request failed, retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
    return {}


def fetch_pharmacies() -> List[Dict]:
    """Fetch all pharmacies."""
    print("[*] Fetching pharmacies...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="pharmacy"]({NETHERLANDS_BBOX});
      way["amenity"="pharmacy"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    pharmacies = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        pharmacies.append({
            "id": f"pharmacy_{element['id']}",
            "name": tags.get("name", "Apotheek"),
            "type": "pharmacy",
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
            "dispensing": tags.get("dispensing"),
        })

    print(f"[+] Found {len(pharmacies)} pharmacies")
    return pharmacies


def fetch_doctors() -> List[Dict]:
    """Fetch GP practices and doctors."""
    print("[*] Fetching GP practices...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="doctors"]({NETHERLANDS_BBOX});
      way["amenity"="doctors"]({NETHERLANDS_BBOX});
      node["healthcare"="doctor"]({NETHERLANDS_BBOX});
      way["healthcare"="doctor"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    doctors = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        doctors.append({
            "id": f"doctor_{element['id']}",
            "name": tags.get("name", "Huisartsenpraktijk"),
            "type": "doctor",
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
            "healthcare_specialty": tags.get("healthcare:speciality"),
        })

    print(f"[+] Found {len(doctors)} GP practices")
    return doctors


def fetch_dentists() -> List[Dict]:
    """Fetch dentists."""
    print("[*] Fetching dentists...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="dentist"]({NETHERLANDS_BBOX});
      way["amenity"="dentist"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    dentists = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        dentists.append({
            "id": f"dentist_{element['id']}",
            "name": tags.get("name", "Tandarts"),
            "type": "dentist",
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

    print(f"[+] Found {len(dentists)} dentists")
    return dentists


def fetch_clinics() -> List[Dict]:
    """Fetch medical clinics."""
    print("[*] Fetching clinics...")

    query = f"""
    [out:json][timeout:300];
    (
      node["amenity"="clinic"]({NETHERLANDS_BBOX});
      way["amenity"="clinic"]({NETHERLANDS_BBOX});
    );
    out center;
    """

    data = query_overpass(query)
    clinics = []

    for element in data.get("elements", []):
        if element["type"] == "node":
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})

        clinics.append({
            "id": f"clinic_{element['id']}",
            "name": tags.get("name", "Kliniek"),
            "type": "clinic",
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
            "healthcare_specialty": tags.get("healthcare:speciality"),
        })

    print(f"[+] Found {len(clinics)} clinics")
    return clinics


@click.command()
@click.option('--output-dir', default='../../../data/processed', help='Output directory')
@click.option('--merge-existing', is_flag=True, help='Merge with existing healthcare data')
def main(output_dir: str, merge_existing: bool):
    """
    Expand healthcare dataset with pharmacies, GPs, dentists, and clinics.

    Examples:
        python healthcare_expanded.py
        python healthcare_expanded.py --merge-existing
    """
    print("Healthcare Dataset Expansion")
    print("=" * 60)
    print("Source: OpenStreetMap (ODbL License)")
    print("=" * 60)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Fetch all healthcare data
    all_healthcare = []

    all_healthcare.extend(fetch_pharmacies())
    time.sleep(2)

    all_healthcare.extend(fetch_doctors())
    time.sleep(2)

    all_healthcare.extend(fetch_dentists())
    time.sleep(2)

    all_healthcare.extend(fetch_clinics())

    # Convert to DataFrame with explicit schema handling
    new_df = pl.DataFrame(all_healthcare, infer_schema_length=10000)

    # Merge with existing healthcare if requested
    existing_file = output_path / "amenities_healthcare.parquet"
    if merge_existing and existing_file.exists():
        print(f"\n[*] Loading existing healthcare data...")
        existing_df = pl.read_parquet(existing_file)
        print(f"   Existing: {len(existing_df)} facilities")

        # Combine and deduplicate
        combined_df = pl.concat([existing_df, new_df], how="diagonal_relaxed")
        combined_df = combined_df.unique(subset=["id"])

        print(f"   After merge: {len(combined_df)} facilities")
        df = combined_df
    else:
        df = new_df

    # Save expanded healthcare
    output_file = output_path / "healthcare_expanded.parquet"
    df.write_parquet(output_file, compression="snappy")

    print(f"\n[+] Saved {len(df)} healthcare facilities to {output_file}")
    print(f"[*] Breakdown by type:")
    print(df.group_by("type").count().sort("count", descending=True))

    # Also update the main healthcare file
    if merge_existing:
        df.write_parquet(existing_file, compression="snappy")
        print(f"[+] Updated {existing_file}")

    print("\n" + "=" * 60)
    print("[+] Healthcare expansion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
