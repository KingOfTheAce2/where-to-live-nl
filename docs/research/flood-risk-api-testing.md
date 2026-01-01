# Flood Risk API Testing Notes

**Date:** 2025-12-23
**Status:** Technical Validation

---

## WFS Endpoint Testing

### Test 1: PDOK RWS Overstromingen Risicogebied WFS

**Endpoint:**
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0
```

**Test Query: GetCapabilities**
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?request=GetCapabilities&service=WFS&version=2.0.0"
```

**Status:** Testing...

---

## Next Tests Required

1. **GetCapabilities Response Analysis**
   - Identify available feature types
   - Check supported operations
   - Verify coordinate reference systems

2. **GetFeature Test**
   - Query flood risk areas by bounding box
   - Test point intersection queries
   - Verify attribute data structure

3. **Performance Testing**
   - Measure response times
   - Test with various query parameters
   - Evaluate caching needs

4. **Data Structure Analysis**
   - Document attribute schema
   - Identify flood depth/risk fields
   - Map to our data model

---

## Integration Checklist

- [ ] Verify WFS endpoint accessibility
- [ ] Document available layers/feature types
- [ ] Test coordinate transformation (WGS84 → EPSG:28992)
- [ ] Query flood risk by coordinates
- [ ] Parse and validate response data
- [ ] Define risk level mapping
- [ ] Implement caching strategy
- [ ] Add error handling
- [ ] Create API route prototype
- [ ] Add unit tests
- [ ] Update documentation

---

## Technical Considerations

### Coordinate Systems
- **Input:** WGS84 (EPSG:4326) - lat/lng from frontend
- **PDOK Native:** RD New (EPSG:28992) - Dutch coordinate system
- **Need:** Coordinate transformation library

### Query Methods
1. **Bounding Box Query** - Get all features in area
2. **Point Intersection** - Get features at specific coordinates
3. **Distance Query** - Get features within radius

### Response Format
- **Default:** GML (Geography Markup Language)
- **Alternative:** GeoJSON (if supported)
- **Parsing:** XML/JSON parser required

---

## Sample WFS Queries

### GetCapabilities (Discover available data)
```
GET https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?
  service=WFS&
  request=GetCapabilities&
  version=2.0.0
```

### GetFeature by Bounding Box
```
GET https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?
  service=WFS&
  request=GetFeature&
  version=2.0.0&
  typeNames=[FEATURE_TYPE]&
  bbox=[minx,miny,maxx,maxy]&
  srsName=EPSG:28992
```

### GetFeature by Point (DWithin filter)
```xml
POST https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0
Content-Type: application/xml

<wfs:GetFeature service="WFS" version="2.0.0">
  <wfs:Query typeNames="[FEATURE_TYPE]">
    <fes:Filter>
      <fes:DWithin>
        <fes:ValueReference>geometry</fes:ValueReference>
        <gml:Point srsName="EPSG:28992">
          <gml:pos>[x] [y]</gml:pos>
        </gml:Point>
        <fes:Distance units="m">10</fes:Distance>
      </fes:DWithin>
    </fes:Filter>
  </wfs:Query>
</wfs:GetFeature>
```

---

## Libraries for Integration

### TypeScript/Node.js
```bash
npm install proj4      # Coordinate transformation
npm install xml2js     # XML parsing
npm install axios      # HTTP requests
npm install @turf/turf # Geospatial calculations
```

### Sample Code
```typescript
import proj4 from 'proj4';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

// Define Dutch RD coordinate system
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');

// Convert WGS84 to RD
function wgs84ToRD(lat: number, lng: number): [number, number] {
  return proj4('EPSG:4326', 'EPSG:28992', [lng, lat]);
}

// Query flood risk
async function queryFloodRisk(lat: number, lng: number) {
  const [x, y] = wgs84ToRD(lat, lng);

  const url = 'https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0';
  const params = {
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typeNames: 'FEATURE_TYPE_TBD', // TODO: Get from GetCapabilities
    bbox: `${x-10},${y-10},${x+10},${y+10}`,
    srsName: 'EPSG:28992',
    outputFormat: 'application/gml+xml;version=3.2'
  };

  const response = await axios.get(url, { params });
  const parsed = await parseStringPromise(response.data);

  // TODO: Parse flood risk data
  return parsed;
}
```

---

## Expected Data Fields

Based on INSPIRE Natural Hazards theme, likely fields include:

- **Geometry:** Polygon of flood risk area
- **Hazard Type:** Flood/Overstroming
- **Probability:** Return period (e.g., 1/100 year, 1/1000 year)
- **Water Depth:** Maximum depth in meters
- **Scenario:** Scenario name/ID
- **Valid From/To:** Temporal validity
- **Source:** Data provider

**Note:** Actual fields to be confirmed after GetCapabilities analysis.

---

## Risk Level Categorization

Proposed mapping based on water depth:

| Water Depth | Risk Level | Color Code | UI Display |
|-------------|-----------|------------|------------|
| 0m | None | Green | No flood risk |
| 0-0.5m | Low | Yellow | Minor flooding possible |
| 0.5-1.5m | Medium | Orange | Moderate flood risk |
| 1.5-3m | High | Red | Significant flood risk |
| >3m | Extreme | Dark Red | Severe flood risk |

**Note:** Thresholds should be validated with domain experts.

---

## Next Steps

1. ✅ Complete GetCapabilities test
2. ⏳ Document available feature types
3. ⏳ Test GetFeature query
4. ⏳ Analyze response structure
5. ⏳ Implement coordinate transformation
6. ⏳ Create API route prototype
7. ⏳ Add to existing map overlays
8. ⏳ Integrate with RedFlagsCard

---

**Testing Status:** IN PROGRESS
