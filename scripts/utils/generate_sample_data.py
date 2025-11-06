#!/usr/bin/env python3
"""
Generate sample property data for testing the frontend.

Creates realistic Dutch property data with:
- BAG addresses (Amsterdam, Rotterdam, Utrecht, Den Haag)
- WOZ valuations
- Property characteristics
- Geographic coordinates
"""

import json
import random
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timedelta

# Dutch cities with their approximate center coordinates
CITIES = {
    "Amsterdam": {"lat": 52.3676, "lng": 4.9041},
    "Rotterdam": {"lat": 51.9244, "lng": 4.4777},
    "Utrecht": {"lat": 52.0907, "lng": 5.1214},
    "Den Haag": {"lat": 52.0705, "lng": 4.3007},
    "Eindhoven": {"lat": 51.4416, "lng": 5.4697},
    "Groningen": {"lat": 53.2194, "lng": 6.5665},
    "Haarlem": {"lat": 52.3874, "lng": 4.6462},
    "Leiden": {"lat": 52.1601, "lng": 4.4970},
}

# Street names (realistic Dutch)
STREET_NAMES = [
    "Hoofdstraat", "Kerkstraat", "Schoolstraat", "Dorpsstraat", "Molenstraat",
    "Stationsweg", "Laanweg", "Bosweg", "Dijkweg", "Parkweg", "Marktstraat",
    "Wilhelminastraat", "Beatrixlaan", "Julianastraat", "Prins Hendrikstraat",
    "Van der Helststraat", "Jan van Galenstraat", "Westerstraat", "Oosteinde",
    "Nieuweweg", "Oudeweg", "Spoorstraat", "Tuinstraat", "Bloemstraat",
]

PROPERTY_TYPES = [
    "appartement",
    "tussenwoning",
    "hoekwoning",
    "vrijstaand",
    "2-onder-1-kap",
]

def random_coordinate_near(center_lat: float, center_lng: float, max_distance_km: float = 5.0) -> Dict[str, float]:
    """Generate random coordinate near a center point."""
    # Rough approximation: 1 degree ≈ 111 km
    lat_offset = random.uniform(-max_distance_km / 111, max_distance_km / 111)
    lng_offset = random.uniform(-max_distance_km / 85, max_distance_km / 85)  # Adjust for latitude

    return {
        "lat": round(center_lat + lat_offset, 6),
        "lng": round(center_lng + lng_offset, 6),
    }

def generate_property(city: str, city_coords: Dict[str, float], property_id: int) -> Dict[str, Any]:
    """Generate a single property with realistic Dutch characteristics."""

    street = random.choice(STREET_NAMES)
    number = random.randint(1, 200)
    addition = random.choice(["", "", "", "A", "B", "bis", "I", "II"])

    property_type = random.choice(PROPERTY_TYPES)

    # Property characteristics based on type
    if property_type == "appartement":
        living_area = random.randint(45, 150)
        plot_area = 0
        rooms = random.randint(1, 4)
        year_built = random.randint(1960, 2023)
    elif property_type == "tussenwoning":
        living_area = random.randint(80, 140)
        plot_area = random.randint(80, 200)
        rooms = random.randint(3, 5)
        year_built = random.randint(1920, 2020)
    elif property_type == "hoekwoning":
        living_area = random.randint(100, 160)
        plot_area = random.randint(100, 250)
        rooms = random.randint(4, 6)
        year_built = random.randint(1930, 2020)
    elif property_type == "vrijstaand":
        living_area = random.randint(120, 300)
        plot_area = random.randint(200, 800)
        rooms = random.randint(4, 8)
        year_built = random.randint(1950, 2023)
    else:  # 2-onder-1-kap
        living_area = random.randint(100, 200)
        plot_area = random.randint(150, 400)
        rooms = random.randint(4, 7)
        year_built = random.randint(1940, 2020)

    # WOZ value based on property characteristics and city
    city_multiplier = {
        "Amsterdam": 1.5,
        "Utrecht": 1.3,
        "Den Haag": 1.1,
        "Rotterdam": 1.0,
        "Haarlem": 1.4,
        "Leiden": 1.2,
        "Eindhoven": 0.95,
        "Groningen": 0.85,
    }.get(city, 1.0)

    base_value = living_area * random.randint(3000, 6000)
    plot_value = plot_area * random.randint(400, 800)
    age_factor = max(0.7, 1.0 - (2023 - year_built) * 0.003)

    woz_value = int((base_value + plot_value) * city_multiplier * age_factor)

    # Energy label
    if year_built >= 2015:
        energy_label = random.choice(["A++", "A+", "A"])
    elif year_built >= 2000:
        energy_label = random.choice(["A", "B", "C"])
    elif year_built >= 1980:
        energy_label = random.choice(["C", "D", "E"])
    else:
        energy_label = random.choice(["D", "E", "F", "G"])

    coords = random_coordinate_near(city_coords["lat"], city_coords["lng"])

    return {
        "id": f"NL.IMBAG.PAND.{property_id:010d}",
        "address": {
            "street": street,
            "number": number,
            "addition": addition,
            "postcode": f"{random.randint(1000, 9999)}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
            "city": city,
        },
        "coordinates": {
            "lat": coords["lat"],
            "lng": coords["lng"],
        },
        "property": {
            "type": property_type,
            "living_area_m2": living_area,
            "plot_area_m2": plot_area,
            "rooms": rooms,
            "year_built": year_built,
            "energy_label": energy_label,
        },
        "valuation": {
            "woz_value": woz_value,
            "woz_year": 2024,
            "price_per_m2": int(woz_value / living_area) if living_area > 0 else 0,
        },
        "metadata": {
            "generated": True,
            "generated_at": datetime.now().isoformat(),
        }
    }

def generate_sample_dataset(num_properties: int = 500) -> List[Dict[str, Any]]:
    """Generate a full sample dataset."""
    properties = []

    # Distribute properties across cities
    cities = list(CITIES.items())
    properties_per_city = num_properties // len(cities)

    property_id = 1
    for city, coords in cities:
        for _ in range(properties_per_city):
            properties.append(generate_property(city, coords, property_id))
            property_id += 1

    # Add remaining properties to Amsterdam
    while len(properties) < num_properties:
        properties.append(generate_property("Amsterdam", CITIES["Amsterdam"], property_id))
        property_id += 1

    return properties

def main():
    """Generate and save sample data."""
    print("🏠 Generating sample property data...")

    # Generate 500 sample properties
    properties = generate_sample_dataset(num_properties=500)

    # Create output directory
    output_dir = Path(__file__).parent.parent.parent / "data" / "samples"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save as JSON
    output_file = output_dir / "sample_properties.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "num_properties": len(properties),
                "cities": list(CITIES.keys()),
                "note": "This is sample data for testing. Not real BAG data.",
            },
            "properties": properties,
        }, f, indent=2, ensure_ascii=False)

    print(f"✅ Generated {len(properties)} sample properties")
    print(f"📁 Saved to: {output_file}")

    # Print some statistics
    print("\n📊 Statistics:")
    by_city = {}
    by_type = {}
    total_value = 0

    for prop in properties:
        city = prop["address"]["city"]
        prop_type = prop["property"]["type"]

        by_city[city] = by_city.get(city, 0) + 1
        by_type[prop_type] = by_type.get(prop_type, 0) + 1
        total_value += prop["valuation"]["woz_value"]

    print("\nBy city:")
    for city, count in sorted(by_city.items(), key=lambda x: x[1], reverse=True):
        print(f"  {city}: {count}")

    print("\nBy type:")
    for prop_type, count in sorted(by_type.items(), key=lambda x: x[1], reverse=True):
        print(f"  {prop_type}: {count}")

    print(f"\nAverage WOZ value: €{int(total_value / len(properties)):,}")
    print(f"Total WOZ value: €{int(total_value):,}")

if __name__ == "__main__":
    main()
