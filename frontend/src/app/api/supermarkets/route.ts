import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Supermarket {
  id: string
  name: string
  brand: string
  brand_type: string
  size_category: string
  latitude: number
  lng: number
  address: {
    street: string | null
    housenumber: string | null
    postcode: string | null
    city: string | null
  }
  opening_hours: string | null
  wheelchair: string | null
}

let cachedData: { metadata: any; data: Supermarket[] } | null = null

function loadData() {
  if (cachedData) return cachedData

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'supermarkets.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`✅ Loaded ${cachedData!.data.length} supermarkets from local data`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load supermarkets data:', error)
    return { metadata: {}, data: [] }
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

    const { data } = loadData()

    // Filter by bounds
    const filtered = data.filter(item =>
      item.latitude >= minLat &&
      item.latitude <= maxLat &&
      item.lng >= minLng &&
      item.lng <= maxLng
    )

    // Limit results
    const supermarkets = filtered.slice(0, limit)

    // Transform to expected format
    const transformedSupermarkets = supermarkets.map(item => ({
      id: item.id,
      name: item.name || item.brand || 'Supermarket',
      brand: item.brand,
      brandType: item.brand_type,
      sizeCategory: item.size_category,
      coordinates: {
        lat: item.latitude,
        lng: item.lng
      },
      address: item.address,
      openingHours: item.opening_hours,
      wheelchair: item.wheelchair,
    }))

    return NextResponse.json({
      success: true,
      count: transformedSupermarkets.length,
      total: filtered.length,
      supermarkets: transformedSupermarkets,
    })
  } catch (error) {
    console.error('Error fetching supermarkets:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch supermarkets', details: String(error) },
      { status: 500 }
    )
  }
}
