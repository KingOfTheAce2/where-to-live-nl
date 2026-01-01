import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface School {
  brin_nummer: string
  vestigingsnummer?: string
  school_name: string
  street: string
  house_number: string
  postal_code: string
  city: string
  municipality: string
  province?: string
  phone?: string
  website?: string
  school_type: string // primary, secondary, special, mbo, hbo, wo
  school_type_label: string
  file_type: string
  denomination?: string
  latitude: number
  longitude: number
}

// Cache for schools data (loaded once)
let schoolsCache: School[] | null = null
let cacheLoadTime: number = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function loadSchools(): Promise<School[]> {
  // Return cached data if valid
  if (schoolsCache && Date.now() - cacheLoadTime < CACHE_TTL) {
    return schoolsCache
  }

  try {
    // Path to the schools JSON file (converted from parquet)
    const jsonPath = path.join(process.cwd(), '../data/processed/schools_geocoded.json')
    console.log('🏫 Loading schools from:', jsonPath)

    const data = await fs.readFile(jsonPath, 'utf-8')
    const schools: School[] = JSON.parse(data)

    // Filter out schools without coordinates
    const validSchools = schools.filter(s =>
      s.latitude && s.longitude &&
      !isNaN(s.latitude) && !isNaN(s.longitude)
    )

    console.log(`✅ Loaded ${validSchools.length} schools with coordinates`)

    schoolsCache = validSchools
    cacheLoadTime = Date.now()

    return validSchools
  } catch (error) {
    console.error('❌ Error loading schools JSON:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const minLat = parseFloat(searchParams.get('minLat') || '50.7')
    const maxLat = parseFloat(searchParams.get('maxLat') || '53.6')
    const minLng = parseFloat(searchParams.get('minLng') || '3.3')
    const maxLng = parseFloat(searchParams.get('maxLng') || '7.2')
    const type = searchParams.get('type') // primary, secondary, special, mbo, hbo, wo
    const limit = parseInt(searchParams.get('limit') || '1000')

    // Load schools data
    const allSchools = await loadSchools()

    // Filter by bounding box
    let filteredSchools = allSchools.filter(school =>
      school.latitude >= minLat &&
      school.latitude <= maxLat &&
      school.longitude >= minLng &&
      school.longitude <= maxLng
    )

    // Filter by type if specified
    if (type) {
      const types = type.split(',').map(t => t.trim().toLowerCase())
      filteredSchools = filteredSchools.filter(school => {
        const schoolType = school.school_type?.toLowerCase() || ''
        return types.some(t => schoolType.includes(t))
      })
    }

    // Apply limit
    const limitedSchools = filteredSchools.slice(0, limit)

    // Count by type
    const countByType: Record<string, number> = {}
    for (const school of filteredSchools) {
      const t = school.school_type || 'unknown'
      countByType[t] = (countByType[t] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      schools: limitedSchools.map(s => ({
        id: s.vestigingsnummer || s.brin_nummer,
        name: s.school_name,
        type: s.school_type,
        typeLabel: s.school_type_label,
        address: `${s.street} ${s.house_number}`.trim(),
        postalCode: s.postal_code,
        city: s.city,
        municipality: s.municipality,
        province: s.province,
        phone: s.phone,
        website: s.website,
        denomination: s.denomination,
        coordinates: {
          lat: s.latitude,
          lng: s.longitude
        }
      })),
      count: limitedSchools.length,
      total: filteredSchools.length,
      countByType
    })
  } catch (error) {
    console.error('❌ Error fetching schools:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch schools',
        details: error instanceof Error ? error.message : String(error),
        schools: [],
        count: 0
      },
      { status: 500 }
    )
  }
}
