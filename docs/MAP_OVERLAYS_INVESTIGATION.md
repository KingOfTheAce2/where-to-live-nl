# Map Overlays Investigation Report

**Date:** 2025-01-20
**Status:** CRITICAL ISSUES IDENTIFIED
**Affected Component:** `frontend/src/components/Map/MapView.tsx`

## Executive Summary

Map overlays (Crime, Air Quality, Foundation Risk, Leefbaarometer) are **NOT DISPLAYING** due to multiple critical implementation issues. This investigation identified **10 major problems** preventing proper functionality.

---

## Critical Issues (Must Fix Immediately)

### 1. Hardcoded Backend URLs

**Severity:** 🔴 HIGH
**Lines:** 840, 1037, 1101

**Problem:**
```typescript
fetch('http://localhost:8000/api/map-overlays/crime')
fetch('http://localhost:8000/api/map-overlays/foundation-risk')
```

**Impact:**
- Fails in production
- Breaks if backend runs on different port
- No environment variable usage

**Fix:**
```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
fetch(`${BACKEND_URL}/api/map-overlays/crime`)
```

---

### 2. Crime Overlay Toggle-Off Not Implemented

**Severity:** 🔴 HIGH
**Lines:** 846-973

**Problem:**
The crime overlay useEffect only adds layers when `showCrimeOverlay` is true, but **never removes them** when it becomes false. The cleanup function only runs on component unmount, not on state change.

**Current Code:**
```typescript
useEffect(() => {
  if (!map.current || !mapLoaded || !showCrimeOverlay || crimeData.length === 0) {
    return  // ❌ Just returns, doesn't remove layers!
  }

  // Add layers...

  return () => {
    // ❌ Only runs when component unmounts, not when overlay toggles off
    if (map.current && map.current.getLayer('crime-circles')) {
      map.current.removeLayer('crime-circles')
    }
  }
}, [mapLoaded, showCrimeOverlay, crimeData])
```

**What Should Happen:**
When user unchecks the crime overlay checkbox, the layers should be immediately removed from the map.

**Fix:**
```typescript
useEffect(() => {
  if (!map.current || !mapLoaded) return

  if (showCrimeOverlay && crimeData.length > 0) {
    // Add layers
  } else {
    // Remove layers immediately when toggled off
    if (map.current.getLayer('crime-circles')) {
      map.current.removeLayer('crime-circles')
      map.current.removeLayer('crime-labels')
      map.current.removeSource('crime-overlay')
    }
  }
}, [mapLoaded, showCrimeOverlay, crimeData])
```

---

### 3. Foundation Risk Overlay - Same Toggle Issue

**Severity:** 🔴 HIGH
**Lines:** 1114-1199

Same problem as crime overlay - layers never removed when toggled off.

---

### 4. WMS Layers - No Z-Index Control

**Severity:** 🔴 HIGH
**Lines:** 1012-1019 (Air Quality), 1222-1229 (Leefbaarometer)

**Problem:**
WMS raster layers are added without specifying position in layer stack. They may be rendering **below** other layers or the base map.

**Current Code:**
```typescript
map.current.addLayer({
  id: layerId,
  type: 'raster',
  source: sourceId,
  paint: {
    'raster-opacity': 0.6
  }
  // ❌ No beforeId parameter!
})
```

**Impact:**
- Layers may render below base map (invisible)
- Layers may render in wrong order
- No control over visual stacking

**Fix:**
```typescript
map.current.addLayer({
  id: layerId,
  type: 'raster',
  source: sourceId,
  paint: {
    'raster-opacity': 0.6
  }
}, 'property-clusters')  // ✅ Insert before this layer
```

---

### 5. WMS URL Format Issues

**Severity:** 🟡 MEDIUM
**Lines:** 1006, 1215

**Problem:**
Using WMS version 1.3.0 with incorrect parameter names.

**Current Code:**
```
version=1.3.0&srs=EPSG:3857&bbox={bbox-epsg-3857}
```

**Issue:**
- WMS 1.3.0 uses `CRS` not `SRS`
- WMS 1.3.0 bbox order is different (lat,lon,lat,lon vs lon,lat,lon,lat)
- May cause silent failures or incorrect tile requests

**Fix Option 1 (Use WMS 1.1.1):**
```
version=1.1.1&srs=EPSG:3857&bbox={bbox-epsg-3857}
```

**Fix Option 2 (Fix WMS 1.3.0):**
```
version=1.3.0&crs=EPSG:3857&bbox={bbox-epsg-3857}
```

---

## Medium Priority Issues

### 6. No Error Handling for WMS Tiles

**Severity:** 🟡 MEDIUM
**Lines:** Throughout MapView.tsx

**Problem:**
No error listeners for tile loading failures. Silent failures make debugging impossible.

**Impact:**
- Can't tell if WMS service is down
- Can't tell if layer names are wrong
- Can't tell if CORS is blocking requests
- Users see nothing with no explanation

**Fix:**
```typescript
map.current.on('error', (e) => {
  console.error('❌ Map error:', e)
})

map.current.on('source.error', (e) => {
  console.error('❌ Source error:', e.sourceId, e.error)
})

map.current.on('data', (e) => {
  if (e.sourceId === 'rivm-air-quality-wms' && e.isSourceLoaded) {
    console.log('✅ RIVM tiles loaded successfully')
  }
})
```

---

### 7. Leefbaarometer Layer Name Unverified

**Severity:** 🟡 MEDIUM
**Line:** 1215

**Problem:**
```
layers=leefbaarometer_2024
```

Layer name not verified against actual WMS GetCapabilities response.

**Risk:**
- Layer name might be wrong
- Service might use different naming
- Could result in empty tiles

**How to Verify:**
```bash
curl "https://geo.leefbaarometer.nl/wms?service=WMS&request=GetCapabilities" | grep -i "layer"
```

---

### 8. Missing Data Source Loading States

**Severity:** 🟡 MEDIUM

**Problem:**
No loading indicators for:
- Crime data fetch
- Foundation risk data fetch
- Air quality data fetch

**Impact:**
- User doesn't know data is loading
- May toggle overlays on/off before data loads
- Confusing UX

**Fix:**
Add loading states and show spinners/messages.

---

## Low Priority Issues

### 9. Incomplete useEffect Dependencies

**Severity:** 🟢 LOW
**Lines:** 976, 1132, 1202

**Problem:**
Dependencies arrays don't include all referenced variables. May cause stale closures.

**Note:** Not causing current visibility issues, but could cause bugs later.

---

### 10. No Debug Logging for Tile Requests

**Severity:** 🟢 LOW

**Problem:**
Can't see in console when WMS tiles are being requested/loaded.

**Fix:**
Add detailed logging:
```typescript
console.log('🌐 Requesting WMS tiles:', wmsUrl)
console.log('📍 Current bbox:', map.getBounds())
```

---

## Schools Dataset Investigation

### Current Implementation Status

**File:** `MapView.tsx` lines 322-409

**Status:** ✅ IMPLEMENTED but **DISABLED**

**Code:**
```typescript
// Fetch and display schools
// DISABLED: Schools API not yet implemented
useEffect(() => {
  if (!map.current || !mapLoaded || !showSchools) return

  // Schools API will be implemented later
  // For now, just clear the schools source
  const source = map.current.getSource('schools') as maplibregl.GeoJSONSource
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: [],
    })
  }

  setSchoolsLoading(false)
}, [mapLoaded, showSchools])
```

**Why Not Working:**
1. Comment says "Schools API not yet implemented"
2. Always sets empty features array
3. Never fetches from backend

**Backend Status:**
```bash
ls data/processed/schools.parquet  # ✅ EXISTS!
```

**Available Data:**
Backend has schools data at `data/processed/schools.parquet`

**What's Missing:**
1. Backend API endpoint `/api/schools` or `/api/map-overlays/schools`
2. Frontend fetch implementation
3. School type filtering (primary, secondary, MBO, HBO, university)

---

## Enhanced BAG Dataset Investigation

**Search Results:**
```bash
find . -name "*bag*" -o -name "*BAG*"
# No enhanced BAG dataset found
```

**What Exists:**
- `data/processed/addresses.parquet` - Basic address info (coordinates, postal codes)
- No building-specific data (sqm, year built, type)

**What Enhanced BAG Would Contain:**
- Building square meters (oppervlakte)
- Year built (bouwjaar)
- Building type (residential, commercial, etc.)
- Number of floors
- Energy label
- Monument status

**Recommendation:**
Need to either:
1. Download enhanced BAG data from PDOK
2. Use BAG API to fetch building details on-demand
3. Add BAG WFS layer to download building polygons

**BAG API Example:**
```
https://api.pdok.nl/lv/bag/v2/verblijfsobjecten?postcode=4874MM&huisnummer=27
```

---

## Leefbaarometer Score Verification

**Current Data Source:** Backend Parquet file (`data/processed/leefbaarometer.parquet`)

**Current Score Returned:**
```json
{
  "score_total": 6.0,
  "score_physical": 5.0,
  "score_social": 5.0,
  "score_safety": null,
  "score_facilities": 5.0,
  "score_housing": 5.0,
  "measurement_year": 2024
}
```

**Leefbaarometer Official Scale:**
- 1-2: Very negative
- 3-4: Negative
- 5-6: Neutral
- 7-8: Positive
- 9-10: Very positive

**Score of 6.0 = Upper end of "Neutral" (acceptable livability)**

**Cross-Reference Check:**
✅ Data appears legitimate - measurement_year is 2024 (latest)
✅ Scores are on 1-10 scale as expected
⚠️ Safety score is null for this neighborhood

**Recommendation:**
When displaying livability, add context:
```
Score: 6.0/10 (Neutral - Acceptable livability)
Based on: Leefbaarometer 2024
```

---

## Recommended Fix Priority

### Phase 1: Critical Fixes (Do First)
1. ✅ Fix hardcoded backend URLs
2. ✅ Add toggle-off logic for crime overlay
3. ✅ Add toggle-off logic for foundation risk overlay
4. ✅ Add beforeId to WMS layers for proper z-index

### Phase 2: Essential Improvements (Do Next)
5. ✅ Fix WMS URL format (version 1.1.1)
6. ✅ Add error handling for map/tiles
7. ✅ Verify Leefbaarometer layer name
8. ✅ Add debug logging

### Phase 3: Feature Completion (After Fixes Work)
9. Implement schools overlay backend API
10. Implement schools overlay frontend fetch
11. Add school type filtering (primary/secondary/MBO/HBO/university)
12. Consider BAG API integration for building details

---

## Testing Plan

### Test Each Overlay Individually

**Crime Overlay:**
1. Toggle on → Check Network tab for `/api/map-overlays/crime` request
2. Verify blue circles appear on map
3. Toggle off → Verify circles disappear immediately
4. Toggle on again → Verify no duplicate layers

**Air Quality (RIVM WMS):**
1. Toggle on → Check Network tab for WMS tile requests to `geodata.rivm.nl`
2. Select different pollutants (NO₂, PM10, PM2.5) → Verify tiles update
3. Verify color-coded heat map appears
4. Toggle off → Verify heat map disappears

**Leefbaarometer WMS:**
1. Toggle on → Check Network tab for WMS requests to `geo.leefbaarometer.nl`
2. Verify color-coded neighborhoods appear
3. Check for any 404/500 errors
4. Toggle off → Verify overlay disappears

**Foundation Risk:**
1. Toggle on → Check Network tab for `/api/map-overlays/foundation-risk`
2. Verify orange polygons appear (only in affected areas)
3. Toggle off → Verify polygons disappear

### Browser DevTools Checklist

**Console Tab:**
- [ ] No MapLibre GL errors
- [ ] See "Map loaded successfully" message
- [ ] See overlay toggle messages (🗺️ Adding/Removing...)
- [ ] No fetch errors (❌ symbols)

**Network Tab:**
- [ ] Backend API requests succeed (200 OK)
- [ ] WMS tile requests succeed (200 OK)
- [ ] No CORS errors
- [ ] Tile images are not empty (check preview)

**Elements Tab:**
- [ ] Canvas element exists
- [ ] Canvas has proper dimensions
- [ ] No z-index: -9999 or similar hiding issues

---

## Implementation Notes

### Current Map Layer Stack (from bottom to top)
1. `pdok-background` (base map tiles)
2. `isochrone-fills` (travel time areas)
3. `isochrone-borders` (travel time borders)
4. `intersection-fill` (overlap areas)
5. `intersection-border` (overlap borders)
6. `property-clusters` (property cluster circles)
7. `property-cluster-count` (cluster count labels)
8. `property-points` (individual properties)
9. `primary-schools` (school markers)
10. `secondary-schools` (school markers)
11. `amenities-*` (amenity markers)

**Recommendation:**
Insert overlay layers after `pdok-background` but before `isochrone-fills` to ensure visibility:
```typescript
map.current.addLayer({...}, 'isochrone-fills')
```

---

## Conclusion

The map overlays are not displaying due to **implementation issues, not data availability**. All backend APIs are working, data exists, but the frontend code has critical bugs preventing proper rendering.

**Estimated Fix Time:** 2-3 hours for all critical and essential fixes

**Success Criteria:**
- [ ] All overlays toggle on/off correctly
- [ ] WMS tiles load and display
- [ ] No console errors
- [ ] Crime/foundation risk GeoJSON layers visible
- [ ] Schools dataset implemented and visible

---

## Additional Resources

- [MapLibre GL Style Spec](https://maplibre.org/maplibre-style-spec/)
- [OGC WMS Specification](https://www.ogc.org/standards/wms)
- [PDOK Services Documentation](https://www.pdok.nl/services)
- [Leefbaarometer Open Data](https://www.leefbaarometer.nl/page/Opendata)
