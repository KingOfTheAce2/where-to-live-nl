# Quick Start: WOZ Historical Data

> **Get historical WOZ data (2014-2025) in 5 minutes**

---

## Step 1: Install Dependencies

```powershell
cd D:\GitHub\where-to-live-nl\scripts\etl
pip install -r requirements.txt
```

**Note**: This will take 5-10 minutes as it builds some packages from source.

---

## Step 2: Test with a Single Address

```powershell
# Test the WOZ historical data retrieval
python test_woz_historical.py
```

**Expected output**:
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

---

## Step 3: Download Sample BAG Addresses

Before scraping WOZ data, you need BAG addresses:

```powershell
# Download 100 sample addresses from Amsterdam
python -m ingest.bag --municipality Amsterdam --sample 100
```

**Expected output**:
```
Downloaded 100 addresses
Saved 100 addresses to ../../data/raw/bag.json
File size: 0.1 MB
```

---

## Step 4: Scrape WOZ for Sample Addresses

```powershell
# Scrape WOZ values for the 100 addresses (takes ~5 minutes)
python -m ingest.woz --sample 100
```

**Expected output**:
```
=== WOZ Data Scraping ===
Loaded 100 addresses from ../../data/raw/bag.json
Addresses to scrape: 100
Estimated time: 0.1 hours

Scraping WOZ: 100%|████████████| 100/100 [05:00<00:00]

Scraped 85 WOZ values
Success rate: 85.0%
```

**Note**: Not all addresses will have WOZ values (some may be commercial, under construction, etc.)

---

## Step 5: Transform to Parquet

```powershell
# Convert JSON to optimized Parquet format
python -m transform.woz_to_parquet
```

**Expected output**:
```
=== WOZ to Parquet Transformation ===
Loaded 85 WOZ records
Flattening historical WOZ data...
Flattened 85 records
Columns: ['postal_code', 'house_number', 'house_letter', 'nummeraanduiding_id',
          'woz_2014', 'woz_2015', 'woz_2016', ..., 'woz_2025', 'scraped_at']

Cleaned data: 85 rows remaining

WOZ Value Statistics (by year):
2014: count=72, min=150000, max=850000, mean=425000
2015: count=75, min=155000, max=900000, mean=440000
...

Saved to ../../data/processed/woz-values.parquet
Size reduction: 78.5%
```

---

## Step 6: Analyze the Data

```powershell
# Quick Python analysis
python -c "import polars as pl; df=pl.read_parquet('../../data/processed/woz-values.parquet'); print('Columns:', df.columns); print('\nFirst 5 rows:'); print(df.head(5))"
```

Or create a Python script:

```python
import polars as pl

# Load data
df = pl.read_parquet("data/processed/woz-values.parquet")

# Show structure
print(f"Dataset: {df.shape[0]} properties × {df.shape[1]} columns")
print(f"\nColumns: {df.columns}")

# Calculate 10-year growth (2014 → 2024)
if "woz_2014" in df.columns and "woz_2024" in df.columns:
    df = df.with_columns([
        ((pl.col("woz_2024") - pl.col("woz_2014")) / pl.col("woz_2014") * 100)
        .alias("growth_10y_pct")
    ])

    print("\nAverage 10-year growth:", df["growth_10y_pct"].mean(), "%")

    # Top 5 properties by growth
    print("\nTop 5 properties by growth:")
    print(df.select(["postal_code", "house_number", "woz_2014", "woz_2024", "growth_10y_pct"])
           .sort("growth_10y_pct", descending=True)
           .head(5))
```

---

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'loguru'"
**Solution**: Install dependencies first:
```powershell
cd scripts\etl
pip install -r requirements.txt
```

### Error: "No module named 'ingest'"
**Solution**: Make sure you're in the `scripts/etl` directory:
```powershell
cd D:\GitHub\where-to-live-nl\scripts\etl
python -m ingest.woz --sample 10
```

### Error: "No addresses fetched!"
**Solution**: Download BAG data first:
```powershell
python -m ingest.bag --sample 100
```

### Error: "HTTP 404" or "Address not found"
**Solution**: This is normal - not all addresses have WOZ values. The script will continue with other addresses.

### Installation Takes Forever
**Solution**: Some packages (numpy, pyarrow) build from source. This is normal on Windows. Consider using pre-built wheels:
```powershell
pip install --upgrade pip
pip install numpy pyarrow --only-binary :all:
```

---

## Next Steps

1. **Scale up**: Try 1,000 addresses: `python -m ingest.woz --sample 1000`
2. **Filter by city**: Download only specific municipality
   ```powershell
   python -m ingest.bag --municipality Amsterdam --sample 10000
   ```
3. **Analyze trends**: See `WOZ_HISTORICAL_DATA.md` for analysis examples
4. **Production**: See `ROADMAP.md` for full implementation plan

---

## Summary

You now have:
- ✅ Historical WOZ data from 2014 to 2025
- ✅ Optimized Parquet storage (80% compression)
- ✅ Wide format for easy year-over-year analysis
- ✅ GDPR-compliant (no personal data)

**Data structure**:
```
postal_code | house_number | woz_2014 | woz_2015 | ... | woz_2025
1012AB      | 1            | 350000   | 365000   | ... | 545000
```

---

**Questions?** See [WOZ_HISTORICAL_DATA.md](WOZ_HISTORICAL_DATA.md) for detailed documentation.

**Last Updated**: November 4, 2025
