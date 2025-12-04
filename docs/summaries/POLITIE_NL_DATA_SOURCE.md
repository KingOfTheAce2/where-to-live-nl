# Politie.nl Data Source Discovery

**Date:** November 8, 2025

Good news! The Politie.nl website has additional crime and police data available that we can integrate.

---

## 🔍 Discovered Data Sources

### **1. Crime Map (Misdaad in Kaart)**
**URL:** https://www.politie.nl/mijn-buurt/misdaad-in-kaart

**What it offers:**
- Location-based crime mapping
- Adjustable search radius (500m to 25km)
- Interactive crime visualization

**How to access:**
- Currently web interface only
- Requires address/location input
- No public API documented (yet)

**Integration approach:**
- Could scrape for specific addresses
- Or check if they have an undocumented API
- May be able to extract map data from network calls

---

### **2. Neighborhood Police Officers (Wijkagenten)**
**URL:** https://www.politie.nl/mijn-buurt/wijkagenten

**Example:**
```
https://www.politie.nl/mijn-buurt/wijkagenten?geoquery=Juvenaatlaan,+4874MM+Etten-Leur&distance=5.0
```

**What it offers:**
- Local police officer assignments
- Contact information
- Coverage areas

**Use case for platform:**
- Show users their local police officer
- Add credibility/trust
- Help expats know who to contact

---

### **3. Police Stations (Politiebureaus)**
**URL:** https://www.politie.nl/mijn-buurt/politiebureaus

**Example:**
```
https://www.politie.nl/mijn-buurt/politiebureaus?geoquery=Juvenaatlaan,+4874MM+Etten-Leur&distance=5.0
```

**What it offers:**
- Police station locations
- Opening hours
- Contact information
- Services available

**Use case for platform:**
- Proximity to police station (safety metric)
- Service availability
- Emergency preparedness

---

## 🔧 Integration Options

### **Option A: Web Scraping** (Easiest)
```python
import httpx
from bs4 import BeautifulSoup

def get_police_stations(address: str, distance: float = 5.0):
    url = f"https://www.politie.nl/mijn-buurt/politiebureaus"
    params = {
        "geoquery": address,
        "distance": distance
    }

    response = httpx.get(url, params=params)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Parse results...
    return stations
```

**Pros:**
- Quick to implement
- No API key needed
- Works immediately

**Cons:**
- Fragile (breaks if HTML changes)
- Slower than API
- Rate limiting concerns

---

### **Option B: Network Analysis** (Better)

Inspect browser network calls to find backend API:

1. Open Chrome DevTools
2. Go to https://www.politie.nl/mijn-buurt/misdaad-in-kaart
3. Enter an address
4. Check Network tab for API calls

**Likely patterns:**
```
https://api.politie.nl/...
https://data.politie.nl/api/...
```

**If we find an API:**
- More stable
- Faster
- Better data format (JSON)

---

### **Option C: Data.politie.nl Portal** (Best)

The site references `data.politie.nl` which appears to be a CBS Statline portal.

**Investigation needed:**
1. Check if crime data is available there
2. Look for API documentation
3. Find table IDs if using CBS OData

**This is the same CBS portal** we're already familiar with, so we can use existing code patterns.

---

## 📋 Recommended Integration Plan

### **Phase 1: Quick Win** (1-2 hours)
1. **Police Stations via Web Scraping**
   - Easiest to implement
   - Low priority data (nice-to-have)
   - Good for testing

### **Phase 2: API Discovery** (2-3 hours)
2. **Find Hidden APIs**
   - Inspect network calls
   - Document API endpoints
   - Test rate limits

### **Phase 3: Full Integration** (4-6 hours)
3. **Crime Map Data**
   - Integrate with our database
   - Create ETL scripts
   - Transform to Parquet

---

## 🎯 Value for Your Platform

### **Crime Map Data:**
- **High value** - Critical for housing decisions
- **User demand** - Expats want safety data
- **Competitive advantage** - Not on other platforms

### **Police Stations:**
- **Medium value** - Proximity to services
- **Nice-to-have** - Not decision-critical
- **Easy to add** - OSM might have this too

### **Neighborhood Officers:**
- **Low value** - Interesting but not essential
- **Community feel** - Good for brand/trust
- **Later priority** - Add after core features

---

## 🚦 Status

**Current:** Discovered

**Next Step:** API investigation

**Priority:** Medium (after WOZ, coordinates, frontend MVP)

**Assigned to:** Future task

---

## 💡 Quick Test Command

Want to test if there's an API? Try:

```bash
# Check if there's a JSON API
curl "https://www.politie.nl/mijn-buurt/politiebureaus?geoquery=Amsterdam&distance=5.0" \
  -H "Accept: application/json"

# Or inspect the page
curl "https://www.politie.nl/mijn-buurt/misdaad-in-kaart" | grep -i "api\|json\|endpoint"
```

---

## 📝 Notes for Later

- Politie.nl is government site - likely no aggressive rate limiting
- Crime data updates quarterly/monthly
- Consider caching to avoid repeated requests
- Attribute properly: "Bron: Politie Nederland"

---

**When to implement:** After you have:
1. ✅ WOZ data running
2. ✅ BAG coordinates enriched
3. ✅ Frontend MVP working
4. ⏳ Then add crime/police data

---

*Discovery date: November 8, 2025*
*Status: Potential data source identified*
