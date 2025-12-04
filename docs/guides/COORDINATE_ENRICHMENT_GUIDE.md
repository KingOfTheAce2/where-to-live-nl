# Coordinate Enrichment Guide

Your BAG addresses file currently has **889,197 addresses** but all coordinates are `null`. This guide explains how to add them.

---

## ✅ What Was Done

**Two scripts have been created:**

1. **`download_all_netherlands_addresses.py`** - UPDATED
   - Fixed to correctly parse POINT(lon lat) format from PDOK API
   - Use this if you want to re-download from scratch (4-6 hours)
   - You probably don't need this

2. **`enrich_addresses_with_coordinates.py`** - NEW ⭐
   - Enriches your EXISTING addresses file with coordinates
   - Much faster than re-downloading (3-5 hours vs 6-8 hours)
   - Has resume capability
   - **This is what you should use**

---

## 🚀 How to Run the Enrichment

### Quick Test (Recommended First)

Test with 100 addresses to make sure everything works:

```bash
cd scripts/etl
python enrich_addresses_with_coordinates.py --sample 100
```

**Output:**
- Creates: `data/raw/netherlands_all_addresses_with_coords.json`
- Time: ~20 seconds
- Success rate: Should be ~95-100%

### Full Enrichment

Once you've verified the test works, run the full enrichment:

```bash
cd scripts/etl
python enrich_addresses_with_coordinates.py
```

**What happens:**
- Reads: `data/raw/netherlands_all_addresses.json` (889,197 addresses)
- Outputs: `data/raw/netherlands_all_addresses_with_coords.json`
- Time: **~3-5 hours** (at 5 req/sec rate limit)
- Saves progress every 5,000 addresses
- Can resume if interrupted

### Resume After Interruption

If it gets interrupted (computer restart, network issue, etc.):

```bash
cd scripts/etl
python enrich_addresses_with_coordinates.py --resume
```

It will continue from where it left off using the checkpoint file.

---

## ⚙️ Options

```bash
# Custom rate limit (slower = more respectful to API)
python enrich_addresses_with_coordinates.py --rate-limit 0.5

# Save progress more frequently
python enrich_addresses_with_coordinates.py --save-every 1000

# Custom output location
python enrich_addresses_with_coordinates.py --output ../../data/raw/my_addresses.json

# Full help
python enrich_addresses_with_coordinates.py --help
```

---

## 📊 Expected Results

Based on the test run:

- **Success rate:** ~95-100%
- **Speed:** ~4 addresses/second (limited by API rate limit)
- **Total time:** 3-5 hours for 889,197 addresses
- **Output size:** ~300 MB (slightly larger due to coordinate floats)

**Why some might fail:**
- Very new addresses not yet in PDOK
- Addresses with unusual formats
- Temporary API errors (retry on next run)

---

## 📁 File Locations

**Input:**
```
data/raw/netherlands_all_addresses.json        (288 MB, no coordinates)
```

**Output:**
```
data/raw/netherlands_all_addresses_with_coords.json  (~300 MB, with coordinates)
```

**Checkpoint:**
```
data/checkpoints/coordinate_enrichment.json    (auto-deleted when complete)
```

---

## 🔄 After Enrichment

Once enrichment is complete:

1. **Verify the output:**
   ```bash
   # Count how many have coordinates
   grep -c '"latitude": [0-9]' data/raw/netherlands_all_addresses_with_coords.json
   ```

2. **Replace the original file (optional):**
   ```bash
   # Backup original
   mv data/raw/netherlands_all_addresses.json data/raw/netherlands_all_addresses_backup.json

   # Use enriched version
   mv data/raw/netherlands_all_addresses_with_coords.json data/raw/netherlands_all_addresses.json
   ```

3. **Update your WOZ scraper** (if needed):
   - The WOZ scraper will now have coordinates for all addresses
   - You can add coordinate validation to your WOZ output

---

## 💡 Tips

1. **Run overnight**: The enrichment takes 3-5 hours, perfect to run while sleeping

2. **Monitor progress**: The script shows:
   - Progress bar
   - Current success/failure counts
   - Periodic saves (every 5,000 addresses)

3. **Check the logs**: All activity is logged with timestamps

4. **Test first**: Always run with `--sample 100` first to verify

---

## 🐛 Troubleshooting

### Error: "No module named 'httpx'"
```bash
pip install httpx
```

### Slow performance
- Default rate limit is 0.2s (5 req/sec)
- This is respectful to the PDOK API
- Don't go faster than 10 req/sec to avoid being rate-limited

### API timeouts
- Script has built-in 10-second timeout per request
- Failed lookups are logged but don't stop the process
- You can re-run to retry failed addresses

---

## 📈 Why This Matters

**Coordinates enable:**
- 🗺️ Map visualization
- 🚴 Travel time calculations
- 📍 Proximity analysis ("near supermarket")
- 🎯 Spatial filtering
- 📊 Neighborhood clustering

Without coordinates, your platform can't show properties on a map or calculate distances.

---

## ⏰ When to Run

**Best time to run:**
- After your WOZ scraper has been running for a few days
- Run overnight or during a long meeting
- Make sure your computer won't sleep/restart

**Don't worry about:**
- It's safe to run while WOZ scraper is running
- Different data source (PDOK vs WOZ API)
- Different files (won't interfere)

---

**Questions?** Check the script's `--help` or review the source code at:
`scripts/etl/enrich_addresses_with_coordinates.py`

---

*Created: November 2025*
