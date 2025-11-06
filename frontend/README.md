# Where-to-Live-NL Frontend

> Next.js 14 + MapLibre GL JS + PDOK Maps

Multi-destination travel time calculator for finding housing in the Netherlands.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit `http://localhost:3000`

---

## ✨ Features

### Implemented
- ✅ **Next.js 14 App Router** with TypeScript
- ✅ **MapLibre GL JS** - Open-source map rendering
- ✅ **PDOK Base Maps** - Free Dutch government tiles (unlimited usage!)
- ✅ **Multi-destination input** - Add up to 5 destinations
- ✅ **Travel time sliders** - Set max commute time (5-60 min)
- ✅ **Travel mode selection** - Bike, public transport, or both
- ✅ **Responsive design** - Tailwind CSS
- ✅ **Interactive map** - Zoom, pan, geolocation

### Coming Soon
- 🔨 PDOK geocoding integration (address search)
- 🔨 Isochrone visualization (reachable areas)
- 🔨 Property markers with BAG + WOZ data
- 🔨 Livability score overlay (Leefbaarometer)
- 🔨 Crime statistics heatmap
- 🔨 School locations
- 🔨 Neighborhood comparison

---

## 🗺️ Map Technology

### Why MapLibre + PDOK?

✅ **100% Free** - No API keys, no usage limits
✅ **No vendor lock-in** - Open source (BSD license)
✅ **Government-backed** - PDOK is official Dutch government service
✅ **Unlimited usage** - No rate limits or quotas
✅ **High quality** - Detailed Dutch cadastral data
✅ **Commercial-safe** - CC0 license

### PDOK Tile Service

**Base URL**: `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0`

**Styles available**:
- `standaard` - Standard (current)
- `grijs` - Grayscale
- `pastel` - Pastel colors

**Format**: Raster tiles (PNG, 256x256 px)
**Projection**: EPSG:3857 (Web Mercator)
**Zoom levels**: 0-18

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (multi-destination UI)
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   └── Map/
│   │       └── MapView.tsx     # MapLibre map component
│   └── lib/
│       └── pdok.ts             # PDOK API utilities (TODO)
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

---

## 🎨 Components

### MapView
Interactive map with PDOK base tiles and MapLibre GL JS.

**Features**:
- Pan, zoom, geolocation
- Destination markers
- Scale bar, compass
- Responsive layout

**Props**:
```typescript
interface MapViewProps {
  destinations: Destination[]
}

type Destination = {
  id: string
  label: string
  address: string
  maxMinutes: number
  modes: ('bike' | 'pt' | 'both')[]
  coordinates?: [number, number]  // [lng, lat]
}
```

---

## 🧪 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Environment Variables

Create `.env.local`:
```bash
# Optional - defaults are set in next.config.js
NEXT_PUBLIC_PDOK_TILES_URL=https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0
NEXT_PUBLIC_PDOK_GEOCODING_URL=https://api.pdok.nl/bzk/locatieserver/search/v3_1
```

### Scripts

```bash
npm run dev         # Development server (localhost:3000)
npm run build       # Production build
npm run start       # Start production server
npm run lint        # ESLint
npm run type-check  # TypeScript check
```

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Free tier includes**:
- Unlimited bandwidth
- Automatic HTTPS
- Global CDN
- GitHub integration

### Environment Variables (Vercel)

Set in Vercel dashboard:
- `NEXT_PUBLIC_PDOK_TILES_URL` (optional)
- `NEXT_PUBLIC_PDOK_GEOCODING_URL` (optional)

---

## 🎯 Next Steps

1. **Geocoding Integration**
   - Add PDOK Locatieserver API
   - Implement address autocomplete
   - Convert addresses to coordinates

2. **Isochrone Calculation**
   - Integrate OSRM for bike routing
   - Add GTFS data for public transport
   - Visualize reachable areas on map

3. **Property Data**
   - Load BAG addresses from backend
   - Add WOZ valuations
   - Display property markers

4. **Livability Overlay**
   - Add Leefbaarometer scores
   - Color-code neighborhoods
   - Show score on hover

5. **Filters & Search**
   - Property type filters
   - Price range slider
   - Building age filter
   - Livability threshold

---

## 📚 Resources

### MapLibre GL JS
- Docs: https://maplibre.org/maplibre-gl-js-docs/
- Examples: https://maplibre.org/maplibre-gl-js-docs/examples/
- GitHub: https://github.com/maplibre/maplibre-gl-js

### PDOK
- Portal: https://www.pdok.nl/
- API Docs: https://www.pdok.nl/geo-services
- Tile Service: https://www.pdok.nl/services

### Next.js 14
- Docs: https://nextjs.org/docs
- App Router: https://nextjs.org/docs/app

---

## 🐛 Troubleshooting

### Map not loading
- Check browser console for errors
- Verify PDOK tile URL is accessible
- Ensure MapLibre CSS is imported

### TypeScript errors
```bash
npm run type-check
```

### Build errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

---

## 📄 License

MIT License - See [LICENSE.md](../LICENSE.md)

**Map Data**: © PDOK | © Kadaster (CC0 License)

---

**Built with ❤️ for expats navigating the Dutch housing market**
