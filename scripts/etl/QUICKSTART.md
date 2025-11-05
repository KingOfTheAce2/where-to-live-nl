# ETL Quick Start Guide

Get started with BAG ingestion and WOZ scraping in 5 minutes.

---

## 🚀 Installation (5 minutes)

### 1. Navigate to ETL directory

```bash
cd scripts/etl
```

### 2. Create virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Create data directories

```bash
# Windows
mkdir ..\..\data\raw
mkdir ..\..\data\processed
mkdir ..\..\data\checkpoints

# macOS/Linux
mkdir -p ../../data/{raw,processed,checkpoints}
```

---

## ⚖️ Legal Notice

**IMPORTANT**: Before proceeding, read [LEGAL.md](../../LEGAL.md) for compliance guidance.

**Key points**:
- ✅ **BAG data** (addresses, building info): Safe to store (CC0 license)
- ✅ **WOZ values** (without owner info): Generally safe
- ❌ **Kadaster owner data**: HIGH RISK to store in bulk
- 📜 **GDPR compliance**: Required if storing any personal data

**This project focuses on public non-personal data** (addresses, building characteristics, WOZ values) and **does NOT store** owner names, dates of birth, or other personal information from Kadaster.

---

## 📥 Test Run (10 minutes)

### Step 1: Download sample BAG data (JSON)

```bash
# Download 100 addresses from Amsterdam
python -m ingest.bag --municipality Amsterdam --sample 100

# Output: ../../data/raw/bag.json (human-readable)
```

Expected output:
```
=== BAG Data Ingestion ===
Starting BAG address download...
Downloading addresses: 100 addresses
Downloaded 100 addresses
Saved 100 addresses to ../../data/raw/bag.json
File size: 0.1 MB
```

### Step 1.5: Inspect the JSON data

```bash
# View the JSON file (check what data you downloaded)
cat ../../data/raw/bag.json | head -n 50

# On Windows
type ..\..\data\raw\bag.json | more

# Or open in your text editor to inspect
```

**Why inspect?**
- Verify data quality before processing
- Check for any unexpected personal data
- Understand the data structure

### Step 2: Transform JSON to Parquet

```bash
# Convert JSON to optimized Parquet format
python -m transform.bag_to_parquet --input ../../data/raw/bag.json

# Output: ../../data/processed/bag-addresses.parquet (80% smaller!)
```

Expected output:
```
=== BAG to Parquet Transformation ===
Loading ../../data/raw/bag.json...
Loaded 100 addresses
DataFrame shape: (100, 12)
Cleaning BAG data...
Cleaned data: 100 rows remaining
Adding spatial index columns...
Optimizing data types...
Writing Parquet file with snappy compression...
Saved to ../../data/processed/bag-addresses.parquet
Input size: 0.1 MB
Output size: 0.03 MB
Size reduction: 70.0%
```

### Step 3: Scrape WOZ values (optional, slow)

**⚖️ Legal Note**: WOZ values are public information. We scrape individual addresses at 1 req/sec (respectful rate limiting). This is legal, but see [LEGAL.md](../../LEGAL.md) for GDPR considerations.

```bash
# Test with 10 addresses (takes ~10 seconds)
python -m ingest.woz --sample 10 --output ../../data/raw/woz.json

# Output: ../../data/raw/woz.json (inspect before processing)
```

Expected output:
```
=== WOZ Data Scraping ===
Loaded 100 addresses from ../../data/raw/bag.json
Limited to 10 addresses for testing
Addresses to scrape: 10
Estimated time: 0.0 hours
Scraping WOZ: 100%|████████| 10/10 [00:10<00:00, 1.00s/it]
Scraped 8 WOZ values
Saved to ../../data/raw/woz.json
Success rate: 80.0%
```

### Step 3.5: Inspect WOZ data

```bash
# View the WOZ data (check for personal information!)
cat ../../data/raw/woz.json

# Look for:
# ✅ postal_code, house_number, woz_value (OK to store)
# ❌ owner_name, birthdate (DO NOT store in bulk!)
```

### Step 4: Transform WOZ to Parquet

```bash
# Convert to Parquet with personal data stripping
python -m transform.woz_to_parquet --input ../../data/raw/woz.json

# Output: ../../data/processed/woz-values.parquet
```

Expected output:
```
=== WOZ to Parquet Transformation ===
Loading ../../data/raw/woz.json...
Loaded 8 WOZ records
Checking for personal data columns...
✓ No personal data columns found
Cleaning WOZ data...
Cleaned data: 8 rows remaining
Writing Parquet file with snappy compression...
Saved to ../../data/processed/woz-values.parquet

⚖️ Privacy Check:
✓ Personal data removed (GDPR compliant)
```

---

## 🎯 Production Run (hours/days)

### Full BAG Download (~6 hours)

```bash
# Download all Netherlands addresses (~10M)
python -m ingest.bag

# This will take 4-6 hours depending on your connection
# Output: ../../data/raw/bag.json (~2.5 GB)
```

### Full WOZ Scraping (~92 days!)

**⚠️ WARNING**: Scraping all WOZ values takes ~3 months at 1 req/sec

**Recommended approach**: Priority scraping

```bash
# Option 1: Sample 100K most popular postal codes (28 hours)
python -m ingest.woz --sample 100000

# Option 2: Specific municipality (e.g., Amsterdam, ~6 hours)
python -m ingest.bag --municipality Amsterdam
python -m ingest.woz

# Option 3: Run in background with resume capability
nohup python -m ingest.woz --resume > woz.log 2>&1 &
```

**Better approach**: On-demand scraping
- Scrape WOZ when users search for an address
- Cache results in database
- Community builds dataset over time

---

## 📊 Verify Your Data

### Check Parquet file

```bash
# Install parquet-tools (optional)
pip install parquet-tools

# View schema
parquet-tools schema ../../data/processed/bag-addresses.parquet

# View first 10 rows
parquet-tools head ../../data/processed/bag-addresses.parquet -n 10

# Show file info
parquet-tools inspect ../../data/processed/bag-addresses.parquet
```

### Query with Python

```python
import polars as pl

# Load Parquet file
df = pl.read_parquet("../../data/processed/bag-addresses.parquet")

# Show shape
print(f"Rows: {len(df)}, Columns: {len(df.columns)}")

# Filter by postal code
amsterdam = df.filter(pl.col("postal_code").str.starts_with("10"))
print(f"Amsterdam addresses: {len(amsterdam)}")

# Group by municipality
by_city = df.group_by("municipality").count()
print(by_city.sort("count", descending=True).head(10))
```

---

## 🐛 Troubleshooting

### Error: "Module not found"

**Solution**: Make sure virtual environment is activated

```bash
# Check if venv is active (should show (venv) in prompt)
which python  # Should point to venv/bin/python

# If not activated:
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

### Error: "API rate limit exceeded"

**Solution**: BAG API has rate limits. Add delay between requests.

```bash
# Use smaller sample
python -m ingest.bag --sample 1000
```

### Error: "WOZ scraper blocked"

**Solution**: Website may have anti-scraping measures.

```python
# In ingest/woz.py, increase rate limit delay
python -m ingest.woz --rate-limit 0.5  # Slower: 0.5 req/sec
```

### Error: "Out of memory"

**Solution**: Process data in chunks.

```python
# Use Polars streaming mode (in transform script)
df = pl.scan_parquet("input.parquet").collect(streaming=True)
```

---

## 📁 File Structure After Running

```
data/
├── raw/
│   ├── bag.json              # BAG addresses (JSON, ~2.5 GB)
│   └── woz.json              # WOZ values (JSON, ~500 MB)
├── processed/
│   ├── bag-addresses.parquet # BAG (Parquet, ~500 MB)
│   └── woz-values.parquet    # WOZ (Parquet, ~150 MB)
└── checkpoints/
    └── woz_progress.json     # Resume checkpoint
```

---

## 🎨 Next Steps

### 1. Merge WOZ with BAG

```python
import polars as pl

# Load both datasets
bag = pl.read_parquet("../../data/processed/bag-addresses.parquet")
woz = pl.read_parquet("../../data/processed/woz-values.parquet")

# Join on postal_code + house_number
combined = bag.join(
    woz,
    on=["postal_code", "house_number"],
    how="left"
)

# Save combined dataset
combined.write_parquet("../../data/processed/bag-with-woz.parquet")
```

### 2. Upload to Cloudflare R2

```bash
# Install wrangler CLI
npm install -g wrangler

# Authenticate
wrangler login

# Create R2 bucket
wrangler r2 bucket create where-to-live-nl

# Upload data
wrangler r2 object put where-to-live-nl/bag-addresses.parquet \
  --file ../../data/processed/bag-addresses.parquet
```

### 3. Add More Data Sources

```bash
# Download CBS demographics
python -m ingest.cbs

# Download Leefbaarometer scores
python -m ingest.leefbaarometer

# Download crime statistics
python -m ingest.crime
```

---

## 📚 Resources

- **BAG API Docs**: https://api.pdok.nl/bzk/bag/v2/
- **Polars Docs**: https://pola-rs.github.io/polars/
- **Parquet Format**: https://parquet.apache.org/
- **Full ETL README**: [README.md](README.md)

---

## 💡 Tips

### Speed up BAG download
```bash
# Download specific province only
python -m ingest.bag --province "Noord-Holland"
```

### Test before full run
```bash
# Always test with --sample first
python -m ingest.bag --sample 1000
python -m transform.bag_to_parquet
# Check output, then run full
```

### Resume interrupted WOZ scraping
```bash
# If scraping stops, resume from checkpoint
python -m ingest.woz --resume
```

### Monitor progress
```bash
# Run in background and monitor log
python -m ingest.woz > woz.log 2>&1 &
tail -f woz.log
```

---

**Questions?** Open a GitHub issue or check the [main README](../../README.md)

**Ready to code?** See the [ROADMAP](../../ROADMAP.md) for next steps!
