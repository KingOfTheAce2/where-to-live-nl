"""
Batch convert all raw JSON data to optimized Parquet format.

This script runs all transformation scripts to convert data to Parquet.
"""

import subprocess
import sys
from pathlib import Path

def run_transform(script_name: str, args: list = None):
    """Run a transformation script."""
    cmd = [sys.executable, "-m", f"transform.{script_name}"]
    if args:
        cmd.extend(args)

    print(f"\n{'='*80}")
    print(f"Running: {' '.join(cmd)}")
    print('='*80)

    result = subprocess.run(cmd, cwd=Path(__file__).parent)
    if result.returncode != 0:
        print(f"WARNING: {script_name} failed with exit code {result.returncode}")
    return result.returncode == 0

def main():
    """Run all transformations."""
    print("="*80)
    print("BATCH PARQUET CONVERSION")
    print("="*80)
    print("\nThis will convert all raw JSON data to optimized Parquet format.")
    print("Estimated time: 5-10 minutes")
    print()

    results = {}

    # 1. Addresses (most important - 293 MB)
    print("\n[1/7] Converting addresses...")
    results['addresses'] = run_transform('addresses_to_parquet')

    # 2. Foundation risk (15 MB)
    print("\n[2/7] Converting foundation risk...")
    results['foundation_risk'] = run_transform('foundation_risk_to_parquet')

    # 3. Air quality (0.2 MB)
    print("\n[3/7] Converting air quality...")
    results['air_quality'] = run_transform('air_quality_to_parquet')

    # 4. Supermarkets (5.2 MB)
    print("\n[4/7] Converting supermarkets...")
    results['supermarkets'] = run_transform('amenities_to_parquet', [
        '--input', '../../data/raw/amenities_supermarkets.json',
        '--output', '../../data/processed/supermarkets.parquet',
        '--amenity-type', 'supermarket'
    ])

    # 5. Healthcare (3.9 MB)
    print("\n[5/7] Converting healthcare...")
    results['healthcare'] = run_transform('amenities_to_parquet', [
        '--input', '../../data/raw/amenities_healthcare.json',
        '--output', '../../data/processed/healthcare.parquet',
        '--amenity-type', 'healthcare'
    ])

    # 6. Playgrounds (3.7 MB)
    print("\n[6/7] Converting playgrounds...")
    results['playgrounds'] = run_transform('amenities_to_parquet', [
        '--input', '../../data/raw/amenities_playgrounds.json',
        '--output', '../../data/processed/playgrounds.parquet',
        '--amenity-type', 'playground'
    ])

    # 7. Schools (0.1 MB)
    print("\n[7/7] Converting schools...")
    results['schools'] = run_transform('amenities_to_parquet', [
        '--input', '../../data/raw/schools.json',
        '--output', '../../data/processed/schools.parquet',
        '--amenity-type', 'school'
    ])

    # Summary
    print("\n" + "="*80)
    print("CONVERSION SUMMARY")
    print("="*80)

    success_count = sum(1 for v in results.values() if v)
    total_count = len(results)

    for name, success in results.items():
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{name:20s} {status}")

    print(f"\nCompleted: {success_count}/{total_count}")

    if success_count == total_count:
        print("\n✓ All conversions successful!")
        print("\nNext steps:")
        print("1. Check data/processed/ directory for parquet files")
        print("2. Start the dev server: cd frontend && npm run dev")
    else:
        print(f"\n⚠ {total_count - success_count} conversions failed. Check logs above.")
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())
