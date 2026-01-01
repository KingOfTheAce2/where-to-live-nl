import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface SnapshotRequest {
  lat: number
  lng: number
  address: string
}

interface AmenityCounts {
  supermarkets: { count: number; nearest?: { name: string; distance: number }; items: any[] }
  healthcare: { count: number; nearest?: { name: string; distance: number }; items: any[] }
  playgrounds: { count: number; nearest?: { distance: number }; items: any[] }
  parks: { count: number; nearest?: { name: string; distance: number }; items: any[] }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function loadAmenityData(filename: string): any[] | null {
  try {
    const dataPath = path.join(process.cwd(), '../data/raw', filename)
    const fileContent = fs.readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(fileContent)

    // Handle both formats: {metadata, data: [...]} or flat array [...]
    let items: any[] = Array.isArray(parsed) ? parsed : (parsed.data || [])

    // Normalize coordinate property names (some files use 'latitude' instead of 'lat')
    items = items.map(item => ({
      ...item,
      lat: item.lat ?? item.latitude,
      lng: item.lng ?? item.longitude
    }))

    return items
  } catch (error) {
    console.error(`Error loading ${filename}:`, error)
    return null
  }
}

async function loadTrainStations() {
  try {
    const { readParquetFile } = await import('@/lib/parquet-reader')
    const dataPath = path.join(process.cwd(), '../data/processed', 'train_stations.parquet')
    const stations = await readParquetFile(dataPath)
    return stations
  } catch (error) {
    console.error('Error loading train stations:', error)
    return []
  }
}

function countNearbyAmenities(
  lat: number,
  lng: number,
  amenities: any[],
  radius: number = 2 // km
): { count: number; nearest?: any; items: any[] } {
  if (!amenities || amenities.length === 0) {
    return { count: 0, items: [] }
  }

  const nearby = amenities
    .filter(amenity => {
      if (!amenity.lat || !amenity.lng) return false
      const distance = calculateDistance(lat, lng, amenity.lat, amenity.lng)
      return distance <= radius
    })
    .map(amenity => ({
      ...amenity,
      distance: calculateDistance(lat, lng, amenity.lat, amenity.lng),
      distanceMeters: Math.round(calculateDistance(lat, lng, amenity.lat, amenity.lng) * 1000)
    }))
    .sort((a, b) => a.distance - b.distance)

  const nearest = nearby[0]

  return {
    count: nearby.length,
    nearest: nearest ? {
      name: nearest.name || 'Unknown',
      distance: Math.round(nearest.distance * 1000) // meters
    } : undefined,
    items: nearby // Return all nearby items for map display
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const address = searchParams.get('address') || ''
    let areaCode = searchParams.get('area_code') || '' // Neighborhood code from PDOK (or resolved by backend)

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing lat/lng parameters' },
        { status: 400 }
      )
    }

    // Load amenity data (using correct file names)
    const supermarketsData = loadAmenityData('supermarkets.json')
    const healthcareData = loadAmenityData('healthcare.json')
    const trainStations = await loadTrainStations()

    // Count nearby amenities (within 2km)
    const amenities: AmenityCounts = {
      supermarkets: supermarketsData ? countNearbyAmenities(lat, lng, supermarketsData, 2) : { count: 0, items: [] },
      healthcare: healthcareData ? countNearbyAmenities(lat, lng, healthcareData, 2) : { count: 0, items: [] },
      playgrounds: { count: 0, items: [] }, // No playground data yet
      parks: { count: 0, items: [] }, // No parks data yet
    }

    // WOZ data - fetch from backend if postal code + house number available
    const postalCode = searchParams.get('postal_code')
    const houseNumber = searchParams.get('house_number')

    let wozData = {
      value: null,
      year: 2024,
      available: false,
      note: 'WOZ data coverage: 18% (72,000 properties). Full ingestion takes months due to API rate limits.',
      historical: null as any
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'

    if (postalCode && houseNumber) {
      try {
        const wozUrl = `${backendUrl}/api/woz/${postalCode}/${houseNumber}`
        const wozResponse = await fetch(wozUrl, {
          headers: { 'Content-Type': 'application/json' }
        })

        if (wozResponse.ok) {
          const wozResult = await wozResponse.json()
          if (wozResult.success && wozResult.data) {
            wozData = {
              value: wozResult.data.woz_2024,
              year: 2024,
              available: true,
              note: 'Historical WOZ values 2014-2024 available',
              historical: {
                woz_2024: wozResult.data.woz_2024,
                woz_2023: wozResult.data.woz_2023,
                woz_2022: wozResult.data.woz_2022,
                woz_2021: wozResult.data.woz_2021,
                woz_2020: wozResult.data.woz_2020,
                woz_2019: wozResult.data.woz_2019,
                woz_2018: wozResult.data.woz_2018,
                woz_2017: wozResult.data.woz_2017,
                woz_2016: wozResult.data.woz_2016,
                woz_2015: wozResult.data.woz_2015,
                woz_2014: wozResult.data.woz_2014,
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching WOZ data:', err)
      }
    }

    // If we have area_code, fetch crime, livability, and demographics from Python backend
    let crimeData: {
      rate: string
      available: boolean
      note: string
      crime_rate_per_1000?: number
    } = {
      rate: 'Not available',
      available: false,
      note: 'No neighborhood code provided'
    }

    let crimeMetadata: {
      source: string
      year: number
      netherlands_average: number
      netherlands_population?: number
      comparison_note?: string
    } | null = null

    let livabilityData: {
      score: number | null
      available: boolean
      note: string
      overall_score?: number
      breakdown?: {
        total?: number | null
        physical?: number | null
        social?: number | null
        safety?: number | null
        facilities?: number | null
        housing?: number | null
      }
    } = {
      score: null,
      available: false,
      note: 'No neighborhood code provided'
    }

    let demographics = {
      available: false,
      note: 'No neighborhood code provided'
    }

    let energyLabel: {
      available: boolean
      estimated_energy_label?: string
      energy_label_numeric?: number
      energy_label_description?: string
      avg_gas_m3?: number
      avg_electricity_kwh?: number
      municipality?: string
    } = {
      available: false
    }

    // Always call Python backend - it can do coordinate-based neighborhood lookup if needed
    try {
      // Build URL with coordinates and optional area_code
      const snapshotParams = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString()
      })
      if (areaCode) {
        snapshotParams.append('area_code', areaCode)
      }
      const snapshotUrl = `${backendUrl}/api/snapshot?${snapshotParams.toString()}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout for coordinate lookup

      const backendResponse = await fetch(snapshotUrl, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      })
      clearTimeout(timeoutId)

      if (backendResponse.ok) {
        const backendData = await backendResponse.json()

        // If backend resolved the area_code from coordinates, use it
        if (backendData.area_code && !areaCode) {
          areaCode = backendData.area_code
        }

        // Extract crime data
        if (backendData.crime) {
          const crimeCount = backendData.crime.GeregistreerdeMisdrijven_1
          const population = backendData.demographics?.population || 1
          const crimeRateNum = population > 0 ? (crimeCount / population * 1000) : 0
          const crimeRate = crimeRateNum > 0 ? crimeRateNum.toFixed(1) : 'N/A'

          crimeData = {
            rate: `${crimeRate} per 1,000 residents (${crimeCount} total)`,
            crime_rate_per_1000: crimeRateNum,
            available: true,
            note: `${backendData.crime.year} crime data`
          }

          // Extract crime metadata with national average
          if (backendData.crime_metadata) {
            crimeMetadata = {
              source: backendData.crime_metadata.source || 'Politie.nl / CBS',
              year: backendData.crime_metadata.year || backendData.crime.year || 2024,
              netherlands_average: backendData.crime_metadata.netherlands_average || 45,
              netherlands_population: backendData.crime_metadata.netherlands_population,
              comparison_note: backendData.crime_metadata.comparison_note
            }
          }
        }

        // Extract livability data
        if (backendData.livability) {
          // Build note with explanation if some dimensions are null
          const nullDimensions = []
          if (backendData.livability.score_safety === null) nullDimensions.push('Safety')
          if (backendData.livability.score_physical === null) nullDimensions.push('Physical')
          if (backendData.livability.score_social === null) nullDimensions.push('Social')
          if (backendData.livability.score_facilities === null) nullDimensions.push('Facilities')
          if (backendData.livability.score_housing === null) nullDimensions.push('Housing')

          let note = `${backendData.livability.area_name || 'Leefbaarometer'} - Score ${backendData.livability.score_total}/10`
          if (nullDimensions.length > 0) {
            note += ` (${nullDimensions.join(', ')} data unavailable - total uses official Leefbaarometer calculation)`
          }

          livabilityData = {
            score: backendData.livability.score_total,
            overall_score: backendData.livability.score_total,
            available: true,
            note: note,
            breakdown: {
              physical: backendData.livability.score_physical,
              social: backendData.livability.score_social,
              safety: backendData.livability.score_safety,
              facilities: backendData.livability.score_facilities,
              housing: backendData.livability.score_housing
            }
          }
        }

        // Extract demographics
        if (backendData.demographics) {
          demographics = {
            available: true,
            note: `CBS 2024 data for neighborhood ${backendData.area_code || areaCode}`,
            ...backendData.demographics
          }
        }

        // Extract energy label
        if (backendData.energy_label) {
          energyLabel = {
            available: true,
            ...backendData.energy_label
          }
        }
      }
    } catch (err) {
      console.error('Error fetching from Python backend:', err)
    }

    // Environment data (count parks and green spaces)
    const environment = {
      parksNearby: amenities.parks.count,
      nearestPark: amenities.parks.nearest,
      greenSpaceQuality: amenities.parks.count > 0 ? 'Good' : 'Limited',
    }

    // Find nearest train station
    let nearestTrainStation = null
    if (trainStations && trainStations.length > 0) {
      const stationsWithDistance = trainStations
        .filter((station: any) => station.lat && station.lon)
        .map((station: any) => ({
          ...station,
          distance_km: calculateDistance(lat, lng, station.lat, station.lon)
        }))
        .sort((a: any, b: any) => a.distance_km - b.distance_km)

      if (stationsWithDistance.length > 0) {
        const nearest = stationsWithDistance[0]
        nearestTrainStation = {
          name: nearest.name,
          operator: nearest.operator || 'NS',
          distance_km: nearest.distance_km,
          coordinates: {
            lat: nearest.lat,
            lng: nearest.lon
          },
          type: nearest.railway_type,
          station_code: nearest.station_code
        }
      }
    }

    // Fetch additional data from backend in parallel
    let energyConsumption = null
    let proximity = null
    let emergencyServices = null
    let culturalAmenities = null
    let healthcareFacilities = null

    try {
      const radius = 0.05 // ~5km in lat/lng degrees

      const [energyRes, proximityRes, emergencyRes, culturalRes, healthcareRes] = await Promise.allSettled([
        areaCode ? fetch(`${backendUrl}/api/energy-consumption/${areaCode}`).then(r => r.json()) : Promise.resolve(null),
        areaCode ? fetch(`${backendUrl}/api/proximity/${areaCode}`).then(r => r.json()) : Promise.resolve(null),
        fetch(`${backendUrl}/api/emergency-services?minLat=${lat-radius}&maxLat=${lat+radius}&minLng=${lng-radius}&maxLng=${lng+radius}&limit=20`).then(r => r.json()),
        fetch(`${backendUrl}/api/cultural-amenities?minLat=${lat-radius}&maxLat=${lat+radius}&minLng=${lng-radius}&maxLng=${lng+radius}&limit=20`).then(r => r.json()),
        fetch(`${backendUrl}/api/healthcare-facilities?minLat=${lat-radius}&maxLat=${lat+radius}&minLng=${lng-radius}&maxLng=${lng+radius}&limit=20`).then(r => r.json()),
      ])

      if (energyRes.status === 'fulfilled' && energyRes.value?.success) {
        energyConsumption = energyRes.value
      }
      if (proximityRes.status === 'fulfilled' && proximityRes.value?.success) {
        proximity = proximityRes.value.data
      }
      if (emergencyRes.status === 'fulfilled' && emergencyRes.value?.success) {
        emergencyServices = {
          count: emergencyRes.value.count,
          items: emergencyRes.value.data.map((item: any) => ({
            ...item,
            distance_km: calculateDistance(lat, lng, item.lat, item.lng)
          })).sort((a: any, b: any) => a.distance_km - b.distance_km)
        }
      }
      if (culturalRes.status === 'fulfilled' && culturalRes.value?.success) {
        culturalAmenities = {
          count: culturalRes.value.count,
          items: culturalRes.value.data.map((item: any) => ({
            ...item,
            distance_km: calculateDistance(lat, lng, item.lat, item.lng)
          })).sort((a: any, b: any) => a.distance_km - b.distance_km)
        }
      }
      if (healthcareRes.status === 'fulfilled' && healthcareRes.value?.success) {
        healthcareFacilities = {
          count: healthcareRes.value.count,
          items: healthcareRes.value.data.map((item: any) => ({
            ...item,
            distance_km: calculateDistance(lat, lng, item.lat, item.lng)
          })).sort((a: any, b: any) => a.distance_km - b.distance_km)
        }
      }
    } catch (err) {
      console.error('Error fetching additional backend data:', err)
    }

    return NextResponse.json({
      success: true,
      address,
      coordinates: { lat, lng },
      area_code: areaCode, // Include area code for neighborhood boundary highlighting
      snapshot: {
        amenities,
        woz: wozData,
        crime: crimeData,
        crime_metadata: crimeMetadata,
        livability: livabilityData,
        environment,
        demographics,
        nearest_train_station: nearestTrainStation,
        energy_consumption: energyConsumption,
        energy_label: energyLabel,
        proximity,
        emergency_services: emergencyServices,
        cultural_amenities: culturalAmenities,
        healthcare_facilities: healthcareFacilities,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        dataSource: 'OpenStreetMap, PDOK, CBS, RDW',
        radiusKm: 2,
      }
    })

  } catch (error) {
    console.error('Error generating snapshot:', error)
    return NextResponse.json(
      { error: 'Failed to generate neighborhood snapshot' },
      { status: 500 }
    )
  }
}
