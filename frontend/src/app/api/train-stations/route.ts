import { NextRequest, NextResponse } from 'next/server'
import { readParquetFile } from '@/lib/parquet-reader'
import path from 'path'

interface TrainStationFilter {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  operator?: string
  railwayType?: 'station' | 'halt' // station or halt
}

interface TrainStation {
  id: number
  name: string
  name_en?: string
  name_nl?: string
  lat: number
  lon: number
  railway_type: string
  operator: string
  network?: string
  station_code?: string
  wheelchair?: string
  platforms?: string
  local_ref?: string
  wikidata?: string
  wikipedia?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Build backend URL
    const backendUrl = new URL('http://localhost:8000/api/train-stations')

    // Forward all query parameters to backend
    const minLat = searchParams.get('minLat')
    const maxLat = searchParams.get('maxLat')
    const minLng = searchParams.get('minLng')
    const maxLng = searchParams.get('maxLng')
    const limit = searchParams.get('limit')

    if (minLat) backendUrl.searchParams.set('minLat', minLat)
    if (maxLat) backendUrl.searchParams.set('maxLat', maxLat)
    if (minLng) backendUrl.searchParams.set('minLng', minLng)
    if (maxLng) backendUrl.searchParams.set('maxLng', maxLng)
    if (limit) backendUrl.searchParams.set('limit', limit)

    // Fetch from Python backend
    const backendResponse = await fetch(backendUrl.toString(), {
      headers: { 'Content-Type': 'application/json' }
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend API returned ${backendResponse.status}`)
    }

    const data = await backendResponse.json()

    // Transform backend response to match expected format
    const transformedStations = data.stations.map((station: any) => ({
      id: station.station_code || station.name,
      name: station.name,
      nameEn: station.name,
      nameNl: station.name,
      coordinates: station.coordinates,
      type: station.railway_type,
      operator: station.operator,
      stationCode: station.station_code,
    }))

    return NextResponse.json({
      success: true,
      count: transformedStations.length,
      total: data.count,
      stations: transformedStations,
    })
  } catch (error) {
    console.error('Error fetching train stations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch train stations', details: String(error) },
      { status: 500 }
    )
  }
}
