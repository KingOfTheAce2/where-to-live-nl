# quick start guide

**get the app running in 5 minutes**

---

## step 1: start the python backend (required!)

the frontend needs the backend API to load neighborhood data, crime stats, boundaries, etc.

### install python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### start the API server

```bash
cd backend
python api_server.py
```

**you should see:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**keep this terminal open** - the server must stay running!

---

## step 2: start the frontend

### install dependencies (first time only)

```bash
cd frontend
npm install
```

### start dev server

```bash
cd frontend
npm run dev
```

**open:** http://localhost:3000

---

## troubleshooting

###  CORS errors?

**symptom:** console shows `CORS-header 'Access-Control-Allow-Origin' ontbreekt`

**cause:** backend not running

**fix:** make sure `python api_server.py` is running in the background

### neighbourhood boundaries not showing?

**symptom:** boundaries don't appear when you search an address

**cause:** backend not running OR missing data

**fix:**
1. check backend is running
2. check `/data/processed/` has parquet files

### amenities not showing?

**symptom:** no supermarkets/healthcare/playgrounds on map

**cause:** missing parquet files or backend not returning data

**fix:** run the parquet conversion scripts (see DATA_CONVERSION_COMPLETE.md)

---

## both servers running?

you should have **2 terminals open**:

**terminal 1 (backend):**
```
D:\GitHub\where-to-live-nl\backend> python api_server.py
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**terminal 2 (frontend):**
```
D:\GitHub\where-to-live-nl\frontend> npm run dev
✓ Ready in 2.3s
○ Local:   http://localhost:3000
```

---

## what works now

✅ map with PDOK tiles
✅ address search (PDOK autocomplete)
✅ neighbourhood boundaries (purple overlay)
✅ nearby amenities (supermarkets, healthcare, playgrounds)
✅ crime overlay (blue dots)
✅ air quality overlay (green dots)
✅ foundation risk overlay (orange areas)
✅ neighbourhood snapshot (demographics, crime, livability)

---

## what's missing

❌ flooding risk overlay - **will add**
❌ WOZ property values (still scraping - only ~6k of 889k)
❌ livability score breakdown details - **will add**
❌ public transport routing - see COMMUTE_TIME_APIS.md
❌ copyright in separate tab - **will add**

---

## data files needed

the backend needs these files in `data/processed/`:

```
data/processed/
├── addresses.parquet              ✓ 21 MB
├── cbs_demographics.parquet       ✓ 2.2 MB
├── crime.parquet                  ✓ 7.1 MB
├── leefbaarometer.parquet         ✓ 585 KB
├── foundation_risk.parquet        ✓ 2.4 MB
├── supermarkets.parquet           ✓ 778 KB
├── healthcare.parquet             ✓ 610 KB
├── playgrounds.parquet            ✓ 270 KB
├── air_quality.parquet            ✓ 9.5 KB
└── woz-netherlands-complete.parquet  ✓ 870 KB
```

all these files were created by the conversion scripts.

---

**last updated:** november 11, 2025
