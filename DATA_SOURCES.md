# Data Sources for Where-to-Live-NL

Comprehensive list of data sources used in the platform, with importance ratings for expats.

## 📋 Status Overview (As of 2025-11-06)

**🎯 Scraper Build Status:**
- ✅ **All 15+ scrapers built and ready**
- ✅ **2 scrapers working**: Foundation Risk, Environmental Data
- ⚠️ **11+ scrapers blocked**: Strong bot protection (403 errors)
- 📝 **Sample data**: Removed (only real data shown)

**✅ Currently Working:**
1. Foundation Risk - Manual compilation (11 areas, 4.3 KB generated)
2. Environmental Data - Manual fallback (Air/Noise/Flood, 5.4 KB generated)

**⚠️ Built but 403 Errors:**
1. NS Stations - GTFS blocked
2. Public Transport - GTFS blocked
3. All OSM Amenities - Overpass API blocked
4. Schools (DUO) - Government API blocked
5. Crime Statistics - CBS API blocked
6. Leefbaarometer - WFS blocked
7. CBS Demographics - OData blocked

**🔧 Next Steps:**
- Try manual downloads from web portals
- Consider browser automation (Selenium/Playwright)
- Request API keys where available
- Alternative: Use different network/IP address

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
- **Status**: ⚠️ Built, GTFS returns 403 error
- **Methods**:
  - `ns_api`: Official NS API (requires API key)
  - `gtfs`: GTFS feed (no key needed) - **403 error**
- **Coverage**: ~400 train stations

### Public Transport Stops (Bus/Tram/Metro/Ferry)
- **What**: All public transport stops
- **Source**: GTFS feeds (GVB, RET, HTM, etc.)
- **Importance**: ⭐⭐⭐⭐⭐ CRITICAL
- **Script**: `scripts/etl/ingest/public_transport.py`
- **License**: Open Data
- **Status**: ⚠️ Built, GTFS returns 403 error
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
- **Status**: ⚠️ Built, Overpass API returns 403 error

## 🛒 Daily Amenities

### Supermarkets
- **What**: Albert Heijn, Jumbo, Lidl, Aldi, etc.
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity supermarkets`
- **License**: ODbL (© OpenStreetMap contributors)
- **Status**: ⚠️ Built, Overpass API returns 403 error
- **Coverage**: ~5,000+ supermarkets (when accessible)

### Healthcare
- **What**: Hospitals, doctors, pharmacies
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity healthcare`
- **License**: ODbL
- **Status**: ⚠️ Built, Overpass API returns 403 error

### Parks & Green Spaces
- **What**: Parks, recreation areas
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐ MEDIUM
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity parks`
- **License**: ODbL
- **Status**: ⚠️ Built, Overpass API returns 403 error

### Restaurants & Cafes
- **What**: Dining options
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐ LOW
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity restaurants`
- **License**: ODbL
- **Status**: ⚠️ Built, Overpass API returns 403 error

### Sports Facilities
- **What**: Gyms, pools, sports centers
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐ LOW
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity sports`
- **License**: ODbL
- **Status**: ⚠️ Built, Overpass API returns 403 error

### Playgrounds
- **What**: Playgrounds for children
- **Source**: OpenStreetMap
- **Importance**: ⭐⭐⭐⭐ HIGH (families)
- **Script**: `scripts/etl/ingest/amenities_osm.py --amenity playgrounds`
- **License**: ODbL
- **Status**: ⚠️ Built, Overpass API returns 403 error

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
- **Status**: ✅ **WORKING** - Manual data, tested successfully
- **Data Generated**: `data/raw/foundation_risk.json` (4.3 KB)
- **Risk Areas**:
  - **HIGH**: Amsterdam Jordaan/De Pijp, Gouda center, Delft center (4 areas)
  - **MEDIUM**: Amsterdam Zuid, Rotterdam Kralingen, Den Haag Centrum (7 areas)
- **Cost**: €50,000 - €150,000+ to repair
- **Note**: Pre-1950 buildings = ALWAYS get professional inspection!

### Environmental Data
- **What**: Air quality, noise pollution, flood risk
- **Source**: RIVM, Rijkswaterstaat, CROW
- **Importance**: ⭐⭐⭐⭐ HIGH
- **Script**: `scripts/etl/ingest/environmental_data.py`
- **License**: Open Data
- **Status**: ✅ **WORKING** - Manual fallback data, tested successfully
- **Data Generated**: `data/raw/environmental_data.json` (5.4 KB)

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
| **NS Stations** | ⭐⭐⭐⭐⭐ | Built | ⚠️ 403 GTFS | ~400 stations |
| **PT Stops** | ⭐⭐⭐⭐⭐ | Built | ⚠️ 403 GTFS | ~50,000+ |
| **Schools (DUO)** | ⭐⭐⭐⭐⭐ | Built | ⚠️ 403 error | ~8,000 |
| **Int'l Schools** | ⭐⭐⭐⭐⭐ | Built | ⚠️ 403 OSM | OSM data |
| **Supermarkets** | ⭐⭐⭐⭐ | Built | ⚠️ 403 OSM | ~5,000+ |
| **Healthcare** | ⭐⭐⭐⭐ | Built | ⚠️ 403 OSM | OSM data |
| **Foundation Risk** | ⭐⭐⭐⭐⭐ | ✅ **WORKING** | ✅ None | 11 risk areas |
| **Environment** | ⭐⭐⭐⭐ | ✅ **WORKING** | ✅ None | Key areas |
| **Crime Stats** | ⭐⭐⭐⭐ | Built | ⚠️ 403 error | Neighborhoods |
| **Leefbaarometer** | ⭐⭐⭐⭐ | Built | ⚠️ 403 error | Neighborhoods |
| **Demographics** | ⭐⭐⭐ | Built | ⚠️ 403 error | Municipalities |

## 🚀 Usage Instructions

### ✅ Working Scrapers (Tested Successfully)

```bash
# Foundation risk (manual data) - ✅ TESTED AND WORKING
cd scripts/etl
python -m ingest.foundation_risk
# Output: data/raw/foundation_risk.json (4.3 KB)
# Contains: 11 risk areas (4 high-risk, 7 medium-risk)

# Environmental data (manual fallback) - ✅ TESTED AND WORKING
python -m ingest.environmental_data --data-type all
# Output: data/raw/environmental_data.json (5.4 KB)
# Contains: Air quality, noise pollution, flood risk data
```

### ⚠️ Built Scrapers with 403 Bot Protection

All other scrapers are **fully built and ready** but currently blocked by aggressive bot protection:

```bash
# Public transport - 403 on GTFS feeds
python -m ingest.ns_stations --method gtfs  # ⚠️ 403 error
python -m ingest.public_transport --region all  # ⚠️ 403 error

# Amenities from OpenStreetMap - 403 on Overpass API
python -m ingest.amenities_osm --amenity supermarkets  # ⚠️ 403 error
python -m ingest.amenities_osm --amenity healthcare  # ⚠️ 403 error
python -m ingest.amenities_osm --amenity international_schools  # ⚠️ 403 error
python -m ingest.amenities_osm --amenity all  # ⚠️ 403 error

# Government data sources
python -m ingest.crime --sample 100  # ⚠️ 403 error
python -m ingest.schools --sample 100  # ⚠️ 403 error
python -m ingest.leefbaarometer --sample 100  # ⚠️ 403 error
python -m ingest.cbs_demographics  # ⚠️ 403 error
```

**Workarounds for 403 Errors:**
1. **Manual download** from web portals (works but tedious)
2. **Browser automation** (Selenium/Playwright) to mimic human interaction
3. **Request API keys** from data providers (NS, DUO, CBS)
4. **Different network/IP** - Try from different location
5. **Use alternative endpoints** - Some providers have mirror URLs

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
