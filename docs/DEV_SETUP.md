# Development Setup Guide

Complete guide to set up the Where-to-Live-NL development environment on your local machine.

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for data ingestion scripts)
- **Git** (version control)

---

## Quick Start (5 minutes)

```bash
# 1. Navigate to frontend directory
cd D:\GitHub\where-to-live-nl\frontend

# 2. Install dependencies (if not already installed)
npm install

# 3. Start development server
npm run dev
```

The dev server will start on **http://localhost:3000**

---

## Detailed Setup Instructions

### 1. Frontend Development

#### Install Dependencies

```bash
cd frontend
npm install
```

This installs:
- Next.js 14.2.3 (React framework)
- MapLibre GL (open-source maps)
- Apache Arrow (for reading Parquet files)
- Tailwind CSS (styling)
- TypeScript (type safety)

#### Available Scripts

```bash
# Development server (with hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

#### Development Server

```bash
npm run dev
```

**Output:**
```
✓ Ready in 2.3s
○ Local:   http://localhost:3000
○ Network: http://192.168.1.x:3000
```

- Opens at `http://localhost:3000`
- Hot reload enabled (changes apply instantly)
- TypeScript errors shown in browser
- Network URL for testing on mobile devices

---

### 2. Backend / Data Pipeline

The backend is Python-based scripts for ETL (Extract, Transform, Load).

#### Setup Python Environment

```bash
cd scripts/etl

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

#### Installed Python Packages

- `polars` - Fast DataFrame library (Rust-powered)
- `httpx` - Async HTTP client
- `pyarrow` - Parquet file format
- `beautifulsoup4` - Web scraping (for WOZ)
- `tqdm` - Progress bars
- `pydantic` - Data validation
- `click` - CLI framework

---

## Project Structure

```
where-to-live-nl/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   │   ├── page.tsx     # Home page
│   │   │   └── api/         # API routes
│   │   ├── components/      # React components
│   │   │   ├── Map/         # Map components
│   │   │   └── AddressAutocomplete.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   └── styles/          # CSS files
│   ├── public/              # Static assets
│   ├── package.json         # Dependencies
│   └── tsconfig.json        # TypeScript config
│
├── scripts/etl/             # Data ingestion scripts
│   ├── ingest/              # Download scripts
│   │   ├── cbs_demographics.py
│   │   ├── crime.py
│   │   ├── leefbaarometer.py
│   │   ├── amenities_osm.py
│   │   └── ...
│   ├── transform/           # Parquet conversion scripts
│   │   ├── addresses_to_parquet.py
│   │   ├── cbs_demographics_to_parquet.py
│   │   ├── crime_to_parquet.py
│   │   ├── amenities_to_parquet.py
│   │   └── ...
│   └── requirements.txt     # Python dependencies
│
├── data/
│   ├── raw/                 # Raw JSON data (source)
│   └── processed/           # Optimized Parquet files
│
└── docs/                    # Documentation
```

---

## Available Data (After Conversion)

✅ **Successfully converted to Parquet:**

| Dataset | Size | Records | Description |
|---------|------|---------|-------------|
| **addresses.parquet** | 21 MB | 399,135 | All Dutch addresses with coordinates |
| **cbs_demographics.parquet** | 2.2 MB | 14,574 | Neighborhood demographics (133 fields) |
| **crime.parquet** | 7.1 MB | 1,091,382 | Crime statistics by neighborhood |
| **leefbaarometer.parquet** | 585 KB | - | Livability scores |
| **supermarkets.parquet** | 778 KB | 4,883 | Supermarket locations (with brands) |
| **healthcare.parquet** | 610 KB | 4,183 | Healthcare facilities |
| **playgrounds.parquet** | 270 KB | 7,214 | Playground locations |
| **schools.parquet** | 3 KB | 298 | School locations |
| **foundation_risk.parquet** | 2.4 MB | 1,000 | Foundation risk assessment |
| **air_quality.parquet** | 9.5 KB | - | Air quality stations |
| **woz-netherlands-complete.parquet** | 870 KB | ~6,000+ | WOZ property valuations (growing) |

**Total data size:** ~35 MB (highly compressed from 750+ MB JSON)

---

## Working with Parquet Files

### Reading Parquet in Python

```python
import polars as pl

# Load data
df = pl.read_parquet("data/processed/cbs_demographics.parquet")

# Show structure
print(df.shape)
print(df.columns)

# Query data
amsterdam = df.filter(pl.col("municipality") == "Amsterdam")
high_income = df.filter(pl.col("avg_income_per_resident") > 40000)
```

### Reading Parquet in TypeScript/JavaScript

```typescript
import { tableFromIPC } from 'apache-arrow';

// Fetch and parse Parquet
const response = await fetch('/data/processed/addresses.parquet');
const buffer = await response.arrayBuffer();
const table = tableFromIPC(buffer);

// Access data
for (const row of table) {
  console.log(row.postal_code, row.latitude, row.longitude);
}
```

---

## Common Development Tasks

### 1. Add New API Route

```typescript
// frontend/src/app/api/example/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const data = { message: 'Hello from API' };
  return NextResponse.json(data);
}
```

Access at: `http://localhost:3000/api/example`

### 2. Add New React Component

```typescript
// frontend/src/components/MyComponent.tsx
export function MyComponent() {
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold">My Component</h2>
    </div>
  );
}
```

### 3. Query Parquet Data

```typescript
// frontend/src/lib/parquet-reader.ts
import { tableFromIPC } from 'apache-arrow';

export async function loadAddresses() {
  const response = await fetch('/data/processed/addresses.parquet');
  const buffer = await response.arrayBuffer();
  return tableFromIPC(buffer);
}
```

### 4. Convert New Data Source to Parquet

```bash
# Option 1: Use existing transformation script
cd scripts/etl
python -m transform.addresses_to_parquet

# Option 2: Create new transformation script
# Copy an existing script from transform/ and modify it
```

---

## Environment Variables (Optional)

Create `.env.local` in the `frontend/` directory:

```bash
# Optional: Add environment-specific config
NEXT_PUBLIC_MAP_STYLE="https://api.pdok.nl/..."
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

---

## Data Ingestion (Advanced)

### Re-download Data Sources

```bash
cd scripts/etl

# Download CBS demographics
python -m ingest.cbs_demographics

# Download crime data
python -m ingest.crime

# Download amenities (supermarkets, healthcare, etc.)
python -m ingest.amenities_osm --amenity supermarket

# Convert to Parquet
python -m transform.cbs_demographics_to_parquet
python -m transform.crime_to_parquet
```

### WOZ Scraper (Long-running)

The WOZ scraper is currently running in the background:

```bash
cd scripts/etl
python scrape_all_woz.py --rate-limit 2.5
```

**Status:** ~6,000+ properties scraped (out of 889,197)
**Progress file:** `data/checkpoints/woz_netherlands_progress.json`
**Resume:** The script automatically resumes from the last checkpoint

---

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Frontend Dev Server | 3000 | http://localhost:3000 |
| Frontend Production | 3000 | http://localhost:3000 |

**No backend server needed** - API routes are built into Next.js!

---

## Troubleshooting

### Issue: "Port 3000 is already in use"

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (Windows)
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- -p 3001
```

### Issue: "Module not found"

```bash
# Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Cannot read Parquet files"

Make sure the parquet files exist in `data/processed/`:

```bash
ls -lh data/processed/
```

If missing, run the conversion scripts:

```bash
cd scripts/etl
python convert_all_to_parquet.py
```

### Issue: Python module errors

```bash
# Activate virtual environment
cd scripts/etl
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt --upgrade
```

---

## Testing Your Changes

### Frontend Testing

1. Start dev server: `npm run dev`
2. Open browser: http://localhost:3000
3. Make changes to `src/` files
4. Browser auto-reloads with changes

### Type Checking

```bash
cd frontend
npm run type-check
```

Catches TypeScript errors before runtime.

### Building for Production

```bash
cd frontend
npm run build

# If successful, start production server
npm start
```

---

## Next Steps

1. **Explore the map** - Open http://localhost:3000
2. **Check API routes** - Look in `frontend/src/app/api/`
3. **Add new features** - Create components in `frontend/src/components/`
4. **Query data** - Use the Parquet files in `data/processed/`

---

## Useful Links

- **Next.js Docs**: https://nextjs.org/docs
- **MapLibre GL Docs**: https://maplibre.org/maplibre-gl-js-docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Polars Docs**: https://pola-rs.github.io/polars/
- **Apache Arrow**: https://arrow.apache.org/docs/js/

---

## Getting Help

- Check existing documentation in `docs/`
- Review `ROADMAP.md` for planned features
- Look at `DATA_INGESTION_STATUS.md` for data status

---

**Happy coding!** 🚀

Last updated: November 11, 2025
