# Data Storage Strategy: JSON vs Parquet vs PostgreSQL

> **TL;DR**: Use **Parquet** for government data, **PostgreSQL** for user data, **JSON** for config

---

## 🎯 Quick Decision Matrix

| Your Question | Answer |
|---------------|--------|
| **"Should I use JSON or SQL?"** | Both! Different data needs different storage |
| **"What about government datasets (BAG, CBS)?"** | Use **Parquet files** on Cloudflare R2 |
| **"What about user accounts & saved searches?"** | Use **PostgreSQL** (Supabase) |
| **"What about small configs?"** | Use **JSON** |

---

## 📊 Format Comparison

### The Three Storage Formats

| Format | Best For | Size (10M addresses) | Query Speed | Cost/GB |
|--------|----------|----------------------|-------------|---------|
| **JSON** | Config, API responses | 2.5 GB | ❌ Slow (full scan) | $0.015 |
| **Parquet** | Large read-heavy datasets | 500 MB | ✅ Fast (columnar) | $0.015 |
| **PostgreSQL** | Relational, frequent writes | 1.2 GB | ✅✅ Very fast (indexed) | $0.125 |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                  Your Application                     │
└───────┬────────────────────────────────────┬─────────┘
        │                                    │
        │ Government data queries            │ User data queries
        │ (addresses, livability)            │ (accounts, saved searches)
        ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│   Cloudflare R2      │          │  PostgreSQL          │
│   (Static Files)     │          │  (Supabase)          │
├──────────────────────┤          ├──────────────────────┤
│ • BAG (Parquet)      │          │ • auth.users         │
│ • CBS (Parquet)      │          │ • profiles           │
│ • Leefbaarometer     │          │ • saved_locations    │
│ • Crime stats        │          │ • saved_searches     │
│ • School locations   │          │ • user_reviews       │
│                      │          │                      │
│ ✅ 5-7 GB total      │          │ ✅ <100 MB initially │
│ ✅ $0/month (free)   │          │ ✅ $0/month (free)   │
│ ✅ Read-heavy        │          │ ✅ Write-heavy       │
│ ✅ Updated weekly    │          │ ✅ Updated constantly│
└──────────────────────┘          └──────────────────────┘
```

---

## 📁 Format 1: JSON

### ✅ When to Use JSON

1. **Configuration files**
   - `config.json`, `package.json`
   - Feature flags
   - Environment-specific settings

2. **Small datasets (<1,000 records)**
   - Municipality list (355 in NL)
   - Color schemes, UI translations

3. **API responses**
   - REST API standard format
   - Frontend expects JSON

4. **Temporary data processing**
   - Intermediate ETL steps
   - Download → JSON → Transform → Parquet

### ❌ Don't Use JSON For

- ❌ Large datasets (>10 MB)
- ❌ Frequent queries/filtering
- ❌ Data that needs indexing
- ❌ Production database

### JSON Example

```json
// data/config/municipalities.json
[
  {
    "name": "Amsterdam",
    "province": "Noord-Holland",
    "population": 872680,
    "coordinates": [4.9041, 52.3676]
  },
  {
    "name": "Rotterdam",
    "province": "Zuid-Holland",
    "population": 651446,
    "coordinates": [4.4777, 51.9244]
  }
]
```

**File size**: ~50 KB (355 municipalities)
**Query time**: 1-5 ms (load entire file)

---

## 📁 Format 2: Parquet

### ✅ When to Use Parquet

1. **Large government datasets**
   - BAG addresses (10M+ records)
   - CBS demographics (13K neighborhoods)
   - Crime statistics (time series)

2. **Analytical queries**
   - Filter by postal code
   - Aggregate by municipality
   - Read specific columns only

3. **Read-heavy workloads**
   - Data updated weekly/monthly
   - Thousands of users querying
   - No user modifications

4. **Cost optimization**
   - 80% smaller than JSON
   - Faster queries = less compute
   - Works with free tools (DuckDB)

### ❌ Don't Use Parquet For

- ❌ Frequent updates/writes (append-only)
- ❌ Small datasets (<1 MB)
- ❌ Configuration files (not human-readable)
- ❌ Relational data with JOINs

### Parquet Example

#### Creating Parquet Files

```typescript
// scripts/etl/bag/to-parquet.ts
import { writeParquet } from 'parquet-wasm';

// 1. Fetch data from API
const addresses = await fetchBAGAddresses();

// 2. Define schema (important for compression & query performance)
const schema = {
  id: { type: 'UTF8' },
  street: { type: 'UTF8' },
  houseNumber: { type: 'INT32' },
  postalCode: { type: 'UTF8' },
  city: { type: 'UTF8' },
  buildYear: { type: 'INT32' },
  surfaceArea: { type: 'INT32' },
  latitude: { type: 'DOUBLE' },
  longitude: { type: 'DOUBLE' },
  energyLabel: { type: 'UTF8' }
};

// 3. Write to Parquet with compression
const parquetBuffer = await writeParquet(addresses, {
  compression: 'SNAPPY', // Fast compression (70% smaller)
  schema: schema
});

// 4. Save to disk
await fs.writeFile('bag-addresses.parquet', parquetBuffer);

// 5. Upload to R2
await uploadToR2('bag-addresses.parquet', parquetBuffer);
```

#### Querying Parquet Files

```typescript
// workers/api/search.ts (Cloudflare Worker)
import * as duckdb from '@duckdb/duckdb-wasm';

export default {
  async fetch(request: Request, env: Env) {
    const { searchParams } = new URL(request.url);
    const postalCode = searchParams.get('postal');

    // Initialize DuckDB in WebAssembly
    const db = await duckdb.instantiate();

    // Query Parquet file WITHOUT loading entire file into memory
    const result = await db.query(`
      SELECT
        street,
        houseNumber,
        city,
        buildYear,
        energyLabel
      FROM read_parquet('https://r2.domain.com/bag-addresses.parquet')
      WHERE postalCode = '${postalCode}'
      LIMIT 100
    `);

    return Response.json(result);
  }
}
```

**File size comparison**:
- JSON: 2.5 GB
- JSON.gz: 750 MB
- **Parquet**: 500 MB (80% reduction!)

**Query speed**:
- JSON: Load 2.5 GB, scan all → 5-10 seconds
- **Parquet**: Read only relevant row groups → **50-200ms**

### Why Parquet is Amazing

```
┌─────────────────────────────────────────┐
│         Traditional JSON (Row-based)     │
├─────────────────────────────────────────┤
│ {id: 1, postal: "1012AB", year: 1900}  │ ← Read entire row
│ {id: 2, postal: "1013AC", year: 1920}  │ ← Read entire row
│ {id: 3, postal: "1012AB", year: 1950}  │ ← Read entire row
└─────────────────────────────────────────┘
To filter by postal code → Read ALL data

┌─────────────────────────────────────────┐
│      Parquet (Columnar Storage)         │
├─────────────────────────────────────────┤
│ Column: postalCode                      │
│ [1012AB, 1013AC, 1012AB, ...]          │ ← Read ONLY this column
│                                         │
│ Column: buildYear                       │
│ [1900, 1920, 1950, ...]                 │ ← Skip if not needed
└─────────────────────────────────────────┘
To filter by postal code → Read ONLY postal column
```

**Result**: 10-50x faster queries, 80% smaller files

---

## 📁 Format 3: PostgreSQL (SQL Database)

### ✅ When to Use PostgreSQL

1. **User data**
   - User accounts & authentication
   - Profiles, preferences
   - Saved locations, searches

2. **Relational data**
   - Foreign keys (user_id → saved_locations)
   - JOINs across tables
   - Data integrity constraints

3. **Frequent writes/updates**
   - New user registrations
   - Updating saved searches
   - User-generated content (reviews)

4. **Geospatial queries** (with PostGIS)
   - Find neighborhoods within radius
   - Points within polygons
   - Distance calculations

5. **ACID transactions**
   - Prevent data corruption
   - Atomic operations (all-or-nothing)

### ❌ Don't Use PostgreSQL For

- ❌ Static government data (expensive storage)
- ❌ Infrequently updated data (use Parquet instead)
- ❌ Very large datasets without queries (use R2)

### PostgreSQL Schema Example

```sql
-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT,
  language TEXT DEFAULT 'en',
  preferences JSONB DEFAULT '{}', -- Flexible nested data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved locations
CREATE TABLE saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,

  -- Address info
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,

  -- Geospatial data (PostGIS)
  coordinates GEOGRAPHY(Point, 4326),

  -- User notes
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  favorite BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_saved_locations_user ON saved_locations(user_id);

-- Spatial index for geo queries
CREATE INDEX idx_saved_locations_coords ON saved_locations USING GIST(coordinates);

-- Saved searches (travel time configurations)
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,

  name TEXT NOT NULL,

  -- Store search config as JSONB (flexible)
  config JSONB NOT NULL,
  -- Example: { "destinations": [{ "address": "...", "maxMinutes": 30 }], "filters": {...} }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- User-submitted reviews
CREATE TABLE neighborhood_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,

  neighborhood TEXT NOT NULL,
  municipality TEXT NOT NULL,

  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  would_recommend BOOLEAN NOT NULL,
  lived_from DATE,
  lived_until DATE,

  helpful_votes INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_neighborhood ON neighborhood_reviews(neighborhood, municipality);
```

### Querying PostgreSQL

```typescript
// app/api/saved-locations/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  const { data: { user } } = await supabase.auth.getUser();

  // Query with JOIN
  const { data, error } = await supabase
    .from('saved_locations')
    .select(`
      id,
      address,
      postal_code,
      notes,
      tags,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return Response.json(data);
}
```

### PostGIS Geospatial Query

```sql
-- Find all saved locations within 5 km of Amsterdam Centraal
SELECT
  address,
  postal_code,
  ST_Distance(
    coordinates,
    ST_SetSRID(ST_MakePoint(4.9003, 52.3791), 4326)::geography
  ) / 1000 AS distance_km
FROM saved_locations
WHERE ST_DWithin(
  coordinates,
  ST_SetSRID(ST_MakePoint(4.9003, 52.3791), 4326)::geography,
  5000 -- 5 km in meters
)
ORDER BY distance_km;
```

---

## 🎯 Recommended Architecture for Where-to-Live-NL

### Data Layer Design

```typescript
// lib/data/sources.ts

// 1. Government data → Parquet on R2
class GovernmentDataSource {
  async getAddressByPostal(postalCode: string) {
    // Query Parquet file via DuckDB
    return await duckdb.query(`
      SELECT * FROM read_parquet('https://r2.domain.com/bag-addresses.parquet')
      WHERE postalCode = '${postalCode}'
    `);
  }

  async getLivabilityScore(coordinates: [number, number]) {
    // Fetch from cached GeoJSON on R2
    const response = await fetch('https://r2.domain.com/leefbaarometer.json');
    const data = await response.json();
    return findNearestScore(data, coordinates);
  }
}

// 2. User data → PostgreSQL (Supabase)
class UserDataSource {
  async saveLocation(userId: string, location: Location) {
    return await supabase
      .from('saved_locations')
      .insert({
        user_id: userId,
        address: location.address,
        postal_code: location.postalCode,
        coordinates: `POINT(${location.lon} ${location.lat})`
      });
  }

  async getSavedLocations(userId: string) {
    return await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', userId);
  }
}

// 3. Config → JSON files
class ConfigSource {
  async getMunicipalities() {
    // Load from static JSON (cached)
    return await fetch('/data/municipalities.json').then(r => r.json());
  }
}
```

---

## 💾 Storage Costs Comparison

### Scenario: 10 million BAG addresses

| Format | Size | Storage Cost (R2) | Query Cost | Total/Month |
|--------|------|-------------------|------------|-------------|
| **JSON** | 2.5 GB | $0.0375 | $2.00 (slow queries) | **$2.04** |
| **Parquet** | 500 MB | $0.0075 | $0.40 (fast queries) | **$0.41** |
| **PostgreSQL** | 1.2 GB | $0.15 (DB storage) | $5.00 (compute) | **$5.15** |

**Winner for government data**: Parquet (5x cheaper than JSON, 12x cheaper than SQL)

### Scenario: 10,000 users with saved data

| Format | Size | Storage Cost | Query Cost | Total/Month |
|--------|------|--------------|------------|-------------|
| **JSON** | 50 MB | $0 (too small) | ❌ No queries | ❌ Not relational |
| **Parquet** | 10 MB | $0 | ❌ Append-only | ❌ No updates |
| **PostgreSQL** | 100 MB | $0 (free tier) | $0 (free tier) | **$0** ✅ |

**Winner for user data**: PostgreSQL (only option that supports writes & relations)

---

## 🚀 Performance Comparison

### Query: Find all addresses in postal code "1012AB"

#### JSON Approach
```javascript
// ❌ Load entire 2.5 GB file
const addresses = JSON.parse(await fs.readFile('bag.json'));
const result = addresses.filter(a => a.postalCode === '1012AB');
// Time: 5-10 seconds
// Memory: 2.5 GB
```

#### Parquet Approach
```javascript
// ✅ Query only relevant data
const result = await duckdb.query(`
  SELECT * FROM 'bag.parquet' WHERE postalCode = '1012AB'
`);
// Time: 50-200ms
// Memory: ~10 MB (only read relevant row groups)
```

#### PostgreSQL Approach
```sql
-- ✅✅ Use index for instant lookup
SELECT * FROM addresses WHERE postal_code = '1012AB';
-- Time: 10-50ms (with index)
-- Memory: Minimal (only result set)
```

**Winner**: PostgreSQL (fastest), but Parquet is best for static data (no DB overhead)

---

## 📋 Decision Tree

### Should I use JSON, Parquet, or PostgreSQL?

```
Start: What kind of data do you have?
│
├─ Configuration, small lists (<1 MB)
│  └─ Use JSON ✅
│
├─ Government data, read-only, large (>10 MB)
│  ├─ Updated rarely (weekly/monthly)
│  │  └─ Use Parquet ✅
│  └─ Updated constantly
│     └─ Use PostgreSQL ✅
│
├─ User data (accounts, saved items)
│  └─ Use PostgreSQL ✅
│
├─ Geospatial queries (distance, within polygon)
│  └─ Use PostgreSQL with PostGIS ✅
│
└─ Relational data (foreign keys, JOINs)
   └─ Use PostgreSQL ✅
```

---

## 🎯 Final Recommendations for Where-to-Live-NL

### 1. Cloudflare R2 (Parquet Files)

**Store here:**
- ✅ BAG addresses (10M+ records) → `bag-addresses.parquet` (500 MB)
- ✅ CBS demographics (13K neighborhoods) → `cbs-demographics.parquet` (50 MB)
- ✅ Leefbaarometer scores → `leefbaarometer.geojson` (300 MB)
- ✅ Crime statistics → `crime-stats.parquet` (50 MB)
- ✅ School locations → `schools.geojson` (20 MB)

**Why:**
- Updated weekly/monthly (ETL pipeline)
- Read-heavy (millions of queries)
- 80% smaller than JSON
- Free hosting (within 10 GB free tier)

### 2. Supabase PostgreSQL

**Store here:**
- ✅ `auth.users` (Supabase built-in)
- ✅ `profiles` (user preferences)
- ✅ `saved_locations` (user favorites)
- ✅ `saved_searches` (travel time configs)
- ✅ `neighborhood_reviews` (user-generated content)
- ✅ Spatial indexes for geo queries

**Why:**
- Frequent writes (new users, saved data)
- Relational integrity (foreign keys)
- ACID transactions
- PostGIS for geospatial queries
- Free tier: 500 MB (sufficient for user data)

### 3. JSON Files

**Store here:**
- ✅ `config/municipalities.json` (355 municipalities)
- ✅ `config/provinces.json` (12 provinces)
- ✅ `config/translations.json` (UI strings)

**Why:**
- Small (<1 MB)
- Human-readable (easy to edit)
- Version-controlled in Git

---

## 📊 Size & Cost Summary

| Data Source | Format | Size | Location | Cost |
|-------------|--------|------|----------|------|
| BAG addresses | Parquet | 500 MB | R2 | $0 |
| CBS demographics | Parquet | 100 MB | R2 | $0 |
| Leefbaarometer | GeoJSON | 300 MB | R2 | $0 |
| Crime stats | Parquet | 50 MB | R2 | $0 |
| Schools | GeoJSON | 20 MB | R2 | $0 |
| **Subtotal (R2)** | | **~1 GB** | | **$0** |
| | | | | |
| User accounts | PostgreSQL | 50 MB | Supabase | $0 |
| Saved locations | PostgreSQL | 20 MB | Supabase | $0 |
| Reviews | PostgreSQL | 10 MB | Supabase | $0 |
| **Subtotal (DB)** | | **~80 MB** | | **$0** |
| | | | | |
| Config files | JSON | 1 MB | Git/Vercel | $0 |
| | | | | |
| **Grand Total** | | **~1.1 GB** | | **$0/month** ✅ |

---

## 🔧 Tools & Libraries

### Working with Parquet
```bash
npm install parquet-wasm @duckdb/duckdb-wasm
```

### Working with PostgreSQL
```bash
npm install @supabase/supabase-js
```

### Working with JSON
```bash
# Built-in, no libraries needed
```

---

## 📚 Further Reading

- [Apache Parquet Documentation](https://parquet.apache.org/)
- [DuckDB WASM](https://duckdb.org/docs/api/wasm)
- [PostGIS Documentation](https://postgis.net/)
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)

---

**Last Updated**: November 3, 2025
**Questions?** Open a GitHub Discussion or check the ROADMAP.md for implementation details
