# Where-to-Live-NL - Dutch Housing Intelligence Platform

> *Comprehensive housing insights across the Netherlands*

**Where-to-live-nl** consolidates fragmented Dutch government data sources into a single platform that helps you make informed decisions about where to live in the Netherlands. No more juggling 10+ Dutch-only websites or missing critical information about neighborhoods, property characteristics, and livability factors.

**⚠️ PROPRIETARY SOFTWARE** - See [LICENSE.md](LICENSE.md) for usage restrictions.

---

## Project Status

| Milestone | Target | Status |
|-----------|--------|--------|
| **MVP** | Q1 2026 | 🟢 ~95% Complete |
| **v1.0** | Q2 2026 | 🟡 In Progress |

### What's Working Now

**Map & Visualization**
- Interactive map with **30+ data layers**
- Address autocomplete (PDOK Locatieserver)
- 3D building viewer (CesiumJS)
- Aerial/satellite imagery toggle
- PDF export for location analysis

**Property Intelligence**
- Property details with WOZ values (2.2M+ records)
- Energy labels (2.26M from EP-Online)
- Building info from BAG registry
- Red Flags card (critical issues dashboard)

**Environment & Safety**
- Livability scores (Leefbaarometer) + trends
- Crime statistics by neighborhood
- Flood risk zones (multiple scenarios + depth)
- Foundation risk warnings
- Air quality overlays (NO2, PM10, PM2.5, O3)
- Real-time air quality stations
- Noise pollution (road, rail, air traffic)

**Nature & Recreation**
- National Parks (21 parks)
- Natura 2000 protected areas (162 sites)
- Drone no-fly zones
- Playgrounds & Speelbossen (forest playgrounds)

**Schools & Education (15,269 schools)**
- Primary, secondary, MBO, HBO, WO
- Special education schools
- Filterable by type

**Transport & Amenities**
- Train stations (NS + regional)
- Metro stations & lines
- Tram stops & lines
- Supermarkets (6,049 stores)
- Healthcare facilities

**Tools & Features**
- Travel time calculator (isochrones)
- WWS Calculator (rental points system)
- Neighborhood comparison
- Interactive guide with Dutch terminology
- **10 languages** (EN, NL, DE, FR, ES, IT, PT, PL, RU, UK)

### Coming Soon
- User accounts & saved searches
- Erfpacht (ground lease) warnings
- Email alerts for saved locations

---

## 🎯 Problem Statement

When searching for housing in the Netherlands, expats face:

- **Language barriers**: Most resources are Dutch-only
- **Data fragmentation**: Information scattered across 10+ government websites
- **Hidden surprises**: Erfpacht (ground lease), foundation problems, flood risks
- **Complex calculations**: Travel times, livability scores, safety metrics
- **Information overload**: Difficulty prioritizing what matters

Where-to-Live-NL solves this by aggregating public data into actionable insights.

---

## ✨ Features

### 🗺️ **Interactive Map** ✅
- MapLibre GL + PDOK Dutch government tiles (free, unlimited)
- **30+ toggleable data layers** organized by category
- Address autocomplete with instant results
- Click any location for detailed insights
- Aerial/satellite imagery toggle
- **3D building viewer** (CesiumJS integration)

### 🚗 **Travel Time Calculator** ✅
- OpenRouteService API integration with caching
- Car, bike, and walking modes
- Add multiple destinations (work, school, gym)
- Visual isochrone overlays

### 🏘️ **Neighborhood Analysis** ✅
- **Livability scores** (Leefbaarometer) - 100x100m granularity
- **Livability trends** - See how neighborhoods changed over time
- **Safety metrics** - Burglary and crime statistics per neighborhood
- **Demographics** - Age distribution, household types, income levels
- **Environmental factors** - Air quality (RIVM), noise pollution overlays

### 🏠 **Property Intelligence** ✅
- Building characteristics (year built, type, size)
- Energy labels (2.26M properties from EP-Online)
- WOZ property valuations (2.2M+ records)
- **Red Flags Dashboard** - Consolidated critical issues view:
  - ⚠️ Foundation risk areas (funderingsproblematiek)
  - ⚠️ Flood risk zones (multiple scenarios + depth)
  - ⚠️ Air quality warnings
  - 🔜 Erfpacht (ground lease) warnings

### 🌳 **Nature & Environment** ✅
- **National Parks** (21 parks from PDOK)
- **Natura 2000** protected areas (162 EU-protected sites)
- Drone no-fly zones
- Air quality: historical overlays + real-time stations
- Noise pollution (road, rail, air traffic)

### 👨‍👩‍👧‍👦 **Family-Friendly Insights** ✅
- **15,269 schools** (primary, secondary, MBO, HBO, WO, special ed)
- Playgrounds (speeltuinen)
- **Speelbossen** - Forest playgrounds
- Healthcare facilities (hospitals, GPs, pharmacies)

### 🚆 **Public Transport** ✅
- Train stations (NS + regional)
- Metro stations & lines
- Tram stops & lines
- Travel time isochrones

### 🌍 **Multi-Language** ✅
10 languages: English, Dutch, German, French, Spanish, Italian, Portuguese, Polish, Russian, Ukrainian

### 📊 **Comparison & Export Tools** ✅
- Side-by-side neighborhood comparison
- House vs house comparison
- **PDF export** for location analysis
- Interactive guide with Dutch terminology explained

---

## 📚 Data Sources

All data comes from **free, open government sources** - no web scraping, no Terms of Service violations.

| Data Source | Information | License |
|-------------|-------------|---------|
| [BAG](https://api.pdok.nl/bzk/bag/v2/) | Buildings, addresses, energy labels | CC0 |
| [CBS](https://opendata.cbs.nl/) | Demographics, statistics | CC-BY |
| [Leefbaarometer](https://www.leefbaarometer.nl/) | Livability scores | Open Data |
| [Politie.nl](https://data.politie.nl/) | Crime statistics | Open Data |
| [Atlas Leefomgeving](https://www.atlasleefomgeving.nl/) | Environmental data | Varies |
| [DUO](https://duo.nl/open_onderwijsdata/) | School locations | Open Data |
| [PDOK](https://www.pdok.nl/) | Geospatial infrastructure | CC0 |
| [WOZ Waardeloket](https://www.wozwaardeloket.nl/) | Property valuations | Public |
| [AHN](https://www.ahn.nl/) | Elevation/flood risk | CC0 |
| [KNMI](https://www.knmi.nl/klimatologie/) | Climate data | Open Data |

### What We Don't Include (and Why)

❌ **Funda listings** - Terms of Service prohibit scraping  
❌ **Real-time travel data** - Static estimates are sufficient and free  
❌ **Kadaster transaction history** - Paid API (potential premium feature)

---

## 🏗️ Technical Architecture

### Stack Overview
```
┌─────────────────────────────────────────┐
│     Frontend (Vercel)                   │
│   • React/Next.js                       │
│   • MapLibre GL JS                      │
│   • PDOK Maps (Dutch govt)              │
│   • Tailwind CSS                        │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   API Layer (Cloudflare Workers)        │
│   • Serverless functions                │
│   • Edge-optimized                      │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   Storage (Cloudflare R2)               │
│   • Static datasets (5-7 GB)            │
│   • Vector tiles (PMTiles)              │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   Database (Supabase)                   │
│   • User accounts & subscriptions       │
│   • Saved searches                      │
│   • Payment processing                  │
└─────────────────────────────────────────┘
```

### Data Pipeline
```
Government APIs → ETL Scripts → Processed Data → Cloudflare R2 → CDN → User
     (Daily)      (GitHub Actions)  (Optimized)    (Storage)   (Fast)  (Browser)
```

### Storage Requirements

| Dataset | Size | Frequency |
|---------|------|-----------|
| BAG (Buildings) | 500 MB - 2 GB | Quarterly |
| CBS Demographics | 50-100 MB | Annually |
| Leefbaarometer | 300-500 MB | Annually |
| Crime Statistics | 50-100 MB | Quarterly |
| Environmental Layers | 1-2 GB | Annually |
| School Locations | 10-20 MB | Annually |
| Boundaries/Geometry | 200-500 MB | Rarely |
| **Total** | **~5-7 GB** | - |

---

## 🚀 Getting Started

### Quick Start (10 Minutes)

**Step 1: Data Collection** (Start here!)

```bash
# Navigate to ETL scripts
cd scripts/etl

# Set up Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download sample BAG data (100 addresses)
python -m ingest.bag --sample 100

# Transform to Parquet
python -m transform.bag_to_parquet
```

**See complete guide**: [GETTING_STARTED.md](GETTING_STARTED.md)

**Detailed ETL docs**: [scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)

---

### Frontend Setup

```bash
# Prerequisites
node >= 18.x
npm >= 9.x
git
python >= 3.9 (for backend)

# Clone the repository
git clone https://github.com/yourusername/where-to-live-nl.git
cd where-to-live-nl

# Start the backend API
cd backend
pip install -r requirements.txt
python api_server.py
# Backend runs on http://localhost:8000

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

Visit `http://localhost:3000`

---

## 📂 Project Structure
```
where-to-live-nl/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   │   ├── map/            # Map-related components (MapLibre)
│   │   ├── search/         # Search functionality
│   │   └── property/       # Property details
│   ├── lib/                # Utilities and helpers
│   │   ├── data/           # Data processing
│   │   └── api/            # API clients
│   └── styles/             # CSS/Tailwind
├── scripts/
│   ├── etl/                # Extract-Transform-Load
│   │   ├── bag.js          # BAG data processing
│   │   ├── cbs.js          # CBS demographics
│   │   ├── leefbaarometer.js
│   │   └── crime.js
│   └── deploy/             # Deployment scripts
├── data/
│   ├── raw/                # Downloaded datasets
│   ├── processed/          # Cleaned data (Parquet)
│   └── tiles/              # Vector tiles (if self-hosting)
├── public/
│   └── static/             # Static assets
├── workers/                # Cloudflare Workers
│   └── api/                # Serverless functions
├── ROADMAP.md              # Detailed development plan
├── PRICING.md              # Cost analysis & free hosting guide
├── DATA_STORAGE.md         # JSON vs Parquet vs SQL guide
└── MAPPING.md              # Complete mapping implementation guide
```

---

## 🛠️ Development Status

### Phase 1: MVP ✅ ~95% Complete
- [x] Data ingestion pipeline (30+ datasets)
- [x] Interactive map interface (MapLibre + PDOK)
- [x] Travel time calculator (OpenRouteService)
- [x] Livability scores display (Leefbaarometer)
- [x] Livability trends (change over time)
- [x] School data integration (15,269 schools from DUO)
- [x] Supermarket locations (6,049 stores)
- [x] Energy labels (2.26M properties)
- [x] WOZ valuations (2.2M+ records)
- [x] Flood risk overlay (multiple scenarios)
- [x] Flood depth visualization
- [x] Crime statistics overlay
- [x] Address autocomplete with PDOK Locatieserver
- [x] Neighborhood comparison panel
- [x] Air quality overlay (NO2, PM10, PM2.5, O3)
- [x] Real-time air quality stations
- [x] Noise pollution overlay
- [x] Healthcare facilities map
- [x] Foundation risk database
- [x] Train stations layer
- [x] Metro stations & lines
- [x] Tram stops & lines
- [x] Playgrounds & Speelbossen
- [x] National Parks (21 parks)
- [x] Natura 2000 areas (162 sites)
- [x] Drone no-fly zones
- [x] Cadastral parcels
- [x] Multi-language support (10 languages)
- [x] Property filters (price, type, year)
- [x] WWS Calculator (rental points system)
- [x] 3D building viewer (CesiumJS)
- [x] PDF export
- [x] Red Flags dashboard
- [x] Interactive guide (/guide)
- [ ] Erfpacht warnings

### Phase 2: Enhanced Features (In Progress)
- [ ] User accounts (save searches)
- [ ] Saved location alerts
- [x] Neighborhood boundary highlighting

### Phase 3: Premium Features
- [ ] Kadaster integration (paid API)
- [ ] Historical price trends

### Phase 4: Future
- [ ] Mobile app
- [ ] Predictive pricing model
- [ ] Community reviews

See **[ROADMAP.md](ROADMAP.md)** for detailed development plan and **[docs/PRICING.md](docs/PRICING.md)** for hosting costs.

---

## 📖 Documentation

### Essential Documentation (Root)
- **[README.md](README.md)** - Project overview (you are here!)
- **[ROADMAP.md](ROADMAP.md)** - Development roadmap
- **[LEGAL.md](LEGAL.md)** - ⚖️ Kadaster, GDPR & compliance guide
- **[LICENSE.md](LICENSE.md)** - Software license

### Getting Started
- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Your first steps (10-minute setup)
- **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** - Comprehensive setup guide
- **[docs/DEV_SETUP.md](docs/DEV_SETUP.md)** - Development environment configuration

### Deployment & Production
- **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** - Complete deployment instructions (Vercel + Railway)
- **[docs/PRODUCTION_READY.md](docs/PRODUCTION_READY.md)** - Production launch checklist
- **[docs/KADASTER_AND_STRIPE_SETUP.md](docs/KADASTER_AND_STRIPE_SETUP.md)** - Premium feature setup

### Features & Data
- **[docs/KADASTER_PREMIUM_FEATURE.md](docs/KADASTER_PREMIUM_FEATURE.md)** - Premium Kadaster integration design
- **[docs/DUO_SCHOOLS_INGESTION.md](docs/DUO_SCHOOLS_INGESTION.md)** - Official school data (7,325 schools)
- **[docs/DATA_ACCURACY_AUDIT.md](docs/DATA_ACCURACY_AUDIT.md)** - Data quality audit & fixes

### Data & ETL
- **[scripts/etl/README.md](scripts/etl/README.md)** - ETL pipeline documentation
- **[docs/guides/](docs/guides/)** - Detailed guides
  - [COORDINATE_ENRICHMENT_GUIDE.md](docs/guides/COORDINATE_ENRICHMENT_GUIDE.md)
  - [FRONTEND_DEVELOPMENT_GUIDE.md](docs/guides/FRONTEND_DEVELOPMENT_GUIDE.md)
  - [QUICKSTART_WOZ_HISTORICAL.md](docs/guides/QUICKSTART_WOZ_HISTORICAL.md)

### Technical Documentation
- **[docs/technical/](docs/technical/)** - Technical specifications
  - [DATA_STORAGE.md](docs/technical/DATA_STORAGE.md) - JSON vs Parquet vs PostgreSQL
  - [KADASTER_INTEGRATION.md](docs/technical/KADASTER_INTEGRATION.md)
  - [MAPPING.md](docs/technical/MAPPING.md) - PDOK + MapLibre implementation
  - [WOZ_HISTORICAL_DATA.md](docs/technical/WOZ_HISTORICAL_DATA.md)

### Session Summaries
- **[docs/summaries/](docs/summaries/)** - Development session notes and data source fixes

---

## 📊 Data Sources

This project uses public data from Dutch government sources:

- **BAG (Addresses & Buildings)**: Kadaster - CC0 License
- **WOZ (Property Valuations)**: Kadaster - Public Information
- **CBS (Demographics & Crime)**: Statistics Netherlands - CC-BY 4.0
- **Leefbaarometer (Livability)**: Ministerie van Binnenlandse Zaken - Open Data
- **OpenStreetMap (Amenities)**: OSM Contributors - ODbL

For detailed information about all data sources and how to ingest them:
- **[DATA_SOURCES_SUMMARY.md](DATA_SOURCES_SUMMARY.md)** - Complete guide to all available data
- **[scripts/etl/README.md](scripts/etl/README.md)** - ETL pipeline documentation

**Note**: While the underlying public data may be freely used under their respective licenses, this software implementation is proprietary. See [LICENSE.md](LICENSE.md).

---

## ⚖️ Legal Disclaimer

This tool provides **informational estimates** based on public data sources. It is NOT:

- ❌ A substitute for professional housing advice
- ❌ A guarantee of property conditions
- ❌ Legal advice regarding contracts or obligations
- ❌ Real-time data (updates vary by source)

**Always verify critical information** with:
- Official Kadaster records
- Property inspections
- Legal professionals
- Municipal authorities

---

## 🐛 Known Limitations

- **Erfpacht**: Not yet implemented - Kadaster API required for full coverage
- **Properties coverage**: ~400K addresses currently (expanding)
- **Foundation risk**: Based on known risk areas + construction period heuristics
- **Travel times**: Cached estimates via OpenRouteService (not real-time)
- **Energy labels**: Looked up on-demand from 2.26M record database

See the [GitHub Issues](https://github.com/yourusername/where-to-live-nl/issues) page for a full list.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/where-to-live-nl/issues)
- **Data Sources Guide**: [DATA_SOURCES_SUMMARY.md](DATA_SOURCES_SUMMARY.md)

---

## 📜 License

This software is **proprietary** - see [LICENSE.md](LICENSE.md) for usage restrictions.

The underlying public data sources remain under their original open licenses.

---

## 🙏 Acknowledgments

- Dutch government for open data initiatives (BAG, CBS, PDOK)
- OpenStreetMap contributors
- Statistics Netherlands (CBS) for demographics and crime data
- Kadaster for WOZ and property data

---

**Built for navigating the Dutch housing market**

*Last updated: December 24, 2025*
