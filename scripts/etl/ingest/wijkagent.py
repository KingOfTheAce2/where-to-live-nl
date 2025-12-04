"""
Wijkagent (Neighborhood Police Officer) scraper for politie.nl

This script scrapes wijkagent contact information from politie.nl
using coordinates or postal codes.

The wijkagent is a neighborhood police officer in the Netherlands who is
responsible for maintaining safety and building relationships with residents
in a specific area.
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
import httpx
from datetime import datetime
import polars as pl

# Base URL for politie.nl wijkagent search
POLITIE_BASE_URL = "https://www.politie.nl"
WIJKAGENT_SEARCH_URL = f"{POLITIE_BASE_URL}/mijn-buurt/wijkagenten"

# Output paths
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(exist_ok=True, parents=True)
WIJKAGENT_OUTPUT = DATA_DIR / "wijkagenten.json"

# Rate limiting
RATE_LIMIT_DELAY = 2  # seconds between requests


class WijkagentScraper:
    """Scraper for wijkagent information from politie.nl"""

    def __init__(self):
        self.client = None
        self.wijkagenten = []
        self.scraped_areas = set()

    async def init_client(self):
        """Initialize HTTP client with proper headers"""
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
                "Referer": WIJKAGENT_SEARCH_URL,
                "X-Requested-With": "XMLHttpRequest"
            },
            follow_redirects=True
        )

    async def close_client(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()

    async def search_by_coordinates(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        Search for wijkagenten by GPS coordinates.

        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Search radius in kilometers

        Returns:
            List of wijkagent data dictionaries
        """
        if not self.client:
            await self.init_client()

        # The API endpoint structure (may need adjustment based on actual politie.nl API)
        # This is based on typical patterns, may need reverse engineering
        try:
            # Try the search endpoint
            search_url = f"{POLITIE_BASE_URL}/api/v1/wijkagenten/search"

            params = {
                "lat": lat,
                "lng": lng,
                "radius": radius_km * 1000,  # Convert to meters
            }

            response = await self.client.get(search_url, params=params)

            if response.status_code == 200:
                data = response.json()
                return self.parse_wijkagent_response(data)
            else:
                print(f"⚠️ API returned {response.status_code} for {lat},{lng}")
                # Fallback: try web scraping
                return await self.scrape_from_webpage(lat, lng)

        except Exception as e:
            print(f"❌ Error searching by coordinates {lat},{lng}: {e}")
            return []

    async def scrape_from_webpage(
        self,
        lat: float,
        lng: float
    ) -> List[Dict[str, Any]]:
        """
        Fallback method: scrape from the actual webpage.

        This method loads the webpage and extracts structured data
        if it's embedded in the HTML.
        """
        try:
            # Load the search page with coordinates
            search_url = f"{WIJKAGENT_SEARCH_URL}?lat={lat}&lng={lng}"

            response = await self.client.get(search_url)
            html = response.text

            # Look for JSON-LD structured data or embedded JSON
            # Many Dutch government sites embed data in script tags
            import re

            # Try to find JSON-LD schema
            json_ld_pattern = r'<script type="application/ld\+json">(.*?)</script>'
            json_ld_matches = re.findall(json_ld_pattern, html, re.DOTALL)

            for match in json_ld_matches:
                try:
                    data = json.loads(match)
                    if "Person" in str(data) or "wijkagent" in str(data).lower():
                        return [self.parse_structured_data(data)]
                except:
                    continue

            # Try to find embedded window.initialData or similar
            initial_data_pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?});'
            initial_data_match = re.search(initial_data_pattern, html, re.DOTALL)

            if initial_data_match:
                try:
                    data = json.loads(initial_data_match.group(1))
                    if "wijkagenten" in data:
                        return self.parse_wijkagent_response(data["wijkagenten"])
                except:
                    pass

            print(f"⚠️ Could not extract wijkagent data from webpage for {lat},{lng}")
            return []

        except Exception as e:
            print(f"❌ Error scraping webpage: {e}")
            return []

    def parse_wijkagent_response(self, data: Any) -> List[Dict[str, Any]]:
        """Parse API response into standardized format"""
        results = []

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict) and "items" in data:
            items = data["items"]
        elif isinstance(data, dict) and "results" in data:
            items = data["results"]
        else:
            items = [data] if data else []

        for item in items:
            wijkagent = self.extract_wijkagent_info(item)
            if wijkagent:
                results.append(wijkagent)

        return results

    def extract_wijkagent_info(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract wijkagent information from raw data"""
        try:
            # Extract common fields (adjust based on actual API structure)
            wijkagent = {
                "name": data.get("name") or data.get("naam"),
                "rank": data.get("rank") or data.get("rang"),
                "email": data.get("email") or data.get("e-mail"),
                "phone": data.get("phone") or data.get("telefoon"),
                "area": data.get("area") or data.get("gebied") or data.get("wijk"),
                "municipality": data.get("municipality") or data.get("gemeente"),
                "team": data.get("team"),
                "photo_url": data.get("photo") or data.get("foto"),
                "description": data.get("description") or data.get("omschrijving"),
                "coordinates": {
                    "lat": data.get("lat") or data.get("latitude"),
                    "lng": data.get("lng") or data.get("longitude")
                },
                "scraped_at": datetime.now().isoformat()
            }

            # Only return if we have at least a name
            if wijkagent["name"]:
                return wijkagent

            return None

        except Exception as e:
            print(f"⚠️ Error extracting wijkagent info: {e}")
            return None

    def parse_structured_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse JSON-LD structured data"""
        return {
            "name": data.get("name"),
            "email": data.get("email"),
            "telephone": data.get("telephone"),
            "jobTitle": data.get("jobTitle", "Wijkagent"),
            "description": data.get("description"),
            "scraped_at": datetime.now().isoformat()
        }

    async def scrape_major_cities(self):
        """Scrape wijkagent info for major Dutch cities"""
        # Major city centers with coordinates
        cities = [
            {"name": "Amsterdam", "lat": 52.3676, "lng": 4.9041},
            {"name": "Rotterdam", "lat": 51.9225, "lng": 4.47917},
            {"name": "Den Haag", "lat": 52.0705, "lng": 4.3007},
            {"name": "Utrecht", "lat": 52.0907, "lng": 5.1214},
            {"name": "Eindhoven", "lat": 51.4416, "lng": 5.4697},
            {"name": "Groningen", "lat": 53.2194, "lng": 6.5665},
            {"name": "Tilburg", "lat": 51.5555, "lng": 5.0913},
            {"name": "Almere", "lat": 52.3508, "lng": 5.2647},
            {"name": "Breda", "lat": 51.5719, "lng": 4.7683},
            {"name": "Nijmegen", "lat": 51.8126, "lng": 5.8372},
        ]

        print(f"🚔 Scraping wijkagent information for {len(cities)} major cities...")

        for city in cities:
            print(f"\n📍 Searching {city['name']}...")

            results = await self.search_by_coordinates(
                city["lat"],
                city["lng"],
                radius_km=10  # 10km radius for city coverage
            )

            for wijkagent in results:
                wijkagent["city"] = city["name"]
                self.wijkagenten.append(wijkagent)
                print(f"  ✓ Found: {wijkagent.get('name', 'Unknown')}")

            # Rate limiting
            await asyncio.sleep(RATE_LIMIT_DELAY)

        print(f"\n✅ Total wijkagenten found: {len(self.wijkagenten)}")

    def save_results(self):
        """Save scraped results to JSON file"""
        output_data = {
            "metadata": {
                "scraped_at": datetime.now().isoformat(),
                "source": "politie.nl",
                "total_count": len(self.wijkagenten),
                "note": "Wijkagent contact information for major Dutch cities"
            },
            "data": self.wijkagenten
        }

        with open(WIJKAGENT_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Saved to: {WIJKAGENT_OUTPUT}")

    async def run(self):
        """Main execution"""
        try:
            await self.init_client()
            await self.scrape_major_cities()
            self.save_results()
        finally:
            await self.close_client()


async def main():
    """Main entry point"""
    scraper = WijkagentScraper()
    await scraper.run()


if __name__ == "__main__":
    print("🚔 Wijkagent Scraper")
    print("=" * 50)
    print("Scraping neighborhood police officer information")
    print("from politie.nl for major Dutch cities")
    print("=" * 50)
    print()

    asyncio.run(main())
