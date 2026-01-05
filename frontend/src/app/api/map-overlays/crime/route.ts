import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface CrimeFeature {
  type: string
  properties: {
    id: string
    area_code: string
    area_name: string
    municipality: string
    crime_count: number
    year: string
  }
  geometry: any
}

interface CrimeData {
  type: string
  metadata: any
  features: CrimeFeature[]
}

let cachedData: CrimeData | null = null

function loadData(): CrimeData {
  if (cachedData) return cachedData

  // Use the crime overlay GeoJSON (with geometries), not the raw CBS data
  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'crime_overlay.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`Loaded ${cachedData!.features.length} crime zones from crime_overlay.json`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load crime overlay data:', error)
    return { type: 'FeatureCollection', metadata: {}, features: [] }
  }
}

export async function GET() {
  try {
    const data = loadData()

    return NextResponse.json({
      success: true,
      count: data.features.length,
      metadata: data.metadata,
      features: data.features,
    })
  } catch (error) {
    console.error('Error in crime API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load crime data', details: String(error) },
      { status: 500 }
    )
  }
}
