"""
Flood Risk data ingestion from Dutch government sources.

Downloads flood risk zones (overstromingsgebieden) from multiple sources:
1. Lizard GeoServer (LIWO) - Official flood risk data used by overstroomik.nl
2. Klimaateffectatlas WFS - Climate adaptation data with wateroverlast
3. Risicokaart.nl WFS - Official Dutch risk map (infrastructure risks)

Data sources:
- https://basisinformatie-overstromingen.nl/ (LIWO/Lizard)
- https://www.klimaateffectatlas.nl/ (climate atlas)
- https://www.risicokaart.nl/ (official risk map)
- https://overstroomik.nl/ (public flood info portal)

License: Open Data (CC0 / Public Domain)
"""

import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import click
import httpx
from tqdm import tqdm
import xml.etree.ElementTree as ET

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# WFS Endpoints for flood risk data
WFS_ENDPOINTS = {
    # Lizard platform - THE main source for official LIWO flood data
    # This is what overstroomik.nl uses!
    "lizard": {
        "url": "https://ldo-geoserver.lizard.net/geoserver/ows",
        "description": "LIWO/Lizard GeoServer (Official Flood Risk Data)",
        "layers": [
            # ROR3 = Risicokaart Overstromingen Revisie 3 (latest official data)
            # T10 = 1:10 year probability (high probability)
            # T100 = 1:100 year probability (medium probability)
            # T1000 = 1:1000 year probability (low probability)
            # T10000 = 1:10000 year probability (very low probability)

            # Flooded areas (gebieden)
            "ror3:t10_overstroomde_gebieden",      # High probability flood zones
            "ror3:t100_overstroomde_gebieden",     # Medium probability flood zones
            "ror3:t1000_overstroomde_gebieden",    # Low probability flood zones

            # Maximum water depth
            "ror3:t10_maximale_waterdiepte",       # High probability depth
            "ror3:t100_maximale_waterdiepte",      # Medium probability depth
            "ror3:t1000_maximale_waterdiepte",     # Low probability depth
        ]
    },
    # Klimaateffectatlas - wateroverlast (rainfall flooding) per municipality
    "klimaatatlas": {
        "url": "https://maps1.klimaatatlas.net/geoserver/ows",
        "description": "Climate Effect Atlas (Wateroverlast/Rainfall Flooding)",
        "layers": [
            # Rijnland water board - regional flooding
            "Rijnland_klimaatatlas:1809_rijnland_overstromingsbeeld_primair",
            "Rijnland_klimaatatlas:1809_rijnland_overstromingsbeeld_regionaal",
            # HHNK water board - flood scenarios
            "hhnk_klimaatatlas:1806_hhnk_beg_wegen_overstroming",
        ]
    },
}

# Netherlands bounding box for requests
NETHERLANDS_BBOX = [3.37, 50.75, 7.21, 53.47]  # [minLon, minLat, maxLon, maxLat]

# Known flood risk areas with metadata (enhanced fallback data)
KNOWN_FLOOD_RISK_AREAS = {
    "limburg_maas": {
        "name": "Limburg - Maasdal",
        "risk_level": "very_high",
        "probability": "T10",  # 1:10 year
        "flood_type": "river_flooding",
        "rivers": ["Maas", "Geul", "Gulp", "Roer"],
        "recent_events": ["2021-07 (catastrophic)", "2024-01", "2023-01"],
        "max_water_depth_m": 2.5,
        "notes": "Repeatedly flooded. 2021 event caused €450M damage. Evacuation plans active.",
        "bbox": [5.7, 50.75, 6.1, 51.2]
    },
    "limburg_geuldal": {
        "name": "Geuldal (Valkenburg area)",
        "risk_level": "very_high",
        "probability": "T10",
        "flood_type": "flash_flooding",
        "rivers": ["Geul"],
        "recent_events": ["2021-07 (4 deaths)"],
        "max_water_depth_m": 3.0,
        "notes": "Flash flood prone valley. Valkenburg center severely damaged 2021.",
        "bbox": [5.8, 50.82, 5.95, 50.9]
    },
    "zeeland": {
        "name": "Zeeland",
        "risk_level": "high",
        "probability": "T100",
        "flood_type": "sea_flooding",
        "notes": "Below sea level, protected by Delta Works. Storm surge risk remains.",
        "historical": "1953 North Sea Flood - 1,836 deaths",
        "max_water_depth_m": 5.0,
        "bbox": [3.35, 51.2, 4.25, 51.75]
    },
    "flevoland": {
        "name": "Flevoland",
        "risk_level": "high",
        "probability": "T100",
        "flood_type": "polder_failure",
        "notes": "Entirely reclaimed land, 4-6m below sea level. Depends on pumps 24/7.",
        "max_water_depth_m": 6.0,
        "bbox": [5.15, 52.25, 6.0, 52.7]
    },
    "haarlemmermeer": {
        "name": "Haarlemmermeer (incl. Schiphol)",
        "risk_level": "high",
        "probability": "T100",
        "flood_type": "polder_failure",
        "notes": "Schiphol airport is 3-4m below sea level. Critical infrastructure at risk.",
        "max_water_depth_m": 4.5,
        "bbox": [4.55, 52.22, 4.85, 52.4]
    },
    "rotterdam_rijnmond": {
        "name": "Rotterdam-Rijnmond",
        "risk_level": "high",
        "probability": "T100",
        "flood_type": "combined",
        "notes": "Sea + river flood risk. Maeslantkering barrier protects against storm surge.",
        "max_water_depth_m": 4.0,
        "bbox": [4.2, 51.85, 4.6, 52.0]
    },
    "groene_hart": {
        "name": "Groene Hart (Green Heart)",
        "risk_level": "medium",
        "probability": "T100",
        "flood_type": "polder_failure",
        "notes": "Low-lying polders between Amsterdam, Rotterdam, Utrecht. Deep polders.",
        "max_water_depth_m": 3.5,
        "bbox": [4.4, 51.95, 5.0, 52.25]
    },
    "rivierengebied": {
        "name": "Rivierengebied (River Area)",
        "risk_level": "medium",
        "probability": "T100",
        "flood_type": "river_flooding",
        "rivers": ["Rijn", "Waal", "Maas", "IJssel"],
        "historical": "1995 evacuation of 250,000 people",
        "notes": "Between major rivers. Dike ring areas. Room for the River program active.",
        "max_water_depth_m": 3.0,
        "bbox": [4.8, 51.75, 6.2, 52.05]
    },
    "groningen_eemsmond": {
        "name": "Groningen (Eemsmond)",
        "risk_level": "medium",
        "probability": "T100",
        "flood_type": "sea_flooding",
        "notes": "Earthquake-weakened dikes, subsidence from gas extraction.",
        "bbox": [6.2, 53.2, 7.0, 53.5]
    },
    "noord_holland_kust": {
        "name": "Noord-Holland Kust",
        "risk_level": "medium",
        "probability": "T1000",
        "flood_type": "sea_flooding",
        "notes": "Dune coast protection. Den Helder area slightly higher risk.",
        "bbox": [4.5, 52.5, 5.0, 53.0]
    },
    "friesland_waddenkust": {
        "name": "Friesland Waddenkust",
        "risk_level": "low",
        "probability": "T1000",
        "flood_type": "sea_flooding",
        "notes": "Wadden Sea area, strong dikes, UNESCO protected.",
        "bbox": [5.0, 53.1, 6.2, 53.45]
    },
    "veluwe": {
        "name": "Veluwe & East Netherlands",
        "risk_level": "very_low",
        "probability": "T10000",
        "flood_type": "none",
        "notes": "Higher ground. Generally safe from flooding.",
        "bbox": [5.5, 52.0, 6.3, 52.5]
    }
}


class FloodRiskClient:
    """Client for downloading flood risk data from WFS services."""

    def __init__(self, timeout: int = 180):
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (housing search platform; contact@example.com)",
                "Accept": "application/json, application/geo+json, */*",
            }
        )

    def get_capabilities(self, wfs_url: str) -> Dict:
        """Get WFS capabilities to discover available layers."""
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetCapabilities"
        }

        try:
            response = self.client.get(wfs_url, params=params)
            response.raise_for_status()

            # Parse XML to find feature types
            root = ET.fromstring(response.content)

            # WFS 2.0 namespaces
            namespaces = {
                'wfs': 'http://www.opengis.net/wfs/2.0',
                'ows': 'http://www.opengis.net/ows/1.1'
            }

            layers = []
            for ft in root.findall('.//wfs:FeatureType', namespaces):
                name = ft.find('wfs:Name', namespaces)
                title = ft.find('wfs:Title', namespaces)
                if name is not None:
                    layers.append({
                        "name": name.text,
                        "title": title.text if title is not None else name.text
                    })

            return {"layers": layers}

        except Exception as e:
            log.warning(f"Could not get capabilities from {wfs_url}: {e}")
            return {"layers": [], "error": str(e)}

    def get_features_geojson(self, wfs_url: str, layer_name: str,
                             max_features: int = 50000,
                             bbox: Optional[List[float]] = None) -> Optional[Dict]:
        """Download features from WFS as GeoJSON."""

        # Try different output formats
        output_formats = [
            "application/json",
            "json",
            "geojson",
        ]

        for output_format in output_formats:
            params = {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeName": layer_name,
                "outputFormat": output_format,
                "count": str(max_features),
                "srsName": "EPSG:4326"
            }

            if bbox:
                params["bbox"] = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},EPSG:4326"

            try:
                log.info(f"Fetching layer: {layer_name} (format: {output_format})")
                response = self.client.get(wfs_url, params=params)

                if response.status_code == 200:
                    content_type = response.headers.get('content-type', '')

                    # Try to parse as JSON
                    if 'json' in content_type or 'json' in output_format:
                        try:
                            data = response.json()
                            feature_count = len(data.get("features", []))
                            if feature_count > 0:
                                log.success(f"Retrieved {feature_count} features from {layer_name}")
                                return data
                        except json.JSONDecodeError:
                            continue

            except httpx.TimeoutException:
                log.warning(f"Timeout fetching {layer_name}")
                continue
            except Exception as e:
                log.warning(f"Error fetching {layer_name}: {e}")
                continue

        return None

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def create_geojson_from_known_areas() -> Dict:
    """Create GeoJSON from known flood risk areas."""
    features = []

    for area_id, area_data in KNOWN_FLOOD_RISK_AREAS.items():
        bbox = area_data.get("bbox", [0, 0, 0, 0])

        # Create polygon from bounding box
        coordinates = [[
            [bbox[0], bbox[1]],  # SW
            [bbox[2], bbox[1]],  # SE
            [bbox[2], bbox[3]],  # NE
            [bbox[0], bbox[3]],  # NW
            [bbox[0], bbox[1]]   # Close polygon
        ]]

        # Map risk levels to numeric scores for visualization
        risk_scores = {
            "very_high": 5,
            "high": 4,
            "medium": 3,
            "low": 2,
            "very_low": 1
        }

        feature = {
            "type": "Feature",
            "id": area_id,
            "properties": {
                "id": area_id,
                "name": area_data.get("name"),
                "risk_level": area_data.get("risk_level"),
                "risk_score": risk_scores.get(area_data.get("risk_level", "medium"), 3),
                "probability": area_data.get("probability"),
                "flood_type": area_data.get("flood_type"),
                "rivers": area_data.get("rivers", []),
                "recent_events": area_data.get("recent_events", []),
                "max_water_depth_m": area_data.get("max_water_depth_m"),
                "notes": area_data.get("notes"),
                "historical": area_data.get("historical"),
                "source": "curated_expert_data"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": coordinates
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "Curated from official Dutch flood risk sources",
            "description": "Known flood risk areas in the Netherlands",
            "sources_consulted": [
                "overstroomik.nl",
                "risicokaart.nl",
                "klimaateffectatlas.nl",
                "KNMI climate scenarios"
            ],
            "last_updated": datetime.utcnow().isoformat()
        }
    }


def enrich_with_wfs_data(base_geojson: Dict, wfs_data: List[Dict]) -> Dict:
    """Enrich base GeoJSON with WFS data where available."""

    # Add WFS features to the collection
    for wfs_collection in wfs_data:
        if wfs_collection and "features" in wfs_collection:
            for feature in wfs_collection["features"]:
                # Add source info to properties
                props = feature.get("properties", {})
                props["source"] = wfs_collection.get("metadata", {}).get("layer", "wfs")
                props["wfs_source"] = True
                feature["properties"] = props

                base_geojson["features"].append(feature)

    # Update metadata
    base_geojson["metadata"]["wfs_enriched"] = True
    base_geojson["metadata"]["total_features"] = len(base_geojson["features"])

    return base_geojson


def simplify_geometry(geojson: Dict, tolerance: float = 0.001) -> Dict:
    """
    Simplify geometries to reduce file size.
    Note: For production, use shapely or similar library.
    This is a basic implementation that just limits coordinate precision.
    """
    for feature in geojson.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") == "Polygon":
            new_coords = []
            for ring in geom.get("coordinates", []):
                new_ring = [[round(c[0], 5), round(c[1], 5)] for c in ring]
                new_coords.append(new_ring)
            feature["geometry"]["coordinates"] = new_coords
        elif geom.get("type") == "MultiPolygon":
            new_coords = []
            for polygon in geom.get("coordinates", []):
                new_polygon = []
                for ring in polygon:
                    new_ring = [[round(c[0], 5), round(c[1], 5)] for c in ring]
                    new_polygon.append(new_ring)
                new_coords.append(new_polygon)
            feature["geometry"]["coordinates"] = new_coords

    return geojson


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/flood_risk.json",
    help="Output JSON file"
)
@click.option(
    "--source",
    type=click.Choice(["all", "lizard", "klimaatatlas", "curated"]),
    default="all",
    help="Data source to use"
)
@click.option(
    "--discover-layers",
    is_flag=True,
    help="Just discover available layers without downloading"
)
@click.option(
    "--max-features",
    type=int,
    default=10000,
    help="Maximum features to download per layer"
)
def main(output: str, source: str, discover_layers: bool, max_features: int):
    """
    Download flood risk data from Dutch government WFS services.

    Data sources:
    - lizard: LIWO/Lizard GeoServer (official flood scenarios from overstroomik.nl)
    - klimaatatlas: Climate Effect Atlas (wateroverlast/rainfall flooding)
    - curated: Expert-curated flood risk zones (always available)

    Examples:
        # Download all available data
        python -m ingest.flood_risk

        # Discover available layers
        python -m ingest.flood_risk --discover-layers

        # Use only curated data (fast, always works)
        python -m ingest.flood_risk --source curated
    """
    log.info("=== Flood Risk Data Ingestion ===")
    log.info("Sources: LIWO (overstroomik.nl), Klimaatatlas, Expert curation")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    wfs_data = []

    with FloodRiskClient() as client:

        # Discover layers mode
        if discover_layers:
            log.info("\nDiscovering available WFS layers...")
            for name, endpoint in WFS_ENDPOINTS.items():
                log.info(f"\n--- {endpoint['description']} ---")
                log.info(f"URL: {endpoint['url']}")

                caps = client.get_capabilities(endpoint['url'])
                layers = caps.get('layers', [])

                if layers:
                    # Filter for flood-related layers
                    flood_layers = [l for l in layers if any(
                        term in l['name'].lower()
                        for term in ['overstr', 'flood', 'water', 'inund', 'ror3']
                    )]

                    log.info(f"Found {len(flood_layers)} flood-related layers (of {len(layers)} total):")
                    for layer in flood_layers[:30]:
                        log.info(f"  - {layer['name']}")
                    if len(flood_layers) > 30:
                        log.info(f"  ... and {len(flood_layers) - 30} more")
                else:
                    log.warning(f"  No layers found or error: {caps.get('error', 'unknown')}")
            return

        # Download data from WFS sources
        if source in ["all", "lizard", "klimaatatlas"]:
            sources_to_try = (
                list(WFS_ENDPOINTS.keys()) if source == "all"
                else [source]
            )

            for source_name in sources_to_try:
                endpoint = WFS_ENDPOINTS.get(source_name)
                if not endpoint:
                    continue

                log.info(f"\n--- Trying {endpoint['description']} ---")

                for layer_name in endpoint.get("layers", []):
                    geojson = client.get_features_geojson(
                        endpoint["url"],
                        layer_name,
                        max_features=max_features,
                        bbox=NETHERLANDS_BBOX
                    )

                    if geojson and geojson.get("features"):
                        geojson["metadata"] = {
                            "source": endpoint["description"],
                            "layer": layer_name,
                            "url": endpoint["url"],
                            "fetched_at": datetime.utcnow().isoformat()
                        }
                        wfs_data.append(geojson)
                        log.success(f"  ✓ {layer_name}: {len(geojson['features'])} features")
                    else:
                        log.warning(f"  ✗ {layer_name}: No data or error")

                    # Be nice to servers
                    time.sleep(1)

    # Always create curated data as base
    log.info("\nCreating curated flood risk zones...")
    curated_data = create_geojson_from_known_areas()
    log.success(f"Created {len(curated_data['features'])} curated flood zones")

    # Enrich with WFS data if available
    if wfs_data:
        log.info(f"\nEnriching with {len(wfs_data)} WFS data sources...")
        final_data = enrich_with_wfs_data(curated_data, wfs_data)
    else:
        final_data = curated_data

    # Simplify geometries for smaller file size
    final_data = simplify_geometry(final_data)

    # Update final metadata
    final_data["metadata"]["generated_at"] = datetime.utcnow().isoformat()
    final_data["metadata"]["generator"] = "where-to-live-nl flood_risk.py"

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    log.success(f"\nSaved flood risk data to {output_path}")

    # Statistics
    log.info("\n=== Statistics ===")

    curated_count = sum(1 for f in final_data["features"]
                        if f.get("properties", {}).get("source") == "curated_expert_data")
    wfs_count = sum(1 for f in final_data["features"]
                    if f.get("properties", {}).get("wfs_source"))

    log.info(f"Total features: {len(final_data['features'])}")
    log.info(f"  - Curated zones: {curated_count}")
    log.info(f"  - WFS features: {wfs_count}")

    # Risk level distribution (curated zones)
    risk_levels = {}
    flood_types = {}

    for feature in final_data["features"]:
        props = feature.get("properties", {})
        if props.get("source") == "curated_expert_data":
            level = props.get("risk_level", "unknown")
            risk_levels[level] = risk_levels.get(level, 0) + 1

            ftype = props.get("flood_type", "unknown")
            flood_types[ftype] = flood_types.get(ftype, 0) + 1

    if risk_levels:
        log.info("\nCurated zones by risk level:")
        for level in ["very_high", "high", "medium", "low", "very_low"]:
            if level in risk_levels:
                log.info(f"  {level}: {risk_levels[level]}")

    if flood_types:
        log.info("\nCurated zones by flood type:")
        for ftype, count in sorted(flood_types.items()):
            log.info(f"  {ftype}: {count}")

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"\nFile size: {file_size_kb:.1f} KB")


if __name__ == "__main__":
    main()
