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
    Use PDOK reverse geocoding API to get address information.

    Args:
        lat: Latitude
        lng: Longitude

    Returns:
        Address information including potential neighborhood data
    """
    try:
        url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse"
        params = {
            "lat": lat,
            "lon": lng,
            "rows": 1
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("response", {}).get("numFound", 0) > 0:
                docs = data["response"]["docs"]
                if docs:
                    return docs[0]

        return None
    except Exception as e:
        print(f"Error in PDOK reverse geocoding: {e}")
        return None


async def find_neighborhood_by_coordinates(lat: float, lng: float) -> Optional[str]:
    """
    Find neighborhood code (area_code) by coordinates.

    Strategy:
    1. Use PDOK reverse geocoding to get address
    2. Use BAG API to get detailed address info including neighborhood code

    Args:
        lat: Latitude (WGS84)
        lng: Longitude (WGS84)

    Returns:
        Neighborhood code (e.g., "BU03630001") or None
    """
    try:
        # Step 1: Get address from coordinates
        address_info = await reverse_geocode_pdok(lat, lng)
        if not address_info or address_info.get("type") != "adres":
            print(f"No address found for coordinates {lat}, {lng}")
            return None

        # Extract address ID from PDOK response
        address_id = address_info.get("id", "")

        # Step 2: Use BAG API to get detailed address info including neighborhood
        bag_url = f"https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressenuitgebreid/{address_id}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            # BAG API requires specific headers
            headers = {
                "Accept": "application/hal+json",
                "X-Api-Key": "l7xxbc7715cf849c4ff8966e6b0ad87bea0a"  # Public API key for BAG
            }

            response = await client.get(bag_url, headers=headers)

            if response.status_code == 404:
                # Address not found in BAG, try alternative method
                print(f"Address {address_id} not found in BAG API")
                return await find_neighborhood_by_coordinates_wfs(lat, lng)

            response.raise_for_status()
            data = response.json()

            # Extract neighborhood code (buurtcode) from BAG response
            # The structure is: data -> _embedded -> bijbehorendeBuurt -> buurtcode
            embedded = data.get("_embedded", {})
            if "bijbehorendeBuurt" in embedded:
                buurt_info = embedded["bijbehorendeBuurt"]
                buurt_code = buurt_info.get("identificatie", "")

                # Format as BU-style code if needed
                if buurt_code and not buurt_code.startswith("BU"):
                    buurt_code = f"BU{buurt_code}"

                return buurt_code

            # Alternative: check if it's in the main data object
            if "buurtcode" in data:
                buurt_code = data["buurtcode"]
                if buurt_code and not buurt_code.startswith("BU"):
                    buurt_code = f"BU{buurt_code}"
                return buurt_code

            print(f"No neighborhood code found in BAG response for {address_id}")
            return None

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
