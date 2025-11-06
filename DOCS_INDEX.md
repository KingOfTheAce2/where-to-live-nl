# Documentation Index

Welcome to the Where-to-Live-NL documentation! This index helps you navigate all available documentation and find what you need quickly.

---

## 🚀 Getting Started (Start Here!)

New to the project? Follow this path:

1. **[README.md](README.md)** - Project overview and key features
2. **[GETTING_STARTED.md](GETTING_STARTED.md)** - 10-minute quick start guide
3. **[scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)** - ETL pipeline setup (5 minutes)
4. **[ROADMAP.md](ROADMAP.md)** - Development plan and next steps

---

## 📚 Core Documentation

### Project Overview
- **[README.md](README.md)** - Main project documentation
  - Problem statement
  - Key features
  - Technical architecture
  - Data sources
  - Quick start

- **[SUMMARY.md](SUMMARY.md)** - Project summary and accomplishments
  - What's ready now
  - Legal framework
  - Safe features to build
  - Next steps

---

### Getting Started
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Setup guide (10 minutes)
  - Python environment setup
  - Download sample data
  - Transform to Parquet
  - Query your data

---

### Development Planning
- **[ROADMAP.md](ROADMAP.md)** - 52-week development plan
  - Phase 0: Foundation (Weeks 1-4)
  - Phase 1: MVP (Weeks 5-12) ← **Current phase**
  - Phase 2: Enhanced features (Weeks 13-20)
  - Phase 3: Premium features (Weeks 21-30)
  - Phase 4: Community (Weeks 31-40)
  - Phase 5: Polish & scale (Weeks 41-52)

---

## 🔧 Technical Documentation

### ETL Pipeline
- **[scripts/etl/README.md](scripts/etl/README.md)** - ETL pipeline documentation
  - Overview and architecture
  - Directory structure
  - Data flow (JSON → Parquet)
  - Running scripts

- **[scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)** - Quick setup (5 minutes)
  - Install dependencies
  - Download BAG data
  - Download WOZ data
  - Transform to Parquet
  - Example queries

---

### Data & Storage
- **[DATA_STORAGE.md](DATA_STORAGE.md)** - Storage decision guide
  - JSON vs Parquet vs PostgreSQL
  - When to use each format
  - Performance benchmarks
  - Size comparisons
  - Query patterns

- **[WOZ_HISTORICAL_DATA.md](WOZ_HISTORICAL_DATA.md)** - WOZ data guide
  - What is WOZ?
  - How to scrape historical values
  - Legal considerations
  - Data structure

- **[QUICKSTART_WOZ_HISTORICAL.md](QUICKSTART_WOZ_HISTORICAL.md)** - WOZ quick start
  - Download historical WOZ data
  - Checkpoint/resume functionality
  - Example usage

---

### Mapping & Geospatial
- **[MAPPING.md](MAPPING.md)** - Complete mapping implementation guide
  - MapLibre GL JS setup (free, no API key!)
  - PDOK base maps (Dutch government tiles)
  - Geocoding with PDOK Locatieserver
  - Vector tiles
  - Styling and customization

---

### Infrastructure & Costs
- **[PRICING.md](PRICING.md)** - Cost analysis & hosting guide
  - Free tier options (Vercel, Cloudflare, Supabase)
  - Scaling costs (0-100K+ users)
  - Near-free hosting strategy ($0-5/month)
  - Service comparisons

---

## ⚖️ Legal & Compliance

- **[LEGAL.md](LEGAL.md)** - ⚠️ **READ BEFORE LAUNCHING**
  - Kadaster license terms
  - GDPR compliance requirements
  - Dutch Data Protection Authority guidance
  - Risk assessment
  - What's safe to build
  - What to avoid

- **[KADASTER_INTEGRATION.md](KADASTER_INTEGRATION.md)** - Kadaster data usage
  - API documentation
  - License terms
  - Commercial use guidelines
  - Privacy considerations

- **[PRIVACY.md](PRIVACY.md)** - Privacy policy (GDPR-compliant)
  - What data we collect
  - How we use it
  - Your privacy rights
  - Data retention
  - Contact information

- **[ATTRIBUTION.md](ATTRIBUTION.md)** - Data source attribution
  - All data providers
  - License information
  - Required attributions
  - Compliance statement

- **[LICENSE.md](LICENSE.md)** - MIT License
  - Software license
  - Data licenses
  - Third-party library licenses
  - Disclaimer

---

## 🤝 Contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
  - Code of conduct
  - How to contribute
  - Development setup
  - Coding standards
  - Commit guidelines
  - Pull request process

---

## 📋 Documentation by Use Case

### "I want to understand the project"
1. [README.md](README.md) - Overview
2. [SUMMARY.md](SUMMARY.md) - What's ready now
3. [ROADMAP.md](ROADMAP.md) - Development plan

### "I want to get started coding"
1. [GETTING_STARTED.md](GETTING_STARTED.md) - Setup
2. [scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md) - ETL quick start
3. [scripts/etl/README.md](scripts/etl/README.md) - ETL documentation

### "I want to understand data storage"
1. [DATA_STORAGE.md](DATA_STORAGE.md) - Storage decisions
2. [WOZ_HISTORICAL_DATA.md](WOZ_HISTORICAL_DATA.md) - WOZ data
3. [scripts/etl/README.md](scripts/etl/README.md) - Data pipeline

### "I want to build the map interface"
1. [MAPPING.md](MAPPING.md) - Mapping guide
2. [ROADMAP.md](ROADMAP.md#12-map-interface) - Map implementation plan

### "I want to understand costs"
1. [PRICING.md](PRICING.md) - Cost analysis
2. [ROADMAP.md](ROADMAP.md) - Infrastructure requirements

### "I want to ensure legal compliance"
1. [LEGAL.md](LEGAL.md) - ⚠️ **Must read!**
2. [KADASTER_INTEGRATION.md](KADASTER_INTEGRATION.md) - Kadaster terms
3. [PRIVACY.md](PRIVACY.md) - GDPR compliance
4. [ATTRIBUTION.md](ATTRIBUTION.md) - Data attribution

### "I want to contribute"
1. [CONTRIBUTING.md](CONTRIBUTING.md) - Guidelines
2. [ROADMAP.md](ROADMAP.md) - What needs to be built
3. [scripts/etl/README.md](scripts/etl/README.md) - ETL architecture

---

## 📊 Documentation Overview

| Document | Size | Purpose | Audience |
|----------|------|---------|----------|
| [README.md](README.md) | 14 KB | Project overview | Everyone |
| [GETTING_STARTED.md](GETTING_STARTED.md) | 11 KB | Quick start | New developers |
| [ROADMAP.md](ROADMAP.md) | 30 KB | Development plan | Contributors |
| [LEGAL.md](LEGAL.md) | 18 KB | Legal compliance | **Everyone** (must read!) |
| [PRICING.md](PRICING.md) | 19 KB | Cost analysis | Project planners |
| [DATA_STORAGE.md](DATA_STORAGE.md) | 19 KB | Storage guide | Backend developers |
| [MAPPING.md](MAPPING.md) | 25 KB | Mapping guide | Frontend developers |
| [KADASTER_INTEGRATION.md](KADASTER_INTEGRATION.md) | 17 KB | Kadaster API | Backend developers |
| [WOZ_HISTORICAL_DATA.md](WOZ_HISTORICAL_DATA.md) | 7.5 KB | WOZ data | Data engineers |
| [QUICKSTART_WOZ_HISTORICAL.md](QUICKSTART_WOZ_HISTORICAL.md) | 5.2 KB | WOZ quick start | Data engineers |
| [SUMMARY.md](SUMMARY.md) | 12 KB | Project summary | Everyone |
| [CONTRIBUTING.md](CONTRIBUTING.md) | New | Contribution guide | Contributors |
| [ATTRIBUTION.md](ATTRIBUTION.md) | New | Data attribution | Everyone |
| [PRIVACY.md](PRIVACY.md) | New | Privacy policy | Users, legal |
| [LICENSE.md](LICENSE.md) | New | MIT License | Everyone |
| [scripts/etl/README.md](scripts/etl/README.md) | 12+ KB | ETL docs | Data engineers |
| [scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md) | 9+ KB | ETL quick start | Data engineers |

**Total**: ~180 KB of comprehensive documentation

---

## 🔍 Quick Reference

### Most Important Documents (Read First!)
1. ⚖️ **[LEGAL.md](LEGAL.md)** - Compliance requirements
2. 🚀 **[GETTING_STARTED.md](GETTING_STARTED.md)** - Setup guide
3. 📋 **[ROADMAP.md](ROADMAP.md)** - What to build

### Data Collection
- **BAG**: [scripts/etl/README.md](scripts/etl/README.md)
- **WOZ**: [WOZ_HISTORICAL_DATA.md](WOZ_HISTORICAL_DATA.md)
- **Storage**: [DATA_STORAGE.md](DATA_STORAGE.md)

### Implementation
- **ETL Pipeline**: [scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)
- **Map Interface**: [MAPPING.md](MAPPING.md)
- **Hosting**: [PRICING.md](PRICING.md)

### Legal & Compliance
- **GDPR**: [LEGAL.md](LEGAL.md), [PRIVACY.md](PRIVACY.md)
- **Data Licenses**: [ATTRIBUTION.md](ATTRIBUTION.md)
- **Software License**: [LICENSE.md](LICENSE.md)

---

## 🆘 Common Questions

**"Where do I start?"**
→ [GETTING_STARTED.md](GETTING_STARTED.md)

**"Is this legal?"**
→ [LEGAL.md](LEGAL.md) (yes, with proper compliance!)

**"How much does it cost to host?"**
→ [PRICING.md](PRICING.md) ($0-5/month for most users)

**"How do I download data?"**
→ [scripts/etl/QUICKSTART.md](scripts/etl/QUICKSTART.md)

**"What's the development plan?"**
→ [ROADMAP.md](ROADMAP.md)

**"How do I contribute?"**
→ [CONTRIBUTING.md](CONTRIBUTING.md)

**"What data sources do you use?"**
→ [ATTRIBUTION.md](ATTRIBUTION.md)

**"How do I implement maps?"**
→ [MAPPING.md](MAPPING.md)

---

## 📞 Support

**Technical Questions**:
- Check relevant documentation above
- Search existing GitHub issues
- Open a new issue

**Legal Questions**:
- Read [LEGAL.md](LEGAL.md)
- Consult a qualified lawyer
- Contact Kadaster directly

**Contributing**:
- Read [CONTRIBUTING.md](CONTRIBUTING.md)
- Check [ROADMAP.md](ROADMAP.md) for tasks
- Open a pull request

---

## 🔄 Document Updates

All documentation is actively maintained. Last major update: November 2025.

To suggest improvements:
1. Open a GitHub issue
2. Submit a pull request
3. Tag with `documentation` label

---

**Happy coding!** 🚀

*This index is your map to navigating the Where-to-Live-NL documentation. Bookmark it!*
