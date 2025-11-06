import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface SchoolFilter {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  type?: string // 'primary' or 'secondary'
  city?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse filter parameters
    const filters: SchoolFilter = {
      minLat: searchParams.get('minLat') ? parseFloat(searchParams.get('minLat')!) : undefined,
      maxLat: searchParams.get('maxLat') ? parseFloat(searchParams.get('maxLat')!) : undefined,
      minLng: searchParams.get('minLng') ? parseFloat(searchParams.get('minLng')!) : undefined,
      maxLng: searchParams.get('maxLng') ? parseFloat(searchParams.get('maxLng')!) : undefined,
      type: searchParams.get('type') || undefined,
      city: searchParams.get('city') || undefined,
    }

    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 200

    // Load sample data
    const dataPath = path.join(process.cwd(), '..', 'data', 'samples', 'sample_schools.json')
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(fileContent)

    let schools = data.schools

    // Apply filters
    schools = schools.filter((school: any) => {
      // Geographic bounds
      if (filters.minLat !== undefined && school.coordinates.lat < filters.minLat) return false
      if (filters.maxLat !== undefined && school.coordinates.lat > filters.maxLat) return false
      if (filters.minLng !== undefined && school.coordinates.lng < filters.minLng) return false
      if (filters.maxLng !== undefined && school.coordinates.lng > filters.maxLng) return false

      // School type
      if (filters.type && school.type !== filters.type) return false

      // City
      if (filters.city && school.city !== filters.city) return false

      return true
    })

    // Limit results
    schools = schools.slice(0, limit)

    return NextResponse.json({
      success: true,
      count: schools.length,
      total: data.schools.length,
      schools: schools,
    })
  } catch (error) {
    console.error('Error fetching schools:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schools' },
      { status: 500 }
    )
  }
}
