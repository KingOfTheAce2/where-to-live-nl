# BAG Enhanced Data Enrichment - In Progress

**Status:** DOWNLOADING (Started 2025-11-20)

## What's Happening

The BAG enhanced ingestion script is currently running and will enrich `addresses.parquet` with official building metadata from the Netherlands Cadastre (Kadaster).

### Current Progress

1. **[IN PROGRESS]** Downloading BAG extract (3.51GB compressed)
   - Source: https://service.pdok.nl/lv/bag/atom/downloads/lvbag-extract-nl.zip
   - Speed: ~2 MB/s
   - ETA: 25-30 minutes

2. **[PENDING]** Extracting XML files
   - VerblijfsObject.xml (residential units)
   - Pand.xml (buildings)
   - Nummeraanduiding.xml (address designations)

3. **[PENDING]** Parsing XML to Parquet
   - Extract floor area, building year, building purpose
   - Convert to Polars DataFrames
   - Save intermediate Parquet files

4. **[PENDING]** Joining to addresses.parquet
   - Link addresses → nummeraanduiding → verblijfsobject → pand
   - Enrich with building metadata

5. **[PENDING]** Creating addresses_enriched.parquet
   - Final output with all enriched data

## What Data Will Be Added

After completion, `addresses_enriched.parquet` will include:

### Existing Fields (from addresses.parquet)
- postal_code
- house_number
- house_letter
- house_addition
- lat, lng
- street_name
- city
- area_code

### NEW BAG Fields

#### From VerblijfsObject (Residential Unit)
- **verblijfsobject_id** - Unique residential unit ID
- **oppervlakte_m2** - Floor area in square meters
- **gebruiksdoel** - Building purpose (woonfunctie, etc.)
- **building_status** - Current status (in gebruik, etc.)

#### From Pand (Building)
- **pand_id** - Building ID
- **building_year** - Year originally built (oorspronkelijkBouwjaar)

#### Calculated Fields
- **has_building_info** - Boolean flag if BAG data is available
- **is_residential** - True if gebruiksdoel = "woonfunctie"

## File Size Expectations

- **Current:** addresses.parquet = ~500MB
- **After enrichment:** addresses_enriched.parquet = ~800MB - 1GB
- **Intermediate files:** ~2-3GB in data/raw/

## Timeline

| Step | Estimated Duration | Status |
|------|-------------------|---------|
| Download | 30-60 min | IN PROGRESS |
| Extract | 10-20 min | Pending |
| Parse VerblijfsObject | 30-60 min | Pending |
| Parse Pand | 30-60 min | Pending |
| Parse Nummeraanduiding | 20-40 min | Pending |
| Join & Enrich | 10-20 min | Pending |
| **TOTAL** | **2-4 hours** | IN PROGRESS |

## Monitoring Progress

Check the background task:
```bash
# See latest output
cat logs/bag_enhanced.log

# Or check in Claude Code with BashOutput tool
```

## What Happens Next

Once enrichment is complete:

1. **Update backend** to use `addresses_enriched.parquet` instead of `addresses.parquet`
2. **Add API endpoints** to expose new fields:
   - Floor area for WWS rental price calculations
   - Building year for filtering and display
   - Building purpose for filtering residential vs commercial
3. **Update frontend** to display new information in address snapshots

## Data Quality

### Expected Coverage

- **Floor area (oppervlakte):** ~90-95% of residential units
- **Building year:** ~85-90% of buildings (some estimated, some missing)
- **Building purpose:** ~95%+ of units

### Missing Data Handling

For addresses without BAG data:
- `has_building_info = false`
- NULL values for oppervlakte_m2, building_year
- UI should show "Unknown" or "Not available"

## Resources

- **BAG Documentation:** https://www.geobasisregistraties.nl/basisregistraties/adressen-en-gebouwen
- **BAG Download:** https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-2.0-extract
- **Script Location:** `scripts/etl/ingest/bag_enhanced.py`

## Next: Energy Labels

After BAG enrichment, the next data source to ingest is **Energy Labels** from RVO.nl:
- API: https://public.ep-online.nl/
- Coverage: ~7 million labels (40-50% of residential buildings)
- Size: ~200MB added to addresses_enriched.parquet
- Effort: 1-2 hours (much faster than BAG)

This will add:
- energy_label (A++++ to G)
- energy_index
- renewable_energy_pct
- energy_demand_kwh_m2_year

---

**Last Updated:** 2025-11-20 21:29 UTC
**Process ID:** 52240f
