# Quick Reference: Dutch Flood Data WMS Endpoints

**Last Updated:** 2025-12-23

---

## Ready-to-Use WMS Endpoints

### 1. LDO GeoServer (PRIMARY - Nelen & Schuurmans)
**Most comprehensive flood scenario data**

```typescript
const ldoFloodService = {
  name: "LDO Flood Scenarios",
  url: "https://ldo-geoserver.lizard.net/geoserver/ows",
  getCapabilities: "https://ldo-geoserver.lizard.net/geoserver/ows?service=WMS&request=GetCapabilities",
  wfsCapabilities: "https://ldo-geoserver.lizard.net/geoserver/ows?service=WFS&acceptversions=2.0.0&request=GetCapabilities",
  type: "wms",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  attribution: "Rijkswaterstaat / Nelen & Schuurmans / LIWO"
};
```

**Usage:**
```typescript
const wmsUrl = `${ldoFloodService.url}?` +
  `service=WMS&` +
  `version=1.3.0&` +
  `request=GetMap&` +
  `layers={LAYER_NAME}&` +
  `bbox={BBOX}&` +
  `width=256&` +
  `height=256&` +
  `srs=EPSG:28992&` +
  `format=image/png&` +
  `transparent=true`;
```

---

### 2. NGR Flood Risk Directive (INSPIRE-compliant)
**EU-standardized flood risk data**

```typescript
const ngrFloodRisk = {
  name: "EU Flood Risk Directive Netherlands",
  url: "https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0",
  getCapabilities: "https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?request=GetCapabilities&service=WMS",
  type: "wms",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  attribution: "Rijkswaterstaat",

  // Known layer names (verify with GetCapabilities)
  layers: {
    hazardAreas: "NZ.HazardArea.nlnz-ork",
    exposedElements: "NZ.ExposedElement.nlnz-ork",
    riskZones: "NZ.RiskZone.nlnz-ork",
    observedEvents: "NZ.ObservedEvent.nlnz-ork"
  }
};
```

**Usage (with specific layer):**
```typescript
const wmsUrl = `${ngrFloodRisk.url}?` +
  `service=WMS&` +
  `version=1.3.0&` +
  `request=GetMap&` +
  `layers=${ngrFloodRisk.layers.hazardAreas}&` +
  `bbox={BBOX}&` +
  `width=256&` +
  `height=256&` +
  `srs=EPSG:28992&` +
  `format=image/png&` +
  `transparent=true`;
```

---

### 3. Klimaatatlas (Climate Impact Analysis)
**Detailed infrastructure vulnerability data**

```typescript
const klimaatatlas = {
  name: "Climate Atlas Flood Impact",
  url: "https://maps1.klimaatatlas.net/geoserver/ows",
  getCapabilities: "https://maps1.klimaatatlas.net/geoserver/ows?service=WMS&version=1.1.0&request=GetCapabilities",
  wfsCapabilities: "https://maps1.klimaatatlas.net/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities",
  type: "wms",
  version: "1.1.0",
  format: "image/png",
  transparent: true,
  attribution: "Nelen & Schuurmans",

  // Example layers (from WFS GetCapabilities)
  layers: {
    pumpingStationsPrimary: "1809_Rijnland_afvoergemaal_overstroming_primair",
    pumpingStationsRegional: "1809_Rijnland_afvoergemaal_overstroming_regionaal",
    flushingStationsPrimary: "1809_Rijnland_doorspoelgemaal_overstroming_primair",
    flushingStationsRegional: "1809_Rijnland_doorspoelgemaal_overstroming_regionaal",
    effluentStationsPrimary: "1809_Rijnland_effluentgemalen_overstromingen_primair"
  }
};
```

---

### 4. Rijkswaterstaat GeoServer
**Official government flood risk service**

```typescript
const rwsFloodRisk = {
  name: "Rijkswaterstaat Flood Risk",
  url: "https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows",
  getCapabilities: "https://geoservices.rijkswaterstaat.nl/apps/geoserver/ror_overstromingsrisico/ows?service=WMS&request=getcapabilities&version=1.3.0",
  type: "wms",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  attribution: "Rijkswaterstaat"
};
```

---

### 5. LIWO Basis GeoServer
**Core LIWO platform data**

```typescript
const liwoBasic = {
  name: "LIWO Basic Flood Data",
  url: "https://basisinformatie-overstromingen.nl/geoserver/LIWO_Basis/wms",
  getCapabilities: "https://basisinformatie-overstromingen.nl/geoserver/LIWO_Basis/wms?service=WMS&request=GetCapabilities",
  type: "wms",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  attribution: "LIWO / Rijkswaterstaat"
};
```

---

### 6. Provincial Services (Example: Zuid-Holland)
**Province-specific flood data**

```typescript
const provincialFlood = {
  name: "Provincial Flood Data (NZ)",
  url: "https://geodata.nationaalgeoregister.nl/provincies/nz/wms/v1",
  getCapabilities: "https://geodata.nationaalgeoregister.nl/provincies/nz/wms/v1?service=WMS&request=GetCapabilities",
  type: "wms",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  attribution: "Province / NGR"
};
```

---

## PDOK OGC API (Modern Alternative)

### Observed Flood Events API
**GeoJSON-based API for historical flood events**

```typescript
const pdokFloodEvents = {
  name: "PDOK Flood Events OGC API",
  baseUrl: "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1",
  landingPage: "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1?f=html&lang=en",
  collections: "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1/collections",
  type: "ogc-api-features",
  format: "geojson"
};

// Example: Fetch all flood events
const fetchFloodEvents = async () => {
  const response = await fetch(
    `${pdokFloodEvents.baseUrl}/collections/{collection_id}/items?f=json`
  );
  return response.json();
};
```

---

## Integration Code Examples

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import { Map } from 'react-map-gl';

const FloodOverlay = () => {
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    // Add WMS layer to map
    const floodLayer = {
      id: 'flood-risk',
      type: 'raster',
      source: {
        type: 'raster',
        tiles: [
          `https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?` +
          `service=WMS&version=1.3.0&request=GetMap&` +
          `layers=NZ.HazardArea.nlnz-ork&` +
          `bbox={bbox-epsg-3857}&` +
          `width=256&height=256&` +
          `srs=EPSG:3857&format=image/png&transparent=true`
        ],
        tileSize: 256,
        attribution: 'Rijkswaterstaat'
      },
      paint: {
        'raster-opacity': 0.7
      }
    };

    setLayers([floodLayer]);
  }, []);

  return <Map initialViewState={{...}} layers={layers} />;
};
```

### Next.js API Route Example

```typescript
// app/api/flood-risk/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  // Convert to RD coordinates (EPSG:28992)
  const [x, y] = convertWGS84ToRD(parseFloat(lat), parseFloat(lon));

  // Query WMS GetFeatureInfo
  const wmsUrl =
    `https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?` +
    `service=WMS&version=1.3.0&request=GetFeatureInfo&` +
    `layers=NZ.HazardArea.nlnz-ork&` +
    `query_layers=NZ.HazardArea.nlnz-ork&` +
    `info_format=application/json&` +
    `i=128&j=128&` +
    `width=256&height=256&` +
    `srs=EPSG:28992&` +
    `bbox=${x-100},${y-100},${x+100},${y+100}`;

  const response = await fetch(wmsUrl);
  const data = await response.json();

  return NextResponse.json({
    coordinates: { lat, lon, x, y },
    floodRisk: data,
    source: 'NGR Flood Risk Directive'
  });
}
```

### TypeScript Interface

```typescript
interface FloodRiskData {
  coordinates: {
    lat: number;
    lon: number;
    x: number; // RD X
    y: number; // RD Y
  };
  floodDepth?: {
    max: number; // meters
    probability: string; // e.g., "1/100 jaar"
  };
  riskZone?: 'high' | 'medium' | 'low' | 'negligible';
  evacuationRequired?: boolean;
  vulnerableObjects?: {
    type: string;
    name: string;
    distance: number; // meters
  }[];
  breachScenarios?: {
    location: string;
    maxDepth: number;
    arrivalTime: number; // hours
    probability: string;
  }[];
}
```

---

## Testing Checklist

### 1. GetCapabilities Request
```bash
# Test if service is accessible
curl "https://ldo-geoserver.lizard.net/geoserver/ows?service=WMS&request=GetCapabilities"
```

### 2. Sample GetMap Request
```bash
# Get a sample tile (adjust bbox for your area of interest)
curl "https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?\
service=WMS&version=1.3.0&request=GetMap&\
layers=NZ.HazardArea.nlnz-ork&\
bbox=100000,400000,150000,450000&\
width=512&height=512&\
srs=EPSG:28992&format=image/png&transparent=true" \
-o flood_test.png
```

### 3. GetFeatureInfo Request
```bash
# Query specific point for data
curl "https://geodata.nationaalgeoregister.nl/rws/richtlijnoverstromingsrisico2018/wms/v1_0?\
service=WMS&version=1.3.0&request=GetFeatureInfo&\
layers=NZ.HazardArea.nlnz-ork&\
query_layers=NZ.HazardArea.nlnz-ork&\
info_format=application/json&\
i=128&j=128&width=256&height=256&\
srs=EPSG:28992&\
bbox=120000,480000,121000,481000"
```

---

## Coordinate System Notes

**Dutch Rijksdriehoek (RD) System:**
- EPSG Code: **28992**
- Used by all Dutch government services
- Origin: Amersfoort

**Conversion Required:**
- Frontend typically uses WGS84 (EPSG:4326)
- WMS services use RD (EPSG:28992)
- Use proj4js or similar for conversion

```typescript
import proj4 from 'proj4';

// Define RD projection
proj4.defs('EPSG:28992',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 ' +
  '+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel ' +
  '+towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 ' +
  '+units=m +no_defs'
);

// Convert WGS84 to RD
const [x, y] = proj4('EPSG:4326', 'EPSG:28992', [lon, lat]);
```

---

## Performance Optimization

### 1. Tile Caching
```typescript
const tileCache = new Map();

const getTile = async (x: number, y: number, z: number) => {
  const key = `${x}-${y}-${z}`;

  if (tileCache.has(key)) {
    return tileCache.get(key);
  }

  const tile = await fetchTile(x, y, z);
  tileCache.set(key, tile);

  return tile;
};
```

### 2. Request Throttling
```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

const fetchMultipleTiles = async (tiles: Tile[]) => {
  return Promise.all(
    tiles.map(tile => limit(() => fetchTile(tile)))
  );
};
```

### 3. Bbox Optimization
```typescript
// Only request visible area + small buffer
const getBboxForViewport = (viewport: Viewport) => {
  const buffer = 0.1; // 10% buffer
  return {
    minX: viewport.bounds.west - buffer,
    minY: viewport.bounds.south - buffer,
    maxX: viewport.bounds.east + buffer,
    maxY: viewport.bounds.north + buffer
  };
};
```

---

## Error Handling

```typescript
const fetchWMSData = async (url: string) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'image/png,application/json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('WMS layer not found');
      }
      if (response.status === 500) {
        throw new Error('WMS service error');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      // Service returned error as JSON
      const error = await response.json();
      throw new Error(error.message || 'WMS error');
    }

    return response;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('WMS request timeout');
    }
    throw error;
  }
};
```

---

## Rate Limiting

**PDOK/NGR Services:**
- Max 1,000 objects per WFS request
- No explicit rate limit on WMS GetMap
- Recommended: Max 10 concurrent requests

**Best Practices:**
```typescript
const WMS_CONFIG = {
  maxConcurrentRequests: 5,
  requestTimeout: 10000, // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  cacheExpiry: 30 * 24 * 60 * 60 * 1000 // 30 days
};
```

---

## Next Steps

1. ✅ Test GetCapabilities for each endpoint
2. ⬜ Parse XML to extract available layer names
3. ⬜ Create layer selection UI component
4. ⬜ Implement coordinate conversion
5. ⬜ Add WMS overlay to Map component
6. ⬜ Create flood risk query API endpoint
7. ⬜ Add flood data to location detail page
8. ⬜ Include in PDF export

---

## Support & Documentation

**Questions about data:**
- **Lizard/LDO:** servicedesk@nelen-schuurmans.nl
- **PDOK/NGR:** https://www.pdok.nl/contact
- **LIWO Platform:** Via IPLO (https://iplo.nl/)

**Technical Documentation:**
- **Lizard API:** https://docs.lizard.net/
- **PDOK Services:** https://pdok-ngr.readthedocs.io/
- **OGC WMS Standard:** https://www.ogc.org/standards/wms

---

**Last Updated:** 2025-12-23
**Status:** Ready for implementation
**Next Review:** After GetCapabilities testing
