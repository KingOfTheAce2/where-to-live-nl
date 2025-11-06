#!/usr/bin/env python3
"""
Generate sample schools data for testing the frontend.

Creates realistic Dutch school data with:
- Primary schools (basisscholen)
- Secondary schools (middelbare scholen)
- Geographic coordinates across major cities
- School characteristics (size, type, denomination)
"""

import json
import random
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Dutch cities with their approximate center coordinates
CITIES = {
    "Amsterdam": {"lat": 52.3676, "lng": 4.9041},
    "Rotterdam": {"lat": 51.9244, "lng": 4.4777},
    "Utrecht": {"lat": 52.0907, "lng": 5.1214},
    "Den Haag": {"lat": 52.0705, "lng": 4.3007},
    "Eindhoven": {"lat": 51.4416, "lng": 5.4697},
    "Groningen": {"lat": 53.2194, "lng": 6.5665},
}

# School name components (realistic Dutch)
PRIMARY_NAMES = [
    "De Regenboog", "Het Kompas", "De Springplank", "De Zonnewijzer",
    "Het Anker", "De Kameleon", "De Klimop", "Het Palet", "De Rank",
    "De Tweemaster", "Het Sterrenbos", "De Boomhut", "De Vuurtoren",
    "Het Mozaïek", "De Triangel", "De Wereldbol", "Het Klaverblad",
    "De Wilg", "De Horizon", "Het Spectrum"
]

SECONDARY_NAMES = [
    "Gymnasium", "Lyceum", "Scholengemeenschap", "College", "Atheneum"
]

SECONDARY_SUFFIXES = [
    "Johannes Calvijn", "Erasmus", "Montessori", "Vossius", "Barlaeus",
    "Het Baarnsch Lyceum", "Stedelijk", "Christelijk"
]

DENOMINATIONS = ["Openbaar", "Rooms-Katholiek", "Protestants-Christelijk", "Algemeen bijzonder"]

def random_coordinate_near(center_lat: float, center_lng: float, max_distance_km: float = 5.0) -> Dict[str, float]:
    """Generate random coordinate near a center point."""
    lat_offset = random.uniform(-max_distance_km / 111, max_distance_km / 111)
    lng_offset = random.uniform(-max_distance_km / 85, max_distance_km / 85)

    return {
        "lat": round(center_lat + lat_offset, 6),
        "lng": round(center_lng + lng_offset, 6),
    }

def generate_primary_school(city: str, city_coords: Dict[str, float], school_id: int) -> Dict[str, Any]:
    """Generate a primary school."""
    name = random.choice(PRIMARY_NAMES)
    denomination = random.choice(DENOMINATIONS)
    students = random.randint(100, 500)

    coords = random_coordinate_near(city_coords["lat"], city_coords["lng"])

    return {
        "id": f"PO-{school_id:05d}",
        "name": f"{name}",
        "type": "primary",
        "denomination": denomination,
        "city": city,
        "coordinates": {
            "lat": coords["lat"],
            "lng": coords["lng"],
        },
        "students": students,
        "grades": "1-8",
        "age_range": "4-12",
        "metadata": {
            "generated": True,
            "generated_at": datetime.now().isoformat(),
        }
    }

def generate_secondary_school(city: str, city_coords: Dict[str, float], school_id: int) -> Dict[str, Any]:
    """Generate a secondary school."""
    school_type = random.choice(SECONDARY_NAMES)
    suffix = random.choice(SECONDARY_SUFFIXES)
    name = f"{school_type} {suffix}"
    denomination = random.choice(DENOMINATIONS)
    students = random.randint(500, 2000)

    # Education levels
    levels = []
    if random.random() > 0.3:
        levels.append("VMBO")
    if random.random() > 0.4:
        levels.append("HAVO")
    if random.random() > 0.5:
        levels.append("VWO")

    if not levels:
        levels = ["VMBO", "HAVO", "VWO"]

    coords = random_coordinate_near(city_coords["lat"], city_coords["lng"])

    return {
        "id": f"VO-{school_id:05d}",
        "name": name,
        "type": "secondary",
        "denomination": denomination,
        "city": city,
        "coordinates": {
            "lat": coords["lat"],
            "lng": coords["lng"],
        },
        "students": students,
        "levels": levels,
        "age_range": "12-18",
        "metadata": {
            "generated": True,
            "generated_at": datetime.now().isoformat(),
        }
    }

def generate_sample_dataset(num_primary: int = 150, num_secondary: int = 50) -> Dict[str, List[Dict[str, Any]]]:
    """Generate a full sample dataset."""
    primary_schools = []
    secondary_schools = []

    cities = list(CITIES.items())

    # Distribute primary schools across cities
    primary_per_city = num_primary // len(cities)
    primary_id = 1
    for city, coords in cities:
        for _ in range(primary_per_city):
            primary_schools.append(generate_primary_school(city, coords, primary_id))
            primary_id += 1

    # Add remaining primary schools to Amsterdam
    while len(primary_schools) < num_primary:
        primary_schools.append(generate_primary_school("Amsterdam", CITIES["Amsterdam"], primary_id))
        primary_id += 1

    # Distribute secondary schools across cities
    secondary_per_city = num_secondary // len(cities)
    secondary_id = 1
    for city, coords in cities:
        for _ in range(secondary_per_city):
            secondary_schools.append(generate_secondary_school(city, coords, secondary_id))
            secondary_id += 1

    # Add remaining secondary schools to Amsterdam
    while len(secondary_schools) < num_secondary:
        secondary_schools.append(generate_secondary_school("Amsterdam", CITIES["Amsterdam"], secondary_id))
        secondary_id += 1

    return {
        "primary": primary_schools,
        "secondary": secondary_schools,
    }

def main():
    """Generate and save sample data."""
    print("🏫 Generating sample schools data...")

    # Generate schools
    schools = generate_sample_dataset(num_primary=150, num_secondary=50)

    # Create output directory
    output_dir = Path(__file__).parent.parent.parent / "data" / "samples"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save as JSON
    output_file = output_dir / "sample_schools.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "num_primary": len(schools["primary"]),
                "num_secondary": len(schools["secondary"]),
                "cities": list(CITIES.keys()),
                "note": "This is sample data for testing. Not real DUO data.",
            },
            "schools": schools["primary"] + schools["secondary"],
        }, f, indent=2, ensure_ascii=False)

    print(f"✅ Generated {len(schools['primary'])} primary schools")
    print(f"✅ Generated {len(schools['secondary'])} secondary schools")
    print(f"📁 Saved to: {output_file}")

    # Print some statistics
    print("\n📊 Statistics:")
    print(f"Total schools: {len(schools['primary']) + len(schools['secondary'])}")

    by_city = {}
    for school in schools["primary"] + schools["secondary"]:
        city = school["city"]
        by_city[city] = by_city.get(city, 0) + 1

    print("\nBy city:")
    for city, count in sorted(by_city.items(), key=lambda x: x[1], reverse=True):
        print(f"  {city}: {count}")

if __name__ == "__main__":
    main()
