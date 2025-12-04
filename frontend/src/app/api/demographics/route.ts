import { NextRequest, NextResponse } from 'next/server'
import { getDemographicsByAreaCode, formatDemographicsForDisplay } from '@/lib/parquet-reader'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const areaCode = searchParams.get('area_code')

    if (!areaCode) {
      return NextResponse.json(
        { error: 'Missing area_code parameter' },
        { status: 400 }
      )
    }

    // Read demographics data from Parquet
    const demographicsData = await getDemographicsByAreaCode(areaCode)

    if (!demographicsData) {
      return NextResponse.json(
        {
          error: 'No demographics data found for this area code',
          area_code: areaCode
        },
        { status: 404 }
      )
    }

    // Format for frontend
    const formatted = formatDemographicsForDisplay(demographicsData)

    return NextResponse.json({
      success: true,
      area_code: areaCode,
      municipality: demographicsData.municipality,
      demographics: formatted,
      metadata: {
        source: 'CBS (Statistics Netherlands)',
        year: 2024,
        license: 'CC-BY 4.0',
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Error fetching demographics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    )
  }
}
