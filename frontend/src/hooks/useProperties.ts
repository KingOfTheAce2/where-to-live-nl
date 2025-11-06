import { useState, useEffect } from 'react'
import type { Property, PropertyFilters, PropertiesResponse } from '@/types/property'

interface UsePropertiesOptions {
  filters?: PropertyFilters
  limit?: number
  autoFetch?: boolean
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { filters, limit = 100, autoFetch = true } = options

  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProperties = async (customFilters?: PropertyFilters) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      const activeFilters = customFilters || filters || {}

      // Add filters to query params
      if (activeFilters.minLat !== undefined) params.set('minLat', activeFilters.minLat.toString())
      if (activeFilters.maxLat !== undefined) params.set('maxLat', activeFilters.maxLat.toString())
      if (activeFilters.minLng !== undefined) params.set('minLng', activeFilters.minLng.toString())
      if (activeFilters.maxLng !== undefined) params.set('maxLng', activeFilters.maxLng.toString())
      if (activeFilters.minPrice !== undefined) params.set('minPrice', activeFilters.minPrice.toString())
      if (activeFilters.maxPrice !== undefined) params.set('maxPrice', activeFilters.maxPrice.toString())
      if (activeFilters.propertyTypes && activeFilters.propertyTypes.length > 0) {
        params.set('types', activeFilters.propertyTypes.join(','))
      }
      if (activeFilters.minRooms !== undefined) params.set('minRooms', activeFilters.minRooms.toString())
      if (activeFilters.maxRooms !== undefined) params.set('maxRooms', activeFilters.maxRooms.toString())
      if (activeFilters.minArea !== undefined) params.set('minArea', activeFilters.minArea.toString())
      if (activeFilters.maxArea !== undefined) params.set('maxArea', activeFilters.maxArea.toString())

      params.set('limit', limit.toString())

      const response = await fetch(`/api/properties?${params.toString()}`)
      const data: PropertiesResponse = await response.json()

      if (data.success) {
        setProperties(data.properties)
      } else {
        setError('Failed to fetch properties')
      }
    } catch (err) {
      setError('Failed to fetch properties')
      console.error('Error fetching properties:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (autoFetch) {
      fetchProperties()
    }
  }, [autoFetch])

  return {
    properties,
    isLoading,
    error,
    refetch: fetchProperties,
  }
}

export function useProperty(id: string | null) {
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setProperty(null)
      return
    }

    const fetchProperty = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/properties/${id}`)
        const data = await response.json()

        if (data.success) {
          setProperty(data.property)
        } else {
          setError('Property not found')
        }
      } catch (err) {
        setError('Failed to fetch property')
        console.error('Error fetching property:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperty()
  }, [id])

  return { property, isLoading, error }
}
