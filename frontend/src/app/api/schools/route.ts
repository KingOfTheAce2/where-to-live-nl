import { NextRequest, NextResponse } from 'next/server'
import { readParquetFile } from '@/lib/parquet-reader'
import path from 'path'

interface SchoolFilter {
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  type?: string // 'po', 'vo', 'so', 'mbo', 'ho'
  city?: string
}

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
  school_type: string // po, vo, so, mbo, ho
  school_type_label: string
  file_type: string
  denomination?: string
  latitude?: number
  longitude?: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Build backend URL
    const backendUrl = new URL('http://localhost:8000/api/schools')

    // Forward all query parameters to backend
    const minLat = searchParams.get('minLat')
    const maxLat = searchParams.get('maxLat')
    const minLng = searchParams.get('minLng')
    const maxLng = searchParams.get('maxLng')
    const type = searchParams.get('type')
    const limit = searchParams.get('limit')

    if (minLat) backendUrl.searchParams.set('minLat', minLat)
    if (maxLat) backendUrl.searchParams.set('maxLat', maxLat)
    if (minLng) backendUrl.searchParams.set('minLng', minLng)
    if (maxLng) backendUrl.searchParams.set('maxLng', maxLng)
    if (type) backendUrl.searchParams.set('type', type)
    if (limit) backendUrl.searchParams.set('limit', limit)

    // Fetch from Python backend
    const backendResponse = await fetch(backendUrl.toString(), {
      headers: { 'Content-Type': 'application/json' }
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend API returned ${backendResponse.status}`)
    }

    const data = await backendResponse.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching schools:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schools', details: String(error) },
      { status: 500 }
    )
  }
}
