"""
Amenities data ingestion from OpenStreetMap.

Downloads Points of Interest (POIs) that expats care about:
- Supermarkets (Albert Heijn, Jumbo, Lidl, etc.)
- Healthcare (hospitals, doctors, pharmacies)
- International schools
- Parks & green spaces
- Restaurants & cafes
- Sports facilities
- Playgrounds
- Libraries
- Post offices

Data source: OpenStreetMap via Overpass API
License: ODbL (Open Database License)
"""

import json
import time
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# Overpass API endpoints
OVERPASS_API = "https://overpass-api.de/api/interpreter"
OVERPASS_API_ALT = "https://lz4.overpass-api.de/api/interpreter"  # Alternative server

# Amenity queries for Netherlands
AMENITY_QUERIES = {
    "supermarkets": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["shop"="supermarket"](area);
      way["shop"="supermarket"](area);
    );
    out center;
    """,

    "healthcare": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["amenity"~"hospital|clinic|doctors|pharmacy"](area);
      way["amenity"~"hospital|clinic|doctors|pharmacy"](area);
    );
    out center;
    """,

    "international_schools": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["amenity"="school"]["school:type"~"international"](area);
      way["amenity"="school"]["school:type"~"international"](area);
      node["name"~"International School"](area);
      way["name"~"International School"](area);
    );
    out center;
    """,

    "parks": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["leisure"="park"](area);
      way["leisure"="park"](area);
      way["landuse"="recreation_ground"](area);
    );
    out center;
    """,

    "restaurants": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["amenity"~"restaurant|cafe|bar"](area);
      way["amenity"~"restaurant|cafe|bar"](area);
    );
    out center;
    """,

    "sports": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["leisure"~"sports_centre|fitness_centre|swimming_pool"](area);
      way["leisure"~"sports_centre|fitness_centre|swimming_pool"](area);
    );
    out center;
    """,

    "playgrounds": """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2];
    (
      node["leisure"="playground"](area);
      way["leisure"="playground"](area);
    );
    out center;
    """,
}


class OverpassClient:
    """Client for OpenStreetMap Overpass API."""

    def __init__(self, timeout: int = 120, use_alternative: bool = False):
        """
        Initialize Overpass client.

        Args:
            timeout: HTTP request timeout
            use_alternative: Use alternative Overpass server
        """
        self.api_url = OVERPASS_API_ALT if use_alternative else OVERPASS_API

        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (housing search platform; contact@wheretolivenl.nl)",
                "Accept": "application/json",
            }
        )

    def query(self, overpass_query: str) -> Dict:
        """
        Execute Overpass QL query.

        Args:
            overpass_query: Overpass QL query string

        Returns:
            GeoJSON-like result
        """
        try:
            log.info("Executing Overpass query...")
            log.debug(f"Query: {overpass_query[:100]}...")

            response = self.client.post(
                self.api_url,
                data={"data": overpass_query},
                timeout=180  # Overpass can be slow
            )
            response.raise_for_status()

            result = response.json()
            elements = result.get("elements", [])

            log.success(f"Query returned {len(elements)} elements")
            return result

        except httpx.TimeoutException:
            log.error("Query timed out! Try using bbox or smaller area.")
            raise
        except Exception as e:
            log.error(f"Overpass query error: {e}")
            raise

    def get_amenities(self, amenity_type: str) -> List[Dict]:
        """
        Get amenities of a specific type.

        Args:
            amenity_type: Type from AMENITY_QUERIES

        Returns:
            List of POI records
        """
        if amenity_type not in AMENITY_QUERIES:
            raise ValueError(f"Unknown amenity type: {amenity_type}")

        query = AMENITY_QUERIES[amenity_type]

        try:
            result = self.query(query)
            return result.get("elements", [])

        except Exception as e:
            log.error(f"Failed to get {amenity_type}: {e}")
            raise

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_osm_element(element: Dict, amenity_type: str) -> Dict:
    """
    Transform OSM element to simplified format.

    Args:
        element: OSM element from Overpass
        amenity_type: Amenity category

    Returns:
        Simplified POI record
    """
    tags = element.get("tags", {})

    # Get coordinates (handle both nodes and ways with center)
    if element.get("type") == "node":
        lat = element.get("lat")
        lng = element.get("lon")
    elif element.get("type") == "way" and "center" in element:
        lat = element.get("center", {}).get("lat")
        lng = element.get("center", {}).get("lon")
    else:
        lat = None
        lng = None

    return {
        "osm_id": element.get("id"),
        "osm_type": element.get("type"),
        "amenity_type": amenity_type,
        "name": tags.get("name"),
        "name_en": tags.get("name:en"),
        "brand": tags.get("brand"),
        "operator": tags.get("operator"),
        "lat": lat,
        "lng": lng,
        "street": tags.get("addr:street"),
        "housenumber": tags.get("addr:housenumber"),
        "postcode": tags.get("addr:postcode"),
        "city": tags.get("addr:city"),
        "phone": tags.get("phone"),
        "website": tags.get("website"),
        "opening_hours": tags.get("opening_hours"),
        "wheelchair": tags.get("wheelchair"),
        "tags": tags,  # Keep all tags for reference
    }


@click.command()
@click.option(
    "--amenity",
    type=click.Choice(list(AMENITY_QUERIES.keys()) + ["all"]),
    default="supermarkets",
    help="Type of amenities to download"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/amenities.json",
    help="Output JSON file"
)
@click.option(
    "--alternative-server",
    is_flag=True,
    help="Use alternative Overpass server (if main is overloaded)"
)
def main(amenity: str, output: str, alternative_server: bool):
    """
    Download amenities from OpenStreetMap.

    Amenities expats care about:
    - supermarkets: Albert Heijn, Jumbo, Lidl, etc.
    - healthcare: Hospitals, doctors, pharmacies
    - international_schools: International schools
    - parks: Parks & green spaces
    - restaurants: Restaurants, cafes, bars
    - sports: Sports facilities, gyms, pools
    - playgrounds: Playgrounds for kids

    Examples:
        # Download supermarkets
        python -m ingest.amenities_osm --amenity supermarkets

        # Download all amenities (slow!)
        python -m ingest.amenities_osm --amenity all

        # Use alternative server if main is overloaded
        python -m ingest.amenities_osm --alternative-server

    Note: Large queries may take 1-2 minutes!
    Overpass API has rate limits - be patient between requests.
    """
    log.info("=== OpenStreetMap Amenities Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    amenity_types = list(AMENITY_QUERIES.keys()) if amenity == "all" else [amenity]

    log.info(f"Downloading: {amenity_types}")
    if alternative_server:
        log.info("Using alternative Overpass server")

    all_amenities = []

    with OverpassClient(use_alternative=alternative_server) as client:
        for amenity_type in amenity_types:
            log.info(f"\nFetching {amenity_type}...")

            try:
                elements = client.get_amenities(amenity_type)

                log.info(f"Processing {len(elements)} {amenity_type}...")
                for element in tqdm(elements, desc=f"Transforming {amenity_type}"):
                    transformed = transform_osm_element(element, amenity_type)
                    all_amenities.append(transformed)

                # Be nice to Overpass API - wait between requests
                if len(amenity_types) > 1:
                    log.info("Waiting 2 seconds before next query...")
                    time.sleep(2)

            except Exception as e:
                log.error(f"Failed to fetch {amenity_type}: {e}")
                log.warning("Continuing with other amenities...")
                continue

    if not all_amenities:
        log.error("No amenities downloaded!")
        return

    log.success(f"Downloaded {len(all_amenities)} total amenities")

    # Save
    result = {
        "metadata": {
            "source": "OpenStreetMap (Overpass API)",
            "amenity_types": amenity_types,
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_amenities": len(all_amenities),
            "license": "ODbL (Open Database License)",
            "attribution": "© OpenStreetMap contributors",
            "note": "Must attribute OSM when using this data"
        },
        "data": all_amenities
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(all_amenities)} amenities to {output_path}")

    # Statistics
    log.info("\n=== Statistics ===")

    # Count by amenity type
    types = {}
    for amenity in all_amenities:
        t = amenity.get("amenity_type", "unknown")
        types[t] = types.get(t, 0) + 1

    log.info("Amenities by type:")
    for amenity_type, count in sorted(types.items(), key=lambda x: x[1], reverse=True):
        log.info(f"  {amenity_type}: {count}")

    # Show sample supermarkets
    if "supermarkets" in amenity_types:
        supermarkets = [a for a in all_amenities if a.get("amenity_type") == "supermarkets"]
        brands = {}
        for s in supermarkets:
            brand = s.get("brand") or s.get("operator") or "Unknown"
            brands[brand] = brands.get(brand, 0) + 1

        log.info("\nTop supermarket brands:")
        for brand, count in sorted(brands.items(), key=lambda x: x[1], reverse=True)[:10]:
            log.info(f"  {brand}: {count}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.1f} MB")

    log.info("\n💡 Tips:")
    log.info("- Overpass API has rate limits - wait between large queries")
    log.info("- Data is real-time from OSM - quality varies by area")
    log.info("- Must attribute OpenStreetMap when displaying data")


if __name__ == "__main__":
    main()
