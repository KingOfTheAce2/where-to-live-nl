import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface TramMetroStop {
  stop_id: string
  stop_code: string
  name: string
  lat: number | null
  lng: number | null
  operators: string[]
  transport_types: string[]
  parent_station: string
  wheelchair_boarding: string
  platform_code: string
}

interface TramMetroData {
  metadata: {
    source: string
    downloaded_at: string
    total_stops: number
    operators: string[]
    stop_counts_by_operator: Record<string, number>
    types: string[]
    license: string
  }
  stops: TramMetroStop[]
}

let cachedData: TramMetroData | null = null

function loadData(): TramMetroData {
  if (cachedData) return cachedData

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'tram_metro_stops.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`Loaded ${cachedData!.stops.length} tram/metro stops`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load tram/metro data:', error)
    return {
      metadata: {
        source: '',
        downloaded_at: '',
        total_stops: 0,
        operators: [],
        stop_counts_by_operator: {},
        types: [],
        license: ''
      },
      stops: []
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator')
    const type = searchParams.get('type') // 'tram' or 'metro'
    const bbox = searchParams.get('bbox') // 'minLng,minLat,maxLng,maxLat'

    const data = loadData()
    let stops = data.stops

    // Filter by operator (GVB, HTM, RET, UOV)
    if (operator) {
      stops = stops.filter(s => s.operators.includes(operator.toUpperCase()))
    }

    // Filter by type (tram or metro)
    if (type) {
      stops = stops.filter(s => s.transport_types.includes(type.toLowerCase()))
    }

    // Filter by bounding box
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
      stops = stops.filter(s =>
        s.lat !== null && s.lng !== null &&
        s.lng >= minLng && s.lng <= maxLng &&
        s.lat >= minLat && s.lat <= maxLat
      )
    }

    // Deduplicate by name + operator (many platforms per stop)
    const uniqueStops = new Map<string, TramMetroStop>()
    for (const stop of stops) {
      const key = `${stop.name}-${stop.operators.join(',')}`
      if (!uniqueStops.has(key)) {
        uniqueStops.set(key, stop)
      }
    }

    const uniqueStopsArray = Array.from(uniqueStops.values())

    // Convert to GeoJSON for map
    const geojson = {
      type: 'FeatureCollection',
      features: uniqueStopsArray
        .filter(s => s.lat !== null && s.lng !== null)
        .map(stop => ({
          type: 'Feature',
          properties: {
            id: stop.stop_id,
            name: stop.name,
            operators: stop.operators,
            transport_types: stop.transport_types,
            wheelchair: stop.wheelchair_boarding === '1',
            platform: stop.platform_code
          },
          geometry: {
            type: 'Point',
            coordinates: [stop.lng, stop.lat]
          }
        }))
    }

    return NextResponse.json({
      success: true,
      count: geojson.features.length,
      metadata: data.metadata,
      geojson
    })
  } catch (error) {
    console.error('Error in tram-metro API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load tram/metro data' },
      { status: 500 }
    )
  }
}
