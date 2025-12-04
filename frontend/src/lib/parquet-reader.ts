/**
 * Parquet file reader utilities for server-side data access
 */

import * as arrow from 'apache-arrow'
import * as fs from 'fs'
import path from 'path'
import parquet from 'parquetjs'

export interface DemographicsData {
  area_code: string
  municipality: string
  population: number
  males: number
  females: number
  age_0_15: number
  age_15_25: number
  age_25_45: number
  age_45_65: number
  age_65_plus: number
  pct_age_0_15: number
  pct_age_15_25: number
  pct_age_25_45: number
  pct_age_45_65: number
  pct_age_65_plus: number
  households_total: number
  households_single: number
  households_with_children: number
  pct_households_single: number
  pct_households_with_children: number
  avg_household_size: number
  housing_stock: number
  avg_woz_value_euro: number
  pct_single_family_homes: number
  pct_multi_family_homes: number
  pct_owner_occupied: number
  pct_rental: number
  avg_income_per_resident: number
  pct_low_income_households: number
  dist_to_gp_km: number
  dist_to_supermarket_km: number
  dist_to_daycare_km: number
  dist_to_school_km: number
  total_cars: number
  cars_per_household: number
}

/**
 * Generic parquet file reader
 * Reads any parquet file and returns an array of row objects
 */
export async function readParquetFile<T = any>(filePath: string): Promise<T[]> {
  try {
    const reader = await parquet.ParquetReader.openFile(filePath)
    const cursor = reader.getCursor()
    const records: T[] = []

    let record = null
    while ((record = await cursor.next())) {
      records.push(record as T)
    }

    await reader.close()
    return records
  } catch (error) {
    console.error('Error reading parquet file:', error)
    throw error
  }
}

/**
 * Find neighborhood by coordinates (simplified lookup)
 * In production, this should use a spatial index or PostGIS
 */
export async function findNeighborhoodByCoordinates(
  lat: number,
  lng: number
): Promise<string | null> {
  // TODO: Implement proper reverse geocoding
  // For now, return null - we'll need to implement BAG address -> neighborhood lookup
  return null
}

/**
 * Read demographics data for a specific neighborhood
 */
export async function getDemographicsByAreaCode(
  areaCode: string
): Promise<DemographicsData | null> {
  try {
    const dataPath = path.join(process.cwd(), '../data/processed/cbs_demographics.parquet')

    // Read the parquet file
    const buffer = fs.readFileSync(dataPath)
    const table = arrow.tableFromIPC(buffer)

    // Find the row with matching area_code
    const areaCodeColumn = table.getChild('area_code')
    if (!areaCodeColumn) {
      console.error('area_code column not found in parquet file')
      return null
    }

    // Iterate through rows to find match
    for (let i = 0; i < table.numRows; i++) {
      if (areaCodeColumn.get(i) === areaCode) {
        // Build the demographics object from the row
        const row: any = {}
        for (let j = 0; j < table.numCols; j++) {
          const field = table.schema.fields[j]
          row[field.name] = table.getChildAt(j)?.get(i)
        }
        return row as DemographicsData
      }
    }

    return null
  } catch (error) {
    console.error('Error reading demographics parquet:', error)
    return null
  }
}

/**
 * Get demographics for all neighborhoods in a municipality
 *
 * NOTE: This function is currently not implemented as it requires a parquet reader library
 * that is not compatible with Node.js server-side rendering.
 * Use the Python backend API instead for this functionality.
 */
export async function getDemographicsByMunicipality(
  municipality: string
): Promise<DemographicsData[]> {
  console.warn('getDemographicsByMunicipality is not implemented - use Python backend API instead')
  return []
}

/**
 * Format demographics data for frontend display
 */
export function formatDemographicsForDisplay(data: DemographicsData) {
  return {
    population: {
      total: data.population,
      males: data.males,
      females: data.females,
      density: data.housing_stock > 0 ? Math.round(data.population / data.housing_stock * 100) / 100 : null,
    },
    ageDistribution: {
      age_0_15: { count: data.age_0_15, percentage: data.pct_age_0_15 },
      age_15_25: { count: data.age_15_25, percentage: data.pct_age_15_25 },
      age_25_45: { count: data.age_25_45, percentage: data.pct_age_25_45 },
      age_45_65: { count: data.age_45_65, percentage: data.pct_age_45_65 },
      age_65_plus: { count: data.age_65_plus, percentage: data.pct_age_65_plus },
    },
    households: {
      total: data.households_total,
      avgSize: data.avg_household_size,
      single: { count: data.households_single, percentage: data.pct_households_single },
      withChildren: { count: data.households_with_children, percentage: data.pct_households_with_children },
    },
    housing: {
      stock: data.housing_stock,
      avgWozValue: data.avg_woz_value_euro,
      singleFamily: data.pct_single_family_homes,
      multiFamily: data.pct_multi_family_homes,
      ownerOccupied: data.pct_owner_occupied,
      rental: data.pct_rental,
    },
    income: {
      avgPerResident: data.avg_income_per_resident,
      lowIncomeHouseholds: data.pct_low_income_households,
    },
    accessibility: {
      distanceToGP: data.dist_to_gp_km,
      distanceToSupermarket: data.dist_to_supermarket_km,
      distanceToDaycare: data.dist_to_daycare_km,
      distanceToSchool: data.dist_to_school_km,
    },
    mobility: {
      totalCars: data.total_cars,
      carsPerHousehold: data.cars_per_household,
    },
  }
}
