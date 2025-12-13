# Where-to-Live-NL - Dutch Housing Intelligence Platform

> *Comprehensive housing insights across the Netherlands*

**Where-to-live-nl** consolidates fragmented Dutch government data sources into a single platform that helps you make informed decisions about where to live in the Netherlands. No more juggling 10+ Dutch-only websites or missing critical information about neighborhoods, property characteristics, and livability factors.

**⚠️ PROPRIETARY SOFTWARE** - See [LICENSE.md](LICENSE.md) for usage restrictions.

---

## Project Status

| Milestone | Target | Status |
|-----------|--------|--------|
| **MVP** | Q1 2026 | 🟡 In Progress (~85% complete) |
| **v1.0** | Q2 2026 | 🔵 Planned |

### What's Working Now
- Interactive map with 25+ data layers
- Address autocomplete (PDOK)
- Property details with WOZ values
- 2.26M energy labels
- Livability scores (Leefbaarometer)
- Crime statistics
- School locations (7,300+ schools)
- Foundation risk warnings
- Flood risk zones
- Air quality & noise overlays
- Travel time calculator (OpenRouteService)
- Neighborhood comparison
- 12 languages supported

### Coming Soon
- PDF export for comparisons (Premium)
- Erfpacht (ground lease) warnings
- User accounts & saved searches

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
- 25+ toggleable data layers
- Address autocomplete with instant results
- Click any location for detailed insights

### 🚗 **Travel Time Calculator** ✅
- OpenRouteService API integration with caching
- Car, bike, and walking modes
- Add multiple destinations (work, school, gym)
- Visual isochrone overlays

### 🏘️ **Neighborhood Analysis** ✅
- **Livability scores** (Leefbaarometer) - 100x100m granularity
- **Safety metrics** - Burglary and crime statistics per neighborhood
- **Demographics** - Age distribution, household types, income levels
- **Environmental factors** - Air quality (RIVM), noise pollution overlays

### 🏠 **Property Intelligence** ✅
- Building characteristics (year built, type, size)
- Energy labels (2.26M properties from EP-Online)
- WOZ property valuations (2.2M+ records)
- **Red flag alerts**:
  - ⚠️ Foundation risk areas (funderingsproblematiek)
  - ⚠️ Flood risk zones
  - 🔜 Erfpacht (ground lease) warnings

### 👨‍👩‍👧‍👦 **Family-Friendly Insights** ✅
- 7,300+ schools (primary, secondary, international, MBO, HBO)
- Playgrounds and parks
- Healthcare facilities (hospitals, GPs, pharmacies)
- Emergency services coverage

### 🌍 **Multi-Language** ✅
12 languages: English, Dutch, German, French, Spanish, Italian, Portuguese, Polish, Russian, Ukrainian, and more

### 📊 **Comparison Tools** ✅
- Side-by-side neighborhood comparison
- House vs house comparison
- 🔜 PDF export (Premium feature)

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
│     Frontend (Vercel - Free Tier)       │
│   • React/Next.js                       │
│   • MapLibre GL JS (open source)        │
│   • PDOK Maps (Dutch govt, free)        │
│   • Tailwind CSS                        │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   API Layer (Cloudflare Workers)        │
│   • Serverless functions                │
│   • Free tier: 100k req/day             │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   Storage (Cloudflare R2)               │
│   • Static datasets (5-7 GB)            │
│   • Vector tiles (PMTiles)              │
│   • Free tier: 10 GB storage            │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│   Database (PlanetScale/Supabase)       │
│   • User preferences                    │
│   • Saved searches                      │
│   • Free tier: 5 GB                     │
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

## 💰 Hosting Costs

### Current Architecture (Near-Free)

| Service | Tier | Cost |
|---------|------|------|
| Vercel (Frontend) | Free | $0 |
| Cloudflare Workers | Free (100k req/day) | $0 |
| Cloudflare R2 | 7 GB storage | ~$0.10/month |
| PlanetScale | Free (5 GB) | $0 |
| Domain | Annual | ~$10/year |
| **Total** | | **~$1-2/month** |

### Scaling Thresholds

- **0-10k users/month**: Completely free ✅
- **10k-100k users/month**: ~$1-5/month
- **100k+ users/month**: ~$20-50/month (upgrade to professional tier)

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

### Frontend Setup (Coming Soon)

```bash
# Prerequisites
node >= 18.x
npm >= 9.x
git

# Clone the repository
git clone https://github.com/yourusername/where-to-live-nl.git
cd where-to-live-nl

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev
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

### Phase 1: MVP (Target: Q1 2026) - 85% Complete
- [x] Data ingestion pipeline (25+ datasets)
- [x] Interactive map interface (MapLibre + PDOK)
- [x] Travel time calculator (OpenRouteService)
- [x] Livability scores display
- [x] Property search by address
- [x] Neighborhood comparison
- [x] Energy labels (2.26M properties)
- [x] WOZ valuations (2.2M+ records)
- [x] Foundation risk overlay
- [x] Flood risk overlay
- [x] Air quality & noise overlays
- [x] Schools, healthcare, amenities
- [x] 12 languages
- [ ] PDF export for comparisons
- [ ] Erfpacht warnings

### Phase 2: Enhanced Features (Target: Q2 2026)
- [ ] User accounts (save searches)
- [ ] Saved location alerts
- [ ] Kadaster integration (premium)
- [ ] Historical price trends

### Phase 3: Future
- [ ] Mobile app
- [ ] Predictive pricing model
- [ ] Community reviews

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

*Last updated: December 2025*
