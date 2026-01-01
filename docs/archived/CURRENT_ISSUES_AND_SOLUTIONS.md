# Current Issues and Solutions

**Date:** 2025-01-20
**Status:** Active Issues Investigation

---

## 1. ✅ FIXED: Comparison Labels Unclear

### Issue
Neighborhood comparison showed "219% worse, 14% better" without specifying the baseline. Users didn't know if this was comparing to:
- Other neighborhoods in the comparison
- National statistics
- Some other baseline

### Root Cause
The ComparisonPanel component compared neighborhoods to each other but didn't specify this in the label.

### Solution Applied
Updated comparison labels in `ComparisonPanel.tsx:291-305` to be explicit:
- Changed: `{diff}% better` → `{diff}% better than other{s}`
- Changed: `{diff}% worse` → `{diff}% worse than other{s}`
- Changed: `Similar` → `Similar to other{s}`

**Status:** ✅ FIXED

---

## 2. ⚠️ INVESTIGATING: Neighborhood Boundary Gaps

### Issue
Neighborhood boundaries display correctly for Belgian enclaves in Baarle-Nassau but NOT for the Dutch parts. User reports:
> "Neighborhood boundry seems to populate the belgian parts in baarle nassau correctly. WHY NOT THE REST??"

### Investigation Findings

**CBS WFS Data Structure:**
- Municipality code for Baarle-Nassau: `GM0998`
- Special code for foreign territory: `BU09989999` ("Buitenland")
- The CBS correctly classifies Belgian enclaves as "Buitenland" (Foreign)

**Hypothesis:**
1. The Belgian enclaves ARE being shown because they have proper geometry in CBS data
2. The Dutch parts may be missing boundaries OR have different area codes
3. The coordinate lookup (`find_neighborhood_by_coordinates`) may be returning different area codes for Dutch vs Belgian parts

### Required Investigation
1. Test specific addresses in Dutch parts of Baarle-Nassau
2. Check what area_code is returned by `find_neighborhood_by_coordinates`
3. Verify CBS WFS has geometry for actual Dutch neighborhoods (not just "Buitenland")
4. Check if PDOK lookup is correctly returning Dutch neighborhood codes

### Potential Solutions
1. **If boundaries exist but aren't returned:** Fix CQL_FILTER query in `/api/neighborhood-boundary`
2. **If boundaries don't exist:** Use municipality boundaries as fallback
3. **Add multi-polygon support:** Baarle-Nassau may need to render multiple disconnected polygons

**Status:** ⚠️ NEEDS TESTING WITH SPECIFIC ADDRESSES

---

## 3. ⚠️ TODO: Belgium Enclave Indicators

### Issue
Belgian enclaves (Baarle-Hertog) are shown but not labeled as Belgian territory. User requests:
> "Also make sure to show those parts are belgium"

### Current Behavior
- Belgian enclaves display with purple boundary (same as Dutch neighborhoods)
- No indicator that these are foreign territory
- No differentiation in UI

### Required Implementation
1. **Detect foreign territory:** Check if `buurtcode === "BU09989999"` or `gemeentenaam === "Buitenland"`
2. **Update boundary styling:**
   - Dutch neighborhoods: Purple fill (`#a855f7`)
   - Belgian enclaves: Different color (e.g., orange or blue) + pattern/stripe
3. **Add label overlay:** Show "🇧🇪 Belgian Territory" badge on Belgian enclaves
4. **Update snapshot API:** Add `isForeign` flag to response

### Files to Modify
- `backend/api_server.py` - `/api/neighborhood-boundary` endpoint to detect foreign territory
- `frontend/src/components/Map/MapView.tsx` - Add different layer styling for Belgian areas
- `frontend/src/app/api/snapshot/route.ts` - Add foreign territory detection

**Status:** ⚠️ NOT YET IMPLEMENTED

---

## 4. ⚠️ TODO: Data Ingestion to Minimize API Errors

### Issue
User requests:
> "Also data i want ingested for the large part, to avoid api errors"

### Current Architecture
**Data Already Ingested (Parquet files):**
- ✅ CBS Demographics
- ✅ Crime statistics
- ✅ Leefbaarometer (livability)
- ✅ WOZ values (property values)
- ✅ Air quality
- ✅ Foundation risk
- ✅ Energy consumption
- ✅ Amenities (OSM data)
- ✅ Schools (DUO data)
- ✅ Train stations

**Data Still Using External APIs:**
- ❌ **Neighborhood boundaries** (CBS WFS - Real-time)
- ❌ **Travel time calculations** (OpenRouteService - Real-time with caching)
- ❌ **WMS overlays** (RIVM, Leefbaarometer - Real-time via proxy)
- ❌ **Address lookup** (PDOK Locatieserver - Real-time)

### Recommended Actions

#### High Priority (Ingest to Parquet)
1. **Neighborhood Boundaries**
   - Download entire CBS Wijken & Buurten GeoJSON dataset
   - Convert to Parquet with geometry column
   - ~20MB file, updated annually
   - **Benefit:** No WFS timeout errors, instant boundary display

2. **Common Travel Time Routes**
   - Pre-calculate travel times from all neighborhoods to major cities
   - Cache top 100 destination coordinates
   - Store in Parquet: `neighborhood_code, dest_lat, dest_lng, mode, time_minutes`
   - **Benefit:** 80% of queries served from cache

#### Medium Priority
3. **Address Geocoding Cache**
   - Download entire Dutch address dataset from BAG (4M+ addresses)
   - Store in Parquet: `postal_code, house_number, lat, lng, area_code`
   - **Benefit:** No PDOK API dependency for address lookups

#### Low Priority (Keep as API)
4. **WMS Overlays** - Keep as proxy (data too large, changes frequently)
5. **Real-time Travel Times** - Keep for custom destinations (cache frequently used)

### Implementation Plan
```bash
# scripts/etl/ingest/neighborhood_boundaries.py
# Download CBS boundaries, convert to Parquet

# scripts/etl/ingest/precalculate_travel_times.py
# Pre-calculate common routes

# scripts/etl/ingest/bag_addresses.py
# Download full BAG address dataset
```

**Status:** ⚠️ NOT YET IMPLEMENTED - Requires ETL scripts

---

## 5. ✅ FIXED: Map Overlays Not Displaying (CORS)

### Issue
Map overlays (RIVM air quality, Leefbaarometer) were not visible due to CORS errors.

### Solution Applied
Created WMS proxy endpoint at `/api/wms-proxy` to route external WMS requests through backend.

**Status:** ✅ FIXED

---

## 6. ✅ FIXED: Floating "1" Cluster Label

### Issue
A "1" was appearing in the top-left corner when moving around the map.

### Solution Applied
Added filter to only show cluster labels when 2+ properties are clustered:
```typescript
filter: ['all', ['has', 'point_count'], ['>', ['get', 'point_count'], 1]]
```

**Status:** ✅ FIXED

---

## 7. ✅ FIXED: Livability Score Explanation

### Issue
Livability score showed 6.0 when all visible components were ≤5, appearing mathematically wrong.

### Root Cause
Safety score was null for the neighborhood. Leefbaarometer uses official calculation that accounts for missing dimensions.

### Solution Applied
Added intelligent note generation in `/api/snapshot` that explains when dimensions are unavailable:
```
"Kern Zuidland - Score 6/10 (Safety data unavailable - total uses official Leefbaarometer calculation)"
```

**Status:** ✅ FIXED

---

## Summary of Immediate Action Items

### For Developer
1. ⚠️ Test neighborhood boundaries with specific Baarle-Nassau addresses
2. ⚠️ Implement Belgian enclave indicators
3. ⚠️ Create ETL scripts to ingest CBS boundaries and BAG addresses
4. ⚠️ Add pre-calculated travel time cache

### For Testing
1. Search addresses in Dutch part of Baarle-Nassau
2. Search addresses in Belgian enclaves (Baarle-Hertog)
3. Verify boundary display for both
4. Check area_code returned by coordinate lookup
5. Test with neighborhoods near Belgian border

---

## Technical Debt

### Performance Optimizations Needed
1. **Lazy loading for Parquet files** - Only load datasets when requested
2. **Spatial indexing** - Add R-tree index for coordinate lookups
3. **Connection pooling** - Reuse HTTP connections for external APIs
4. **CDN for static data** - Move large Parquet files to CDN

### Code Quality
1. **TypeScript types** - Add proper types for all API responses
2. **Error boundaries** - Add React error boundaries for map components
3. **Loading states** - Add skeleton loaders for all data sections
4. **Retry logic** - Add exponential backoff for failed API requests

---

## Resources

- CBS Wijken en Buurten: https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/wijk-en-buurtkaart-2024
- PDOK WFS Services: https://www.pdok.nl/datasets
- BAG Download: https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-2.0-extract
- Baarle-Nassau Info: https://nl.wikipedia.org/wiki/Baarle-Nassau
