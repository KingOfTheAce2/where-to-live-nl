"""
Download foundation risk data from KCAF via PDOK WFS service.

This script downloads indicative foundation risk areas (aandachtsgebieden funderingsproblematiek)
from the PDOK WFS service provided by KCAF.

Data source: https://www.pdok.nl/ogc-webservices/-/article/indicatieve-aandachtsgebieden-funderingsproblematiek
"""

import requests
import json
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"
OUTPUT_FILE = DATA_DIR / "foundation_risk.json"

# PDOK WFS endpoint for foundation risk data
WFS_URL = "https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0"

def download_foundation_risk_data():
    """
    Download foundation risk data from PDOK WFS service.

    Returns GeoJSON with foundation risk areas.
    """

    print("Downloading foundation risk data from KCAF/PDOK...")
    print(f"WFS URL: {WFS_URL}")
    print()

    # WFS GetFeature request parameters
    params = {
        'service': 'WFS',
        'version': '2.0.0',
        'request': 'GetFeature',
        'typeName': 'indgebfunderingsproblematiek',
        'outputFormat': 'application/json',
        'srsName': 'EPSG:4326'  # Request WGS84 coordinates
    }

    try:
        print("Requesting foundation risk areas...")
        response = requests.get(WFS_URL, params=params, timeout=60)
        response.raise_for_status()

        data = response.json()

        # Check if we got features
        if 'features' not in data:
            print("ERROR: No features in response")
            print(f"Response: {data}")
            return None

        num_features = len(data.get('features', []))
        print(f"SUCCESS: Downloaded {num_features} foundation risk areas")

        # Save to file
        print(f"Saving to {OUTPUT_FILE}...")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print("COMPLETE!")
        print()
        print("=" * 60)
        print(f"Foundation risk data saved to: {OUTPUT_FILE}")
        print(f"Total risk areas: {num_features}")
        print("=" * 60)

        return data

    except requests.exceptions.RequestException as e:
        print(f"ERROR downloading data: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"ERROR parsing JSON response: {e}")
        return None


if __name__ == "__main__":
    download_foundation_risk_data()
