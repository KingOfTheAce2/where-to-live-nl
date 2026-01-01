"""
Ruimtelijke Plannen (Spatial Plans / Zoning) - Link Generator.

Generates links to ruimtelijkeplannen.nl for a specific location.
NOT pre-ingested because:
- Constantly updated (plans change frequently)
- Complex nested data structure
- Official website has the authoritative/legal information

This module just helps users find the right page.

License: Open Data / Public Domain
"""

from typing import Dict


def get_ruimtelijke_plannen_url(lat: float, lng: float) -> Dict:
    """
    Generate URL to view zoning/bestemmingsplan for a location.

    Args:
        lat: Latitude (WGS84)
        lng: Longitude (WGS84)

    Returns:
        Dictionary with URLs and info
    """
    # Ruimtelijkeplannen.nl accepts coordinates in the URL
    # Format: https://www.ruimtelijkeplannen.nl/viewer/viewer?x=lng&y=lat

    viewer_url = f"https://www.ruimtelijkeplannen.nl/viewer/view?locatie={lat},{lng}"

    return {
        "url": viewer_url,
        "source": "ruimtelijkeplannen.nl",
        "note": "Official government portal for zoning and spatial plans",
        "what_to_check": [
            "Bestemming (zoning designation)",
            "Bouwvlak (building envelope)",
            "Maximum building height",
            "Allowed uses (wonen, kantoor, etc.)",
            "Any planned changes (ontwerp bestemmingsplannen)"
        ],
        "important": "Zoning determines what you can do with the property. Always verify before purchase."
    }


def get_zoning_info_for_snapshot(lat: float, lng: float) -> Dict:
    """
    Get zoning info for inclusion in property snapshot.

    Returns link to official source rather than trying to parse complex zoning data.
    """
    return {
        "available": True,
        "check_url": f"https://www.ruimtelijkeplannen.nl/viewer/view?locatie={lat},{lng}",
        "source": "ruimtelijkeplannen.nl (official)",
        "note": "Click link to view official zoning designation and building rules",
        "data_type": "external_link"
    }


if __name__ == "__main__":
    # Example usage
    lat, lng = 52.3676, 4.9041  # Amsterdam
    result = get_ruimtelijke_plannen_url(lat, lng)
    print(f"Zoning URL: {result['url']}")
    print(f"What to check: {', '.join(result['what_to_check'])}")
