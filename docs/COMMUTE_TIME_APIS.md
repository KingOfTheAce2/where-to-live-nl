# open source commute time APIs

comprehensive guide to calculating accurate travel times in the netherlands.

## overview

there are two main open-source solutions for calculating commute times:

1. **OpenRouteService (ORS)** - for car, bicycle, and walking routes
2. **OpenTripPlanner (OTP)** - for public transport + bicycle/walking multimodal routing

both are free, open-source, and use OpenStreetMap data.

---

## 1. OpenRouteService (bicycle + car)

### what it does
- calculates routes and travel times for:
  - 🚗 car (multiple profiles)
  - 🚴 bicycle (multiple types: road bike, mountain bike, e-bike)
  - 🚶 walking / hiking
  - ♿ wheelchair
  - 🚛 heavy vehicles

### key features
- **isochrones**: generate areas reachable within X minutes
- **matrix service**: calculate time/distance between multiple points
- **elevation aware**: considers hills for cycling routes
- **bicycle-friendly routes**: optimizes for cycle lanes and safety

### API endpoints

```
base URL: https://api.openrouteservice.org

key endpoints:
- /v2/directions/{profile}          - route between A → B
- /v2/matrix/{profile}              - time matrix (M origins × N destinations)
- /v2/isochrones/{profile}          - reachable area within time/distance
```

### profiles available
- `driving-car`
- `cycling-regular` - normal bicycle
- `cycling-road` - road bike
- `cycling-mountain` - mountain bike
- `cycling-electric` - e-bike
- `foot-walking`
- `foot-hiking`
- `wheelchair`

### example: bicycle route in netherlands

```javascript
// directions API
const response = await fetch(
  'https://api.openrouteservice.org/v2/directions/cycling-regular',
  {
    method: 'POST',
    headers: {
      'Authorization': 'YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: [
        [4.895168, 52.370216],  // amsterdam (lng, lat)
        [4.477733, 51.924420]   // rotterdam (lng, lat)
      ]
    })
  }
);

const data = await response.json();
const durationSeconds = data.routes[0].summary.duration;
const distanceMeters = data.routes[0].summary.distance;
```

### example: isochrone (reachable area)

```javascript
// isochrones API - "where can I reach in 30 min by bike?"
const response = await fetch(
  'https://api.openrouteservice.org/v2/isochrones/cycling-regular',
  {
    method: 'POST',
    headers: {
      'Authorization': 'YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locations: [[4.895168, 52.370216]],  // amsterdam
      range: [1800],  // 30 minutes (in seconds)
      range_type: 'time'
    })
  }
);

const data = await response.json();
// returns GeoJSON polygon of reachable area
```

### rate limits (free tier)
- **2,000 requests/day** (with free API key)
- **40 requests/minute**
- can self-host for unlimited usage

### self-hosting
```bash
# docker setup
docker pull openrouteservice/openrouteservice:latest
docker run -dt \
  -p 8080:8080 \
  -v $PWD/data:/home/ors/files \
  openrouteservice/openrouteservice:latest
```

download netherlands OSM data: https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

---

## 2. OpenTripPlanner (public transport)

### what it does
- **multimodal routing**: combines public transport + bicycle + walking
- **uses GTFS data**: all dutch public transport schedules
- **realtime updates**: can integrate GTFS-RT for delays/cancellations

### data sources needed
1. **OSM data**: street network (walking, cycling)
2. **GTFS data**: public transport schedules

### dutch GTFS sources
- **NS** (dutch railways): https://gtfs.ovapi.nl/nl/gtfs-nl.zip
- **all dutch transit**: https://gtfs.ovapi.nl/new/gtfs-openov-nl.zip (trains, buses, trams, metro)

### setup (self-hosted only)

```bash
# 1. download OTP
wget https://github.com/opentripplanner/OpenTripPlanner/releases/download/v2.5.0/otp-2.5.0-shaded.jar

# 2. create graph directory
mkdir -p otp-graphs/netherlands

# 3. download data
cd otp-graphs/netherlands
wget https://download.geofabrik.de/europe/netherlands-latest.osm.pbf
wget https://gtfs.ovapi.nl/new/gtfs-openov-nl.zip

# 4. build graph (one-time, takes ~30 min for netherlands)
java -Xmx8G -jar otp-2.5.0-shaded.jar --build --save otp-graphs/netherlands

# 5. run server
java -Xmx4G -jar otp-2.5.0-shaded.jar --load otp-graphs/netherlands
```

server runs on: http://localhost:8080

### API example: multimodal trip

```javascript
// REST API (classic)
const response = await fetch(
  'http://localhost:8080/otp/routers/default/plan?' + new URLSearchParams({
    fromPlace: '52.370216,4.895168',  // amsterdam
    toPlace: '51.924420,4.477733',    // rotterdam
    mode: 'TRANSIT,BICYCLE',          // public transport + bike
    date: '2025-11-12',
    time: '09:00',
    maxWalkDistance: 2000,            // meters
    maxBikeDistance: 5000,            // meters
    arriveBy: false
  })
);

const data = await response.json();
const duration = data.plan.itineraries[0].duration;  // seconds
```

### GraphQL API (modern)

```graphql
query {
  plan(
    from: {lat: 52.370216, lon: 4.895168}  # amsterdam
    to: {lat: 51.924420, lon: 4.477733}    # rotterdam
    date: "2025-11-12"
    time: "09:00"
    transportModes: [{mode: RAIL}, {mode: BICYCLE}]
  ) {
    itineraries {
      duration    # seconds
      legs {
        mode
        duration
        distance
        from { name }
        to { name }
      }
    }
  }
}
```

### limitations
- **self-hosted only**: no free public API for OTP
- **requires significant resources**: 8GB RAM for netherlands
- **graph rebuild needed**: when GTFS or OSM data updates (weekly/monthly)

---

## 3. combination strategy (recommended)

use both services for comprehensive routing:

### option A: client-side (simple)
```javascript
async function calculateCommute(from, to, mode) {
  if (mode === 'bicycle' || mode === 'car') {
    // use OpenRouteService (public API)
    return await orsRoute(from, to, mode);
  } else if (mode === 'transit' || mode === 'transit+bike') {
    // use self-hosted OTP
    return await otpRoute(from, to, mode);
  }
}
```

### option B: server-side cache (optimal)
1. pre-calculate common routes
2. store in database with TTL
3. serve from cache for instant results
4. fallback to API for new routes

```python
# example: pre-calculate from major cities
cities = ['amsterdam', 'rotterdam', 'den haag', 'utrecht', 'eindhoven']

for city in cities:
    for destination in all_neighborhoods:
        # calculate once
        bicycle_time = ors.calculate(city, destination, 'cycling-regular')
        transit_time = otp.calculate(city, destination, 'TRANSIT')

        # cache in database
        db.save(origin=city, dest=destination, bike_min=bicycle_time,
                transit_min=transit_time, cached_at=now())
```

### option C: isochrones only (fastest)

instead of calculating individual routes, use isochrones to show:
- "everything within 30 min by bike"
- "everything within 45 min by public transport"

advantages:
- **much faster**: one API call instead of thousands
- **visual**: shows areas on map
- **covers all destinations**: no need to pre-calculate

```javascript
// show "livable areas" within 30 min of work
const bikeArea = await ors.isochrone(workLocation, 1800, 'cycling-regular');
const transitArea = await otp.isochrone(workLocation, 1800, 'TRANSIT');

// display on map as colored overlay
map.addLayer(bikeArea, { color: 'green', opacity: 0.3 });
map.addLayer(transitArea, { color: 'blue', opacity: 0.3 });
```

---

## 4. practical implementation for where-to-live-nl

### architecture

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js)                │
│  - user selects work location + mode       │
│  - draws isochrone on map                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      Backend API (Python FastAPI)           │
│  - routes requests to appropriate service   │
│  - caches results in Redis/SQLite           │
└───────────┬─────────────────┬───────────────┘
            │                 │
            ▼                 ▼
┌─────────────────┐  ┌───────────────────────┐
│ OpenRouteService│  │  OpenTripPlanner (OTP)│
│  (public API)   │  │   (self-hosted)       │
│  - bicycle      │  │   - public transport  │
│  - car          │  │   - multimodal        │
│  - walking      │  │                       │
└─────────────────┘  └───────────────────────┘
```

### phase 1: start simple (bicycle only)
```javascript
// use public ORS API for bicycle routes
// free tier: 2,000 requests/day = enough for development
```

### phase 2: add caching
```python
# cache frequent routes in database
# reduces API calls by 90%
```

### phase 3: self-host ORS (optional)
```bash
# unlimited requests
# faster response times
```

### phase 4: add public transport (OTP)
```bash
# self-host OTP with dutch GTFS data
# requires 8GB RAM VPS (~€10/month)
```

---

## 5. cost comparison

| solution | hosting | API calls | cost/month |
|----------|---------|-----------|------------|
| ORS free tier | cloud | 2,000/day | €0 |
| ORS self-hosted | VPS (2GB) | unlimited | €5-10 |
| OTP self-hosted | VPS (8GB) | unlimited | €15-25 |
| combined | VPS (8GB) | unlimited | €15-25 |

**recommendation**: start with ORS free tier, self-host later if needed.

---

## 6. alternative: static estimates

if APIs are too complex, use distance-based estimates:

```javascript
function estimateTravelTime(from, to, mode) {
  const distance = haversineDistance(from, to);  // km

  const speeds = {
    bicycle: 15,      // km/h average
    car: 50,          // km/h in cities
    transit: 30,      // km/h average
    walking: 5        // km/h
  };

  const timeMinutes = (distance / speeds[mode]) * 60;
  return Math.round(timeMinutes);
}
```

**pros**: instant, no API needed, works offline
**cons**: less accurate, doesn't consider traffic/routes

---

## 7. resources

### OpenRouteService
- website: https://openrouteservice.org
- API docs: https://openrouteservice.org/dev/#/api-docs
- github: https://github.com/GIScience/openrouteservice
- sign up: https://openrouteservice.org/dev/#/signup
- docker: https://hub.docker.com/r/openrouteservice/openrouteservice

### OpenTripPlanner
- website: https://www.opentripplanner.org
- docs: https://docs.opentripplanner.org/en/v2.5.0/
- github: https://github.com/opentripplanner/OpenTripPlanner
- releases: https://github.com/opentripplanner/OpenTripPlanner/releases

### data sources
- OSM netherlands: https://download.geofabrik.de/europe/netherlands.html
- GTFS netherlands: https://gtfs.ovapi.nl/
- elevation data (SRTM): https://www.openrouteservice.org/dev/#/home

---

## 8. recommended approach for your app

### mvp (minimum viable product)
1. use **OpenRouteService free API** for bicycle routes
2. use **simple isochrones** instead of point-to-point routes
3. show "areas within X minutes" on map
4. no caching needed initially

### production (full featured)
1. self-host **OpenRouteService** (unlimited bicycle/car routes)
2. add caching layer (Redis) for frequent routes
3. optionally add **OpenTripPlanner** for public transport
4. pre-calculate isochrones for major cities

### code example (mvp)

```typescript
// frontend/src/lib/routing.ts
export async function getIsochrone(
  location: [number, number],
  minutes: number,
  mode: 'cycling-regular' | 'driving-car'
) {
  const response = await fetch(
    `https://api.openrouteservice.org/v2/isochrones/${mode}`,
    {
      method: 'POST',
      headers: {
        'Authorization': process.env.NEXT_PUBLIC_ORS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locations: [location],
        range: [minutes * 60],  // convert to seconds
        range_type: 'time'
      })
    }
  );

  return response.json();
}
```

---

**last updated**: november 11, 2025
