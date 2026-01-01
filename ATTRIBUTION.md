# Data Attribution

> This document lists all data sources used in Where-to-Live-NL and their respective licenses.

---

## Government Data Sources (Netherlands)

### PDOK (Publieke Dienstverlening Op de Kaart)
- **Website**: https://www.pdok.nl
- **License**: CC0 1.0 (Public Domain) / CC-BY 4.0 (varies by dataset)
- **Data used**:
  - BAG (Basisregistratie Adressen en Gebouwen) - addresses, buildings
  - Neighborhood boundaries (wijken, buurten)
  - Topographic base maps
  - Aerial imagery

### CBS (Centraal Bureau voor de Statistiek)
- **Website**: https://www.cbs.nl
- **License**: CC-BY 4.0
- **Attribution**: "Statistics Netherlands (CBS)"
- **Data used**:
  - Demographics per neighborhood
  - Crime statistics (regionale kerncijfers)
  - Proximity statistics (afstand tot voorzieningen)
  - Income and housing data

### Kadaster
- **Website**: https://www.kadaster.nl
- **License**: CC0 1.0 (BAG data), various for other datasets
- **Data used**:
  - BAG building registry
  - WOZ Waardeloket (property valuations - public lookups)
  - Foundation risk data

### Leefbaarometer
- **Website**: https://www.leefbaarometer.nl
- **License**: Open Data (Dutch Government)
- **Data used**:
  - Livability scores (2020, 2022)
  - Livability dimensions (housing, services, safety, etc.)

### RIVM (Rijksinstituut voor Volksgezondheid en Milieu)
- **Website**: https://www.rivm.nl
- **License**: Open Data
- **Data used**:
  - Air quality data (PM2.5, NO2, PM10)
  - Noise pollution maps (road, rail, aircraft)
  - Atlas Leefomgeving data

### RWS (Rijkswaterstaat)
- **Website**: https://www.rijkswaterstaat.nl
- **License**: Open Data
- **Data used**:
  - Flood risk zones
  - Water depth scenarios
  - Overstromingsrisico data

### DUO (Dienst Uitvoering Onderwijs)
- **Website**: https://duo.nl
- **License**: Open Data
- **Data used**:
  - School locations (primary, secondary, MBO, HBO, WO)
  - School information and types

### EP-Online (RVO)
- **Website**: https://www.ep-online.nl
- **License**: Public data
- **Data used**:
  - Energy labels for buildings

### OVapi / NS
- **Website**: https://gtfs.ovapi.nl, https://www.ns.nl
- **License**: Open Data
- **Data used**:
  - Train station locations
  - Public transport routes (GTFS)

---

## Third-Party Data Sources

### OpenStreetMap
- **Website**: https://www.openstreetmap.org
- **License**: ODbL 1.0 (Open Database License)
- **Attribution**: "© OpenStreetMap contributors"
- **Data used**:
  - Supermarket locations
  - Healthcare facilities
  - Playgrounds
  - Cultural amenities
  - Points of interest

### Klimaateffectatlas
- **Website**: https://www.klimaateffectatlas.nl
- **License**: Open Data
- **Data used**:
  - Climate impact data
  - Heat stress maps
  - Future climate projections

---

## Map Technologies

### MapLibre GL JS
- **Website**: https://maplibre.org
- **License**: BSD 3-Clause
- **Usage**: Map rendering engine

### CesiumJS
- **Website**: https://cesium.com
- **License**: Apache 2.0
- **Usage**: 3D building visualization

### Turf.js
- **Website**: https://turfjs.org
- **License**: MIT
- **Usage**: Geospatial calculations

---

## Important Notes

1. **Data Accuracy**: While we strive for accuracy, this is informational only. Always verify critical data with official sources.

2. **Update Frequency**: Data freshness varies by source (some updated annually, others more frequently).

3. **API Usage**: All data is fetched in compliance with source Terms of Service and rate limits.

4. **Not Real-Time**: Most datasets are historical snapshots, not live data.

---

## Disclaimer

This software aggregates publicly available data for informational purposes only. It is **NOT** a substitute for:
- Professional property inspections
- Legal advice
- Official government records
- Licensed real estate guidance

The data and insights provided should be used as one factor among many when making housing decisions.

---

*Last updated: December 2025*
