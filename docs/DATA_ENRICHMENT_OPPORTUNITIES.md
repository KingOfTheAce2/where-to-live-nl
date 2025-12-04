# Data Enrichment Opportunities - BAG & Energy Labels

**Date:** 2025-01-20
**Purpose:** Research what additional data can be ingested to enrich addresses.parquet

---

## Current addresses.parquet Status

### What We Have
```
- postal_code: 4-digit + 2-letter code
- house_number: Number
- house_letter: Letter suffix (A, B, etc.)
- house_addition: Addition (bis, I, II, etc.)
- lat, lng: Coordinates
- street_name: Street name
- city: City name
```

### What's Missing
- Building square meters (oppervlakte)
- Year built (bouwjaar)
- Building type (woonfunctie vs other)
- Energy label
- Number of rooms
- Monument status
- Many other BAG attributes

---

## 1. BAG Enhanced Data - Available Attributes

### Official BAG 2.0 Dataset

**Download Source:** https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-2.0-extract

**Available Extracts:**
1. **BAGLV (Leveringsformaat)** - Full extract, ~8GB compressed, ~50GB uncompressed
2. **BAG Light** - Simplified extract for common use cases
3. **BAG API** - Real-time lookups (rate limited)

### Key Attributes in BAG 2.0

#### VerblijfsObject (Residential Unit)
```
identificatie: Unique ID
nummeraanduidingIdentificatie: Link to address
oppervlakte: Floor area in m² ✅ USEFUL!
gebruiksdoel: Purpose (woonfunctie, bijeenkomstfunctie, etc.) ✅ USEFUL!
status: Current status (in gebruik, not in use, etc.)
geconstateerd: Whether verified
documentdatum: Document date
documentnummer: Document number
voorkomenidentificatie: Version ID
beginGeldigheid: Valid from date
eindGeldigheid: Valid until date
tijdstipRegistratie: Registration timestamp
eindRegistratie: End of registration
tijdstipInactief: Inactivity timestamp
tijdstipRegistratieLV: LV registration time
tijdstipEindRegistratieLV: LV end registration
tijdstipInactiefLV: LV inactivity time
tijdstipNietBagLV: Non-BAG timestamp
```

#### Pand (Building)
```
identificatie: Unique building ID
geometrie: Building polygon geometry ✅ USEFUL for footprint
oorspronkelijkBouwjaar: Original construction year ✅ USEFUL!
status: Building status
geconstateerd: Whether verified
documentdatum: Document date
documentnummer: Document number
voorkomenidentificatie: Version ID
beginGeldigheid: Valid from
eindGeldigheid: Valid until
```

#### Additional Datasets
- **Woonplaats** (Place names)
- **OpenbareRuimte** (Public spaces/streets)
- **Nummeraanduiding** (Address designation)
- **Standplaats** (Market stalls)
- **Ligplaats** (Berth for boats)

###What Can We Realistically Ingest?

#### High Priority (Directly Useful)
1. **oppervlakte** (m²) - Floor area of residential unit
2. **oorspronkelijkBouwjaar** - Year built
3. **gebruiksdoel** - Building purpose/type
4. **pand.geometrie** - Building footprint polygon

#### Medium Priority (Nice to Have)
5. **status** - Current legal status
6. **Number of units per building** - Calculated from Pand → VerblijfsObject relationship

#### Low Priority (Advanced Features)
7. **tijdstipRegistratie** - For showing data freshness
8. **Building modifications** - Track changes over time

---

## 2. Energy Labels (Energielabels)

### Official Source: RVO.nl

**API:** https://public.ep-online.nl/
**Documentation:** https://www.ep-online.nl/PublicData
**License:** Open data, free to use
**Size:** ~7 million labels for all Dutch buildings

### Available Data

#### Energielabel Dataset
```
Pand_bag_id: BAG building ID ✅ LINKS TO BAG!
Pand_postcode: Postal code
Pand_huisnummer: House number
Pand_huisletter: House letter
Pand_huisnummertoevoeging: House addition
Pand_plaats: City
Pand_straatnaam: Street name
Pand_gebouwklasse: Building class (Woonfunctie, Utiliteit, etc.)
Pand_gebouwsubklasse: Building subclass
Pand_opnamedatum: Assessment date
Pand_registratiedatum: Registration date
Pand_berekeningstype: Calculation type (NTA 8800, EPA-W, etc.)
Pand_energieklasse: Energy label (A++++ to G) ✅ VERY USEFUL!
Pand_energieindex: Energy index value
Pand_is_op_basis_van_referentie_gebouw: Based on reference building
Pand_gebouwtype: Building type
Pand_detailaanduiding: Detailed designation

# For residential buildings
Pand_aantal_gebruiksfuncties: Number of functions
Pand_gebruiksoppervlakte_thermische_zone: Thermal zone area in m²
Pand_energiebehoefte: Energy demand in kWh/m²/year
Pand_eis_energiebehoefte: Required energy demand
Pand_primaire_fossiele_energie: Primary fossil energy
Pand_eis_primaire_fossiele_energie: Required primary fossil energy
Pand_temperatuuroverschrijding: Temperature exceedance (TO)
Pand_eis_temperatuuroverschrijding: Required TO
Pand_hernieuwbare_energie: Renewable energy percentage ✅ USEFUL!
Pand_eis_hernieuwbare_energie: Required renewable energy
```

### API Examples

**Lookup by postal code + house number:**
```
GET https://public.ep-online.nl/api/v1/panden?postcode=4874MM&huisnummer=27
```

**Bulk download:**
```
GET https://public.ep-online.nl/api/v1/panden/export
```

**Supports:**
- Pagination
- Filtering by city, postal code, date range
- CSV, JSON, XML formats

---

## 3. Implementation Plan

### Phase 1: BAG Enhanced Download

**Script:** `scripts/etl/ingest/bag_enhanced.py`

**Steps:**
1. Download BAG BAGLV extract (8GB compressed)
2. Extract VerblijfsObject.xml and Pand.xml
3. Parse XML to extract key fields
4. Join VerblijfsObject → Pand on pandIdentificatie
5. Join to existing addresses.parquet on postal_code + house_number
6. Create enriched_addresses.parquet

**Estimated Time:** 4-6 hours (download + processing)
**Estimated Size:** addresses.parquet will grow from ~500MB to ~2GB

**Challenges:**
- XML parsing (large files, need streaming parser)
- Data volume (14M+ addresses)
- Join performance (need proper indexing)

**Schema After Enrichment:**
```python
{
    # Existing fields
    "postal_code": str,
    "house_number": int,
    "house_letter": str,
    "house_addition": str,
    "lat": float,
    "lng": float,
    "street_name": str,
    "city": str,
    "area_code": str,

    # NEW BAG fields
    "verblijfsobject_id": str,  # Unique residential unit ID
    "oppervlakte_m2": int,  # Floor area
    "building_year": int,  # Year built
    "building_purpose": str,  # woonfunctie, etc.
    "building_status": str,  # in gebruik, etc.
    "pand_id": str,  # Building ID
    "building_footprint_geojson": str,  # Polygon geometry

    # Calculated fields
    "units_in_building": int,  # How many addresses in this building
    "is_apartment": bool,  # units_in_building > 1
}
```

### Phase 2: Energy Labels Integration

**Script:** `scripts/etl/ingest/energielabels.py`

**Steps:**
1. Download energy labels from RVO API (or bulk export)
2. Filter for residential buildings only
3. Join to addresses.parquet on postal_code + house_number
4. Add energy_label column

**Estimated Time:** 1-2 hours
**Estimated Size:** +50MB to addresses.parquet

**Schema Addition:**
```python
{
    # NEW energy label fields
    "energy_label": str,  # A++++ to G
    "energy_index": float,  # Numeric index
    "energy_assessment_date": date,
    "renewable_energy_pct": float,
    "energy_demand_kwh_m2_year": float,
}
```

### Phase 3: Coordinate Enrichment for Other Datasets

Many datasets have postal code + house number but NO coordinates. We can enrich them using addresses.parquet as a lookup table.

**Candidates for Enrichment:**
- ✅ Crime data (already has area_code)
- ✅ WOZ data (postal_code + house_number → coordinates)
- ✅ Energy consumption (postal_code + house_number → coordinates)
- ❌ Air quality (already has coordinates)
- ❌ Foundation risk (already has coordinates)

---

## 4. Alternative: BAG API vs Bulk Download

### Option A: Bulk Download (Recommended for MVP)

**Pros:**
- One-time download, offline forever
- No API rate limits
- Complete dataset
- Fast lookups after initial processing

**Cons:**
- Large download (8GB)
- Complex XML parsing
- Storage requirements (~50GB uncompressed)
- Needs periodic updates (quarterly)

### Option B: BAG API (Not Recommended for Production)

**Pros:**
- Always up-to-date
- No storage needed
- Easy to implement

**Cons:**
- Rate limited (throttling)
- Network dependency
- Slower than local lookups
- Can fail if API is down

**Recommendation:** Use bulk download for addresses.parquet enrichment, then serve from Parquet.

---

## 5. Data Quality Considerations

### BAG Data Quality Issues

1. **Missing oppervlakte:** ~5-10% of units don't have floor area recorded
2. **Estimated bouwjaar:** Some buildings have estimated construction year
3. **Multiple gebru iksdoel:** Buildings can have multiple purposes
4. **Demolished buildings:** Need to filter status != "Pand gesloopt"

### Energy Label Coverage

1. **Coverage:** Only ~40-50% of residential buildings have energy labels
2. **Outdated labels:** Some labels are 10+ years old
3. **New construction:** No label yet (takes 6-12 months)
4. **Rental vs owned:** Rental properties more likely to have labels (legal requirement)

**Handling Missing Data:**
- oppervlakte: Use NULL, show "Unknown" in UI
- building_year: Use NULL, show "Unknown"
- energy_label: Use NULL, show "No label available" with explanation

---

## 6. Quick Wins - What to Prioritize

### Immediate Value (Do First)
1. **Energy labels** - High user value, easy to ingest, modest size
   - Direct impact: Users can see energy costs
   - File size: +50MB
   - Effort: Low (simple API)

2. **Floor area (oppervlakte)** - Essential for WWS/huurprijscheck
   - Direct impact: Rental price calculations
   - File size: +100MB
   - Effort: Medium (need BAG download)

3. **Year built** - Popular filter/search criteria
   - Direct impact: Historical context
   - File size: +50MB (part of oppervlakte download)
   - Effort: Medium (same as oppervlakte)

### Nice to Have (Do Later)
4. **Building footprint geometry** - Cool visualizations
   - Impact: Visual appeal
   - File size: +1GB
   - Effort: High

5. **Building purpose** - Filter for specific types
   - Impact: Niche use cases
   - File size: +20MB
   - Effort: Low (part of BAG download)

---

## 7. Recommended Action Plan

### Week 1: Energy Labels
1. Create `scripts/etl/ingest/energielabels.py`
2. Download energy labels from RVO API
3. Join to addresses.parquet on postal_code + house_number
4. Add to frontend display

### Week 2: BAG Enhanced
1. Download BAG BAGLV extract
2. Create `scripts/etl/ingest/bag_enhanced.py`
3. Parse VerblijfsObject → extract oppervlakte, gebruiksdoel
4. Parse Pand → extract oorspronkelijkBouwjaar
5. Join to addresses.parquet
6. Add to frontend display

### Week 3: Coordinate Enrichment
1. Use enriched addresses.parquet as lookup table
2. Add coordinates to WOZ data
3. Add coordinates to energy consumption data
4. Enable map visualization for these datasets

---

## 8. File Size Projections

Current state:
```
addresses.parquet: 500MB
```

After enrichment:
```
addresses_enriched.parquet: 2.5GB
├─ address data: 500MB (existing)
├─ BAG oppervlakte + year: 500MB
├─ BAG geometries: 1GB
├─ Energy labels: 200MB
└─ Calculated fields: 300MB
```

**Storage requirement:** ~3GB for complete enriched address dataset

**Alternative (minimal):**
```
addresses_enriched_minimal.parquet: 800MB
├─ address data: 500MB
├─ oppervlakte + year: 200MB
└─ energy labels: 100MB
```

---

## 9. API Endpoints to Create

After enrichment, add these endpoints:

```python
@app.get("/api/address/{postal_code}/{house_number}")
# Returns full address details including:
# - Coordinates
# - Floor area
# - Year built
# - Energy label
# - Building footprint
# - Neighborhood code

@app.get("/api/energy-label/{postal_code}/{house_number}")
# Dedicated endpoint for energy certificate details

@app.get("/api/building/{pand_id}")
# Get all addresses in a building (for apartments)
```

---

## Resources

- BAG Download: https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-2.0-extract
- BAG Documentation: https://www.geobasisregistraties.nl/basisregistraties/adressen-en-gebouwen
- Energy Labels API: https://public.ep-online.nl/
- Energy Labels Docs: https://www.ep-online.nl/PublicData
- RVO Info: https://www.rvo.nl/onderwerpen/duurzaam-ondernemen/gebouwen/wetten-en-regels/energielabel
