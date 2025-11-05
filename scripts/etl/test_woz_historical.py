"""
Test script for historical WOZ data retrieval.

Tests the new API-based scraper with a single address to verify:
1. nummeraanduiding lookup works
2. All historical WOZ values (2014+) are retrieved
3. Data structure is correct
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ingest.woz import WOZScraper
from common.logger import log
import json
from loguru import logger

# Enable debug logging
logger.remove()  # Remove default handler
logger.add(sys.stderr, level="DEBUG")  # Add debug level handler

def test_single_address():
    """Test WOZ lookup for a single address in Amsterdam."""

    # Test address: Keizersgracht 1, Amsterdam (confirmed to have WOZ data)
    test_address = {
        "postal_code": "1015CN",
        "house_number": 1,
        "house_letter": ""
    }

    log.info("=== Testing Historical WOZ Data Retrieval ===")
    log.info(f"Test address: {test_address['postal_code']} {test_address['house_number']}")

    with WOZScraper(rate_limit=1.0) as scraper:
        result = scraper.lookup_woz(
            postal_code=test_address["postal_code"],
            house_number=test_address["house_number"],
            house_letter=test_address["house_letter"]
        )

        if result:
            log.success("✓ WOZ data retrieved successfully!")

            # Display results
            log.info(f"\nNummeraanduiding ID: {result['nummeraanduiding_id']}")
            log.info(f"Scraped at: {result['scraped_at']}")

            valuations = result.get("valuations", [])
            log.info(f"\n📊 Found {len(valuations)} historical valuations:")

            if valuations:
                print("\nYear    WOZ Value")
                print("-" * 25)
                for val in valuations:
                    year = val["valuation_date"].split("-")[0]
                    value = f"€ {val['woz_value']:,}"
                    print(f"{year}    {value}")

                # Calculate growth
                if len(valuations) >= 2:
                    first_val = valuations[0]["woz_value"]
                    last_val = valuations[-1]["woz_value"]
                    growth = ((last_val - first_val) / first_val) * 100

                    first_year = valuations[0]["valuation_date"].split("-")[0]
                    last_year = valuations[-1]["valuation_date"].split("-")[0]

                    log.info(f"\n📈 Growth from {first_year} to {last_year}: {growth:+.1f}%")

                # Show complete JSON structure
                log.info("\n📄 Complete JSON structure:")
                print(json.dumps(result, indent=2, ensure_ascii=False))

            else:
                log.warning("No valuations found in result!")

        else:
            log.error("✗ Failed to retrieve WOZ data")
            log.error("Check if the address exists or if there are API issues")

if __name__ == "__main__":
    test_single_address()
