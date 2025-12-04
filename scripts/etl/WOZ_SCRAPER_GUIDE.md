# WOZ Scraper Guide

Complete guide for scraping WOZ (property valuation) data for all Netherlands addresses.

---

## 📖 Overview

The WOZ scraper (`scrape_all_woz.py`) fetches property valuations from the official Kadaster API for all ~889k addresses in the Netherlands.

**Current Status:**
- ✅ **15,000** WOZ values scraped (68.5% success rate)
- 📊 Progress: **21,891** / 889,197 addresses (2.5%)
- ⏱️ Running at: ~0.4 req/sec

---

## 🚀 Quick Start

### Resume Existing Scraper

If you already have progress (checkpoint file exists):

```bash
cd scripts/etl

# Resume at current rate (2.5 req/sec)
python scrape_all_woz.py --rate-limit 2.5
```

### Start Fresh

```bash
cd scripts/etl

# Conservative start (1 req/sec)
python scrape_all_woz.py --rate-limit 1.0
```

---

## ⚙️ Options

```bash
python scrape_all_woz.py [OPTIONS]

Options:
  --input PATH          Input addresses file (default: netherlands_all_addresses.json)
  --output PATH         Output Parquet file (default: woz-netherlands-complete.parquet)
  --rate-limit FLOAT    Requests per second (default: 0.5)
  --save-every INTEGER  Save batch every N addresses (default: 1000)
  --resume             Resume from checkpoint (default: True)
```

### Recommended Rate Limits

| Rate | Speed | Time for 889k | Risk | Use Case |
|------|-------|---------------|------|----------|
| 0.5 | Slow | 20 days | Very Low | Initial test |
| 1.0 | Conservative | 10 days | Low | Safe default |
| 2.5 | Moderate | 4 days | Medium | **Recommended** ✅ |
| 5.0 | Fast | 2 days | Higher | If no 429 errors |

---

## 📊 Monitoring Progress

### Check Current Status

```bash
# View checkpoint file
cat ../../data/checkpoints/woz_netherlands_progress.json

# Or with Python
python -c "
import json
with open('../../data/checkpoints/woz_netherlands_progress.json') as f:
    data = json.load(f)
    total = 889197
    pct = (data['last_index'] / total) * 100
    print(f'Progress: {data[\"last_index\"]:,} / {total:,} ({pct:.1f}%)')
    print(f'Scraped: {data[\"total_scraped\"]:,}')
    print(f'Failed: {data[\"total_failed\"]:,}')
    print(f'Success rate: {data[\"total_scraped\"]/data[\"last_index\"]*100:.1f}%')
"
```

### Watch Real-Time (PowerShell)

```powershell
# Updates every 5 seconds
while ($true) {
    Clear-Host
    $data = Get-Content ..\..\data\checkpoints\woz_netherlands_progress.json | ConvertFrom-Json
    $pct = ($data.last_index / 889197) * 100
    Write-Host "Progress: $($data.last_index) / 889,197 ($([math]::Round($pct,1))%)"
    Write-Host "Scraped: $($data.total_scraped)"
    Write-Host "Updated: $($data.last_updated)"
    Start-Sleep 5
}
```

---

## 🔧 Troubleshooting

### 429 Rate Limit Errors

**Symptom**: Logs show "Rate limited (429)! Backing off for 60 seconds..."

**Solution**: Lower the rate limit

```bash
# Stop current scraper (Ctrl+C)
# Restart with lower rate
python scrape_all_woz.py --rate-limit 1.0
```

The scraper auto-resumes from checkpoint.

### 502 Bad Gateway Errors

**Symptom**: Occasional "502 Bad Gateway" from PDOK API

**Cause**: PDOK server temporarily unavailable (normal)

**Action**: None needed - scraper automatically skips and continues

These are expected and won't affect overall progress significantly.

### Success Rate < 60%

**Symptom**: Success rate dropping below 60%

**Possible causes**:
1. Many addresses don't exist in WOZ system (normal)
2. PDOK API issues
3. Rate limiting

**Action**: Monitor for 1 hour. If rate stays low and you see many 429s, lower rate limit.

### Scraper Crashes

**Solution**: Just restart - it auto-resumes!

```bash
python scrape_all_woz.py --rate-limit 2.5
```

Checkpoint saves every 1000 addresses, so you lose at most 1000 addresses of progress.

---

## 📈 Performance Optimization

### Gradual Speed Increase

Start conservative, then increase if stable:

```bash
# Day 1: Start slow
python scrape_all_woz.py --rate-limit 1.0

# After 6 hours: If no issues, stop (Ctrl+C) and increase
python scrape_all_woz.py --rate-limit 2.5

# After another 6 hours: If still good, increase again
python scrape_all_woz.py --rate-limit 5.0
```

### Best Practices

1. **Start Conservative**: Begin with 1.0 req/sec
2. **Monitor First Hour**: Watch for 429 errors
3. **Increase Gradually**: Double rate if no issues
4. **Run Overnight**: Let it work while you sleep
5. **Backup Checkpoints**: Copy checkpoint file daily

```bash
# Daily backup
cp ../../data/checkpoints/woz_netherlands_progress.json \
   ../../data/backups/woz_backup_$(date +%Y%m%d).json
```

---

## 📁 Output Files

### Checkpoint File

**Location**: `data/checkpoints/woz_netherlands_progress.json`

Contains:
- `last_index`: Last processed address index
- `total_scraped`: Successfully scraped count
- `total_failed`: Failed/not found count
- `last_updated`: Timestamp

**Important**: Don't delete this file! It's needed to resume.

### Output Parquet File

**Location**: `data/processed/woz-netherlands-complete.parquet`

Contains:
- Postal code, house number, house letter
- WOZ values by year (2014-present)
- Building metadata (year built, surface area, etc.)
- BAG identifiers

**Schema**:
```
postal_code: string
house_number: int
house_letter: string
woz_2014: int (nullable)
woz_2015: int (nullable)
...
woz_2024: int (nullable)
bouwjaar: int (nullable)
oppervlakte: int (nullable)
gemeentecode: string (nullable)
```

---

## 🎯 Expected Timeline

Based on current progress (21,891 addresses in ~1.5 hours at 2.5 req/sec):

| Rate | Remaining Time |
|------|----------------|
| 1.0 req/sec | ~10 days |
| 2.5 req/sec | **~4 days** |
| 5.0 req/sec | ~2 days |

**At 2.5 req/sec:**
- Overnight (8 hours): ~72,000 addresses
- 1 week: ~600,000 addresses
- 4 days: Complete ✅

---

## 💡 Tips

### 1. Use `screen` or `tmux` (Linux/WSL)

Prevents interruption if SSH disconnects:

```bash
# Start screen session
screen -S woz

# Run scraper
python scrape_all_woz.py --rate-limit 2.5

# Detach: Ctrl+A then D
# Reattach later: screen -r woz
```

### 2. Run During Off-Peak Hours

Lower API load = fewer rate limits:
- **Best**: 1 AM - 6 AM
- **Good**: Weekends
- **Avoid**: Weekday business hours

### 3. Check Progress Daily

```bash
# Quick check
python -c "import json; d=json.load(open('../../data/checkpoints/woz_netherlands_progress.json')); print(f'{d[\"total_scraped\"]:,} scraped, {(d[\"last_index\"]/889197*100):.1f}% done')"
```

### 4. Backup Before Increasing Rate

```bash
# Create backup
cp ../../data/checkpoints/woz_netherlands_progress.json woz_backup.json
cp ../../data/processed/woz-netherlands-complete.parquet woz_data_backup.parquet

# Then increase rate
python scrape_all_woz.py --rate-limit 5.0
```

---

## 📊 Understanding the Output

### Progress Bar

```
Scraping WOZ:   2%|▌  | 21891/889197 [1:30:29<964:05:40, 4.00s/addr]
                ^^     ^^^^^^^^^^^^^^  ^^^^^^^^ ^^^^^^^^^^ ^^^^^^^^^^
                %      current/total   elapsed  remaining  time/addr
```

### Success Rate

**Normal ranges**:
- 60-70%: Good (many addresses don't have WOZ data)
- 70-80%: Excellent
- < 60%: Check for API issues

**Why failures happen**:
- Address doesn't exist in BAG database
- Property exempt from WOZ (e.g., government buildings)
- PDOK API temporary issues (502 errors)
- Address format issues

---

## 🛑 When to Stop and Restart

**Stop if you see:**
- Continuous 429 errors (every request)
- Success rate < 50% for extended period
- Scraper frozen (no progress for 5+ minutes)

**Then:**
```bash
# Stop: Ctrl+C
# Wait 1 minute
# Restart with lower rate
python scrape_all_woz.py --rate-limit 1.0
```

---

## ✅ Final Checklist

- [ ] Checkpoint file exists: `data/checkpoints/woz_netherlands_progress.json`
- [ ] Input file exists: `data/raw/netherlands_all_addresses.json`
- [ ] Output directory exists: `data/processed/`
- [ ] Backup directory exists: `data/backups/`
- [ ] Rate limit set: 1.0-5.0 req/sec
- [ ] Scraper running in background (screen/tmux or dedicated terminal)
- [ ] Daily progress checks scheduled
- [ ] Checkpoint backups scheduled

---

## 🔗 Data Sources

**APIs Used**:
1. **PDOK Locatieserver** (address lookup)
   - API: https://api.pdok.nl/bzk/locatieserver/search/v3_1/
   - License: CC0 (Public Domain)
   - Rate limit: None specified

2. **Kadaster WOZ API** (property valuations)
   - API: https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/
   - License: Open Data
   - Rate limit: Recommended 1-5 req/sec

**Legal Note**: WOZ values are public information. Individual lookups are explicitly allowed. We implement rate limiting to be respectful of the API.

---

## 📞 Support

**If scraper fails completely**:
1. Check internet connection
2. Verify input file exists
3. Check API status: https://www.pdok.nl/
4. Try with `--rate-limit 0.5` (very conservative)

**If success rate is very low**:
1. Check recent log entries for patterns
2. Verify address format in input file
3. Try a few addresses manually

**Data quality issues**:
- Some addresses legitimately have no WOZ data
- 502 errors are temporary and normal
- Success rate of 60-70% is expected

---

**Current recommendation: Run at 2.5 req/sec for optimal balance of speed and stability** ⚡

**Expected completion: ~4 days from your current progress**
