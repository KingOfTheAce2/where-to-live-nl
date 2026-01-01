import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface TrainStation {
  id: number
  name: string
  name_en?: string | null
  name_nl?: string | null
  lat: number
  lon: number
  railway_type: string
  operator: string
  network?: string | null
  station_code?: string | null
  wheelchair?: string | null
  platforms?: string | null
  local_ref?: string | null
  wikidata?: string | null
  wikipedia?: string | null
}

let cachedStations: TrainStation[] | null = null

function loadStations(): TrainStation[] {
  if (cachedStations) return cachedStations

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'train_stations.json')

  try {
    const data = fs.readFileSync(dataPath, 'utf-8')
    cachedStations = JSON.parse(data)
    console.log(`✅ Loaded ${cachedStations!.length} train stations from local data`)
    return cachedStations!
  } catch (error) {
    console.error('Failed to load train stations:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const minLat = parseFloat(searchParams.get('minLat') || '-90')
    const maxLat = parseFloat(searchParams.get('maxLat') || '90')
    const minLng = parseFloat(searchParams.get('minLng') || '-180')
    const maxLng = parseFloat(searchParams.get('maxLng') || '180')
    const limit = parseInt(searchParams.get('limit') || '500')
    const operator = searchParams.get('operator')
    const stationType = searchParams.get('type') // 'train' or 'metro'

    // Train operators (NS and regional rail)
    const trainOperators = ['NS', 'Nederlandse Spoorwegen', 'NS Groep', 'Arriva', 'Syntus', 'Connexxion', 'Keolis', 'Breng', 'ProRail']
    // Metro/tram operators (Amsterdam GVB, The Hague HTM, Rotterdam RET, Utrecht Qbuzz)
    const metroOperators = ['GVB', 'Gemeentelijk Vervoerbedrijf', 'HTM', 'RET', 'Rotterdamse Elektrische Tram', 'Qbuzz']

    const allStations = loadStations()

    // Filter by bounds
    let filtered = allStations.filter(station =>
      station.lat >= minLat &&
      station.lat <= maxLat &&
      station.lon >= minLng &&
      station.lon <= maxLng
    )

    // Filter by station type
    if (stationType === 'train') {
      filtered = filtered.filter(s =>
        trainOperators.some(op => s.operator?.includes(op))
      )
    } else if (stationType === 'metro') {
      filtered = filtered.filter(s =>
        metroOperators.some(op => s.operator?.includes(op))
      )
    }

    // Filter by specific operator if provided
    if (operator) {
      filtered = filtered.filter(s =>
        s.operator?.toLowerCase().includes(operator.toLowerCase())
      )
    }

    // Limit results
    const stations = filtered.slice(0, limit)

    // Transform to expected format
    const transformedStations = stations.map(station => ({
      id: station.id,
      name: station.name,
      nameEn: station.name_en || station.name,
      nameNl: station.name_nl || station.name,
      coordinates: {
        lat: station.lat,
        lng: station.lon
      },
      type: station.railway_type,
      operator: station.operator,
      stationCode: station.station_code,
      wheelchair: station.wheelchair,
      platforms: station.platforms,
    }))

    return NextResponse.json({
      success: true,
      count: transformedStations.length,
      total: filtered.length,
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
