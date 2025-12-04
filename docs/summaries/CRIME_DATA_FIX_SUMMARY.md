# Crime Statistics Data Source - Fixed ✅

**Date:** January 9, 2025
**Status:** Successfully Fixed and Tested

---

## Problem

The crime statistics ingestion script (`scripts/etl/ingest/crime.py`) was failing with:
- **Error:** CBS API table `85452NED` returned 404
- **Root cause:** The API endpoint and table IDs were outdated

---

## Solution

### **New Data Source Discovered**

The crime data is now sourced from the **CBS/Politie.nl collaborative portal**:

**Primary Dashboard:**
- https://www.cbs.nl/nl-nl/visualisaties/politie/dashboard-misdrijven-in-de-buurt/jaarcijfers
- https://www.cbs.nl/nl-nl/visualisaties/politie/dashboard-misdrijven-in-de-buurt/maandcijfers

**Data Portal:**
- https://data.politie.nl/

### **Working API Endpoint**

```
Base URL: https://dataderden.cbs.nl/ODataApi/odata
```

**Available Tables:**
- `47018NED` - Neighborhood level (buurt) crime data ✅ **RECOMMENDED**
- `47022NED` - Municipality level (gemeente) crime data

---

## What Changed in the Code

### 1. **Updated API Base URL**
```python
# OLD (broken)
CBS_API_BASE = "https://opendata.cbs.nl/ODataApi/odata"

# NEW (working)
CBS_API_BASE = "https://dataderden.cbs.nl/ODataApi/odata"
```

### 2. **Updated Table IDs**
```python
DATASETS = {
    "neighborhood": "47018NED",  # Neighborhood level - RECOMMENDED
    "municipality": "47022NED",  # Municipality level
}
```

### 3. **Fixed Pagination Logic**
- Added `max_records` parameter to stop early when using `--sample`
- Reduced page size to 200 records to be respectful to the API
- API has a hard limit of 10,000 records per query

### 4. **Updated Default Year**
```python
--year default changed from "2023" to "2024"
```

---

## Available Data

### **Time Range**
- **2012 - 2024** (yearly data)
- All years have "Definitief" (final) status

### **Crime Categories** (57 types available)

**High-priority categories for your app:**

| Category Code | Description | English |
|--------------|-------------|---------|
| `0.0.0` | Totaal misdrijven | Total crimes |
| `1.1.1` | Diefstal/inbraak woning | Burglary (home) |
| `1.2.1` | Diefstal uit/vanaf motorvoertuigen | Vehicle theft |
| `1.2.3` | Diefstal van brom-, snor-, fietsen | Bike/moped theft |
| `1.2.4` | Zakkenrollerij | Pickpocketing |
| `1.4.1` | Zedenmisdrijf | Sexual offense |
| `1.4.2` | Moord, doodslag | Murder/manslaughter |
| `1.4.4` | Bedreiging | Threats |
| `1.4.5` | Mishandeling | Assault |
| `1.4.6` | Straatroof | Street robbery |
| `1.4.7` | Overval | Robbery |
| `2.2.1` | Vernieling cq. zaakbeschadiging | Vandalism |
| `3.1.1` | Drugshandel | Drug dealing |

### **Geographic Levels**

The data contains hierarchical codes:
- `NL00` - National level
- `GM****` - Municipality (gemeente)
- `WK****` - District (wijk)
- `BU****` - Neighborhood (buurt) ⭐ **MOST USEFUL**

---

## Usage Examples

### **Test with 100 samples:**
```bash
cd scripts/etl
python -m ingest.crime --sample 100 --year 2024
```

### **Download full 2024 dataset (neighborhood level):**
```bash
python -m ingest.crime --year 2024
```

### **Download municipality-level data:**
```bash
python -m ingest.crime --level municipality --year 2024
```

### **Download historical data:**
```bash
python -m ingest.crime --year 2023
python -m ingest.crime --year 2022
```

---

## Output Format

**File:** `data/raw/crime.json`

**Structure:**
```json
{
  "metadata": {
    "source": "CBS/Politie.nl",
    "table_id": "47018NED",
    "level": "neighborhood",
    "year": "2024",
    "downloaded_at": "2025-01-09T...",
    "total_records": 805327
  },
  "data": [
    {
      "ID": 12,
      "SoortMisdrijf": "0.0.0 ",
      "WijkenEnBuurten": "NL00      ",
      "Perioden": "2024JJ00",
      "GeregistreerdeMisdrijven_1": 805327,
      "Gemeentenaam_2": "",
      "SoortRegio_3": ""
    }
  ]
}
```

**Fields:**
- `SoortMisdrijf` - Crime type code
- `WijkenEnBuurten` - Geographic area code (buurt/wijk/gemeente)
- `Perioden` - Time period (e.g., "2024JJ00" for year 2024)
- `GeregistreerdeMisdrijven_1` - Number of registered crimes

---

## Data Quality

✅ **Verified working** (tested January 9, 2025)
✅ **Official government data** (CBS + Politie.nl collaboration)
✅ **Free and open** (no API key required)
✅ **Updated annually** (2024 data available)
✅ **Comprehensive** (all neighborhoods in Netherlands)

---

## Next Steps

### **For Your App:**

1. **Download crime data for all years (2022-2024)**
   ```bash
   python -m ingest.crime --year 2024
   python -m ingest.crime --year 2023
   python -m ingest.crime --year 2022
   ```

2. **Transform to Parquet**
   - Create `scripts/etl/transform/crime_to_parquet.py` (already exists)
   - Join with neighborhood boundary data (CBS WijkenEnBuurten)

3. **Calculate Safety Scores**
   - Per neighborhood: crimes per 1,000 residents
   - Compare to national average
   - Create 0-10 safety score
   - Show 3-year trends

4. **Integrate with Frontend**
   - Display crime heatmap on map
   - Show crime breakdown by type
   - Add "Safety" card in property detail view
   - Filter by crime severity

---

## Attribution Required

```
Data source: Statistics Netherlands (CBS) & Politie.nl
License: Open Data
URL: https://data.politie.nl/
```

---

## Related Links

- **CBS Crime Dashboard:** https://www.cbs.nl/nl-nl/visualisaties/politie/dashboard-misdrijven-in-de-buurt
- **Politie.nl Data Portal:** https://data.politie.nl/
- **API Documentation:** https://dataderden.cbs.nl/ODataApi/odata/47018NED
- **Crime Type Definitions:** https://www.politie.nl/algemeen/dataportaal/dataportaal-definities.html

---

**Updated by:** Claude Code
**Last tested:** January 9, 2025
**Status:** ✅ Production Ready
