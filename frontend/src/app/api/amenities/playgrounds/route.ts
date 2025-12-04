import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Playground {
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

interface PlaygroundsData {
  metadata: {
    source: string
    downloaded_at: string
    total_amenities: number
  }
  data: Playground[]
}

// Cache the data in memory
let cachedData: PlaygroundsData | null = null

function loadPlaygrounds(): PlaygroundsData {
  if (cachedData) {
    return cachedData
  }

  const dataPath = path.join(process.cwd(), '../data/raw/amenities_playgrounds.json')
  const fileContent = fs.readFileSync(dataPath, 'utf-8')
  const parsedData = JSON.parse(fileContent) as PlaygroundsData
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

    const playgroundsData = loadPlaygrounds()

    // If no coordinates provided, return all playgrounds (with limit)
    if (!lat || !lng) {
      const limitedData = playgroundsData.data
        .filter(p => p.lat !== null && p.lng !== null)
        .slice(0, limit)

      return NextResponse.json({
        playgrounds: limitedData,
        total: playgroundsData.data.length,
        filtered: limitedData.length,
        metadata: playgroundsData.metadata
      })
    }

    // Filter playgrounds within radius
    const nearby = playgroundsData.data
      .filter(playground => {
        if (playground.lat === null || playground.lng === null) return false

        const distance = calculateDistance(lat, lng, playground.lat, playground.lng)
        return distance <= radius
      })
      .map(playground => ({
        ...playground,
        distance: calculateDistance(lat, lng, playground.lat!, playground.lng!)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return NextResponse.json({
      playgrounds: nearby,
      total: playgroundsData.data.length,
      filtered: nearby.length,
      center: { lat, lng },
      radius,
      metadata: playgroundsData.metadata
    })

  } catch (error) {
    console.error('Error fetching playgrounds data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch playgrounds data' },
      { status: 500 }
    )
  }
}
