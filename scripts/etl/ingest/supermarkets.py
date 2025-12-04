"""
Supermarket data ingestion from multiple sources.

Downloads supermarket locations from:
1. OpenStreetMap (Overpass API) - crowdsourced, most complete
2. Direct chain APIs/scrapers - official data per chain
3. Third-party datasets - compiled lists

Major Dutch supermarket chains:
- Albert Heijn (AH, AH to go, AH XL) - ~1000+ locations
- Jumbo - ~700+ locations
- Lidl - ~430+ locations
- Aldi - ~500+ locations
- Plus - ~270+ locations
- Dirk van den Broek - ~120+ locations
- Vomar - ~70+ locations
- Hoogvliet - ~70+ locations
- Coop - ~300+ locations (merged with Plus)
- Spar - ~400+ locations
- Deen - ~80+ locations (acquired by AH/Vomar/DekaMarkt)
- Jan Linders - ~60+ locations
- Nettorama - ~16 locations
- Poiesz - ~70+ locations
- DekaMarkt - ~80+ locations
- Ekoplaza - ~80+ locations (organic)
- Marqt - ~15+ locations (premium)

Data sources:
- OpenStreetMap (Overpass API)
- Store locator pages (scraping)
- Community datasets

License: Various (OSM: ODbL, scraped: fair use for non-commercial)
"""

import json
import time
import re
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# Overpass API for OSM data
OVERPASS_API = "https://overpass-api.de/api/interpreter"
OVERPASS_API_ALT = "https://lz4.overpass-api.de/api/interpreter"

# Chain-specific API endpoints (discovered through reverse engineering)
CHAIN_APIS = {
    "albert_heijn": {
        "stores_api": "https://www.ah.nl/gql",
        "method": "graphql",
        "headers": {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    },
    "jumbo": {
        "stores_api": "https://www.jumbo.com/api/stores",
        "method": "rest",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    },
    "lidl": {
        "stores_api": "https://www.lidl.nl/s/storelocator/data.json",
        "method": "json",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    }
}

# Extended Overpass query for all supermarket types
SUPERMARKET_QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
(
  // Standard supermarkets
  node["shop"="supermarket"](area.nl);
  way["shop"="supermarket"](area.nl);

  // Convenience stores with major brands
  node["shop"="convenience"]["brand"](area.nl);
  way["shop"="convenience"]["brand"](area.nl);

  // Grocery stores
  node["shop"="grocery"](area.nl);
  way["shop"="grocery"](area.nl);

  // Department stores with grocery (HEMA, etc.)
  node["shop"="department_store"]["brand"~"HEMA|Action"](area.nl);
  way["shop"="department_store"]["brand"~"HEMA|Action"](area.nl);
);
out center meta;
"""

# Known Dutch supermarket brands for filtering/enrichment
DUTCH_SUPERMARKET_BRANDS = {
    # Full-service supermarkets
    "Albert Heijn": {"type": "full_service", "size": "large"},
    "AH": {"type": "full_service", "size": "large"},
    "AH to go": {"type": "convenience", "size": "small"},
    "AH XL": {"type": "full_service", "size": "xlarge"},
    "Jumbo": {"type": "full_service", "size": "large"},
    "Plus": {"type": "full_service", "size": "medium"},
    "Coop": {"type": "full_service", "size": "medium"},
    "Spar": {"type": "convenience", "size": "small"},
    "Spar City": {"type": "convenience", "size": "small"},
    "Spar Express": {"type": "convenience", "size": "small"},

    # Discount supermarkets
    "Lidl": {"type": "discount", "size": "medium"},
    "Aldi": {"type": "discount", "size": "medium"},
    "Dirk": {"type": "discount", "size": "medium"},
    "Dirk van den Broek": {"type": "discount", "size": "medium"},
    "Nettorama": {"type": "discount", "size": "medium"},
    "Vomar": {"type": "discount", "size": "medium"},

    # Regional supermarkets
    "Hoogvliet": {"type": "regional", "size": "medium"},
    "Deen": {"type": "regional", "size": "medium"},
    "Jan Linders": {"type": "regional", "size": "medium"},
    "Poiesz": {"type": "regional", "size": "medium"},
    "DekaMarkt": {"type": "regional", "size": "medium"},
    "Boni": {"type": "regional", "size": "medium"},
    "MCD": {"type": "regional", "size": "medium"},

    # Organic/specialty
    "Ekoplaza": {"type": "organic", "size": "medium"},
    "Marqt": {"type": "premium", "size": "medium"},
    "EkoPlaza": {"type": "organic", "size": "medium"},

    # Ethnic supermarkets (common in cities)
    "Tanger": {"type": "ethnic", "size": "medium"},
    "Toko": {"type": "ethnic", "size": "small"},
    "Amazing Oriental": {"type": "ethnic", "size": "large"},
}


class SupermarketClient:
    """Client for downloading supermarket data from various sources."""

    def __init__(self, timeout: int = 120):
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (housing search platform)",
                "Accept": "application/json, */*",
            }
        )

    def get_osm_supermarkets(self, use_alternative: bool = False) -> List[Dict]:
        """
        Get supermarkets from OpenStreetMap via Overpass API.
        """
        api_url = OVERPASS_API_ALT if use_alternative else OVERPASS_API

        try:
            log.info("Fetching supermarkets from OpenStreetMap...")
            log.info(f"Using: {api_url}")

            response = self.client.post(
                api_url,
                data={"data": SUPERMARKET_QUERY},
                timeout=300  # 5 minutes for large query
            )
            response.raise_for_status()

            data = response.json()
            elements = data.get("elements", [])

            log.success(f"Retrieved {len(elements)} supermarket locations from OSM")
            return elements

        except Exception as e:
            log.error(f"Error fetching from OSM: {e}")
            return []

    def get_lidl_stores(self) -> List[Dict]:
        """
        Get Lidl store locations from their store finder.
        """
        try:
            log.info("Fetching Lidl stores...")

            # Lidl's store data JSON endpoint
            response = self.client.get(
                "https://www.lidl.nl/s/storelocator/data.json",
                headers={"Accept": "application/json"}
            )

            if response.status_code == 200:
                data = response.json()
                stores = data if isinstance(data, list) else data.get("stores", [])
                log.success(f"Retrieved {len(stores)} Lidl stores")
                return stores
        except Exception as e:
            log.warning(f"Could not fetch Lidl stores: {e}")

        return []

    def get_jumbo_stores(self, lat: float = 52.0, lng: float = 5.0, limit: int = 1000) -> List[Dict]:
        """
        Get Jumbo store locations from their API.
        """
        try:
            log.info("Fetching Jumbo stores...")

            # Jumbo's store API
            response = self.client.get(
                f"https://www.jumbo.com/api/stores?latitude={lat}&longitude={lng}&limit={limit}",
                headers={
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                }
            )

            if response.status_code == 200:
                data = response.json()
                stores = data.get("stores", data) if isinstance(data, dict) else data
                if isinstance(stores, list):
                    log.success(f"Retrieved {len(stores)} Jumbo stores")
                    return stores
        except Exception as e:
            log.warning(f"Could not fetch Jumbo stores: {e}")

        return []

    def get_ah_stores(self) -> List[Dict]:
        """
        Get Albert Heijn store locations from their store finder API.
        Source: https://www.ah.nl/winkels
        """
        try:
            log.info("Fetching Albert Heijn stores...")

            # AH uses a JSON endpoint for store data
            # First try the store finder API
            stores = []

            # Try fetching stores by region (Netherlands bounding box)
            # AH API returns stores near a location
            response = self.client.get(
                "https://www.ah.nl/service/rest/delegate?url=/zoeken/winkels?lat=52.1&long=5.3&radius=200",
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout=60
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    # AH returns nested structure
                    if isinstance(data, dict):
                        stores_data = data.get("stores", data.get("results", []))
                        if isinstance(stores_data, list):
                            stores = stores_data
                except:
                    pass

            # Fallback: try alternative endpoint
            if not stores:
                response = self.client.get(
                    "https://www.ah.nl/gql",
                    params={
                        "operationName": "stores",
                        "variables": '{"latitude":52.1,"longitude":5.3}',
                        "extensions": '{"persistedQuery":{"version":1}}'
                    },
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    timeout=60
                )
                if response.status_code == 200:
                    try:
                        data = response.json()
                        stores = data.get("data", {}).get("stores", [])
                    except:
                        pass

            if stores:
                log.success(f"Retrieved {len(stores)} Albert Heijn stores")
            else:
                log.warning("Could not fetch AH stores from API - will rely on OSM data")

            return stores

        except Exception as e:
            log.warning(f"Could not fetch Albert Heijn stores: {e}")

        return []

    def get_aldi_stores(self) -> List[Dict]:
        """
        Get Aldi store locations from their store finder.
        Source: https://www.aldi.nl/supermarkt.html
        """
        try:
            log.info("Fetching Aldi stores...")

            # Aldi uses a JSON API endpoint
            response = self.client.get(
                "https://www.aldi.nl/service/rest/store-locator/search",
                params={
                    "latitude": "52.1",
                    "longitude": "5.3",
                    "radius": "500",  # km - covers entire Netherlands
                    "limit": "1000"
                },
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout=60
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    stores = data.get("stores", data) if isinstance(data, dict) else data
                    if isinstance(stores, list):
                        log.success(f"Retrieved {len(stores)} Aldi stores")
                        return stores
                except:
                    pass

            # Fallback: try alternative endpoint
            response = self.client.get(
                "https://www.aldi.nl/.rest/store-locator/v1/stores",
                params={"countryCode": "NL"},
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout=60
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    stores = data.get("stores", data) if isinstance(data, dict) else data
                    if isinstance(stores, list):
                        log.success(f"Retrieved {len(stores)} Aldi stores")
                        return stores
                except:
                    pass

            log.warning("Could not fetch Aldi stores from API - will rely on OSM data")

        except Exception as e:
            log.warning(f"Could not fetch Aldi stores: {e}")

        return []

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def transform_osm_element(element: Dict) -> Dict:
    """
    Transform OSM element to standardized format.
    """
    tags = element.get("tags", {})

    # Get coordinates
    if element.get("type") == "node":
        lat = element.get("lat")
        lng = element.get("lon")
    elif element.get("type") == "way" and "center" in element:
        lat = element.get("center", {}).get("lat")
        lng = element.get("center", {}).get("lon")
    else:
        lat = None
        lng = None

    # Get brand info
    brand = tags.get("brand") or tags.get("name") or tags.get("operator")
    brand_info = DUTCH_SUPERMARKET_BRANDS.get(brand, {})

    return {
        "id": f"osm_{element.get('id')}",
        "source": "openstreetmap",
        "osm_id": element.get("id"),
        "osm_type": element.get("type"),
        "name": tags.get("name"),
        "brand": brand,
        "brand_type": brand_info.get("type", "unknown"),
        "size_category": brand_info.get("size", "unknown"),
        "latitude": lat,
        "lng": lng,
        "address": {
            "street": tags.get("addr:street"),
            "housenumber": tags.get("addr:housenumber"),
            "postcode": tags.get("addr:postcode"),
            "city": tags.get("addr:city"),
            "country": "NL"
        },
        "contact": {
            "phone": tags.get("phone"),
            "website": tags.get("website"),
            "email": tags.get("email")
        },
        "opening_hours": tags.get("opening_hours"),
        "wheelchair": tags.get("wheelchair"),
        "organic": tags.get("organic"),
        "shop_type": tags.get("shop"),
        "timestamp": element.get("timestamp")
    }


def transform_lidl_store(store: Dict) -> Dict:
    """
    Transform Lidl store data to standardized format.
    """
    return {
        "id": f"lidl_{store.get('id', store.get('storeNumber', ''))}",
        "source": "lidl_api",
        "name": store.get("name", "Lidl"),
        "brand": "Lidl",
        "brand_type": "discount",
        "size_category": "medium",
        "latitude": store.get("latitude") or store.get("lat"),
        "lng": store.get("longitude") or store.get("lng") or store.get("lon"),
        "address": {
            "street": store.get("street") or store.get("addressLine1"),
            "housenumber": store.get("houseNumber"),
            "postcode": store.get("postalCode") or store.get("zipCode"),
            "city": store.get("city"),
            "country": "NL"
        },
        "contact": {
            "phone": store.get("phone"),
            "website": "https://www.lidl.nl"
        },
        "opening_hours": store.get("openingHours")
    }


def transform_jumbo_store(store: Dict) -> Dict:
    """
    Transform Jumbo store data to standardized format.
    """
    address = store.get("address", {})
    location = store.get("location", store.get("geoLocation", {}))

    return {
        "id": f"jumbo_{store.get('id', store.get('storeId', ''))}",
        "source": "jumbo_api",
        "name": store.get("name", "Jumbo"),
        "brand": "Jumbo",
        "brand_type": "full_service",
        "size_category": "large",
        "latitude": location.get("latitude") or location.get("lat"),
        "lng": location.get("longitude") or location.get("lng"),
        "address": {
            "street": address.get("street") or address.get("streetName"),
            "housenumber": address.get("houseNumber") or address.get("streetNumber"),
            "postcode": address.get("postalCode") or address.get("zipCode"),
            "city": address.get("city"),
            "country": "NL"
        },
        "contact": {
            "phone": store.get("phoneNumber"),
            "website": "https://www.jumbo.com"
        },
        "opening_hours": store.get("openingTimes")
    }


def transform_ah_store(store: Dict) -> Dict:
    """
    Transform Albert Heijn store data to standardized format.
    """
    address = store.get("address", {})
    location = store.get("location", store.get("geoLocation", store.get("coordinates", {})))

    # Handle different AH API response formats
    lat = location.get("latitude") or location.get("lat") or store.get("lat")
    lng = location.get("longitude") or location.get("lng") or location.get("lon") or store.get("lng")

    return {
        "id": f"ah_{store.get('id', store.get('storeId', ''))}",
        "source": "ah_api",
        "name": store.get("name", "Albert Heijn"),
        "brand": "Albert Heijn",
        "brand_type": "full_service",
        "size_category": "large" if "XL" in store.get("name", "") else "medium",
        "latitude": lat,
        "lng": lng,
        "address": {
            "street": address.get("street") or address.get("streetName") or store.get("street"),
            "housenumber": address.get("houseNumber") or address.get("streetNumber") or store.get("houseNumber"),
            "postcode": address.get("postalCode") or address.get("zipCode") or store.get("postalCode"),
            "city": address.get("city") or store.get("city"),
            "country": "NL"
        },
        "contact": {
            "phone": store.get("phoneNumber") or store.get("phone"),
            "website": "https://www.ah.nl"
        },
        "opening_hours": store.get("openingTimes") or store.get("openingHours")
    }


def transform_aldi_store(store: Dict) -> Dict:
    """
    Transform Aldi store data to standardized format.
    """
    address = store.get("address", {})
    location = store.get("location", store.get("geoLocation", store.get("coordinates", {})))

    # Handle different Aldi API response formats
    lat = location.get("latitude") or location.get("lat") or store.get("lat") or store.get("latitude")
    lng = location.get("longitude") or location.get("lng") or location.get("lon") or store.get("lng") or store.get("longitude")

    return {
        "id": f"aldi_{store.get('id', store.get('storeId', store.get('storeNumber', '')))}",
        "source": "aldi_api",
        "name": store.get("name", "Aldi"),
        "brand": "Aldi",
        "brand_type": "discount",
        "size_category": "medium",
        "latitude": lat,
        "lng": lng,
        "address": {
            "street": address.get("street") or address.get("streetName") or store.get("street"),
            "housenumber": address.get("houseNumber") or address.get("streetNumber") or store.get("houseNumber"),
            "postcode": address.get("postalCode") or address.get("zipCode") or store.get("postalCode"),
            "city": address.get("city") or store.get("city"),
            "country": "NL"
        },
        "contact": {
            "phone": store.get("phoneNumber") or store.get("phone"),
            "website": "https://www.aldi.nl"
        },
        "opening_hours": store.get("openingTimes") or store.get("openingHours")
    }


def deduplicate_stores(stores: List[Dict], threshold_meters: float = 50) -> List[Dict]:
    """
    Remove duplicate stores based on location proximity.
    """
    from math import radians, cos, sin, asin, sqrt

    def haversine(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in meters."""
        R = 6371000  # Earth radius in meters

        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))

        return R * c

    unique_stores = []
    seen_locations = []

    for store in stores:
        lat = store.get("latitude")
        lng = store.get("lng")

        if lat is None or lng is None:
            continue

        # Check if we've seen a similar location
        is_duplicate = False
        for seen_lat, seen_lng in seen_locations:
            try:
                distance = haversine(lat, lng, seen_lat, seen_lng)
                if distance < threshold_meters:
                    is_duplicate = True
                    break
            except:
                pass

        if not is_duplicate:
            unique_stores.append(store)
            seen_locations.append((lat, lng))

    return unique_stores


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/supermarkets.json",
    help="Output JSON file"
)
@click.option(
    "--source",
    type=click.Choice(["all", "osm", "chains"]),
    default="all",
    help="Data source(s) to use"
)
@click.option(
    "--alternative-server",
    is_flag=True,
    help="Use alternative Overpass server"
)
@click.option(
    "--deduplicate/--no-deduplicate",
    default=True,
    help="Remove duplicate locations"
)
def main(output: str, source: str, alternative_server: bool, deduplicate: bool):
    """
    Download supermarket data from multiple sources.

    Sources:
    - osm: OpenStreetMap via Overpass API (most complete)
    - chains: Direct APIs from supermarket chains
    - all: Combine all sources

    Examples:
        # Download from all sources
        python supermarkets.py

        # Only OSM data
        python supermarkets.py --source osm

        # Use alternative Overpass server
        python supermarkets.py --alternative-server

    Note: Chain APIs may have rate limits or change without notice.
    """
    log.info("=== Supermarket Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    all_stores = []

    with SupermarketClient() as client:

        # OpenStreetMap data
        if source in ["all", "osm"]:
            osm_elements = client.get_osm_supermarkets(use_alternative=alternative_server)
            for element in tqdm(osm_elements, desc="Processing OSM data"):
                store = transform_osm_element(element)
                if store.get("latitude") and store.get("lng"):
                    all_stores.append(store)

            log.info(f"Processed {len(osm_elements)} OSM locations")

        # Chain-specific APIs
        if source in ["all", "chains"]:
            # Lidl
            lidl_stores = client.get_lidl_stores()
            for store in lidl_stores:
                transformed = transform_lidl_store(store)
                if transformed.get("latitude") and transformed.get("lng"):
                    all_stores.append(transformed)

            # Wait between API calls
            time.sleep(1)

            # Jumbo
            jumbo_stores = client.get_jumbo_stores()
            for store in jumbo_stores:
                transformed = transform_jumbo_store(store)
                if transformed.get("latitude") and transformed.get("lng"):
                    all_stores.append(transformed)

            # Wait between API calls
            time.sleep(1)

            # Albert Heijn
            ah_stores = client.get_ah_stores()
            for store in ah_stores:
                transformed = transform_ah_store(store)
                if transformed.get("latitude") and transformed.get("lng"):
                    all_stores.append(transformed)

            # Wait between API calls
            time.sleep(1)

            # Aldi
            aldi_stores = client.get_aldi_stores()
            for store in aldi_stores:
                transformed = transform_aldi_store(store)
                if transformed.get("latitude") and transformed.get("lng"):
                    all_stores.append(transformed)

    log.info(f"Total stores before deduplication: {len(all_stores)}")

    # Deduplicate
    if deduplicate:
        all_stores = deduplicate_stores(all_stores)
        log.info(f"After deduplication: {len(all_stores)}")

    # Create output structure
    result = {
        "metadata": {
            "source": "OpenStreetMap, Chain APIs",
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_supermarkets": len(all_stores),
            "license": "ODbL (OSM), fair use (chain APIs)",
            "attribution": "© OpenStreetMap contributors, Chain store data"
        },
        "data": all_stores
    }

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved {len(all_stores)} supermarkets to {output_path}")

    # Statistics
    log.info("\n=== Statistics ===")

    # Count by brand
    brands = {}
    for store in all_stores:
        brand = store.get("brand") or "Unknown"
        brands[brand] = brands.get(brand, 0) + 1

    log.info("\nTop 15 brands:")
    for brand, count in sorted(brands.items(), key=lambda x: x[1], reverse=True)[:15]:
        log.info(f"  {brand}: {count}")

    # Count by type
    types = {}
    for store in all_stores:
        btype = store.get("brand_type", "unknown")
        types[btype] = types.get(btype, 0) + 1

    log.info("\nBy type:")
    for btype, count in sorted(types.items(), key=lambda x: x[1], reverse=True):
        log.info(f"  {btype}: {count}")

    # Count by source
    sources = {}
    for store in all_stores:
        src = store.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    log.info("\nBy source:")
    for src, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
        log.info(f"  {src}: {count}")

    file_size_mb = output_path.stat().st_size / 1024 / 1024
    log.info(f"\nFile size: {file_size_mb:.2f} MB")


if __name__ == "__main__":
    main()
