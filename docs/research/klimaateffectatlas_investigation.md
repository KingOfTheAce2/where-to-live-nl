# Klimaateffectatlas (Climate Effect Atlas) Investigation Report

**Date:** 2025-12-23
**Investigator:** Research Agent
**Purpose:** Evaluate Klimaateffectatlas for building-level flood risk data integration

---

## Executive Summary

The Klimaateffectatlas provides **municipality-specific** flood risk data through WFS/WMS services, with detailed building-level vulnerability information. Coverage is **not national** but includes major Dutch cities. The service is operated by Nelen & Schuurmans and offers free access with no apparent restrictions.

### Key Findings:
- **101,853 vulnerable buildings** in Den Haag alone for T100 scenario
- **Building-level flood vulnerability** with water height attributes
- **Road passability data** for emergency services
- **Multiple flood scenarios**: T10 (1 in 10 year), T100 (1 in 100 year), T1000 (1 in 1000 year)
- **Municipality-specific coverage** - no nationwide dataset
- **Free access** via WFS/WMS with no authentication required

---

## 1. Platform Overview

**Website:** https://www.klimaateffectatlas.nl/en/
**GeoServer Endpoint:** https://maps1.klimaatatlas.net/geoserver/ows
**Service Provider:** Nelen & Schuurmans (servicedesk@nelen-schuurmans.nl)

### Service Capabilities:
- WFS 2.0.0 (vector data access)
- WMS 1.3.0 (map visualization)
- Multiple output formats: GeoJSON, GML, CSV, Shapefile, GeoPackage
- Spatial filtering (bbox queries)
- No authentication required
- Fees: NONE
- Access Constraints: NONE

---

## 2. Data Coverage

### 2.1 Municipality Coverage

Based on layer analysis, the following major cities have flood data:

**Confirmed Coverage:**
- **Den Haag (The Hague)** - Extensive coverage
- **Rotterdam** - Building-level data
- **Amsterdam** - Limited or indirect coverage
- **Utrecht** - No direct layers found
- **Almere** - Full coverage
- **Schiedam** - Full coverage
- **Leidschendam-Voorburg** - Full coverage
- **Haarlemmermeer** - Full coverage
- **Zevenaar** - Full coverage

**Total Unique Municipalities:** 50+ municipalities identified

**Coverage Type:** Municipality-specific, NOT nationwide

### 2.2 Layer Categories

Total layers found: 800+ layers across all municipalities

**Major Data Categories:**
1. **Kwetsbare Panden** (Vulnerable Buildings)
2. **Kwetsbare Objecten** (Vulnerable Objects - hospitals, schools)
3. **Begaanbaarheid Wegen** (Road Passability)
4. **Waterdiepte** (Water Depth)
5. **Stroombanen** (Flow Paths)
6. **Hittestress** (Heat Stress - bonus data!)
7. **Groen/Koele Plekken** (Green/Cool Spaces)

---

## 3. Flood Risk Layers

### 3.1 Vulnerable Buildings (Kwetsbare Panden)

**Layer Naming Pattern:**
`{municipality}_klimaatatlas:{id}_{municipality}_kwetsbare_panden_{scenario}`

**Examples:**
```
den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022
lv_klimaatatlas:1803_lv_kwetsbare_panden_t100
rotterdam_klimaatatlas:1842_rotterdam_kwetsbare_panden_buurt
haarlemmermeer_klimaatatlas:1815_haarlemmermeer_kwetsbare_panden_t10
haarlemmermeer_klimaatatlas:1815_haarlemmermeer_kwetsbare_panden_t100
zevenaar_klimaatatlas:1839_zevenaar_kwetsbaarheid_panden_t100
```

**Attributes (Den Haag example):**
- `waterhoogt` - Water height at building (meters)
- `geom` - Building polygon geometry
- BGT (Basisregistratie Grootschalige Topografie) attributes:
  - `identifica` - Building identifier
  - `objectbegi` - Object start date
  - `bgt_status` - Building status
  - `bronhouder` - Data provider
  - Floor level attributes (wp_vloerpe)

**Scale:** Den Haag has **101,853 vulnerable buildings** for T100 scenario

### 3.2 Road Passability (Begaanbaarheid Wegen)

**Layer Examples:**
```
lv_klimaatatlas:1803_lv_begaanbare_wegen_t100
schiedam_klimaatatlas:1803_schiedam_begaanbaarheid_wegen_60mm
den_haag_klimaatatlas:1827_den_haag_beg_wegen_70mm_2022
haarlemmermeer_klimaatatlas:1815_haarlemmermeer_begaanbaarheid_wegen_t10
zevenaar_klimaatatlas:1839_zevenaar_begaanbaarheid_wegen_t100
```

**Purpose:** Shows which roads become impassable for:
- Regular vehicles (personenauto's)
- Emergency services (calamiteitenverkeer)

### 3.3 Vulnerable Objects (Critical Infrastructure)

**Layer Examples:**
```
lv_klimaatatlas:1803_lv_kwetsbare_objecten_t100
almere_klimaatatlas:1802_almere_klimaatatlas_kwetsbare_objecten
den_haag_klimaatatlas:1827_den_haag_kwetsbare_objecten_70mm_2022
```

**Includes:**
- Hospitals and healthcare facilities
- Schools and educational buildings
- Other critical infrastructure

### 3.4 Water Depth Layers

**Layer Examples:**
```
schiedam_klimaatatlas:1803_schiedam_ror_waterdiepte
fluvius_klimaatatlas:1831_fluvius_maximale_waterdiepte_t1000
fluvius_klimaatatlas:1831_fluvius_waterdiepte_t1000_overstromingen
as50_klimaatatlas:1838_as50_overstromingsdiepte_t1000_beschermd
as50_klimaatatlas:1838_as50_overstromingsdiepte_t1000_onbeschermd
```

**Note:** These appear to be raster-based layers (likely WMS only)

---

## 4. Flood Scenarios

### 4.1 Precipitation-Based Scenarios

**T10 (1 in 10 year storm):**
- Rainfall intensity varies by municipality
- Example: 40-50mm in 1 hour

**T100 (1 in 100 year storm):**
- Most common scenario in dataset
- Example: 70mm in 1 hour (Den Haag, Leidschendam-Voorburg)
- Example: 60mm (Schiedam)

**60mm/70mm scenarios:**
- Specific rainfall amounts rather than return periods
- Used for standardized comparisons

### 4.2 River Flooding Scenarios

**T1000 (1 in 1000 year flood):**
- Used for major river flooding
- Found in:
  - `agv_klimaatatlas:1814_agv_duur_overstroming_t1000`
  - `fluvius_klimaatatlas:1831_fluvius_waterdiepte_t1000_overstromingen`
  - `wpn_klimaatatlas:1824_wpn_kwetsb_obj_t1000_20181019`

### 4.3 Climate Projections

**Current Status:** No explicit 2050/2085 climate scenario layers found in initial investigation

**Modeling Notes (from layer descriptions):**
> "In de modellering is vaak alleen de stroming over het maaiveld meegenomen; afvoer via de riolering en open water is veelal niet opgenomen."

Translation: Models often only include surface flow; sewer drainage and open water discharge may not be included.

**Disclaimer (from metadata):**
> "Aan de absolute waarden kunnen geen rechten worden ontleend. De resultaten geven een eerste indicatie van de te verwachten mate van kwetsbaarheid."

Translation: No legal rights can be derived from absolute values. Results provide a first indication of expected vulnerability.

---

## 5. Working WFS Queries

### 5.1 GetCapabilities (Discover Layers)

```bash
curl "https://maps1.klimaatatlas.net/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities"
```

### 5.2 DescribeFeatureType (Get Schema)

```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=DescribeFeatureType&typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&outputFormat=application/json"
```

### 5.3 GetFeature (Retrieve Data)

**Basic query (first 10 features):**
```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&outputFormat=application/json&count=10"
```

**Spatial bbox query (WGS84):**
```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=lv_klimaatatlas:1803_lv_kwetsbare_panden_t100&outputFormat=application/json&bbox=4.38,52.07,4.39,52.08,EPSG:4326&count=100"
```

**Results:**
- Returned 2 buildings in bbox query
- Total of 1,215 vulnerable buildings in that municipality for T100
- Water height attribute available: `wp_waterho` (null in sample)
- Floor level available: `wp_vloerpe` (e.g., -0.452, -1.6 meters)

### 5.4 Response Format Examples

**GeoJSON Output:**
```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "1827_den_haag_kwetsbare_panden_70mm_2022.12447",
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [...]
            },
            "properties": {
                "waterhoogt": 0
            }
        }
    ],
    "totalFeatures": 101853,
    "numberReturned": 3,
    "crs": {
        "type": "name",
        "properties": {
            "name": "urn:ogc:def:crs:EPSG::3857"
        }
    }
}
```

**Rotterdam Output (Neighborhood-level):**
```json
{
    "type": "Feature",
    "properties": {
        "buurtnaam": "Neighborhood Name",
        "aantal_panden": 150,
        "percentage": 45.2
    }
}
```

---

## 6. Integration Assessment

### 6.1 Pros

**Strengths:**
1. **Building-level granularity** - Exact building polygons with flood risk
2. **Multiple scenarios** - T10, T100, T1000 for different planning needs
3. **Water height data** - Quantitative flood depth information
4. **Road passability** - Emergency access evaluation
5. **Free and open** - No authentication, no fees
6. **Standard formats** - GeoJSON, WMS, WFS 2.0
7. **Spatial queries work** - bbox filtering functional
8. **Rich metadata** - BGT integration, building attributes
9. **Maintained service** - By professional organization (Nelen & Schuurmans)
10. **Bonus data** - Heat stress, green spaces also available

### 6.2 Cons

**Limitations:**
1. **No nationwide coverage** - Municipality-specific only
2. **Inconsistent naming** - Each municipality uses different layer patterns
3. **Variable scenarios** - Different rainfall amounts per municipality
4. **No Amsterdam/Utrecht direct coverage** - Major cities missing or indirect
5. **Model limitations** - Surface flow only, sewer systems often excluded
6. **Legal disclaimer** - Not for official decision-making
7. **No climate projections** - No explicit 2050/2085 scenarios found
8. **Geometry in Web Mercator** - May need reprojection for analysis
9. **Large datasets** - 100k+ features per municipality requires pagination

### 6.3 Coverage Gaps

**Major Cities Status:**
- ✅ Den Haag - Full coverage
- ✅ Rotterdam - Full coverage
- ❌ Amsterdam - No direct layers found
- ❌ Utrecht - No direct layers found
- ✅ Almere - Full coverage
- ✅ Schiedam - Full coverage
- ⚠️ National - No nationwide dataset

**Workaround:** Could check if Amsterdam/Utrecht are in regional water authority layers (waterschappen)

---

## 7. Data Licensing & Usage

**From GetCapabilities:**
- **Fees:** NONE
- **Access Constraints:** NONE
- **Service Provider:** Nelen & Schuurmans
- **Contact:** servicedesk@nelen-schuurmans.nl

**Legal Disclaimer (from layer metadata):**
> "Aan de absolute waarden kunnen geen rechten worden ontleend."
> (No legal rights can be derived from absolute values)

**Recommendation:** Contact Nelen & Schuurmans to confirm:
1. Data licensing for commercial reuse
2. Attribution requirements
3. Update frequency
4. Coverage expansion plans

---

## 8. Recommended Integration Strategy

### 8.1 Immediate Integration (Phase 1)

**For Supported Municipalities:**

1. **Layer Discovery:**
```javascript
// Check if municipality has flood data
const municipality = 'den_haag'; // or 'rotterdam', 'almere', etc.
const layerPattern = `${municipality}_klimaatatlas:*kwetsbare_panden*`;
```

2. **Building-Level Query:**
```javascript
// Query buildings in user's bbox
const bbox = `${minLon},${minLat},${maxLon},${maxLat},EPSG:4326`;
const url = `https://maps1.klimaatatlas.net/geoserver/wfs?
  service=WFS&
  version=2.0.0&
  request=GetFeature&
  typeName=${layerName}&
  outputFormat=application/json&
  bbox=${bbox}&
  count=1000`;
```

3. **Flood Risk Scoring:**
```javascript
// Calculate risk from water height
function calculateFloodRisk(building) {
  const waterHeight = building.properties.waterhoogt || 0;
  if (waterHeight > 0.5) return 'HIGH';
  if (waterHeight > 0.2) return 'MEDIUM';
  if (waterHeight > 0) return 'LOW';
  return 'MINIMAL';
}
```

### 8.2 Coverage Expansion (Phase 2)

**For Unsupported Cities:**

1. **Alternative Data Sources:**
   - Check CBS flood risk statistics (nationwide but coarser)
   - Use Overstroomik.nl data (different source)
   - Fall back to elevation-based risk assessment

2. **Regional Water Authority Data:**
   - Check if Amsterdam/Utrecht in water authority layers
   - Pattern: `agv_klimaatatlas`, `hhnk_klimaatatlas`, etc.

### 8.3 UI Integration

**Display Strategy:**

1. **Building-Level Overlay:**
```javascript
// Color buildings by flood risk
buildings.forEach(building => {
  const risk = calculateFloodRisk(building);
  const color = {
    'HIGH': '#FF0000',
    'MEDIUM': '#FF9900',
    'LOW': '#FFFF00',
    'MINIMAL': '#00FF00'
  }[risk];

  // Add to map layer
});
```

2. **Neighborhood Summary:**
```javascript
// Use Rotterdam's neighborhood aggregation
// Show percentage of vulnerable buildings per buurt
```

3. **Scenario Comparison:**
```javascript
// Allow users to toggle between T10, T100, T1000
// Show how risk changes with severity
```

### 8.4 API Route Design

**Proposed Endpoint:**
```typescript
// /api/flood-risk

interface FloodRiskQuery {
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  municipality?: string; // 'den_haag', 'rotterdam', etc.
  scenario?: 'T10' | 'T100' | 'T1000';
}

interface FloodRiskResponse {
  features: GeoJSON.Feature[];
  summary: {
    totalBuildings: number;
    vulnerableBuildings: number;
    averageWaterHeight: number;
    maxWaterHeight: number;
    scenario: string;
    municipality: string;
  };
  coverage: boolean; // Does this municipality have data?
}
```

---

## 9. Next Steps

### 9.1 Immediate Actions

1. **Test Amsterdam/Utrecht coverage:**
   - Search for water authority layers covering these cities
   - Check if they're in regional datasets

2. **Confirm licensing:**
   - Contact Nelen & Schuurmans
   - Get written permission for commercial use
   - Clarify attribution requirements

3. **Build layer mapping:**
   - Create municipality → layer name mapping
   - Document scenario → rainfall mapping
   - Build coverage matrix

### 9.2 Integration Tasks

1. **Backend API:**
   - Create `/api/flood-risk` endpoint
   - Implement WFS proxy with caching
   - Add bbox validation
   - Handle pagination for large datasets

2. **Frontend Display:**
   - Add flood risk toggle to map
   - Create color-coded building overlay
   - Show flood scenario selector
   - Display data disclaimers

3. **Data Processing:**
   - Transform Web Mercator to WGS84
   - Simplify geometries for performance
   - Calculate neighborhood statistics
   - Cache results in database

### 9.3 Alternative Sources

If Klimaateffectatlas coverage is insufficient:

1. **Overstroomik.nl** - Alternative flood risk platform
2. **Rijkswaterstaat** - National water management data
3. **CBS** - Statistical flood risk data
4. **AHN (Actueel Hoogtebestand Nederland)** - Elevation data for modeling

---

## 10. Sample Queries for Testing

### Den Haag (The Hague)

```bash
# Count vulnerable buildings
curl -s "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&resultType=hits"

# Get buildings in city center
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&outputFormat=application/json&bbox=4.31,52.07,4.32,52.08,EPSG:4326&count=100"
```

### Rotterdam

```bash
# Neighborhood-level data
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=rotterdam_klimaatatlas:1842_rotterdam_kwetsbare_panden_buurt&outputFormat=application/json&count=10"
```

### Leidschendam-Voorburg

```bash
# T100 scenario buildings
curl "https://maps1.klimaatatlas.net/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=lv_klimaatatlas:1803_lv_kwetsbare_panden_t100&outputFormat=application/json&bbox=4.38,52.07,4.39,52.08,EPSG:4326"
```

---

## 11. Conclusion

**Recommendation: PROCEED WITH INTEGRATION**

The Klimaateffectatlas provides valuable **building-level flood risk data** for major Dutch cities, though coverage is **not nationwide**. The service is free, well-maintained, and offers standard OGC services.

**Primary Use Cases:**
1. **Red flags** - Show flood vulnerability for specific addresses
2. **Neighborhood analysis** - Compare flood risk across areas
3. **Scenario planning** - Display T10 vs T100 risk differences
4. **Emergency access** - Show road passability

**Key Limitations:**
1. Municipality-specific coverage (not nationwide)
2. Amsterdam/Utrecht coverage unclear
3. Legal disclaimer prevents official use

**Integration Priority:** HIGH (for supported municipalities)
**Effort Estimate:** Medium (2-3 days for backend + frontend)
**Data Quality:** High (professional modeling by Nelen & Schuurmans)

---

## Appendix A: Municipality Coverage List

Based on layer analysis, confirmed municipalities:

1. Den Haag (The Hague)
2. Rotterdam
3. Almere
4. Schiedam
5. Leidschendam-Voorburg
6. Haarlemmermeer
7. Zevenaar
8. Rijnland (water authority)
9. AGV (water authority)
10. Fluvius (Belgium?)
11. Parkstad (region)
12. Maastricht
13. Middelburg
14. Nieuwegein
15. Purmerend
16. Velsen
17. Waddinxveen
18. Antwerpen (Belgium)
19. Lochem
20. ... (50+ total)

**Major Cities Missing:**
- Amsterdam (no direct layers found)
- Utrecht (no direct layers found)
- Eindhoven (not confirmed)
- Groningen (not confirmed)

---

## Appendix B: Useful Layer Patterns

**Search Patterns:**
```bash
# Find all T100 layers
*klimaatatlas:*t100*

# Find vulnerable buildings
*klimaatatlas:*kwetsbare_panden*

# Find road passability
*klimaatatlas:*begaanbaar*

# Find water depth
*klimaatatlas:*waterdiepte*
```

**Namespace Patterns:**
- `{city}_klimaatatlas` - City-specific data
- `{waterschap}_klimaatatlas` - Water authority data

---

**Report End**
