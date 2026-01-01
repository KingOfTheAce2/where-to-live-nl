import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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

let cachedData: { metadata: any; data: LeefbaarometerItem[] } | null = null

function loadData() {
  if (cachedData) return cachedData

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'leefbaarometer.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`Loaded ${cachedData!.data.length} leefbaarometer records from local data`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load leefbaarometer data:', error)
    return { metadata: {}, data: [] }
  }
}

export async function GET() {
  try {
    const { metadata, data } = loadData()

    // Convert to GeoJSON FeatureCollection for the map
    const features = data
      .filter(item => item.geometry)
      .map(item => ({
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

    return NextResponse.json({
      success: true,
      count: features.length,
      metadata,
      features,
    })
  } catch (error) {
    console.error('Error in leefbaarometer API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load leefbaarometer data', details: String(error) },
      { status: 500 }
    )
  }
}
