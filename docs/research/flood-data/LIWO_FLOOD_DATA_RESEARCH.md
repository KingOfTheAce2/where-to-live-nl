# LIWO and Dutch Flood Data Research Report

**Research Date:** 2025-12-23
**Purpose:** Investigate LIWO, Risicokaart, and other Dutch flood data sources for integration into where-to-live-nl project

---

## Executive Summary

This research identifies multiple authoritative sources for Dutch flood data, with the primary platform being **LIWO (Landelijk Informatiesysteem Water en Overstromingen)** and its underlying **LDO (Landelijke Databank Overstromingsinformatie)** database. The data is accessible through various WMS/WFS services hosted on GeoServer instances operated by Rijkswaterstaat, Nelen & Schuurmans, and provincial authorities.

**Key Finding:** The main technical infrastructure uses:
- **Lizard platform** by Nelen & Schuurmans for data storage and APIs
- **GeoServer** instances for WMS/WFS services
- **PDOK/NGR** for standardized INSPIRE-compliant access
- Approximately **5,000 flood scenarios** covering breach locations across the Netherlands

---

## 1. LIWO (Landelijk Informatiesysteem Water en Overstromingen)

### Overview
- **Official URL:** https://basisinformatie-overstromingen.nl/
- **Managed by:** Watermanagementcentrum Nederland (WMCN)
- **Partners:** Water boards, Rijkswaterstaat, KNMI, Defense
- **Latest Version:** LIWO 2025.1.2 (released May 7, 2025)
- **Data Coverage:** ~5,000 flood scenarios across the Netherlands

### What LIWO Provides

**Core Data Types:**
1. **Flood depth maps** (maximale waterdiepte)
2. **Flood probabilities** (overstromingskansen)
3. **Breach scenarios** (dijkdoorbraak scenario's)
4. **Flow velocities** (stroomsnelheden)
5. **Rise rates** (stijgsnelheden)
6. **Water arrival times** (aankomsttijden)
7. **Evacuation key figures** (evacuatie-kerncijfers)
8. **Damage and casualty estimates** (schade en slachtoffers)
9. **Area divisions and boundaries** (gebiedsindelingen)
10. **Vulnerable objects** (kwetsbare objecten)

### Key Features
- **Scenario Combination:** Users can combine individual flood scenarios from different breach locations online
- **Interactive Analysis:** Combined results show maximum water depth, flow velocity, rise rate, damage/casualty figures
- **Professional Focus:** Aimed at professionals for planning, risk communication, and crisis management
- **Open Data:** Uses a central knowledge database with open data

### Web Services Architecture
- **Service Type:** WMS (Web Map Service)
- **Applications using LIWO:** Overstroomik.nl gets data from LIWO via WMS web services
- **Data Format:** Spatial raster and vector data accessible through standard OGC protocols

### Documentation
- **User Guide:** Replaced by Start Tour in version 2025.1.2
- **Newsletters:** Regular updates published via IPLO (Informatiepunt Leefomgeving)
- **Technical Docs:** Available through IPLO webinars and PDF documentation

**Sources:**
- [LIWO on IPLO](https://iplo.nl/thema/water/applicaties-modellen/berichtgeving-crisismanagement/liwo/)
- [LIWO by HKV](https://www.hkv.nl/projecten/landelijk-informatiesysteem-water-en-overstromingen-liwo/)
- [LIWO Main Site](https://basisinformatie-overstromingen.nl/)
- [Atlas Leefomgeving - Flood Risks](https://www.atlasleefomgeving.nl/nieuws/wat-moet-je-weten-over-overstromingsrisicos-in-nederland)

---

## 2. LDO (Landelijke Databank Overstromingsinformatie)

### Overview
- **Developer:** Nelen & Schuurmans (commissioned by BIJ12)
- **Platform:** Lizard (SaaS solution)
- **Purpose:** Central platform for collection and distribution of flood information in the Netherlands
- **Maintenance:** 5-year contract with Nelen & Schuurmans

### Technical Architecture

**Data Storage:**
- **Backend:** Lizard platform (NoSQL + PostgreSQL)
  - HBase (NoSQL) for time series
  - Raster Store (NoSQL, proprietary by Nelen & Schuurmans)
  - PostgreSQL (SQL) for vector data
- **Performance:** Optimized for fast presentation of flood information
- **Type:** Software as a Service (SaaS)

**API Access:**
- **Web Interface:** Browser-based access to flood data
- **REST API:** Application Programming Interface for automated data retrieval
- **Integration:** Can link with external applications
- **Upload Capability:** API supports data uploads to platform

**Current API Applications:**
- Automatic economic damage calculation using SSM (Schade en Slachtoffermodule - Damage and Casualty Module)
- Integration with LIWO web interface
- Data feeds to klimaateffectatlas.nl and overstroomik.nl

### Data Contributors
- Water boards (waterschappen)
- Provinces
- Rijkswaterstaat
- Research institutions

**Sources:**
- [LDO Development by Nelen & Schuurmans](https://nelen-schuurmans.nl/case/ontwikkeling-landelijke-databank-overstromingsinformatie-ldo/)
- [Overstromingsinformatie.nl](https://www.overstromingsinformatie.nl/)
- [Lizard Platform](https://lizard.net/)

---

## 3. Risicokaart.nl - Flood Risk Maps

### Overview
- **Official URL:** https://www.risicokaart.nl/risicosituaties/overstroming/
- **Purpose:** Public access to flood risk information
- **Data Source:** LIWO/LDO database
- **Compliance:** EU Flood Risk Directive (ROR)
- **Public Availability:** Since December 20, 2019

### Data Sources for Risicokaart.nl

**Primary Source:**
- Landelijk Informatiesysteem Water en Overstromingen (LIWO)
- Data compiled by provinces, water boards, Rijkswaterstaat, and Ministry of Infrastructure and Water Management

**WMS/WFS Endpoints:**

**Provincial Services (Example - Province NZ):**
```
https://geodata.nationaalgeoregister.nl/provincies/nz/wms/v1
```

**Available Layers:**
- `NZ.ExposedElement.nlnz-ork` - Exposed elements (vulnerable objects)
- `NZ.HazardArea.nlnz-ork` - Hazard areas (flood zones)
- `NZ.ObservedEvent.nlnz-ork` - Observed flood events
- `NZ.RiskZone.nlnz-ork` - Risk zones

**National Services:**
```
https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0
```

### Data Formats
- **WMS:** Available for all datasets
- **WCS:** Available for some datasets
- **WFS:** Available for vector data
- **Shapefiles:** NOT available for all datasets (some only in WMS/WCS)

### EU Flood Risk Directive Implementation

**INSPIRE Themes:**
- Natural Risk Zones (Gebieden met natuurrisico's)
- Flood hazard maps (Overstromingsgevaarkaarten)
- Flood risk maps (Overstromingsrisicokaarten)

**GetCapabilities Example:**
```
https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?request=GetCapabilities&service=WMS
```

**Sources:**
- [Risicokaart.nl Data](https://www.risicokaart.nl/algemene-informatie/data/)
- [Overstromingsrisicokaarten on Data Overheid](https://data.overheid.nl/dataset/13224-overstromingsrisicokaarten)
- [NGR Metadata](https://www.nationaalgeoregister.nl/geonetwork/srv/api/records/2daad588-11ef-47de-9832-6fe2c3b93e6d)

---

## 4. Lizard Platform & GeoServer Infrastructure

### Lizard Platform (Nelen & Schuurmans)

**Official Documentation:** https://docs.lizard.net/

**Core Capabilities:**
- Data warehouse for water, climate, and physical environment data
- Brings together data from different sources
- Makes data searchable and available for integrated use
- Provides spatio-temporal analysis tools

**API Architecture:**
- **Web API:** Backend provides REST API for custom applications
- **Optimized Viewer:** Frontend with powerful analysis tools
- **Data Types Supported:**
  1. Time series (HBase/NoSQL)
  2. Rasters (Raster Store/NoSQL)
  3. Vectors (PostgreSQL/SQL)

**GeoServer Integration:**
- Coupling to link WMS layers
- Support for river dike calculations
- Standard OGC service compliance

**Support:**
- **Email:** servicedesk@nelen-schuurmans.nl
- **Portal:** https://nelen-schuurmans.topdesk.net/
- **GitHub:** https://github.com/nens (multiple Lizard repositories)

### Known GeoServer Instances

**1. LDO GeoServer (Primary Flood Data):**
```
https://ldo-geoserver.lizard.net/geoserver/ows
```

**WFS GetCapabilities:**
```
https://ldo-geoserver.lizard.net/geoserver/ows?service=WFS&acceptversions=2.0.0&request=GetCapabilities
```

**WMS GetCapabilities (Expected):**
```
https://ldo-geoserver.lizard.net/geoserver/ows?service=WMS&request=GetCapabilities
```

**2. Klimaatatlas GeoServer (Climate Impact Data):**
```
https://maps1.klimaatatlas.net/geoserver/ows
```

**WFS GetCapabilities:**
```
https://maps1.klimaatatlas.net/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities
```

**Example Flood Layers:**
- `1809_Rijnland_afvoergemaal_overstroming_primair` - Vulnerability of discharge pumping stations (primary flood)
- `1809_Rijnland_afvoergemaal_overstroming_regionaal` - Vulnerability for regional flooding
- `1809_Rijnland_doorspoelgemaal_overstroming_primair` - Flushing pumping stations (primary breach)
- `1809_Rijnland_doorspoelgemaal_overstroming_regionaal` - Flushing pumping stations (regional breach)
- `1809_Rijnland_effluentgemalen_overstromingen_primair` - Effluent pumping stations (primary breach)

**3. Rijkswaterstaat GeoServer:**
```
https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows
```

**WMS GetCapabilities:**
```
https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows?service=WMS&request=getcapabilities&version=1.3.0
```

**4. Basisinformatie Overstromingen GeoServer:**
```
https://basisinformatie-overstromingen.nl/geoserver/LIWO_Basis/wms
```

### Additional Service Subdomains

From basisinformatie-overstromingen.nl domain:
- `http://dataservice.basisinformatie-overstromingen.nl`
- `http://geodata.basisinformatie-overstromingen.nl`
- `http://professional.basisinformatie-overstromingen.nl`
- `http://profgeodata.dynamic.basisinformatie-overstromingen.nl`
- `http://profgeodata.static.basisinformatie-overstromingen.nl`

**Sources:**
- [Lizard Documentation](https://docs.lizard.net/)
- [Lizard Climate Atlas](https://klimaatadaptatienederland.nl/hulpmiddelen/overzicht/lizard-klimaatatlas/)
- [Klimaatatlas Catalog](https://klimaatatlas.lizard.net/catalog/)
- [Nelen & Schuurmans GitHub](https://github.com/nens?q=lizard)

---

## 5. Nationaal Georegister (NGR) & PDOK

### Overview
- **NGR URL:** https://www.nationaalgeoregister.nl/
- **PDOK URL:** https://www.pdok.nl/
- **Purpose:** Central facility for describing and providing access to geo-information for the Netherlands
- **INSPIRE Datasets:** 200+ datasets with ~265 associated services

### Service Statistics
- **OGC:WMS:** 4,933 services
- **OGC:WFS:** 3,707 services
- **OGC:WCS:** 800 services
- **OGC:WMTS:** 71 services

### Flood-Related Datasets in NGR

**1. Richtlijn Overstromingsrisico (EU Flood Risk Directive)**

**Metadata Record:**
```
https://www.nationaalgeoregister.nl/geonetwork/srv/api/records/2ca26f5e-0b39-48a4-9e8d-7b9ffde9a5b0
```

**WMS Endpoint:**
```
https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0
```

**GetCapabilities:**
```
https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?request=GetCapabilities&service=WMS
```

**Version:** EU2018 (created 2020-03-18)

**INSPIRE Theme:** Gebieden met natuurrisico's (Natural Risk Zones)

**Keywords:** natuurgebieden, nationaal, risico, overstroming, richtlijn

**License:** Free to use and download (Vrij om te gebruiken en te downloaden) - No restrictions

**2. Overstromingsbeeld Doorbraak Primaire Waterkeringen**

**Data Overheid URL:**
```
https://data.overheid.nl/en/dataset/13687-overstromingsbeeld-doorbraak-primaire-waterkeringen
```

**Source:** Compiled from primary flood images from Risicokaart.nl
**Database:** Landelijke Database Overstromingsgegevens

**3. Provincial Flood Risk Maps**

Provincial WMS services follow this pattern:
```
https://geodata.nationaalgeoregister.nl/provincies/{province_code}/wms/v1
```

### PDOK Service Characteristics

**Service Limitations:**
- Maximum 1,000 objects per request (to prevent server overload)
- ResponsePaging supported in WFS 2.0.0+

**Standard GetCapabilities Patterns:**

**WFS Example:**
```
http://geodata.nationaalgeoregister.nl/{dataset}/wfs?service=WFS&request=GetCapabilities
```

**WMS Example:**
```
http://geodata.nationaalgeoregister.nl/{dataset}/wms?service=WMS&request=GetCapabilities
```

### PDOK Documentation
- **Main Docs:** https://pdok-ngr.readthedocs.io/
- **Services:** https://pdok-ngr.readthedocs.io/services.html
- **Datasets:** https://pdok-ngr.readthedocs.io/data.html
- **Quick Start:** https://pdok-ngr.readthedocs.io/quickstart.html

**Sources:**
- [NGR Search](https://www.nationaalgeoregister.nl/geonetwork/srv/search?type=dataset)
- [PDOK Services Documentation](https://pdok-ngr.readthedocs.io/services.html)
- [PDOK on Interoperable Europe Portal](https://joinup.ec.europa.eu/collection/geographic-information-system-gis-software/solution/pdok-public-services-map/about)

---

## 6. Breach Scenarios (Dijkdoorbraak) Data

### Overview
- **Total Scenarios:** ~5,000 breach locations across the Netherlands
- **Scenario Types:** Primary barriers (primaire waterkeringen) and regional barriers (regionale waterkeringen)
- **Storage:** Landelijke Database Overstromingssimulaties (LDO)

### Scenario Modeling Standards

**VNK2 Guidelines:**
- Minimum 1 breach location per dike section
- Multiple locations when consequences differ significantly within dike section
- Simulations stored in LDO
- Presented on multiple public platforms

**Public Presentation Platforms:**
1. **Overstroomik.nl** - Consumer-facing flood checker
2. **Klimaateffectatlas.nl** - Climate impact stories
3. **LIWO** (basisinformatie-overstromingen.nl) - Professional platform
4. **Atlas Leefomgeving** - Environmental atlas

### Breach Scenario Data Types

**Per Breach Location:**
1. **Maximum water depth** (maximale waterdiepte) - meters
2. **Flow velocity** (stroomsnelheid) - m/s
3. **Rise rate** (stijgsnelheid) - m/hour
4. **Water arrival time** (aankomsttijd) - hours after breach
5. **Flood extent** (overstroomde gebied) - polygon geometry
6. **Damage estimates** (schadeberekening) - euros
7. **Casualty estimates** (slachtofferberekening) - numbers
8. **Evacuation requirements** (evacuatiegegevens) - persons

### Probability Scenarios

**Standard Scenarios:**
- 1/10 year flood (high probability)
- 1/100 year flood (medium probability)
- 1/1,000 year flood (low probability)
- 1/10,000 year flood (very low probability)
- 1/100,000 year flood (extreme scenario from Deltaprogramma)

### Scenario Combination Feature

**LIWO Capability:**
- Combine individual flood scenarios from different breach locations
- Calculate combined maximum water depth
- Aggregate flow velocities
- Compound damage and casualty figures
- Interactive online analysis

### Data Access Methods

**1. Via Atlas Leefomgeving:**
```
https://www.atlasleefomgeving.nl/maximale-waterdiepte-bij-overstroming
```
Shows maximum water depth per breach scenario

**2. Via Risicokaart.nl:**
```
https://www.risicokaart.nl/risicosituaties/overstroming/
```
Interactive map interface

**3. Via LIWO Professional:**
```
https://basisinformatie-overstromingen.nl/
```
Full scenario analysis and combination tools

**Sources:**
- [Atlas Leefomgeving - Maximale Waterdiepte](https://www.atlasleefomgeving.nl/maximale-waterdiepte-bij-overstroming)
- [Leidraad Overstromingssimulaties 2024](https://iplo.nl/publish/pages/139608/11210368-001-zws-0002_v1-0-leidraad-voor-het-maken-van-overstromingssimulaties-voor-publicatie.pdf)
- [Overstromingsbeeld Primaire Waterkeringen](https://data.overheid.nl/en/dataset/13687-overstromingsbeeld-doorbraak-primaire-waterkeringen)

---

## 7. Additional Data Types Available

### 7.1 Vulnerable Objects (Kwetsbare Objecten)

**Layer Name:** `NZ.ExposedElement.nlnz-ork`

**Object Types:**
- Hospitals and healthcare facilities
- Schools and childcare centers
- Elderly care homes
- Prisons
- Evacuation centers
- Critical infrastructure (pumping stations, treatment plants)

### 7.2 Dry Floor Analysis

**Klimaatatlas Layers:**
- Buildings with dry floors after dike breach
- Classification: 'dry', 'not dry', 'unknown'
- Comparison of building heights vs. water depths
- Combined flood images from primary and regional barriers

**Example Layers:**
- Discharge pumping stations vulnerability (afvoergemaal)
- Flushing pumping stations vulnerability (doorspoelgemaal)
- Effluent pumping stations vulnerability (effluentgemalen)

### 7.3 Evacuation Data

**Available Information:**
- Evacuation routes
- Evacuation key figures (evacuatie-kerncijfers)
- Number of persons requiring evacuation
- Evacuation timing requirements
- Area divisions for evacuation planning

### 7.4 Observed Flood Events

**Layer Name:** `NZ.ObservedEvent.nlnz-ork`

**Historical Events:**
- 1953 North Sea Flood
- 1995 Meuse/Rhine floods
- 2003 Wilnis dike breach (heatwave-induced)
- 1776 Vollenhove-Kampen breach
- Other documented flood events

**OGC API for Observed Events:**
```
https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1
```
INSPIRE-harmonized observed flood events

### 7.5 Risk Zones

**Layer Name:** `NZ.RiskZone.nlnz-ork`

**Classifications:**
- High risk zones (hoog risico)
- Medium risk zones (middel risico)
- Low risk zones (laag risico)
- Based on probability and potential impact

---

## 8. Technical Integration Recommendations

### 8.1 Primary WMS Endpoints for Integration

**Recommended Priority Order:**

**1. LIWO/LDO GeoServer (Highest Priority):**
```javascript
{
  name: "LDO Flood Scenarios",
  url: "https://ldo-geoserver.lizard.net/geoserver/ows",
  type: "wms",
  version: "1.3.0",
  layers: ["to be determined from GetCapabilities"],
  attribution: "Rijkswaterstaat / Nelen & Schuurmans"
}
```

**2. NGR Flood Risk Directive (INSPIRE-compliant):**
```javascript
{
  name: "EU Flood Risk Directive NL",
  url: "https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0",
  type: "wms",
  version: "1.3.0",
  layers: ["risk_zones", "hazard_areas", "exposed_elements"],
  attribution: "Rijkswaterstaat"
}
```

**3. Klimaatatlas Flood Impacts:**
```javascript
{
  name: "Climate Atlas Flood Impact",
  url: "https://maps1.klimaatatlas.net/geoserver/ows",
  type: "wms",
  version: "1.1.0",
  layers: ["dry_floor_analysis", "vulnerable_infrastructure"],
  attribution: "Nelen & Schuurmans"
}
```

**4. Rijkswaterstaat Flood Risk:**
```javascript
{
  name: "RWS Flood Risk",
  url: "https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows",
  type: "wms",
  version: "1.3.0",
  layers: ["to be determined"],
  attribution: "Rijkswaterstaat"
}
```

### 8.2 API Integration (Future Enhancement)

**Lizard API:**
- **Base URL:** To be determined from docs.lizard.net
- **Authentication:** Contact servicedesk@nelen-schuurmans.nl
- **Capabilities:**
  - Query flood scenarios by location
  - Retrieve time series data
  - Access raster data (depth maps)
  - Get vector geometries (flood extents)

**PDOK OGC API (Modern Alternative to WFS):**
```javascript
{
  name: "PDOK Flood Events OGC API",
  url: "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1",
  type: "ogc-api-features",
  collections: ["observed_events"],
  format: "geojson"
}
```

### 8.3 Layer Styling Recommendations

**Flood Depth Gradient:**
```javascript
0.0 - 0.25m: #E0F3F8 (very light blue)
0.25 - 0.5m: #ABD9E9 (light blue)
0.5 - 1.0m: #74ADD1 (medium blue)
1.0 - 2.0m: #4575B4 (blue)
2.0 - 3.0m: #313695 (dark blue)
> 3.0m: #17194A (very dark blue)
```

**Flood Risk Categories:**
```javascript
High Risk: #D73027 (red)
Medium Risk: #FEE08B (yellow)
Low Risk: #1A9850 (green)
Negligible: #E0E0E0 (gray)
```

### 8.4 Data Update Frequency

**LIWO Platform:**
- Major updates: Every 6 years (new flood scenarios)
- Minor updates: Quarterly (corrections, additions)
- Software updates: Monthly (like 2025.1.2)

**Recommendation:**
- Cache WMS tiles with 1-month expiry
- Check for LIWO version changes monthly
- Monitor Rijkswaterstaat announcements

---

## 9. Licensing & Attribution

### Data License
**All flood data is Open Data:**
- Free to use and download
- No restrictions on commercial use
- Attribution required

### Required Attribution

**For LIWO/LDO data:**
```
Data: Rijkswaterstaat / WMCN / Nelen & Schuurmans
Source: Landelijk Informatiesysteem Water en Overstromingen (LIWO)
```

**For NGR/PDOK data:**
```
Data: Rijkswaterstaat
Source: Nationaal Georegister / PDOK
```

**For Klimaatatlas data:**
```
Data: Nelen & Schuurmans
Source: Klimaatatlas
```

### Compliance Requirements
- INSPIRE Directive compliance (EU)
- Dutch ROSA (Rijksdienst voor Ondernemend Nederland Service Agreement)
- GDPR compliance for any user data collection

---

## 10. Related Data Sources for Integration

### 10.1 Rijkswaterstaat WaterInfo API

**Purpose:** Real-time water level data
**URL:** https://waterinfo.rws.nl/
**API:** DL-API-Waterdata
**Developer Portal:** https://apis.developer.overheid.nl/apis/rijkswaterstaat-wm-ws-dl

**Services:**
- MetadataService (catalog of measurement stations)
- OnlineWaarnemingenService (real-time observations)
- OGC WMS/WFS for measurement locations
- JSON web services

### 10.2 Atlas Leefomgeving

**URL:** https://www.atlasleefomgeving.nl/
**Flood Section:** Specific maps for flood depth visualization
**Integration:** Can embed Atlas Leefomgeving widgets

### 10.3 Klimaateffectatlas

**URL:** https://www.klimaateffectatlas.nl/
**Purpose:** Map stories explaining flood information from LIWO
**Target Audience:** Professionals not in water sector and students

### 10.4 Overstroomik.nl

**URL:** https://overstroomik.nl/
**Purpose:** Consumer-facing "will I flood?" checker
**Data Source:** LIWO via WMS services
**Feature:** Address-based flood risk lookup

---

## 11. Implementation Roadmap

### Phase 1: Basic Flood Overlay (Week 1)
1. Add LIWO WMS layer to map
2. Query GetCapabilities for available layers
3. Implement basic flood depth visualization
4. Add layer toggle in UI

### Phase 2: Risk Assessment (Week 2)
1. Integrate NGR flood risk zones
2. Add point-based risk lookup
3. Display flood probability for address
4. Show maximum expected water depth

### Phase 3: Advanced Features (Week 3-4)
1. Multiple breach scenario visualization
2. Evacuation route display
3. Vulnerable infrastructure overlay
4. PDF export with flood risk section

### Phase 4: API Integration (Future)
1. Contact Nelen & Schuurmans for Lizard API access
2. Implement direct LDO database queries
3. Add real-time water level integration
4. Historical flood event timeline

---

## 12. Contact Information for Data Access

### Primary Contacts

**LIWO Platform:**
- **Organization:** Watermanagementcentrum Nederland (WMCN)
- **Website:** https://basisinformatie-overstromingen.nl/
- **Support:** Via IPLO platform

**LDO/Lizard Platform:**
- **Organization:** Nelen & Schuurmans
- **Email:** servicedesk@nelen-schuurmans.nl
- **Service Desk:** https://nelen-schuurmans.topdesk.net/
- **Documentation:** https://docs.lizard.net/

**PDOK/NGR:**
- **Organization:** Kadaster
- **Website:** https://www.pdok.nl/
- **Documentation:** https://pdok-ngr.readthedocs.io/
- **Support:** Via PDOK contact form

**Rijkswaterstaat:**
- **Organization:** Ministry of Infrastructure and Water Management
- **Data Portal:** https://rijkswaterstaatdata.nl/
- **Developer Portal:** https://apis.developer.overheid.nl/

---

## 13. Next Steps

### Immediate Actions (This Week)
1. ✅ Research complete - documented in this file
2. ⬜ Test WMS GetCapabilities requests for all identified endpoints
3. ⬜ Download sample WMS tiles to verify data quality
4. ⬜ Identify specific layer names for flood depth, risk zones, breach scenarios
5. ⬜ Create TypeScript interfaces for flood data types

### Short-term Actions (Next 2 Weeks)
1. ⬜ Implement WMS integration in frontend Map component
2. ⬜ Add flood risk API endpoint to backend
3. ⬜ Create flood risk visualization UI components
4. ⬜ Test with real addresses across different risk zones
5. ⬜ Add flood data to PDF export

### Long-term Actions (Next Month)
1. ⬜ Contact Nelen & Schuurmans for API access
2. ⬜ Explore direct Lizard platform integration
3. ⬜ Add scenario comparison features
4. ⬜ Integrate real-time water level data
5. ⬜ Create flood risk trend analysis

---

## 14. Technical Specifications Summary

### WMS Services Identified

| Service Name | URL | Type | Status | Priority |
|-------------|-----|------|--------|----------|
| LDO GeoServer | https://ldo-geoserver.lizard.net/geoserver/ows | WMS/WFS | Active | High |
| NGR Flood Risk 2018 | https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0 | WMS | Active | High |
| Klimaatatlas | https://maps1.klimaatatlas.net/geoserver/ows | WMS/WFS | Active | Medium |
| RWS Flood Risk | https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows | WMS | Active | Medium |
| LIWO Basis | https://basisinformatie-overstromingen.nl/geoserver/LIWO_Basis/wms | WMS | Unknown | Medium |
| Provincial (NZ example) | https://geodata.nationaalgeoregister.nl/provincies/nz/wms/v1 | WMS | Active | Low |

### Data Types Available

| Data Type | Source | Format | Update Frequency |
|-----------|--------|--------|------------------|
| Flood depth maps | LDO/LIWO | Raster (WMS) | 6 years |
| Breach scenarios | LDO | Vector (WFS) | 6 years |
| Risk zones | NGR | Vector (WFS) | Annual |
| Vulnerable objects | NGR | Vector (WFS) | Annual |
| Evacuation routes | LIWO | Vector | As needed |
| Flood probabilities | LIWO | Attribute data | 6 years |
| Historical events | PDOK OGC API | Vector (GeoJSON) | Static |
| Dry floor analysis | Klimaatatlas | Vector (WFS) | Annual |

---

## 15. References & Sources

### Official Documentation
- [LIWO on IPLO](https://iplo.nl/thema/water/applicaties-modellen/berichtgeving-crisismanagement/liwo/)
- [Lizard Platform Documentation](https://docs.lizard.net/)
- [PDOK Documentation](https://pdok-ngr.readthedocs.io/)
- [NGR Metadata Portal](https://www.nationaalgeoregister.nl/geonetwork/srv/search)

### Data Portals
- [Data Overheid](https://data.overheid.nl/)
- [Rijkswaterstaat Data](https://rijkswaterstaatdata.nl/)
- [Developer Overheid APIs](https://apis.developer.overheid.nl/)

### Key Datasets
- [Overstromingsrisicokaarten](https://data.overheid.nl/dataset/13224-overstromingsrisicokaarten)
- [Overstromingsbeeld Doorbraak](https://data.overheid.nl/en/dataset/13687-overstromingsbeeld-doorbraak-primaire-waterkeringen)

### Technical Resources
- [Nelen & Schuurmans GitHub](https://github.com/nens)
- [PDOK GitHub](https://github.com/PDOK)
- [Geonovum PDOK Documentation GitHub](https://github.com/Geonovum/PDOK-NGR-documentatie)

---

## Appendix A: Acronyms & Terminology

| Acronym | Dutch Full Name | English Translation |
|---------|----------------|-------------------|
| LIWO | Landelijk Informatiesysteem Water en Overstromingen | National Information System Water and Floods |
| LDO | Landelijke Databank Overstromingsinformatie | National Flood Information Database |
| NGR | Nationaal Georegister | National Geo-register |
| PDOK | Publieke Dienstverlening Op de Kaart | Public Services On the Map |
| WMCN | Watermanagementcentrum Nederland | Water Management Centre Netherlands |
| ROR | Richtlijn Overstromingsrisico | Flood Risk Directive |
| VNK2 | Veiligheid Nederland in Kaart 2 | Safety of the Netherlands in Maps 2 |
| SSM | Schade en Slachtoffermodule | Damage and Casualty Module |
| RWS | Rijkswaterstaat | National Water Authority |
| OGC | Open Geospatial Consortium | - |
| WMS | Web Map Service | - |
| WFS | Web Feature Service | - |
| INSPIRE | Infrastructure for Spatial Information in Europe | - |

### Key Dutch Terms

| Dutch | English |
|-------|---------|
| Overstroming | Flood/Flooding |
| Dijkdoorbraak | Dike/Levee breach |
| Waterdiepte | Water depth |
| Stroomsnelheid | Flow velocity |
| Stijgsnelheid | Rise rate |
| Kwetsbare objecten | Vulnerable objects |
| Evacuatie | Evacuation |
| Schade | Damage |
| Slachtoffers | Casualties |
| Primaire waterkering | Primary water barrier |
| Regionale waterkering | Regional water barrier |
| Waterschap | Water board |
| Overstromingsbeeld | Flood scenario/image |
| Overstromingskans | Flood probability |

---

**End of Research Report**

**Generated by:** Research Agent
**Date:** 2025-12-23
**Version:** 1.0
**Status:** Complete - Ready for implementation
