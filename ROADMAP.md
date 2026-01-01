# Where-to-Live-NL: Development Roadmap

> **Last Updated**: December 24, 2025
> **Project Status**: MVP Complete (~95%) - Pre-Launch
> **Target Launch**: Q1 2026 (Paid Beta)

---

## Project Overview

**Where-to-Live-NL** is a comprehensive housing intelligence platform for the Netherlands, consolidating fragmented government data into actionable insights for property seekers.

### Target Audience
- **Primary**: Expats relocating to the Netherlands
- **Secondary**: International students, returning Dutch nationals
- **Tertiary**: Real estate professionals, relocation companies

### Business Model
- **Freemium**: Basic features free, premium features require subscription
- **Subscription Tiers**: Basic / Pro / Enterprise
- **Revenue Focus**: Monetization-first strategy for sustainability

### Software License
This is **proprietary software** with source code available for transparency. See [LICENSE.md](LICENSE.md) for full terms.

---

## Current Status: What's Working

### Map Layers (30+ active)
- Livability scores & trends (Leefbaarometer)
- Crime statistics overlay
- Flood risk zones & depth visualization
- Foundation risk overlay
- Air quality (historical + real-time)
- Noise pollution (road, rail, air)
- National Parks & Natura 2000 areas
- Schools (15,000+ across all levels)
- Supermarkets, healthcare, playgrounds
- Public transport (train, metro, tram)
- Neighborhood boundaries

### Features
- Multi-language support (10 languages)
- Address search with autocomplete
- Travel time calculator with isochrones
- 3D building viewer (CesiumJS)
- Red Flags dashboard
- WWS Calculator (rental points)
- Interactive guide
- PDF export

---

## Priority: Monetization & Launch

### Immediate Priorities (Q1 2026)

#### 1. User-Submitted Asking Prices (HIGH PRIORITY)
**Goal**: Build property price database for market intelligence

- [ ] Create price submission form (address + asking price + source URL)
- [ ] User account required for submissions
- [ ] Verification workflow (screenshot upload, URL validation)
- [ ] Display aggregated price data on map
- [ ] Compare asking prices vs WOZ values
- [ ] Premium feature: Price trend analysis

#### 2. User Accounts & Subscription System
- [ ] Supabase authentication integration
- [ ] Subscription tiers (Stripe integration)
- [ ] Saved locations & searches
- [ ] Email notifications for saved areas
- [ ] Usage tracking & limits for free tier

#### 3. Production Deployment
- [ ] Deploy frontend (Vercel)
- [ ] Deploy backend (Railway/Render)
- [ ] Set up Cloudflare CDN
- [ ] Configure monitoring & error tracking
- [ ] GDPR compliance (cookie consent, privacy policy)

---

## Remaining Data Integration

### Environmental Data
- [ ] **Soil contamination sites** - Bodemloket data integration
- [ ] **KNMI climate data** - Temperature, precipitation, sunshine hours

### Property Data (Premium Features)
- [ ] **Kadaster transaction history** - Requires API subscription
- [ ] **Erfpacht (ground lease)** - Municipality-specific rules
- [ ] **Energy label database** - EP-Online integration
- [ ] **BAG floor area data** - Building registry details

---

## Premium Feature Roadmap

### Tier 1: Pro Subscription
- Unlimited saved locations
- Price comparison tools
- Historical price trends
- PDF reports with detailed analysis
- API access (rate-limited)

### Tier 2: Enterprise
- Team accounts
- Bulk data exports
- Custom integrations
- Priority support
- White-label options

---

## Technical Debt & Improvements

### Performance
- [ ] CDN caching optimization
- [ ] Bundle size reduction
- [ ] Service worker for offline support
- [ ] Lazy loading for map layers

### Quality
- [ ] Comprehensive test suite
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Security audit
- [ ] Error monitoring (Sentry)

---

## Future Considerations (2027+)

- Mobile app (React Native)
- Belgium/Germany expansion
- B2B relocation services
- AI neighborhood recommendations
- Integration with rental platforms

---

## Data Attribution

See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for complete list of data sources and their licenses.

---

**Document Version**: 3.0
**Last Updated**: December 24, 2025
**Next Review**: January 15, 2026

*This roadmap reflects current priorities and may change based on user feedback and business needs.*
