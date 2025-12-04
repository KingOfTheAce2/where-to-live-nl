# WOZ Historical Data Retrieval

> **How to fetch and store WOZ values from 2014 to present**

---

## 🎉 What Changed

The WOZ scraper has been **completely rewritten** to use the official WOZ-waardeloket API instead of HTML scraping. This provides:

✅ **All historical data** - WOZ values from 2014-01-01 to present
✅ **Single API call** - No need to query each year separately
✅ **More reliable** - Uses official API instead of fragile HTML parsing
✅ **Better rate limiting** - Respects the 1 req/sec limit for each API call

---

## 📊 Data Structure

### Old Structure (Single Value)
```json
{
  "postal_code": "1012AB",
  "house_number": 1,
  "woz_value": 450000,
  "valuation_date": "2025-01-01",
  "scraped_at": "2025-11-04T12:00:00"
}
```

### New Structure (Historical Values)
```json
{
  "postal_code": "1012AB",
  "house_number": 1,
  "house_letter": "",
  "nummeraanduiding_id": "0363200000406080",
  "valuations": [
    {"valuation_date": "2014-01-01", "woz_value": 350000},
    {"valuation_date": "2015-01-01", "woz_value": 365000},
    {"valuation_date": "2016-01-01", "woz_value": 380000},
    {"valuation_date": "2017-01-01", "woz_value": 395000},
    {"valuation_date": "2018-01-01", "woz_value": 410000},
    {"valuation_date": "2019-01-01", "woz_value": 425000},
    {"valuation_date": "2020-01-01", "woz_value": 435000},
    {"valuation_date": "2021-01-01", "woz_value": 450000},
    {"valuation_date": "2022-01-01", "woz_value": 475000},
    {"valuation_date": "2023-01-01", "woz_value": 500000},
    {"valuation_date": "2024-01-01", "woz_value": 520000},
    {"valuation_date": "2025-01-01", "woz_value": 545000}
  ],
  "scraped_at": "2025-11-04T12:00:00"
}
```

---

## 🔄 API Workflow

The new scraper uses a 3-step process:

### Step 1: Address Suggestion
```
GET https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=1012AB 1
```
Returns: Address ID

### Step 2: Address Lookup
```
GET https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id={address_id}
```
Returns: `nummeraanduiding_id`

### Step 3: WOZ Values
```
GET https://www.wozwaardeloket.nl/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/{nummeraanduiding_id}
```
Returns: `wozObject` + `wozWaarden` array with all historical values

---

## 📦 Parquet Output Format

The transformation script flattens historical data into **wide format** for efficient querying:

| postal_code | house_number | woz_2014 | woz_2015 | woz_2016 | ... | woz_2025 |
|-------------|--------------|----------|----------|----------|-----|----------|
| 1012AB      | 1            | 350000   | 365000   | 380000   | ... | 545000   |
| 1012AB      | 2            | 320000   | 335000   | 350000   | ... | 510000   |

This format allows for:
- ✅ Easy year-over-year comparisons
- ✅ Trend analysis
- ✅ Efficient Parquet compression (columnar storage)
- ✅ Simple SQL queries (SELECT woz_2024 - woz_2014 AS growth)

---

## 🚀 Usage

### Install Dependencies First
```bash
cd scripts/etl
pip install -r requirements.txt
```

### Test with Single Address
```bash
cd scripts/etl
python test_woz_historical.py
```

Expected output:
```
=== Testing Historical WOZ Data Retrieval ===
Test address: 1012NP 1

✓ WOZ data retrieved successfully!

Nummeraanduiding ID: 0363200000406080
Scraped at: 2025-11-04T12:00:00

📊 Found 12 historical valuations:

Year    WOZ Value
-------------------------
2014    € 350,000
2015    € 365,000
2016    € 380,000
...
2025    € 545,000

📈 Growth from 2014 to 2025: +55.7%
```

### Scrape WOZ for Sample Addresses
```bash
# Make sure you're in the scripts/etl directory
cd scripts/etl

# Test with 10 addresses (requires BAG data first!)
python -m ingest.woz --sample 10

# Check output
type ..\..\data\raw\woz.json
```

### Transform to Parquet
```bash
# Still in scripts/etl directory
python -m transform.woz_to_parquet
```

---

## ⚠️ Rate Limiting

**IMPORTANT**: The WOZ-waardeloket has query limits:

- **Default**: 1 request/second (configurable via `--rate-limit`)
- **Each address** requires 3 API calls (suggest + lookup + WOZ)
- **Effective rate**: ~0.33 addresses/second = ~1,200 addresses/hour

### Time Estimates

| Dataset Size | Estimated Time |
|--------------|----------------|
| 100 addresses | ~5 minutes |
| 1,000 addresses | ~50 minutes |
| 10,000 addresses | ~8 hours |
| 100,000 addresses | ~3.5 days |
| 8M addresses (full NL) | ~280 days |

**Recommendation**:
- Use `--sample` for testing
- Run in batches with `--resume` for large datasets
- Consider filtering by municipality or province in BAG ingestion

---

## 📈 Analysis Examples

### Calculate Price Growth
```python
import polars as pl

df = pl.read_parquet("data/processed/woz-values.parquet")

# Calculate growth from 2014 to 2024
df = df.with_columns([
    ((pl.col("woz_2024") - pl.col("woz_2014")) / pl.col("woz_2014") * 100)
    .alias("growth_10y_pct")
])

# Find top 10 properties by growth
top_growth = df.sort("growth_10y_pct", descending=True).head(10)
print(top_growth.select(["postal_code", "house_number", "woz_2014", "woz_2024", "growth_10y_pct"]))
```

### Average WOZ by Year
```python
# Calculate mean WOZ value for each year
woz_cols = [col for col in df.columns if col.startswith("woz_")]

yearly_averages = {}
for col in woz_cols:
    year = col.replace("woz_", "")
    avg = df[col].mean()
    yearly_averages[year] = avg

print("Average WOZ Values:")
for year, avg in sorted(yearly_averages.items()):
    print(f"{year}: € {avg:,.0f}")
```

### Find Properties with Data Since 2014
```python
# Filter properties with complete historical data
complete_data = df.filter(
    pl.col("woz_2014").is_not_null() &
    pl.col("woz_2024").is_not_null()
)

print(f"Properties with complete data: {len(complete_data)}")
```

---

## 🔍 Troubleshooting

### No Historical Values Found
**Possible causes**:
- Property was built after 2014 (won't have earlier values)
- Address not found in WOZ database
- API rate limit exceeded

**Solution**: Check the test script output and verify the address exists

### API Timeout Errors
**Possible causes**:
- Network issues
- WOZ API temporarily down
- Rate limit too aggressive

**Solution**:
```bash
# Reduce rate limit
python -m ingest.woz --rate-limit 0.5 --sample 100
```

### Checkpoint Resume Not Working
**Possible causes**:
- Checkpoint file corrupted
- Input file changed

**Solution**:
```bash
# Delete checkpoint and restart
rm ../../data/checkpoints/woz_progress.json
python -m ingest.woz --sample 1000
```

---

## 🔒 Legal & Privacy

### ✅ Legal to Use
- WOZ values are **public information**
- Individual lookups are allowed
- No personal data is stored (owner names, etc.)

### ⚠️ Query Limits
- **Mass scraping may be restricted** - use responsibly
- Rate limiting is **mandatory** (default: 1 req/sec)
- Consider purchasing bulk data from Kadaster for commercial use

### 📜 GDPR Compliance
The transformation script automatically:
- ✅ Removes personal data columns (if any)
- ✅ Only stores property valuations (no owner info)
- ✅ Complies with privacy-by-design principles

---

## 📞 Support

### Questions?
- **Technical issues**: Open GitHub issue
- **API questions**: See [wozpy library](https://github.com/wpeterw/wozpy)
- **Legal questions**: See [LEGAL.md](LEGAL.md)

### Related Documentation
- [KADASTER_INTEGRATION.md](KADASTER_INTEGRATION.md) - Kadaster data usage
- [DATA_STORAGE.md](DATA_STORAGE.md) - Storage options
- [GETTING_STARTED.md](GETTING_STARTED.md) - Setup guide

---

**Last Updated**: November 4, 2025
**Status**: ✅ Ready for testing
**Data Coverage**: 2014-01-01 to present
