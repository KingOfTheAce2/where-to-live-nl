# Data Attribution & Licenses

This project uses open data from various Dutch government sources and other public datasets. We are committed to proper attribution and compliance with all licensing terms.

---

## Primary Data Sources

### 1. BAG (Basisregistraties Adressen en Gebouwen)

**Provider**: Kadaster (Dutch Land Registry)
**Description**: Official registry of addresses and buildings in the Netherlands
**Data Used**:
- Addresses (street, house number, postal code, city)
- Building characteristics (year built, type, surface area)
- Energy labels (EPA)
- Geographic coordinates

**License**: [CC0 1.0 Universal (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/)
**API**: https://api.pdok.nl/bzk/bag/v2/
**Documentation**: https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag
**Update Frequency**: Real-time (we update quarterly)

**Attribution**:
> Address and building data provided by Kadaster via the BAG API under CC0 license.

**Terms**: No restrictions on use, modification, or distribution.

---

### 2. WOZ Waardeloket (Property Valuations)

**Provider**: Kadaster (Dutch Land Registry)
**Description**: Public property tax valuations (WOZ values)
**Data Used**:
- Annual property valuations (2014-present)
- Valuation dates
- Property characteristics

**License**: Public information
**API**: https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1
**Website**: https://www.wozwaardeloket.nl/
**Update Frequency**: Annually (we scrape as needed)

**Attribution**:
> WOZ property valuations are public information provided by Kadaster via the WOZ Waardeloket.

**Legal Note**: Individual property lookups are permitted. We implement rate limiting (1 req/sec) to be respectful of the server. See [LEGAL.md](LEGAL.md) for compliance details.

---

### 3. CBS (Centraal Bureau voor de Statistiek)

**Provider**: Statistics Netherlands
**Description**: National statistical office
**Data Used**:
- Demographics (age, household composition, income levels)
- Neighborhood boundaries (buurt, wijk)
- Migration statistics
- Housing market statistics

**License**: [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
**API**: https://opendata.cbs.nl/
**Documentation**: https://www.cbs.nl/en-gb/our-services/open-data
**Update Frequency**: Annually

**Attribution Required**: Yes
**Attribution**:
> Demographic data: Statistics Netherlands (CBS), [dataset name], [year]. Licensed under CC-BY 4.0.

**Terms**: Free to use with attribution. Commercial use allowed.

---

### 4. Leefbaarometer (Livability Index)

**Provider**: Ministerie van Binnenlandse Zaken (Ministry of Interior)
**Description**: Livability scores for neighborhoods across the Netherlands
**Data Used**:
- Overall livability scores (0-10 scale)
- Subcategory scores (physical environment, safety, facilities)
- 100x100m grid granularity

**License**: Open Data (specific license TBD)
**Website**: https://www.leefbaarometer.nl/
**Update Frequency**: Every 2 years (most recent: 2022)

**Attribution**:
> Livability scores provided by Leefbaarometer, Ministerie van Binnenlandse Zaken.

**Terms**: Public data for informational use.

---

### 5. Politie.nl (Crime Statistics)

**Provider**: Nederlandse Politie (Dutch Police)
**Description**: Public crime statistics by neighborhood
**Data Used**:
- Burglary rates
- Attempted burglaries
- Neighborhood-level aggregated data

**License**: Open Data
**API**: https://data.politie.nl/
**Update Frequency**: Quarterly

**Attribution**:
> Crime statistics provided by Politie Nederland via data.politie.nl.

**Terms**: Public data. No personal information included.

---

### 6. PDOK (Publieke Dienstverlening Op de Kaart)

**Provider**: Dutch government
**Description**: Geospatial data and mapping services
**Data Used**:
- Base maps (BRT Achtergrondkaart)
- Vector tiles
- Geocoding services (Locatieserver)
- Administrative boundaries

**License**: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
**Website**: https://www.pdok.nl/
**Tile Service**: https://api.pdok.nl/brt/achtergrondkaart/ogc/v1_0/tiles/
**Documentation**: https://www.pdok.nl/geo-services

**Attribution**:
> Maps powered by PDOK (Publieke Dienstverlening Op de Kaart). Base map data from Kadaster.

**Terms**: Free, unlimited use. No API key required.

---

### 7. DUO (Dienst Uitvoering Onderwijs)

**Provider**: Education Executive Agency (Ministry of Education)
**Description**: School locations and information
**Data Used**:
- School locations (primary, secondary, international)
- School types and denominations
- Inspection ratings (if available)

**License**: Open Data
**Website**: https://duo.nl/open_onderwijsdata/
**Update Frequency**: Annually

**Attribution**:
> School data provided by DUO (Dienst Uitvoering Onderwijs), Ministry of Education.

**Terms**: Public education data.

---

### 8. Atlas Leefomgeving (Environmental Data)

**Provider**: RIVM (National Institute for Public Health)
**Description**: Environmental quality data
**Data Used**:
- Air quality (NO2, PM10, PM2.5)
- Noise pollution
- Flood risk
- Soil contamination sites
- Green space coverage

**License**: Varies by dataset (mostly Open Data)
**Website**: https://www.atlasleefomgeving.nl/
**Update Frequency**: Varies (annually to real-time)

**Attribution**:
> Environmental data from Atlas Leefomgeving (RIVM).

**Terms**: Public data for informational use. Check specific datasets for restrictions.

---

### 9. AHN (Actueel Hoogtebestand Nederland)

**Provider**: Rijkswaterstaat, Kadaster
**Description**: Elevation data (for flood risk analysis)
**Data Used**:
- Digital elevation models
- Flood susceptibility indicators

**License**: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
**Website**: https://www.ahn.nl/
**Update Frequency**: Every 6 years

**Attribution**:
> Elevation data from AHN (Actueel Hoogtebestand Nederland).

**Terms**: Free use, no restrictions.

---

### 10. KNMI (Royal Netherlands Meteorological Institute)

**Provider**: KNMI
**Description**: Climate and weather data
**Data Used**:
- Average sunshine hours
- Precipitation data
- Wind exposure
- Historical climate trends

**License**: Open Data
**Website**: https://www.knmi.nl/klimatologie/
**Update Frequency**: Monthly/annually

**Attribution**:
> Climate data provided by KNMI (Koninklijk Nederlands Meteorologisch Instituut).

**Terms**: Free for non-commercial and commercial use with attribution.

---

## Supporting Data Sources

### OpenStreetMap

**Description**: Community-driven map data
**Data Used**:
- Road networks (for travel time calculations)
- Points of interest
- Public transport stops

**License**: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
**Website**: https://www.openstreetmap.org/

**Attribution**:
> Map data © OpenStreetMap contributors. Licensed under ODbL.

**Terms**: Free to use. If displaying OSM data, must include attribution.

---

### NS (Nederlandse Spoorwegen)

**Description**: Dutch railway company
**Data Used**:
- Train station locations
- Timetables (GTFS format)

**License**: Open Data (GTFS)
**Website**: https://www.ns.nl/reisinformatie/ns-api
**Update Frequency**: As needed

**Attribution**:
> Train data provided by NS (Nederlandse Spoorwegen).

---

## Map Rendering

### MapLibre GL JS

**Description**: Open-source map rendering library
**License**: BSD 3-Clause
**Repository**: https://github.com/maplibre/maplibre-gl-js

**Attribution**:
> Maps rendered using MapLibre GL JS.

---

## Software Dependencies

This project uses various open-source software libraries. For a complete list, see:
- Python dependencies: `scripts/etl/requirements.txt`
- Frontend dependencies (when available): `package.json`

All software dependencies are used under their respective open-source licenses (MIT, BSD, Apache 2.0, etc.).

---

## Data Not Included

### Funda (Real Estate Listings)

**Why not**: Terms of Service prohibit scraping. We do not collect or store Funda listings.

**Alternative**: Users can view current listings on Funda.nl directly.

---

### Kadaster Transaction History (Bulk)

**Why not**:
- Paid API (€0.50+ per query)
- Contains personal data (buyer/seller names)
- High legal risk for bulk storage

**Alternative**:
- Optional premium feature with real-time API integration
- Users query one property at a time
- No bulk storage of personal data

See [LEGAL.md](LEGAL.md) for detailed explanation.

---

## Attribution in the Application

### Map View

When displaying maps, we include:
```
© PDOK | © Kadaster | © OpenStreetMap contributors
```

### Property Details

Each data point includes source attribution:
- "WOZ value from Kadaster"
- "Livability score from Leefbaarometer"
- "Crime data from Politie.nl"

### Footer

All pages include:
```
Data sources: Kadaster (BAG, WOZ), CBS, PDOK, Leefbaarometer,
Politie.nl, RIVM, KNMI, OpenStreetMap contributors
```

---

## Compliance Statement

This project:
- ✅ Uses only publicly available data
- ✅ Provides proper attribution for all sources
- ✅ Complies with all license terms
- ✅ Respects rate limits and Terms of Service
- ✅ Does not scrape prohibited websites
- ✅ Strips personal data from bulk storage
- ✅ Includes source references in UI

We are committed to ethical data use and legal compliance. If you notice any attribution errors or licensing concerns, please [open an issue](https://github.com/yourusername/where-to-live-nl/issues).

---

## Updates

This attribution file will be updated as we add new data sources. Last updated: November 2025.

---

## Contact

For licensing questions or concerns:
- **GitHub Issues**: [Report attribution issues](https://github.com/yourusername/where-to-live-nl/issues)
- **Data Providers**: Contact them directly (links provided above)
- **Legal Questions**: Consult [LEGAL.md](LEGAL.md) or seek legal counsel

---

**Thank you to all government agencies and open data providers who make projects like this possible!** 🙏
