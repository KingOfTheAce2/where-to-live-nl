# Flood Risk Data Schema - PDOK WFS Response

**Source:** PDOK RWS Overstromingen Risicogebied WFS Service
**Date Analyzed:** 2025-12-23

---

## GeoJSON Response Structure

### Feature Collection
```json
{
  "type": "FeatureCollection",
  "name": "risk_zone",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:EPSG::4258"
    }
  },
  "features": [...]
}
```

**Note:** CRS is EPSG:4258 (ETRS89) which is very similar to WGS84 (EPSG:4326). Coordinates are in lat/lng format.

---

## Feature Properties

### Key Properties for Integration

| Property | Type | Example | Usage |
|----------|------|---------|-------|
| **description** | string | "Maas type D - onbeschermd langs regionaal water" | Human-readable flood zone description |
| **qualitativeValue** | string | "Area of Potential Significant Flood Risk" | Risk categorization |
| **xlinkHref** | URL | "https://inspire.ec.europa.eu/codelist/NaturalHazardCategoryValue/flood" | INSPIRE hazard type reference |
| **beginLifeSpanVersion** | ISO datetime | "2018-12-12T00:00:00Z" | Data validity start date |
| **localId** | string | "NLMS_D.d183334adcece14b3e2704cc28ac2dfa565c40e892415cb1869247b6d9da37d6" | Unique identifier |
| **namespace** | string | "nl.nz-apsfr" | Data namespace (province/region) |

### Sample Feature
```json
{
  "type": "Feature",
  "id": "risk_zone.463885cf-a2cd-40b7-8b3a-a04dd8a3c0f1",
  "properties": {
    "description": "Maas type D - onbeschermd langs regionaal water",
    "qualitativeValue": "Area of Potential Significant Flood Risk",
    "xlinkHref": "https://inspire.ec.europa.eu/codelist/NaturalHazardCategoryValue/flood",
    "beginLifeSpanVersion": "2018-12-12T00:00:00Z",
    "localId": "NLMS_D.d183334adcece14b3e2704cc28ac2dfa565c40e892415cb1869247b6d9da37d6",
    "namespace": "nl.nz-apsfr"
  },
  "bbox": [5.697320, 50.762028, 5.741525, 50.773583],
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[5.741376, 50.762256], ...]]
  }
}
```

---

## Understanding the Description Field

### Flood Type Classification

The `description` field follows this pattern:
```
[River/Area] type [A-D] - [protection status]
```

**Examples:**
- "Maas type D - onbeschermd langs regionaal water"
  - River: Maas (Meuse)
  - Type: D (regional water, unprotected)
  - Status: Unprotected along regional water

### Type Classifications

Based on EU Floods Directive, typical types include:

| Type | Description | Risk Level |
|------|-------------|------------|
| **Type A** | Primary flood defenses (coastal, major rivers) | High consequence if breached |
| **Type B** | Secondary flood defenses | Medium consequence |
| **Type C** | Regional water systems | Lower consequence |
| **Type D** | Unprotected areas along regional water | Variable risk |

### Protection Status
- **"beschermd"** = Protected (has flood defenses)
- **"onbeschermd"** = Unprotected (no formal defenses)
- **"langs regionaal water"** = Along regional water

---

## Risk Level Mapping

### Proposed Risk Categorization

Based on the `description` and `qualitativeValue` fields:

```typescript
function categorizeFloodRisk(feature: Feature): RiskLevel {
  const desc = feature.properties.description?.toLowerCase() || '';
  const qualValue = feature.properties.qualitativeValue?.toLowerCase() || '';

  // High risk indicators
  if (desc.includes('type a') || desc.includes('type b')) {
    return 'high';
  }

  // Medium risk indicators
  if (desc.includes('onbeschermd') || desc.includes('unprotected')) {
    return 'medium';
  }

  // Type C and D are generally lower risk
  if (desc.includes('type c') || desc.includes('type d')) {
    return 'low';
  }

  // Default based on qualitative value
  if (qualValue.includes('significant')) {
    return 'medium';
  }

  return 'low';
}
```

---

## Integration Recommendations

### 1. Display to Users

**Simple Approach:**
```typescript
interface FloodRiskDisplay {
  hasRisk: boolean;
  level: 'none' | 'low' | 'medium' | 'high';
  description: string;
  waterBody?: string; // Extract from description (e.g., "Maas", "Rijn")
  protectionStatus: 'protected' | 'unprotected' | 'unknown';
}

// Example display
{
  hasRisk: true,
  level: 'medium',
  description: "Area of potential significant flood risk along the Maas river",
  waterBody: "Maas",
  protectionStatus: 'unprotected'
}
```

### 2. Parse Description Field

```typescript
function parseFloodDescription(description: string) {
  const parts = {
    waterBody: '',
    type: '',
    protection: ''
  };

  // Extract water body (before "type")
  const waterBodyMatch = description.match(/^([^-]+?)\s+type/i);
  if (waterBodyMatch) {
    parts.waterBody = waterBodyMatch[1].trim();
  }

  // Extract type (A, B, C, D)
  const typeMatch = description.match(/type\s+([A-D])/i);
  if (typeMatch) {
    parts.type = typeMatch[1];
  }

  // Check protection status
  if (description.toLowerCase().includes('onbeschermd')) {
    parts.protection = 'unprotected';
  } else if (description.toLowerCase().includes('beschermd')) {
    parts.protection = 'protected';
  }

  return parts;
}

// Example usage
const parsed = parseFloodDescription("Maas type D - onbeschermd langs regionaal water");
// Result: { waterBody: 'Maas', type: 'D', protection: 'unprotected' }
```

### 3. User-Friendly Messages

```typescript
const FLOOD_RISK_MESSAGES = {
  high: {
    nl: "Hoog overstromingsrisico - Deze locatie ligt in een gebied met significant overstromingsgevaar.",
    en: "High flood risk - This location is in an area with significant flood hazard."
  },
  medium: {
    nl: "Matig overstromingsrisico - Deze locatie kan in extreme situaties overstromen.",
    en: "Medium flood risk - This location may flood in extreme situations."
  },
  low: {
    nl: "Laag overstromingsrisico - Kleine kans op overstroming bij extreme omstandigheden.",
    en: "Low flood risk - Small chance of flooding under extreme conditions."
  }
};
```

---

## Additional Metadata

### INSPIRE Compliance
- **Theme:** Natural Hazards (Natuurrisico's)
- **Directive:** EU Floods Directive (Richtlijn Overstromingsrisico's)
- **Cycle:** 2016-2021 (2nd cycle)
- **Standard:** INSPIRE geharmoniseerd (INSPIRE harmonized)

### Data Quality
- **Temporal Extent:** Based on 2018 risk assessments
- **Spatial Accuracy:** High-resolution polygon boundaries
- **Completeness:** All officially designated flood risk areas in NL
- **Update Frequency:** Updated per EU directive cycle (6 years)

---

## Query Examples

### 1. Get All Features in Bounding Box (Amsterdam Area)
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?\
service=WFS&\
request=GetFeature&\
version=2.0.0&\
typeNames=overstromingen-risicogebied:risk_zone&\
bbox=4.7,52.3,5.0,52.4&\
srsName=EPSG:4326&\
outputFormat=application/json"
```

### 2. Get Feature Count Only
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?\
service=WFS&\
request=GetFeature&\
version=2.0.0&\
typeNames=overstromingen-risicogebied:risk_zone&\
bbox=4.7,52.3,5.0,52.4&\
resultType=hits"
```

### 3. Get Limited Results
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?\
service=WFS&\
request=GetFeature&\
version=2.0.0&\
typeNames=overstromingen-risicogebied:risk_zone&\
count=10&\
outputFormat=application/json"
```

---

## Implementation Notes

### Performance Optimization

1. **Bounding Box Queries**
   - Use small bounding boxes (e.g., 0.01° × 0.01° around point)
   - Reduces data transfer and processing time
   - Example: For point (52.3702, 4.8952), use bbox=4.885,52.36,4.905,52.38

2. **Caching Strategy**
   ```typescript
   // Cache key format
   const cacheKey = `flood-risk:${lat.toFixed(4)}:${lng.toFixed(4)}`;

   // TTL: 30 days (data updated infrequently)
   const CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
   ```

3. **Spatial Intersection**
   ```typescript
   import * as turf from '@turf/turf';

   function pointInFloodZone(point: [number, number], feature: Feature): boolean {
     return turf.booleanPointInPolygon(
       turf.point(point),
       feature.geometry
     );
   }
   ```

### Error Handling

```typescript
interface FloodRiskError {
  code: 'SERVICE_UNAVAILABLE' | 'NO_DATA' | 'INVALID_COORDINATES' | 'PARSE_ERROR';
  message: string;
  fallback?: FloodRiskResponse;
}

async function getFloodRiskWithFallback(lat: number, lng: number) {
  try {
    return await queryPDOKFloodRisk(lat, lng);
  } catch (error) {
    console.error('Flood risk query failed:', error);

    // Return safe default
    return {
      hasRisk: null, // Unknown
      level: 'unknown',
      description: 'Flood risk data temporarily unavailable',
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: error.message
      }
    };
  }
}
```

---

## Testing Locations

### Known Flood Risk Areas
Test the API with these coordinates:

| Location | Lat | Lng | Expected Risk | Notes |
|----------|-----|-----|---------------|-------|
| **Limburg (Maas)** | 50.851944 | 5.691111 | High | 2021 floods affected this area |
| **Rotterdam** | 51.922534 | 4.479477 | Medium | Below sea level |
| **Dordrecht** | 51.813333 | 4.667222 | Medium | Historical flood risk |
| **Amsterdam** | 52.370216 | 4.895168 | Low | Protected by modern defenses |
| **Arnhem** | 51.985104 | 5.898730 | Low-Medium | Near Rhine river |

### No Risk Areas
| Location | Lat | Lng | Expected Risk | Notes |
|----------|-----|-----|---------------|-------|
| **Eindhoven** | 51.441642 | 5.469722 | None | Elevated, inland |
| **Utrecht Center** | 52.090736 | 5.121420 | Low/None | Protected area |

---

## Complete TypeScript Integration Example

```typescript
// /frontend/src/lib/flood-risk.ts
import * as turf from '@turf/turf';

interface FloodRiskFeature {
  type: 'Feature';
  id: string;
  properties: {
    description: string;
    qualitativeValue: string;
    xlinkHref: string;
    beginLifeSpanVersion: string;
    localId: string;
    namespace: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  bbox: [number, number, number, number];
}

interface FloodRiskResponse {
  type: 'FeatureCollection';
  name: string;
  features: FloodRiskFeature[];
}

export interface FloodRiskResult {
  hasRisk: boolean;
  level: 'none' | 'low' | 'medium' | 'high';
  description: string;
  waterBody?: string;
  protectionStatus: 'protected' | 'unprotected' | 'unknown';
  details?: {
    type: string;
    validFrom: string;
    source: string;
  };
}

const WFS_ENDPOINT = 'https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0';

export async function queryFloodRisk(
  lat: number,
  lng: number
): Promise<FloodRiskResult> {
  // Create small bounding box around point (±0.01 degrees ≈ 1km)
  const buffer = 0.01;
  const bbox = [
    lng - buffer,
    lat - buffer,
    lng + buffer,
    lat + buffer
  ].join(',');

  const params = new URLSearchParams({
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typeNames: 'overstromingen-risicogebied:risk_zone',
    bbox: bbox,
    srsName: 'EPSG:4326',
    outputFormat: 'application/json',
  });

  const response = await fetch(`${WFS_ENDPOINT}?${params}`);
  if (!response.ok) {
    throw new Error(`WFS request failed: ${response.statusText}`);
  }

  const data: FloodRiskResponse = await response.json();

  // Check if point is within any flood risk zone
  const point = turf.point([lng, lat]);

  for (const feature of data.features) {
    const polygon = turf.polygon(feature.geometry.coordinates);

    if (turf.booleanPointInPolygon(point, polygon)) {
      return parseFloodRiskFeature(feature);
    }
  }

  // No flood risk found
  return {
    hasRisk: false,
    level: 'none',
    description: 'This location is not in a designated flood risk area',
    protectionStatus: 'unknown',
  };
}

function parseFloodRiskFeature(feature: FloodRiskFeature): FloodRiskResult {
  const { description, qualitativeValue, beginLifeSpanVersion } = feature.properties;

  // Parse description
  const waterBodyMatch = description.match(/^([^-]+?)\s+type/i);
  const typeMatch = description.match(/type\s+([A-D])/i);
  const waterBody = waterBodyMatch?.[1]?.trim();
  const type = typeMatch?.[1];

  // Determine protection status
  const isUnprotected = description.toLowerCase().includes('onbeschermd');
  const protectionStatus = isUnprotected ? 'unprotected' :
                          description.toLowerCase().includes('beschermd') ? 'protected' : 'unknown';

  // Determine risk level
  let level: 'low' | 'medium' | 'high' = 'low';
  if (type === 'A' || type === 'B') {
    level = 'high';
  } else if (isUnprotected || qualitativeValue.toLowerCase().includes('significant')) {
    level = 'medium';
  }

  return {
    hasRisk: true,
    level,
    description: qualitativeValue,
    waterBody,
    protectionStatus,
    details: {
      type: type || 'unknown',
      validFrom: beginLifeSpanVersion,
      source: 'PDOK-RWS',
    },
  };
}
```

---

**Document Status:** ✅ COMPLETE - Ready for Implementation
**Last Updated:** 2025-12-23
