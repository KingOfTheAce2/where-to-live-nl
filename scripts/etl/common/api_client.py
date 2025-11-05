"""Reusable HTTP client with retry logic."""

import httpx
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from .logger import log

class APIClient:
    """HTTP client with rate limiting and retry logic."""

    def __init__(
        self,
        base_url: str,
        timeout: int = 30,
        rate_limit: float = 1.0,
        max_retries: int = 5
    ):
        """
        Initialize API client.

        Args:
            base_url: Base URL for API
            timeout: Request timeout in seconds
            rate_limit: Requests per second
            max_retries: Maximum retry attempts
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.rate_limit = rate_limit
        self.max_retries = max_retries

        self.client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            headers={
                "User-Agent": "where-to-live-nl/1.0 (https://github.com/yourusername/where-to-live-nl)"
            }
        )

    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException))
    )
    def get(self, endpoint: str, **kwargs) -> httpx.Response:
        """
        GET request with automatic retries.

        Args:
            endpoint: API endpoint (relative to base_url)
            **kwargs: Additional arguments for httpx.get

        Returns:
            httpx.Response object

        Raises:
            httpx.HTTPStatusError: If request fails after retries
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        log.debug(f"GET {url}")

        try:
            response = self.client.get(endpoint, **kwargs)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            log.error(f"HTTP error {e.response.status_code}: {url}")
            raise
        except httpx.TimeoutException:
            log.error(f"Request timeout: {url}")
            raise

    def get_json(self, endpoint: str, **kwargs) -> dict | list:
        """
        GET request that returns JSON.

        Args:
            endpoint: API endpoint
            **kwargs: Additional arguments

        Returns:
            Parsed JSON response
        """
        response = self.get(endpoint, **kwargs)
        return response.json()

    def close(self):
        """Close HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
