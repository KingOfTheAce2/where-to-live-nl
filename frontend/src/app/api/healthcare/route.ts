import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface HealthcareItem {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
  website: string | null
  phone: string | null
  opening_hours: string | null
  wheelchair: string | null
  dispensing: string | null
  healthcare_specialty: string | null
}

let cachedData: HealthcareItem[] | null = null

function loadData(): HealthcareItem[] {
  if (cachedData) return cachedData

  const dataPath = path.join(process.cwd(), '..', 'data', 'raw', 'healthcare.json')

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    cachedData = JSON.parse(fileContent)
    console.log(`✅ Loaded ${cachedData!.length} healthcare facilities from local data`)
    return cachedData!
  } catch (error) {
    console.error('Failed to load healthcare data:', error)
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
    const typeFilter = searchParams.get('type') // doctor, pharmacy, hospital, clinic

    const allData = loadData()

    // Filter by bounds
    let filtered = allData.filter(item =>
      item.lat >= minLat &&
      item.lat <= maxLat &&
      item.lng >= minLng &&
      item.lng <= maxLng
    )

    // Filter by type if specified
    if (typeFilter) {
      filtered = filtered.filter(item =>
        item.type?.toLowerCase().includes(typeFilter.toLowerCase())
      )
    }

    // Limit results
    const healthcare = filtered.slice(0, limit)

    // Transform to expected format
    const transformedHealthcare = healthcare.map(item => ({
      id: item.id,
      name: item.name || item.type || 'Healthcare',
      type: item.type,
      coordinates: {
        lat: item.lat,
        lng: item.lng
      },
      address: {
        street: item.street,
        houseNumber: item.house_number,
        postalCode: item.postal_code,
        city: item.city,
      },
      website: item.website,
      phone: item.phone,
      openingHours: item.opening_hours,
      wheelchair: item.wheelchair,
      specialty: item.healthcare_specialty,
    }))

    return NextResponse.json({
      success: true,
      count: transformedHealthcare.length,
      total: filtered.length,
      healthcare: transformedHealthcare,
    })
  } catch (error) {
    console.error('Error fetching healthcare:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch healthcare', details: String(error) },
      { status: 500 }
    )
  }
}
