"""
Noise Pollution (Geluidshinder) data ingestion.

Downloads noise pollution data from Atlas Leefomgeving (RIVM).
Important for quality of life assessment.

Data sources:
- Atlas Leefomgeving (RIVM) - Noise maps
- END (Environmental Noise Directive) data

Types of noise:
- Road traffic (wegverkeer)
- Rail traffic (spoorwegen)
- Aircraft (luchtvaart)
- Industry (industrie)
- Wind turbines (windturbines)

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

# Atlas Leefomgeving WMS/WFS endpoints (RIVM)
# Source: https://www.atlasleefomgeving.nl/
ATLAS_LEEFOMGEVING_WMS = "https://data.rivm.nl/geo/alo/wms"
ATLAS_LEEFOMGEVING_WFS = "https://data.rivm.nl/geo/alo/wfs"

# Specific noise layer endpoints
NOISE_LAYERS = {
    "road_lden": "geluid_wegverkeer_lden",  # Road traffic - day-evening-night average
    "road_lnight": "geluid_wegverkeer_lnight",  # Road traffic - night
    "rail_lden": "geluid_spoorwegen_lden",  # Rail traffic - day-evening-night average
    "rail_lnight": "geluid_spoorwegen_lnight",  # Rail traffic - night
    "aircraft_lden": "geluid_luchtvaart_lden",  # Aircraft - day-evening-night average
    "industry_lden": "geluid_industrie_lden",  # Industry - day-evening-night average
    "combined_lden": "geluid_cumulatief_lden",  # Combined noise - all sources
}

# Noise level thresholds (dB Lden)
# Based on WHO guidelines and EU Environmental Noise Directive
NOISE_THRESHOLDS = {
    "excellent": {"max_db": 50, "description": "Quiet residential area"},
    "good": {"max_db": 55, "description": "Acceptable noise level"},
    "moderate": {"max_db": 60, "description": "Some noise noticeable"},
    "loud": {"max_db": 65, "description": "Noticeable noise, may affect sleep"},
    "very_loud": {"max_db": 70, "description": "Significant noise exposure"},
    "extreme": {"max_db": 999, "description": "High noise exposure, health risks"},
}


class NoisePollutionClient:
    """Client for noise pollution data."""

    def __init__(self, timeout: int = 120):
        """
        Initialize noise pollution client.

        Args:
            timeout: HTTP request timeout
        """
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WhereToLiveNL/1.0 (Noise Pollution Data Collection)",
                "Accept": "application/json, */*",
            }
        )

    def get_noise_at_point(self, lat: float, lng: float, layer: str = "combined_lden") -> Optional[Dict]:
        """
        Get noise level at a specific point using WMS GetFeatureInfo.

        Args:
            lat: Latitude (WGS84)
            lng: Longitude (WGS84)
            layer: Noise layer to query (default: combined)

        Returns:
            Noise level info if available
        """
        layer_name = NOISE_LAYERS.get(layer, NOISE_LAYERS["combined_lden"])

        # WMS GetFeatureInfo request
        params = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": layer_name,
            "query_layers": layer_name,
            "info_format": "application/json",
            "crs": "EPSG:4326",
            "width": "100",
            "height": "100",
            "i": "50",
            "j": "50",
            "bbox": f"{lng-0.0005},{lat-0.0005},{lng+0.0005},{lat+0.0005}"
        }

        try:
            response = self.client.get(ATLAS_LEEFOMGEVING_WMS, params=params)

            if response.status_code == 200:
                try:
                    data = response.json()
                    features = data.get("features", [])

                    if features:
                        props = features[0].get("properties", {})
                        noise_db = props.get("GRAY_INDEX") or props.get("value") or props.get("lden")

                        if noise_db is not None:
                            # Classify noise level
                            category = self._classify_noise(noise_db)

                            return {
                                "noise_db_lden": noise_db,
                                "category": category["name"],
                                "description": category["description"],
                                "health_impact": self._get_health_impact(noise_db),
                                "source": "Atlas Leefomgeving/RIVM"
                            }

                    return {"noise_db_lden": None, "category": "unknown", "source": "Atlas Leefomgeving"}

                except json.JSONDecodeError:
                    return None

            return None

        except Exception as e:
            log.warning(f"Could not check noise level for point: {e}")
            return None

    def _classify_noise(self, db_level: float) -> Dict:
        """Classify noise level into categories."""
        for name, info in NOISE_THRESHOLDS.items():
            if db_level <= info["max_db"]:
                return {"name": name, "description": info["description"]}
        return {"name": "extreme", "description": "Very high noise exposure"}

    def _get_health_impact(self, db_level: float) -> Dict:
        """Get health impact information based on noise level."""
        if db_level < 50:
            return {
                "sleep": "No impact",
                "cardiovascular": "No increased risk",
                "annoyance": "Low",
                "overall": "Safe noise environment"
            }
        elif db_level < 55:
            return {
                "sleep": "Minor disturbance possible",
                "cardiovascular": "No significant risk",
                "annoyance": "Low to moderate",
                "overall": "Generally acceptable"
            }
        elif db_level < 60:
            return {
                "sleep": "Some sleep disturbance",
                "cardiovascular": "Slight increased risk",
                "annoyance": "Moderate",
                "overall": "Consider noise insulation"
            }
        elif db_level < 65:
            return {
                "sleep": "Sleep quality affected",
                "cardiovascular": "Moderate increased risk",
                "annoyance": "Significant",
                "overall": "Noise mitigation recommended"
            }
        elif db_level < 70:
            return {
                "sleep": "Significant sleep disturbance",
                "cardiovascular": "Higher risk",
                "annoyance": "High",
                "overall": "Consider location carefully"
            }
        else:
            return {
                "sleep": "Severe sleep disturbance likely",
                "cardiovascular": "Significant health risk",
                "annoyance": "Very high",
                "overall": "High noise area - consider alternatives"
            }

    def get_wms_capabilities(self) -> Optional[Dict]:
        """
        Get Atlas Leefomgeving WMS capabilities.

        Returns:
            Capabilities info
        """
        params = {
            "service": "WMS",
            "request": "GetCapabilities",
            "version": "1.3.0"
        }

        try:
            response = self.client.get(ATLAS_LEEFOMGEVING_WMS, params=params)
            response.raise_for_status()

            # Basic check - if we get XML response, service is working
            if "<WMS_Capabilities" in response.text or "<WMT_MS_Capabilities" in response.text:
                return {
                    "endpoint": ATLAS_LEEFOMGEVING_WMS,
                    "status": "available",
                    "available_layers": list(NOISE_LAYERS.keys())
                }

            return None

        except Exception as e:
            log.warning(f"Could not fetch Atlas Leefomgeving capabilities: {e}")
            return None

    def get_wms_endpoints(self) -> Dict:
        """
        Get available WMS endpoints for map integration.

        Returns:
            Dict of WMS endpoints and layer names
        """
        return {
            "atlas_leefomgeving": {
                "endpoint": ATLAS_LEEFOMGEVING_WMS,
                "layers": NOISE_LAYERS,
                "description": "Noise maps from RIVM Atlas Leefomgeving"
            }
        }

    def get_noise_info_summary(self) -> Dict:
        """
        Get general noise information for the Netherlands.

        Returns:
            Summary of noise pollution info
        """
        return {
            "measurement_units": {
                "Lden": "Day-evening-night weighted average (dB) - most common measure",
                "Lnight": "Night-time average (23:00-07:00) - relevant for sleep",
                "Lday": "Daytime average (07:00-19:00)",
                "Levening": "Evening average (19:00-23:00)"
            },
            "noise_sources": {
                "road_traffic": "Cars, trucks, motorcycles - most common source",
                "rail": "Trains, trams, metros",
                "aircraft": "Airports (Schiphol, Eindhoven, Rotterdam, etc.)",
                "industry": "Factories, power plants, etc.",
                "wind_turbines": "Growing source near wind farms"
            },
            "thresholds": NOISE_THRESHOLDS,
            "legal_limits_nl": {
                "new_housing_road": "48 dB Lden (preference), 53 dB max",
                "new_housing_rail": "55 dB Lden max",
                "new_housing_air": "Varies by airport zone"
            },
            "tips_for_buyers": [
                "Check noise maps before purchasing",
                "Visit property at different times of day",
                "Check for double glazing (dubbel glas)",
                "Ask about noise insulation rating (Rw value)",
                "Consider bedroom location relative to noise source",
                "Check municipality for planned infrastructure"
            ],
            "schiphol_impact": {
                "description": "Schiphol airport affects large parts of Noord-Holland",
                "affected_areas": ["Amsterdam", "Amstelveen", "Aalsmeer", "Haarlemmermeer", "Uithoorn"],
                "resource": "https://www.schiphol.nl/nl/luchthaven-en-omgeving/"
            },
            "resources": {
                "atlas_leefomgeving": "https://www.atlasleefomgeving.nl/geluid-in-je-omgeving",
                "who_guidelines": "https://www.who.int/publications/i/item/9789241550253",
                "rivm_geluid": "https://www.rivm.nl/geluid"
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
    default="../../data/raw/noise_pollution.json",
    help="Output JSON file"
)
@click.option(
    "--check-services/--no-check-services",
    default=True,
    help="Check if WMS services are available"
)
def main(output: str, check_services: bool):
    """
    Download noise pollution data and WMS endpoint information.

    Noise pollution affects quality of life:
    - Sleep quality
    - Cardiovascular health
    - Mental health
    - Property values

    Sources of noise in NL:
    - Road traffic (most common)
    - Rail/train traffic
    - Aircraft (especially near Schiphol)
    - Industry
    - Wind turbines

    Examples:
        python -m ingest.noise_pollution
        python -m ingest.noise_pollution --no-check-services

    Data will be used for:
    - Map overlays showing noise levels
    - Point queries for property noise assessment
    - Health impact information
    """
    log.info("=== Noise Pollution Data Ingestion ===")
    log.info("Noise significantly affects quality of life and health")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with NoisePollutionClient() as client:
        # Get WMS endpoints for map integration
        log.info("Collecting WMS endpoint information...")
        wms_endpoints = client.get_wms_endpoints()

        # Get general noise info
        log.info("Compiling noise pollution information...")
        noise_summary = client.get_noise_info_summary()

        # Check if services are available
        service_status = {}
        if check_services:
            log.info("Checking WMS service availability...")

            caps = client.get_wms_capabilities()
            if caps:
                service_status["atlas_leefomgeving"] = caps
                log.success("Atlas Leefomgeving WMS: Available")
            else:
                service_status["atlas_leefomgeving"] = {"status": "unavailable"}
                log.warning("Atlas Leefomgeving service check failed")

    # Compile result
    result = {
        "metadata": {
            "source": "Atlas Leefomgeving (RIVM/Ministry of Infrastructure)",
            "downloaded_at": datetime.utcnow().isoformat(),
            "description": "Noise pollution information for the Netherlands",
            "license": "Open Data / CC0"
        },
        "wms_endpoints": wms_endpoints,
        "noise_layers": NOISE_LAYERS,
        "service_status": service_status,
        "noise_summary": noise_summary,
        "thresholds": NOISE_THRESHOLDS
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved noise pollution data to {output_path}")

    # Summary
    log.info("\n=== Noise Level Thresholds ===")
    for level, info in NOISE_THRESHOLDS.items():
        log.info(f"  {level}: <{info['max_db']} dB - {info['description']}")

    log.info("\n=== Available Noise Layers ===")
    for layer_id, layer_name in NOISE_LAYERS.items():
        log.info(f"  {layer_id}: {layer_name}")

    log.info("\n=== For Map Integration ===")
    log.info(f"WMS Endpoint: {ATLAS_LEEFOMGEVING_WMS}")
    log.info("Use any noise layer for overlay on MapLibre/Leaflet")

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"\nFile size: {file_size_kb:.1f} KB")


if __name__ == "__main__":
    main()
