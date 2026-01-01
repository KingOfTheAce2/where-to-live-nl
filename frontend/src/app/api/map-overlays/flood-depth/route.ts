import { NextResponse } from 'next/server'

/**
 * Flood Depth API - Uses Lizard GeoServer (same source as overstroomik.nl)
 *
 * This provides DETAILED water depth data with multiple scenarios:
 * - T10: High probability (10% annual chance)
 * - T100: Medium probability (1% annual chance) - DEFAULT
 * - T1000: Low probability (0.1% annual chance)
 *
 * Data source: https://ldo-geoserver.lizard.net/geoserver/ows
 * License: Open Data (CC0)
 */

// Cache configuration
let cachedData: Map<string, any> = new Map()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// Lizard GeoServer configuration
const LIZARD_WFS_BASE = 'https://ldo-geoserver.lizard.net/geoserver/ows'

// Available flood scenarios with water depth
const FLOOD_LAYERS = {
  t10: {
    depth: 'ror3:t10_maximale_waterdiepte',
    areas: 'ror3:t10_overstroomde_gebieden',
    label: 'High probability (T10)',
    description: '10% annual chance of occurrence'
  },
  t100: {
    depth: 'ror3:t100_maximale_waterdiepte',
    areas: 'ror3:t100_overstroomde_gebieden',
    label: 'Medium probability (T100)',
    description: '1% annual chance of occurrence'
  },
  t1000: {
    depth: 'ror3:t1000_maximale_waterdiepte',
    areas: 'ror3:t1000_overstroomde_gebieden',
    label: 'Low probability (T1000)',
    description: '0.1% annual chance of occurrence'
  }
}

// Simple RD to WGS84 approximation for Netherlands
// For production, use proj4 library for accurate transformation
function rdToWgs84(x: number, y: number): [number, number] {
  // Approximate transformation (good enough for visualization)
  // Reference point: Amersfoort (155000, 463000) = (5.387206, 52.155172)
  const refX = 155000, refY = 463000
  const refLng = 5.387206, refLat = 52.155172

  // Scale factors (approximate)
  const scaleX = 0.000014 // degrees per meter (longitude)
  const scaleY = 0.000009 // degrees per meter (latitude)

  const lng = refLng + (x - refX) * scaleX
  const lat = refLat + (y - refY) * scaleY

  return [lng, lat]
}

// Simple WGS84 to RD approximation for Netherlands (inverse of above)
function wgs84ToRd(lng: number, lat: number): [number, number] {
  const refX = 155000, refY = 463000
  const refLng = 5.387206, refLat = 52.155172
  const scaleX = 0.000014
  const scaleY = 0.000009

  const x = refX + (lng - refLng) / scaleX
  const y = refY + (lat - refLat) / scaleY

  return [Math.round(x), Math.round(y)]
}

// Transform geometry from RD (EPSG:28992) to WGS84 (EPSG:4326)
function transformGeometry(geometry: any): any {
  if (!geometry) return geometry

  const transformCoords = (coords: any): any => {
    if (typeof coords[0] === 'number') {
      // Single coordinate pair [x, y]
      return rdToWgs84(coords[0], coords[1])
    }
    // Nested array
    return coords.map(transformCoords)
  }

  return {
    type: geometry.type,
    coordinates: transformCoords(geometry.coordinates)
  }
}

// Parse Dutch water depth strings like "tussen 2,0 en 5,0 m"
function parseWaterDepth(depthStr: string): { min: number; max: number; display: string } | null {
  if (!depthStr) return null

  const str = depthStr.toLowerCase()

  // Pattern: "tussen X,Y en Z,W m"
  const rangeMatch = str.match(/tussen\s*([\d,]+)\s*en\s*([\d,]+)\s*m/)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(',', '.'))
    const max = parseFloat(rangeMatch[2].replace(',', '.'))
    return { min, max, display: `${min.toFixed(1)}-${max.toFixed(1)}m` }
  }

  // Pattern: "meer dan X m" or "> X m"
  const moreThanMatch = str.match(/(?:meer dan|>)\s*([\d,]+)\s*m/)
  if (moreThanMatch) {
    const min = parseFloat(moreThanMatch[1].replace(',', '.'))
    return { min, max: min + 2, display: `>${min.toFixed(1)}m` }
  }

  // Pattern: "minder dan X m" or "< X m"
  const lessThanMatch = str.match(/(?:minder dan|<)\s*([\d,]+)\s*m/)
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1].replace(',', '.'))
    return { min: 0, max, display: `<${max.toFixed(1)}m` }
  }

  // Pattern: just a number "X,Y m"
  const simpleMatch = str.match(/([\d,]+)\s*m/)
  if (simpleMatch) {
    const val = parseFloat(simpleMatch[1].replace(',', '.'))
    return { min: val, max: val, display: `${val.toFixed(1)}m` }
  }

  return null
}

// Determine risk level based on water depth
function depthToRiskLevel(depth: { min: number; max: number } | null): string {
  if (!depth) return 'unknown'

  const avgDepth = (depth.min + depth.max) / 2

  if (avgDepth >= 2.0) return 'very_high'    // > 2m: Life-threatening
  if (avgDepth >= 1.0) return 'high'          // 1-2m: Dangerous
  if (avgDepth >= 0.5) return 'medium'        // 0.5-1m: Significant
  if (avgDepth >= 0.2) return 'low'           // 0.2-0.5m: Minor
  return 'very_low'                            // < 0.2m: Minimal
}

// Fetch flood depth data from Lizard GeoServer
async function fetchLizardFloodData(
  scenario: keyof typeof FLOOD_LAYERS = 't100',
  bbox?: string,
  maxFeatures: number = 2000
): Promise<any> {
  const layer = FLOOD_LAYERS[scenario]
  if (!layer) {
    throw new Error(`Invalid scenario: ${scenario}`)
  }

  const cacheKey = `${scenario}_${bbox || 'all'}_${maxFeatures}`
  const cached = cachedData.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Returning cached flood depth data for ${cacheKey}`)
    return cached.data
  }

  // Build WFS request URL
  // Note: Lizard returns data in RD (EPSG:28992), we transform to WGS84 after fetching
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: layer.depth,
    outputFormat: 'application/json',
    count: maxFeatures.toString()
  })

  // Add bbox if provided (format: minLng,minLat,maxLng,maxLat in WGS84)
  // Convert to RD for the API request
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
    const [minX, minY] = wgs84ToRd(minLng, minLat)
    const [maxX, maxY] = wgs84ToRd(maxLng, maxLat)
    // Lizard expects bbox in RD coordinates
    params.append('bbox', `${minX},${minY},${maxX},${maxY},EPSG:28992`)
  }

  const url = `${LIZARD_WFS_BASE}?${params.toString()}`
  console.log(`Fetching Lizard flood data: ${url}`)

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    })

    if (!response.ok) {
      throw new Error(`Lizard API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Transform features to add parsed depth and risk level
    const transformedFeatures = (data.features || []).map((feature: any, index: number) => {
      const props = feature.properties || {}

      // Water depth is in 'legenda' property from Lizard GeoServer
      // Example: "tussen 2,0 en 5,0 m"
      const depthValue = props.legenda || props.waterdiept || props.waterhoogt ||
                        props.diepte || props.water_depth || props.max_depth

      const parsedDepth = typeof depthValue === 'string' ? parseWaterDepth(depthValue) : null
      const riskLevel = depthToRiskLevel(parsedDepth)

      // Transform geometry from RD to WGS84 for web mapping
      const transformedGeometry = transformGeometry(feature.geometry)

      return {
        type: 'Feature',
        id: props.id || `lizard_flood_${scenario}_${index}`,
        properties: {
          id: props.id || `lizard_flood_${scenario}_${index}`,
          name: `Flood Zone (${layer.label})`,
          scenario: scenario,
          scenario_label: layer.label,
          scenario_description: layer.description,
          water_depth_raw: depthValue,
          water_depth: parsedDepth,
          water_depth_display: parsedDepth?.display || 'Unknown',
          risk_level: riskLevel,
          risk_score: ({ very_high: 5, high: 4, medium: 3, low: 2, very_low: 1, unknown: 0 } as Record<string, number>)[riskLevel],
          source: 'lizard_geoserver_liwo',
          source_url: 'https://basisinformatie-overstromingen.nl/',
          license: 'Open Data (CC0)',
          legenda: props.legenda, // Keep original Dutch legend
          ror: props.ror // Keep risk category from source
        },
        geometry: transformedGeometry
      }
    })

    const result = {
      type: 'FeatureCollection',
      features: transformedFeatures,
      metadata: {
        scenario,
        scenario_info: layer,
        feature_count: transformedFeatures.length,
        bbox: bbox || 'Netherlands',
        source: 'Lizard GeoServer (LIWO)',
        fetched_at: new Date().toISOString()
      }
    }

    // Cache the result
    cachedData.set(cacheKey, { data: result, timestamp: Date.now() })

    console.log(`Fetched ${transformedFeatures.length} flood depth features for scenario ${scenario}`)
    return result

  } catch (error) {
    console.error('Failed to fetch Lizard flood data:', error)
    throw error
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Query parameters
  const scenario = (searchParams.get('scenario') || 't100') as keyof typeof FLOOD_LAYERS
  const bbox = searchParams.get('bbox') || undefined // format: minLng,minLat,maxLng,maxLat
  const maxFeatures = parseInt(searchParams.get('limit') || '2000', 10)

  // Validate scenario
  if (!FLOOD_LAYERS[scenario]) {
    return NextResponse.json({
      success: false,
      error: `Invalid scenario. Valid options: ${Object.keys(FLOOD_LAYERS).join(', ')}`,
      available_scenarios: FLOOD_LAYERS
    }, { status: 400 })
  }

  try {
    const data = await fetchLizardFloodData(scenario, bbox, maxFeatures)

    // Count by risk level
    const riskCounts = data.features.reduce((acc: any, f: any) => {
      const level = f.properties?.risk_level || 'unknown'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      count: data.features.length,
      scenario: scenario,
      scenario_info: FLOOD_LAYERS[scenario],
      riskCounts,
      available_scenarios: Object.keys(FLOOD_LAYERS),
      ...data
    })

  } catch (error) {
    console.error('Error in flood-depth API:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch flood depth data',
      details: String(error),
      fallback_url: 'https://www.overstroomik.nl/',
      available_scenarios: FLOOD_LAYERS
    }, { status: 500 })
  }
}
