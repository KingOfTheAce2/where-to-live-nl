"""
Flood Risk (Overstromingsrisico) data ingestion.

Downloads flood risk data from various Dutch government sources.
Important for understanding climate-related housing risks.

Data sources:
- LIWO (Landelijk Informatiesysteem Water en Overstromingen) - WMS services
- Klimaateffectatlas - Flood depth maps
- Risicokaart.nl - Risk mapping

License: Open Data / CC0
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

# LIWO WMS endpoints (Landelijk Informatiesysteem Water en Overstromingen)
# Source: https://basisinformatie-overstromingen.nl/liwo/
LIWO_WMS = "https://geodata.nationaalgeoregister.nl/liwo/wms"

# Klimaateffectatlas flood depth data
# Source: https://www.klimaateffectatlas.nl/en/flood-depth
KLIMAAT_WMS = "https://geodata.nationaalgeoregister.nl/rws-klimaateffectatlas/wms"

# Risicokaart flood scenarios
RISICOKAART_WMS = "https://geodata.nationaalgeoregister.nl/risicokaart/wms"

# AHN (Actueel Hoogtebestand Nederland) for elevation
AHN_WMS = "https://service.pdok.nl/rws/ahn/wms/v1_0"

# Areas below sea level in NL (general knowledge)
BELOW_SEA_LEVEL_PROVINCES = [
    "Noord-Holland",
    "Zuid-Holland",
    "Flevoland",
    "Friesland",
    "Groningen",
    "Utrecht (parts)"
]


class FloodRiskClient:
    """Client for flood risk data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize flood risk client.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (Flood Risk Data Collection)",
                "Accept": "application/json, */*",
            }
        )

    def get_liwo_capabilities(self) -> Optional[Dict]:
        """
        Get LIWO WMS capabilities to understand available layers.

        Returns:
            Capabilities info
        """
        params = {
            "service": "WMS",
            "request": "GetCapabilities",
            "version": "1.3.0"
        }

        try:
            response = self.client.get(LIWO_WMS, params=params)
            response.raise_for_status()

            # Parse XML capabilities (simplified)
            content = response.text

            # Extract layer names (basic parsing)
            layers = []
            import re
            layer_matches = re.findall(r'<Name>([^<]+)</Name>', content)

            return {
                "endpoint": LIWO_WMS,
                "layers": layer_matches[:20],  # First 20 layers
                "status": "available"
            }

        except Exception as e:
            log.warning(f"Could not fetch LIWO capabilities: {e}")
            return None

    def get_flood_depth_at_point(self, lat: float, lng: float) -> Optional[Dict]:
        """
        Get flood depth information for a specific point using WMS GetFeatureInfo.

        Args:
            lat: Latitude (WGS84)
            lng: Longitude (WGS84)

        Returns:
            Flood depth info if available
        """
        # WMS GetFeatureInfo request
        # This queries the flood depth layer at a specific point
        params = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": "waterdiepte_primair",  # Primary flood depth layer
            "query_layers": "waterdiepte_primair",
            "info_format": "application/json",
            "crs": "EPSG:4326",
            "width": "100",
            "height": "100",
            "i": "50",
            "j": "50",
            "bbox": f"{lng-0.001},{lat-0.001},{lng+0.001},{lat+0.001}"
        }

        try:
            response = self.client.get(LIWO_WMS, params=params)

            if response.status_code == 200:
                try:
                    data = response.json()
                    features = data.get("features", [])

                    if features:
                        props = features[0].get("properties", {})
                        depth = props.get("waterdiepte") or props.get("GRAY_INDEX")

                        if depth is not None:
                            # Classify flood risk
                            if depth > 2.0:
                                risk_level = "high"
                                warning = "This area can experience flooding over 2 meters deep"
                            elif depth > 0.5:
                                risk_level = "medium"
                                warning = "This area can experience moderate flooding (0.5-2m)"
                            elif depth > 0:
                                risk_level = "low"
                                warning = "This area can experience minor flooding (< 0.5m)"
                            else:
                                risk_level = "minimal"
                                warning = None

                            return {
                                "flood_depth_m": depth,
                                "risk_level": risk_level,
                                "warning": warning,
                                "source": "LIWO/RWS"
                            }

                    return {"flood_depth_m": None, "risk_level": "unknown", "source": "LIWO"}

                except json.JSONDecodeError:
                    # Response might not be JSON
                    return None

            return None

        except Exception as e:
            log.warning(f"Could not check flood risk for point: {e}")
            return None

    def get_flood_risk_summary(self) -> Dict:
        """
        Get general flood risk information for the Netherlands.

        Returns:
            Summary of flood risk in NL
        """
        return {
            "country_overview": {
                "flood_prone_pct": 58,
                "description": "58% of the Netherlands can flood from sea, lakes, or rivers",
                "population_at_risk": "Around 9 million people live in flood-prone areas"
            },
            "risk_categories": {
                "primary_defenses": {
                    "description": "Areas protected by primary flood defenses (dijken)",
                    "risk": "Very low probability, but potentially severe consequences"
                },
                "regional_defenses": {
                    "description": "Areas with regional flood defenses",
                    "risk": "Higher probability of smaller floods"
                },
                "unprotected": {
                    "description": "Areas outside flood defense systems",
                    "risk": "Higher flood probability during extreme weather"
                }
            },
            "flood_types": {
                "river": "River flooding from Rhine, Maas, IJssel",
                "coastal": "Sea flooding and storm surge",
                "rainfall": "Heavy rainfall causing local flooding (wateroverlast)",
                "groundwater": "Rising groundwater, especially in polder areas"
            },
            "climate_change_impact": {
                "sea_level_rise": "Expected +0.3 to +1.0m by 2100",
                "extreme_rainfall": "More frequent and intense rainfall events",
                "river_discharge": "Higher peak river discharges"
            },
            "recommendations": {
                "high_risk_area": [
                    "Check historical flood events in the area",
                    "Verify flood insurance coverage",
                    "Consider ground floor vs. upper floor apartments",
                    "Check municipality flood emergency plans"
                ],
                "all_areas": [
                    "Know your evacuation route",
                    "Understand local water authority (waterschap) plans",
                    "Consider basement/kelder flood risk"
                ]
            },
            "resources": {
                "overstroomik": "https://www.overstroomik.nl/",
                "risicokaart": "https://www.risicokaart.nl/",
                "klimaateffectatlas": "https://www.klimaateffectatlas.nl/",
                "liwo": "https://basisinformatie-overstromingen.nl/liwo/"
            }
        }

    def get_wms_endpoints(self) -> Dict:
        """
        Get available WMS endpoints for map integration.

        Returns:
            Dict of WMS endpoints and layer names
        """
        return {
            "liwo": {
                "endpoint": LIWO_WMS,
                "layers": [
                    "waterdiepte_primair",
                    "waterdiepte_regionaal",
                    "stroomsnelheid_primair"
                ],
                "description": "Flood depth and flow velocity from national system"
            },
            "klimaateffectatlas": {
                "endpoint": KLIMAAT_WMS,
                "layers": [
                    "overstromingsdiepte"
                ],
                "description": "Climate effect atlas - flood depth scenarios"
            },
            "risicokaart": {
                "endpoint": RISICOKAART_WMS,
                "layers": [
                    "overstromingsgebieden"
                ],
                "description": "Risk map flood zones"
            },
            "ahn": {
                "endpoint": AHN_WMS,
                "layers": [
                    "ahn4_dtm_5m"
                ],
                "description": "Elevation data (Digital Terrain Model)"
            }
        }

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/flood_risk.json",
    help="Output JSON file"
)
@click.option(
    "--check-services/--no-check-services",
    default=True,
    help="Check if WMS services are available"
)
def main(output: str, check_services: bool):
    """
    Download flood risk data and WMS endpoint information.

    Flood risk is important in the Netherlands:
    - 58% of NL can flood from sea, rivers, or lakes
    - Climate change increasing risk
    - Most areas protected by dijken (levees)
    - But consequences can be severe if defenses fail

    Examples:
        python -m ingest.flood_risk
        python -m ingest.flood_risk --no-check-services

    Data will be used for:
    - Map overlays showing flood depth
    - Point queries for property flood risk
    - Climate adaptation information
    """
    log.info("=== Flood Risk Data Ingestion ===")
    log.info("58% of the Netherlands can flood from sea, rivers, or lakes")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with FloodRiskClient() as client:
        # Get WMS endpoints for map integration
        log.info("Collecting WMS endpoint information...")
        wms_endpoints = client.get_wms_endpoints()

        # Get general flood risk summary
        log.info("Compiling flood risk summary...")
        risk_summary = client.get_flood_risk_summary()

        # Check if services are available
        service_status = {}
        if check_services:
            log.info("Checking WMS service availability...")

            liwo_caps = client.get_liwo_capabilities()
            if liwo_caps:
                service_status["liwo"] = liwo_caps
                log.success(f"LIWO: {len(liwo_caps.get('layers', []))} layers available")
            else:
                service_status["liwo"] = {"status": "unavailable"}
                log.warning("LIWO service check failed")

    # Compile result
    result = {
        "metadata": {
            "source": "LIWO, Klimaateffectatlas, Risicokaart (Dutch Government)",
            "downloaded_at": datetime.utcnow().isoformat(),
            "description": "Flood risk information for the Netherlands",
            "license": "Open Data / CC0"
        },
        "wms_endpoints": wms_endpoints,
        "service_status": service_status,
        "risk_summary": risk_summary,
        "netherlands_context": {
            "below_sea_level_provinces": BELOW_SEA_LEVEL_PROVINCES,
            "lowest_point": {
                "location": "Zuidplaspolder, near Rotterdam",
                "elevation_m": -6.76
            },
            "flood_defense_system": "Delta Works + 17,500 km of levees (dijken)"
        }
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved flood risk data to {output_path}")

    # Summary
    log.info("\n=== Flood Risk Resources ===")
    log.info("- Overstroomik.nl: Check if your address floods")
    log.info("- Risicokaart.nl: National risk map")
    log.info("- Klimaateffectatlas.nl: Climate change impact maps")
    log.info("- LIWO: Professional flood information system")

    log.info("\n=== For Map Integration ===")
    log.info("Use WMS endpoints to overlay flood risk on map:")
    for name, info in wms_endpoints.items():
        log.info(f"  {name}: {info['endpoint']}")

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"\nFile size: {file_size_kb:.1f} KB")


if __name__ == "__main__":
    main()
