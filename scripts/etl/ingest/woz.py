"""
WOZ (Waardering Onroerende Zaken) value scraper.

Retrieves property valuations from wozwaardeloket.nl API based on BAG addresses.
Fetches historical WOZ values from 2014 onwards.

Legal note: WOZ values are public information. Individual lookups are allowed.
We implement rate limiting (1 req/sec) to be respectful of the server.
"""

import json
import time
from pathlib import Path
from typing import Optional, List
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

WOZ_API_BASE = "https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1"
PDOK_SUGGEST_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest"
PDOK_LOOKUP_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup"

class WOZScraper:
    """Scraper for WOZ property valuations using the official API."""

    # Transient errors that should trigger a retry (VPN rotation, connection drops)
    RETRYABLE_ERRORS = (
        "Server disconnected",
        "WinError 10054",  # Connection forcibly closed
        "WinError 10053",  # Connection aborted
        "WinError 10013",  # Socket access denied (VPN switching)
        "Connection reset",
        "RemoteProtocolError",
    )

    def __init__(self, rate_limit: float = 1.0, max_retries: int = 3, retry_delay: float = 5.0):
        """
        Initialize WOZ scraper.

        Args:
            rate_limit: Requests per second (default: 1.0)
            max_retries: Number of retries for transient connection errors (default: 3)
            retry_delay: Seconds to wait before retry (default: 5.0)
        """
        self.rate_limit = rate_limit
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.last_request_time = 0

        self.client = httpx.Client(
            timeout=30,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            follow_redirects=True
        )

    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if error is transient and should be retried (e.g., VPN rotation)."""
        error_str = str(error)
        return any(err in error_str for err in self.RETRYABLE_ERRORS)

    def _request_with_retry(self, method: str, url: str, **kwargs):
        """Make HTTP request with retry logic for transient errors."""
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                if method == "get":
                    return self.client.get(url, **kwargs)
                else:
                    raise ValueError(f"Unsupported method: {method}")
            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries:
                    log.warning(f"Connection error (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                    log.info(f"Waiting {self.retry_delay}s for VPN to stabilize...")
                    time.sleep(self.retry_delay)
                    # Recreate client in case socket is stale
                    try:
                        self.client.close()
                    except:
                        pass
                    self.client = httpx.Client(
                        timeout=30,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        },
                        follow_redirects=True
                    )
                else:
                    raise
        raise last_error

    def _rate_limit_delay(self):
        """Enforce rate limiting."""
        elapsed = time.time() - self.last_request_time
        wait_time = (1.0 / self.rate_limit) - elapsed

        if wait_time > 0:
            time.sleep(wait_time)

        self.last_request_time = time.time()

    def _get_nummeraanduiding(
        self,
        postal_code: str,
        house_number: int,
        house_letter: str = ""
    ) -> Optional[str]:
        """
        Get nummeraanduiding ID for an address using PDOK API.

        Args:
            postal_code: Postal code (e.g., "1012AB")
            house_number: House number
            house_letter: House letter/addition (optional)

        Returns:
            Nummeraanduiding ID or None if not found
        """
        try:
            # Build address query
            address_query = f"{postal_code} {house_number}"
            if house_letter:
                address_query += house_letter

            # Step 1: Suggest address
            suggest_response = self._request_with_retry(
                "get",
                PDOK_SUGGEST_URL,
                params={"q": address_query}
            )
            suggest_response.raise_for_status()
            suggest_data = suggest_response.json()

            docs = suggest_data.get("response", {}).get("docs", [])
            if not docs:
                log.debug(f"No address suggestions found for {address_query}")
                return None

            # Filter for exact address match (type='adres')
            address_id = None
            for doc in docs:
                if doc.get("type") == "adres":
                    # Found an address type result
                    address_id = doc["id"]
                    break

            if not address_id:
                log.debug(f"No exact address match found for {address_query}")
                return None

            # Step 2: Lookup full address details
            lookup_response = self._request_with_retry(
                "get",
                PDOK_LOOKUP_URL,
                params={"id": address_id}
            )
            lookup_response.raise_for_status()
            lookup_data = lookup_response.json()

            if not lookup_data.get("response", {}).get("docs"):
                log.debug(f"No lookup data found for address ID {address_id}")
                return None

            # Extract nummeraanduiding
            doc = lookup_data["response"]["docs"][0]
            nummeraanduiding = doc.get("nummeraanduiding_id")

            if not nummeraanduiding:
                log.debug(f"No nummeraanduiding found in lookup data. Doc keys: {doc.keys()}")
                return None

            log.debug(f"Found nummeraanduiding: {nummeraanduiding}")
            return nummeraanduiding

        except Exception as e:
            log.error(f"Error getting nummeraanduiding for {postal_code} {house_number}: {e}")
            return None

    def lookup_woz(
        self,
        postal_code: str,
        house_number: int,
        house_letter: str = ""
    ) -> Optional[dict]:
        """
        Look up WOZ values for an address (all historical years from 2014).

        Args:
            postal_code: Postal code (e.g., "1012AB")
            house_number: House number
            house_letter: House letter/addition (optional)

        Returns:
            Dictionary with WOZ data including all historical valuations, or None if not found
        """
        self._rate_limit_delay()

        try:
            log.debug(f"Looking up WOZ for {postal_code} {house_number}{house_letter}")

            # Step 1: Get nummeraanduiding
            nummeraanduiding = self._get_nummeraanduiding(
                postal_code,
                house_number,
                house_letter
            )

            if not nummeraanduiding:
                log.warning(f"Could not find nummeraanduiding for {postal_code} {house_number}")
                return None

            # Step 2: Fetch WOZ data from API
            woz_url = f"{WOZ_API_BASE}/wozwaarde/nummeraanduiding/{nummeraanduiding}"

            self._rate_limit_delay()  # Extra rate limit for WOZ API

            response = self._request_with_retry("get", woz_url)

            log.debug(f"WOZ API response status: {response.status_code}")
            log.debug(f"WOZ API URL: {woz_url}")

            response.raise_for_status()

            # Check if response has content
            if not response.text:
                log.warning(f"Empty response from WOZ API for {postal_code} {house_number}")
                return None

            try:
                woz_data = response.json()
            except Exception as json_err:
                log.error(f"Failed to parse JSON response. Status: {response.status_code}, Content: {response.text[:200]}")
                raise json_err

            # Step 3: Parse WOZ values and metadata
            woz_object = woz_data.get("wozObject", {})
            woz_waarden = woz_data.get("wozWaarden", [])

            if not woz_waarden:
                log.warning(f"No WOZ values found for {postal_code} {house_number}")
                return None

            # Extract all historical values
            valuations = []
            for waarde in woz_waarden:
                peildatum = waarde.get("peildatum")
                value = waarde.get("vastgesteldeWaarde")

                if peildatum and value:
                    valuations.append({
                        "valuation_date": peildatum,
                        "woz_value": value
                    })

            # Sort by date (oldest first)
            valuations.sort(key=lambda x: x["valuation_date"])

            # Extract additional WOZ object metadata
            result = {
                "postal_code": postal_code,
                "house_number": house_number,
                "house_letter": house_letter,
                "nummeraanduiding_id": nummeraanduiding,
                "valuations": valuations,
                "scraped_at": datetime.utcnow().isoformat()
            }

            # Add WOZ object metadata if available
            if woz_object:
                result["woz_object_nummer"] = woz_object.get("wozobjectnummer")
                result["adresseerbaar_object_id"] = woz_object.get("adresseerbaarobjectid")
                result["gebruiksdoel"] = woz_object.get("gebruiksdoel")
                result["oppervlakte"] = woz_object.get("grondoppervlakte")
                result["bouwjaar"] = woz_object.get("bouwjaar")
                result["gemeentecode"] = woz_object.get("gemeentecode")

            # Extract panden (buildings) if available
            panden = woz_data.get("panden", [])
            if panden and len(panden) > 0:
                # Get first pand
                pand = panden[0]
                result["bag_pand_id"] = pand.get("bagpandidentificatie")
                result["pand_bouwjaar"] = pand.get("oorspronkelijkbouwjaar")

            return result

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                log.debug(f"Address not found: {postal_code} {house_number}")
            elif e.response.status_code == 429:
                # Rate limited - need to back off significantly
                log.warning(f"Rate limited (429)! Backing off for 60 seconds...")
                time.sleep(60)
                # Don't return None - let the caller retry if needed
                return None
            else:
                log.error(f"HTTP error {e.response.status_code}: {postal_code} {house_number}")
            return None

        except Exception as e:
            log.error(f"Error fetching WOZ for {postal_code} {house_number}: {e}")
            return None

    def close(self):
        """Close HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

def load_checkpoint(checkpoint_path: Path) -> set[str]:
    """Load completed addresses from checkpoint."""
    if not checkpoint_path.exists():
        return set()

    with open(checkpoint_path, "r") as f:
        checkpoint = json.load(f)
        return set(checkpoint.get("completed", []))

def save_checkpoint(checkpoint_path: Path, completed: set[str]):
    """Save checkpoint of completed addresses."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    with open(checkpoint_path, "w") as f:
        json.dump({
            "completed": list(completed),
            "updated_at": datetime.utcnow().isoformat()
        }, f)

@click.command()
@click.option(
    "--input",
    type=click.Path(exists=True),
    default="../../data/raw/bag.json",
    help="Input BAG JSON file"
)
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/woz.json",
    help="Output WOZ JSON file"
)
@click.option(
    "--sample",
    type=int,
    help="Limit to N addresses for testing"
)
@click.option(
    "--rate-limit",
    type=float,
    default=1.0,
    help="Requests per second (default: 1.0)"
)
@click.option(
    "--resume",
    is_flag=True,
    help="Resume from checkpoint"
)
def main(
    input: str,
    output: str,
    sample: Optional[int],
    rate_limit: float,
    resume: bool
):
    """
    Fetch WOZ values for addresses in BAG dataset using the official API.

    Retrieves ALL historical WOZ values from 2014 onwards for each address.

    WARNING: This will take a LONG time for full dataset!
    - 8M addresses at 1 req/sec = ~92 days
    - Each request fetches ALL historical years (2014-2025)
    - Use --sample for testing

    Examples:
        # Test with 100 addresses
        python -m ingest.woz --sample 100

        # Full run (slow!)
        python -m ingest.woz

        # Resume interrupted run
        python -m ingest.woz --resume
    """
    log.info("=== WOZ Data Scraping ===")

    # Load BAG addresses
    input_path = Path(input)
    with open(input_path, "r") as f:
        addresses = json.load(f)

    log.info(f"Loaded {len(addresses)} addresses from {input_path}")

    # Apply sample limit
    if sample:
        addresses = addresses[:sample]
        log.info(f"Limited to {sample} addresses for testing")

    # Load checkpoint
    checkpoint_path = Path("../../data/checkpoints/woz_progress.json")
    completed = load_checkpoint(checkpoint_path) if resume else set()

    if completed:
        log.info(f"Resuming from checkpoint: {len(completed)} addresses already scraped")

    # Filter out completed addresses
    addresses_to_scrape = [
        addr for addr in addresses
        if f"{addr['postal_code']}_{addr['house_number']}" not in completed
    ]

    log.info(f"Addresses to scrape: {len(addresses_to_scrape)}")

    # Initialize scraper
    woz_results = []
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load existing results if resuming
    if resume and output_path.exists():
        with open(output_path, "r") as f:
            woz_results = json.load(f)
        log.info(f"Loaded {len(woz_results)} existing WOZ results")

    with WOZScraper(rate_limit=rate_limit) as scraper:
        # Estimate time
        estimated_hours = len(addresses_to_scrape) / rate_limit / 3600
        log.info(f"Estimated time: {estimated_hours:.1f} hours")

        # Scrape addresses
        for i, addr in enumerate(tqdm(addresses_to_scrape, desc="Scraping WOZ")):
            # Skip if no postal code
            if not addr.get("postal_code") or not addr.get("house_number"):
                continue

            # Lookup WOZ
            woz_data = scraper.lookup_woz(
                postal_code=addr["postal_code"],
                house_number=addr["house_number"],
                house_letter=addr.get("house_letter", "")
            )

            if woz_data:
                # Add BAG ID for joining
                woz_data["bag_id"] = addr.get("id")
                woz_results.append(woz_data)

            # Mark as completed
            addr_key = f"{addr['postal_code']}_{addr['house_number']}"
            completed.add(addr_key)

            # Save checkpoint every 1000 addresses
            if (i + 1) % 1000 == 0:
                save_checkpoint(checkpoint_path, completed)

                # Save intermediate results
                with open(output_path, "w") as f:
                    json.dump(woz_results, f, indent=2)

                log.info(f"Checkpoint saved: {len(woz_results)} WOZ values collected")

    # Save final results
    with open(output_path, "w") as f:
        json.dump(woz_results, f, indent=2)

    log.success(f"Scraped {len(woz_results)} WOZ values")
    log.success(f"Saved to {output_path}")
    log.info(f"Success rate: {len(woz_results) / len(addresses_to_scrape) * 100:.1f}%")

    # Clean up checkpoint
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        log.info("Checkpoint file deleted (run completed)")

if __name__ == "__main__":
    main()
