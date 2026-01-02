# Public Data Files

This directory contains data files split by Dutch postal code prefix for efficient loading and GitHub storage.

## Structure

```
data/public/
├── addresses/               # All Netherlands addresses (~9M)
│   ├── addresses_1xxx.parquet
│   ├── addresses_2xxx.parquet
│   └── ...
├── energielabels/           # Energy labels for 2.2M+ buildings
│   ├── energielabels_1xxx.parquet
│   ├── energielabels_2xxx.parquet
│   └── ...
├── properties/              # Properties with merged data
│   ├── properties_1xxx.parquet
│   └── ...
└── woz/                     # WOZ property valuations
    ├── woz_1xxx.parquet
    └── ...
```

## Dutch Postal Code Regions

| Prefix | Regions | Approx. Addresses |
|--------|---------|-------------------|
| 1xxx | Amsterdam, Haarlem, Noord-Holland | ~1.2M |
| 2xxx | Rotterdam, Den Haag, Zuid-Holland | ~1.1M |
| 3xxx | Utrecht, Amersfoort, Flevoland | ~1.0M |
| 4xxx | Breda, Zeeland, West-Brabant | ~500K |
| 5xxx | Eindhoven, Tilburg, Noord-Brabant | ~800K |
| 6xxx | Maastricht, Nijmegen, Limburg | ~700K |
| 7xxx | Enschede, Zwolle, Overijssel | ~600K |
| 8xxx | Lelystad, Leeuwarden, Friesland | ~400K |
| 9xxx | Groningen, Assen, Drenthe | ~400K |

## Usage

### Python with Polars
```python
import polars as pl

# Load specific region
df = pl.read_parquet('data/public/addresses/addresses_1xxx.parquet')

# Load all addresses
df = pl.read_parquet('data/public/addresses/*.parquet')

# Filter by specific postal code
df_amsterdam = df.filter(pl.col('postal_code').str.starts_with('10'))
```

### Python with Pandas
```python
import pandas as pd

# Load single region
df = pd.read_parquet('data/public/energielabels/energielabels_1xxx.parquet')

# Load multiple
import glob
files = glob.glob('data/public/energielabels/*.parquet')
df = pd.concat([pd.read_parquet(f) for f in files])
```

## Data Schemas

### addresses
| Column | Type | Description |
|--------|------|-------------|
| id | str | PDOK address ID |
| street | str | Street name |
| house_number | int | House number |
| house_letter | str | House letter (optional) |
| house_addition | str | House addition (optional) |
| postal_code | str | 4-digit + 2-letter postal code |
| city | str | City/place name |
| municipality | str | Municipality name |
| province | str | Province name |
| latitude | float | WGS84 latitude |
| longitude | float | WGS84 longitude |

### energielabels
| Column | Type | Description |
|--------|------|-------------|
| postal_code | str | Postal code |
| house_number | int | House number |
| house_letter | str | House letter |
| energy_label | str | Label A-G |
| energy_label_numeric | int | 1 (G) to 7 (A) |
| energy_index | float | Energy index value |
| building_year | int | Construction year |
| surface_area_m2 | int | Living area in m² |
| building_type | str | Type of building |

### woz
| Column | Type | Description |
|--------|------|-------------|
| postal_code | str | Postal code |
| house_number | int | House number |
| woz_2024 | int | WOZ value for 2024 |
| woz_2023 | int | WOZ value for 2023 |
| ... | ... | Historical values |
| bouwjaar | int | Construction year |
| oppervlakte | int | Surface area |

## Scripts

### Download all addresses
```bash
# Full download (~6-8 hours)
python scripts/etl/build_full_dataset.py download-addresses

# Single prefix only
python scripts/etl/build_full_dataset.py download-addresses --prefix 9
```

### Build properties dataset
```bash
# Merge addresses with energy labels
python scripts/etl/build_full_dataset.py build-properties
```

### Split existing processed data
```bash
# Split energielabels.parquet into postal code files
python scripts/etl/transform/split_data_by_postal_code.py --dataset energielabels

# Split all datasets
python scripts/etl/transform/split_data_by_postal_code.py --dataset all --verify
```

### Scrape WOZ values
```bash
# Continue WOZ scraping (outputs directly to data/public/woz/)
python scripts/etl/scrape_all_woz.py --rate-limit 5.0

# Scrape specific region only
python scripts/etl/scrape_all_woz.py --rate-limit 5.0 --prefix 9
```

## Data Sources

- **Addresses**: PDOK Locatieserver (BAG)
- **Energy Labels**: RVO (Rijksdienst voor Ondernemend Nederland)
- **WOZ Values**: WOZ Waardeloket
- **Properties**: BAG (Basisregistratie Adressen en Gebouwen)

## File Size Limits

All files are kept under 100MB for GitHub compatibility:
- Each postal prefix typically contains 100K-500K records
- Parquet compression keeps files at 2-20MB each
- Total dataset size: ~100-200MB
