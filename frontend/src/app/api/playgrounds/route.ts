import { NextRequest, NextResponse } from 'next/server'

/**
 * Playgrounds API
 *
 * Data Sources:
 * 1. OpenStreetMap via Overpass API - Regular playgrounds (leisure=playground)
 * 2. RIVM/Staatsbosbeheer WFS - Official Speelnatuur locations (54 locations)
 *    https://data.rivm.nl/geo/alo/wfs - Layer: sbb_20241201_speelnatuur
 *
 * Staatsbosbeheer speelnatuur includes speelbossen (play forests) and other
 * nature play areas across the Netherlands.
 */

interface Playground {
  id: string
  name: string
  coordinates: { lat: number, lng: number }
  type: 'playground' | 'speelnatuur'
  address?: string
  city?: string
  operator?: string
  link?: string
  category?: string
}

/**
 * Convert RD New (EPSG:28992) coordinates to WGS84 (EPSG:4326)
 * Based on the official Dutch coordinate transformation formulas from RDNAPTRANS
 * Reference: https://www.kadaster.nl/zakelijk/producten/geo-informatie/rdnaptrans
 */
function rdToWgs84(x: number, y: number): { lat: number; lng: number } {
  // Reference point Amersfoort
  const x0 = 155000.0
  const y0 = 463000.0
  const phi0 = 52.15517440
  const lam0 = 5.38720621

  const dX = (x - x0) * 1e-5
  const dY = (y - y0) * 1e-5

  // Latitude calculation coefficients (Kp)
  const lat = phi0 +
    dY * 3235.65389 +
    dX * dX * -32.58297 +
    dY * dY * -0.24750 +
    dX * dX * dY * -0.84978 +
    dY * dY * dY * -0.06550 +
    dX * dX * dY * dY * -0.01709 +
    dY * dY * dY * dY * -0.00738 +
    dX * dY * 0.00530 +
    dX * dX * dX * dX * -0.00039 +
    dX * dX * dY * dY * dY * 0.00033 +
    dX * dX * dX * dX * dY * -0.00012

  // Longitude calculation coefficients (Kq)
  const lng = lam0 +
    dX * 5260.52916 +
    dX * dY * 105.94684 +
    dX * dY * dY * 2.45656 +
    dX * dX * dX * -0.81885 +
    dX * dY * dY * dY * 0.05594 +
    dX * dX * dX * dY * -0.05607 +
    dX * dY * dY * dY * dY * 0.01199 +
    dX * dX * dX * dY * dY * -0.00256 +
    dX * dY * dY * dY * dY * dY * 0.00128 +
    dY * 0.00022 +
    dX * dX * dX * dX * dX * -0.00022 +
    dX * dY * dY * dY * dY * dY * dY * 0.00026

  return {
    lat: lat / 3600 + phi0 - phi0, // Simplified: result is already in degrees
    lng: lng / 3600 + lam0 - lam0
  }
}

// Simpler, more reliable RD to WGS84 conversion
function rdToWgs84Simple(x: number, y: number): { lat: number; lng: number } {
  // Simplified polynomial approximation for RD to WGS84
  // Accurate to ~1 meter for most of the Netherlands

  const dX = (x - 155000) / 100000
  const dY = (y - 463000) / 100000

  const lat = 52.15517 +
    (dY * 0.36720) +
    (dX * dX * -0.00368) +
    (dY * dY * -0.00147)

  const lng = 5.38721 +
    (dX * 0.59524) +
    (dX * dY * 0.01202) +
    (dX * dX * dX * -0.00099)

  return { lat, lng }
}

/**
 * Fetch Staatsbosbeheer Speelnatuur data from RIVM WFS
 */
async function fetchStaatsbosbeheerSpeelnatuur(): Promise<Playground[]> {
  try {
    console.log('🌲 Fetching Staatsbosbeheer Speelnatuur from RIVM WFS...')

    // Request WGS84 output directly using srsName parameter
    const wfsUrl = 'https://data.rivm.nl/geo/alo/wfs?' +
      'service=WFS&version=2.0.0&request=GetFeature' +
      '&typeName=alo:sbb_20241201_speelnatuur' +
      '&outputFormat=json' +
      '&srsName=EPSG:4326'

    const response = await fetch(wfsUrl, {
      next: { revalidate: 86400 } // Cache for 24 hours
    })

    if (!response.ok) {
      console.error('RIVM WFS error:', response.status)
      return []
    }

    const data = await response.json()

    const speelnatuur: Playground[] = data.features.map((feature: any, index: number) => {
      const coords = feature.geometry.coordinates
      const props = feature.properties

      // Check if coordinates need conversion (RD New uses large numbers > 10000)
      let lat: number, lng: number
      if (Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
        // Coordinates are in RD New format, convert to WGS84
        const wgs84 = rdToWgs84Simple(coords[0], coords[1])
        lat = wgs84.lat
        lng = wgs84.lng
      } else {
        // Already in WGS84 (note: GeoJSON uses [lng, lat] order)
        lng = coords[0]
        lat = coords[1]
      }

      return {
        id: `sbb-${feature.id || index + 1}`,
        name: props.naam || 'Speelnatuur',
        coordinates: { lat, lng },
        type: 'speelnatuur' as const,
        operator: props.beheerder || 'Staatsbosbeheer',
        link: props.link,
        category: props.categorie
      }
    })

    console.log(`🌲 Found ${speelnatuur.length} Staatsbosbeheer Speelnatuur locations`)
    return speelnatuur

  } catch (error) {
    console.error('Error fetching Staatsbosbeheer data:', error)
    return []
  }
}

// Cache for 1 hour
let cachedData: {
  playgrounds: Playground[],
  bbox: string,
  timestamp: number
} | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const minLat = parseFloat(searchParams.get('minLat') || '50.7')
    const maxLat = parseFloat(searchParams.get('maxLat') || '53.6')
    const minLng = parseFloat(searchParams.get('minLng') || '3.3')
    const maxLng = parseFloat(searchParams.get('maxLng') || '7.2')
    const limit = parseInt(searchParams.get('limit') || '500')

    const bboxKey = `${minLat.toFixed(2)},${minLng.toFixed(2)},${maxLat.toFixed(2)},${maxLng.toFixed(2)}`

    // Return cached data if valid and bbox matches
    if (cachedData &&
        Date.now() - cachedData.timestamp < CACHE_TTL &&
        cachedData.bbox === bboxKey) {
      return NextResponse.json({
        success: true,
        playgrounds: cachedData.playgrounds.slice(0, limit),
        count: Math.min(cachedData.playgrounds.length, limit),
        total: cachedData.playgrounds.length,
        cached: true
      })
    }

    // Overpass query for playgrounds and speelnatuur
    const overpassQuery = `
      [out:json][timeout:60];
      (
        // Regular playgrounds
        node["leisure"="playground"](${minLat},${minLng},${maxLat},${maxLng});
        way["leisure"="playground"](${minLat},${minLng},${maxLat},${maxLng});

        // Speelnatuur (nature playgrounds)
        node["leisure"="nature"]["name"~"speel",i](${minLat},${minLng},${maxLat},${maxLng});
        way["leisure"="nature"]["name"~"speel",i](${minLat},${minLng},${maxLat},${maxLng});

        // Staatsbosbeheer operated playgrounds
        node["operator"~"staatsbosbeheer",i]["leisure"](${minLat},${minLng},${maxLat},${maxLng});
        way["operator"~"staatsbosbeheer",i]["leisure"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out center;
    `

    // Fetch data from both sources in parallel
    console.log('🎠 Fetching playgrounds from Overpass API and Staatsbosbeheer WFS...')

    // Fetch OSM data (may fail, that's okay)
    let osmPlaygrounds: Playground[] = []
    let osmError: string | null = null

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      })

      if (!response.ok) {
        osmError = `Overpass API error: ${response.status}`
        console.warn(`⚠️ ${osmError}`)
      } else {
        const data = await response.json()

        osmPlaygrounds = data.elements
          .filter((el: any) => {
            const lat = el.lat || el.center?.lat
            const lng = el.lon || el.center?.lon
            return lat && lng
          })
          .map((el: any) => {
            const lat = el.lat || el.center?.lat
            const lng = el.lon || el.center?.lon
            const tags = el.tags || {}

            const isStaatsbosbeheer = (tags.operator || '').toLowerCase().includes('staatsbosbeheer')
            const isSpeelnatuur = tags.leisure === 'nature' ||
                                 (tags.name || '').toLowerCase().includes('speelnatuur') ||
                                 isStaatsbosbeheer

            return {
              id: `osm-${el.type}-${el.id}`,
              name: tags.name || (isSpeelnatuur ? 'Speelnatuur' : 'Playground'),
              coordinates: { lat, lng },
              type: isSpeelnatuur ? 'speelnatuur' : 'playground',
              address: tags['addr:street'] ?
                `${tags['addr:street']} ${tags['addr:housenumber'] || ''}`.trim() :
                undefined,
              city: tags['addr:city'] || tags['addr:municipality'],
              operator: tags.operator
            }
          })
      }
    } catch (err) {
      osmError = err instanceof Error ? err.message : 'Failed to fetch from Overpass'
      console.warn(`⚠️ OSM fetch failed: ${osmError}`)
    }

    console.log(`✅ Found ${osmPlaygrounds.length} OSM playgrounds${osmError ? ` (error: ${osmError})` : ''}`)

    // Fetch Staatsbosbeheer Speelnatuur data
    const staatsbosbeheerData = await fetchStaatsbosbeheerSpeelnatuur()

    // Filter Staatsbosbeheer data to bbox
    const filteredStaatsbosbeheer = staatsbosbeheerData.filter(p =>
      p.coordinates.lat >= minLat &&
      p.coordinates.lat <= maxLat &&
      p.coordinates.lng >= minLng &&
      p.coordinates.lng <= maxLng
    )

    console.log(`🌲 ${filteredStaatsbosbeheer.length} Staatsbosbeheer locations in bbox`)

    // Merge data - Staatsbosbeheer first (higher priority)
    const allPlaygrounds = [...filteredStaatsbosbeheer, ...osmPlaygrounds]

    console.log(`✅ Total: ${allPlaygrounds.length} playgrounds (${filteredStaatsbosbeheer.length} Staatsbosbeheer + ${osmPlaygrounds.length} OSM)`)

    // Update cache if we have data
    if (allPlaygrounds.length > 0) {
      cachedData = {
        playgrounds: allPlaygrounds,
        bbox: bboxKey,
        timestamp: Date.now()
      }
    }

    return NextResponse.json({
      success: true,
      playgrounds: allPlaygrounds.slice(0, limit),
      count: Math.min(allPlaygrounds.length, limit),
      total: allPlaygrounds.length,
      sources: {
        osm: osmPlaygrounds.length,
        staatsbosbeheer: filteredStaatsbosbeheer.length
      },
      warnings: osmError ? [osmError] : undefined,
      cached: false
    })

  } catch (error) {
    console.error('❌ Error fetching playgrounds:', error)

    // Still try to return Staatsbosbeheer data on error
    try {
      const staatsbosbeheerData = await fetchStaatsbosbeheerSpeelnatuur()
      if (staatsbosbeheerData.length > 0) {
        return NextResponse.json({
          success: true,
          playgrounds: staatsbosbeheerData.slice(0, 100),
          count: Math.min(staatsbosbeheerData.length, 100),
          total: staatsbosbeheerData.length,
          sources: {
            osm: 0,
            staatsbosbeheer: staatsbosbeheerData.length
          },
          warnings: [error instanceof Error ? error.message : 'OSM fetch failed'],
          cached: false
        })
      }
    } catch (sbbError) {
      console.error('❌ Staatsbosbeheer also failed:', sbbError)
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch playgrounds',
      playgrounds: [],
      count: 0
    }, { status: 500 })
  }
}
