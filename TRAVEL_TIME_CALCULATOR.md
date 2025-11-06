# Travel Time-Based Housing Search

> **Core Feature**: Find where to live based on multiple travel time constraints

---

## 🎯 Problem Statement

Expats relocating to the Netherlands need to find housing that's accessible to:
- **Work** (office, co-working space)
- **Partner's work** (different location)
- **School** (international schools, Dutch schools)
- **Family/friends** (social connections)
- **Amenities** (gym, grocery stores, hobbies)

Traditional search tools only filter by:
- ❌ Single location (distance from work)
- ❌ Price and square meters
- ❌ City/neighborhood name (unfamiliar to expats)

**Our Solution**: Visual map showing **exactly where you can live** to reach all your important destinations within acceptable travel times.

---

## ✨ Core Features

### 1. Multi-Destination Travel Time Calculator

**User inputs:**
- Add multiple destinations (up to 5)
- Set max travel time for each (5-60 minutes)
- Choose travel modes:
  - 🚴 Cycling only
  - 🚊 Public transport only
  - 🚴+🚊 Bike to station + public transport (most realistic!)

**System calculates:**
- Isochrones (reachable areas) for each destination
- Intersection of all isochrones (where ALL criteria are met)
- Visual overlay on map

**Example:**
```
Destination 1: Work (Amsterdam Zuidas) - Max 30 min (bike + PT)
Destination 2: School (International School Amsterdam) - Max 20 min (bike)
Destination 3: Partner's work (Utrecht CS) - Max 45 min (PT)

→ System shows areas reachable from all three within time limits
```

### 2. Property Intelligence Overlay

Show properties within reachable areas with:
- **Livability scores** (Leefbaarometer)
- **Safety metrics** (crime statistics)
- **Building age** (foundation risk indicator)
- **WOZ values** (property tax valuations)
- **Nearby schools** (primary, secondary, international)
- **Environmental quality** (air, noise, green space)

### 3. Smart Filters

**Beyond travel time:**
- Price range (WOZ-based estimates)
- Property type (apartment, house, studio)
- Building age (avoid pre-1970 for foundation risks)
- Minimum livability score
- Maximum crime rate
- Energy label (A-G)

### 4. Neighborhood Comparison

Compare neighborhoods within reachable areas:
- Side-by-side comparison (up to 3)
- Pros/cons for expats
- Average travel times to each destination
- Cost of living estimates

---

## 🗺️ Technical Architecture

### Frontend (Next.js 14 + MapLibre GL JS)

```
┌─────────────────────────────────────────┐
│         Travel Time Calculator           │
│  • Add destinations (search/click map)  │
│  • Set max times (sliders)              │
│  • Choose modes (bike/PT/both)          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      Isochrone Calculation Engine       │
│  • OpenStreetMap road network           │
│  • GTFS public transport data           │
│  • Bike speed: 15 km/h                  │
│  • PT wait time: 5 min average          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Map Visualization (MapLibre)     │
│  • PDOK base maps (free!)               │
│  • Colored isochrones (semi-transparent)│
│  • Intersection area highlighted        │
│  • Property markers with popup info     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│       Property Data Overlay             │
│  • BAG addresses                        │
│  • WOZ valuations                       │
│  • Livability scores                    │
│  • Crime statistics                     │
│  • Schools nearby                       │
└─────────────────────────────────────────┘
```

### Backend (Cloudflare Workers + R2)

```
┌─────────────────────────────────────────┐
│     Isochrone API (Cloudflare Worker)   │
│  • Pre-computed travel times            │
│  • On-demand calculation (complex)      │
│  • Response: GeoJSON polygons           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│    Data Storage (Cloudflare R2)         │
│  • Road network (OSM extract)           │
│  • PT timetables (GTFS)                 │
│  • Property data (Parquet)              │
│  • Pre-computed isochrones (cache)      │
└─────────────────────────────────────────┘
```

---

## 🚴 Travel Time Calculation Methods

### Option 1: Pre-computed Grid (Fast, Limited)

**Approach:**
- Pre-calculate travel times from grid points (500m x 500m)
- Store in database/R2
- Interpolate for exact locations

**Pros:**
- ✅ Instant response (<100ms)
- ✅ No API dependencies
- ✅ Free hosting

**Cons:**
- ❌ Storage intensive (~5 GB for NL)
- ❌ Less accurate (grid resolution)
- ❌ Needs monthly updates

### Option 2: Third-Party API (Accurate, Expensive)

**Services:**
- TravelTime Platform API (£500+/month)
- Mapbox Isochrone API ($5 per 1000 requests)
- HERE Isochrone API (similar pricing)

**Pros:**
- ✅ Very accurate
- ✅ Real-time traffic (optional)
- ✅ No data management

**Cons:**
- ❌ Expensive at scale
- ❌ Vendor lock-in
- ❌ Usage limits

### Option 3: Open-Source OSRM + GTFS (Recommended)

**Approach:**
- OSRM (Open Source Routing Machine) for bike routing
- OpenTripPlanner for public transport
- Self-hosted or serverless

**Pros:**
- ✅ Free and open source
- ✅ Accurate and customizable
- ✅ No vendor lock-in
- ✅ Commercial use allowed

**Cons:**
- ❌ Complex setup
- ❌ Requires server (or Cloudflare Worker)
- ❌ Data updates needed

**Implementation:**
```bash
# 1. Download OSM data for Netherlands
wget https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

# 2. Build OSRM graph for cycling
osrm-extract netherlands-latest.osm.pbf -p bicycle.lua
osrm-contract netherlands-latest.osrm

# 3. Run OSRM server
osrm-routed netherlands-latest.osrm

# 4. Query isochrone
curl "http://localhost:5000/isochrone/v1/bike/4.9,52.3?contours_minutes=10,20,30"
```

**Size:** ~2 GB for NL (bike + car routing)

### Option 4: Hybrid Approach (Best for MVP)

**Approach:**
1. Use **OSRM** for cycling routes (self-hosted)
2. Use **pre-computed PT grid** for public transport (GTFS processing)
3. Combine results client-side or via Cloudflare Worker

**Cost:** ~$5-10/month (Cloudflare Worker + R2 storage)

---

## 🎨 UI/UX Design

### Landing Page

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Find Your Perfect Dutch Neighborhood          │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Where do you need to be?                      │
│                                                 │
│  [🏢 Work] Amsterdam Zuidas ⏱️ 30 min [🚴🚊]   │
│  [🏫 School] ISA North      ⏱️ 20 min [🚴]     │
│  [+ Add destination]                            │
│                                                 │
│  [Show me where to live]                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Map View

```
┌─────────────────────────────────────────────────┐
│  [☰] Filters  Your Destinations ▼  [💾 Save]   │
├─────────────────────────────────────────────────┤
│                                                 │
│           🗺️ MAP WITH ISOCHRONES               │
│                                                 │
│  🟢 Green = Reachable from all destinations    │
│  🟡 Yellow = Reachable from some               │
│  🔵 Blue = Individual isochrones               │
│                                                 │
│  📍 Property markers with:                      │
│     • Price estimate                            │
│     • Livability score                          │
│     • Safety rating                             │
│                                                 │
├─────────────────────────────────────────────────┤
│  Properties in green area: 1,247               │
│  Average livability: 8.2/10                     │
│  Average travel time to work: 25 min           │
└─────────────────────────────────────────────────┘
```

### Property Detail Popup

```
┌─────────────────────────────────────────┐
│  Overtoom 123, Amsterdam                │
│  ─────────────────────────────────────  │
│  WOZ Value: €425,000                    │
│  Built: 1920 ⚠️ Foundation risk area    │
│  Type: Apartment (85 m²)                │
│                                         │
│  📊 Scores:                             │
│  • Livability: 8.4/10                   │
│  • Safety: 7.2/10                       │
│  • Environment: 8.9/10                  │
│                                         │
│  🚴 Travel Times:                        │
│  • To work: 28 min (bike + metro)       │
│  • To school: 18 min (bike)             │
│                                         │
│  🏫 Nearby:                              │
│  • 3 primary schools (5-10 min walk)    │
│  • Supermarket: 2 min walk              │
│  • Park: 5 min walk                     │
│                                         │
│  [View full details]  [Save]            │
└─────────────────────────────────────────┘
```

---

## 📊 Data Requirements

### Required Datasets (for MVP)

| Dataset | Source | Size | Update Frequency |
|---------|--------|------|------------------|
| **Road network** | OpenStreetMap | 1.5 GB | Monthly |
| **Public transport** | GTFS (NS, GVB, etc.) | 200 MB | Weekly |
| **BAG addresses** | Kadaster | 500 MB | Quarterly |
| **WOZ values** | Scraped | 150 MB | On-demand |
| **Livability scores** | Leefbaarometer | 300 MB | Annually |
| **Crime statistics** | Politie.nl | 50 MB | Quarterly |
| **School locations** | DUO | 20 MB | Annually |

**Total Storage:** ~2.7 GB (fits in Cloudflare R2 free tier!)

### Data Processing Pipeline

```bash
# 1. Download and process OSM
./scripts/download_osm.sh
./scripts/build_osrm_graph.sh

# 2. Process GTFS data
./scripts/download_gtfs.sh
./scripts/build_pt_grid.sh

# 3. Ingest property data (already done!)
python -m ingest.bag
python -m ingest.woz --sample 100000

# 4. Add new crawlers (TODO)
python -m ingest.leefbaarometer
python -m ingest.crime
python -m ingest.schools

# 5. Upload to R2
./scripts/upload_to_r2.sh
```

---

## 🚀 Implementation Plan

### Week 1: Data Crawlers
- [x] BAG addresses ✅
- [x] WOZ values ✅
- [ ] CBS demographics
- [ ] Leefbaarometer
- [ ] Crime statistics
- [ ] Schools (DUO)

### Week 2: Travel Time Backend
- [ ] Download OSM Netherlands extract
- [ ] Build OSRM routing graph (bike profile)
- [ ] Download GTFS data (NS, GVB, RET)
- [ ] Create isochrone API (Cloudflare Worker)
- [ ] Pre-compute common routes (optional)

### Week 3: Frontend Foundation
- [ ] Set up Next.js 14 project
- [ ] Install MapLibre GL JS
- [ ] Add PDOK base maps
- [ ] Implement geocoding (PDOK Locatieserver)
- [ ] Create destination input UI

### Week 4: Travel Time Calculator UI
- [ ] Build multi-destination form
- [ ] Add time sliders (5-60 min)
- [ ] Travel mode selector (bike/PT/both)
- [ ] Call isochrone API
- [ ] Display isochrones on map
- [ ] Calculate intersection area

### Week 5: Property Overlay
- [ ] Load property data (BAG + WOZ)
- [ ] Filter by reachable area
- [ ] Display markers on map
- [ ] Create property popup
- [ ] Add filters (price, type, age)

### Week 6: Polish & Deploy
- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Error handling
- [ ] Analytics
- [ ] Deploy to Vercel

---

## 💰 Cost Estimation

### Free Tier Hosting (0-5K users/month)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel (Frontend) | $0 | Free tier |
| Cloudflare Workers | $0 | 100K req/day free |
| Cloudflare R2 | $0.15/month | 3 GB storage |
| Domain | $10/year | |
| **Total** | **~$1-2/month** | |

### Scaling (10K-50K users/month)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel Pro | $20/month | Better performance |
| Cloudflare Workers | $5/month | 10M requests |
| Cloudflare R2 | $0.50/month | Same storage |
| **Total** | **~$25-30/month** | |

**No expensive APIs needed!** 🎉

---

## 🎯 Success Metrics

### User Engagement
- Average destinations per search: **2.5+**
- Searches resulting in saved properties: **30%+**
- Repeat users (30 days): **40%+**

### Technical Performance
- Isochrone calculation: **<2 seconds**
- Map load time: **<1 second**
- Property overlay: **<500ms**

### User Satisfaction
- "Found a home using this tool": **20%+**
- Would recommend: **80%+**
- Net Promoter Score: **50+**

---

## 🌟 Unique Value Propositions

### vs. Funda/Pararius
- ✅ **Visual travel time search** (they only have distance filters)
- ✅ **Multi-destination support** (they only do single location)
- ✅ **Expat-focused** (we explain Dutch housing quirks)
- ✅ **Free to use** (no subscriptions)

### vs. Google Maps "Search This Area"
- ✅ **Purpose-built for housing search**
- ✅ **Integrated property data** (livability, crime, schools)
- ✅ **Multiple constraints** (not just one location)
- ✅ **Dutch-specific insights** (erfpacht, foundation risks)

### vs. Real Estate Agents
- ✅ **Unbiased recommendations** (no commission incentive)
- ✅ **Data-driven insights** (not opinions)
- ✅ **Self-service** (search anytime)
- ✅ **Free** (agents charge fees)

---

## 📝 User Journey Example

**Sarah, 32, relocating to Netherlands for work**

1. **Arrives on site**: "Find Your Perfect Dutch Neighborhood"
2. **Adds destinations**:
   - Work: Amsterdam Zuidas
   - Partner's work: Utrecht
   - International school for kids
3. **Sets constraints**:
   - 30 min to Sarah's work (bike + metro)
   - 45 min to partner's work (train)
   - 20 min to school (bike)
4. **Sees visual map**: Green areas show where she can live
5. **Filters properties**:
   - Budget: €300K-400K
   - Apartment (not house)
   - Built after 1970 (avoid foundation issues)
   - Livability score > 7.5
6. **Browses properties**: Clicks markers to see details
7. **Saves favorites**: 5 properties bookmarked
8. **Reads insights**: "Erfpacht explained", "Foundation risks in Amsterdam"
9. **Contacts agents**: Equipped with knowledge and specific neighborhoods

**Result**: Sarah finds a home in Amstelveen that meets all criteria!

---

## 🚧 Future Enhancements (Phase 2+)

- Real-time traffic data
- Historical commute times (morning vs. evening)
- School quality ratings (not just locations)
- Community reviews ("Living in X neighborhood")
- Price predictions (ML-based)
- "Climate similar to home country" filter
- Virtual neighborhood tours
- Integration with rental platforms

---

**Let's build this!** 🏗️

Next: Start with data crawlers, then frontend MVP.
