import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface TramMetroLine {
  route_id: string
  operator: string
  line_name: string
  line_long_name: string
  transport_type: 'tram' | 'metro'
  color: string
  text_color: string
}

interface TramMetroLinesData {
  metadata: {
    source: string
    description: string
    downloaded_at: string
    total_lines: number
    operators: string[]
    license: string
  }
  geojson: {
    type: 'FeatureCollection'
    features: Array<{
      type: 'Feature'
      properties: TramMetroLine
      geometry: {
        type: 'LineString'
        coordinates: [number, number][]
      }
    }>
  }
}

let cachedData: TramMetroLinesData | null = null

function loadData(): TramMetroLinesData {
  if (cachedData) return cachedData

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'tram_metro_lines.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`Loaded ${cachedData!.geojson.features.length} tram/metro lines`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load tram/metro lines data:', error)
    return {
      metadata: {
        source: '',
        description: '',
        downloaded_at: '',
        total_lines: 0,
        operators: [],
        license: ''
      },
      geojson: {
        type: 'FeatureCollection',
        features: []
      }
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator') // GVB, HTM, RET, UOV
    const type = searchParams.get('type') // 'tram' or 'metro'
    const bbox = searchParams.get('bbox') // 'minLng,minLat,maxLng,maxLat'

    const data = loadData()
    let features = data.geojson.features

    // Filter by operator
    if (operator) {
      features = features.filter(f => f.properties.operator === operator.toUpperCase())
    }

    // Filter by type (tram or metro)
    if (type) {
      features = features.filter(f => f.properties.transport_type === type.toLowerCase())
    }

    // Filter by bounding box (check if any point of the line is within bbox)
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
      features = features.filter(f => {
        const coords = f.geometry.coordinates
        return coords.some(([lng, lat]) =>
          lng >= minLng && lng <= maxLng &&
          lat >= minLat && lat <= maxLat
        )
      })
    }

    // Create filtered GeoJSON
    const geojson = {
      type: 'FeatureCollection' as const,
      features
    }

    // Summary by operator and type
    const summary: Record<string, { tram: number; metro: number }> = {}
    for (const feature of features) {
      const op = feature.properties.operator
      const tt = feature.properties.transport_type
      if (!summary[op]) summary[op] = { tram: 0, metro: 0 }
      summary[op][tt]++
    }

    return NextResponse.json({
      success: true,
      count: features.length,
      summary,
      metadata: data.metadata,
      geojson
    })
  } catch (error) {
    console.error('Error in tram-lines API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load tram/metro lines data' },
      { status: 500 }
    )
  }
}
