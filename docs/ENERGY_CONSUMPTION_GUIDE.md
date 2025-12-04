# Energy Consumption (Energieverbruik) Data Guide

## Overview

This guide covers the integration of comprehensive energy consumption data from CBS (Statistics Netherlands) into the Where to Live NL platform.

**Purpose**: Provide users with real energy consumption data for neighborhoods, helping them estimate utility costs and compare energy efficiency across different areas.

---

## Data Sources

### CBS OpenData Datasets

We integrate 3 comprehensive energy consumption datasets from CBS:

#### 1. Dataset 85140NED: Energy Consumption by Type, Surface Area, Construction Year
- **Name**: Energieverbruik woningen - woningtype, oppervlakte, bouwjaar en bewoning
- **API**: https://opendata.cbs.nl/ODataApi/odata/85140NED
- **Description**: Detailed energy consumption broken down by:
  - Dwelling type (detached, semi-detached, terraced, apartments)
  - Surface area classes
  - Construction year (bouwjaarklasse)
  - Number of residents
  - Heating system type
  - Solar panel installation
- **Coverage**: 2019-2024 (annual updates)
- **Update Frequency**: Annually (Q3 of following year)
- **Records**: ~120,000 records

**What it includes**:
- Average gas consumption (m³/year)
- Average electricity delivery (kWh/year)
- Net electricity consumption (accounting for solar panel feed-in)
- Distribution percentiles (10th, 25th, 50th, 75th, 90th)

#### 2. Dataset 81528NED: Energy Consumption by Region
- **Name**: Energieverbruik particuliere woningen - woningtype en regio's
- **API**: https://opendata.cbs.nl/ODataApi/odata/81528NED
- **Description**: Regional energy consumption across:
  - National level (Netherlands)
  - Landsdelen (regional divisions)
  - Provinces
  - Municipalities
- **Coverage**: 2010-2024
- **Update Frequency**: Annually (Q3)
- **Records**: ~8,000 records

**What it includes**:
- Average gas consumption per dwelling
- Average electricity consumption per dwelling
- Trends over 14 years
- Segmented by dwelling type and ownership

#### 3. Dataset 86159NED: Energy Consumption by Neighborhood 2024
- **Name**: Energieverbruik particuliere woningen - wijken en buurten 2024
- **API**: https://opendata.cbs.nl/ODataApi/odata/86159NED
- **Description**: Hyperlocal neighborhood-level energy data:
  - 18,310 neighborhoods (buurten)
  - Districts (wijken)
  - Municipalities
  - National totals
- **Coverage**: 2024 (preliminary data)
- **Update Frequency**: Next update Q3 2026
- **Records**: ~70,000 records

**What it includes**:
- Average gas consumption per neighborhood
- Average electricity consumption per neighborhood
- District heating percentage
- Dwelling type breakdown

---

## Data Format

### CBS API Response Example (Dataset 86159NED)

```json
{
  "ID": 123,
  "Woningkenmerken": "T001100",
  "WijkenEnBuurten": "BU03630000",
  "Gemeentenaam_1": "Amsterdam",
  "SoortRegio_2": "Buurt",
  "Codering_3": "BU03630000",
  "GemiddeldAardgasverbruik_4": 800,
  "GemiddeldeElektriciteitslevering_5": 2550,
  "GemiddeldeNettoElektriciteitslevering_6": 1870,
  "Stadsverwarming_7": 15.0,
  "IndelingswijzigingWijkenEnBuurten_8": null
}
```

**Field Mapping**:
- `GemiddeldAardgasverbruik_4`: Average gas consumption (m³/year)
- `GemiddeldeElektriciteitslevering_5`: Average electricity delivery (kWh/year)
- `GemiddeldeNettoElektriciteitslevering_6`: Average net electricity (kWh/year, after solar)
- `Stadsverwarming_7`: District heating percentage (%)
- `WijkenEnBuurten`: Neighborhood code (e.g., "BU03630000")

### Our Processed Format (Parquet)

```python
{
    "neighborhood_code": "BU03630000",
    "neighborhood_name": "Centrum-Oost",
    "municipality": "Amsterdam",
    "region_type": "Buurt",  # Neighborhood
    "avg_gas_consumption_m3": 800,
    "avg_electricity_delivery_kwh": 2550,
    "avg_net_electricity_kwh": 1870,
    "district_heating_percentage": 15.0,
    "year": 2024
}
```

---

## Integration Steps

### Step 1: Fetch Data from CBS

```bash
cd scripts/etl
python -m ingest.energieverbruik
```

**What this does**:
1. Fetches all 3 datasets from CBS OpenData API
2. Saves raw JSON samples to `data/raw/energieverbruik_*.json`
3. Converts to Parquet format in `data/processed/energieverbruik_*.parquet`
4. Total time: ~5-10 minutes
5. Total size: ~10-20 MB compressed

### Step 2: Backend API Integration

Add energy consumption lookup to the snapshot API:

```python
# backend/api_server.py

import polars as pl
from pathlib import Path

ENERGY_CONSUMPTION_DATA = PROCESSED_DIR / "energieverbruik_86159NED.parquet"

@app.get("/api/energy-consumption/{neighborhood_code}")
def get_energy_consumption(neighborhood_code: str):
    """
    Get energy consumption data for a neighborhood.

    Args:
        neighborhood_code: CBS neighborhood code (e.g., "BU03630000")

    Returns:
        Energy consumption statistics
    """

    if not ENERGY_CONSUMPTION_DATA.exists():
        return {"success": False, "message": "Energy consumption data not available"}

    df = pl.read_parquet(ENERGY_CONSUMPTION_DATA)

    # Filter by neighborhood code
    result = df.filter(pl.col("WijkenEnBuurten").str.strip() == neighborhood_code)

    if result.height == 0:
        return {"success": False, "message": "No data for this neighborhood"}

    record = result.to_dicts()[0]

    return {
        "success": True,
        "neighborhood_code": record["WijkenEnBuurten"].strip(),
        "municipality": record["Gemeentenaam_1"].strip(),
        "region_type": record["SoortRegio_2"].strip(),
        "avg_gas_consumption_m3": record.get("GemiddeldAardgasverbruik_4"),
        "avg_electricity_delivery_kwh": record.get("GemiddeldeElektriciteitslevering_5"),
        "avg_net_electricity_kwh": record.get("GemiddeldeNettoElektriciteitslevering_6"),
        "district_heating_percentage": record.get("Stadsverwarming_7"),
        "year": 2024
    }
```

### Step 3: Integrate into Snapshot API

```python
# Add to /api/snapshot endpoint

snapshot = {
    "woz": woz_data,
    "crime": crime_data,
    "livability": livability_data,
    "demographics": demographics_data,
    "energy_consumption": get_energy_consumption(neighborhood_code)  # NEW
}
```

### Step 4: Frontend Display

```typescript
// frontend/src/app/page.tsx

{snapshot?.energy_consumption && snapshot.energy_consumption.success && (
  <div className="bg-white p-4 rounded-lg shadow">
    <h3 className="font-bold text-lg mb-2">
      ⚡ Average Energy Consumption
    </h3>

    <div className="space-y-2">
      {/* Gas Consumption */}
      <div>
        <span className="text-sm text-gray-600">Gas:</span>
        <span className="font-semibold ml-2">
          {snapshot.energy_consumption.avg_gas_consumption_m3 || 'N/A'} m³/year
        </span>
        {snapshot.energy_consumption.avg_gas_consumption_m3 && (
          <span className="text-xs text-gray-500 ml-2">
            (~€{Math.round(snapshot.energy_consumption.avg_gas_consumption_m3 * 1.5)}/year at €1.50/m³)
          </span>
        )}
      </div>

      {/* Electricity Consumption */}
      <div>
        <span className="text-sm text-gray-600">Electricity:</span>
        <span className="font-semibold ml-2">
          {snapshot.energy_consumption.avg_electricity_delivery_kwh || 'N/A'} kWh/year
        </span>
        {snapshot.energy_consumption.avg_electricity_delivery_kwh && (
          <span className="text-xs text-gray-500 ml-2">
            (~€{Math.round(snapshot.energy_consumption.avg_electricity_delivery_kwh * 0.40)}/year at €0.40/kWh)
          </span>
        )}
      </div>

      {/* Net Electricity (after solar) */}
      {snapshot.energy_consumption.avg_net_electricity_kwh !== snapshot.energy_consumption.avg_electricity_delivery_kwh && (
        <div>
          <span className="text-sm text-gray-600">Net electricity (after solar):</span>
          <span className="font-semibold ml-2">
            {snapshot.energy_consumption.avg_net_electricity_kwh} kWh/year
          </span>
        </div>
      )}

      {/* District Heating */}
      {snapshot.energy_consumption.district_heating_percentage && (
        <div className="text-xs text-gray-500">
          {snapshot.energy_consumption.district_heating_percentage}% of homes use district heating
        </div>
      )}

      {/* Total Estimated Cost */}
      <div className="pt-2 border-t">
        <span className="text-sm text-gray-600">Estimated total energy cost:</span>
        <span className="font-bold text-lg ml-2 text-green-600">
          €{Math.round(
            (snapshot.energy_consumption.avg_gas_consumption_m3 || 0) * 1.5 +
            (snapshot.energy_consumption.avg_electricity_delivery_kwh || 0) * 0.40
          )}/year
        </span>
      </div>
    </div>

    <details className="mt-2 text-xs text-gray-500">
      <summary className="cursor-pointer">What does this mean?</summary>
      <p className="mt-2">
        These are average energy consumption figures for this neighborhood based on CBS data.
        Actual consumption varies by:
        - Home size and insulation
        - Number of residents
        - Heating system type
        - Presence of solar panels
        - Personal usage habits
      </p>
      <p className="mt-1">
        <strong>Cost estimates</strong> are based on 2024 average energy prices:
        - Gas: €1.50/m³
        - Electricity: €0.40/kWh
      </p>
    </details>
  </div>
)}
```

---

## Understanding Energy Consumption in the Netherlands

### Average Energy Consumption (2024)

**National Averages**:
- Gas: 800 m³/year (~€1,200/year)
- Electricity: 2,550 kWh/year (~€1,020/year)
- **Total: ~€2,220/year**

### By Dwelling Type

| Dwelling Type | Gas (m³) | Electricity (kWh) | Est. Cost/Year |
|--------------|----------|-------------------|----------------|
| Detached house | 1,400 | 3,500 | €3,500 |
| Semi-detached | 1,100 | 2,900 | €2,810 |
| Terraced house | 950 | 2,600 | €2,465 |
| Apartment | 600 | 2,000 | €1,700 |

### By Construction Year

| Construction Year | Gas (m³) | Electricity (kWh) | Notes |
|------------------|----------|-------------------|-------|
| Before 1965 | 1,200 | 2,400 | Poor insulation |
| 1965-1974 | 1,100 | 2,500 | Moderate insulation |
| 1975-1991 | 1,000 | 2,600 | Better insulation |
| 1992-2005 | 850 | 2,700 | Good insulation |
| 2006-2014 | 700 | 2,800 | Very good insulation |
| After 2015 | 500 | 2,900 | Excellent insulation, often has solar |

### Solar Panels Impact

Buildings with solar panels:
- Electricity delivery: 3,200 kWh/year
- Net consumption: 1,600 kWh/year
- **Savings: ~€640/year**

### District Heating (Stadsverwarming)

Neighborhoods with district heating:
- No gas connection needed
- Fixed heating costs via district heating
- Typically found in: Amsterdam, Rotterdam, Utrecht city centers
- Average cost: €1,000-1,500/year (varies by provider)

---

## For Expats: Energy Costs Explained

### Monthly Energy Bills

Average Dutch household energy costs (2024):

```
Gas:          ~€100/month (winter), €20/month (summer)
Electricity:  ~€85/month year-round
Total:        ~€105-185/month (~€1,500-2,200/year)
```

### How to Reduce Energy Costs

1. **Choose efficient neighborhoods**: Look for areas with lower average consumption
2. **Newer buildings = lower costs**: Post-2015 homes use 40% less energy
3. **Solar panels**: Reduces electricity costs by ~€600/year
4. **District heating**: Often cheaper than individual gas heating in city centers
5. **Energy label**: Label A homes cost ~€1,000/year less than Label G

### Energy Contract Types

**Variable (Variabel)**:
- Price changes with market
- Risk: prices can spike
- Benefit: can drop when market is cheap

**Fixed (Vast)**:
- Price locked for 1-3 years
- Risk: miss out if prices drop
- Benefit: predictable monthly costs

**Recommendation**: Compare at https://www.gaslicht.com or https://www.energievergelijk.nl

---

## Technical Details

### CBS API Limitations

1. **10,000 record limit per query**: Must use `$skip` and `$top` pagination
2. **Rate limiting**: Be respectful, max ~10 requests/second
3. **No authentication needed**: Public API
4. **CORS enabled**: Can be called from frontend (but prefer backend caching)

### Data Updates

- **Frequency**: Annually in Q3 (September)
- **Latest data**: 2024 (preliminary)
- **Historical data**: Available back to 2010
- **Re-fetch strategy**: Run scraper once per year after Q3

### Storage

```
data/raw/energieverbruik_85140NED_raw.json    (~2 MB, sample)
data/raw/energieverbruik_81528NED_raw.json    (~1 MB, sample)
data/raw/energieverbruik_86159NED_raw.json    (~2 MB, sample)

data/processed/energieverbruik_85140NED.parquet  (~5 MB)
data/processed/energieverbruik_81528NED.parquet  (~1 MB)
data/processed/energieverbruik_86159NED.parquet  (~3 MB)

Total: ~14 MB
```

### Performance

```python
# Fast parquet queries with Polars
df = pl.read_parquet("energieverbruik_86159NED.parquet")

# Lookup by neighborhood code: <1ms
result = df.filter(pl.col("WijkenEnBuurten") == "BU03630000")

# Compare multiple neighborhoods: <5ms
results = df.filter(pl.col("WijkenEnBuurten").is_in(neighborhood_codes))

# National statistics: <10ms
national_avg = df.filter(pl.col("SoortRegio_2") == "Land")
```

---

## User Value Proposition

### Why Energy Consumption Data Matters

For expats choosing where to live in NL, energy consumption data helps:

1. **Budget Planning**: Know real energy costs before moving in
2. **Neighborhood Comparison**: Compare running costs between areas
3. **Climate Awareness**: Identify energy-efficient neighborhoods
4. **Long-term Savings**: Choose areas with lower consumption = lower bills
5. **Environmental Impact**: Understand your carbon footprint

### Example User Story

**Sarah, moving from UK to Amsterdam**:

1. Searches "1011AB 1" (Amsterdam Centrum)
2. Sees: Avg gas 600 m³, electricity 2,200 kWh
3. Estimate: €1,780/year energy costs
4. Compares with "1097 GD" (Amsterdam Oost)
5. Sees: Avg gas 850 m³, electricity 2,400 kWh
6. Estimate: €2,235/year energy costs
7. **Decision**: Centrum is €455/year cheaper for energy!

---

## License & Attribution

- **Data Source**: CBS (Statistics Netherlands)
- **License**: CC0 (Public Domain)
- **Attribution**: "Energy consumption data from CBS OpenData"
- **Commercial Use**: Allowed
- **Redistribution**: Allowed

---

## Troubleshooting

### Data Fetch Fails

```bash
# Check internet connection
curl -I https://opendata.cbs.nl

# Test API manually
curl "https://opendata.cbs.nl/ODataApi/odata/86159NED/TypedDataSet?\$top=5"

# Check Python dependencies
pip install requests polars
```

### No Data for Neighborhood

- Not all neighborhoods have 2024 data yet (preliminary)
- Some very small neighborhoods may be excluded for privacy
- Fall back to municipality or district level data

### Incorrect Cost Estimates

Energy prices are hardcoded estimates:
- Update `GAS_PRICE_PER_M3` and `ELECTRICITY_PRICE_PER_KWH` in config
- Current defaults: €1.50/m³ gas, €0.40/kWh electricity
- These reflect 2024 average contracted rates

---

## Summary

**Energy consumption data integration provides**:
- ✅ Real neighborhood-level energy usage data
- ✅ Cost estimates for budget planning
- ✅ Comparison across 18,310 Dutch neighborhoods
- ✅ Historical trends 2010-2024
- ✅ Free, official CBS data
- ✅ Annual updates available

**Implementation time**: 2-3 hours
**User value**: High (helps with budgeting and decision-making)
**Data quality**: Official government statistics, highly reliable

---

*Last updated: 2025-11-12*
