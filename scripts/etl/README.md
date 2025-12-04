# ETL Scripts: Data Ingestion Pipeline

> Extract, Transform, Load scripts for Dutch government data sources

## 🚀 Quick Start

```bash
# 1. Setup
cd scripts/etl
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 2. Run WOZ scraper (main long-running task)
python scrape_all_woz.py --rate-limit 2.5

# 3. See detailed guide
cat WOZ_SCRAPER_GUIDE.md
```

**Current Status**: WOZ scraper running - 15,000 values scraped, ~4 days remaining at 2.5 req/sec

---

## 🎯 Overview

This directory contains scripts to ingest data from Dutch government sources and transform them into optimized formats (Parquet) for the application.

### Pipeline Flow

```
┌─────────────────┐
│  Dutch Govt API │  (BAG, CBS, Leefbaarometer, etc.)
└────────┬────────┘
         │ Download (ingest/*.py)
         ▼
┌─────────────────┐
│   Raw JSON      │  data/raw/*.json
│  (Inspect Data) │  ← You can view/validate here
└────────┬────────┘
         │ Transform (transform/*_to_parquet.py)
         ▼
┌─────────────────┐
│ Optimized       │  data/processed/*.parquet
│ Parquet Files   │  (80% smaller, fast queries)
└────────┬────────┘
         │ Upload (pipelines/upload_to_r2.py)
         ▼
┌─────────────────┐
│ Cloudflare R2   │  Production storage
└─────────────────┘
```

**Why JSON intermediate step?**
- ✅ Human-readable (inspect data before Parquet)
- ✅ Easy to validate/debug
- ✅ Version control friendly (git diff)
- ✅ Can edit manually if needed
- ✅ Separate concerns (download vs optimize)

---

## 🐍 Technology Stack

**Language**: Python 3.11+

**Key Libraries**:
- `polars` - Fast DataFrame library (Rust-powered)
- `httpx` - Async HTTP client
- `pyarrow` - Parquet file format
- `beautifulsoup4` - Web scraping (for WOZ)
- `tqdm` - Progress bars
- `pydantic` - Data validation

**Why Python over Rust?**
- Rich data science ecosystem
- Easy to maintain and modify
- Fast enough with Polars (uses Rust under hood)
- Better web scraping libraries

---

## 📁 Directory Structure

```
scripts/etl/
├── README.md              # This file
├── requirements.txt       # Python dependencies
├── .env.example          # Example environment variables
│
├── common/
│   ├── __init__.py
│   ├── api_client.py     # Reusable HTTP client
│   ├── logger.py         # Structured logging
│   ├── geo_utils.py      # Geospatial helpers
│   └── parquet_writer.py # Parquet optimization
│
├── ingest/
│   ├── __init__.py
│   ├── bag.py                    # BAG addresses & buildings
│   ├── woz.py                    # WOZ values scraper
│   ├── cbs_demographics.py       # CBS demographics
│   ├── leefbaarometer.py         # Livability scores
│   ├── crime.py                  # Crime statistics
│   ├── duo_schools.py            # School locations (DUO API)
│   ├── duo_schools_complete.py   # ✅ Complete schools ingestion (ALL levels)
│   ├── energielabel.py           # Energy labels
│   └── energieverbruik.py        # Energy consumption
│
├── transform/
│   ├── __init__.py
│   ├── bag_to_parquet.py        # BAG → Parquet
│   ├── merge_woz.py             # Merge WOZ with BAG
│   ├── spatial_index.py         # Create spatial indexes
│   ├── schools_to_parquet.py    # ✅ Schools JSON → Parquet
│   └── addresses_to_parquet.py  # BAG addresses → Parquet
│
└── pipelines/
    ├── __init__.py
    ├── full_refresh.py   # Complete data refresh
    ├── incremental.py    # Update only changed data
    └── upload_to_r2.py   # Deploy to Cloudflare R2
```

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Navigate to scripts directory
cd scripts/etl

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your credentials (if needed)
```

### 2. Run BAG Ingestion

```bash
# Step 1: Download to JSON (inspect data)
python -m ingest.bag --sample 100 --output ../../data/raw/bag.json

# Inspect the JSON file
cat ../../data/raw/bag.json | head -n 50

# Step 2: Transform JSON to Parquet (optimize)
python -m transform.bag_to_parquet --input ../../data/raw/bag.json

# Output: data/processed/bag-addresses.parquet
```

### 3. Run WOZ Scraper

```bash
# Step 1: Scrape to JSON (inspect results)
python -m ingest.woz --sample 10 --output ../../data/raw/woz.json

# Inspect the JSON file
cat ../../data/raw/woz.json

# Step 2: Transform JSON to Parquet
python -m transform.woz_to_parquet --input ../../data/raw/woz.json

# Output: data/processed/woz-values.parquet
```

**Important**: WOZ scraping takes time!
- Sample of 10: ~10 seconds
- Sample of 1,000: ~17 minutes
- Full 8M addresses: ~92 days (not recommended!)


### 4. Run Full Pipeline

```bash
# Download all data sources
python -m pipelines.full_refresh

# Upload to Cloudflare R2
python -m pipelines.upload_to_r2
```

---

## 📊 Data Sources

### 1. BAG (Buildings & Addresses)

**API**: https://api.pdok.nl/bzk/bag/v2/
**License**: CC0
**Size**: ~10 million addresses
**Update**: Quarterly

**What we extract**:
- Address (street, number, postal code, city)
- Coordinates (lat/lon)
- Building year
- Building type
- Surface area
- Energy label

### 2. WOZ (Property Valuations)

**Source**: https://www.wozwaardeloket.nl/
**License**: Public data (individual queries allowed)
**Size**: ~8 million properties
**Update**: Annually (per property)

**Scraping strategy**:
- Query WOZ for each BAG address
- Rate limit: 1 request/second (respect server)
- Cache results for 1 year
- Community sharing model

**Legal note**: Individual queries are allowed. We're not bulk-downloading, we're querying one address at a time, which is the intended use of the website.

### 3. CBS (Demographics)

**API**: https://opendata.cbs.nl/
**License**: CC-BY
**Size**: ~13,000 neighborhoods
**Update**: Annually

### 4. Leefbaarometer (Livability)

**Source**: https://www.leefbaarometer.nl/
**License**: Open Data
**Size**: ~4 million grid cells (100x100m)
**Update**: Annually

---

## 🔧 Script Details

### ingest/bag.py

Downloads BAG data from PDOK API.

**Usage**:
```bash
python -m ingest.bag --output data/raw/bag.json
```

**Options**:
- `--output` - Output file path
- `--province` - Limit to specific province (e.g., "Noord-Holland")
- `--municipality` - Limit to specific municipality (e.g., "Amsterdam")
- `--sample` - Sample N addresses for testing

**Output format**:
```json
[
  {
    "identificatie": "0363010000000001",
    "straatnaam": "Dam",
    "huisnummer": 1,
    "postcode": "1012JS",
    "woonplaats": "Amsterdam",
    "latitude": 52.373169,
    "longitude": 4.890660,
    "bouwjaar": 1655,
    "oppervlakte": 350,
    "gebruiksdoel": "woonfunctie",
    "status": "Verblijfsobject in gebruik"
  }
]
```

---

### ingest/woz.py

Scrapes WOZ values from wozwaardeloket.nl.

**Usage**:
```bash
# Scrape WOZ for all addresses in BAG
python -m ingest.woz --input data/raw/bag.json --output data/raw/woz.json

# Test with sample
python -m ingest.woz --sample 100
```

**Options**:
- `--input` - BAG data file
- `--output` - Output file path
- `--sample` - Test with N addresses
- `--rate-limit` - Requests per second (default: 1)
- `--resume` - Resume from checkpoint

**Output format**:
```json
[
  {
    "bag_id": "0363010000000001",
    "postcode": "1012JS",
    "huisnummer": 1,
    "woz_waarde": 850000,
    "waardepeildatum": "2023-01-01",
    "scraped_at": "2025-11-03T10:30:00Z"
  }
]
```

**Rate limiting**:
- Default: 1 request/second (86,400 addresses/day)
- For 8M addresses: ~92 days
- Use `--sample` for testing, run incrementally in production

**Checkpointing**:
- Saves progress every 1,000 addresses
- Can resume if interrupted
- File: `data/checkpoints/woz_progress.json`

---

### transform/bag_to_parquet.py

Converts BAG JSON to optimized Parquet format.

**Usage**:
```bash
python -m transform.bag_to_parquet
```

**Transformations**:
- Clean data (remove invalid coordinates)
- Standardize column names
- Convert types (strings to categorical)
- Add spatial index columns
- Compress with Snappy

**Output**:
- `data/processed/bag-addresses.parquet` (~500 MB)
- Schema optimized for fast filtering by postal code, city

---

### pipelines/full_refresh.py

Runs complete ETL pipeline for all data sources.

**Usage**:
```bash
python -m pipelines.full_refresh
```

**Steps**:
1. Download BAG data (4-6 hours)
2. Download CBS demographics (30 min)
3. Download Leefbaarometer (1 hour)
4. Download crime stats (20 min)
5. Download school locations (10 min)
6. Transform all to Parquet (1 hour)
7. Generate summary statistics

**Total time**: ~8-10 hours

---

## 📐 Data Schema

### BAG Addresses (Parquet)

```python
{
    "id": str,                    # BAG identifier
    "street": str,                # Street name
    "house_number": int32,        # House number
    "house_letter": str,          # House letter (A, B, etc.)
    "postal_code": str,           # 1012AB format
    "city": str,                  # Municipality
    "province": str,              # Province
    "latitude": float64,          # WGS84
    "longitude": float64,         # WGS84
    "build_year": int32,          # Year constructed
    "surface_area": int32,        # Square meters
    "building_type": str,         # House, apartment, etc.
    "energy_label": str,          # A+++, A++, A+, A, B, C, D, E, F, G
    "status": str                 # In use, demolished, etc.
}
```

### WOZ Values (Parquet)

```python
{
    "bag_id": str,                # Links to BAG
    "postal_code": str,
    "house_number": int32,
    "woz_value": int32,           # EUR
    "valuation_date": date,       # Reference date
    "scraped_at": timestamp       # When we got it
}
```

---

## ⚖️ Legal & Ethical Considerations

### WOZ Scraping

**Is it legal?**
✅ Yes - WOZ values are public information (Wet waardering onroerende zaken)
✅ Individual lookups are the intended use of wozwaardeloket.nl
✅ We're not overloading the server (1 req/sec)
✅ We cache results (reduce load)

**Rate limiting**:
- Respect robots.txt (if present)
- 1 request/second (generous)
- Add delays during peak hours
- Implement exponential backoff on errors

**Community model**:
- Once an address is queried, cache it
- Share cached data with all users
- Reduces total requests to WOZ server
- Users collectively build database

---

## 📊 Performance Benchmarks

### BAG Ingestion

| Metric | Value |
|--------|-------|
| Total addresses | 10,000,000 |
| Raw JSON size | 2.5 GB |
| Download time | 4-6 hours (depends on API) |
| Transform time | 30 minutes |
| Parquet size | 500 MB (80% reduction) |

### WOZ Scraping

| Metric | Value |
|--------|-------|
| Addresses to scrape | 8,000,000 |
| Rate | 1 req/sec = 86,400/day |
| Total time | ~92 days (if sequential) |
| **Recommended**: Sample 100K addresses initially | ~28 hours |

**Optimization strategies**:
1. **Priority scraping**: Start with most-searched postal codes
2. **User-driven**: Scrape on-demand when users search
3. **Community pooling**: Share results across users

---

## 🔄 Update Frequency

| Data Source | Update Frequency | Runtime |
|-------------|------------------|---------|
| BAG | Quarterly | 6 hours |
| WOZ | Annually (per address) | Ongoing |
| CBS | Annually | 30 min |
| Leefbaarometer | Annually | 1 hour |
| Crime stats | Quarterly | 20 min |
| Schools (DUO) | Monthly | 2 min | ✅ Complete |

**Recommended schedule**:
```yaml
# .github/workflows/etl-pipeline.yml
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday 2 AM
  workflow_dispatch:      # Manual trigger
```

---

## 🐛 Troubleshooting

### Error: "API rate limit exceeded"

**Solution**: Add retry logic with exponential backoff
```python
import time
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(wait=wait_exponential(multiplier=1, min=4, max=60), stop=stop_after_attempt(5))
def fetch_with_retry(url):
    response = httpx.get(url)
    response.raise_for_status()
    return response.json()
```

### Error: "Out of memory"

**Solution**: Process in chunks with Polars streaming
```python
import polars as pl

# Stream large files
df = pl.scan_parquet("data/raw/bag.parquet") \
    .filter(pl.col("province") == "Noord-Holland") \
    .collect(streaming=True)
```

### Error: "WOZ scraper blocked"

**Solution**: Use rotating User-Agent, add delays
```python
import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
]

headers = {"User-Agent": random.choice(USER_AGENTS)}
```

---

## 📞 Support

**Issues**: Open a GitHub issue
**Documentation**: See individual script docstrings
**Roadmap**: See [ROADMAP.md](../../ROADMAP.md)

---

## 🎓 Schools Data (NEW!)

### Complete Schools Ingestion

We now have a complete schools data ingestion pipeline that downloads ALL school types from the Dutch Ministry of Education's DUO portal.

**Script**: `ingest/duo_schools_complete.py`

**Usage**:
```bash
# Download all school types (Primary, Secondary, Vocational, Higher Ed)
python -m ingest.duo_schools_complete

# Download specific types only
python -m ingest.duo_schools_complete --types po,vo

# Convert to Parquet
python transform/schools_to_parquet.py
```

**Results**:
- ✅ **14,374 schools** ingested successfully
- ✅ **12,107 primary schools** (Basisonderwijs - PO)
- ✅ **2,267 secondary schools** (Voortgezet Onderwijs - VO)
- ✅ Output: `data/processed/schools.parquet` (0.6 MB)
- ✅ 100% have valid postal codes and addresses
- ⏳ Coordinates need to be enriched (see `enrich_addresses_with_coordinates.py`)

**Data Source**:
- Portal: https://onderwijsdata.duo.nl/
- License: CC-BY 4.0
- Update Frequency: Monthly

**See detailed guide**: [docs/DUO_SCHOOLS_COMPLETE.md](../../docs/DUO_SCHOOLS_COMPLETE.md)

---

**Last Updated**: November 22, 2025
**Next Review**: December 22, 2025
