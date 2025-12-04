# Frontend Development Guide

**Last Updated:** November 8, 2025

Complete guide to developing the Where-to-Live-NL frontend application.

---

## 🏗️ Tech Stack

**Framework:** Next.js 14.2.3 (React 18)
**Language:** TypeScript 5.4
**Styling:** Tailwind CSS 3.4
**Maps:** MapLibre GL JS 4.1
**Icons:** Lucide React
**Tiles:** PMTiles 3.0

---

## 🚀 Quick Start

### **1. Install Dependencies**

```bash
cd frontend
npm install
```

### **2. Start Development Server**

```bash
npm run dev
```

Open http://localhost:3000

### **3. Build for Production**

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Homepage
│   │   └── api/                # API routes
│   │       ├── properties/     # Property data endpoints
│   │       └── schools/        # School data endpoints
│   │
│   ├── components/             # React components
│   │   ├── AddressAutocomplete.tsx
│   │   ├── PropertyFilters.tsx
│   │   └── Map/
│   │       └── MapView.tsx     # MapLibre map component
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAddressSearch.ts
│   │   └── useProperties.ts
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── intersections.ts   # Isochrone calculations
│   │   ├── isochrones.ts      # Travel time analysis
│   │   └── pdok.ts            # PDOK API client
│   │
│   └── types/                  # TypeScript types
│       ├── property.ts
│       └── school.ts
│
├── public/                     # Static assets
├── tailwind.config.js          # Tailwind configuration
├── next.config.js              # Next.js configuration
└── package.json                # Dependencies
```

---

## 🎨 Current Features

### **1. Multi-Destination Travel Time Calculator**

**UI Components:**
- Add up to 5 destinations
- For each destination:
  - Custom label
  - Address autocomplete (PDOK)
  - Max travel time slider (5-60 minutes)
  - Travel mode selection (bike/transit/both)

**Status:** ✅ UI complete, needs backend integration

---

### **2. Interactive Map (MapLibre)**

**Features:**
- Netherlands basemap
- Destination markers
- Property filtering

**Status:** ⚠️ Component exists, needs data integration

**Location:** `src/components/Map/MapView.tsx`

---

### **3. Property Filters**

**Filter Options:**
- Price range
- Property type
- Number of rooms
- Surface area
- WOZ value

**Status:** ⚠️ Component exists, needs backend data

**Location:** `src/components/PropertyFilters.tsx`

---

### **4. Address Autocomplete**

**Data Source:** PDOK Locatieserver API

**Features:**
- Real-time address suggestions
- Returns coordinates
- Netherlands-specific

**Status:** ✅ Implemented

**Location:** `src/components/AddressAutocomplete.tsx`

---

## 🔧 What Needs to Be Built

### **Priority 1: Connect to Data**

#### **A. Create API Route for WOZ Data**

```typescript
// src/app/api/properties/woz/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postalCode = searchParams.get('postal_code')

  // Read from Parquet file (you'll need a Parquet reader)
  const dataPath = path.join(process.cwd(), '../data/processed/woz-netherlands-complete.parquet')

  // TODO: Implement Parquet reading
  // For now, return mock data

  return NextResponse.json({
    properties: []
  })
}
```

**Needed:**
- Parquet reader library for Node.js
- Efficient querying by postal code
- Pagination

---

#### **B. Create API Route for Amenities**

```typescript
// src/app/api/amenities/supermarkets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import supermarketsData from '../../../../data/raw/amenities_supermarkets.json'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '0')
  const lng = parseFloat(searchParams.get('lng') || '0')
  const radius = parseFloat(searchParams.get('radius') || '5') // km

  // Filter supermarkets within radius
  const nearby = supermarketsData.data.filter(supermarket => {
    const distance = calculateDistance(lat, lng, supermarket.lat, supermarket.lng)
    return distance <= radius
  })

  return NextResponse.json({ supermarkets: nearby })
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
```

---

#### **C. Implement Isochrone Calculation**

The travel time calculator needs actual isochrone generation.

**Current:** Stub implementation in `src/lib/isochrones.ts`

**Needs:**
- Route calculation API integration
- Options:
  1. **OpenRouteService** (free, 2000 req/day)
  2. **Mapbox Isochrone API** (paid)
  3. **OSRM** (self-hosted, free)
  4. **Pre-computed** (fastest, but static)

**Recommendation:** Start with OpenRouteService, move to pre-computed later

---

### **Priority 2: Map Data Visualization**

#### **A. Add Property Markers**

```typescript
// In MapView.tsx
useEffect(() => {
  if (!map || !properties) return

  // Add GeoJSON source
  map.addSource('properties', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: properties.map(p => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.longitude, p.latitude]
        },
        properties: {
          id: p.id,
          price: p.woz_value,
          address: p.address
        }
      }))
    }
  })

  // Add layer
  map.addLayer({
    id: 'properties',
    type: 'circle',
    source: 'properties',
    paint: {
      'circle-radius': 8,
      'circle-color': '#3b82f6',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  })
}, [map, properties])
```

---

#### **B. Add Isochrone Polygons**

```typescript
// Add isochrone visualization
map.addSource('isochrones', {
  type: 'geojson',
  data: isochroneData
})

map.addLayer({
  id: 'isochrone-fill',
  type: 'fill',
  source: 'isochrones',
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.3
  }
})

map.addLayer({
  id: 'isochrone-outline',
  type: 'line',
  source: 'isochrones',
  paint: {
    'line-color': '#3b82f6',
    'line-width': 2
  }
})
```

---

### **Priority 3: Property Details**

#### **A. Create Property Detail Modal/Page**

```typescript
// src/components/PropertyDetail.tsx
export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId)

  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold mb-4">{property.address}</h2>

      {/* WOZ Value */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">WOZ Value</h3>
        <p className="text-3xl font-bold text-primary-600">
          €{property.woz_2024?.toLocaleString()}
        </p>
        <div className="mt-2">
          {/* Historical chart */}
        </div>
      </div>

      {/* Nearby Amenities */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Nearby</h3>
        <ul>
          <li>🏪 Supermarket - 200m</li>
          <li>🏥 Hospital - 1.2km</li>
          <li>🏫 School - 500m</li>
        </ul>
      </div>

      {/* Building Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Building</h3>
        <dl>
          <dt>Built:</dt>
          <dd>{property.bouwjaar}</dd>
          <dt>Surface:</dt>
          <dd>{property.oppervlakte}m²</dd>
        </dl>
      </div>
    </div>
  )
}
```

---

## 🗺️ Map Configuration

### **Basemap Options**

**Option 1: PDOK (Dutch Government)** - FREE
```javascript
style: 'https://api.pdok.nl/lv/bgt/ogc/v1_0/styles/default'
```

**Option 2: OpenStreetMap Bright**
```javascript
style: 'https://tiles.openfreemap.org/styles/bright'
```

**Option 3: Custom (Recommended)**
- Use PMTiles for offline performance
- Style with Maputnik
- Host on Cloudflare R2

---

## 📦 Dependencies to Add

```bash
# For reading Parquet in API routes
npm install parquetjs

# For spatial calculations
npm install @turf/turf

# For charts (WOZ history)
npm install recharts

# For data fetching
npm install swr

# For forms
npm install react-hook-form zod
```

---

## 🎯 Development Roadmap

### **Week 1: Data Integration**
- [ ] Set up Parquet reader
- [ ] Create WOZ API routes
- [ ] Create amenities API routes
- [ ] Test with real data

### **Week 2: Map Features**
- [ ] Add property markers to map
- [ ] Implement isochrone calculation
- [ ] Add amenity layers
- [ ] Property click handlers

### **Week 3: Property Details**
- [ ] Property detail modal
- [ ] WOZ history charts
- [ ] Nearby amenities list
- [ ] Travel time display

### **Week 4: Polish**
- [ ] Loading states
- [ ] Error handling
- [ ] Mobile responsive
- [ ] Performance optimization

---

## 🧪 Testing Locally

```bash
# Run dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build
```

---

## 🚀 Deployment

### **Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### **Environment Variables**

Create `.env.local`:
```
# API Keys (if needed)
NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
OPENROUTESERVICE_API_KEY=your_key_here

# Data paths
DATA_PATH=../data
```

---

## 💡 Tips

1. **Use Server Components** where possible for better performance
2. **Lazy load map** with `dynamic import` (already done)
3. **Cache API responses** with SWR
4. **Optimize images** with Next.js Image component
5. **Use Tailwind** for consistent styling

---

## 🔗 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [MapLibre Docs](https://maplibre.org/maplibre-gl-js/docs/)
- [Tailwind Docs](https://tailwindcss.com/docs)
- [PDOK API](https://www.pdok.nl/services)

---

*Ready to start building? Run `npm run dev` and open http://localhost:3000*
