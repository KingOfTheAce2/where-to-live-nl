import { NextResponse } from 'next/server'

/**
 * Combined Flood Risk API
 *
 * Merges multiple flood data sources into a unified risk assessment:
 * 1. PDOK Flood Risk Zones (Rijkswaterstaat) - qualitative risk areas
 * 2. Lizard Flood Depth (LIWO) - quantitative water depth scenarios
 *
 * The combination provides a comprehensive view by:
 * - Using flood risk zones as the base layer
 * - Enriching with depth data where available
 * - Calculating combined risk scores
 */

// Cache configuration - per-scenario caching
const scenarioCache: Map<string, { data: any; timestamp: number }> = new Map()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// Flood depth scenarios from Lizard
const FLOOD_SCENARIOS = {
  t10: { label: 'High probability (T10)', probability: 0.1 },
  t100: { label: 'Medium probability (T100)', probability: 0.01 },
  t1000: { label: 'Low probability (T1000)', probability: 0.001 }
}

// Risk level scoring
const RISK_SCORES: Record<string, number> = {
  very_high: 5,
  high: 4,
  medium: 3,
  low: 2,
  very_low: 1,
  unknown: 0
}

// Combined risk matrix: [zone_risk][depth_risk] -> combined_risk
const COMBINED_RISK_MATRIX: Record<string, Record<string, string>> = {
  very_high: {
    very_high: 'very_high',
    high: 'very_high',
    medium: 'very_high',
    low: 'high',
    very_low: 'high',
    unknown: 'very_high'
  },
  high: {
    very_high: 'very_high',
    high: 'high',
    medium: 'high',
    low: 'medium',
    very_low: 'medium',
    unknown: 'high'
  },
  medium: {
    very_high: 'very_high',
    high: 'high',
    medium: 'medium',
    low: 'medium',
    very_low: 'low',
    unknown: 'medium'
  },
  low: {
    very_high: 'high',
    high: 'medium',
    medium: 'medium',
    low: 'low',
    very_low: 'very_low',
    unknown: 'low'
  },
  very_low: {
    very_high: 'high',
    high: 'medium',
    medium: 'low',
    low: 'very_low',
    very_low: 'very_low',
    unknown: 'very_low'
  }
}

// Fetch flood risk zones from PDOK
async function fetchFloodRiskZones(): Promise<any> {
  try {
    const response = await fetch(
      'https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?f=json&limit=1000',
      {
        next: { revalidate: 3600 },
        headers: { 'Accept': 'application/geo+json' }
      }
    )

    if (!response.ok) {
      throw new Error(`PDOK API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch PDOK flood zones:', error)
    return { features: [] }
  }
}

// Fetch flood depth data from Lizard for all scenarios
async function fetchAllFloodDepthScenarios(): Promise<Map<string, any>> {
  const LIZARD_WFS_BASE = 'https://ldo-geoserver.lizard.net/geoserver/ows'
  const scenarios = new Map<string, any>()

  // Fetch all scenarios in parallel
  const fetchPromises = Object.entries(FLOOD_SCENARIOS).map(async ([scenarioId]) => {
    try {
      const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: `ror3:${scenarioId}_maximale_waterdiepte`,
        outputFormat: 'application/json',
        count: '3000'
      })

      const response = await fetch(`${LIZARD_WFS_BASE}?${params}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 }
      })

      if (!response.ok) {
        console.warn(`Lizard ${scenarioId} fetch failed: ${response.status}`)
        return { scenarioId, data: { features: [] } }
      }

      const data = await response.json()
      return { scenarioId, data }
    } catch (error) {
      console.warn(`Lizard ${scenarioId} fetch error:`, error)
      return { scenarioId, data: { features: [] } }
    }
  })

  const results = await Promise.all(fetchPromises)
  results.forEach(({ scenarioId, data }) => {
    scenarios.set(scenarioId, data)
  })

  return scenarios
}

// Simple RD to WGS84 approximation
function rdToWgs84(x: number, y: number): [number, number] {
  const refX = 155000, refY = 463000
  const refLng = 5.387206, refLat = 52.155172
  const scaleX = 0.000014, scaleY = 0.000009

  const lng = refLng + (x - refX) * scaleX
  const lat = refLat + (y - refY) * scaleY

  return [lng, lat]
}

// Transform geometry from RD to WGS84
function transformGeometry(geometry: any): any {
  if (!geometry) return geometry

  const transformCoords = (coords: any): any => {
    if (typeof coords[0] === 'number') {
      return rdToWgs84(coords[0], coords[1])
    }
    return coords.map(transformCoords)
  }

  return {
    type: geometry.type,
    coordinates: transformCoords(geometry.coordinates)
  }
}

// Calculate bounding box of a geometry
function getBoundingBox(geometry: any): [number, number, number, number] | null {
  if (!geometry || !geometry.coordinates) return null

  let minLng = Infinity, minLat = Infinity
  let maxLng = -Infinity, maxLat = -Infinity

  const processCoords = (coords: any) => {
    if (typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0])
      maxLng = Math.max(maxLng, coords[0])
      minLat = Math.min(minLat, coords[1])
      maxLat = Math.max(maxLat, coords[1])
    } else {
      coords.forEach(processCoords)
    }
  }

  processCoords(geometry.coordinates)

  if (minLng === Infinity) return null
  return [minLng, minLat, maxLng, maxLat]
}

// Check if two bounding boxes overlap
function bboxOverlap(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): boolean {
  return !(
    bbox1[2] < bbox2[0] || // bbox1 is left of bbox2
    bbox1[0] > bbox2[2] || // bbox1 is right of bbox2
    bbox1[3] < bbox2[1] || // bbox1 is below bbox2
    bbox1[1] > bbox2[3]    // bbox1 is above bbox2
  )
}

// Parse Dutch water depth strings
function parseWaterDepth(depthStr: string): { min: number; max: number; avg: number } | null {
  if (!depthStr) return null

  const str = depthStr.toLowerCase()

  // Pattern: "tussen X,Y en Z,W m"
  const rangeMatch = str.match(/tussen\s*([\d,]+)\s*en\s*([\d,]+)\s*m/)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(',', '.'))
    const max = parseFloat(rangeMatch[2].replace(',', '.'))
    return { min, max, avg: (min + max) / 2 }
  }

  // Pattern: "meer dan X m"
  const moreThanMatch = str.match(/(?:meer dan|>)\s*([\d,]+)\s*m/)
  if (moreThanMatch) {
    const min = parseFloat(moreThanMatch[1].replace(',', '.'))
    return { min, max: min + 2, avg: min + 1 }
  }

  // Pattern: "minder dan X m"
  const lessThanMatch = str.match(/(?:minder dan|<)\s*([\d,]+)\s*m/)
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1].replace(',', '.'))
    return { min: 0, max, avg: max / 2 }
  }

  return null
}

// Determine risk level from water depth
function depthToRiskLevel(depth: { avg: number } | null): string {
  if (!depth) return 'unknown'

  if (depth.avg >= 2.0) return 'very_high'
  if (depth.avg >= 1.0) return 'high'
  if (depth.avg >= 0.5) return 'medium'
  if (depth.avg >= 0.2) return 'low'
  return 'very_low'
}

// Determine zone risk level from PDOK description
function determineZoneRiskLevel(properties: any): string {
  const desc = (properties.description || '').toLowerCase()

  if (desc.includes('type d') || desc.includes('onbeschermd')) {
    if (desc.includes('maas') || desc.includes('limburg')) return 'medium'
    return 'low'
  }
  if (desc.includes('type c')) return 'medium'
  if (desc.includes('type b')) return 'high'
  if (desc.includes('type a')) {
    if (desc.includes('maas') || desc.includes('limburg') ||
        desc.includes('rijn') || desc.includes('ijssel') || desc.includes('waal')) {
      return 'very_high'
    }
    return 'high'
  }
  if (desc.includes('geul') || desc.includes('valkenburg')) return 'very_high'
  if (desc.includes('secundair') || desc.includes('regionaal')) return 'medium'
  if (desc.includes('kust') || desc.includes('zee')) return 'medium'

  return 'medium'
}

// Combine risk levels using the matrix
function combineRiskLevels(zoneRisk: string, depthRisk: string): string {
  const zoneMatrix = COMBINED_RISK_MATRIX[zoneRisk]
  if (!zoneMatrix) return zoneRisk
  return zoneMatrix[depthRisk] || zoneRisk
}

// Build combined flood data
async function buildCombinedFloodData(scenario: string = 't100'): Promise<any> {
  const now = Date.now()

  // Check per-scenario cache
  const cached = scenarioCache.get(scenario)
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Using cached flood data for scenario ${scenario}`)
    return cached.data
  }

  console.log('Building combined flood data...')

  // Fetch all data sources in parallel
  const [floodZones, depthScenarios] = await Promise.all([
    fetchFloodRiskZones(),
    fetchAllFloodDepthScenarios()
  ])

  // Get the selected scenario's depth data
  const selectedDepthData = depthScenarios.get(scenario) || { features: [] }

  // Transform depth features to WGS84 and index by bounding box
  const depthFeatures = (selectedDepthData.features || []).map((f: any) => ({
    ...f,
    geometry: transformGeometry(f.geometry),
    bbox: null as [number, number, number, number] | null
  }))

  // Calculate bounding boxes for depth features
  depthFeatures.forEach((f: any) => {
    f.bbox = getBoundingBox(f.geometry)
  })

  // Process flood zone features and enrich with depth data
  const combinedFeatures = (floodZones.features || []).map((zoneFeature: any, index: number) => {
    const props = zoneFeature.properties || {}
    const zoneRisk = determineZoneRiskLevel(props)
    const zoneBbox = getBoundingBox(zoneFeature.geometry)

    // Find overlapping depth features
    let maxDepth: { min: number; max: number; avg: number } | null = null
    let depthRisk = 'unknown'
    let overlappingDepthCount = 0

    if (zoneBbox) {
      for (const depthFeature of depthFeatures) {
        if (depthFeature.bbox && bboxOverlap(zoneBbox, depthFeature.bbox)) {
          overlappingDepthCount++
          const depthValue = depthFeature.properties?.legenda ||
                            depthFeature.properties?.waterdiept
          const parsed = typeof depthValue === 'string' ? parseWaterDepth(depthValue) : null

          if (parsed && (!maxDepth || parsed.avg > maxDepth.avg)) {
            maxDepth = parsed
          }
        }
      }

      if (maxDepth) {
        depthRisk = depthToRiskLevel(maxDepth)
      }
    }

    // Calculate combined risk
    const combinedRisk = combineRiskLevels(zoneRisk, depthRisk)

    return {
      type: 'Feature',
      id: props.local_id || `combined_flood_${index}`,
      properties: {
        id: props.local_id || `combined_flood_${index}`,
        name: props.description || 'Flood Risk Zone',

        // Zone-based risk (qualitative)
        zone_risk_level: zoneRisk,
        zone_risk_score: RISK_SCORES[zoneRisk],
        flood_type: (props.description || '').toLowerCase().includes('zee') ? 'coastal' : 'river',

        // Depth-based risk (quantitative)
        depth_risk_level: depthRisk,
        depth_risk_score: RISK_SCORES[depthRisk],
        max_water_depth: maxDepth ? `${maxDepth.avg.toFixed(1)}m` : null,
        water_depth_min: maxDepth?.min,
        water_depth_max: maxDepth?.max,

        // Combined risk
        combined_risk_level: combinedRisk,
        combined_risk_score: RISK_SCORES[combinedRisk],

        // Metadata
        scenario: scenario,
        scenario_label: FLOOD_SCENARIOS[scenario as keyof typeof FLOOD_SCENARIOS]?.label,
        depth_features_overlapping: overlappingDepthCount,
        has_depth_data: depthRisk !== 'unknown',

        // Sources
        sources: ['PDOK Rijkswaterstaat', 'Lizard GeoServer (LIWO)'],
        source_zone: 'pdok_rijkswaterstaat',
        source_depth: 'lizard_geoserver'
      },
      geometry: zoneFeature.geometry
    }
  })

  // Also add depth-only features that don't overlap with zones
  // (areas with water depth data but not in official risk zones)
  const zoneBoxes = combinedFeatures
    .map((f: any) => getBoundingBox(f.geometry))
    .filter(Boolean) as [number, number, number, number][]

  let depthOnlyCount = 0
  for (const depthFeature of depthFeatures) {
    if (!depthFeature.bbox) continue

    // Check if this depth feature overlaps any zone
    const overlapsZone = zoneBoxes.some(zb => bboxOverlap(depthFeature.bbox!, zb))

    if (!overlapsZone) {
      const depthValue = depthFeature.properties?.legenda || depthFeature.properties?.waterdiept
      const parsed = typeof depthValue === 'string' ? parseWaterDepth(depthValue) : null
      const depthRisk = depthToRiskLevel(parsed)

      if (depthRisk !== 'unknown' && depthRisk !== 'very_low') {
        depthOnlyCount++
        combinedFeatures.push({
          type: 'Feature',
          id: `depth_only_${depthOnlyCount}`,
          properties: {
            id: `depth_only_${depthOnlyCount}`,
            name: 'Flood Depth Area',

            zone_risk_level: 'unknown',
            zone_risk_score: 0,
            flood_type: 'unknown',

            depth_risk_level: depthRisk,
            depth_risk_score: RISK_SCORES[depthRisk],
            max_water_depth: parsed ? `${parsed.avg.toFixed(1)}m` : null,
            water_depth_min: parsed?.min,
            water_depth_max: parsed?.max,

            combined_risk_level: depthRisk,
            combined_risk_score: RISK_SCORES[depthRisk],

            scenario: scenario,
            scenario_label: FLOOD_SCENARIOS[scenario as keyof typeof FLOOD_SCENARIOS]?.label,
            depth_features_overlapping: 1,
            has_depth_data: true,
            is_depth_only: true,

            sources: ['Lizard GeoServer (LIWO)'],
            source_depth: 'lizard_geoserver'
          },
          geometry: depthFeature.geometry
        })
      }
    }
  }

  // Sort by combined risk (highest first)
  combinedFeatures.sort((a: any, b: any) =>
    (b.properties.combined_risk_score || 0) - (a.properties.combined_risk_score || 0)
  )

  const resultData = {
    type: 'FeatureCollection',
    features: combinedFeatures,
    metadata: {
      scenario,
      zone_count: floodZones.features?.length || 0,
      depth_feature_count: depthFeatures.length,
      combined_count: combinedFeatures.length,
      depth_only_count: depthOnlyCount,
      fetched_at: new Date().toISOString()
    }
  }

  // Cache per-scenario
  scenarioCache.set(scenario, { data: resultData, timestamp: now })

  console.log(`Combined flood data for ${scenario}: ${combinedFeatures.length} features ` +
    `(${floodZones.features?.length || 0} zones + ${depthOnlyCount} depth-only)`)

  return resultData
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scenario = searchParams.get('scenario') || 't100'

  // Validate scenario
  if (!FLOOD_SCENARIOS[scenario as keyof typeof FLOOD_SCENARIOS]) {
    return NextResponse.json({
      success: false,
      error: `Invalid scenario. Valid options: ${Object.keys(FLOOD_SCENARIOS).join(', ')}`,
      available_scenarios: FLOOD_SCENARIOS
    }, { status: 400 })
  }

  try {
    const data = await buildCombinedFloodData(scenario)

    // Calculate statistics
    const riskCounts = data.features.reduce((acc: any, f: any) => {
      const level = f.properties?.combined_risk_level || 'unknown'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {})

    const withDepthData = data.features.filter((f: any) => f.properties?.has_depth_data).length
    const depthOnlyCount = data.features.filter((f: any) => f.properties?.is_depth_only).length

    return NextResponse.json({
      success: true,
      count: data.features.length,
      scenario,
      scenario_info: FLOOD_SCENARIOS[scenario as keyof typeof FLOOD_SCENARIOS],
      statistics: {
        total_features: data.features.length,
        with_depth_data: withDepthData,
        zone_only: data.features.length - depthOnlyCount - (withDepthData - depthOnlyCount),
        depth_only: depthOnlyCount,
        risk_distribution: riskCounts
      },
      available_scenarios: Object.keys(FLOOD_SCENARIOS),
      sources: [
        { name: 'PDOK Rijkswaterstaat', type: 'Flood Risk Zones', url: 'https://api.pdok.nl/' },
        { name: 'Lizard GeoServer (LIWO)', type: 'Flood Depth', url: 'https://basisinformatie-overstromingen.nl/' }
      ],
      ...data
    })

  } catch (error) {
    console.error('Error in flood-combined API:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to build combined flood data',
      details: String(error),
      available_scenarios: FLOOD_SCENARIOS
    }, { status: 500 })
  }
}
