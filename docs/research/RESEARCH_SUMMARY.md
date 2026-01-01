# PDOK Flood Risk Services - Research Summary

**Research Completed:** December 23, 2025
**Status:** ✅ Complete

---

## 📋 Quick Summary

Comprehensive research conducted on PDOK (Publieke Dienstverlening Op de Kaart) flood risk services for integration into the Where to Live NL application.

### Key Findings

**Available Datasets:** 2 primary flood datasets
1. **Overstromingen - Risicogebied** (Flood Risk Zones) - Current risk areas
2. **Overstromingen - Gebeurtenis** (Observed Events) - Historical flood events

**Service Types:**
- ✅ OGC API Features (modern, recommended)
- ✅ WMS (map visualization)
- ✅ WFS (vector data)
- ✅ ATOM (bulk download)

**Quality Assessment:**
- ✅ Complete Netherlands coverage
- ✅ INSPIRE-harmonized data
- ✅ CC0 Public Domain license (free use)
- ✅ Multiple CRS support including Dutch RD (EPSG:28992)
- ✅ Regular updates following EU directive cycles

---

## 📁 Research Documents

### 1. Comprehensive Research Report
**File:** `/workspaces/where-to-live-nl/docs/research/pdok-flood-services-research.md`

**Contents:**
- Executive summary
- Detailed service documentation (2 primary datasets)
- Legacy/deprecated services (with migration guidance)
- Related water services (3 additional datasets)
- Real-time water data sources (Rijkswaterstaat Waterinfo)
- Complementary datasets (CBS neighborhoods)
- Data quality assessment
- Service performance evaluation
- Integration recommendations
- Technical specifications
- Attribution requirements
- Testing results
- Known limitations
- References and sources

**Sections:** 14 major sections, 80+ pages of documentation

### 2. API Examples & Quick Reference
**File:** `/workspaces/where-to-live-nl/docs/research/pdok-flood-api-examples.md`

**Contents:**
- Quick start examples
- OGC API Features requests (7 common patterns)
- WMS requests (GetCapabilities, GetMap, GetFeatureInfo)
- WFS requests (GetFeature with filters)
- ATOM feed bulk downloads
- JavaScript/Node.js examples
- Python examples (requests, GeoPandas, OWSLib)
- Leaflet integration
- Common use cases (3 real-world scenarios)
- Error handling patterns
- Best practices

**Code Examples:** 20+ working code snippets

---

## 🎯 Primary Service Endpoints

### Flood Risk Zones (Risicogebied)

```
OGC API:  https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1
WMS:      https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0
WFS:      https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0
ATOM:     https://service.pdok.nl/rws/overstromingen-risicogebied/atom/index.xml
```

**Collection:** `risk_zone`
**WMS Layer:** `NZ.RiskZone`
**WFS Type:** `overstromingen-risicogebied:risk_zone`

### Observed Flood Events (Gebeurtenis)

```
OGC API:  https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1
WMS:      https://service.pdok.nl/rws/overstromingen-gebeurtenis/wms/v1_0
WFS:      https://service.pdok.nl/rws/overstromingen-gebeurtenis/wfs/v1_0
ATOM:     https://service.pdok.nl/rws/overstromingen-gebeurtenis/atom/index.xml
```

**Collection:** `observed_event`

---

## 🚀 Quick Start Example

```javascript
// Get flood risk zones near Utrecht
const response = await fetch(
  'https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=5.0,52.0,5.2,52.2&f=json'
);
const data = await response.json();
console.log(`Found ${data.features.length} flood risk zones`);
```

---

## 📊 Data Quality

### Coverage
- ✅ **Geographic:** Complete Netherlands
- ✅ **Temporal:** Current (updated 2025-06-06)
- ✅ **Completeness:** All APSFR areas per EU directive

### Attributes
- ✅ Risk zone descriptions (e.g., "Maas type D - unprotected regional water")
- ✅ INSPIRE-compliant identifiers
- ✅ Natural hazard categorization
- ✅ Lifecycle timestamps
- ⚠️ Limited detailed attributes (no depth/probability data in basic service)

### Geometry
- ✅ High-quality polygons
- ✅ Clean topology
- ✅ Suitable for municipal-level analysis
- ✅ Multiple CRS support

---

## 💡 Integration Recommendations

### For Where to Live NL

**Recommended Approach:**

1. **Data Retrieval:** OGC API Features
   - Format: GeoJSON
   - CRS: EPSG:28992 (matches existing Dutch data)
   - Pagination: 100 features per request

2. **Map Visualization:** WMS overlay
   - Layer: NZ.RiskZone
   - Transparent: TRUE
   - CRS: Match base map

3. **Point Queries:** OGC API with bbox filter
   - Buffer user location
   - Return nearby risk zones
   - Display in UI

### Implementation Priority

**Phase 1: Basic Integration**
- ✅ Fetch flood risk zones via OGC API
- ✅ Display on map as WMS overlay
- ✅ Point query for user location

**Phase 2: Enhanced Features**
- 🔄 Cache PDOK data locally
- 🔄 Combine with CBS neighborhood data
- 🔄 Add risk scoring

**Phase 3: Advanced Analysis**
- 📋 Historical events correlation
- 📋 Real-time water levels (Waterinfo API)
- 📋 Multi-hazard assessment

---

## 🔧 Technical Specifications

### Recommended CRS Pipeline

1. **Storage:** EPSG:28992 (RD New)
2. **API Output:** EPSG:4326 (WGS84)
3. **Map Display:** EPSG:3857 (Web Mercator)

### Performance Considerations

- Response time: < 1-2 seconds
- Pagination: Recommended for > 100 features
- Caching: Implement local cache for frequently queried areas
- Rate limiting: None specified (use responsibly)

---

## ⚠️ Known Limitations

### Data Limitations
1. No detailed hazard maps (depth, probability, velocity)
2. Limited historical events (static 2018 dataset)
3. No real-time flood warnings (use Waterinfo for real-time)
4. No climate scenarios (future projections)

### Service Limitations
1. No uptime SLA (implement caching)
2. Rate limiting not specified (be responsible)
3. Bulk download via ATOM only

### Integration Challenges
1. CRS complexity (requires careful transformation)
2. INSPIRE schema (verbose property names)
3. Limited filtering (may need local processing)

---

## 🔗 Additional Resources

### Related PDOK Services

**CBS Wijken en Buurten (2024):**
```
WMS: https://service.pdok.nl/cbs/wijkenbuurten/2024/wms/v1_0
WFS: https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0
```
*Combine with flood data for vulnerability analysis*

**Waterinfo (Real-time):**
```
Portal: https://waterinfo.rws.nl/
API: https://rijkswaterstaatdata.nl/waterdata/
```
*Real-time water levels, wave heights, temperatures*

### Documentation Links

- PDOK Main: https://www.pdok.nl/
- PDOK Datasets: https://www.pdok.nl/datasets
- Nationaal Georegister: https://nationaalgeoregister.nl/
- PDOK Viewer: https://app.pdok.nl/viewer/
- Risicokaart: https://www.risicokaart.nl/

---

## ✅ Tasks Completed

- [x] Search PDOK for flood/overstroming services
- [x] Check NGR (Nationaal Georegister) for flood datasets
- [x] Identify WMS and WFS endpoints
- [x] Document service URLs (WMS/WFS/OGC API)
- [x] List available layers
- [x] Document data format and CRS support
- [x] Identify update frequency
- [x] Document license/attribution requirements
- [x] Test GetCapabilities requests
- [x] Test sample GetFeature/GetMap requests
- [x] Verify GetFeatureInfo functionality
- [x] Investigate overstromingen-risicogebied
- [x] Investigate overstromingen-gebeurtenis
- [x] Investigate richtlijnoverstromingsrisico
- [x] Find additional flood/water services
- [x] Evaluate geometry detail level
- [x] Assess attribute richness
- [x] Verify Netherlands coverage
- [x] Create comprehensive documentation
- [x] Provide working URLs and example queries

---

## 📈 Next Steps

### Immediate Actions
1. Review research documents
2. Test example API calls in development environment
3. Decide on integration approach (recommend OGC API Features)
4. Set up local caching strategy

### Development Tasks
1. Implement OGC API Features client
2. Add WMS overlay to map component
3. Create point query functionality
4. Design flood risk UI components
5. Add attribution to frontend

### Future Enhancements
1. Integrate real-time Waterinfo data
2. Combine with CBS neighborhood statistics
3. Add historical flood event visualization
4. Implement climate scenario projections
5. Create comprehensive risk scoring

---

## 📞 Support & Resources

**PDOK Support:**
- Email: BeheerPDOK@kadaster.nl
- Status: https://www.pdok.nl/status-overzicht
- Community: https://geoforum.nl/

**Data Provider:**
- Rijkswaterstaat (RWS)
- License: CC0 1.0 Public Domain
- Attribution: Recommended but not required

---

**Research completed by:** Research Agent
**Date:** December 23, 2025
**Files generated:** 3 documentation files
**Total documentation:** ~100 pages
**Code examples:** 20+ working snippets
**Tested endpoints:** All primary services verified

**Status:** ✅ Ready for implementation
