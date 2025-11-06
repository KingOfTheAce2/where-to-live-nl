/**
 * Isochrone utilities (simple circle-based approximation)
 *
 * NOTE: This is a simplified version using circles.
 * For production, integrate OSRM for accurate travel time polygons.
 */

/**
 * Calculate approximate radius in meters for travel time
 *
 * Simple assumptions:
 * - Bike: 15 km/h average speed
 * - Public transport: 25 km/h average (including wait times)
 * - Both: Use bike speed as conservative estimate
 *
 * @param minutes - Travel time in minutes
 * @param mode - Travel mode
 * @returns Radius in meters
 */
export function calculateRadius(
  minutes: number,
  mode: 'bike' | 'pt' | 'both'
): number {
  let kmPerHour: number

  switch (mode) {
    case 'bike':
      kmPerHour = 15 // 15 km/h cycling speed
      break
    case 'pt':
      kmPerHour = 25 // 25 km/h PT (including wait time)
      break
    case 'both':
      kmPerHour = 15 // Conservative estimate
      break
    default:
      kmPerHour = 15
  }

  // Convert to meters
  const hours = minutes / 60
  const km = hours * kmPerHour
  const meters = km * 1000

  return meters
}

/**
 * Create a circle GeoJSON feature
 *
 * @param center - [lng, lat]
 * @param radiusInMeters - Radius in meters
 * @param properties - Additional properties
 * @returns GeoJSON Feature
 */
export function createCircle(
  center: [number, number],
  radiusInMeters: number,
  properties?: Record<string, any>
): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 64 // Number of points in circle
  const coords: [number, number][] = []

  // Earth's radius in meters
  const earthRadius = 6371000

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI

    // Calculate offset
    const dx = radiusInMeters * Math.cos(angle)
    const dy = radiusInMeters * Math.sin(angle)

    // Convert to lat/lng offsets
    const lat = center[1] + (dy / earthRadius) * (180 / Math.PI)
    const lng =
      center[0] +
      ((dx / earthRadius) * (180 / Math.PI)) / Math.cos((center[1] * Math.PI) / 180)

    coords.push([lng, lat])
  }

  // Close the circle
  coords.push(coords[0])

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: properties || {},
  }
}

/**
 * Get color for travel mode
 *
 * @param mode - Travel mode
 * @param opacity - Opacity (0-1)
 * @returns RGBA color string
 */
export function getModeColor(
  mode: 'bike' | 'pt' | 'both',
  opacity: number = 0.2
): string {
  switch (mode) {
    case 'bike':
      return `rgba(34, 197, 94, ${opacity})` // Green
    case 'pt':
      return `rgba(59, 130, 246, ${opacity})` // Blue
    case 'both':
      return `rgba(168, 85, 247, ${opacity})` // Purple
    default:
      return `rgba(100, 116, 139, ${opacity})` // Gray
  }
}

/**
 * Get border color for travel mode
 *
 * @param mode - Travel mode
 * @returns RGB color string
 */
export function getModeBorderColor(mode: 'bike' | 'pt' | 'both'): string {
  switch (mode) {
    case 'bike':
      return 'rgb(34, 197, 94)' // Green
    case 'pt':
      return 'rgb(59, 130, 246)' // Blue
    case 'both':
      return 'rgb(168, 85, 247)' // Purple
    default:
      return 'rgb(100, 116, 139)' // Gray
  }
}
