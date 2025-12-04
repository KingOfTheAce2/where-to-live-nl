# Energy Label (Energielabel) Data Collection Guide

## Overview

Energy labels (A++++ to G) for **ALL buildings in the Netherlands** are available for FREE from EP-Online, the official government database managed by RVO.

## Quick Start

### Option 1: With API Key (Recommended)

#### Step 1: Get Free API Key
1. Go to https://epbdwebservices.rvo.nl/
2. Request API key (instant, free, no registration needed)
3. Save API key

#### Step 2: Set Environment Variable
```bash
# Windows
set EP_ONLINE_API_KEY=your_api_key_here

# Linux/Mac
export EP_ONLINE_API_KEY=your_api_key_here
```

#### Step 3: Run Scraper
```bash
cd scripts/etl
python -m ingest.energielabel
```

**Result**:
- Downloads all energy labels in Netherlands (~2-3 million records)
- Saves to `data/raw/energielabels_raw.csv`
- Converts to `data/processed/energielabels.parquet` (~50-100 MB)
- Takes ~5-10 minutes

### Option 2: Manual Download (No API Key)

#### Step 1: Download File Manually
1. Go to https://public.ep-online.nl/api/v5/Mutatiebestand/Download
2. Save file as `data/raw/energielabels_raw.csv`

#### Step 2: Convert to Parquet
```python
from pathlib import Path
import polars as pl

csv_path = Path("data/raw/energielabels_raw.csv")
df = pl.read_csv(csv_path, separator=';', encoding='utf-8')

# Rename columns
df = df.rename({
    "Pand_bagverblijfsobjectid": "bag_id",
    "Postcode": "postal_code",
    "Huisnummer": "house_number",
    "Energielabel": "energy_label"
})

# Save to Parquet
df.write_parquet("data/processed/energielabels.parquet", compression="snappy")
```

## Data Format

### CSV Columns (EP-Online)
- `Pand_bagverblijfsobjectid` - BAG ID of the building
- `Postcode` - Postal code (e.g., "1011AB")
- `Huisnummer` - House number
- `Huisnummer_toev` - House number suffix (if any)
- `Gebouwklasse` - Building type (woning, utiliteit, etc.)
- `Energielabel` - Energy label (A++++ to G)
- `Registratiedatum` - Registration date
- `Energieindex` - Energy index (numeric value)
- `Geldig_tot` - Valid until date

### Parquet Schema (Our Format)
```python
{
    "bag_id": str,              # BAG verblijfsobject ID
    "postal_code": str,         # Clean postal code (no spaces)
    "house_number": int,        # House number
    "house_number_suffix": str, # Suffix (e.g., "A", "bis")
    "energy_label": str,        # A++++, A+++, A++, A+, A, B, C, D, E, F, G
    "energy_label_numeric": int,# 1-11 for sorting (1=best, 11=worst)
    "building_type": str,       # woning, appartement, utiliteit
    "registration_date": str,   # ISO date
    "energy_index": float,      # Numeric energy index
    "valid_until": str          # ISO date or null
}
```

## Usage in Application

### Backend: Lookup by Postal Code
```python
# backend/api_server.py
import polars as pl

ENERGIELABEL_DATA = PROCESSED_DIR / "energielabels.parquet"

@app.get("/api/energielabel/{postal_code}/{house_number}")
def get_energy_label(postal_code: str, house_number: int, suffix: str = ""):
    """Get energy label for a property"""

    df = pl.read_parquet(ENERGIELABEL_DATA)

    postal_code = postal_code.replace(" ", "").upper()

    result = df.filter(
        (pl.col("postal_code") == postal_code) &
        (pl.col("house_number") == house_number) &
        (pl.col("house_number_suffix") == suffix)
    )

    if result.height == 0:
        return {
            "success": False,
            "message": "No energy label found",
            "label": None
        }

    record = result.to_dicts()[0]

    return {
        "success": True,
        "label": record["energy_label"],
        "label_numeric": record["energy_label_numeric"],
        "registration_date": record["registration_date"],
        "energy_index": record["energy_index"],
        "building_type": record["building_type"]
    }
```

### Frontend: Display Energy Label
```typescript
// Show energy label with color coding
const labelColors = {
  "A++++": "bg-green-700 text-white",
  "A+++": "bg-green-600 text-white",
  "A++": "bg-green-500 text-white",
  "A+": "bg-green-400 text-white",
  "A": "bg-lime-500 text-white",
  "B": "bg-yellow-400 text-gray-900",
  "C": "bg-orange-400 text-white",
  "D": "bg-orange-500 text-white",
  "E": "bg-red-400 text-white",
  "F": "bg-red-500 text-white",
  "G": "bg-red-700 text-white"
};

<div className={`px-3 py-1 rounded font-bold ${labelColors[label]}`}>
  {label}
</div>
```

## Energy Label Explained (for Expats)

### What is an Energy Label?
The energy label (energielabel) indicates how energy-efficient a building is:
- **A++++**: Most efficient (lowest energy costs)
- **G**: Least efficient (highest energy costs)

### Why It Matters
- **Energy costs**: Label G can cost €2,000-3,000/year, Label A only €500-800/year
- **Comfort**: Better labels = better insulation, warmer in winter
- **Rental law**: Landlords MUST improve properties worse than Label C by 2028
- **Resale value**: Better labels fetch higher prices

### Label Distribution (Netherlands 2024)
```
A++++ - A+:  ~10%  (new construction, renovated)
A - B:       ~25%  (good insulation)
C - D:       ~40%  (average, most common)
E - F:       ~20%  (poor, needs renovation)
G:           ~5%   (very poor, expensive to heat)
```

### Energy Index vs Label
- **Energy Index**: Numeric value (0-9.99)
  - Lower = better
  - 0.0-1.2 = A++++
  - 1.2-1.4 = A+++
  - etc.
- **Energy Label**: Letter grade (easier to understand)

## Data Updates

EP-Online publishes new total files on the **1st of each month**.

### Automated Monthly Update
```bash
# Add to cron (Linux) or Task Scheduler (Windows)
# Run on 2nd of each month
0 2 2 * * cd /path/to/project && python -m ingest.energielabel
```

### Manual Update
```bash
# Re-run scraper anytime
python -m ingest.energielabel
```

## Coverage

### How Many Buildings Have Labels?
- **Total Dutch buildings**: ~8 million
- **With energy labels**: ~3 million (37.5%)
- **Missing labels**: ~5 million (62.5%)

### Why Missing?
- Not required for buildings built before 1992
- Not required if never sold/rented since 2008
- Some owners haven't registered yet

### What to Show When Missing?
```python
if not energy_label:
    return {
        "label": None,
        "message": "No energy label registered",
        "note": "Buildings built before 1992 or not sold/rented since 2008 may not have a label",
        "estimate": estimate_from_build_year(build_year)  # Optional
    }
```

## Legal Notes

### Data License
- **Source**: RVO (Dutch government)
- **License**: Public domain (CC0)
- **Attribution**: "Energy labels from EP-Online (RVO)"
- **Commercial use**: Allowed
- **Redistribution**: Allowed

### Privacy
- Energy labels are **public information**
- No personal data (owner names not included)
- Safe to cache and display

## Troubleshooting

### API Key Not Working
- Check you requested from: https://epbdwebservices.rvo.nl/
- Key format: Usually alphanumeric string
- Key expires after 1 year of inactivity

### Download Fails
- Try manual download: https://public.ep-online.nl/api/v5/Mutatiebestand/Download
- File is large (~200-300 MB), may take 2-5 minutes
- Check internet connection

### CSV Parse Errors
- EP-Online uses semicolon (;) separator
- Encoding is UTF-8
- Some fields may have quotes

### Missing Data for Address
- Not all buildings have energy labels
- Only ~37% of Dutch buildings have registered labels
- Show "No label registered" message

## Integration Checklist

- [ ] Get EP-Online API key
- [ ] Run scraper to download data
- [ ] Verify Parquet file created
- [ ] Add backend endpoint for label lookup
- [ ] Integrate into snapshot API
- [ ] Add frontend UI component
- [ ] Test with known addresses
- [ ] Set up monthly auto-update

## Example Addresses to Test

```python
# Amsterdam
postal_code="1011AB", house_number=1  # Should have label

# Rotterdam
postal_code="3011AA", house_number=1  # Should have label

# Utrecht
postal_code="3511AB", house_number=1  # Should have label
```

## Summary

- ✅ **Free**: No cost, official government data
- ✅ **Complete**: All registered energy labels in NL
- ✅ **Easy**: One command to download everything
- ✅ **Legal**: Public domain, safe to use
- ✅ **Updated**: Monthly updates available
- ✅ **Size**: ~50-100 MB Parquet file
- ✅ **Fast**: Polars makes queries instant

**Run the scraper now to get all energy labels!**

```bash
python -m ingest.energielabel
```
