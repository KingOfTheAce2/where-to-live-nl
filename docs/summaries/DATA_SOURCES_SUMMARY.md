# Data Sources Summary

This document outlines all available data ingestion scripts and their usage.

---

## 🗂️ Available Data Sources

### 1. **WOZ Property Valuations** ⭐ Currently Running
**Script**: `scripts/etl/scrape_all_woz.py`

Property tax valuations for all addresses in the Netherlands.

```bash
cd scripts/etl
python scrape_all_woz.py --rate-limit 0.5
```

**Features**:
- Historical WOZ values (2014-present)
- Automatic checkpointing & resume
- Estimated time: 25-90 days for full dataset
- Output: `data/processed/woz-netherlands-complete.parquet`

**Data includes**:
- WOZ values by year
- Building year
- Surface area
- Property type
- BAG identifiers

---

### 2. **Crime Statistics**
**Script**: `scripts/etl/ingest/crime.py`

Registered crime data at neighborhood and municipality level from CBS/Politie.nl.

```bash
cd scripts/etl
python -m ingest.crime --output ../../data/raw/crime.json
```

**Crime categories**:
- Total crimes
- Burglary
- Street robbery
- Vehicle theft
- Vandalism
- Drug crimes

**Data level**: Neighborhood (buurt) and municipality level
**Source**: CBS Open Data Portal
**License**: Open Data (CC-BY 4.0)

---

### 3. **Demographics (CBS)**
**Script**: `scripts/etl/ingest/cbs_demographics.py`

Population demographics and socioeconomic data from Statistics Netherlands.

```bash
cd scripts/etl
python -m ingest.cbs_demographics --output ../../data/raw/demographics.json
```

**Data includes**:
- Population by age groups
- Income levels
- Household composition
- Employment statistics
- Education levels

**Data level**: Neighborhood (buurt) level
**Update frequency**: Annually

---

### 4. **Schools**
**Script**: `scripts/etl/ingest/schools.py`

Primary and secondary school locations with quality ratings.

```bash
cd scripts/etl
python -m ingest.schools --output ../../data/raw/schools.json
```

**Data includes**:
- School locations (coordinates)
- School types (primary/secondary)
- Quality ratings
- Denominations

---

### 5. **Public Transport**
**Scripts**:
- `scripts/etl/ingest/public_transport.py`
- `scripts/etl/ingest/ns_stations.py`

Public transport stops and train stations.

```bash
cd scripts/etl
python -m ingest.public_transport --output ../../data/raw/transport.json
python -m ingest.ns_stations --output ../../data/raw/stations.json
```

**Data includes**:
- Train stations (NS)
- Bus stops
- Tram/metro stations
- Coordinates and names

---

### 6. **Livability Scores (Leefbaarometer)**
**Script**: `scripts/etl/ingest/leefbaarometer.py`

Neighborhood livability scores based on multiple factors.

```bash
cd scripts/etl
python -m ingest.leefbaarometer --output ../../data/raw/livability.json
```

**Factors**:
- Physical environment
- Social cohesion
- Safety
- Facilities
- Overall livability score

**Data level**: 100x100m grid cells
**Update frequency**: Annually

---

### 7. **Air Quality (RIVM Luchtmeetnet)**
**Script**: `scripts/etl/ingest/air_quality.py`

Air quality measurements from Dutch national monitoring network (100+ stations).

```bash
cd scripts/etl
# Real-time API data
python -m ingest.air_quality api --output ../../data/raw/air_quality.json

# RIVM bulk historical data (recommended)
python -m ingest.air_quality rivm --year 2025 --pollutants NO2,PM10,PM25,O3
```

**Data includes**:
- NO2 (nitrogen dioxide)
- PM10 (particulate matter 10µm)
- PM2.5 (fine particulate matter)
- O3 (ozone)
- SO2 (sulfur dioxide)
- CO (carbon monoxide)

**Data sources**:
- Real-time API: https://api.luchtmeetnet.nl/open_api
- Bulk historical: https://data.rivm.nl/data/luchtmeetnet/

**License**: Open data (RIVM/Luchtmeetnet)

---

### 8. **Foundation Risk**
**Script**: `scripts/etl/ingest/foundation_risk.py`

Foundation (funderingsproblematiek) risk assessment for properties.

```bash
cd scripts/etl
python -m ingest.foundation_risk --output ../../data/raw/foundation.json
```

**Risk levels**: Areas with known foundation issues (especially relevant for Amsterdam, Rotterdam)

---

### 9. **Amenities (OpenStreetMap)**
**Script**: `scripts/etl/ingest/amenities_osm.py`

Points of interest from OpenStreetMap.

```bash
cd scripts/etl
python -m ingest.amenities_osm --output ../../data/raw/amenities.json
```

**Amenities**:
- Supermarkets
- Restaurants
- Parks
- Healthcare facilities
- Shopping centers

**License**: ODbL 1.0 (requires attribution)

---

### 10. **BAG Addresses**
**Script**: `scripts/etl/download_all_netherlands_addresses.py`

All addresses in the Netherlands from the BAG database.

```bash
cd scripts/etl
python download_all_netherlands_addresses.py
```

**Data includes**:
- Postal code
- House number
- Street name
- Municipality
- Coordinates (lat/lon)

**Total addresses**: ~10 million
**Time**: 4-6 hours
**Output**: `data/raw/netherlands_all_addresses.json`

---

## 📊 Transform Scripts

After ingesting raw data, transform to optimized Parquet format:

### Available Transforms
- `scripts/etl/transform/woz_to_parquet.py` - WOZ values
- `scripts/etl/transform/crime_to_parquet.py` - Crime statistics
- `scripts/etl/transform/leefbaarometer_to_parquet.py` - Livability scores
- `scripts/etl/transform/bag_to_parquet.py` - BAG addresses

**Usage**:
```bash
cd scripts/etl
python -m transform.crime_to_parquet --input ../../data/raw/crime.json
```

**Benefits**:
- 80% smaller file size
- 10-100x faster queries
- Column-oriented storage
- Schema validation

---

## 🚀 Quick Start

### 1. Setup
```bash
cd scripts/etl
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Download Base Data (One Time)
```bash
# Get all addresses first (required for most other sources)
python download_all_netherlands_addresses.py
```

### 3. Ingest Other Data Sources
```bash
# Crime data (fast - ~30 minutes)
python -m ingest.crime --output ../../data/raw/crime.json

# Demographics (fast - ~30 minutes)
python -m ingest.cbs_demographics --output ../../data/raw/demographics.json

# Schools (fast - ~10 minutes)
python -m ingest.schools --output ../../data/raw/schools.json

# WOZ values (SLOW - runs for weeks, already running)
python scrape_all_woz.py --rate-limit 0.5
```

### 4. Transform to Parquet
```bash
python -m transform.crime_to_parquet
python -m transform.bag_to_parquet
# etc.
```

---

## 📁 Data Output Structure

```
data/
├── raw/                          # JSON format (human-readable)
│   ├── netherlands_all_addresses.json
│   ├── crime.json
│   ├── demographics.json
│   ├── schools.json
│   └── ...
├── processed/                    # Parquet format (optimized)
│   ├── woz-netherlands-complete.parquet
│   ├── crime.parquet
│   ├── demographics.parquet
│   └── ...
└── checkpoints/                  # Resume points for long-running tasks
    └── woz_netherlands_progress.json
```

---

## ⚠️ Important Notes

### Rate Limiting
- **WOZ scraping**: 0.5-1 req/sec (respect the API)
- **CBS APIs**: No strict limits but be reasonable
- **OpenStreetMap**: Follow Overpass API guidelines

### Storage Requirements
- **Raw JSON**: ~5-10 GB total
- **Parquet files**: ~1-2 GB total
- **Temporary files**: ~500 MB

### Time Estimates
| Data Source | Time to Ingest |
|-------------|----------------|
| BAG Addresses | 4-6 hours |
| Crime | 30 minutes |
| Demographics | 30 minutes |
| Schools | 10 minutes |
| Public Transport | 15 minutes |
| Livability | 1 hour |
| WOZ Values | **25-90 days** |

---

## 📞 Support

For questions about data sources:
- Check individual script docstrings: `python -m ingest.crime --help`
- Review source documentation links in each script
- Open GitHub issue for bugs

---

*Last updated: November 2025*
