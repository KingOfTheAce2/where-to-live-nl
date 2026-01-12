import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Route segment config for large responses
export const maxDuration = 30 // 30 seconds timeout
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache for 1 hour

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

// In-memory cache
let cachedResponse: any = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

function loadData(): any {
  const now = Date.now()

  // Return cached response if valid
  if (cachedResponse && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Using cached crime overlay data')
    return cachedResponse
  }

  // Use the crime overlay GeoJSON (with geometries), not the raw CBS data
  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'crime_overlay.json')

  try {
    console.log('Loading crime overlay data from:', dataPath)
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const data: CrimeData = JSON.parse(fileContent)

    cachedResponse = {
      success: true,
      count: data.features.length,
      metadata: data.metadata,
      features: data.features,
    }
    cacheTimestamp = now

    console.log(`Loaded and cached ${data.features.length} crime zones`)
    return cachedResponse
  } catch (error) {
    console.error('Failed to load crime overlay data:', error)
    return { success: false, count: 0, metadata: {}, features: [] }
  }
}

export async function GET() {
  try {
    const data = loadData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in crime API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load crime data', details: String(error) },
      { status: 500 }
    )
  }
}
