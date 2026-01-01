# PDOK Flood Risk Services - Comprehensive Research Report

**Research Date:** December 23, 2025
**Researcher:** Research Agent
**Project:** Where to Live NL - Flood Risk Integration

---

## Executive Summary

This report documents all PDOK (Publieke Dienstverlening Op de Kaart) flood-related datasets, services, and APIs available for integration into the Where to Live NL application. PDOK provides two primary INSPIRE-harmonized flood datasets with modern OGC API Features endpoints alongside traditional WMS/WFS services.

**Key Findings:**
- ✅ 2 primary flood datasets available (risk zones + observed events)
- ✅ Multiple service types: OGC API Features, WMS, WFS, ATOM
- ✅ Full Netherlands coverage with INSPIRE harmonization
- ✅ Free access with CC0 public domain license
- ✅ Support for multiple CRS including Dutch RD (EPSG:28992)
- ⚠️ Legacy services being phased out (check deprecation dates)

---

## 1. Primary Flood Datasets

### 1.1 Overstromingen - Risicogebied (Flood Risk Zones)

**Official Name:** Gebieden met Natuurrisico's - Overstromingen - Risicogebied - Richtlijn Overstromingsrisico's (ROR)

**Description:** INSPIRE-harmonized flood risk zones identifying Areas with Potential Significant Flood Risk (APSFR/GPSOR) under the EU Flood Risk Directive (2nd cycle: 2016-2021).

**Data Provider:** Rijkswaterstaat (RWS)
**License:** CC0 1.0 Public Domain
**Update Frequency:** Periodic (last updated: 2025-06-06)
**Coverage:** Complete Netherlands

#### Available Service Endpoints

| Service Type | URL | Status |
|-------------|-----|--------|
| **OGC API Features** | `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1` | ✅ Active |
| **WMS** | `https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0` | ✅ Active |
| **WFS** | `https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0` | ✅ Active |
| **ATOM** | `https://service.pdok.nl/rws/overstromingen-risicogebied/atom/index.xml` | ✅ Active |

#### Supported CRS

- **EPSG:28992** - Amersfoort / RD New (Dutch national grid) ⭐ Recommended
- **EPSG:4258** - ETRS89 (European standard)
- **EPSG:4326** - WGS84 (Global standard)
- **EPSG:3857** - Web Mercator (Web mapping)
- **CRS84** - OGC CRS84 (WGS84 longitude-first)
- **EPSG:25831, EPSG:25832** - UTM zones 31N, 32N
- **EPSG:3034, EPSG:3035** - ETRS89-extended / LAEA Europe

#### Collections

**Collection ID:** `risk_zone`
**Feature Type:** `overstromingen-risicogebied:risk_zone`

**Available Attributes:**
```json
{
  "id": "UUID",
  "local_id": "Unique identifier",
  "namespace": "nl.nz-apsfr",
  "description": "Risk zone description",
  "begin_life_span_version": "Timestamp",
  "natural_hazard_category": "flood"
}
```

**Example Feature:**
```json
{
  "id": "e2ccca98-cbe6-5352-af9b-c9086614ccef",
  "type": "Feature",
  "properties": {
    "description": "Maas type D - onbeschermd langs regionaal water",
    "local_id": "NLMS_D.d183334adcece14b3e2704cc28ac2dfa565c40e892415cb1869247b6d9da37d6",
    "namespace": "nl.nz-apsfr",
    "begin_life_span_version": "2018-12-12T00:00:00Z",
    "natural_hazard_category": "flood"
  }
}
```

#### WMS Layers

**Layer Name:** `NZ.RiskZone`
**Title:** Risicogebieden
**Style:** Default INSPIRE styling

#### Sample Requests

**GetCapabilities (WMS):**
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?request=GetCapabilities&service=WMS
```

**GetCapabilities (WFS):**
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?request=GetCapabilities&service=WFS
```

**GetMap (WMS) - Example:**
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetMap&
  LAYERS=NZ.RiskZone&
  CRS=EPSG:28992&
  BBOX=10000,305000,280000,625000&
  WIDTH=800&
  HEIGHT=600&
  FORMAT=image/png&
  TRANSPARENT=TRUE
```

**GetFeature (WFS) - Example:**
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?
  SERVICE=WFS&
  VERSION=2.0.0&
  REQUEST=GetFeature&
  TYPENAMES=overstromingen-risicogebied:risk_zone&
  COUNT=10&
  OUTPUTFORMAT=application/json
```

**OGC API Features - Get Items:**
```
https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?
  limit=100&
  f=json
```

**Point Query (Spatial Filter):**
```
https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?
  bbox=120000,480000,121000,481000&
  bbox-crs=EPSG:28992&
  f=json
```

---

### 1.2 Overstromingen - Geobserveerde Gebeurtenis (Observed Flood Events)

**Official Name:** Gebieden met Natuurrisico's - Overstromingen - Geobserveerde gebeurtenis - Richtlijn Overstromingsrisico's (ROR)

**Description:** Historical flood events from the 2018 Flood Risk Report ("Overstromingsrisico's in Nederland, 2018"), harmonized to INSPIRE standards.

**Data Provider:** Rijkswaterstaat (RWS)
**License:** CC0 1.0 Public Domain
**Update Frequency:** Static (historical events)
**Coverage:** Netherlands - historical flood events

#### Available Service Endpoints

| Service Type | URL | Status |
|-------------|-----|--------|
| **OGC API Features** | `https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1` | ✅ Active |
| **WMS** | `https://service.pdok.nl/rws/overstromingen-gebeurtenis/wms/v1_0` | ✅ Active |
| **WFS** | `https://service.pdok.nl/rws/overstromingen-gebeurtenis/wfs/v1_0` | ✅ Active |
| **ATOM** | `https://service.pdok.nl/rws/overstromingen-gebeurtenis/atom/index.xml` | ✅ Active |

#### Collections

**Collection ID:** `observed_event`
**Title:** Overstromingen (Floods)

**Available Attributes:**
```json
{
  "id": "UUID",
  "gml_id": "Event ID",
  "gml_identifier": "Full namespace identifier",
  "local_id": "Local identifier",
  "namespace": "nl.nz-pfra",
  "begin_life_span_version": "Timestamp",
  "levelorintensity_qualitativevalue": "PFRA Past Event",
  "xlink_href": "INSPIRE codelist reference"
}
```

**Example Feature:**
```json
{
  "id": "08197b20-e28e-59ea-848c-4ce1059d128d",
  "gml_id": "NL_RORHISTOV9",
  "gml_identifier": "nl.nz-pfra.NL_RORHISTOV9",
  "local_id": "NL_RORHISTOV9",
  "namespace": "nl.nz-pfra",
  "begin_life_span_version": "2018-12-12T00:00:00Z",
  "levelorintensity_qualitativevalue": "PFRA Past Event",
  "xlink_href": "http://inspire.ec.europa.eu/codelist/NaturalHazardCategoryValue/flood"
}
```

#### Sample Requests

**OGC API Features - Get Events:**
```
https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1/collections/observed_event/items?
  limit=50&
  f=json
```

---

## 2. Legacy/Deprecated Services

### 2.1 Richtlijn Overstromingsrisico (ROR) - Legacy

**⚠️ DEPRECATED:** These services were scheduled to be turned off on **December 5, 2025**.

**Replacement:** Use the new INSPIRE-harmonized services above (overstromingen-risicogebied and overstromingen-gebeurtenis)

**Legacy Endpoints (DO NOT USE):**
- WMS: `https://service.pdok.nl/rws/richtlijnoverstromingsrisico/wms/v2_0`
- WFS: `https://service.pdok.nl/rws/richtlijnoverstromingsrisico/wfs/v2_0`
- ATOM: `https://service.pdok.nl/rws/richtlijnoverstromingsrisico/atom/index.xml`

---

## 3. Related Water Services

### 3.1 Waterschappen Waterketen (GWSW)

**Description:** Urban water management infrastructure including sewerage, water boards data structured according to GWSW standard.

**Data Provider:** Stichting RIONED / Water Boards
**Status:** ✅ Active (as of November 2023)

**Service Endpoints:**
- WMS: `https://service.pdok.nl/rioned/wswaterketen/wms/v1_0?request=getCapabilities&service=WMS`
- WFS: `https://service.pdok.nl/rioned/wswaterketen/wfs/v1_0?request=getCapabilities&service=WFS`
- ATOM: `https://service.pdok.nl/rioned/wswaterketen/atom/index.xml`

### 3.2 Stedelijk Water (Riolering)

**Description:** Urban water management with sewerage systems, including connections and connection pipes.

**Data Provider:** RIONED
**Status:** ✅ Active

**Service Endpoints:**
- WMS: `https://service.pdok.nl/rioned/beheerstedelijkwater/wms/v1_0?request=GetCapabilities&service=WMS`
- WFS: `https://service.pdok.nl/rioned/beheerstedelijkwater/wfs/v1_0?request=GetCapabilities&service=WFS`
- ATOM: `https://service.pdok.nl/rioned/beheerstedelijkwater/atom/index.xml`

### 3.3 Kaderrichtlijn Water Actueel

**Description:** Current water framework directive data (replaces legacy Oppervlaktewateren)

**Service Endpoints:**
- WMS: `https://geodata.nationaalgeoregister.nl/rws/kaderrichtlijnwateractueel/wms/v1_0?service=WMS&request=GetCapabilities`
- WFS: `https://geodata.nationaalgeoregister.nl/rws/kaderrichtlijnwateractueel/wfs/v1_0?service=WFS&request=GetCapabilities`

---

## 4. Real-Time Water Data (Outside PDOK)

### 4.1 Rijkswaterstaat Waterinfo

**Description:** Real-time and historical water level measurements, wave heights, temperatures for national waters.

**Main Portal:** https://waterinfo.rws.nl/

**API:** WaterWebservices
**Documentation:** https://rijkswaterstaatdata.nl/waterdata/

**Components:**
- **MetadataService** - Catalog of available observations
- **OnlineWaarnemingenService** - Historical and current observations
- **Geoservices** - WMS/WFS with current observations

**Important Notes:**
- ⚠️ No uptime guarantees (not for critical applications)
- 📦 Python packages available: `ddlpy` (Deltares), `rws-waterinfo` (Datalab)
- 📦 R package: `rwsapi`

**Example Use Cases:**
- Real-time water levels (waterstanden)
- Wave heights (golfhoogtes)
- Water temperatures
- Wind speeds
- Tidal predictions

---

## 5. Complementary Datasets

### 5.1 CBS Wijken en Buurten (Districts & Neighborhoods)

**Description:** Statistical boundaries with socio-economic data - can be combined with flood data for vulnerability analysis.

**Latest Version:** 2024 (updated January 24, 2025)

**Service Endpoints:**
- WMS 2024: `https://service.pdok.nl/cbs/wijkenbuurten/2024/wms/v1_0?request=getcapabilities&service=WMS`
- WFS 2024: `https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0?request=getcapabilities&service=WFS`
- ATOM 2024: `https://service.pdok.nl/cbs/wijkenbuurten/2024/atom/index.xml`

**CBS Gebiedsindelingen 2025:**
- WMS: `https://service.pdok.nl/cbs/gebiedsindelingen/2025/wms/v1_0?request=GetCapabilities&service=WMS`
- WFS: `https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?request=GetCapabilities&service=WFS`

**Use Case:** Overlay flood risk zones with neighborhood statistics to identify vulnerable populations.

### 5.2 Klimaateffectatlas / Climate Impact Atlas

**Note:** Not found in PDOK search results but mentioned in context. May contain additional flood vulnerability assessments.

---

## 6. Data Quality Assessment

### 6.1 Geometry Quality

**Overstromingen - Risicogebied:**
- ✅ **Detail Level:** High - polygon boundaries follow natural and administrative features
- ✅ **Topology:** Clean geometry, INSPIRE-compliant
- ✅ **Precision:** Suitable for municipal-level analysis
- ✅ **Coverage:** Complete Netherlands

**Overstromingen - Gebeurtenis:**
- ✅ **Historical Events:** Limited sample (2018 report basis)
- ⚠️ **Temporal Coverage:** Static historical dataset
- ✅ **INSPIRE Compliance:** Full harmonization

### 6.2 Attribute Richness

**Risk Zones (Risicogebied):**
- ✅ Risk zone descriptions (e.g., "Maas type D - onbeschermd langs regionaal water")
- ✅ INSPIRE identifiers and namespaces
- ✅ Lifecycle timestamps
- ✅ Natural hazard categorization
- ⚠️ Limited detailed attributes (no depth, probability, or impact data in basic service)

**Observed Events:**
- ✅ Event identifiers
- ✅ INSPIRE codelist references
- ✅ Qualitative intensity values
- ⚠️ Limited temporal information in basic properties
- ⚠️ No detailed impact or damage data in basic service

### 6.3 Update Frequency

| Dataset | Update Frequency | Last Update |
|---------|-----------------|-------------|
| Risicogebied | Periodic (EU directive cycles) | 2025-06-06 |
| Gebeurtenis | Static (historical) | 2018 report |
| Waterinfo (RWS) | Real-time | ~10 min delay |

---

## 7. Service Performance & Capabilities

### 7.1 OGC API Features (Recommended)

**Advantages:**
- ✅ Modern RESTful API
- ✅ JSON/GeoJSON output
- ✅ Easier pagination
- ✅ Better documentation
- ✅ CRS negotiation built-in

**Example Response Time:** Fast (< 1 second for small queries)

### 7.2 WFS 2.0.0

**Advantages:**
- ✅ Standard filtering capabilities
- ✅ Multiple output formats (GML, GeoJSON)
- ✅ Result paging
- ✅ Wide client support

**Limitations:**
- ⚠️ More complex XML-based protocol
- ⚠️ Requires more configuration in some clients

### 7.3 WMS 1.3.0

**Advantages:**
- ✅ Universal map rendering
- ✅ GetFeatureInfo support for point queries
- ✅ Multiple CRS support
- ✅ Transparent overlays

**Limitations:**
- ⚠️ Raster output only (no vector data)
- ⚠️ Limited attribute access via GetFeatureInfo

---

## 8. Integration Recommendations

### 8.1 For Where to Live NL Application

**Recommended Approach:**

1. **Primary Service:** Use OGC API Features for data retrieval
   - Collection: `risk_zone`
   - Endpoint: `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items`
   - Format: GeoJSON
   - CRS: EPSG:28992 (matches existing Dutch data)

2. **Map Visualization:** Use WMS for overlay layers
   - Service: `https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0`
   - Layer: `NZ.RiskZone`
   - Transparent: TRUE
   - CRS: Match base map (EPSG:28992 or EPSG:3857)

3. **Point Queries:** Use OGC API with bbox filter
   - Filter by user location coordinates
   - Buffer radius for nearby risk zones
   - Return as GeoJSON for frontend consumption

### 8.2 Implementation Strategy

**Phase 1: Basic Integration**
```javascript
// Example OGC API Features request
const lat = 52.0907;
const lon = 5.1214;
const buffer = 0.05; // ~5km

const bbox = `${lon-buffer},${lat-buffer},${lon+buffer},${lat+buffer}`;
const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&f=json`;

const response = await fetch(url);
const data = await response.json();
```

**Phase 2: Enhanced Features**
- Cache PDOK data locally for performance
- Combine with CBS neighborhood data for vulnerability scoring
- Add real-time water levels from Waterinfo API
- Create composite risk indicators

**Phase 3: Advanced Analysis**
- Historical flood event correlation
- Climate scenario integration
- Multi-hazard assessment (combine with other PDOK datasets)

### 8.3 Technical Specifications

**Recommended CRS Pipeline:**
1. **Storage:** EPSG:28992 (RD New) - matches PDOK native data
2. **API Output:** EPSG:4326 (WGS84) - web-friendly
3. **Map Display:** EPSG:3857 (Web Mercator) - for Leaflet/Mapbox

**GeoJSON Transformation Example:**
```python
import requests
from pyproj import Transformer

# Fetch data from PDOK
response = requests.get(
    'https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items',
    params={'bbox': '120000,480000,130000,490000', 'bbox-crs': 'EPSG:28992', 'f': 'json'}
)

# Transform if needed
transformer = Transformer.from_crs('EPSG:28992', 'EPSG:4326', always_xy=True)
```

---

## 9. Attribution & Licensing

### 9.1 License Requirements

**License:** CC0 1.0 Public Domain
**Attribution:** Not legally required, but recommended

**Recommended Attribution:**
```
Flood risk data: Rijkswaterstaat / PDOK
Source: INSPIRE Richtlijn Overstromingsrisico (ROR)
```

### 9.2 Terms of Use

- ✅ Free for commercial and non-commercial use
- ✅ No registration required
- ✅ No rate limits specified (use responsibly)
- ✅ No usage restrictions

---

## 10. Additional Resources

### 10.1 Documentation

- **PDOK Main Site:** https://www.pdok.nl/
- **PDOK Datasets:** https://www.pdok.nl/datasets
- **Nationaal Georegister:** https://nationaalgeoregister.nl/
- **INSPIRE Portal:** https://inspire.ec.europa.eu/
- **Waterinfo Portal:** https://waterinfo.rws.nl/

### 10.2 Related Tools

- **PDOK Viewer:** https://app.pdok.nl/viewer/
- **NGR Search:** https://www.nationaalgeoregister.nl/geonetwork/srv/search
- **Risicokaart:** https://www.risicokaart.nl/ (Government risk map portal)

### 10.3 API Documentation

- **OGC API Features Spec:** https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/api
- **WMS/WFS Capabilities:** Available via GetCapabilities requests

---

## 11. Testing Results

### 11.1 Endpoint Validation

| Endpoint | Status | Response Time | Notes |
|----------|--------|---------------|-------|
| OGC API (risicogebied) | ✅ Working | < 1s | GeoJSON output |
| OGC API (gebeurtenis) | ✅ Working | < 1s | Historical events |
| WMS (risicogebied) | ✅ Working | < 2s | Map tiles |
| WFS (risicogebied) | ✅ Working | < 2s | Vector data |

### 11.2 Sample Data Verification

**Risk Zone Sample:**
- Feature count: Multiple zones covering NL
- Geometry type: Polygon/MultiPolygon
- Attributes: ID, description, category, timestamps
- Coordinate precision: High (suitable for municipal analysis)

**Observed Event Sample:**
- Feature count: Limited (historical events from 2018 report)
- Event types: PFRA Past Events
- Temporal coverage: Historical only

---

## 12. Known Issues & Limitations

### 12.1 Data Limitations

1. **No Detailed Hazard Maps:** Risk zones indicate APSFR areas but don't include:
   - Flood depth scenarios
   - Probability values (1/100 year, 1/1000 year)
   - Velocity or duration data

2. **Limited Historical Events:** Observed events dataset contains limited historical flood records

3. **No Real-Time Flood Warnings:** PDOK services are static/periodic - use Waterinfo for real-time data

4. **No Climate Scenarios:** Future flood risk projections not included

### 12.2 Service Limitations

1. **No Uptime SLA:** PDOK services have no guaranteed availability (use caching)
2. **Rate Limiting:** Not specified - implement responsible polling
3. **Bulk Download:** Use ATOM feeds for full dataset downloads

### 12.3 Integration Challenges

1. **CRS Complexity:** Multiple CRS support requires careful transformation
2. **Attribute Schema:** INSPIRE harmonization means verbose property names
3. **Limited Filtering:** Some advanced spatial queries may require local processing

---

## 13. Conclusion

PDOK provides comprehensive, high-quality flood risk data suitable for integration into the Where to Live NL application. The modern OGC API Features endpoints offer the best developer experience, while traditional WMS/WFS services provide backward compatibility.

**Key Strengths:**
- ✅ Complete Netherlands coverage
- ✅ INSPIRE-harmonized quality
- ✅ Free, open access (CC0)
- ✅ Multiple service types
- ✅ Well-documented APIs

**Recommended Next Steps:**
1. Implement OGC API Features integration for risk zones
2. Add WMS overlay for map visualization
3. Cache data locally for performance
4. Combine with CBS neighborhood data
5. Consider adding Waterinfo real-time data
6. Explore additional PDOK environmental datasets

---

## 14. References & Sources

### Documentation Sources
- [PDOK Datasets](https://www.pdok.nl/datasets)
- [PDOK Geo Services - ROR](https://www.pdok.nl/geo-services/-/article/richtlijn-overstromingsrisico-eu2018)
- [PDOK OGC Webservices - ROR](https://www.pdok.nl/ogc-webservices/-/article/richtlijn-overstromingsrisico-eu2018)
- [Nationaal Georegister](https://www.nationaalgeoregister.nl/)
- [PDOK Status Overview](https://www.pdok.nl/status-overzicht)
- [Rijkswaterstaat Waterinfo](https://waterinfo.rws.nl/)
- [Rijkswaterstaat Waterdata](https://rijkswaterstaatdata.nl/waterdata/)

### Service Endpoints
- [OGC API - Risicogebied](https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1?f=html&lang=en)
- [OGC API - Gebeurtenis](https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1?f=html&lang=en)
- [PDOK API Portal](https://api.pdok.nl/)

### Community Resources
- [Geoforum - Overstromingsrisico WFS/WMS](https://geoforum.nl/t/overstromingsrisico-per-regio-wfs-wms/7397)
- [PDOK GitHub](https://github.com/PDOK)
- [Risicokaart](https://www.risicokaart.nl/risicosituaties/overstroming/)

---

**Report Generated:** December 23, 2025
**Next Review Date:** Q2 2026 (check for new EU Flood Risk Directive cycle data)
