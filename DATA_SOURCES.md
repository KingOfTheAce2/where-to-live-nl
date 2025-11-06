# Data Sources for Where-to-Live-NL

Comprehensive list of data sources used in the platform, with importance ratings for expats.

## 🏠 Core Housing Data

### BAG (Basisregistraties Adressen en Gebouwen)
- **What**: All addresses and buildings in Netherlands
- **Source**: Kadaster via PDOK
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/bag.py`
- **License**: CC0 (Public Domain)
- **Status**: Built, needs testing

### WOZ (Waardering Onroerende Zaken)
- **What**: Property valuations (tax assessments)
- **Source**: CBS
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/woz.py`
- **License**: Open Data
- **Status**: Built, needs testing
- **Note**: Official valuations, not market prices

## 🚆 Public Transport (CRITICAL for expats without cars!)

### NS Stations
- **What**: All train stations in Netherlands
- **Source**: NS API / GTFS feeds
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/ns_stations.py`
- **License**: Open Data
- **Status**: ✅ Built and ready
- **Methods**:
  - `ns_api`: Official NS API (requires API key)
  - `gtfs`: GTFS feed (no key needed)
- **Coverage**: ~400 train stations

### Public Transport Stops (Bus/Tram/Metro/Ferry)
- **What**: All public transport stops
- **Source**: GTFS feeds (GVB, RET, HTM, etc.)
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/public_transport.py`
- **License**: Open Data
- **Status**: ✅ Built and ready
- **Coverage**: ~50,000+ stops nationwide
- **Filters**: By region, by type (bus/tram/metro/ferry)

## 🏫 Education

### Primary & Secondary Schools
- **What**: All schools in Netherlands
- **Source**: DUO (Dienst Uitvoering Onderwijs)
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL (families)
- **Script**: `scripts/etl/ingest/schools.py`
- **License**: Open Data
- **Status**: Built, 403 errors
- **Coverage**: ~8,000 schools

### International Schools
- **What**: English-language schools for expat children
- **Source**: OpenStreetMap + manual list
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL (expat families)
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity international_schools`
- **License**: ODbL
- **Status**: ✅ Built and ready

## 🛒 Daily Amenities

### Supermarkets
- **What**: Albert Heijn, Jumbo, Lidl, Aldi, etc.
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity supermarkets`
- **License**: ODbL (© OpenStreetMap contributors)
- **Status**: ✅ Built and ready
- **Coverage**: ~5,000+ supermarkets

### Healthcare
- **What**: Hospitals, doctors, pharmacies
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity healthcare`
- **License**: ODbL
- **Status**: ✅ Built and ready

### Parks & Green Spaces
- **What**: Parks, recreation areas
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐ MEDIUM
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity parks`
- **License**: ODbL
- **Status**: ✅ Built and ready

### Restaurants & Cafes
- **What**: Dining options
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐ LOW
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity restaurants`
- **License**: ODbL
- **Status**: ✅ Built and ready

### Sports Facilities
- **What**: Gyms, pools, sports centers
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐ LOW
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity sports`
- **License**: ODbL
- **Status**: ✅ Built and ready

### Playgrounds
- **What**: Playgrounds for children
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH (families)
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity playgrounds`
- **License**: ODbL
- **Status**: ✅ Built and ready

## 🏘️ Neighborhood Quality

### Leefbaarometer (Livability Index)
- **What**: Neighborhood livability scores
- **Source**: Leefbaarometer WFS API
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/leefbaarometer.py`
- **License**: Open Data
- **Status**: Built, 403 errors
- **Metrics**: Physical environment, safety, social cohesion, facilities, housing

### Crime Statistics
- **What**: Registered crime by neighborhood
- **Source**: CBS/Politie.nl
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/crime.py`
- **License**: Open Data
- **Status**: Built, 403 errors
- **Data**: Burglary, street robbery, vandalism, drug crimes

### CBS Demographics
- **What**: Population, age, income, household composition
- **Source**: CBS (Centraal Bureau voor de Statistiek)
- **Importance**: ⭐⭐⭐ MEDIUM
- **Script**: `scripts/etl/ingest/cbs_demographics.py`
- **License**: CC-BY 4.0
- **Status**: Built, 403 errors

## ⚠️ Risk Factors (CRITICAL - Can cost €50k-150k!)

### Foundation Risk
- **What**: Foundation problems, soil subsidence
- **Source**: Funderingsmonitor, municipal reports
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/foundation_risk.py`
- **License**: Open Data / Manual compilation
- **Status**: ✅ Built with known risk areas
- **Risk Areas**:
  - **HIGH**: Amsterdam Jordaan/De Pijp, Gouda center, Delft center
  - **MEDIUM**: Amsterdam Zuid, Rotterdam Kralingen, Den Haag Centrum
- **Cost**: €50,000 - €150,000+ to repair
- **Note**: Pre-1950 buildings = ALWAYS get professional inspection!

### Environmental Data
- **What**: Air quality, noise pollution, flood risk
- **Source**: RIVM, Rijkswaterstaat, CROW
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/environmental_data.py`
- **License**: Open Data
- **Status**: ✅ Built with known problem areas

#### Air Quality
- **Problem Areas**:
  - Schiphol area (aircraft emissions, PM2.5, NO2)
  - Rotterdam Maasvlakte (port/industry, PM10)
  - Major highway corridors (A10, A4, etc.)
- **Advice**: Avoid <10km from Schiphol with kids, <300m from highways

#### Noise Pollution
- **Problem Areas**:
  - Schiphol flight paths (24/7 operations)
  - Rotterdam Port area
  - Major highways within 500m
  - Eindhoven Airport (growing)
- **Note**: #1 complaint from expats near Schiphol!

#### Flood Risk
- **HIGH RISK**: Limburg (Maas floods 2021, 2023), Zeeland
- **MEDIUM RISK**: Low-lying polders, river areas
- **Recent Events**: 2021 Limburg floods, €hundreds millions damage
- **Warning**: Flood insurance NOT always included in standard policy!

## 📊 Summary Table

| Data Source | Importance | Status | API Issues | Coverage |
|------------|-----------|--------|-----------|----------|
| **BAG Addresses** | ⭐⭐⭐⭐⭐ | Built | Testing needed | 100% NL |
| **WOZ Valuations** | ⭐⭐⭐⭐⭐ | Built | Testing needed | 100% NL |
| **NS Stations** | ⭐⭐⭐⭐⭐ | ✅ Ready | None | ~400 stations |
| **PT Stops** | ⭐⭐⭐⭐⭐ | ✅ Ready | None | ~50,000+ |
| **Schools (DUO)** | ⭐⭐⭐⭐⭐ | Built | 403 error | ~8,000 |
| **Int'l Schools** | ⭐⭐⭐⭐⭐ | ✅ Ready | None | OSM data |
| **Supermarkets** | ⭐⭐⭐⭐ | ✅ Ready | None | ~5,000+ |
| **Healthcare** | ⭐⭐⭐⭐ | ✅ Ready | None | OSM data |
| **Foundation Risk** | ⭐⭐⭐⭐⭐ | ✅ Ready | None | Major cities |
| **Environment** | ⭐⭐⭐⭐ | ✅ Ready | None | Key areas |
| **Crime Stats** | ⭐⭐⭐⭐ | Built | 403 error | Neighborhoods |
| **Leefbaarometer** | ⭐⭐⭐⭐ | Built | 403 error | Neighborhoods |
| **Demographics** | ⭐⭐⭐ | Built | 403 error | Municipalities |

## 🚀 Usage Instructions

### Working Scrapers (No Issues)

```bash
# Public transport (GTFS - no API key needed)
python scripts/etl/ingest/ns_stations.py --method gtfs
python scripts/etl/ingest/public_transport.py --region all

# Amenities from OpenStreetMap
python scripts/etl/ingest/amenities_osm.py --amenity supermarkets
python scripts/etl/ingest/amenities_osm.py --amenity healthcare
python scripts/etl/ingest/amenities_osm.py --amenity international_schools
python scripts/etl/ingest/amenities_osm.py --amenity all  # Gets all amenities

# Foundation risk (manual data)
python scripts/etl/ingest/foundation_risk.py

# Environmental data
python scripts/etl/ingest/environmental_data.py
```

### Scrapers with 403 Errors (Need Workaround)

```bash
# These work but hit 403 errors:
python scripts/etl/ingest/crime.py --sample 100
python scripts/etl/ingest/schools.py --sample 100
python scripts/etl/ingest/leefbaarometer.py --sample 100
python scripts/etl/ingest/cbs_demographics.py
```

**Workarounds:**
1. Manual download from portals
2. Browser automation (Selenium/Playwright)
3. Request API keys from data providers

## ⚠️ Critical Expat Warnings

### Top 5 Things Expats Should Check:

1. **Foundation Issues** (⭐⭐⭐⭐⭐)
   - Pre-1950 buildings = HIGH RISK
   - Budget €1,000-1,500 for professional inspection
   - Repairs cost €50k-150k+
   - Not disclosed by sellers!

2. **Distance to Train Station** (⭐⭐⭐⭐⭐)
   - Car ownership expensive in NL
   - <15 min walk to station = ideal
   - Check NS app for frequencies

3. **Schiphol Noise** (⭐⭐⭐⭐⭐)
   - #1 complaint from expats
   - Check noise contour maps
   - Avoid <10km if possible

4. **Flood Risk** (⭐⭐⭐⭐)
   - Check recent flood history
   - Verify insurance coverage
   - Limburg had major floods 2021, 2023

5. **School Proximity** (⭐⭐⭐⭐⭐ for families)
   - International schools have waiting lists
   - Apply EARLY!
   - Check school ratings

## 🔧 Data Pipeline

```
1. Ingest (Raw JSON)
   scripts/etl/ingest/*.py
   ↓
   data/raw/*.json

2. Transform (Parquet with spatial index)
   scripts/etl/transform/*_to_parquet.py
   ↓
   data/processed/*.parquet

3. Serve (API endpoints)
   frontend/src/app/api/*
   ↓
   Live on map!
```

## 📝 Attribution Requirements

**OpenStreetMap data** (ODbL license):
- MUST display: "© OpenStreetMap contributors"
- MUST link to: https://www.openstreetmap.org/copyright
- Used for: Amenities, international schools

**PDOK/Government data**:
- Attribution: "© PDOK | © Kadaster" (usually CC0)
- Used for: Addresses, stations, tiles

**CBS data**:
- Attribution: "Bron: CBS" (CC-BY 4.0)
- Used for: Crime, demographics

## 🎯 Next Steps

1. **Test working scrapers**:
   ```bash
   python scripts/etl/ingest/ns_stations.py
   python scripts/etl/ingest/public_transport.py
   python scripts/etl/ingest/amenities_osm.py --amenity all
   python scripts/etl/ingest/foundation_risk.py
   python scripts/etl/ingest/environmental_data.py
   ```

2. **Manual downloads for 403 errors**:
   - CBS: https://opendata.cbs.nl/
   - DUO: https://duo.nl/open_onderwijsdata/
   - Leefbaarometer: https://www.leefbaarometer.nl/

3. **Transform to Parquet**:
   ```bash
   python scripts/etl/transform/*_to_parquet.py
   ```

4. **Update frontend API** to serve new data sources

## 📚 Resources

- **NS API**: https://apiportal.ns.nl/
- **GTFS Feeds**: https://gtfs.ovapi.nl/
- **Overpass API**: https://overpass-api.de/
- **PDOK**: https://www.pdok.nl/
- **CBS StatLine**: https://opendata.cbs.nl/
- **Funderingsmonitor**: https://www.funderingsmonitor.nl/
- **RIVM Air Quality**: https://www.rivm.nl/lucht
- **Schiphol Noise**: https://www.schiphol.nl/nl/geluid/
