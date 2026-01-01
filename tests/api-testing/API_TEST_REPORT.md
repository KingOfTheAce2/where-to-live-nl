# Flood Risk API Endpoint Testing Report

**Test Date**: 2025-12-23
**Test Location**: Valkenburg, Limburg (BBOX: 5.8,50.85,5.9,50.87)
**Purpose**: Evaluate availability and data quality of Dutch flood risk APIs

---

## 1. PDOK Services - Overstromingen Risicogebied

### Status: ✅ FULLY OPERATIONAL

**OGC API Endpoint**: `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/`

#### Available Collections:
- `risk_zone` - Risicogebieden (Risk Zones)

#### Test Results:
- **Accessibility**: ✅ Excellent
- **Response Format**: GeoJSON, JSON-FG, HTML
- **CRS Support**: CRS84 (WGS84), EPSG:28992 (RD New), EPSG:3857, EPSG:4258
- **Coverage**: Netherlands-wide (2.35°E - 7.56°E, 50.71°N - 55.67°N)
- **Update**: 2025-06-06

#### Working Command:
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=5.8,50.85,5.9,50.87&limit=5" \
  -H "Accept: application/geo+json"
```

#### Data Quality:
- **Geometry**: Polygon features
- **Attributes**: INSPIRE-harmonized risk zone data
- **License**: CC0 1.0 (Public Domain)
- **Source**: Richtlijn Overstromingsrisico's (ROR) 2e cyclus: 2016-2021

---

## 2. PDOK Services - Overstromingen Gebeurtenis

### Status: ✅ FULLY OPERATIONAL

**OGC API Endpoint**: `https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1/`

#### Available Collections:
- `observed_event` - Overstromingen (Observed Flood Events)

#### Test Results:
- **Accessibility**: ✅ Excellent
- **Response Format**: GeoJSON, JSON-FG, HTML
- **CRS Support**: CRS84, EPSG:28992, EPSG:3857, EPSG:4258
- **Coverage**: Netherlands-wide
- **Update**: 2025-06-06

#### Working Command:
```bash
curl "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1/collections/observed_event/items?bbox=5.8,50.85,5.9,50.87&limit=5" \
  -H "Accept: application/geo+json"
```

#### Data Quality:
- **Geometry**: Event location polygons
- **Attributes**: INSPIRE Natural Hazards - Floods - Observed Events
- **License**: CC0 1.0
- **HVD Compliance**: High-Value Dataset (Earth observation and environment)

---

## 3. Klimaateffectatlas (Climate Atlas)

### Status: ⚠️ OPERATIONAL (City-specific data)

**WFS Endpoint**: `https://maps1.klimaatatlas.net/geoserver/ows`

#### Service Provider: Nelen & Schuurmans

#### Available Flood-Related Layers (Sample):
- `lv_klimaatatlas:1803_lv_kwetsbare_panden_t100` - Vulnerable buildings T100
- `lv_klimaatatlas:1803_lv_kwetsbare_objecten_t100` - Vulnerable objects T100
- `lv_klimaatatlas:1803_lv_begaanbare_wegen_t100` - Road passability T100
- `schiedam_klimaatatlas:1803_schiedam_begaanbaarheid_wegen_60mm` - Road passability 60mm
- `rotterdam_klimaatatlas:1803_rotterdam_max_waterdiepte_60mm` - Max water depth 60mm
- `almere_klimaatatlas:1802_almere_waterlabels_luchtfoto_2015` - Water labels

#### Test Results:
- **Accessibility**: ✅ Good
- **Response Format**: GML, GeoJSON, KML, Shapefile, CSV, GeoPackage
- **Coverage**: ⚠️ **City-specific** (not nationwide)
- **Cities Available**: Rotterdam, Schiedam, Leidschendam-Voorburg, Almere, etc.

#### Limitations:
- Data is fragmented by municipality
- Different naming conventions per city
- No unified national layer
- Varying scenarios (T100, 60mm, 70mm events)

#### Working Command (Rotterdam example):
```bash
curl "https://maps1.klimaatatlas.net/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=rotterdam_klimaatatlas:1803_rotterdam_max_waterdiepte_60mm&outputFormat=application/json&bbox=4.4,51.9,4.5,51.95" \
  -H "Accept: application/json"
```

---

## 4. Lizard GeoServer (National Geodata Registry)

### Status: ✅ EXCELLENT - Most Comprehensive

**WFS Endpoint**: `https://ldo-geoserver.lizard.net/geoserver/ows`

#### Available Flood Scenarios:
- **T10** (Grote kans / High probability - 1 in 10 years)
- **T100** (Middelgrote kans / Medium probability - 1 in 100 years)
- **T1000** (Kleine kans / Low probability - 1 in 1000 years)
- **T10000** (Zeer kleine kans / Very low probability - 1 in 10000 years)

#### Key Layers (per scenario):
- `ror3:t100_maximale_waterdiepte` - Maximum water depth
- `ror3:t100_overstroomde_gebieden` - Flooded areas
- `ror3:t100_indicatief_potentieel_getroffenen` - Affected population
- `ror3:t100_type_economische_bedrijvigheid` - Economic activity
- `ror3:t100_bijzonder_kwetsbare_cultuurhistorische_objecten` - Cultural heritage
- `ror3:t100_ied_installaties` - Industrial installations

#### Additional Layers:
- `ror3:bergingsgebieden` - Water storage areas
- `ror3:t10_drinkwaterwingebieden` - Drinking water extraction areas
- `ipo_ror:ipo_ror_*_gg2` - Duration of flooding

#### Test Results:
- **Accessibility**: ✅ Excellent
- **Response Format**: GeoJSON, GML, KML, Shapefile, CSV, GeoPackage
- **CRS**: EPSG:28992 (RD New) native
- **Coverage**: ✅ **Nationwide** Netherlands
- **Data Completeness**: ✅ Very comprehensive

#### Working Command (T100 Maximum Water Depth):
```bash
curl "https://ldo-geoserver.lizard.net/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=ror3:t100_maximale_waterdiepte&outputFormat=application/json&bbox=5.8,50.85,5.9,50.87,EPSG:4326&count=5"
```

#### Data Quality:
- **Geometry**: High-resolution polygons
- **Scenarios**: Multiple return periods (T10, T100, T1000, T10000)
- **Attributes**: Water depth (m), duration, affected areas
- **Source**: ROR (Richtlijn Overstromingsrisico's) official data

---

## Recommendations

### 🥇 Primary Source: **Lizard GeoServer**
**Recommended for production use**

**Pros**:
- ✅ Nationwide coverage
- ✅ Multiple flood scenarios (T10-T10000)
- ✅ Comprehensive attribute data
- ✅ High data quality
- ✅ Standardized layer naming
- ✅ Well-maintained service

**Cons**:
- ⚠️ Native CRS is EPSG:28992 (requires transformation)

**Integration Strategy**:
```typescript
// Use for primary flood risk assessment
const floodRiskLayers = {
  t100_depth: 'ror3:t100_maximale_waterdiepte',
  t100_areas: 'ror3:t100_overstroomde_gebieden',
  t1000_depth: 'ror3:t1000_maximale_waterdiepte',
  storage_areas: 'ror3:bergingsgebieden'
}
```

---

### 🥈 Secondary Source: **PDOK Overstromingen**
**Recommended for official INSPIRE-compliant data**

**Pros**:
- ✅ Official government API
- ✅ INSPIRE-harmonized
- ✅ Modern OGC API Features standard
- ✅ Multiple CRS support
- ✅ CC0 license
- ✅ HVD compliant

**Cons**:
- ⚠️ Less detailed than Lizard
- ⚠️ Simpler attribute schema

**Use Cases**:
- Official risk zone boundaries
- Historical flood events
- INSPIRE-compliant applications

---

### 🥉 Supplementary Source: **Klimaateffectatlas**
**Use for city-specific details only**

**Pros**:
- ✅ Very detailed local data
- ✅ Includes stormwater scenarios (60mm, 70mm)
- ✅ Road passability data
- ✅ Vulnerable building assessments

**Cons**:
- ❌ Not nationwide
- ❌ Inconsistent naming across cities
- ❌ Requires city-specific queries
- ❌ Complex to integrate

**Use Cases**:
- Detailed urban flood analysis
- City-specific reporting
- Stormwater management
- When Lizard data is insufficient

---

## Sample Data Examination

### PDOK Risk Zone Sample:
```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": {
    "inspireId": "...",
    "risicogebied": "risk zone name",
    "typeNatuurlijkGevaar": "flooding"
  }
}
```

### Lizard T100 Water Depth Sample:
```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": {
    "waterdiepte_m": 1.5,
    "scenario": "T100",
    "duur_uren": 24
  }
}
```

---

## Next Steps

1. ✅ **Implement Lizard GeoServer** as primary flood risk source
2. ✅ **Add PDOK** for official risk zone boundaries
3. ⚠️ **Consider Klimaateffectatlas** only for major cities if needed
4. ✅ Implement CRS transformation (EPSG:28992 ↔ EPSG:4326)
5. ✅ Cache flood risk data for performance
6. ✅ Create multi-scenario risk assessment (T100, T1000)

---

## Error Handling Notes

- PDOK WFS uses different type names than OGC API (use `risk_zone` not `overstromingsgebied`)
- Klimaateffectatlas requires city prefix in layer names
- Always specify CRS in BBOX parameter for cross-service compatibility
- Default count limit varies by service (1000-9999999)

---

## Performance Considerations

- Lizard: CountDefault = 9999999 (very permissive)
- PDOK: CountDefault = 1000 (moderate)
- Klimaateffectatlas: CountDefault = 2000000 (high)

**Recommendation**: Always specify `count` or `limit` parameter explicitly
