# Overstroomik.nl - Flood Risk Data Research

**Research Date:** 2025-12-23
**Researcher:** Research Agent
**Project:** Where to Live NL - Flood Risk Integration

---

## Executive Summary

Overstroomik.nl is a Dutch government service that provides flood risk information by postcode. While **Overstroomik.nl itself does not offer a public API**, it relies on several backend services that **do provide WMS/WFS access**. The primary data sources are:

1. **LIWO** (Landelijk Informatiesysteem Water en Overstromingen) - National Water and Flooding Information System
2. **LDO** (Landelijke Databank Overstromingsinformatie) - National Flood Information Database
3. **PDOK** (Publieke Dienstverlening Op de Kaart) - Public Services on the Map

**Integration Recommendation:** ✅ **YES** - Use PDOK WMS/WFS services directly for programmatic access to flood risk data.

---

## 1. What is Overstroomik.nl?

### Overview
- **Website:** https://overstroomik.nl/
- **Purpose:** Allow citizens to check flood risk by entering their postcode
- **Operated by:** Rijkswaterstaat, security regions, water boards, Ministry of Infrastructure and Water Management, Ministry of Justice and Security, and the Delta Programme

### Features
- Shows maximum water levels for each postcode area in the Netherlands
- Based on worst-case flood scenarios
- Displays consequences of large-scale flooding from breaches in flood barriers (dykes, dunes, locks)
- Provides guidance on damage limitation and evacuation

### Data Resolution
- Based on postcode areas (6-digit Dutch postcodes)
- Water levels based on extreme flooding scenarios
- Uses the BAG 3D model (Basic Register of Addresses and Buildings) to assess building vulnerability
- Accounts for sloping roofs and ground characteristics

---

## 2. Data Sources & Methodology

### Primary Data Source: LIWO
- **Full Name:** Landelijk Informatiesysteem Water en Overstromingen (National Water and Flood Information System)
- **Website:** https://basisinformatie-overstromingen.nl/
- **Data:** ~5,000 flood scenarios
- **Content:** Maximum flood depth, flood probabilities, evacuation statistics, area divisions

### Backend Database: LDO
- **Full Name:** Landelijke Databank Overstromingsinformatie (National Flood Information Database)
- **Website:** https://www.overstromingsinformatie.nl/
- **Purpose:** Central collection, approval, and management of national flood information
- **Managed by:** BIJ12 (technical management by Nelen & Schuurmans)
- **Contact:** beheerldo@bij12.nl

### Distribution Platform: PDOK
- **Full Name:** Publieke Dienstverlening Op de Kaart (Public Services on the Map)
- **Purpose:** Central distribution platform for Dutch government geospatial datasets
- **Standards:** OGC and ISO compliant (WMS, WFS, WMTS, WCS)
- **Case Study:** Overstroomik.nl is hosted as a PDOK case study

### Flood Scenarios
- Created by provinces, water boards, and Rijkswaterstaat
- Used in the Climate Impact Atlas (Klimaateffectatlas)
- Updated regularly with latest flood risk assessments
- Based on Dutch safety standards (1 in 100,000 per year mortality risk by 2050)

---

## 3. Available APIs & WMS/WFS Services

### ✅ PDOK WMS/WFS Endpoints (RECOMMENDED)

#### Flood Risk Areas (Overstromingen - Risicogebied)
**Primary Service - RWS Flood Risk Areas:**

- **WMS GetCapabilities:**
  ```
  https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?request=GetCapabilities&service=WMS&version=1.3.0
  ```

- **WFS GetCapabilities:**
  ```
  https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?request=GetCapabilities&service=WFS&version=2.0.0
  ```

- **Last Updated:** 2025-06-03
- **Coverage:** Flood hazard areas with high probability (Richtlijn Overstromingsrisico's)

#### Provincial Flood Hazard Maps (Overstromingsgevaarkaarten)

- **WMS GetCapabilities:**
  ```
  https://geodata.nationaalgeoregister.nl/provincies/nz/wms/v1?SERVICE=WMS&REQUEST=GetCapabilities&version=1.3.0
  ```

- **WFS GetCapabilities:**
  ```
  https://geodata.nationaalgeoregister.nl/provincies/nz/wfs/v1?SERVICE=WFS&REQUEST=GetCapabilities&version=2.0.0
  ```

**Available WMS Layers:**
- `NZ.ExposedElement.nlnz-ogk` - Exposed elements
- `NZ.HazardArea.nlnz-ogk` - Hazard areas
- `NZ.ObservedEvent.nlnz-ogk` - Observed flood events
- `NZ.RiskZone.nlnz-ogk` - Risk zones

#### Rijkswaterstaat Flood Risk Services

- **WMS:**
  ```
  https://geo.rijkswaterstaat.nl/services/ogc/gdr/ror_overstromingsrisico/ows?service=WMS&request=getcapabilities&version=1.3.0
  ```

- **WFS:**
  ```
  https://geo.rijkswaterstaat.nl/services/ogc/gdr/ror_overstromingsrisico/ows?service=WFS&request=getcapabilities&version=2.0.0
  ```

### LDO API Access

The LDO provides an **Application Programming Interface (API)** for:
- Automatic data retrieval
- Linking with external applications
- Uploading data to the platform

**Access Method:** Contact BIJ12 at beheerldo@bij12.nl for API credentials and documentation.

**Supported Flood Simulation Formats:**
- SOBEK
- Tygron
- 3Di
- D-Hydro (converted to 5x5m grid)

---

## 4. Technical Integration

### How Overstroomik.nl Works
1. User enters postcode
2. System queries LIWO flood scenarios via WMS
3. Matches postcode to flood depth maps
4. Retrieves maximum water level from scenario data
5. Displays result with context and recommendations

### For Our Integration
We can replicate this by:
1. **Using PDOK WMS services** to get flood risk layers
2. **Querying by coordinates** instead of postcode (more flexible)
3. **Extracting flood depth values** at specific locations
4. **Categorizing risk levels** based on water depth thresholds

### Recommended Implementation

```typescript
// Example API route: /api/flood-risk
interface FloodRiskRequest {
  lat: number;
  lng: number;
}

interface FloodRiskResponse {
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  maxWaterDepth: number; // meters
  scenario: string;
  source: 'PDOK-RWS';
  lastUpdated: string;
}

// Use WFS to query flood risk at coordinates
const WFS_ENDPOINT = 'https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0';

async function getFloodRisk(lat: number, lng: number): Promise<FloodRiskResponse> {
  // 1. Convert coordinates to EPSG:28992 (Dutch coordinate system)
  // 2. Query WFS with point intersection
  // 3. Parse flood scenario data
  // 4. Return risk assessment
}
```

---

## 5. Data Quality & Coverage

### Strengths
✅ **Official Government Data** - Maintained by Rijkswaterstaat and water authorities
✅ **Up-to-date** - Regular updates (last update June 2025)
✅ **High Resolution** - 5x5m grid for flood scenarios
✅ **Comprehensive** - ~5,000 flood scenarios covering all of Netherlands
✅ **Standards Compliant** - OGC WMS/WFS compatible
✅ **Free & Open** - Public government data

### Limitations
⚠️ **Worst-Case Scenarios** - Based on extreme situations, not average conditions
⚠️ **Postcode Granularity** - Original tool uses postcode areas, not exact addresses
⚠️ **No Direct API** - Overstroomik.nl itself doesn't provide an API
⚠️ **JavaScript Required** - LIWO website requires JS for content

---

## 6. Licensing & Usage Terms

### PDOK Open Data License
- **Terms:** Open government data
- **Usage:** Free for all purposes (commercial and non-commercial)
- **Attribution:** Credit to data provider (Rijkswaterstaat, PDOK)
- **Restrictions:** None for public use
- **Standards:** Complies with INSPIRE directive and Dutch open data policy

**Status:** ✅ **FREE TO USE** with attribution

---

## 7. Related Services & Resources

### For Citizens
- **Overstroomik.nl** - Simple postcode lookup
- **Risicokaart.nl** - Multi-hazard risk map (includes flooding, industrial risks)
- **Klimaateffectatlas.nl** - Climate Impact Atlas for professionals and students

### For Professionals
- **LIWO** (basisinformatie-overstromingen.nl) - Detailed flood scenarios
- **LDO** (overstromingsinformatie.nl) - Full flood database with API
- **PDOK Viewer** - Interactive map viewer for all government geo-data

### Data Discovery
- **Nationaal Georegister** (nationaalgeoregister.nl) - Metadata catalog for all Dutch spatial datasets
- **Data Overheid** (data.overheid.nl) - Open data portal

---

## 8. Integration Recommendations

### Priority: HIGH ✅

**Recommended Approach:**
1. **Use PDOK WMS/WFS services directly** - Most reliable and maintained
2. **Query by coordinates** - More flexible than postcode-based queries
3. **Cache results** - Flood risk data doesn't change frequently
4. **Provide context** - Explain that values are worst-case scenarios
5. **Add attribution** - Credit Rijkswaterstaat and PDOK

### Implementation Steps
1. ✅ Set up WFS client for PDOK flood risk service
2. ✅ Create coordinate → flood risk mapping function
3. ✅ Define risk level categories (none, low, medium, high, extreme)
4. ✅ Add caching layer (TTL: 30 days)
5. ✅ Integrate with existing map overlays
6. ✅ Add to RedFlagsCard component if risk is medium or higher

### Sample Integration Code
```typescript
// /frontend/src/app/api/flood-risk/route.ts
import { NextRequest, NextResponse } from 'next/server';

const PDOK_WFS_URL = 'https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');

  // TODO: Query WFS service
  // TODO: Parse response
  // TODO: Calculate risk level

  return NextResponse.json({
    riskLevel: 'low',
    maxWaterDepth: 0.5,
    scenario: 'High probability flood scenario',
    source: 'PDOK-RWS',
    lastUpdated: '2025-06-03'
  });
}
```

---

## 9. Delta Programme Context

### National Safety Standards
- **Target:** Maximum 1 in 100,000 per year mortality risk from flooding by 2050
- **Investment:** 110 dike upgrade projects (2025-2036)
- **Coverage:** 887 km of dikes + 261 engineering structures

This provides context for why flood risk data is so comprehensive and well-maintained in the Netherlands.

---

## 10. Key Contacts & Resources

| Organization | Contact | Purpose |
|-------------|---------|---------|
| **LDO Technical Management** | beheerldo@bij12.nl | API access, technical questions |
| **PDOK Support** | Via PDOK website | WMS/WFS service issues |
| **Rijkswaterstaat** | General contact | Data source questions |
| **BIJ12** | General contact | LDO database management |

---

## Sources

### Research References
- [Overstroomik.nl - About This Website](https://overstroomik.nl/en/about-this-website)
- [Overstroomik.nl - FAQ](https://overstroomik.nl/en/frequently-asked-questions)
- [Climate Adaptation Platform - Can I be flooded?](https://klimaatadaptatienederland.nl/en/tools/all-tools/overstroom-ik/)
- [PDOK Case Study - Overstroom ik?](https://www.pdok.nl/-/overstroom-ik-)
- [BIJ12 - Landelijke Databank Overstromingsinformatie (LDO)](https://www.bij12.nl/onderwerp/informatieproducten-van-provincies/landelijke-databank-overstromingsinformatie-ldo/)
- [Nelen & Schuurmans - LDO Development](https://nelen-schuurmans.nl/case/ontwikkeling-landelijke-databank-overstromingsinformatie-ldo/)
- [Data Overheid - Overstromingsrisicokaarten](https://data.overheid.nl/dataset/13224-overstromingsrisicokaarten)
- [Nationaal Georegister - ROR Flood Risk Areas](https://www.nationaalgeoregister.nl/geonetwork/srv/api/records/c66acb58-7534-453a-9fc4-b5d3faa7b41c)
- [PDOK Documentation - Geo Services and APIs](https://pdok-ngr.readthedocs.io/services.html)

---

## Next Steps

1. **Test WFS Endpoints** - Verify data quality and response format
2. **Prototype Integration** - Create proof-of-concept API route
3. **Define Risk Categories** - Establish thresholds for low/medium/high risk
4. **UI/UX Design** - Determine how to display flood risk in the app
5. **Performance Testing** - Ensure WFS queries are fast enough
6. **Caching Strategy** - Implement efficient data caching
7. **Attribution Compliance** - Add proper credits to UI

---

**Research Status:** ✅ COMPLETE
**Integration Feasibility:** ✅ HIGH
**Recommended for Implementation:** ✅ YES
