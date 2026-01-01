import { NextResponse } from 'next/server'

/**
 * Real-time Air Quality API - Luchtmeetnet
 *
 * Fetches current air quality measurements from all monitoring stations
 * across the Netherlands via the Luchtmeetnet Open API.
 */

interface Station {
  number: string
  location: string
  coordinates?: [number, number]
  municipality?: string
  type?: string
  components?: string[]
}

interface Measurement {
  station_number: string
  value: number
  timestamp_measured: string
  formula: string
}

interface StationWithMeasurements extends Station {
  measurements: {
    NO2?: number
    PM10?: number
    PM25?: number
    O3?: number
    timestamp?: string
  }
  lki?: number // Air Quality Index
  lki_label?: string
}

// Cache for 5 minutes to reduce API calls
let cachedData: { stations: StationWithMeasurements[], timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    // Return cached data if still valid
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cachedData.stations,
        cached: true,
        cache_age_seconds: Math.round((Date.now() - cachedData.timestamp) / 1000)
      })
    }

    // Fetch all stations
    const stationsRes = await fetch('https://api.luchtmeetnet.nl/open_api/stations?page=1&per_page=200', {
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
      next: { revalidate: 300 } // 5 min cache
    })

    if (!stationsRes.ok) {
      throw new Error(`Failed to fetch stations: ${stationsRes.status}`)
    }

    const stationsData = await stationsRes.json()
    const stationsList: Station[] = stationsData.data || []

    // Fetch station details and measurements in parallel (limit concurrency)
    const stationsWithData: StationWithMeasurements[] = await Promise.all(
      stationsList.slice(0, 100).map(async (station) => {
        try {
          // Fetch station details for coordinates
          const detailRes = await fetch(
            `https://api.luchtmeetnet.nl/open_api/stations/${station.number}`,
            { headers: { 'Accept': 'application/json' }, redirect: 'follow' }
          )

          let coordinates: [number, number] | undefined
          let municipality: string | undefined
          let type: string | undefined
          let components: string[] | undefined

          if (detailRes.ok) {
            const detail = await detailRes.json()
            if (detail.data?.geometry?.coordinates) {
              coordinates = detail.data.geometry.coordinates
            }
            municipality = detail.data?.municipality
            type = detail.data?.type
            components = detail.data?.components
          }

          // Fetch latest measurements for key pollutants
          const measurements: StationWithMeasurements['measurements'] = {}

          for (const formula of ['NO2', 'PM10', 'PM25', 'O3']) {
            try {
              const measureRes = await fetch(
                `https://api.luchtmeetnet.nl/open_api/measurements?station_number=${station.number}&formula=${formula}&page=1&per_page=1&order_by=timestamp_measured&order_direction=desc`,
                {
                  headers: { 'Accept': 'application/json' },
                  redirect: 'follow' // Follow 302 redirects
                }
              )

              if (measureRes.ok) {
                const measureData = await measureRes.json()
                if (measureData.data?.[0]) {
                  const m = measureData.data[0] as Measurement
                  // Type-safe assignment for pollutant values
                  if (formula === 'NO2') measurements.NO2 = m.value
                  else if (formula === 'PM10') measurements.PM10 = m.value
                  else if (formula === 'PM25') measurements.PM25 = m.value
                  else if (formula === 'O3') measurements.O3 = m.value

                  if (!measurements.timestamp) {
                    measurements.timestamp = m.timestamp_measured
                  }
                }
              }
            } catch {
              // Skip this measurement
            }
          }

          // Fetch LKI (Air Quality Index)
          let lki: number | undefined
          let lki_label: string | undefined
          try {
            const lkiRes = await fetch(
              `https://api.luchtmeetnet.nl/open_api/lki?station_number=${station.number}&order_by=timestamp_measured&order_direction=desc&per_page=1`,
              { headers: { 'Accept': 'application/json' }, redirect: 'follow' }
            )
            if (lkiRes.ok) {
              const lkiData = await lkiRes.json()
              if (lkiData.data?.[0]) {
                lki = lkiData.data[0].value
                // Map LKI to label
                if (lki !== undefined) {
                  if (lki <= 3) lki_label = 'Good'
                  else if (lki <= 6) lki_label = 'Moderate'
                  else if (lki <= 8) lki_label = 'Unhealthy for Sensitive'
                  else if (lki <= 10) lki_label = 'Unhealthy'
                  else lki_label = 'Very Unhealthy'
                }
              }
            }
          } catch {
            // Skip LKI
          }

          return {
            number: station.number,
            location: station.location,
            coordinates,
            municipality,
            type,
            components,
            measurements,
            lki,
            lki_label
          }
        } catch {
          return {
            number: station.number,
            location: station.location,
            measurements: {}
          }
        }
      })
    )

    // Filter out stations without coordinates
    const validStations = stationsWithData.filter(s => s.coordinates)

    // Update cache
    cachedData = {
      stations: validStations,
      timestamp: Date.now()
    }

    return NextResponse.json({
      success: true,
      data: validStations,
      count: validStations.length,
      cached: false
    })

  } catch (error) {
    console.error('Error fetching air quality data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch air quality data'
      },
      { status: 500 }
    )
  }
}
