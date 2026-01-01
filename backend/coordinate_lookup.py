"""
Coordinate to neighborhood (area_code) lookup service.

This module provides reverse geocoding: given (lat, lng), find the neighborhood code.
Uses CBS neighborhood boundary data from PDOK.
"""

import polars as pl
from pathlib import Path
from typing import Optional, Tuple
import httpx

# For now, use a simple bounding box approach with CBS demographics
# TODO: Implement proper spatial join with CBS neighborhood boundaries from PDOK

CBS_DEMOGRAPHICS_PATH = Path(__file__).parent.parent / "data" / "processed" / "cbs_demographics.parquet"

# Cache for the demographics dataframe
_df_cache: Optional[pl.DataFrame] = None


def load_demographics_df() -> pl.DataFrame:
    """Load CBS demographics dataframe with caching."""
    global _df_cache

    if _df_cache is not None:
        return _df_cache

    if not CBS_DEMOGRAPHICS_PATH.exists():
        raise FileNotFoundError(f"CBS demographics file not found: {CBS_DEMOGRAPHICS_PATH}")

    _df_cache = pl.read_parquet(CBS_DEMOGRAPHICS_PATH)
    return _df_cache


def find_neighborhood_by_postal_code(postal_code: str) -> Optional[str]:
    """
    Find neighborhood code by postal code.

    This is a simple lookup that won't work for all cases since:
    - One postal code can span multiple neighborhoods
    - We need the house number for precise lookup

    Args:
        postal_code: Dutch postal code (e.g., "1011AB")

    Returns:
        Area code (e.g., "BU03630001") or None
    """
    # This is a placeholder - we need BAG data with postal code -> neighborhood mapping
    # For now, return None to indicate we need better data
    return None


async def reverse_geocode_pdok(lat: float, lng: float) -> Optional[dict]:
    """
    Use PDOK reverse geocoding API to get full address information including buurtcode.

    Two-step process:
    1. /reverse endpoint to get address ID from coordinates
    2. /lookup endpoint to get full details including buurtcode

    Args:
        lat: Latitude
        lng: Longitude

    Returns:
        Full address information including buurtcode
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Reverse geocode to get address ID
            reverse_url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse"
            params = {
                "lat": lat,
                "lon": lng,
                "rows": 1
            }

            response = await client.get(reverse_url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("response", {}).get("numFound", 0) == 0:
                return None

            docs = data["response"]["docs"]
            if not docs:
                return None

            address_id = docs[0].get("id")
            if not address_id:
                return docs[0]  # Return basic info if no ID

            # Step 2: Lookup full details using the address ID
            lookup_url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup"
            lookup_params = {"id": address_id}

            lookup_response = await client.get(lookup_url, params=lookup_params)
            lookup_response.raise_for_status()
            lookup_data = lookup_response.json()

            lookup_docs = lookup_data.get("response", {}).get("docs", [])
            if lookup_docs:
                return lookup_docs[0]  # Full address data with buurtcode

            return docs[0]  # Fallback to basic reverse result

    except Exception as e:
        print(f"Error in PDOK reverse geocoding: {e}")
        return None


async def find_neighborhood_by_coordinates(lat: float, lng: float) -> Optional[str]:
    """
    Find neighborhood code (area_code) by coordinates.

    Strategy:
    1. Use PDOK reverse geocoding to get address - this directly returns buurtcode!
    2. Fallback to WFS spatial query if needed

    Args:
        lat: Latitude (WGS84)
        lng: Longitude (WGS84)

    Returns:
        Neighborhood code (e.g., "BU03630001") or None
    """
    try:
        # Step 1: Get address from coordinates via PDOK reverse geocoding
        # PDOK directly returns buurtcode in the response!
        address_info = await reverse_geocode_pdok(lat, lng)

        if address_info:
            # PDOK lookup response includes buurtcode directly
            buurt_code = address_info.get("buurtcode")
            if buurt_code:
                # Skip "Buitenland" (foreign/no data) codes
                if buurt_code == "BU09989999":
                    print("Coordinates are outside CBS neighborhood boundaries (Buitenland)")
                    return None
                print(f"Found buurtcode {buurt_code} from PDOK for coordinates {lat}, {lng}")
                return buurt_code

            # Some address types might not have buurtcode, log for debugging
            print(f"PDOK returned address but no buurtcode for {lat}, {lng}: type={address_info.get('type')}")
        else:
            print(f"No address found for coordinates {lat}, {lng}")

        # Fallback to WFS spatial query
        print(f"Falling back to WFS lookup for {lat}, {lng}")
        return await find_neighborhood_by_coordinates_wfs(lat, lng)

    except Exception as e:
        print(f"Error finding neighborhood by coordinates: {e}")
        # Fallback to WFS method
        return await find_neighborhood_by_coordinates_wfs(lat, lng)


async def find_neighborhood_by_coordinates_wfs(lat: float, lng: float) -> Optional[str]:
    """
    Fallback method using CBS WFS (less reliable).

    Args:
        lat: Latitude (WGS84)
        lng: Longitude (WGS84)

    Returns:
        Neighborhood code or None
    """
    try:
        # Convert to RD (EPSG:28992) coordinates for better WFS compatibility
        # For now, skip conversion and use WGS84
        wfs_url = "https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0"

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "buurten",
            "outputFormat": "json",
            "srsName": "EPSG:4326",
            "CQL_FILTER": f"INTERSECTS(geom, POINT({lng} {lat}))",
            "count": 1
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(wfs_url, params=params)
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])
            if features:
                properties = features[0].get("properties", {})
                buurt_code = properties.get("buurtcode") or properties.get("code")

                # Skip "Buitenland" (foreign/no data) codes
                if buurt_code == "BU09989999":
                    print("Coordinates are outside CBS neighborhood boundaries (Buitenland)")
                    return None

                if buurt_code and not buurt_code.startswith("BU"):
                    buurt_code = f"BU{buurt_code}"

                return buurt_code

        return None

    except Exception as e:
        print(f"Error in WFS lookup: {e}")
        return None


def get_area_code_from_address(postal_code: str, house_number: int) -> Optional[str]:
    """
    Get neighborhood code from postal code + house number.

    This requires the Netherlands addresses dataset with neighborhood mappings.

    Args:
        postal_code: Dutch postal code (e.g., "1011AB")
        house_number: House number

    Returns:
        Neighborhood code or None
    """
    # This would require loading the 302MB addresses file
    # and doing a lookup
    # For now, return None
    return None
