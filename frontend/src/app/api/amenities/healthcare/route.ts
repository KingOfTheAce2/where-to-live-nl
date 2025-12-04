import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Healthcare {
  osm_id: number
  osm_type: string
  amenity_type: string
  name: string | null
  lat: number | null
  lng: number | null
  postcode: string | null
  city: string | null
  tags: Record<string, any>
}

interface HealthcareData {
  metadata: {
    source: string
    downloaded_at: string
    total_amenities: number
  }
  data: Healthcare[]
}

// Cache the data in memory
let cachedData: HealthcareData | null = null

function loadHealthcare(): HealthcareData {
  if (cachedData) {
    return cachedData
  }

  const dataPath = path.join(process.cwd(), '../data/raw/amenities_healthcare.json')
  const fileContent = fs.readFileSync(dataPath, 'utf-8')
  const parsedData = JSON.parse(fileContent) as HealthcareData
  cachedData = parsedData

  return parsedData
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '5')
    const limit = parseInt(searchParams.get('limit') || '100')
    const type = searchParams.get('type') // Filter by amenity type (hospital, clinic, doctors, pharmacy)

    const healthcareData = loadHealthcare()

    // If no coordinates provided, return all healthcare facilities (with limit)
    if (!lat || !lng) {
      let filteredData = healthcareData.data.filter(h => h.lat !== null && h.lng !== null)

      // Apply type filter if specified
      if (type) {
        filteredData = filteredData.filter(h =>
          h.tags?.amenity?.toLowerCase().includes(type.toLowerCase())
        )
      }

      const limitedData = filteredData.slice(0, limit)

      return NextResponse.json({
        healthcare: limitedData,
        total: healthcareData.data.length,
        filtered: limitedData.length,
        metadata: healthcareData.metadata
      })
    }

    // Filter healthcare facilities within radius
    let nearby = healthcareData.data
      .filter(facility => {
        if (facility.lat === null || facility.lng === null) return false

        const distance = calculateDistance(lat, lng, facility.lat, facility.lng)
        return distance <= radius
      })

    // Apply type filter if specified
    if (type) {
      nearby = nearby.filter(h =>
        h.tags?.amenity?.toLowerCase().includes(type.toLowerCase())
      )
    }

    const result = nearby
      .map(facility => ({
        ...facility,
        distance: calculateDistance(lat, lng, facility.lat!, facility.lng!)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return NextResponse.json({
      healthcare: result,
      total: healthcareData.data.length,
      filtered: result.length,
      center: { lat, lng },
      radius,
      metadata: healthcareData.metadata
    })

  } catch (error) {
    console.error('Error fetching healthcare data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch healthcare data' },
      { status: 500 }
    )
  }
}
