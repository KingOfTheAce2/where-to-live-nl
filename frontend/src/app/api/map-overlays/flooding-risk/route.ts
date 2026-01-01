import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Cache for merged data
let cachedMergedData: any = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// Load local curated data with rich metadata
function loadCuratedData(): any {
  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'flood_risk.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(fileContent)
    console.log(`Loaded ${data.features?.length || 0} curated flood risk zones`)
    return data
  } catch (error) {
    console.warn('No curated flood risk data found:', error)
    return { type: 'FeatureCollection', features: [] }
  }
}

// Fetch official PDOK data from Rijkswaterstaat
async function fetchPDOKData(): Promise<any> {
  try {
    const response = await fetch(
      'https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?f=json&limit=1000',
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
        headers: { 'Accept': 'application/geo+json' }
      }
    )

    if (!response.ok) {
      throw new Error(`PDOK API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Fetched ${data.features?.length || 0} PDOK flood risk zones`)
    return data
  } catch (error) {
    console.error('Failed to fetch PDOK flood data:', error)
    return { type: 'FeatureCollection', features: [] }
  }
}

// Determine risk level based on description and Dutch flood type classification
// Types: A = primary dikes (high), B = regional barriers (medium-high), C = smaller waters (medium), D = unprotected (low-medium)
function determineRiskLevel(properties: any): string {
  const desc = (properties.description || '').toLowerCase()

  // Check type classification FIRST (most reliable indicator)
  // Type D - Unprotected areas along regional waters (generally lower consequence)
  if (desc.includes('type d') || desc.includes('onbeschermd')) {
    // But Maas type D can still be significant
    if (desc.includes('maas') || desc.includes('limburg')) return 'medium'
    return 'low'
  }

  // Type C - Smaller waters, regional flooding
  if (desc.includes('type c')) {
    return 'medium'
  }

  // Type B - Regional barriers, secondary systems
  if (desc.includes('type b')) {
    return 'high'
  }

  // Type A - Primary dike breaches (most severe)
  if (desc.includes('type a')) {
    // Maas/Limburg type A is historically very high risk
    if (desc.includes('maas') || desc.includes('limburg')) return 'very_high'
    // Major rivers type A
    if (desc.includes('rijn') || desc.includes('ijssel') || desc.includes('waal')) return 'very_high'
    return 'high'
  }

  // Very high risk keywords (specific historical problem areas)
  if (desc.includes('geul') || desc.includes('valkenburg')) return 'very_high'

  // Medium risk for general regional/secondary
  if (desc.includes('secundair') || desc.includes('regionaal')) return 'medium'

  // Coastal areas - varies but generally protected
  if (desc.includes('kust') || desc.includes('zee') || desc.includes('noordzee')) return 'medium'

  // Default to medium for unclassified
  return 'medium'
}

// Merge and enrich data from both sources
async function getMergedFloodData(): Promise<any> {
  const now = Date.now()

  // Return cached data if still valid
  if (cachedMergedData && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedMergedData
  }

  // Fetch both sources
  const [pdokData, curatedData] = await Promise.all([
    fetchPDOKData(),
    Promise.resolve(loadCuratedData())
  ])

  // Create lookup map from curated data for enrichment
  const curatedLookup = new Map<string, any>()
  for (const feature of curatedData.features || []) {
    const name = feature.properties?.name?.toLowerCase() || ''
    const id = feature.properties?.id || ''
    if (name) curatedLookup.set(name, feature.properties)
    if (id) curatedLookup.set(id, feature.properties)
  }

  // Process PDOK features and enrich with curated metadata
  const enrichedFeatures = (pdokData.features || []).map((feature: any, index: number) => {
    const props = feature.properties || {}
    const desc = props.description || ''
    const descLower = desc.toLowerCase()

    // Try to find matching curated data
    let curatedProps: any = null
    for (const [key, value] of curatedLookup.entries()) {
      if (descLower.includes(key) || key.includes(descLower.split(' ')[0])) {
        curatedProps = value
        break
      }
    }

    // Determine risk level
    const riskLevel = curatedProps?.risk_level || determineRiskLevel(props)

    // Build enriched properties
    const enrichedProps = {
      id: props.local_id || `pdok_flood_${index}`,
      name: desc || curatedProps?.name || 'Overstromingsrisicogebied',
      risk_level: riskLevel,
      risk_score: ({ very_high: 5, high: 4, medium: 3, low: 2, very_low: 1 } as Record<string, number>)[riskLevel] || 3,
      flood_type: curatedProps?.flood_type || (descLower.includes('zee') || descLower.includes('kust') ? 'coastal' : 'river_flooding'),
      qualitative_value: props.qualitative_value || 'Potential Flood Risk Area',
      source: 'pdok_rijkswaterstaat',
      notes: curatedProps?.notes || `Official flood risk zone: ${desc}`,
      recent_events: curatedProps?.recent_events || [],
      rivers: curatedProps?.rivers || [],
      // Original PDOK properties
      begin_life_span_version: props.begin_life_span_version,
      namespace: props.namespace
    }

    return {
      type: 'Feature',
      id: enrichedProps.id,
      properties: enrichedProps,
      geometry: feature.geometry
    }
  })

  // Note: We no longer add curated features as separate geometries
  // because they use simplified rectangular bounding boxes that appear as "large squares".
  // The curated data is now used ONLY for metadata enrichment of PDOK features (above).
  // PDOK provides the detailed polygon geometries from official Rijkswaterstaat data.

  // Use only the enriched PDOK features (which have detailed polygon geometries)
  const mergedFeatures = [...enrichedFeatures]

  // Sort by risk level (highest first)
  mergedFeatures.sort((a: any, b: any) => (b.properties.risk_score || 0) - (a.properties.risk_score || 0))

  cachedMergedData = {
    type: 'FeatureCollection',
    features: mergedFeatures
  }
  cacheTimestamp = now

  console.log(`Merged flood data: ${enrichedFeatures.length} PDOK features (curated data used for metadata enrichment only)`)

  return cachedMergedData
}

export async function GET() {
  try {
    const data = await getMergedFloodData()

    // Count by risk level
    const riskCounts = data.features.reduce((acc: any, f: any) => {
      const level = f.properties?.risk_level || 'unknown'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      count: data.features?.length || 0,
      riskCounts,
      type: 'FeatureCollection',
      features: data.features || [],
    })
  } catch (error) {
    console.error('Error in flooding-risk API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load flooding risk data', details: String(error) },
      { status: 500 }
    )
  }
}
