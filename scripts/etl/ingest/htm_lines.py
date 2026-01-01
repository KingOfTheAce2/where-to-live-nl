"""
HTM (Haagse Tramweg-Maatschappij) Tram & Bus Lines ingestion.

Downloads all HTM public transport lines with routes and stops.
Includes: tram, bus lines in The Hague region.

Data sources:
- OVapi (http://v0.ovapi.nl) - Real-time public transport data
- GTFS feeds from gtfs.ovapi.nl

License: Open Data
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import click
import httpx
from tqdm import tqdm

import sys
sys.path.append(str(Path(__file__).parent.parent))

from common.logger import log

OVAPI_BASE = "http://v0.ovapi.nl"
OVAPI_LINES = f"{OVAPI_BASE}/line/"
OVAPI_JOURNEY = f"{OVAPI_BASE}/journey/"


class HTMClient:
    """Client for HTM line data from OVapi."""

    def __init__(self, timeout: int = 60):
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 WhereToLiveNL/1.0",
                "Accept": "application/json",
            }
        )

    def get_all_lines(self) -> Dict:
        """Get all HTM lines from OVapi."""
        try:
            log.info("Fetching all lines from OVapi...")
            response = self.client.get(OVAPI_LINES)
            response.raise_for_status()

            all_lines = response.json()
            htm_lines = {k: v for k, v in all_lines.items() if 'HTM' in k}

            log.success(f"Found {len(htm_lines)} HTM line entries")
            return htm_lines

        except Exception as e:
            log.error(f"Error fetching lines: {e}")
            raise

    def get_line_stops(self, line_id: str) -> List[Dict]:
        """
        Get stops for a specific line journey pattern.

        Note: OVapi's journey endpoint provides stop sequences.
        """
        try:
            # Try to get journey pattern
            url = f"{OVAPI_BASE}/tpc/{line_id}"
            response = self.client.get(url)

            if response.status_code == 200:
                data = response.json()
                return list(data.values()) if data else []
            return []

        except Exception as e:
            log.debug(f"Could not get stops for {line_id}: {e}")
            return []

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def process_htm_lines(raw_lines: Dict) -> List[Dict]:
    """
    Process raw HTM line data into structured format.

    Args:
        raw_lines: Raw line data from OVapi

    Returns:
        List of processed line records
    """
    lines = {}

    for key, data in raw_lines.items():
        parts = key.split('_')
        if len(parts) < 2:
            continue

        line_num = parts[1]
        direction = parts[2] if len(parts) > 2 else '1'

        if line_num not in lines:
            lines[line_num] = {
                'line_number': line_num,
                'line_public_number': data.get('LinePublicNumber', line_num),
                'transport_type': data.get('TransportType', 'UNKNOWN'),
                'operator': 'HTM',
                'operator_code': data.get('DataOwnerCode', 'HTM'),
                'directions': [],
                'line_ids': []
            }

        # Add direction info
        dest = data.get('DestinationName50', '')
        if dest and dest not in [d.get('destination') for d in lines[line_num]['directions']]:
            lines[line_num]['directions'].append({
                'direction': direction,
                'destination': dest,
                'line_id': key
            })

        lines[line_num]['line_ids'].append(key)

    # Convert to list and sort by line number
    result = list(lines.values())
    result.sort(key=lambda x: int(x['line_number']) if x['line_number'].isdigit() else 999)

    return result


def classify_line_type(line: Dict) -> str:
    """Classify line as tram or bus based on line number and transport type."""
    transport = line.get('transport_type', '').upper()
    line_num = line.get('line_number', '')

    if transport == 'TRAM':
        return 'tram'
    elif transport == 'BUS':
        return 'bus'

    # HTM trams are typically lines 1-19
    if line_num.isdigit():
        num = int(line_num)
        if num <= 19:
            return 'tram'

    return 'bus'


@click.command()
@click.option(
    "--output",
    type=click.Path(),
    default="../../data/raw/htm_lines.json",
    help="Output JSON file"
)
@click.option(
    "--filter-type",
    type=click.Choice(["all", "tram", "bus"]),
    default="all",
    help="Filter by transport type"
)
@click.option(
    "--include-stops",
    is_flag=True,
    default=False,
    help="Include stop sequences (slower)"
)
def main(output: str, filter_type: str, include_stops: bool):
    """
    Download HTM tram and bus lines with routes.

    Downloads all HTM public transport lines from The Hague region.

    Examples:
        # All HTM lines
        python -m ingest.htm_lines

        # Only tram lines
        python -m ingest.htm_lines --filter-type tram

        # Include stop sequences (slower)
        python -m ingest.htm_lines --include-stops
    """
    log.info("=== HTM Lines Data Ingestion ===")

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with HTMClient() as client:
        # Get all HTM lines
        raw_lines = client.get_all_lines()

        # Process into structured format
        log.info("Processing line data...")
        lines = process_htm_lines(raw_lines)

        # Add line type classification
        for line in lines:
            line['line_type'] = classify_line_type(line)

        # Filter by type if requested
        if filter_type != "all":
            lines = [l for l in lines if l['line_type'] == filter_type]
            log.info(f"Filtered to {len(lines)} {filter_type} lines")

        # Optionally fetch stop sequences
        if include_stops:
            log.info("Fetching stop sequences (this may take a while)...")
            for line in tqdm(lines, desc="Fetching stops"):
                stops = []
                for line_id in line.get('line_ids', [])[:1]:  # Get first direction
                    stops = client.get_line_stops(line_id)
                    if stops:
                        break
                line['stops'] = stops

    log.success(f"Processed {len(lines)} HTM lines")

    # Build result
    result = {
        "metadata": {
            "source": "OVapi (v0.ovapi.nl)",
            "operator": "HTM (Haagse Tramweg-Maatschappij)",
            "region": "The Hague / Den Haag",
            "downloaded_at": datetime.utcnow().isoformat(),
            "total_lines": len(lines),
            "filter_type": filter_type,
            "includes_stops": include_stops,
            "license": "Open Data"
        },
        "lines": lines
    }

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.success(f"Saved to {output_path}")

    # Statistics
    log.info("\n=== HTM Lines Summary ===")

    tram_lines = [l for l in lines if l['line_type'] == 'tram']
    bus_lines = [l for l in lines if l['line_type'] == 'bus']

    log.info(f"Tram lines: {len(tram_lines)}")
    for line in tram_lines:
        dests = " ↔ ".join([d['destination'] for d in line['directions']])
        log.info(f"  Line {line['line_number']}: {dests}")

    log.info(f"\nBus lines: {len(bus_lines)}")
    for line in bus_lines:
        dests = " ↔ ".join([d['destination'] for d in line['directions']])
        log.info(f"  Line {line['line_number']}: {dests}")

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"\nFile size: {file_size_kb:.1f} KB")


if __name__ == "__main__":
    main()
