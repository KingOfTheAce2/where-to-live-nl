# Klimaateffectatlas - Quick Reference Guide

## TL;DR

- **What:** Building-level flood risk data for Dutch municipalities
- **Coverage:** 35+ municipalities (NOT nationwide) - includes Den Haag, Rotterdam, but NOT Amsterdam/Utrecht
- **Access:** Free WFS/WMS service, no authentication
- **Quality:** Professional data from Nelen & Schuurmans
- **Best Use:** Building-level "red flags" for supported cities

---

## Quick Start

### 1. Check if Municipality is Covered

```bash
# Search for municipality layers
curl -s "https://maps1.klimaatatlas.net/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities" | grep -i "rotterdam"
```

**Confirmed Coverage:**
- ✅ Den Haag (101,853 vulnerable buildings)
- ✅ Rotterdam
- ✅ Almere, Schiedam, Haarlemmermeer
- ❌ Amsterdam (not found)
- ❌ Utrecht (not found)

### 2. Get Vulnerable Buildings in Area

```bash
# Example: Den Haag city center
curl "https://maps1.klimaatatlas.net/geoserver/wfs?\
service=WFS&\
version=2.0.0&\
request=GetFeature&\
typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&\
outputFormat=application/json&\
bbox=4.31,52.07,4.32,52.08,EPSG:4326&\
count=100"
```

### 3. Parse Response

```javascript
const response = await fetch(wfsUrl);
const data = await response.json();

data.features.forEach(building => {
  const waterHeight = building.properties.waterhoogt; // meters
  const geometry = building.geometry; // building polygon

  // Calculate risk
  const risk = waterHeight > 0.5 ? 'HIGH' :
               waterHeight > 0.2 ? 'MEDIUM' :
               waterHeight > 0 ? 'LOW' : 'MINIMAL';
});
```

---

## Key Layer Types

| Layer Type | Description | Example |
|------------|-------------|---------|
| `kwetsbare_panden` | Vulnerable buildings with water height | Building polygons with flood depth |
| `begaanbaarheid_wegen` | Road passability for vehicles/emergency | Road segments (passable/impassable) |
| `kwetsbare_objecten` | Critical infrastructure (hospitals, schools) | Point locations |
| `waterdiepte` | Water depth rasters | Raster layers (WMS only) |

---

## Layer Naming Patterns

```
{municipality}_klimaatatlas:{id}_{municipality}_{type}_{scenario}

Examples:
- den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022
- rotterdam_klimaatatlas:1842_rotterdam_kwetsbare_panden_buurt
- lv_klimaatatlas:1803_lv_kwetsbare_panden_t100
```

**Municipalities:**
- `den_haag` = The Hague
- `rotterdam` = Rotterdam
- `lv` = Leidschendam-Voorburg
- `almere` = Almere
- `schiedam` = Schiedam
- `haarlemmermeer` = Haarlemmermeer

**Scenarios:**
- `t10` = 1 in 10 year flood
- `t100` = 1 in 100 year flood
- `t1000` = 1 in 1000 year flood
- `60mm`/`70mm` = Specific rainfall amounts

---

## Common Queries

### Count Total Buildings

```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?\
service=WFS&version=2.0.0&\
request=GetFeature&\
typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&\
resultType=hits"
```

### Get Buildings in Bbox

```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?\
service=WFS&version=2.0.0&\
request=GetFeature&\
typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&\
outputFormat=application/json&\
bbox=${minLon},${minLat},${maxLon},${maxLat},EPSG:4326&\
count=1000"
```

### Get Schema/Attributes

```bash
curl "https://maps1.klimaatatlas.net/geoserver/wfs?\
service=WFS&version=2.0.0&\
request=DescribeFeatureType&\
typeName=den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022&\
outputFormat=application/json"
```

---

## Response Structure

```json
{
  "type": "FeatureCollection",
  "totalFeatures": 101853,
  "numberReturned": 100,
  "features": [
    {
      "type": "Feature",
      "id": "...",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[...]]
      },
      "properties": {
        "waterhoogt": 0.35,  // Water height in meters
        "identifica": "...",  // Building ID
        "wp_vloerpe": -0.452  // Floor level
      }
    }
  ],
  "crs": {
    "properties": {
      "name": "urn:ogc:def:crs:EPSG::3857"  // Web Mercator
    }
  }
}
```

**Key Properties:**
- `waterhoogt` - Water height at building (meters)
- `wp_vloerpe` - Floor level (meters)
- `identifica` - Unique building identifier
- `geom` - Building polygon geometry

---

## Integration Code

### Backend API (TypeScript)

```typescript
// /api/flood-risk/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox'); // "minLon,minLat,maxLon,maxLat"
  const municipality = searchParams.get('municipality') || 'den_haag';

  // Map municipality to layer name
  const layerMap = {
    'den_haag': 'den_haag_klimaatatlas:1827_den_haag_kwetsbare_panden_70mm_2022',
    'rotterdam': 'rotterdam_klimaatatlas:1842_rotterdam_kwetsbare_panden_buurt',
    'almere': 'almere_klimaatatlas:1802_almere_klimaatatlas_kwetsbare_objecten',
    // ... more municipalities
  };

  const layer = layerMap[municipality];
  if (!layer) {
    return Response.json({ error: 'Municipality not supported' }, { status: 404 });
  }

  const wfsUrl = `https://maps1.klimaatatlas.net/geoserver/wfs?` +
    `service=WFS&version=2.0.0&request=GetFeature&` +
    `typeName=${layer}&outputFormat=application/json&` +
    `bbox=${bbox},EPSG:4326&count=1000`;

  const response = await fetch(wfsUrl);
  const data = await response.json();

  // Calculate summary statistics
  const summary = {
    totalBuildings: data.totalFeatures,
    vulnerableBuildings: data.numberReturned,
    maxWaterHeight: Math.max(...data.features.map(f => f.properties.waterhoogt || 0)),
    avgWaterHeight: data.features.reduce((sum, f) => sum + (f.properties.waterhoogt || 0), 0) / data.numberReturned
  };

  return Response.json({ features: data.features, summary });
}
```

### Frontend Map Layer (React)

```typescript
// FloodRiskLayer.tsx

import { useEffect, useState } from 'react';
import { Layer, Source } from 'react-map-gl';

export function FloodRiskLayer({ bbox, municipality }) {
  const [floodData, setFloodData] = useState(null);

  useEffect(() => {
    const fetchFloodRisk = async () => {
      const response = await fetch(
        `/api/flood-risk?bbox=${bbox.join(',')}&municipality=${municipality}`
      );
      const data = await response.json();
      setFloodData(data);
    };

    fetchFloodRisk();
  }, [bbox, municipality]);

  if (!floodData) return null;

  return (
    <Source id="flood-risk" type="geojson" data={floodData.features}>
      <Layer
        id="flood-buildings"
        type="fill"
        paint={{
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'waterhoogt'],
            0, '#FFFF00',     // 0m = yellow
            0.2, '#FF9900',   // 0.2m = orange
            0.5, '#FF0000'    // 0.5m+ = red
          ],
          'fill-opacity': 0.6
        }}
      />
    </Source>
  );
}
```

---

## Coverage by City

| Municipality | Layer Available | Buildings | Scenario |
|--------------|----------------|-----------|----------|
| Den Haag | ✅ Yes | 101,853 | 70mm/2022 |
| Rotterdam | ✅ Yes | Unknown | Neighborhood-level |
| Amsterdam | ❌ No | - | - |
| Utrecht | ❌ No | - | - |
| Almere | ✅ Yes | Unknown | Various |
| Schiedam | ✅ Yes | Unknown | 60mm |
| Haarlemmermeer | ✅ Yes | Unknown | T10/T100 |
| Leidschendam-Voorburg | ✅ Yes | 1,215 | T100 |

**Total Municipalities:** 35+ with flood data

---

## Important Notes

### Data Limitations

1. **Not nationwide** - Only specific municipalities covered
2. **Model disclaimer** - Surface flow only, sewers often not included
3. **Legal disclaimer** - "No legal rights can be derived from absolute values"
4. **No real-time** - Static flood risk scenarios
5. **Web Mercator CRS** - May need reprojection for analysis

### Best Practices

1. **Cache results** - Large datasets, avoid repeated queries
2. **Paginate** - Use `count` parameter, default is 2M features
3. **Spatial indexing** - Store in PostGIS for fast bbox queries
4. **Fallback data** - Have alternative for unsupported cities
5. **Attribution** - Credit Nelen & Schuurmans

### Performance Tips

```javascript
// Don't query all buildings, use bbox
❌ Bad:  typeName=layer&count=999999
✅ Good: typeName=layer&bbox=...&count=1000

// Cache responses in database
✅ Good: Store in PostGIS with spatial index

// Simplify geometries for display
✅ Good: Use ST_Simplify() for map rendering
```

---

## Next Steps

1. **Contact Nelen & Schuurmans** for licensing: servicedesk@nelen-schuurmans.nl
2. **Build municipality mapping** table for supported cities
3. **Create fallback** for Amsterdam/Utrecht (use CBS or elevation data)
4. **Implement caching** to reduce API calls
5. **Add WMS preview** for visual validation

---

## Useful Links

- **Platform:** https://www.klimaateffectatlas.nl/en/
- **GeoServer:** https://maps1.klimaatatlas.net/geoserver/ows
- **Contact:** servicedesk@nelen-schuurmans.nl
- **Full Report:** `./klimaateffectatlas_investigation.md`

---

**Last Updated:** 2025-12-23
**Investigator:** Research Agent
