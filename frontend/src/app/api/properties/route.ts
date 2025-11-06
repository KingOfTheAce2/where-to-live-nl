import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface PropertyFilter {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  minPrice?: number
  maxPrice?: number
  propertyTypes?: string[]
  minRooms?: number
  maxRooms?: number
  minArea?: number
  maxArea?: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse filter parameters
    const filters: PropertyFilter = {
      minLat: searchParams.get('minLat') ? parseFloat(searchParams.get('minLat')!) : undefined,
      maxLat: searchParams.get('maxLat') ? parseFloat(searchParams.get('maxLat')!) : undefined,
      minLng: searchParams.get('minLng') ? parseFloat(searchParams.get('minLng')!) : undefined,
      maxLng: searchParams.get('maxLng') ? parseFloat(searchParams.get('maxLng')!) : undefined,
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      propertyTypes: searchParams.get('types') ? searchParams.get('types')!.split(',') : undefined,
      minRooms: searchParams.get('minRooms') ? parseInt(searchParams.get('minRooms')!) : undefined,
      maxRooms: searchParams.get('maxRooms') ? parseInt(searchParams.get('maxRooms')!) : undefined,
      minArea: searchParams.get('minArea') ? parseInt(searchParams.get('minArea')!) : undefined,
      maxArea: searchParams.get('maxArea') ? parseInt(searchParams.get('maxArea')!) : undefined,
    }

    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100

    // Load sample data
    const dataPath = path.join(process.cwd(), '..', 'data', 'samples', 'sample_properties.json')
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(fileContent)

    let properties = data.properties

    // Apply filters
    properties = properties.filter((property: any) => {
      // Geographic bounds
      if (filters.minLat !== undefined && property.coordinates.lat < filters.minLat) return false
      if (filters.maxLat !== undefined && property.coordinates.lat > filters.maxLat) return false
      if (filters.minLng !== undefined && property.coordinates.lng < filters.minLng) return false
      if (filters.maxLng !== undefined && property.coordinates.lng > filters.maxLng) return false

      // Price range
      if (filters.minPrice !== undefined && property.valuation.woz_value < filters.minPrice) return false
      if (filters.maxPrice !== undefined && property.valuation.woz_value > filters.maxPrice) return false

      // Property type
      if (filters.propertyTypes && filters.propertyTypes.length > 0) {
        if (!filters.propertyTypes.includes(property.property.type)) return false
      }

      // Rooms
      if (filters.minRooms !== undefined && property.property.rooms < filters.minRooms) return false
      if (filters.maxRooms !== undefined && property.property.rooms > filters.maxRooms) return false

      // Living area
      if (filters.minArea !== undefined && property.property.living_area_m2 < filters.minArea) return false
      if (filters.maxArea !== undefined && property.property.living_area_m2 > filters.maxArea) return false

      return true
    })

    // Limit results
    properties = properties.slice(0, limit)

    return NextResponse.json({
      success: true,
      count: properties.length,
      total: data.properties.length,
      properties: properties,
    })
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
