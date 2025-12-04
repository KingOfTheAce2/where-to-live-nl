# Fixing Failed Data Sources - Summary

**Date:** November 8, 2025

This document summarizes the investigation into failed data sources and recommended solutions.

---

## ✅ **Fixed Issues**

### **1. Parks OSM Query** ✅ FIXED
**Problem:** Only 68 parks found (too restrictive query)

**Solution:** Expanded query to include:
- Regular parks (`leisure=park`)
- Gardens (`leisure=garden`)
- Recreation grounds (`landuse=recreation_ground`)
- Village greens (`landuse=village_green`)
- Nature reserves (`leisure=nature_reserve`)
- Relations (for large areas)

**Status:** Updated script, testing now

**File:** `scripts/etl/ingest/amenities_osm.py`

---

## ⚠️ **Complex CBS API Issues**

### **2. Crime Statistics**
**Problem:** CBS table IDs outdated + 10,000 record limit

**Current Status:**
- Found new table IDs:
  - `83648NED` - Regional crime data (2023-2024)
  - `47013NED` - Municipality level
  - `47018NED` - Neighborhood level

**Issue:** CBS API rejects queries returning >10,000 records

**Solutions (Pick One):**

#### Option A: Use CBS Bulk Download (Recommended)
- Download entire table as CSV
- Parse and transform locally
- **Pros:** Gets all data, no pagination needed
- **Cons:** Larger file, need CSV parsing

#### Option B: Implement Pagination
- Modify script to page through results
- Query in chunks by region/year
- **Pros:** Keeps using OData API
- **Cons:** Complex, slower, many requests

#### Option C: Use Pre-aggregated Data
- Download summary statistics only
- Less granular but faster
- **Pros:** Simple, smaller dataset
- **Cons:** Less detailed

**Recommendation:** Use **Option A** (bulk CSV download)

---

### **3. Demographics (CBS)**
**Problem:** Same as crime - query too broad

**Solutions:** Same three options as crime statistics

**Recommendation:** Use **Option A** (bulk CSV download)

**Alternative:** Query by province to stay under 10,000 limit

---

## ❌ **Sources That Need Different Approaches**

### **4. Livability (Leefbaarometer)**
**Problem:** WFS API returns 400 Bad Request

**Investigation Needed:**
1. Check if API endpoint changed
2. Try different WFS version (1.0.0 vs 2.0.0)
3. Check Leefbaarometer website for new API docs

**Current URL:** `https://geo.leefbaarometer.nl/lbm3/ows`

**Next Steps:**
```bash
# Test WFS endpoint
curl "https://geo.leefbaarometer.nl/lbm3/ows?service=WFS&version=2.0.0&request=GetCapabilities"
```

---

### **5. NS Train Stations**
**Problem:** GTFS feed URL not found (404)

**Old URL:** `https://gtfs.ovapi.nl/nl/stops.txt`

**Alternative Sources:**
1. **NS API** - Requires API key
   - https://apiportal.ns.nl/

2. **OpenStreetMap** - Free, no API key
   - Query: `railway=station` + `operator=NS`

3. **TransitFeeds** - Community GTFS feeds
   - https://transitfeeds.com/

**Recommendation:** Use **OpenStreetMap** for simplicity

**OSM Query:**
```overpass
[out:json];
area["ISO3166-1"="NL"];
(
  node["railway"="station"]["operator"~"NS|Nederlandse Spoorwegen"](area);
  way["railway"="station"]["operator"~"NS|Nederlandse Spoorwegen"](area);
);
out center;
```

---

### **6. Schools Data Quality**
**Problem:** Only 298 schools, many fields null

**Root Cause:** DUO (education ministry) data source may have changed format

**Solutions:**

#### Option A: Use OpenStreetMap
```overpass
[out:json];
area["ISO3166-1"="NL"];
(
  node["amenity"="school"](area);
  way["amenity"="school"](area);
);
out center;
```

#### Option B: Fix DUO API parsing
- Check current DUO data format
- Update field mappings

**Recommendation:** Try **OSM first** (faster), then fix DUO if needed

---

### **7. International Schools**
**Problem:** OSM query returned 0 results

**Root Cause:** Tag `school:type=international` rarely used in NL

**Solutions:**

#### Option A: Manual Curated List
Create JSON file with known international schools:
- ISA Amsterdam
- British School of Amsterdam
- American School of The Hague
- International School of Utrecht
- etc.

#### Option B: Better OSM Query
Search by name pattern:
```overpass
[out:json];
area["ISO3166-1"="NL"];
(
  node["amenity"="school"]["name"~"International"](area);
  way["amenity"="school"]["name"~"International"](area);
  node["amenity"="school"]["school:language"="en"](area);
);
out center;
```

**Recommendation:** **Combination** - manual list + OSM verification

---

## 📊 Priority Assessment

| Issue | Importance | Difficulty | Time to Fix | Recommendation |
|-------|------------|------------|-------------|----------------|
| Parks | Medium | Easy | ✅ Done | Fixed! |
| Crime | High | Medium | 2-4 hours | CBS bulk download |
| Demographics | High | Medium | 2-4 hours | CBS bulk download |
| Livability | Critical | Medium | 1-2 hours | Test new API |
| NS Stations | Medium | Easy | 30 min | Use OSM |
| Schools | High | Easy | 1 hour | Use OSM |
| Intl Schools | Low | Easy | 30 min | Manual list |

---

## 🎯 Recommended Action Plan

### **Phase 1: Quick Wins** (2-3 hours)

1. ✅ **Parks** - Already fixed, testing
2. **NS Stations** - Switch to OSM query (30 min)
3. **Schools** - Use OSM amenity=school (1 hour)
4. **International Schools** - Create manual list (30 min)

### **Phase 2: Medium Complexity** (4-6 hours)

5. **Livability** - Investigate WFS API changes (2 hours)
6. **Crime** - Implement CBS bulk CSV download (2 hours)
7. **Demographics** - Implement CBS bulk CSV download (2 hours)

---

## 💡 General Lessons Learned

1. **Government APIs change frequently** - Table IDs become outdated
2. **CBS has strict limits** - Need bulk download for large datasets
3. **OSM is more reliable** - Consistent API, good coverage
4. **Fallback strategies important** - Always have Plan B

---

## 🛠️ Scripts That Need Updates

### **High Priority:**
```
scripts/etl/ingest/crime.py           - Add CSV bulk download
scripts/etl/ingest/cbs_demographics.py - Add CSV bulk download
scripts/etl/ingest/leefbaarometer.py  - Fix WFS endpoint
```

### **Medium Priority:**
```
scripts/etl/ingest/ns_stations.py     - Switch to OSM
scripts/etl/ingest/schools.py         - Add OSM fallback
```

### **Low Priority:**
```
Create: international_schools.json     - Manual curated list
```

---

## 🚀 Next Steps

**While WOZ and BAG coordinate enrichment run, you could:**

1. **Quick OSM fixes** (2 hours total):
   - Add NS stations OSM query
   - Add schools OSM query
   - Create international schools list

2. **OR wait for CBS bulk download implementation** (later)

3. **OR run what's working and move to frontend development**

---

**Recommendation:** Focus on **Quick OSM fixes** since:
- ✅ Fast to implement (2-3 hours)
- ✅ No API key needed
- ✅ Reliable data source
- ✅ Can run while WOZ continues

CBS data (crime, demographics) can wait until you need it for analysis features.

---

*Last updated: November 8, 2025*
