# Mapping Strategy: Maximum Freedom, Zero Vendor Lock-in

> **TL;DR**: Use Dutch government PDOK data + MapLibre GL JS for a **100% free, open-source, self-hostable** mapping solution

---

## 🎯 Objective

Build a map of the Netherlands with:
- ✅ **Maximum freedom** - No proprietary licenses
- ✅ **Zero vendor lock-in** - Self-hostable, open source
- ✅ **Commercial-safe** - Use for free, forever
- ✅ **No API keys** - No tracking, rate limits, or surprise bills
- ✅ **Unlimited usage** - No request/view limits

---

## 🗺️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Your Web Application                    │
└────────────────┬────────────────────────────────┘
                 │
                 │ Uses
                 ▼
┌─────────────────────────────────────────────────┐
│         MapLibre GL JS (Open Source)             │
│  • No API key required                          │
│  • Fork of Mapbox GL JS v1                      │
│  • MIT/BSD licensed                             │
└────────────────┬────────────────────────────────┘
                 │
                 │ Fetches tiles from
                 ▼
┌─────────────────────────────────────────────────┐
│    PDOK - Dutch Government Open Geo-Data         │
│  • Free, unlimited tile serving                 │
│  • CC0 / Public Domain license                  │
│  • No attribution required                      │
│  • Hosted by Kadaster (Dutch govt)              │
└─────────────────────────────────────────────────┘
```

---

## 📚 A. Data Sources for the Netherlands

### 1. PDOK - Dutch Government Open Geo-Data

**Website**: https://www.pdok.nl/
**License**: CC0 (Public Domain) - No attribution required
**Cost**: FREE, unlimited usage

#### What is PDOK?

PDOK (Publieke Dienstverlening Op de Kaart) is the Dutch government's open geo-data platform. It provides:
- Base maps (topographic, aerial imagery)
- Administrative boundaries (municipalities, provinces)
- Infrastructure data (roads, waterways, buildings)
- Elevation data
- Address data (BAG)

#### Key PDOK Services

| Service | Description | Use Case | License |
|---------|-------------|----------|---------|
| **BRT Achtergrondkaart** | Topographic base map | Main background map | CC0 |
| **Luchtfoto RGB** | Aerial imagery | Satellite view | CC0 |
| **BAG** | Buildings & Addresses | Property locations | CC0 |
| **Bestuurlijke Grenzen** | Administrative boundaries | Municipality/province overlays | CC0 |
| **AHN** | Elevation model | Terrain, flood risk | CC0 |

#### PDOK Tile URLs

**BRT Achtergrondkaart (Standard Map)**
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png
```

**BRT Achtergrondkaart (Gray)**
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png
```

**BRT Achtergrondkaart (Pastel)**
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png
```

**Luchtfoto (Aerial Imagery)**
```
https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg
```

#### PDOK Vector Tiles (NEW!)

PDOK now also offers **vector tiles** which are:
- Smaller file size (faster loading)
- Styleable with CSS
- Crisper on high-DPI screens
- Work offline (can be cached)

**BRT Vector Tiles**
```
https://api.pdok.nl/brt/achtergrondkaart/ogc/v1_0/tiles/WebMercatorQuad/{z}/{x}/{y}.pbf
```

---

### 2. OpenStreetMap (OSM) Data for Netherlands

**Website**: https://download.geofabrik.de/europe/netherlands.html
**License**: ODbL (Open Database License)
**Cost**: FREE

#### What You Get
- Full OSM dataset for Netherlands (~2 GB)
- Updated daily
- Includes roads, buildings, POIs, natural features

#### Download Options

```bash
# Netherlands extract (OSM XML)
wget https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

# Specific provinces
wget https://download.geofabrik.de/europe/netherlands/noord-holland-latest.osm.pbf
wget https://download.geofabrik.de/europe/netherlands/zuid-holland-latest.osm.pbf
```

#### Use Cases
- Routing calculations (travel time isochrones)
- POI data (parks, schools, shops)
- Road network analysis
- Custom tile generation

---

### 3. Natural Earth Data (For Context)

**Website**: https://www.naturalearthdata.com/
**License**: Public Domain
**Cost**: FREE

Use for:
- European context map (show where Netherlands is)
- Province boundaries (backup to PDOK)
- Low-zoom world map

---

## 🛠️ B. Tooling & Hosting

### 1. MapLibre GL JS (Recommended ⭐)

**Website**: https://maplibre.org/
**License**: BSD 3-Clause
**Why**: Fork of Mapbox GL JS v1, 100% open source, no tracking

#### Installation

```bash
npm install maplibre-gl
```

#### Basic Setup

```typescript
// app/components/Map.tsx
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'pdok-brt': {
            type: 'raster',
            tiles: [
              'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: 'Kaartgegevens &copy; Kadaster'
          }
        },
        layers: [
          {
            id: 'pdok-brt-layer',
            type: 'raster',
            source: 'pdok-brt',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
      center: [5.2913, 52.1326], // Netherlands center
      zoom: 7
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '600px' }}
    />
  );
}
```

#### Advanced: PDOK Vector Tiles

```typescript
map.current = new maplibregl.Map({
  container: mapContainer.current,
  style: {
    version: 8,
    sources: {
      'pdok-vector': {
        type: 'vector',
        tiles: [
          'https://api.pdok.nl/brt/achtergrondkaart/ogc/v1_0/tiles/WebMercatorQuad/{z}/{x}/{y}.pbf'
        ],
        maxzoom: 14
      }
    },
    layers: [
      // Water
      {
        id: 'water',
        type: 'fill',
        source: 'pdok-vector',
        'source-layer': 'water',
        paint: {
          'fill-color': '#a0c8f0',
          'fill-opacity': 0.7
        }
      },
      // Roads
      {
        id: 'roads',
        type: 'line',
        source: 'pdok-vector',
        'source-layer': 'roads',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2
        }
      },
      // Buildings
      {
        id: 'buildings',
        type: 'fill',
        source: 'pdok-vector',
        'source-layer': 'buildings',
        paint: {
          'fill-color': '#e0e0e0',
          'fill-opacity': 0.8
        }
      }
    ]
  },
  center: [4.9041, 52.3676], // Amsterdam
  zoom: 12
});
```

---

### 2. Leaflet (Alternative, Simpler)

**Website**: https://leafletjs.com/
**License**: BSD 2-Clause
**Why**: Lighter weight, easier for simple maps

#### Installation

```bash
npm install leaflet react-leaflet
```

#### Basic Setup

```typescript
// app/components/LeafletMap.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function LeafletMap() {
  return (
    <MapContainer
      center={[52.3676, 4.9041]} // Amsterdam
      zoom={13}
      style={{ height: '600px', width: '100%' }}
    >
      <TileLayer
        url="https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.kadaster.nl">Kadaster</a>'
        maxZoom={19}
      />
      <Marker position={[52.3676, 4.9041]}>
        <Popup>Amsterdam Centraal</Popup>
      </Marker>
    </MapContainer>
  );
}
```

---

### 3. Comparison: MapLibre vs Leaflet vs Mapbox

| Feature | MapLibre GL JS | Leaflet | Mapbox GL JS |
|---------|---------------|---------|--------------|
| **License** | ✅ BSD (Open) | ✅ BSD (Open) | ⚠️ Proprietary |
| **API Key** | ✅ Not required | ✅ Not required | ❌ Required |
| **Cost** | ✅ FREE | ✅ FREE | 💰 $0.50 per 1K views |
| **3D Support** | ✅ Yes | ❌ No | ✅ Yes |
| **Vector Tiles** | ✅ Yes | ⚠️ Plugin | ✅ Yes |
| **Bundle Size** | ~400 KB | ~150 KB | ~500 KB |
| **Performance** | ⚡ Fast | ⚡ Fast | ⚡ Fast |
| **Vendor Lock-in** | ✅ None | ✅ None | ❌ High |

**Recommendation**: Use **MapLibre GL JS** for this project
- Modern (WebGL-based)
- Supports PDOK vector tiles
- Future-proof (active community)
- No vendor lock-in

---

## 🎨 Styling & Customization

### PDOK Style Options

PDOK offers several pre-styled raster tiles:

#### 1. Standaard (Standard)
Default colorful topographic map
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png
```

#### 2. Grijs (Gray)
Neutral gray background (good for data overlays)
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png
```

#### 3. Pastel
Light, soft colors (modern aesthetic)
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png
```

#### 4. Water
Water-only layer (for overlays)
```
https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/water/EPSG:3857/{z}/{x}/{y}.png
```

### Custom Styling (Vector Tiles)

With PDOK vector tiles, you can customize everything:

```typescript
const customStyle = {
  version: 8,
  sources: {
    'pdok-vector': {
      type: 'vector',
      tiles: ['https://api.pdok.nl/brt/achtergrondkaart/ogc/v1_0/tiles/WebMercatorQuad/{z}/{x}/{y}.pbf']
    }
  },
  layers: [
    // Background
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f8f9fa' }
    },
    // Water (blue)
    {
      id: 'water',
      type: 'fill',
      source: 'pdok-vector',
      'source-layer': 'water',
      paint: {
        'fill-color': '#3b9eff',
        'fill-opacity': 0.5
      }
    },
    // Parks (green)
    {
      id: 'parks',
      type: 'fill',
      source: 'pdok-vector',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'park'],
      paint: {
        'fill-color': '#56ab2f',
        'fill-opacity': 0.3
      }
    },
    // Roads (white with dark outline)
    {
      id: 'roads',
      type: 'line',
      source: 'pdok-vector',
      'source-layer': 'transportation',
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 1,
          15, 4
        ]
      }
    },
    // Buildings (3D)
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'pdok-vector',
      'source-layer': 'building',
      paint: {
        'fill-extrusion-color': '#d4d4d4',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.8
      }
    }
  ]
};
```

---

## 🚀 Self-Hosting Options

### Option 1: Use PDOK Directly (Recommended)

**Pros**:
- ✅ Zero setup
- ✅ FREE, unlimited
- ✅ Hosted by Dutch government (reliable)
- ✅ No maintenance

**Cons**:
- ⚠️ Dependent on PDOK uptime (99.9%+)
- ⚠️ Can't customize tile rendering

**Cost**: $0/month

---

### Option 2: Cache PDOK Tiles (Hybrid)

Use PDOK as source, but cache tiles on your CDN:

```typescript
// Cloudflare Worker: Tile Proxy
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const tileUrl = `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857${url.pathname}`;

    // Check cache first
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      // Fetch from PDOK
      response = await fetch(tileUrl);

      // Cache for 30 days
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', 'public, max-age=2592000');

      ctx.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  }
};
```

**Pros**:
- ✅ Faster for repeat visitors
- ✅ Reduces load on PDOK
- ✅ Still free (Cloudflare caching)

**Cost**: $0/month (within Cloudflare free tier)

---

### Option 3: Self-Host Tiles (Full Control)

Generate and host your own tiles from OSM/PDOK data:

#### Step 1: Generate Tiles

```bash
# Install tilemaker (OSM → MBTiles)
sudo apt install tilemaker

# Download Netherlands OSM data
wget https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

# Generate vector tiles
tilemaker --input netherlands-latest.osm.pbf \
          --output netherlands.mbtiles \
          --config resources/config-openmaptiles.json \
          --process resources/process-openmaptiles.lua
```

#### Step 2: Serve Tiles

```bash
# Install tileserver-gl
npm install -g tileserver-gl-light

# Serve tiles
tileserver-gl-light netherlands.mbtiles
# Runs on http://localhost:8080
```

#### Step 3: Host on Your Infrastructure

Upload `netherlands.mbtiles` to:
- **Cloudflare R2** (cheap storage)
- **DigitalOcean Spaces**
- **Your own VPS**

**Pros**:
- ✅ Complete control
- ✅ No external dependencies
- ✅ Custom data layers

**Cons**:
- ⚠️ Setup complexity
- ⚠️ Storage costs (~2-5 GB)
- ⚠️ Bandwidth costs

**Cost**: ~$5-20/month (VPS + storage)

---

## 📦 Recommended Stack for Where-to-Live-NL

### Final Recommendation

```
┌─────────────────────────────────────────┐
│      MapLibre GL JS (Client)            │
│  • Open source, no vendor lock-in       │
│  • 3D support, smooth animations        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│    PDOK BRT Vector Tiles (Base Map)     │
│  • Free, unlimited                      │
│  • Customizable styling                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Your Data Overlays (GeoJSON/Vector)    │
│  • Livability scores (heatmap)          │
│  • Crime statistics (choropleth)        │
│  • Property markers                     │
└─────────────────────────────────────────┘
```

### Implementation

```typescript
// lib/map/config.ts
export const MAP_CONFIG = {
  center: [5.2913, 52.1326] as [number, number], // Netherlands center
  zoom: 7,
  minZoom: 6,
  maxZoom: 18,

  style: {
    version: 8,
    sources: {
      'pdok-base': {
        type: 'vector',
        tiles: [
          'https://api.pdok.nl/brt/achtergrondkaart/ogc/v1_0/tiles/WebMercatorQuad/{z}/{x}/{y}.pbf'
        ],
        maxzoom: 14
      },
      'livability-data': {
        type: 'geojson',
        data: 'https://r2.your-domain.com/leefbaarometer.geojson'
      }
    },
    layers: [
      // Base map layers (water, roads, buildings)
      {
        id: 'water',
        type: 'fill',
        source: 'pdok-base',
        'source-layer': 'water',
        paint: { 'fill-color': '#a0c8f0' }
      },
      // Your data overlays
      {
        id: 'livability-heatmap',
        type: 'heatmap',
        source: 'livability-data',
        paint: {
          'heatmap-weight': ['get', 'score'],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(255,0,0,0)',
            0.5, 'rgb(255,255,0)',
            1, 'rgb(0,255,0)'
          ]
        }
      }
    ]
  }
};
```

---

## 🔧 Advanced Features

### 1. Add Custom Markers (Properties)

```typescript
// Add property markers
properties.forEach(property => {
  const el = document.createElement('div');
  el.className = 'property-marker';
  el.style.backgroundImage = 'url(/icons/house.svg)';
  el.style.width = '32px';
  el.style.height = '32px';

  new maplibregl.Marker(el)
    .setLngLat([property.longitude, property.latitude])
    .setPopup(
      new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <h3>${property.address}</h3>
          <p>Livability: ${property.livabilityScore}/10</p>
        `)
    )
    .addTo(map.current);
});
```

### 2. Add Heatmap (Livability Scores)

```typescript
map.current.addSource('livability', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: livabilityData.map(point => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.lon, point.lat]
      },
      properties: {
        score: point.livabilityScore
      }
    }))
  }
});

map.current.addLayer({
  id: 'livability-heat',
  type: 'heatmap',
  source: 'livability',
  paint: {
    'heatmap-weight': [
      'interpolate',
      ['linear'],
      ['get', 'score'],
      0, 0,
      10, 1
    ],
    'heatmap-intensity': 1,
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(0, 0, 255, 0)',
      0.3, 'rgb(0, 255, 0)',
      0.5, 'rgb(255, 255, 0)',
      0.7, 'rgb(255, 165, 0)',
      1, 'rgb(255, 0, 0)'
    ],
    'heatmap-radius': 30
  }
});
```

### 3. Add Municipality Boundaries

```typescript
// Fetch PDOK administrative boundaries
const response = await fetch(
  'https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0?' +
  'service=WFS&version=2.0.0&request=GetFeature&' +
  'typeName=bestuurlijkegebieden:Gemeentegebied&' +
  'outputFormat=application/json'
);

const boundaries = await response.json();

map.current.addSource('municipalities', {
  type: 'geojson',
  data: boundaries
});

map.current.addLayer({
  id: 'municipality-borders',
  type: 'line',
  source: 'municipalities',
  paint: {
    'line-color': '#627BC1',
    'line-width': 2,
    'line-opacity': 0.8
  }
});

// Add labels
map.current.addLayer({
  id: 'municipality-labels',
  type: 'symbol',
  source: 'municipalities',
  layout: {
    'text-field': ['get', 'gemeentenaam'],
    'text-size': 14
  },
  paint: {
    'text-color': '#000000',
    'text-halo-color': '#ffffff',
    'text-halo-width': 2
  }
});
```

### 4. Geocoding (Address Search)

Use PDOK Locatieserver (free geocoding API):

```typescript
async function geocodeAddress(query: string) {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.response.docs.map((doc: any) => ({
    address: doc.weergavenaam,
    coordinates: [doc.centroide_ll.split(' ')[0], doc.centroide_ll.split(' ')[1]],
    type: doc.type,
    postalCode: doc.postcode,
    city: doc.woonplaatsnaam
  }));
}

// Usage
const results = await geocodeAddress('Dam 1, Amsterdam');
// Fly to result
map.current.flyTo({
  center: results[0].coordinates,
  zoom: 16,
  duration: 2000
});
```

---

## 📊 Performance Optimization

### 1. Lazy Load Tiles

```typescript
map.current.on('moveend', () => {
  const bounds = map.current.getBounds();

  // Only load data within viewport
  loadDataForBounds(bounds);
});
```

### 2. Use Vector Tiles (Smaller)

Vector tiles are 60-80% smaller than raster tiles:
- Raster tile (PNG): ~50 KB
- Vector tile (PBF): ~10 KB

### 3. Cache Tiles in Service Worker

```typescript
// service-worker.js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache PDOK tiles
  if (url.hostname === 'service.pdok.nl') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open('map-tiles').then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

---

## 💰 Cost Comparison

| Solution | Setup Cost | Monthly Cost | Control | Scalability |
|----------|------------|--------------|---------|-------------|
| **PDOK + MapLibre** | $0 | $0 | Medium | ♾️ Unlimited |
| **Mapbox GL JS** | $0 | $50-500 | Low | Limited by plan |
| **Google Maps** | $0 | $200-2000 | Low | Limited by plan |
| **Self-hosted Tiles** | $50 | $20-100 | High | Full control |

**Winner**: PDOK + MapLibre (free, unlimited, no vendor lock-in)

---

## 🎯 Implementation Checklist

### Phase 1: Basic Map
- [ ] Install MapLibre GL JS
- [ ] Add PDOK BRT base map
- [ ] Add zoom/pan controls
- [ ] Add geolocation button
- [ ] Add scale bar

### Phase 2: Data Layers
- [ ] Add livability heatmap
- [ ] Add crime statistics overlay
- [ ] Add municipality boundaries
- [ ] Add property markers
- [ ] Add layer toggle controls

### Phase 3: Interactivity
- [ ] Add PDOK geocoding (address search)
- [ ] Add click handlers for properties
- [ ] Add hover effects
- [ ] Add tooltips/popups
- [ ] Add travel time isochrones

### Phase 4: Optimization
- [ ] Implement tile caching
- [ ] Add service worker for offline
- [ ] Lazy load data layers
- [ ] Optimize marker clustering
- [ ] Add loading states

---

## 📚 Resources

### Documentation
- [PDOK Documentation](https://www.pdok.nl/documentation) (Dutch)
- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js/docs/)
- [PDOK REST API](https://api.pdok.nl/)

### PDOK Useful APIs

| API | URL | Use Case |
|-----|-----|----------|
| **Locatieserver** (Geocoding) | https://api.pdok.nl/bzk/locatieserver/ | Address search |
| **BAG API** | https://api.pdok.nl/bzk/bag/v2/ | Building data |
| **WFS** (Features) | https://service.pdok.nl/.../wfs/v1_0 | Vector data |
| **WMTS** (Tiles) | https://service.pdok.nl/.../wmts/v2_0 | Raster tiles |

### Example Projects
- [PDOK Viewer](https://www.pdok.nl/viewer/) - Official PDOK map viewer
- [MapLibre Examples](https://maplibre.org/maplibre-gl-js/docs/examples/)

---

## 🚀 Quick Start Code

```typescript
// app/components/DutchMap.tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function DutchMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'pdok-base': {
            type: 'raster',
            tiles: [
              'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png'
            ],
            tileSize: 256
          }
        },
        layers: [
          {
            id: 'pdok-layer',
            type: 'raster',
            source: 'pdok-base'
          }
        ]
      },
      center: [5.2913, 52.1326], // Netherlands center
      zoom: 7,
      minZoom: 6,
      maxZoom: 18
    });

    // Add controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    map.current.addControl(new maplibregl.GeolocateControl(), 'top-right');

    // Loading indicator
    map.current.on('load', () => setLoading(false));

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-[600px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-lg">Loading map...</div>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
```

---

## 🎉 Conclusion

Using **PDOK + MapLibre GL JS** gives you:
- ✅ 100% free, unlimited usage
- ✅ No vendor lock-in
- ✅ Commercial-safe licensing
- ✅ High-quality Dutch government data
- ✅ Modern WebGL-based rendering
- ✅ Self-hostable if needed

**No API keys. No tracking. No surprise bills. Ever.**

---

**Last Updated**: November 3, 2025
**Questions?** Check [PDOK Documentation](https://www.pdok.nl/) or open a GitHub issue
