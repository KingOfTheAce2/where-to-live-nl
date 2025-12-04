"""Check data ingestion status - what's missing, what needs conversion."""
from pathlib import Path
import json

def check_status():
    raw_dir = Path("../../data/raw")
    processed_dir = Path("../../data/processed")

    print("=" * 80)
    print("RAW DATA FILES (JSON)")
    print("=" * 80)

    raw_files = {}
    for f in sorted(raw_dir.glob("*.json")):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"{f.name:<50s} {size_mb:>8.1f} MB")
        raw_files[f.stem] = size_mb

    print("\n" + "=" * 80)
    print("PROCESSED DATA FILES (PARQUET)")
    print("=" * 80)

    processed_files = {}
    for f in sorted(processed_dir.glob("*.parquet")):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"{f.name:<50s} {size_mb:>8.1f} MB")
        processed_files[f.stem] = size_mb

    print("\n" + "=" * 80)
    print("MISSING CONVERSIONS (RAW BUT NOT PROCESSED)")
    print("=" * 80)

    needs_conversion = []

    # Check which raw files don't have corresponding parquet
    conversions_needed = {
        "air_quality": "Air quality measurements",
        "foundation_risk": "Foundation risk data",
        "netherlands_all_addresses_with_coords": "Full address dataset with coordinates",
        "amenities_supermarkets": "Supermarket locations",
        "amenities_healthcare": "Healthcare facility locations",
        "amenities_playgrounds": "Playground locations",
        "amenities_parks_improved": "Park locations (improved)",
        "schools": "School locations",
    }

    for raw_name, description in conversions_needed.items():
        if raw_name in raw_files and not any(raw_name in p for p in processed_files.keys()):
            needs_conversion.append((raw_name, description, raw_files[raw_name]))
            print(f"✗ {description:<40s} ({raw_name}.json - {raw_files[raw_name]:.1f} MB)")

    if not needs_conversion:
        print("✓ All data has been converted to parquet!")

    print("\n" + "=" * 80)
    print("DATA QUALITY CHECK")
    print("=" * 80)

    # Check small/empty files
    suspicious = []
    for name, size in raw_files.items():
        if size < 0.5:  # Less than 500KB
            suspicious.append((name, size))
            print(f"⚠ {name}.json is suspiciously small ({size:.1f} MB) - may be empty/incomplete")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Raw files: {len(raw_files)}")
    print(f"Processed files: {len(processed_files)}")
    print(f"Needs conversion: {len(needs_conversion)}")
    print(f"Suspicious files: {len(suspicious)}")

    return needs_conversion, suspicious

if __name__ == "__main__":
    needs_conversion, suspicious = check_status()
