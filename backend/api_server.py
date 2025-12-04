"""
Python backend API server for serving Parquet data.

This FastAPI server provides efficient access to Parquet datasets
that are difficult to read in Node.js environment.

Endpoints:
- GET /api/demographics/{area_code}
- GET /api/crime/{area_code}
- GET /api/woz/{postal_code}/{house_number}
- GET /api/livability/{area_code}
- GET /api/snapshot (combined data)
- POST /api/travel-time (OpenRouteService with caching)
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request

# Load environment variables
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import polars as pl
from pathlib import Path
from typing import Optional, Dict, Any
import uvicorn
import httpx
from coordinate_lookup import find_neighborhood_by_coordinates
from pyproj import Transformer
from openroute_service import calculate_all_travel_modes, get_cache_stats
import httpx

# Initialize coordinate transformer (RD/Amersfoort EPSG:28992 to WGS84 EPSG:4326)
rd_to_wgs84 = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)

app = FastAPI(
    title="Where to Live NL - Data API",
    description="Python backend for efficient Parquet data access",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data paths
DATA_DIR = Path(__file__).parent.parent / "data" / "processed"
CBS_DEMOGRAPHICS = DATA_DIR / "cbs_demographics.parquet"
CRIME_DATA = DATA_DIR / "crime.parquet"
LEEFBAAROMETER = DATA_DIR / "leefbaarometer.parquet"
WOZ_DATA = DATA_DIR / "woz-netherlands-complete.parquet"
CBS_PROXIMITY = DATA_DIR / "cbs_proximity.parquet"
ENERGIELABELS_DATA = DATA_DIR / "energielabels.parquet"
PROPERTIES_DATA = DATA_DIR / "properties.parquet"
SCHOOLS_DATA = DATA_DIR / "schools.parquet"
TRAIN_STATIONS_DATA = DATA_DIR / "train_stations.parquet"
HEALTHCARE_DATA = DATA_DIR / "healthcare.parquet"
SUPERMARKETS_DATA = DATA_DIR / "supermarkets.parquet"
PLAYGROUNDS_DATA = DATA_DIR / "playgrounds.parquet"

# Cache for loaded dataframes (optional optimization)
_cache: Dict[str, pl.DataFrame] = {}


def load_dataframe(name: str, path: Path) -> Optional[pl.DataFrame]:
    """Load a Parquet dataframe with caching."""
    if name in _cache:
        return _cache[name]

    if not path.exists():
        return None

    try:
        df = pl.read_parquet(path)
        _cache[name] = df
        return df
    except Exception as e:
        print(f"Error loading {name}: {e}")
        return None


@app.get("/")
def root():
    """API root endpoint."""
    return {
        "message": "Where to Live NL - Data API",
        "version": "1.0.0",
        "endpoints": [
            "/api/properties?minLat=&maxLat=&minLng=&maxLng=&limit=100",
            "/api/demographics/{area_code}",
            "/api/crime/{area_code}",
            "/api/livability/{area_code}",
            "/api/woz/{postal_code}/{house_number}",
            "/api/energielabel/{postal_code}/{house_number}",
            "/api/snapshot?lat={lat}&lng={lng}",
        ]
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/demographics/{area_code}")
def get_demographics(area_code: str):
    """
    Get CBS demographics data for a neighborhood.

    Args:
        area_code: Neighborhood code (e.g., "BU16800000")

    Returns:
        Demographics data including population, age, income, housing
    """
    df = load_dataframe("demographics", CBS_DEMOGRAPHICS)

    if df is None:
        raise HTTPException(status_code=503, detail="Demographics data not available")

    # Filter for the area code
    result = df.filter(pl.col("area_code") == area_code)

    if result.height == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No demographics data found for area code: {area_code}"
        )

    # Convert to dict
    record = result.to_dicts()[0]

    return {
        "success": True,
        "area_code": area_code,
        "data": record,
        "metadata": {
            "source": "CBS (Statistics Netherlands)",
            "year": 2024,
            "license": "CC-BY 4.0"
        }
    }


@app.get("/api/crime/{area_code}")
def get_crime(area_code: str):
    """
    Get crime statistics for a neighborhood.

    Args:
        area_code: Neighborhood code (e.g., "BU16800000")

    Returns:
        Crime statistics from Politie.nl/CBS
    """
    df = load_dataframe("crime", CRIME_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Crime data not available")

    result = df.filter(pl.col("area_code") == area_code)

    if result.height == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No crime data found for area code: {area_code}"
        )

    record = result.to_dicts()[0]

    # Get data year from the record
    data_year = record.get("year", 2024)

    # Calculate national average dynamically from NL00 total
    # NL00 contains the national total crimes
    nl_total = df.filter(
        (pl.col("area_code").str.strip_chars() == "NL00") &
        (pl.col("SoortMisdrijf").str.strip_chars() == "0.0.0")
    )

    # Netherlands population by year (approximate, from CBS)
    nl_population_by_year = {
        2024: 17_900_000,
        2023: 17_800_000,
        2022: 17_600_000,
        2021: 17_500_000,
        2020: 17_400_000,
        2019: 17_300_000,
        2018: 17_200_000,
    }

    nl_population = nl_population_by_year.get(data_year, 17_800_000)

    if nl_total.height > 0:
        total_crimes = nl_total["GeregistreerdeMisdrijven_1"][0]
        netherlands_average = round((total_crimes / nl_population) * 1000, 1)
    else:
        netherlands_average = 45.0  # Fallback to approximate value

    return {
        "success": True,
        "area_code": area_code,
        "data": record,
        "metadata": {
            "source": "Politie.nl / CBS",
            "year": data_year,
            "netherlands_average": netherlands_average,
            "netherlands_population": nl_population,
            "comparison_note": f"National average: {netherlands_average} per 1,000 residents ({data_year})"
        }
    }


@app.get("/api/livability/{area_code}")
def get_livability(area_code: str):
    """
    Get livability score for a neighborhood.

    Args:
        area_code: Neighborhood code (e.g., "BU16800000")

    Returns:
        Leefbaarometer livability score
    """
    df = load_dataframe("livability", LEEFBAAROMETER)

    if df is None:
        raise HTTPException(status_code=503, detail="Livability data not available")

    result = df.filter(pl.col("area_code") == area_code)

    if result.height == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No livability data found for area code: {area_code}"
        )

    record = result.to_dicts()[0]

    # Add score breakdown details
    score_breakdown = {
        "total": record.get("score_total"),
        "physical": record.get("score_physical"),
        "social": record.get("score_social"),
        "safety": record.get("score_safety"),
        "facilities": record.get("score_facilities"),
        "housing": record.get("score_housing"),
    }

    return {
        "success": True,
        "area_code": area_code,
        "data": record,
        "score_breakdown": score_breakdown,
        "metadata": {
            "source": "Leefbaarometer",
            "year": 2022,
            "score_categories": {
                "physical": "Physical environment (green space, water quality, noise)",
                "social": "Social cohesion (diversity, community)",
                "safety": "Safety (crime, traffic safety, nuisance)",
                "facilities": "Facilities (shops, schools, healthcare)",
                "housing": "Housing quality (condition, diversity)"
            }
        }
    }


@app.get("/api/woz/{postal_code}/{house_number}")
def get_woz(postal_code: str, house_number: int):
    """
    Get WOZ property value.

    Args:
        postal_code: Dutch postal code (e.g., "1011AB")
        house_number: House number

    Returns:
        WOZ property valuation
    """
    df = load_dataframe("woz", WOZ_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="WOZ data not available")

    # Clean postal code (remove spaces)
    postal_code = postal_code.replace(" ", "").upper()

    result = df.filter(
        (pl.col("postal_code") == postal_code) &
        (pl.col("house_number") == house_number)
    )

    if result.height == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No WOZ data found for {postal_code} {house_number}"
        )

    record = result.to_dicts()[0]

    return {
        "success": True,
        "postal_code": postal_code,
        "house_number": house_number,
        "data": record,
        "metadata": {
            "source": "WOZwaardeloket.nl",
            "year": 2024
        }
    }


@app.get("/api/properties")
def get_properties(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    limit: int = 100
):
    """
    Get properties with energy labels and other data.

    Args:
        minLat: Minimum latitude for bounding box
        maxLat: Maximum latitude for bounding box
        minLng: Minimum longitude for bounding box
        maxLng: Maximum longitude for bounding box
        limit: Maximum number of results (default 100)

    Returns:
        List of properties with energy labels
    """
    df = load_dataframe("properties", PROPERTIES_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Properties data not available")

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("latitude") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("latitude") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("longitude") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("longitude") <= maxLng)

    # Limit results
    df = df.head(limit)

    # Convert to list of dicts
    properties = []
    for record in df.to_dicts():
        # Format property to match frontend expectations
        property_obj = {
            "id": record.get("id"),
            "address": {
                "street": record.get("street"),
                "number": record.get("house_number"),
                "addition": (record.get("house_letter") or "") + (record.get("house_addition") or ""),
                "postcode": record.get("postal_code"),
                "city": record.get("city")
            },
            "coordinates": {
                "lat": record.get("latitude"),
                "lng": record.get("longitude")
            },
            "property": {
                "type": record.get("building_type") or "appartement",
                "living_area_m2": record.get("surface_area_m2") or 0,
                "plot_area_m2": 0,
                "rooms": record.get("num_rooms") or 3,
                "year_built": record.get("building_year"),
                "energy_label": record.get("energy_label") or "C"
            },
            "valuation": {
                "woz_value": 250000,  # Placeholder - would need WOZ lookup
                "woz_year": 2024,
                "price_per_m2": 2500
            }
        }
        properties.append(property_obj)

    return {
        "success": True,
        "count": len(properties),
        "total": df.height,
        "properties": properties
    }


@app.get("/api/schools")
def get_schools(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    type: Optional[str] = None,
    limit: int = 500
):
    """
    Get schools with filtering support.

    Args:
        minLat: Minimum latitude
        maxLat: Maximum latitude
        minLng: Minimum longitude
        maxLng: Maximum longitude
        type: School type filter (po, vo, so, mbo, ho)
        limit: Maximum results (default 500)

    Returns:
        List of schools with coordinates
    """
    df = load_dataframe("schools", SCHOOLS_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Schools data not available")

    # Filter schools with coordinates only
    df = df.filter(pl.col("latitude").is_not_null() & pl.col("longitude").is_not_null())

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("latitude") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("latitude") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("longitude") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("longitude") <= maxLng)

    # Filter by school type
    if type:
        df = df.filter(pl.col("school_type") == type)

    # Limit results
    df = df.head(limit)

    # School type labels (lowercase as per Dutch convention)
    type_labels = {
        "primary": "Primair onderwijs (primary education)",
        "secondary": "Voortgezet onderwijs (secondary education)",
        "special": "Speciaal onderwijs (special education)",
        "higher": "Hoger onderwijs (higher education)",
        "mbo": "Middelbaar beroepsonderwijs (vocational)",
        "po": "Primair onderwijs (primary education)",
        "vo": "Voortgezet onderwijs (secondary education)",
        "so": "Speciaal onderwijs (special education)",
        "ho": "Hoger onderwijs (higher education)",
    }

    # Convert to list of dicts
    schools = []
    for record in df.to_dicts():
        school_type = record.get("school_type", "")
        school_obj = {
            "id": str(record.get("brin_number", "")) + str(record.get("vestiging_number") or ""),
            "name": record.get("school_name"),
            "address": f"{record.get('street')} {record.get('house_number')}",
            "postalCode": record.get("postal_code"),
            "city": record.get("city"),
            "municipality": record.get("municipality"),
            "province": record.get("province"),
            "phone": record.get("phone"),
            "website": record.get("website"),
            "type": school_type,
            "typeLabel": type_labels.get(school_type, school_type),
            "denomination": record.get("denomination"),
            "coordinates": {
                "lat": record.get("latitude"),
                "lng": record.get("longitude")
            }
        }
        schools.append(school_obj)

    return {
        "success": True,
        "count": len(schools),
        "total": df.height,
        "schools": schools
    }


@app.get("/api/train-stations")
def get_train_stations(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    limit: int = 500
):
    """
    Get train stations with filtering support.

    Returns:
        List of train stations with coordinates
    """
    df = load_dataframe("train_stations", TRAIN_STATIONS_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Train stations data not available")

    # Filter stations with coordinates
    df = df.filter(pl.col("lat").is_not_null() & pl.col("lon").is_not_null())

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("lat") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("lat") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("lon") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("lon") <= maxLng)

    # Limit results
    df = df.head(limit)

    # Convert to list of dicts
    stations = []
    for record in df.to_dicts():
        station_obj = {
            "name": record.get("name"),
            "operator": record.get("operator"),
            "station_code": record.get("station_code"),
            "railway_type": record.get("railway_type"),
            "coordinates": {
                "lat": record.get("lat"),
                "lng": record.get("lon")
            }
        }
        stations.append(station_obj)

    return {
        "success": True,
        "count": len(stations),
        "stations": stations
    }


@app.get("/api/healthcare")
def get_healthcare(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    type: Optional[str] = None,
    limit: int = 1000
):
    """
    Get healthcare facilities (huisarts, apotheek, clinics, hospitals).

    Args:
        minLat: Minimum latitude
        maxLat: Maximum latitude
        minLng: Minimum longitude
        maxLng: Maximum longitude
        type: Filter by type (doctors, pharmacy, clinic, hospital)
        limit: Maximum results (default 1000)

    Returns:
        List of healthcare facilities with coordinates
    """
    df = load_dataframe("healthcare", HEALTHCARE_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Healthcare data not available")

    # Filter with coordinates
    df = df.filter(pl.col("latitude").is_not_null() & pl.col("lng").is_not_null())

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("latitude") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("latitude") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("lng") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("lng") <= maxLng)

    # Filter by type (amenity column: doctors, pharmacy, clinic, hospital)
    if type:
        df = df.filter(pl.col("amenity") == type)

    # Limit results
    df = df.head(limit)

    # Type labels (lowercase as per Dutch convention)
    type_labels = {
        "doctors": "huisarts (doctor/GP)",
        "pharmacy": "apotheek (pharmacy)",
        "clinic": "kliniek (clinic)",
        "hospital": "ziekenhuis (hospital)",
    }

    # Convert to list
    facilities = []
    for record in df.to_dicts():
        amenity_type = record.get("amenity", "")
        facility = {
            "id": record.get("osm_id"),
            "name": record.get("name") or "onbekend",
            "type": amenity_type,
            "typeLabel": type_labels.get(amenity_type, amenity_type),
            "address": f"{record.get('street') or ''} {record.get('housenumber') or ''}".strip() or None,
            "postalCode": record.get("postcode"),
            "city": record.get("city"),
            "phone": record.get("phone"),
            "website": record.get("website"),
            "openingHours": record.get("opening_hours"),
            "wheelchair": record.get("wheelchair"),
            "coordinates": {
                "lat": record.get("latitude"),
                "lng": record.get("lng")
            }
        }
        facilities.append(facility)

    return {
        "success": True,
        "count": len(facilities),
        "facilities": facilities
    }


@app.get("/api/supermarkets")
def get_supermarkets(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    limit: int = 1000
):
    """
    Get supermarkets.

    Returns:
        List of supermarkets with coordinates
    """
    df = load_dataframe("supermarkets", SUPERMARKETS_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Supermarkets data not available")

    # Filter with coordinates
    df = df.filter(pl.col("latitude").is_not_null() & pl.col("lng").is_not_null())

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("latitude") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("latitude") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("lng") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("lng") <= maxLng)

    df = df.head(limit)

    supermarkets = []
    for record in df.to_dicts():
        supermarket = {
            "id": record.get("osm_id"),
            "name": record.get("name") or record.get("brand") or "supermarkt",
            "brand": record.get("brand"),
            "address": f"{record.get('street') or ''} {record.get('housenumber') or ''}".strip() or None,
            "postalCode": record.get("postcode"),
            "city": record.get("city"),
            "openingHours": record.get("opening_hours"),
            "coordinates": {
                "lat": record.get("latitude"),
                "lng": record.get("lng")
            }
        }
        supermarkets.append(supermarket)

    return {
        "success": True,
        "count": len(supermarkets),
        "supermarkets": supermarkets
    }


@app.get("/api/playgrounds")
def get_playgrounds(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    limit: int = 1000
):
    """
    Get playgrounds (speeltuinen).

    Returns:
        List of playgrounds with coordinates
    """
    df = load_dataframe("playgrounds", PLAYGROUNDS_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Playgrounds data not available")

    # Filter with coordinates
    df = df.filter(pl.col("latitude").is_not_null() & pl.col("lng").is_not_null())

    # Apply geographic filters
    if minLat is not None:
        df = df.filter(pl.col("latitude") >= minLat)
    if maxLat is not None:
        df = df.filter(pl.col("latitude") <= maxLat)
    if minLng is not None:
        df = df.filter(pl.col("lng") >= minLng)
    if maxLng is not None:
        df = df.filter(pl.col("lng") <= maxLng)

    df = df.head(limit)

    playgrounds = []
    for record in df.to_dicts():
        playground = {
            "id": record.get("osm_id"),
            "name": record.get("name") or "speeltuin",
            "address": f"{record.get('street') or ''} {record.get('housenumber') or ''}".strip() or None,
            "city": record.get("city"),
            "wheelchair": record.get("wheelchair"),
            "coordinates": {
                "lat": record.get("latitude"),
                "lng": record.get("lng")
            }
        }
        playgrounds.append(playground)

    return {
        "success": True,
        "count": len(playgrounds),
        "playgrounds": playgrounds
    }


@app.get("/api/energielabel/{postal_code}/{house_number}")
def get_energielabel(
    postal_code: str,
    house_number: int,
    house_letter: Optional[str] = None,
    house_addition: Optional[str] = None
):
    """
    Get energy label (Energielabel) for a property.

    Args:
        postal_code: Dutch postal code (e.g., "1011AB")
        house_number: House number
        house_letter: Optional house letter (e.g., "A")
        house_addition: Optional house number addition (e.g., "1")

    Returns:
        Energy label data from EP-Online
    """
    df = load_dataframe("energielabels", ENERGIELABELS_DATA)

    if df is None:
        raise HTTPException(status_code=503, detail="Energy label data not available")

    # Clean postal code (remove spaces, uppercase)
    postal_code = postal_code.replace(" ", "").upper()

    # Build filter conditions
    filter_conditions = (
        (pl.col("postal_code") == postal_code) &
        (pl.col("house_number") == house_number)
    )

    # Add house_letter filter if provided
    if house_letter:
        filter_conditions = filter_conditions & (pl.col("house_letter") == house_letter.upper())
    else:
        # If no house_letter provided, match null or empty
        filter_conditions = filter_conditions & (
            pl.col("house_letter").is_null() | (pl.col("house_letter") == "")
        )

    # Add house_addition filter if provided
    if house_addition:
        filter_conditions = filter_conditions & (pl.col("house_addition") == house_addition)
    else:
        # If no house_addition provided, match null or empty
        filter_conditions = filter_conditions & (
            pl.col("house_addition").is_null() | (pl.col("house_addition") == "")
        )

    result = df.filter(filter_conditions)

    if result.height == 0:
        # Try without strict letter/addition matching
        result = df.filter(
            (pl.col("postal_code") == postal_code) &
            (pl.col("house_number") == house_number)
        )

        if result.height == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No energy label found for {postal_code} {house_number}"
            )

    # If multiple results, take the most recent one
    if result.height > 1:
        if "registration_date" in result.columns:
            result = result.sort("registration_date", descending=True).head(1)
        else:
            result = result.head(1)

    record = result.to_dicts()[0]

    return {
        "success": True,
        "postal_code": postal_code,
        "house_number": house_number,
        "house_letter": house_letter,
        "house_addition": house_addition,
        "data": {
            "energy_label": record.get("energy_label"),
            "energy_label_numeric": record.get("energy_label_numeric"),
            "energy_index": record.get("energy_index"),
            "building_year": record.get("building_year"),
            "building_type": record.get("building_type"),
            "building_class": record.get("building_class"),
            "surface_area_m2": record.get("surface_area_m2"),
            "registration_date": record.get("registration_date"),
            "valid_until": record.get("valid_until"),
            "bag_id": record.get("bag_id"),
            "status": record.get("status")
        },
        "metadata": {
            "source": "EP-Online (RVO)",
            "year": 2024,
            "note": "Official energy labels from Dutch government"
        }
    }


@app.get("/api/snapshot")
async def get_snapshot(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    area_code: Optional[str] = None
):
    """
    Get combined snapshot of all data for a location.

    Args:
        lat: Latitude (if using coordinates)
        lng: Longitude (if using coordinates)
        area_code: Neighborhood code (if known)

    Returns:
        Combined data from all sources
    """
    if not area_code and (not lat or not lng):
        raise HTTPException(
            status_code=400,
            detail="Either area_code or (lat, lng) must be provided"
        )

    # Implement coordinate -> area_code lookup using PDOK WFS
    if not area_code and lat and lng:
        area_code = await find_neighborhood_by_coordinates(lat, lng)

        if not area_code:
            raise HTTPException(
                status_code=404,
                detail="Could not find neighborhood for these coordinates"
            )

    snapshot = {
        "success": True,
        "area_code": area_code,
        "coordinates": {"lat": lat, "lng": lng} if lat and lng else None,
    }

    # Try to fetch all available data
    try:
        demographics_response = get_demographics(area_code)
        snapshot["demographics"] = demographics_response["data"]
    except HTTPException:
        snapshot["demographics"] = None

    try:
        crime_response = get_crime(area_code)
        snapshot["crime"] = crime_response["data"]
        snapshot["crime_metadata"] = crime_response.get("metadata")
    except HTTPException:
        snapshot["crime"] = None
        snapshot["crime_metadata"] = None

    try:
        livability_response = get_livability(area_code)
        snapshot["livability"] = livability_response["data"]
    except HTTPException:
        snapshot["livability"] = None

    try:
        energy_response = get_energy_consumption(area_code)
        snapshot["energy_consumption"] = energy_response if energy_response.get("success") else None
    except:
        snapshot["energy_consumption"] = None

    try:
        proximity_response = get_proximity_data(area_code)
        snapshot["proximity"] = proximity_response.get("data") if proximity_response.get("success") else None
    except:
        snapshot["proximity"] = None

    return snapshot


@app.get("/api/map-overlays/crime")
def get_crime_map_data():
    """
    Get crime data with coordinates for map overlay.

    Returns:
        GeoJSON-compatible data with crime rates per neighborhood
    """
    crime_df = load_dataframe("crime", CRIME_DATA)
    demographics_df = load_dataframe("demographics", CBS_DEMOGRAPHICS)
    leefbaarometer_df = load_dataframe("livability", LEEFBAAROMETER)

    if crime_df is None or demographics_df is None or leefbaarometer_df is None:
        raise HTTPException(status_code=503, detail="Data not available")

    # Aggregate crime by area_code
    crime_summary = crime_df.group_by("area_code").agg([
        pl.sum("GeregistreerdeMisdrijven_1").alias("total_crimes"),
        pl.max("year").alias("year")
    ])

    # Get population from demographics for crime rate calculation
    demographics_subset = demographics_df.select(["area_code", "population"])

    # Get coordinates from leefbaarometer
    coords_subset = leefbaarometer_df.select(["area_code", "area_name", "longitude", "latitude"])

    # Join all three
    joined = crime_summary.join(demographics_subset, on="area_code", how="left")
    joined = joined.join(coords_subset, on="area_code", how="left")

    # Calculate crime rate per 1000 residents
    joined = joined.with_columns([
        (pl.col("total_crimes") / pl.col("population") * 1000).alias("crime_rate_per_1000")
    ])

    # Filter out nulls and areas without coordinates
    filtered = joined.filter(
        pl.col("population").is_not_null() &
        pl.col("longitude").is_not_null() &
        pl.col("latitude").is_not_null()
    )

    # Convert to dicts
    result = filtered.to_dicts()

    # Convert RD coordinates to WGS84
    for item in result:
        if item.get("longitude") and item.get("latitude"):
            try:
                # Transform RD (x, y) to WGS84 (lon, lat)
                lon, lat = rd_to_wgs84.transform(item["longitude"], item["latitude"])
                item["lng"] = lon
                item["lat"] = lat
            except Exception as e:
                print(f"Error converting coordinates for {item.get('area_code')}: {e}")
                item["lng"] = None
                item["lat"] = None

    return {
        "success": True,
        "data": result,
        "metadata": {
            "source": "Politie.nl / CBS / Leefbaarometer",
            "note": "Crime rates per 1,000 residents by neighborhood",
            "coordinate_system": "WGS84 (EPSG:4326)"
        }
    }


@app.get("/api/map-overlays/air-quality")
def get_air_quality_map_data():
    """
    Get air quality station data for map overlay.

    Returns:
        Air quality measurements with station locations
    """
    import json
    from pathlib import Path

    air_quality_path = Path(__file__).parent.parent / "data" / "raw" / "air_quality.json"

    if not air_quality_path.exists():
        raise HTTPException(status_code=503, detail="Air quality data not available")

    with open(air_quality_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    stations = data.get("data", [])

    # Extract key pollutants for each station
    formatted_stations = []
    for station in stations:
        coords = station.get("coordinates", {})
        if not coords or "lat" not in coords or "lng" not in coords:
            continue

        # Get latest measurements
        measurements = station.get("latest_measurements", [])
        pollutants = {}

        for measurement in measurements:
            formula = measurement.get("formula")
            value = measurement.get("value")
            if formula and value is not None:
                pollutants[formula] = value

        formatted_stations.append({
            "number": station.get("number"),
            "location": station.get("location"),
            "lat": coords["lat"],
            "lng": coords["lng"],
            "pollutants": pollutants,
            "pm25": pollutants.get("PM25"),
            "pm10": pollutants.get("PM10"),
            "no2": pollutants.get("NO2"),
            "o3": pollutants.get("O3"),
        })

    return {
        "success": True,
        "data": formatted_stations,
        "metadata": {
            "source": "Luchtmeetnet (RIVM)",
            "total_stations": len(formatted_stations),
            "license": "Open data",
            "pollutants": {
                "PM25": "Particulate Matter 2.5µm (µg/m³)",
                "PM10": "Particulate Matter 10µm (µg/m³)",
                "NO2": "Nitrogen Dioxide (µg/m³)",
                "O3": "Ozone (µg/m³)"
            }
        }
    }


@app.get("/api/map-overlays/leefbaarometer")
def get_leefbaarometer_map_data():
    """
    Get livability (leefbaarometer) scores with neighborhood boundaries for map overlay.

    Returns:
        GeoJSON FeatureCollection with neighborhood polygons colored by livability score
    """
    import json

    leefbaarometer_df = load_dataframe("livability", LEEFBAAROMETER)
    boundaries_df = pl.read_parquet(DATA_DIR / "neighborhood_boundaries.parquet")

    if leefbaarometer_df is None:
        raise HTTPException(status_code=503, detail="Leefbaarometer data not available")

    if boundaries_df is None:
        raise HTTPException(status_code=503, detail="Neighborhood boundaries not available")

    # Join livability scores with boundaries
    # Both use buurtcode with BU prefix
    joined = boundaries_df.join(
        leefbaarometer_df.select(["area_code", "score_total", "score_physical", "score_social",
                                  "score_safety", "score_facilities", "score_housing", "area_name"]),
        left_on="buurtcode",
        right_on="area_code",
        how="inner"
    )

    # Build GeoJSON features
    features = []
    for row in joined.iter_rows(named=True):
        if not row["geometry_json"]:
            continue

        try:
            geometry = json.loads(row["geometry_json"])

            feature = {
                "type": "Feature",
                "properties": {
                    "buurtcode": row["buurtcode"],
                    "buurtnaam": row["buurtnaam"],
                    "gemeentenaam": row["gemeentenaam"],
                    "score_total": row["score_total"],
                    "score_physical": row["score_physical"],
                    "score_social": row["score_social"],
                    "score_safety": row["score_safety"],
                    "score_facilities": row["score_facilities"],
                    "score_housing": row["score_housing"]
                },
                "geometry": geometry
            }
            features.append(feature)
        except Exception as e:
            print(f"Error processing row: {e}")
            continue

    return {
        "success": True,
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "Leefbaarometer 2024 + CBS Wijken en Buurten",
            "total_neighborhoods": len(features),
            "license": "CC0 Public Domain",
            "score_range": "1-10 (higher is better)"
        }
    }


@app.get("/api/map-overlays/foundation-risk")
def get_foundation_risk_map_data():
    """
    Get foundation risk polygon data for map overlay.

    Returns:
        GeoJSON with foundation risk areas from KCAF/PDOK
    """
    import json
    from pathlib import Path

    foundation_risk_path = Path(__file__).parent.parent / "data" / "raw" / "foundation_risk.json"

    if not foundation_risk_path.exists():
        raise HTTPException(status_code=503, detail="Foundation risk data not available")

    with open(foundation_risk_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return {
        "success": True,
        "data": data,
        "metadata": {
            "source": "KCAF via PDOK",
            "total_areas": len(data.get("features", [])),
            "license": "Open data",
            "description": "Indicative foundation risk areas (aandachtsgebieden funderingsproblematiek)",
            "year": 2024
        }
    }


@app.get("/api/map-overlays/flooding-risk")
def get_flooding_risk_map_data():
    """
    Get flooding risk data for map overlay.

    Returns:
        GeoJSON FeatureCollection with flood risk polygons
    """
    import json
    from pathlib import Path

    flood_risk_path = Path(__file__).parent.parent / "data" / "raw" / "flood_risk.json"

    # Try to load from file first
    if flood_risk_path.exists():
        try:
            with open(flood_risk_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            return {
                "success": True,
                "type": "FeatureCollection",
                "features": data.get("features", []),
                "metadata": {
                    "source": "Risicokaart.nl, Nationaal Georegister, compiled data",
                    "total_areas": len(data.get("features", [])),
                    "license": "Open Data (CC0)",
                    "note": "Flood risk zones from official Dutch government sources",
                    "year": 2024
                }
            }
        except Exception as e:
            print(f"Error loading flood risk file: {e}")

    # Fallback: Return known flood risk areas as GeoJSON
    known_areas = {
        "limburg": {
            "name": "Limburg",
            "risk_level": "high",
            "flood_type": "river_flooding",
            "notes": "Maas river flooding (2021, 2023 events)",
            "bbox": [5.5, 50.75, 6.25, 51.5]
        },
        "zeeland": {
            "name": "Zeeland",
            "risk_level": "high",
            "flood_type": "sea_flooding",
            "notes": "Below sea level, storm surge risk",
            "bbox": [3.35, 51.2, 4.25, 51.75]
        },
        "flevoland": {
            "name": "Flevoland",
            "risk_level": "high",
            "flood_type": "polder",
            "notes": "Entirely reclaimed land, 4-6m below sea level",
            "bbox": [5.15, 52.25, 6.0, 52.7]
        },
        "noord_holland_laag": {
            "name": "Noord-Holland (low areas)",
            "risk_level": "medium",
            "flood_type": "polder",
            "notes": "Haarlemmermeer, Beemster - polders below sea level",
            "bbox": [4.5, 52.2, 5.1, 52.65]
        },
        "zuid_holland_laag": {
            "name": "Zuid-Holland (low areas)",
            "risk_level": "medium",
            "flood_type": "polder",
            "notes": "Green Heart (Groene Hart) polders",
            "bbox": [4.2, 51.85, 4.9, 52.15]
        },
        "groningen": {
            "name": "Groningen",
            "risk_level": "medium",
            "flood_type": "combined",
            "notes": "Earthquake-weakened dikes, sea flooding risk",
            "bbox": [6.2, 53.1, 7.25, 53.55]
        },
        "rivierengebied": {
            "name": "Rivierengebied",
            "risk_level": "medium",
            "flood_type": "river_flooding",
            "notes": "Between major rivers (Rijn, Waal, Maas)",
            "bbox": [4.8, 51.75, 6.2, 52.05]
        },
        "friesland_coast": {
            "name": "Friesland Coast",
            "risk_level": "low",
            "flood_type": "sea_flooding",
            "notes": "Wadden Sea area, dike protected",
            "bbox": [5.0, 52.95, 6.3, 53.45]
        }
    }

    features = []
    for area_id, area_data in known_areas.items():
        bbox = area_data["bbox"]
        coordinates = [[
            [bbox[0], bbox[1]],
            [bbox[2], bbox[1]],
            [bbox[2], bbox[3]],
            [bbox[0], bbox[3]],
            [bbox[0], bbox[1]]
        ]]

        features.append({
            "type": "Feature",
            "id": area_id,
            "properties": {
                "id": area_id,
                "name": area_data["name"],
                "risk_level": area_data["risk_level"],
                "flood_type": area_data["flood_type"],
                "notes": area_data["notes"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": coordinates
            }
        })

    return {
        "success": True,
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "Rijkswaterstaat, Waterboards, KNMI (fallback data)",
            "total_areas": len(features),
            "license": "Open Data",
            "note": "Indicative flood risk regions - run ETL script for precise data",
            "year": 2024
        }
    }


@app.get("/api/neighborhood-boundary/{area_code}")
async def get_neighborhood_boundary(area_code: str):
    """
    Get neighborhood boundary polygon from local Parquet file.

    Args:
        area_code: Neighborhood code (e.g., "BU16800000")

    Returns:
        GeoJSON polygon of the neighborhood boundary
    """
    try:
        boundaries_file = DATA_DIR / "neighborhood_boundaries.parquet"

        if not boundaries_file.exists():
            raise HTTPException(
                status_code=503,
                detail="Neighborhood boundaries data not available. Run: python scripts/etl/ingest/neighborhood_boundaries.py"
            )

        # Load Parquet file
        df = pl.read_parquet(boundaries_file)

        # Extract just the code part without BU prefix if present
        code = area_code.replace("BU", "") if area_code.startswith("BU") else area_code

        # Filter for matching neighborhood
        result = df.filter(
            (pl.col("buurtcode") == code) | (pl.col("buurtcode") == area_code)
        )

        if result.height == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No boundary found for neighborhood code: {area_code}"
            )

        # Get first matching record
        record = result.row(0, named=True)

        # Parse geometry JSON
        geometry = json.loads(record["geometry_json"])

        # Build GeoJSON feature
        feature = {
            "type": "Feature",
            "properties": {
                "buurtcode": record["buurtcode"],
                "buurtnaam": record["buurtnaam"],
                "wijkcode": record["wijkcode"],
                "gemeentecode": record["gemeentecode"],
                "gemeentenaam": record["gemeentenaam"],
                "postcode": record["postcode"],
                "water": record["water"]
            },
            "geometry": geometry
        }

        # Detect foreign territory
        is_foreign = record["is_foreign"]
        foreign_country = None
        if is_foreign:
            # Check if it's Baarle (Belgian enclave)
            if "Baarle" in record["buurtnaam"]:
                foreign_country = "Belgium"
            else:
                foreign_country = "Foreign"

        return {
            "success": True,
            "data": feature,
            "is_foreign": is_foreign,
            "foreign_country": foreign_country,
            "metadata": {
                "source": "CBS Wijken en Buurten 2024 (Local Parquet)",
                "year": 2024,
                "license": "CC-BY 4.0",
                "centroid": {
                    "lng": record["centroid_lng"],
                    "lat": record["centroid_lat"]
                }
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading boundary: {str(e)}")


@app.post("/api/travel-time")
async def calculate_travel_time_api(
    from_lng: float,
    from_lat: float,
    to_lng: float,
    to_lat: float,
    from_address: Optional[str] = "",
    to_address: Optional[str] = ""
):
    """
    Calculate travel time between two points using OpenRouteService.
    Results are cached in Parquet database to minimize API usage.

    Args:
        from_lng: Origin longitude
        from_lat: Origin latitude
        to_lng: Destination longitude
        to_lat: Destination latitude
        from_address: Optional origin address for logging
        to_address: Optional destination address for logging

    Returns:
        Travel times for car, bike, and walking
    """
    try:
        results = await calculate_all_travel_modes(
            from_coords=(from_lng, from_lat),
            to_coords=(to_lng, to_lat),
            from_address=from_address,
            to_address=to_address
        )

        return {
            "success": True,
            "from": {
                "lng": from_lng,
                "lat": from_lat,
                "address": from_address
            },
            "to": {
                "lng": to_lng,
                "lat": to_lat,
                "address": to_address
            },
            "travel_times": results,
            "metadata": {
                "source": "OpenRouteService",
                "cached": any(r.get("cache_hit", False) for r in results.values() if isinstance(r, dict))
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating travel time: {str(e)}")


@app.get("/api/cache-stats")
def get_travel_cache_stats():
    """
    Get statistics about the travel query cache.

    Returns:
        Cache statistics including total queries and mode breakdown
    """
    try:
        stats = get_cache_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting cache stats: {str(e)}")


@app.get("/api/wijkagent")
def get_wijkagent_info():
    """
    Get general wijkagent (neighborhood police officer) information.

    Returns:
        Wijkagent explanation and contact information for expats
    """
    import json

    try:
        wijkagent_path = Path(__file__).parent.parent / "data" / "raw" / "wijkagent_info.json"

        if not wijkagent_path.exists():
            return {
                "success": False,
                "error": "Wijkagent information not available"
            }

        with open(wijkagent_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return {
            "success": True,
            "data": data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading wijkagent info: {str(e)}")


@app.get("/api/energy-consumption/{neighborhood_code}")
def get_energy_consumption(neighborhood_code: str):
    """
    Get energy consumption data for a neighborhood from CBS datasets.

    Args:
        neighborhood_code: CBS neighborhood/municipality code (e.g., "BU03630000", "GM0363")

    Returns:
        Average energy consumption statistics for the area
    """
    # Try the 2024 neighborhood data first (most detailed)
    energy_data_path = DATA_DIR / "energieverbruik_86159NED.parquet"

    if not energy_data_path.exists():
        return {
            "success": False,
            "message": "Energy consumption data not yet downloaded. Run: python -m ingest.energieverbruik"
        }

    try:
        df = pl.read_parquet(energy_data_path)

        # Clean and normalize the neighborhood code
        search_code = neighborhood_code.strip().upper()

        # Try exact match first
        result = df.filter(pl.col("WijkenEnBuurten").str.strip() == search_code)

        # If no result and it's a buurt code (starts with BU), try finding the wijk
        if result.height == 0 and search_code.startswith("BU"):
            wijk_code = "WK" + search_code[2:6] + "00"
            result = df.filter(pl.col("WijkenEnBuurten").str.strip() == wijk_code)

        # If still no result, try municipality level (GM prefix)
        if result.height == 0 and not search_code.startswith("GM"):
            # Extract municipality code from buurt/wijk code
            if search_code.startswith(("BU", "WK")):
                municipality_code = "GM" + search_code[2:6]
                result = df.filter(pl.col("WijkenEnBuurten").str.strip() == municipality_code)

        if result.height == 0:
            return {
                "success": False,
                "message": f"No energy consumption data found for {neighborhood_code}",
                "searched_code": search_code
            }

        record = result.to_dicts()[0]

        # Calculate estimated annual costs (2025 Dutch average prices)
        # Source: CBS/Overstappen.nl January 2025
        GAS_PRICE_EUR_PER_M3 = 1.35  # Average €1.33-1.37/m³ for 2025
        ELECTRICITY_PRICE_EUR_PER_KWH = 0.34  # Average €0.33-0.34/kWh for 2025
        WATER_PRICE_EUR_PER_M3 = 2.61  # National average including taxes 2025

        gas_consumption = record.get("GemiddeldAardgasverbruik_4")
        electricity_consumption = record.get("GemiddeldeElektriciteitslevering_5")
        net_electricity = record.get("GemiddeldeNettoElektriciteitslevering_6")

        # Estimate water consumption: Dutch average is 119 liters/person/day
        # Average household size in NL is 2.2 persons
        # Annual water consumption: 119 * 365 * 2.2 / 1000 = ~95.6 m³
        AVERAGE_HOUSEHOLD_WATER_M3 = 96

        estimated_cost = 0
        if gas_consumption:
            estimated_cost += gas_consumption * GAS_PRICE_EUR_PER_M3
        if electricity_consumption:
            estimated_cost += electricity_consumption * ELECTRICITY_PRICE_EUR_PER_KWH

        # Add water cost
        water_cost = AVERAGE_HOUSEHOLD_WATER_M3 * WATER_PRICE_EUR_PER_M3
        estimated_cost += water_cost

        return {
            "success": True,
            "neighborhood_code": record["WijkenEnBuurten"].strip(),
            "municipality": record["Gemeentenaam_1"].strip(),
            "region_type": record["SoortRegio_2"].strip(),  # Land, Gemeente, Wijk, Buurt
            "avg_gas_consumption_m3": gas_consumption,
            "avg_electricity_delivery_kwh": electricity_consumption,
            "avg_net_electricity_kwh": net_electricity,  # After solar panel generation
            "avg_water_consumption_m3": AVERAGE_HOUSEHOLD_WATER_M3,
            "district_heating_percentage": record.get("Stadsverwarming_7"),
            "estimated_annual_cost_eur": round(estimated_cost) if estimated_cost > 0 else None,
            "cost_breakdown": {
                "gas_eur": round(gas_consumption * GAS_PRICE_EUR_PER_M3) if gas_consumption else None,
                "electricity_eur": round(electricity_consumption * ELECTRICITY_PRICE_EUR_PER_KWH) if electricity_consumption else None,
                "water_eur": round(water_cost)
            },
            "monthly_cost_eur": round(estimated_cost / 12) if estimated_cost > 0 else None,
            "year": 2024,
            "metadata": {
                "source": "CBS OpenData (Dataset 86159NED)",
                "data_type": "Preliminary 2024 data",
                "price_assumptions": {
                    "gas_eur_per_m3": GAS_PRICE_EUR_PER_M3,
                    "electricity_eur_per_kwh": ELECTRICITY_PRICE_EUR_PER_KWH,
                    "water_eur_per_m3": WATER_PRICE_EUR_PER_M3,
                    "note": "Prices are 2025 average rates including VAT and taxes. Water estimate based on Dutch average household (2.2 persons)."
                }
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading energy consumption data: {str(e)}")


@app.get("/api/proximity/{area_code}")
def get_proximity_data(area_code: str):
    """
    Get CBS proximity to facilities data for a neighborhood.

    Includes distances to various amenities like:
    - Healthcare (GP, hospital, pharmacy)
    - Education (schools, childcare)
    - Transport (train station, public transport)
    - Amenities (supermarket, restaurant, library, etc.)
    - Recreation (museums, theaters, sports facilities)

    Args:
        area_code: Neighborhood code (e.g., "BU16800000")

    Returns:
        Proximity data with distances in km and counts within radius
    """
    df = load_dataframe("proximity", CBS_PROXIMITY)

    if df is None:
        return {
            "success": False,
            "message": "Proximity data not yet downloaded. Run: python scripts/etl/ingest/cbs_proximity.py"
        }

    try:
        # Clean and normalize the neighborhood code
        search_code = area_code.strip().upper()

        # Try exact match first
        result = df.filter(pl.col("area_code") == search_code)

        # If no result and it's a buurt code (starts with BU), try finding the wijk
        if result.height == 0 and search_code.startswith("BU"):
            wijk_code = "WK" + search_code[2:6] + "00"
            result = df.filter(pl.col("area_code") == wijk_code)

        # If still no result, try municipality level (GM prefix)
        if result.height == 0 and not search_code.startswith("GM"):
            # Extract municipality code from buurt/wijk code
            if search_code.startswith(("BU", "WK")):
                municipality_code = "GM" + search_code[2:6]
                result = df.filter(pl.col("area_code") == municipality_code)

        if result.height == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No proximity data found for {area_code}"
            )

        record = result.to_dicts()[0]

        return {
            "success": True,
            "area_code": record["area_code"],
            "area_name": record["area_name"],
            "area_type": record["area_type"],
            "data": record,
            "metadata": {
                "source": "CBS (Statistics Netherlands) - Dataset 86134NED",
                "year": 2024,
                "license": "CC-BY 4.0",
                "note": "Official proximity metrics from CBS - distances in km"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading proximity data: {str(e)}")


@app.get("/api/wms-proxy")
def wms_proxy(request: Request):
    """
    Proxy WMS requests to avoid CORS issues.

    Forwards WMS tile requests to external services (RIVM, Leefbaarometer, etc.)
    and returns the response with proper CORS headers.

    Query parameters:
    - url: The target WMS service URL
    - All other parameters are forwarded to the WMS service
    """
    import requests
    from urllib.parse import urlparse

    try:
        # Get the target URL from query params
        params = dict(request.query_params)
        target_url = params.pop('url', None)

        if not target_url:
            raise HTTPException(status_code=400, detail="Missing 'url' parameter")

        # Whitelist of allowed WMS services to prevent abuse
        allowed_domains = [
            'geodata.rivm.nl',
            'geo.leefbaarometer.nl',
            'geodata.nationaalgeoregister.nl',
            'service.pdok.nl'
        ]

        # Check if the target URL is from an allowed domain
        parsed_url = urlparse(target_url)
        if not any(domain in parsed_url.netloc for domain in allowed_domains):
            raise HTTPException(status_code=403, detail="Target domain not allowed")

        # Make the request to the WMS service with a timeout using requests library
        # requests handles SSL better on Windows than httpx
        response = requests.get(target_url, params=params, timeout=30, verify=True)
        response.raise_for_status()

        # Return the response with proper CORS headers
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers={
                'Content-Type': response.headers.get('Content-Type', 'image/png'),
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'  # Cache for 1 hour
            }
        )

    except requests.Timeout:
        raise HTTPException(status_code=504, detail="WMS service timeout")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"WMS service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")


# Additional data paths for new datasets
RDW_PARKING = DATA_DIR / "rdw_parking.parquet"
RDW_COMPANIES = DATA_DIR / "rdw_companies.parquet"
EMERGENCY_SERVICES = DATA_DIR / "emergency_services.parquet"
CULTURAL_AMENITIES = DATA_DIR / "cultural_amenities.parquet"
HEALTHCARE_EXPANDED = DATA_DIR / "healthcare_expanded.parquet"
WOONLASTEN = DATA_DIR / "woonlasten_85949NED.parquet"


@app.get("/api/parking")
def get_parking(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    city: Optional[str] = None,
    limit: int = 500
):
    """
    Get parking facility locations from RDW.

    Args:
        city: Filter by city name
        limit: Maximum results

    Returns:
        List of parking facilities
    """
    df = load_dataframe("parking", RDW_PARKING)

    if df is None:
        raise HTTPException(status_code=503, detail="Parking data not available")

    if city:
        df = df.filter(pl.col("city").str.to_lowercase().str.contains(city.lower()))

    df = df.head(limit)

    return {
        "success": True,
        "count": df.height,
        "data": df.to_dicts(),
        "metadata": {
            "source": "RDW Open Data",
            "license": "CC0"
        }
    }


@app.get("/api/rdw-companies")
def get_rdw_companies(
    city: Optional[str] = None,
    postal_code: Optional[str] = None,
    limit: int = 500
):
    """
    Get RDW recognized companies (APK stations, vehicle services).

    Args:
        city: Filter by city name
        postal_code: Filter by postal code prefix
        limit: Maximum results

    Returns:
        List of RDW recognized companies
    """
    df = load_dataframe("rdw_companies", RDW_COMPANIES)

    if df is None:
        raise HTTPException(status_code=503, detail="RDW companies data not available")

    if city:
        df = df.filter(pl.col("city").str.to_lowercase().str.contains(city.lower()))

    if postal_code:
        df = df.filter(pl.col("postal_code").str.starts_with(postal_code.upper()))

    df = df.head(limit)

    return {
        "success": True,
        "count": df.height,
        "data": df.to_dicts(),
        "metadata": {
            "source": "RDW Open Data",
            "license": "CC0",
            "note": "RDW recognized businesses including APK stations"
        }
    }


@app.get("/api/emergency-services")
def get_emergency_services(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    service_type: Optional[str] = None,
    limit: int = 500
):
    """
    Get emergency service locations (fire stations, police, ambulance).

    Args:
        service_type: Filter by type (fire, police, ambulance)
        limit: Maximum results

    Returns:
        List of emergency service locations
    """
    df = load_dataframe("emergency_services", EMERGENCY_SERVICES)

    if df is None:
        raise HTTPException(status_code=503, detail="Emergency services data not available")

    # Apply geographic filters if coordinates exist
    lat_col = "lat" if "lat" in df.columns else "latitude"
    lng_col = "lng" if "lng" in df.columns else "longitude"

    if lat_col in df.columns:
        if minLat is not None:
            df = df.filter(pl.col(lat_col) >= minLat)
        if maxLat is not None:
            df = df.filter(pl.col(lat_col) <= maxLat)
        if minLng is not None:
            df = df.filter(pl.col(lng_col) >= minLng)
        if maxLng is not None:
            df = df.filter(pl.col(lng_col) <= maxLng)

    if service_type:
        df = df.filter(pl.col("type").str.to_lowercase().str.contains(service_type.lower()))

    df = df.head(limit)

    return {
        "success": True,
        "count": df.height,
        "data": df.to_dicts(),
        "metadata": {
            "source": "CBS/OSM",
            "note": "Fire stations, police stations, ambulance services"
        }
    }


@app.get("/api/cultural-amenities")
def get_cultural_amenities(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    amenity_type: Optional[str] = None,
    limit: int = 500
):
    """
    Get cultural amenity locations (museums, theaters, libraries, cinemas).

    Args:
        amenity_type: Filter by type (museum, theater, library, cinema)
        limit: Maximum results

    Returns:
        List of cultural amenities
    """
    df = load_dataframe("cultural_amenities", CULTURAL_AMENITIES)

    if df is None:
        raise HTTPException(status_code=503, detail="Cultural amenities data not available")

    # Apply geographic filters if coordinates exist
    lat_col = "lat" if "lat" in df.columns else "latitude"
    lng_col = "lng" if "lng" in df.columns else "longitude"

    if lat_col in df.columns:
        if minLat is not None:
            df = df.filter(pl.col(lat_col) >= minLat)
        if maxLat is not None:
            df = df.filter(pl.col(lat_col) <= maxLat)
        if minLng is not None:
            df = df.filter(pl.col(lng_col) >= minLng)
        if maxLng is not None:
            df = df.filter(pl.col(lng_col) <= maxLng)

    if amenity_type:
        df = df.filter(pl.col("type").str.to_lowercase().str.contains(amenity_type.lower()))

    df = df.head(limit)

    return {
        "success": True,
        "count": df.height,
        "data": df.to_dicts(),
        "metadata": {
            "source": "CBS/OSM",
            "note": "Museums, theaters, libraries, cinemas, concert halls"
        }
    }


@app.get("/api/healthcare-facilities")
def get_healthcare_facilities(
    minLat: Optional[float] = None,
    maxLat: Optional[float] = None,
    minLng: Optional[float] = None,
    maxLng: Optional[float] = None,
    facility_type: Optional[str] = None,
    limit: int = 500
):
    """
    Get healthcare facility locations (hospitals, GPs, pharmacies, dentists).

    Args:
        facility_type: Filter by type (hospital, gp, pharmacy, dentist)
        limit: Maximum results

    Returns:
        List of healthcare facilities
    """
    df = load_dataframe("healthcare_expanded", HEALTHCARE_EXPANDED)

    if df is None:
        raise HTTPException(status_code=503, detail="Healthcare data not available")

    # Apply geographic filters if coordinates exist
    lat_col = "lat" if "lat" in df.columns else "latitude"
    lng_col = "lng" if "lng" in df.columns else "longitude"

    if lat_col in df.columns:
        if minLat is not None:
            df = df.filter(pl.col(lat_col) >= minLat)
        if maxLat is not None:
            df = df.filter(pl.col(lat_col) <= maxLat)
        if minLng is not None:
            df = df.filter(pl.col(lng_col) >= minLng)
        if maxLng is not None:
            df = df.filter(pl.col(lng_col) <= maxLng)

    if facility_type:
        df = df.filter(pl.col("type").str.to_lowercase().str.contains(facility_type.lower()))

    df = df.head(limit)

    return {
        "success": True,
        "count": df.height,
        "data": df.to_dicts(),
        "metadata": {
            "source": "CBS/OSM",
            "note": "Hospitals, GP practices, pharmacies, dentists, specialists"
        }
    }


@app.get("/api/housing-costs/{area_code}")
def get_housing_costs(area_code: str):
    """
    Get housing costs (woonlasten) data for a municipality.

    Args:
        area_code: Municipality code (e.g., "GM0363")

    Returns:
        Housing costs breakdown including rent, mortgage, utilities
    """
    df = load_dataframe("woonlasten", WOONLASTEN)

    if df is None:
        raise HTTPException(status_code=503, detail="Housing costs data not available")

    # Get column names to understand structure
    columns = df.columns

    # Try to find the area
    search_code = area_code.strip().upper()

    # Look for municipality code column
    region_col = None
    for col in columns:
        if "regio" in col.lower() or "gemeente" in col.lower():
            region_col = col
            break

    if region_col:
        result = df.filter(pl.col(region_col).str.contains(search_code))
    else:
        result = df.head(1)  # Return first row as sample

    if result.height == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No housing costs data found for {area_code}"
        )

    records = result.to_dicts()

    return {
        "success": True,
        "area_code": area_code,
        "data": records[0] if records else None,
        "metadata": {
            "source": "CBS (Statistics Netherlands)",
            "dataset": "Woonlasten huishoudens",
            "license": "CC-BY 4.0"
        }
    }


if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
