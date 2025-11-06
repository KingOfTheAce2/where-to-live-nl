/**
 * PDOK Locatieserver API utilities
 *
 * Free geocoding service from the Dutch government
 * Documentation: https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/
 */

export interface PDOKSuggestion {
  id: string
  type: string // 'adres', 'weg', 'postcode', etc.
  weergavenaam: string // Display name
  score: number
}

export interface PDOKAddress {
  id: string
  type: string
  weergavenaam: string
  centroide_ll: string // "POINT(lon lat)"
  straatnaam?: string
  huisnummer?: number
  huisletter?: string
  postcode?: string
  woonplaatsnaam?: string
  gemeentenaam?: string
  provincienaam?: string
}

export interface GeocodedLocation {
  address: string
  coordinates: [number, number] // [lng, lat]
  type: string
  details?: PDOKAddress
}

const PDOK_SUGGEST_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest'
const PDOK_LOOKUP_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup'
const PDOK_FREE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'

/**
 * Search for address suggestions (autocomplete)
 *
 * @param query - User's search query
 * @param options - Additional options
 * @returns Array of suggestions
 */
export async function searchAddresses(
  query: string,
  options?: {
    limit?: number
    type?: string // 'adres', 'weg', 'postcode', etc.
  }
): Promise<PDOKSuggestion[]> {
  if (!query || query.length < 2) {
    return []
  }

  const params = new URLSearchParams({
    q: query,
    rows: (options?.limit || 10).toString(),
  })

  if (options?.type) {
    params.append('fq', `type:${options.type}`)
  }

  try {
    const response = await fetch(`${PDOK_SUGGEST_URL}?${params}`)

    if (!response.ok) {
      throw new Error(`PDOK API error: ${response.status}`)
    }

    const data = await response.json()
    return data.response?.docs || []
  } catch (error) {
    console.error('Error fetching address suggestions:', error)
    return []
  }
}

/**
 * Get full details for a suggestion
 *
 * @param id - Suggestion ID from searchAddresses
 * @returns Full address details with coordinates
 */
export async function lookupAddress(id: string): Promise<PDOKAddress | null> {
  const params = new URLSearchParams({ id })

  try {
    const response = await fetch(`${PDOK_LOOKUP_URL}?${params}`)

    if (!response.ok) {
      throw new Error(`PDOK API error: ${response.status}`)
    }

    const data = await response.json()
    const docs = data.response?.docs || []

    return docs[0] || null
  } catch (error) {
    console.error('Error looking up address:', error)
    return null
  }
}

/**
 * Geocode an address (search + lookup in one step)
 *
 * @param query - Address string
 * @returns Geocoded location with coordinates
 */
export async function geocodeAddress(query: string): Promise<GeocodedLocation | null> {
  // First, get suggestions
  const suggestions = await searchAddresses(query, { limit: 1, type: 'adres' })

  if (suggestions.length === 0) {
    return null
  }

  // Then, lookup full details
  const details = await lookupAddress(suggestions[0].id)

  if (!details || !details.centroide_ll) {
    return null
  }

  // Parse coordinates from "POINT(lon lat)" format
  const coords = parseCoordinates(details.centroide_ll)

  if (!coords) {
    return null
  }

  return {
    address: details.weergavenaam,
    coordinates: coords,
    type: details.type,
    details,
  }
}

/**
 * Reverse geocode (coordinates → address)
 *
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns Nearest address
 */
export async function reverseGeocode(
  lng: number,
  lat: number
): Promise<GeocodedLocation | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    rows: '1',
  })

  try {
    const response = await fetch(`${PDOK_FREE_URL}?${params}`)

    if (!response.ok) {
      throw new Error(`PDOK API error: ${response.status}`)
    }

    const data = await response.json()
    const docs = data.response?.docs || []

    if (docs.length === 0) {
      return null
    }

    const details = docs[0]
    const coords = parseCoordinates(details.centroide_ll)

    if (!coords) {
      return null
    }

    return {
      address: details.weergavenaam,
      coordinates: coords,
      type: details.type,
      details,
    }
  } catch (error) {
    console.error('Error reverse geocoding:', error)
    return null
  }
}

/**
 * Parse coordinates from PDOK's "POINT(lon lat)" format
 *
 * @param pointString - e.g., "POINT(4.9041 52.3676)"
 * @returns [lng, lat] or null
 */
export function parseCoordinates(pointString: string): [number, number] | null {
  if (!pointString) return null

  const match = pointString.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/)

  if (!match) return null

  const lng = parseFloat(match[1])
  const lat = parseFloat(match[2])

  if (isNaN(lng) || isNaN(lat)) return null

  return [lng, lat]
}

/**
 * Format address for display
 *
 * @param address - PDOK address object
 * @returns Formatted string
 */
export function formatAddress(address: PDOKAddress): string {
  const parts: string[] = []

  if (address.straatnaam) {
    parts.push(address.straatnaam)
  }

  if (address.huisnummer) {
    let number = address.huisnummer.toString()
    if (address.huisletter) {
      number += address.huisletter
    }
    parts.push(number)
  }

  if (address.postcode && address.woonplaatsnaam) {
    parts.push(`${address.postcode} ${address.woonplaatsnaam}`)
  } else if (address.woonplaatsnaam) {
    parts.push(address.woonplaatsnaam)
  }

  return parts.join(', ')
}

/**
 * Check if coordinates are within Netherlands bounds
 *
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns true if within NL
 */
export function isInNetherlands(lng: number, lat: number): boolean {
  // Netherlands bounding box (approximate)
  const bounds = {
    minLng: 3.3,
    maxLng: 7.2,
    minLat: 50.7,
    maxLat: 53.6,
  }

  return (
    lng >= bounds.minLng &&
    lng <= bounds.maxLng &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  )
}
