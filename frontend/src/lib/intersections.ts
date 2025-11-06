/**
 * Calculate if a point is within a circle
 */
export function isPointInCircle(
  point: [number, number], // [lng, lat]
  center: [number, number], // [lng, lat]
  radiusMeters: number
): boolean {
  const distance = getDistance(point, center)
  return distance <= radiusMeters
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function getDistance(
  point1: [number, number], // [lng, lat]
  point2: [number, number]  // [lng, lat]
): number {
  const R = 6371000 // Earth's radius in meters
  const lat1 = toRadians(point1[1])
  const lat2 = toRadians(point2[1])
  const deltaLat = toRadians(point2[1] - point1[1])
  const deltaLng = toRadians(point2[0] - point1[0])

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Check if a point is within ALL circles (intersection area)
 */
export function isPointInAllCircles(
  point: [number, number],
  circles: Array<{ center: [number, number]; radius: number }>
): boolean {
  if (circles.length === 0) return true

  return circles.every((circle) =>
    isPointInCircle(point, circle.center, circle.radius)
  )
}

/**
 * Generate a grid of points to approximate the intersection polygon
 * This is a simplified approach - for production, use proper polygon intersection
 */
export function approximateIntersectionPolygon(
  circles: Array<{ center: [number, number]; radius: number }>,
  gridResolution: number = 50 // number of points per axis
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  if (circles.length === 0) return null
  if (circles.length === 1) {
    // If only one circle, return that circle as polygon
    return createCirclePolygon(circles[0].center, circles[0].radius)
  }

  // Find bounding box of all circles
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  circles.forEach((circle) => {
    // Approximate bounds using radius
    const [lng, lat] = circle.center
    const latDelta = (circle.radius / 111000) // rough conversion meters to degrees
    const lngDelta = (circle.radius / (111000 * Math.cos((lat * Math.PI) / 180)))

    minLng = Math.min(minLng, lng - lngDelta)
    maxLng = Math.max(maxLng, lng + lngDelta)
    minLat = Math.min(minLat, lat - latDelta)
    maxLat = Math.max(maxLat, lat + latDelta)
  })

  // Generate grid and find points in intersection
  const points: [number, number][] = []

  for (let i = 0; i <= gridResolution; i++) {
    for (let j = 0; j <= gridResolution; j++) {
      const lng = minLng + (maxLng - minLng) * (i / gridResolution)
      const lat = minLat + (maxLat - minLat) * (j / gridResolution)
      const point: [number, number] = [lng, lat]

      if (isPointInAllCircles(point, circles)) {
        points.push(point)
      }
    }
  }

  if (points.length === 0) {
    return null // No intersection
  }

  // Create a convex hull of the intersection points
  const hull = convexHull(points)

  if (hull.length < 3) {
    return null // Not enough points to form a polygon
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [hull],
    },
    properties: {
      type: 'intersection',
    },
  }
}

/**
 * Calculate convex hull using Graham scan algorithm
 */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points

  // Find the bottom-most point (or left-most if tied)
  let bottom = points[0]
  let bottomIndex = 0

  for (let i = 1; i < points.length; i++) {
    if (
      points[i][1] < bottom[1] ||
      (points[i][1] === bottom[1] && points[i][0] < bottom[0])
    ) {
      bottom = points[i]
      bottomIndex = i
    }
  }

  // Sort points by polar angle with respect to bottom point
  const sorted = [...points]
  sorted.splice(bottomIndex, 1)
  sorted.sort((a, b) => {
    const angleA = Math.atan2(a[1] - bottom[1], a[0] - bottom[0])
    const angleB = Math.atan2(b[1] - bottom[1], b[0] - bottom[0])
    return angleA - angleB
  })

  // Build hull
  const hull: [number, number][] = [bottom, sorted[0], sorted[1]]

  for (let i = 2; i < sorted.length; i++) {
    let top = hull[hull.length - 1]
    let nextToTop = hull[hull.length - 2]

    while (
      hull.length >= 2 &&
      crossProduct(nextToTop, top, sorted[i]) <= 0
    ) {
      hull.pop()
      top = hull[hull.length - 1]
      nextToTop = hull[hull.length - 2]
    }

    hull.push(sorted[i])
  }

  // Close the polygon
  hull.push(bottom)

  return hull
}

function crossProduct(
  o: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  return (
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  )
}

/**
 * Create a circle polygon (for single circle case)
 */
function createCirclePolygon(
  center: [number, number],
  radiusMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const earthRadius = 6371000 // meters

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dx = radiusMeters * Math.cos(angle)
    const dy = radiusMeters * Math.sin(angle)

    const lat = center[1] + (dy / earthRadius) * (180 / Math.PI)
    const lng =
      center[0] +
      ((dx / earthRadius) * (180 / Math.PI)) /
        Math.cos((center[1] * Math.PI) / 180)

    coords.push([lng, lat])
  }

  // Close the polygon
  coords.push(coords[0])

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {
      type: 'circle',
    },
  }
}

/**
 * Filter properties to only those in the intersection area
 */
export function filterPropertiesInIntersection<T extends { coordinates: { lng: number; lat: number } }>(
  properties: T[],
  circles: Array<{ center: [number, number]; radius: number }>
): T[] {
  if (circles.length === 0) return properties

  return properties.filter((property) => {
    const point: [number, number] = [
      property.coordinates.lng,
      property.coordinates.lat,
    ]
    return isPointInAllCircles(point, circles)
  })
}
