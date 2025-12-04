import { useState, useEffect } from 'react'

export interface AddressSnapshot {
  success: boolean
  address: string
  coordinates: { lat: number; lng: number }
  area_code?: string
  snapshot: {
    amenities: {
      supermarkets: { count: number; nearest?: { name: string; distance: number }; items: any[] }
      healthcare: { count: number; nearest?: { name: string; distance: number }; items: any[] }
      playgrounds: { count: number; nearest?: { distance: number }; items: any[] }
      parks: { count: number; nearest?: { name: string; distance: number }; items: any[] }
    }
    woz: {
      value: number | null
      year: number
      available: boolean
      note?: string
      historical?: {
        woz_2024?: number | null
        woz_2023?: number | null
        woz_2022?: number | null
        woz_2021?: number | null
        woz_2020?: number | null
        woz_2019?: number | null
        woz_2018?: number | null
        woz_2017?: number | null
        woz_2016?: number | null
        woz_2015?: number | null
        woz_2014?: number | null
      }
    }
    crime: {
      available: boolean
      note?: string
      rate?: string
      crime_rate_per_1000?: number
    }
    crime_metadata?: {
      source: string
      year: number
      netherlands_average: number
      netherlands_population?: number
      comparison_note?: string
    }
    livability: {
      score: number | null
      available: boolean
      note?: string
      overall_score?: number
      breakdown?: {
        total?: number | null
        physical?: number | null
        social?: number | null
        safety?: number | null
        facilities?: number | null
        housing?: number | null
      }
    }
    environment: {
      parksNearby?: number
      nearestPark?: { name: string; distance: number }
      greenSpaceQuality: string
    }
    demographics: {
      available: boolean
      note?: string
      population?: number
      households_total?: number
      avg_household_size?: number
      age_0_15?: number
      age_15_25?: number
      age_25_45?: number
      age_45_65?: number
      age_65_plus?: number
      pct_owner_occupied?: number
      pct_rental?: number
      avg_woz_value_k?: number
      owner_occupied_pct?: number
      rental_pct?: number
      avg_woz_value?: number
      municipality?: string
      [key: string]: any
    }
    energy_consumption?: {
      success?: boolean
      available?: boolean
      area_code?: string
      area_name?: string
      gas_m3_per_connection?: number
      electricity_kwh_per_connection?: number
      has_district_heating?: boolean
      district_heating_pct?: number
      district_heating_percentage?: number
      estimated_annual_cost_eur?: number
      monthly_cost_eur?: number
      gas_monthly_eur?: number
      electricity_monthly_eur?: number
      water_monthly_eur?: number
      avg_gas_consumption_m3?: number
      avg_electricity_delivery_kwh?: number
      avg_water_consumption_m3?: number
      cost_breakdown?: {
        gas_eur?: number
        electricity_eur?: number
        water_eur?: number
        gas?: { consumption: number; cost_per_unit: number; monthly: number }
        electricity?: { consumption: number; cost_per_unit: number; monthly: number }
        water?: { consumption: number; cost_per_unit: number; monthly: number }
      }
      [key: string]: any
    }
    proximity?: {
      area_code?: string
      area_name?: string
      area_type?: string
      period?: string
      // Healthcare
      dist_to_gp_km?: number
      gp_within_1km?: number
      gp_within_3km?: number
      dist_to_pharmacy_km?: number
      dist_to_hospital_km?: number
      hospital_within_5km?: number
      hospital_within_10km?: number
      // Shopping
      dist_to_supermarket_km?: number
      supermarket_within_1km?: number
      supermarket_within_3km?: number
      dist_to_daily_groceries_km?: number
      // Education & Childcare
      dist_to_primary_school_km?: number
      primary_school_within_1km?: number
      dist_to_daycare_km?: number
      daycare_within_1km?: number
      // Transport
      dist_to_train_station_km?: number
      dist_to_major_train_station_km?: number
      dist_to_highway_onramp_km?: number
      // Culture & Recreation
      dist_to_library_km?: number
      dist_to_museum_km?: number
      museum_within_5km?: number
      dist_to_theater_km?: number
      dist_to_cinema_km?: number
      cinema_within_5km?: number
      dist_to_swimming_pool_km?: number
      // Dining
      dist_to_restaurant_km?: number
      restaurant_within_1km?: number
      dist_to_cafe_km?: number
      [key: string]: any
    }
    nearest_train_station?: {
      name: string
      operator: string
      distance_km: number
      coordinates: { lat: number; lng: number }
      type: string
      station_code?: string
    }
    emergency_services?: {
      count: number
      items: Array<{
        name: string
        type: string
        lat: number
        lng: number
        distance_km: number
        [key: string]: any
      }>
    }
    cultural_amenities?: {
      count: number
      items: Array<{
        name: string
        type: string
        lat: number
        lng: number
        distance_km: number
        [key: string]: any
      }>
    }
    healthcare_facilities?: {
      count: number
      items: Array<{
        name: string
        type: string
        lat: number
        lng: number
        distance_km: number
        [key: string]: any
      }>
    }
  }
  metadata: {
    timestamp: string
    dataSource: string
    radiusKm: number
  }
}

export function useAddressSnapshot(
  coordinates: [number, number] | null,
  address: string = '',
  areaCode?: string
) {
  const [snapshot, setSnapshot] = useState<AddressSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!coordinates) {
      setSnapshot(null)
      return
    }

    const fetchSnapshot = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [lng, lat] = coordinates
        const params = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          address: address
        })

        // If we have a neighborhood code from PDOK, pass it along
        if (areaCode) {
          params.append('area_code', areaCode)
        }

        const response = await fetch(`/api/snapshot?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch snapshot: ${response.statusText}`)
        }

        const data = await response.json()
        setSnapshot(data)
      } catch (err) {
        console.error('Error fetching address snapshot:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSnapshot()
  }, [coordinates, address, areaCode])

  return { snapshot, isLoading, error }
}
