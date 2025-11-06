import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Load sample data
    const dataPath = path.join(process.cwd(), '..', 'data', 'samples', 'sample_properties.json')
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(fileContent)

    // Find property by ID
    const property = data.properties.find((p: any) => p.id === id)

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      property: property,
    })
  } catch (error) {
    console.error('Error fetching property:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch property' },
      { status: 500 }
    )
  }
}
