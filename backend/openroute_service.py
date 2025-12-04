"""
OpenRouteService API integration with query caching.

This module handles travel time calculations using the OpenRouteService API
and caches all queries to a Parquet database to minimize API usage.
"""

import os
import time
from pathlib import Path
from typing import Tuple, Optional, Dict, Any, Literal
import httpx
import polars as pl
from datetime import datetime
import hashlib

# Data paths
DATA_DIR = Path(__file__).parent.parent / "data" / "cache"
DATA_DIR.mkdir(exist_ok=True, parents=True)
QUERY_CACHE_PATH = DATA_DIR / "travel_queries.parquet"

# OpenRouteService API configuration
ORS_API_KEY = os.getenv("OPENROUTESERVICE_API_KEY", "")
ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions"


def generate_query_hash(
    from_coords: Tuple[float, float],
    to_coords: Tuple[float, float],
    mode: str
) -> str:
    """
    Generate a unique hash for a query to use as cache key.

    Args:
        from_coords: Origin coordinates (lng, lat)
        to_coords: Destination coordinates (lng, lat)
        mode: Travel mode (driving-car, cycling-regular, foot-walking)

    Returns:
        MD5 hash of the query parameters
    """
    query_str = f"{from_coords[0]:.6f},{from_coords[1]:.6f}|{to_coords[0]:.6f},{to_coords[1]:.6f}|{mode}"
    return hashlib.md5(query_str.encode()).hexdigest()


def load_cache() -> Optional[pl.DataFrame]:
    """Load the query cache from Parquet file."""
    if not QUERY_CACHE_PATH.exists():
        return None

    try:
        return pl.read_parquet(QUERY_CACHE_PATH)
    except Exception as e:
        print(f"Error loading cache: {e}")
        return None


def save_to_cache(
    query_hash: str,
    from_lng: float,
    from_lat: float,
    to_lng: float,
    to_lat: float,
    mode: str,
    duration_seconds: float,
    distance_meters: float,
    from_address: str = "",
    to_address: str = ""
):
    """
    Save a query result to the Parquet cache.

    Args:
        query_hash: Unique hash of the query
        from_lng: Origin longitude
        from_lat: Origin latitude
        to_lng: Destination longitude
        to_lat: Destination latitude
        mode: Travel mode
        duration_seconds: Travel duration in seconds
        distance_meters: Travel distance in meters
        from_address: Optional origin address
        to_address: Optional destination address
    """
    # Create new record
    new_record = pl.DataFrame({
        "query_hash": [query_hash],
        "from_lng": [from_lng],
        "from_lat": [from_lat],
        "to_lng": [to_lng],
        "to_lat": [to_lat],
        "mode": [mode],
        "duration_seconds": [duration_seconds],
        "distance_meters": [distance_meters],
        "from_address": [from_address],
        "to_address": [to_address],
        "queried_at": [datetime.now().isoformat()],
        "cache_hit": [False]  # This was a fresh query
    })

    # Load existing cache if it exists
    existing_cache = load_cache()

    if existing_cache is not None:
        # Append to existing cache
        combined = pl.concat([existing_cache, new_record])
    else:
        combined = new_record

    # Save back to Parquet
    try:
        combined.write_parquet(QUERY_CACHE_PATH)
        print(f"✓ Saved query to cache: {query_hash[:8]}... ({mode})")
    except Exception as e:
        print(f"Error saving to cache: {e}")


def get_from_cache(
    from_coords: Tuple[float, float],
    to_coords: Tuple[float, float],
    mode: str
) -> Optional[Dict[str, Any]]:
    """
    Try to get a result from the cache.

    Args:
        from_coords: Origin coordinates (lng, lat)
        to_coords: Destination coordinates (lng, lat)
        mode: Travel mode

    Returns:
        Cached result dict or None if not found
    """
    cache = load_cache()
    if cache is None:
        return None

    query_hash = generate_query_hash(from_coords, to_coords, mode)

    # Query the cache
    result = cache.filter(pl.col("query_hash") == query_hash)

    if result.height == 0:
        return None

    # Get the most recent entry for this query
    record = result.sort("queried_at", descending=True).to_dicts()[0]

    print(f"✓ Cache hit: {query_hash[:8]}... ({mode})")

    return {
        "duration_seconds": record["duration_seconds"],
        "distance_meters": record["distance_meters"],
        "duration_minutes": round(record["duration_seconds"] / 60, 1),
        "distance_km": round(record["distance_meters"] / 1000, 2),
        "cache_hit": True,
        "from_address": record.get("from_address", ""),
        "to_address": record.get("to_address", "")
    }


async def calculate_travel_time(
    from_coords: Tuple[float, float],
    to_coords: Tuple[float, float],
    mode: Literal["driving-car", "cycling-regular", "foot-walking"],
    from_address: str = "",
    to_address: str = ""
) -> Dict[str, Any]:
    """
    Calculate travel time between two points using OpenRouteService API.
    Checks cache first to avoid unnecessary API calls.

    Args:
        from_coords: Origin coordinates (lng, lat)
        to_coords: Destination coordinates (lng, lat)
        mode: Travel mode (driving-car, cycling-regular, foot-walking)
        from_address: Optional origin address for logging
        to_address: Optional destination address for logging

    Returns:
        Dict with duration_seconds, distance_meters, duration_minutes, distance_km

    Raises:
        HTTPException if API call fails
    """
    # Check cache first
    cached_result = get_from_cache(from_coords, to_coords, mode)
    if cached_result:
        return cached_result

    # Not in cache, query the API
    if not ORS_API_KEY:
        raise ValueError("OPENROUTESERVICE_API_KEY not set in environment")

    url = f"{ORS_BASE_URL}/{mode}"

    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "coordinates": [
            [from_coords[0], from_coords[1]],  # [lng, lat]
            [to_coords[0], to_coords[1]]       # [lng, lat]
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        # Extract route information
        route = data["routes"][0]
        summary = route["summary"]

        duration_seconds = summary["duration"]
        distance_meters = summary["distance"]

        # Save to cache
        query_hash = generate_query_hash(from_coords, to_coords, mode)
        save_to_cache(
            query_hash=query_hash,
            from_lng=from_coords[0],
            from_lat=from_coords[1],
            to_lng=to_coords[0],
            to_lat=to_coords[1],
            mode=mode,
            duration_seconds=duration_seconds,
            distance_meters=distance_meters,
            from_address=from_address,
            to_address=to_address
        )

        return {
            "duration_seconds": duration_seconds,
            "distance_meters": distance_meters,
            "duration_minutes": round(duration_seconds / 60, 1),
            "distance_km": round(distance_meters / 1000, 2),
            "cache_hit": False
        }

    except httpx.HTTPStatusError as e:
        raise Exception(f"OpenRouteService API error: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        raise Exception(f"Network error calling OpenRouteService: {e}")
    except Exception as e:
        raise Exception(f"Error calculating travel time: {e}")


async def calculate_all_travel_modes(
    from_coords: Tuple[float, float],
    to_coords: Tuple[float, float],
    from_address: str = "",
    to_address: str = ""
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate travel time for all available modes.

    Args:
        from_coords: Origin coordinates (lng, lat)
        to_coords: Destination coordinates (lng, lat)
        from_address: Optional origin address for logging
        to_address: Optional destination address for logging

    Returns:
        Dict with results for each mode (car, bike, walking)
    """
    results = {}

    modes = {
        "car": "driving-car",
        "bike": "cycling-regular",
        "walking": "foot-walking"
    }

    for mode_key, mode_value in modes.items():
        try:
            result = await calculate_travel_time(
                from_coords,
                to_coords,
                mode_value,
                from_address,
                to_address
            )
            results[mode_key] = result
        except Exception as e:
            print(f"Error calculating {mode_key} travel time: {e}")
            results[mode_key] = {
                "error": str(e),
                "duration_minutes": None,
                "distance_km": None
            }

    return results


def get_cache_stats() -> Dict[str, Any]:
    """Get statistics about the query cache."""
    cache = load_cache()

    if cache is None:
        return {
            "total_queries": 0,
            "unique_routes": 0,
            "modes": {}
        }

    total = cache.height
    unique = cache.select("query_hash").n_unique()

    # Count by mode
    mode_counts = cache.group_by("mode").agg(
        pl.count().alias("count")
    ).to_dicts()

    modes = {item["mode"]: item["count"] for item in mode_counts}

    return {
        "total_queries": total,
        "unique_routes": unique,
        "modes": modes,
        "cache_file": str(QUERY_CACHE_PATH),
        "cache_exists": QUERY_CACHE_PATH.exists()
    }
