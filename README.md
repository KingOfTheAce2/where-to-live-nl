# where-to-live-nl - Dutch Housing Intelligence Platform

> *Empowering expats and internationals with comprehensive housing insights across the Netherlands*

**Where-to-live-nl** consolidates fragmented Dutch government data sources into a single, intuitive platform that helps you make informed decisions about where to live in the Netherlands. No more juggling 10+ Dutch-only websites or missing critical information about neighborhoods, property characteristics, and livability factors.

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

## ✨ Key Features

### 🗺️ **Intelligent Location Finder**
- Multi-destination travel time calculator (work, school, friends)
- Combine cycling + public transport routes
- Visual overlay of suitable living areas
- No real-time dependency - uses reliable estimates

### 🏘️ **Comprehensive Neighborhood Analysis**
- **Livability scores** (Leefbaarometer) - 100x100m granularity
- **Safety metrics** - Burglary and crime statistics
- **Demographics** - Age distribution, household types, income levels
- **Environmental factors** - Air quality, noise pollution, green spaces

### 🏠 **Property Intelligence**
- Building characteristics (year built, type, size)
- Energy labels and efficiency ratings
- WOZ property valuations
- **Red flag alerts**:
  - ⚠️ Erfpacht (ground lease) status
  - ⚠️ Foundation risk areas (wooden pile problems)
  - ⚠️ Flood susceptibility
  - ⚠️ Soil contamination history

### 👨‍👩‍👧‍👦 **Family-Friendly Insights**
- Nearby schools (primary, secondary, international)
- Playgrounds and parks
- Daycare facilities
- Healthcare access

### 📊 **Data-Driven Scores**
A simple 0-10 composite score based on:
- Travel time fit (your priorities)
- Neighborhood livability
- Safety index
- Environmental quality
- Value for money
- Family friendliness

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

## 🛠️ Development Roadmap

### Phase 1: MVP (Current)
- [x] Data ingestion pipeline
- [x] Basic map interface
- [x] Travel time calculator
- [x] Livability scores display
- [ ] Property search by address
- [ ] Neighborhood comparison

### Phase 2: Enhanced Features
- [ ] User accounts (save searches)
- [ ] Email alerts for new properties
- [ ] Mobile app (React Native)
- [ ] Multi-language support (EN/NL)
- [ ] Foundation risk database (crowdsourced)

### Phase 3: Premium Features
- [ ] Kadaster integration (paid API)
- [ ] Historical price trends
- [ ] Predictive pricing model
- [ ] Erfpacht calculator
- [ ] Community forum

---

## 📖 Documentation

Comprehensive guides for understanding and contributing to the project:

- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Your first steps (10-minute setup)
- **[LEGAL.md](LEGAL.md)** - ⚖️ Kadaster, GDPR & compliance guide (READ FIRST!)
- **[ROADMAP.md](ROADMAP.md)** - 52-week development plan with detailed tasks
- **[PRICING.md](PRICING.md)** - Complete cost analysis ($0-5/month hosting!)
- **[DATA_STORAGE.md](DATA_STORAGE.md)** - JSON vs Parquet vs PostgreSQL guide
- **[MAPPING.md](MAPPING.md)** - How to use PDOK + MapLibre (free, no vendor lock-in)
- **[scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)** - ETL pipeline setup guide

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute

1. **Data quality**: Report inaccuracies or outdated information
2. **Foundation problems**: Submit known areas with wooden pile issues
3. **Translations**: Help translate to Dutch, Spanish, French, etc.
4. **Code**: Submit PRs for features or bug fixes
5. **Documentation**: Improve guides and explanations

### Development Guidelines

- Write tests for new features
- Follow existing code style (Prettier + ESLint)
- Update documentation with changes
- Keep commits atomic and well-described

---

## 📊 Data Attribution

This project uses open data from Dutch government sources. We comply with all licensing requirements:

- **BAG**: Kadaster - CC0 License
- **CBS**: Centraal Bureau voor de Statistiek - CC-BY 4.0
- **Crime Data**: Politie Nederland - Open Data
- **Leefbaarometer**: Ministerie van Binnenlandse Zaken

Full attribution details: [ATTRIBUTION.md](ATTRIBUTION.md)

---

## 🔒 Privacy & GDPR

- **No personal data collection** without explicit consent
- **No tracking** beyond anonymous analytics (optional)
- **Local-first**: Searches happen client-side when possible
- **Transparent**: Open-source codebase

See [PRIVACY.md](PRIVACY.md) for full policy.

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

## 🐛 Known Issues

- Erfpacht data may be incomplete (Kadaster API required for full coverage)
- Foundation risk areas based on construction period heuristics
- Travel times are estimates, not real-time calculations
- Some rural areas have limited data coverage

See the [GitHub Issues](https://github.com/yourusername/where-to-live-nl/issues) page for a full list.

---

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/where-to-live-nl/wiki) (coming soon)
- **Issues**: [GitHub Issues](https://github.com/yourusername/where-to-live-nl/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/where-to-live-nl/discussions)
- **Documentation Index**: [DOCS_INDEX.md](DOCS_INDEX.md)

---

## 📜 License

This project is licensed under the **MIT License** - see [LICENSE.md](LICENSE.md) for details.

Data sources may have different licenses - see [ATTRIBUTION.md](ATTRIBUTION.md).

---

## 🙏 Acknowledgments

- Dutch government for open data initiatives
- OpenStreetMap contributors
- TravelTime Platform for algorithm inspiration
- I amsterdam for MapitOut concept
- All contributors and beta testers

---

## 🌟 Star History

If this project helps you, please consider giving it a ⭐️!

---

**Built with ❤️ for expats navigating the Dutch housing market**

*Last updated: November 2025*
