import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Supermarket {
  osm_id: number
  osm_type: string
  amenity_type: string
  name: string | null
  brand: string | null
  lat: number | null
  lng: number | null
  postcode: string | null
  city: string | null
}

interface SupermarketsData {
  metadata: {
    source: string
    downloaded_at: string
    total_amenities: number
  }
  data: Supermarket[]
}

// Cache the data in memory to avoid reading file on every request
let cachedData: SupermarketsData | null = null

function loadSupermarkets(): SupermarketsData {
  if (cachedData) {
    return cachedData
  }

  const dataPath = path.join(process.cwd(), '../data/raw/amenities_supermarkets.json')
  const fileContent = fs.readFileSync(dataPath, 'utf-8')
  const parsedData = JSON.parse(fileContent) as SupermarketsData
  cachedData = parsedData

  return parsedData
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Haversine formula - returns distance in kilometers
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

    // Get query parameters
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '5') // default 5km
    const limit = parseInt(searchParams.get('limit') || '100') // default 100 results

    // Load supermarkets data
    const supermarketsData = loadSupermarkets()

    // If no coordinates provided, return all supermarkets (with limit)
    if (!lat || !lng) {
      const limitedData = supermarketsData.data
        .filter(s => s.lat !== null && s.lng !== null)
        .slice(0, limit)

      return NextResponse.json({
        supermarkets: limitedData,
        total: supermarketsData.data.length,
        filtered: limitedData.length,
        metadata: supermarketsData.metadata
      })
    }

    // Filter supermarkets within radius and calculate distances
    const nearby = supermarketsData.data
      .filter(supermarket => {
        if (supermarket.lat === null || supermarket.lng === null) return false

        const distance = calculateDistance(lat, lng, supermarket.lat, supermarket.lng)
        return distance <= radius
      })
      .map(supermarket => ({
        ...supermarket,
        distance: calculateDistance(lat, lng, supermarket.lat!, supermarket.lng!)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return NextResponse.json({
      supermarkets: nearby,
      total: supermarketsData.data.length,
      filtered: nearby.length,
      center: { lat, lng },
      radius,
      metadata: supermarketsData.metadata
    })

  } catch (error) {
    console.error('Error fetching supermarkets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supermarkets data' },
      { status: 500 }
    )
  }
}
