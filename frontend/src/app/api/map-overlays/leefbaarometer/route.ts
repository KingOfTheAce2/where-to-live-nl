import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Route segment config for large responses
export const maxDuration = 30 // 30 seconds timeout
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache for 1 hour

interface LeefbaarometerItem {
  id: string
  area_code: string
  area_name: string
  municipality: string
  scale: string
  year: string
  score_total: number
  score_deviation: number
  score_physical: number
  score_nuisance: number
  score_social: number
  score_facilities: number
  score_housing: number
  geometry: any
}

// In-memory cache for converted GeoJSON
let cachedGeoJSON: any = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

function loadAndConvertData() {
  const now = Date.now()

  // Return cached GeoJSON if valid
  if (cachedGeoJSON && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Using cached leefbaarometer GeoJSON')
    return cachedGeoJSON
  }

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'leefbaarometer.json')

  try {
    console.log('Loading leefbaarometer data from:', dataPath)
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const rawData = JSON.parse(fileContent)

    // Convert to GeoJSON immediately and cache
    const features = rawData.data
      .filter((item: LeefbaarometerItem) => item.geometry)
      .map((item: LeefbaarometerItem) => ({
        type: 'Feature',
        id: item.id,
        properties: {
          id: item.id,
          area_code: item.area_code,
          area_name: item.area_name,
          municipality: item.municipality,
          scale: item.scale,
          year: item.year,
          score_total: item.score_total,
          score_physical: item.score_physical,
          score_nuisance: item.score_nuisance,
          score_social: item.score_social,
          score_facilities: item.score_facilities,
          score_housing: item.score_housing,
        },
        geometry: item.geometry,
      }))

    cachedGeoJSON = {
      success: true,
      count: features.length,
      metadata: rawData.metadata,
      features,
    }
    cacheTimestamp = now

    console.log(`Loaded and cached ${features.length} leefbaarometer records`)
    return cachedGeoJSON
  } catch (error) {
    console.error('Failed to load leefbaarometer data:', error)
    return { success: false, count: 0, metadata: {}, features: [] }
  }
}

export async function GET() {
  try {
    const data = loadAndConvertData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in leefbaarometer API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load leefbaarometer data', details: String(error) },
      { status: 500 }
    )
  }
}
