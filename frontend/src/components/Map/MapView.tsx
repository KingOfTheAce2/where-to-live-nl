'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination } from '@/app/page'
import type { Property, PropertyFilters } from '@/types/property'
import type { School } from '@/types/school'
import { formatPrice, formatAddress, getPropertyTypeLabel } from '@/types/property'
import { getSchoolTypeLabel, getSchoolIcon } from '@/types/school'
import { createCircle, calculateRadius, getModeColor, getModeBorderColor } from '@/lib/isochrones'
import { approximateIntersectionPolygon } from '@/lib/intersections'

interface MapViewProps {
  destinations: Destination[]
  showProperties?: boolean
  showSchools?: boolean
  propertyFilters?: PropertyFilters
}

export default function MapView({ destinations, showProperties = true, showSchools = true, propertyFilters = {} }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map with PDOK tiles
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        name: 'PDOK Achtergrondkaart',
        sources: {
          'pdok-tiles': {
            type: 'raster',
            tiles: [
              'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© PDOK | © Kadaster',
          },
        },
        layers: [
          {
            id: 'pdok-background',
            type: 'raster',
            source: 'pdok-tiles',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [5.2913, 52.1326], // Center of Netherlands
      zoom: 7,
      maxZoom: 18,
      minZoom: 6,
    })

    // Add navigation controls
    map.current.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: false,
      }),
      'top-right'
    )

    // Add scale control
    map.current.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric',
      }),
      'bottom-left'
    )

    // Add geolocate control
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'top-right'
    )

    map.current.on('load', () => {
      setMapLoaded(true)
      console.log('Map loaded successfully with PDOK tiles')

      // Add source for isochrones
      map.current!.addSource('isochrones', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for isochrone fills
      map.current!.addLayer({
        id: 'isochrone-fills',
        type: 'fill',
        source: 'isochrones',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.3,
        },
      })

      // Add layer for isochrone borders
      map.current!.addLayer({
        id: 'isochrone-borders',
        type: 'line',
        source: 'isochrones',
        paint: {
          'line-color': ['get', 'strokeColor'],
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      })

      // Add source for intersection area (where ALL destinations are reachable)
      map.current!.addSource('intersection', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for intersection fill
      map.current!.addLayer({
        id: 'intersection-fill',
        type: 'fill',
        source: 'intersection',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.4,
        },
      })

      // Add layer for intersection border
      map.current!.addLayer({
        id: 'intersection-border',
        type: 'line',
        source: 'intersection',
        paint: {
          'line-color': '#059669',
          'line-width': 3,
        },
      })

      // Add source for properties
      map.current!.addSource('properties', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // Add layer for property clusters
      map.current!.addLayer({
        id: 'property-clusters',
        type: 'circle',
        source: 'properties',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#fef3c7',
            10,
            '#fde047',
            25,
            '#facc15',
            50,
            '#eab308'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            10,
            20,
            25,
            25,
            50,
            30
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add layer for cluster count labels
      map.current!.addLayer({
        id: 'property-cluster-count',
        type: 'symbol',
        source: 'properties',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#78350f',
        },
      })

      // Add layer for individual property points
      map.current!.addLayer({
        id: 'property-points',
        type: 'circle',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#fbbf24',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add click handlers for properties
      map.current!.on('click', 'property-points', (e) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const props = feature.properties

        if (!props) return

        const property: Property = JSON.parse(props.property)

        const popup = new maplibregl.Popup({ offset: 25 })
          .setLngLat([property.coordinates.lng, property.coordinates.lat])
          .setHTML(
            `<div style="padding: 12px; min-width: 250px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${formatPrice(property.valuation.woz_value)}</div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${formatAddress(property.address)}</div>
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">
                ${getPropertyTypeLabel(property.property.type)} • ${property.property.rooms} kamers
              </div>
              <div style="font-size: 11px; color: #999;">
                ${property.property.living_area_m2}m² woonoppervlak • Bouwjaar ${property.property.year_built}
              </div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">
                €${property.valuation.price_per_m2}/m² • Energielabel ${property.property.energy_label}
              </div>
            </div>`
          )
          .addTo(map.current!)
      })

      // Add click handler for clusters (zoom in)
      map.current!.on('click', 'property-clusters', (e) => {
        if (!e.features || e.features.length === 0 || !e.lngLat) return

        const features = e.features
        const clusterId = features[0].properties?.cluster_id

        if (!clusterId) return

        // Simply zoom in 2 levels on cluster click
        map.current!.easeTo({
          center: e.lngLat,
          zoom: map.current!.getZoom() + 2,
        })
      })

      // Change cursor on hover
      map.current!.on('mouseenter', 'property-points', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'property-points', () => {
        map.current!.getCanvas().style.cursor = ''
      })
      map.current!.on('mouseenter', 'property-clusters', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'property-clusters', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Add source for schools
      map.current!.addSource('schools', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for primary schools
      map.current!.addLayer({
        id: 'primary-schools',
        type: 'circle',
        source: 'schools',
        filter: ['==', 'type', 'primary'],
        paint: {
          'circle-color': '#f59e0b',
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add layer for secondary schools
      map.current!.addLayer({
        id: 'secondary-schools',
        type: 'circle',
        source: 'schools',
        filter: ['==', 'type', 'secondary'],
        paint: {
          'circle-color': '#8b5cf6',
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add click handler for schools
      const handleSchoolClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const props = feature.properties

        if (!props) return

        const school: School = JSON.parse(props.school)

        const popup = new maplibregl.Popup({ offset: 15 })
          .setLngLat([school.coordinates.lng, school.coordinates.lat])
          .setHTML(
            `<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${getSchoolIcon(school.type)} ${school.name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                ${getSchoolTypeLabel(school.type)}
              </div>
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">
                ${school.city} • ${school.denomination}
              </div>
              <div style="font-size: 11px; color: #999;">
                ${school.students} leerlingen • ${school.age_range} jaar
              </div>
              ${school.levels ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">
                ${school.levels.join(', ')}
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      }

      map.current!.on('click', 'primary-schools', handleSchoolClick)
      map.current!.on('click', 'secondary-schools', handleSchoolClick)

      // Change cursor on hover
      map.current!.on('mouseenter', 'primary-schools', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'primary-schools', () => {
        map.current!.getCanvas().style.cursor = ''
      })
      map.current!.on('mouseenter', 'secondary-schools', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'secondary-schools', () => {
        map.current!.getCanvas().style.cursor = ''
      })
    })

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Manage destination markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove markers that no longer exist
    const currentIds = new Set(destinations.map((d) => d.id))
    markers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    })

    // Add or update markers
    destinations.forEach((dest, index) => {
      if (!dest.coordinates) {
        // Remove marker if no coordinates
        const existingMarker = markers.current.get(dest.id)
        if (existingMarker) {
          existingMarker.remove()
          markers.current.delete(dest.id)
        }
        return
      }

      let marker = markers.current.get(dest.id)

      if (!marker) {
        // Create new marker
        const el = document.createElement('div')
        el.className = 'destination-marker'
        el.style.width = '32px'
        el.style.height = '32px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = '#3b82f6'
        el.style.border = '3px solid white'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
        el.style.cursor = 'pointer'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.fontSize = '14px'
        el.style.fontWeight = 'bold'
        el.style.color = 'white'
        el.style.transition = 'transform 0.2s'
        el.innerHTML = `${index + 1}`

        // Hover effect
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.1)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
        })

        marker = new maplibregl.Marker({ element: el })
          .setLngLat(dest.coordinates)
          .addTo(map.current!)

        markers.current.set(dest.id, marker)
      } else {
        // Update existing marker position
        marker.setLngLat(dest.coordinates)
      }

      // Update popup
      marker.setPopup(
        new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${dest.label}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${dest.address}</div>
            <div style="font-size: 11px; color: #999;">
              <span style="color: #3b82f6;">⏱️</span> Max ${dest.maxMinutes} min •
              ${dest.modes.includes('bike') ? '🚴' : ''}
              ${dest.modes.includes('pt') ? '🚊' : ''}
              ${dest.modes.includes('both') ? '🚴+🚊' : ''}
            </div>
          </div>`
        )
      )
    })

    // Fit bounds to show all markers
    if (destinations.some((d) => d.coordinates)) {
      const bounds = new maplibregl.LngLatBounds()
      destinations.forEach((dest) => {
        if (dest.coordinates) {
          bounds.extend(dest.coordinates)
        }
      })

      map.current!.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 400, right: 50 },
        maxZoom: 14,
        duration: 1000,
      })
    }
  }, [destinations, mapLoaded])

  // Update isochrones
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const source = map.current.getSource('isochrones') as maplibregl.GeoJSONSource
    if (!source) return

    // Create circle features for each destination
    const features: GeoJSON.Feature[] = []
    const circles: Array<{ center: [number, number]; radius: number }> = []

    destinations.forEach((dest) => {
      if (!dest.coordinates) return

      const mode = dest.modes[0] || 'both'
      const radius = calculateRadius(dest.maxMinutes, mode)

      const circle = createCircle(dest.coordinates, radius, {
        id: dest.id,
        label: dest.label,
        minutes: dest.maxMinutes,
        mode,
        fillColor: getModeColor(mode, 0.3),
        strokeColor: getModeBorderColor(mode),
      })

      features.push(circle)
      circles.push({ center: dest.coordinates, radius })
    })

    // Update isochrones source data
    source.setData({
      type: 'FeatureCollection',
      features,
    })

    // Calculate and update intersection area
    const intersectionSource = map.current.getSource('intersection') as maplibregl.GeoJSONSource
    if (intersectionSource && circles.length > 1) {
      // Calculate intersection polygon
      const intersectionPolygon = approximateIntersectionPolygon(circles, 40)

      if (intersectionPolygon) {
        intersectionSource.setData({
          type: 'FeatureCollection',
          features: [intersectionPolygon],
        })
      } else {
        // No intersection - clear the layer
        intersectionSource.setData({
          type: 'FeatureCollection',
          features: [],
        })
      }
    } else {
      // Less than 2 destinations - clear intersection layer
      if (intersectionSource) {
        intersectionSource.setData({
          type: 'FeatureCollection',
          features: [],
        })
      }
    }
  }, [destinations, mapLoaded])

  // Fetch and display properties
  useEffect(() => {
    if (!map.current || !mapLoaded || !showProperties) return

    const fetchProperties = async () => {
      setPropertiesLoading(true)

      try {
        // Get current map bounds
        const bounds = map.current!.getBounds()

        // Build query params with bounds and filters
        const params = new URLSearchParams({
          minLat: bounds.getSouth().toString(),
          maxLat: bounds.getNorth().toString(),
          minLng: bounds.getWest().toString(),
          maxLng: bounds.getEast().toString(),
          limit: '500',
        })

        // Add property filters
        if (propertyFilters.minPrice) params.set('minPrice', propertyFilters.minPrice.toString())
        if (propertyFilters.maxPrice) params.set('maxPrice', propertyFilters.maxPrice.toString())
        if (propertyFilters.propertyTypes && propertyFilters.propertyTypes.length > 0) {
          params.set('types', propertyFilters.propertyTypes.join(','))
        }
        if (propertyFilters.minRooms) params.set('minRooms', propertyFilters.minRooms.toString())
        if (propertyFilters.maxRooms) params.set('maxRooms', propertyFilters.maxRooms.toString())
        if (propertyFilters.minArea) params.set('minArea', propertyFilters.minArea.toString())
        if (propertyFilters.maxArea) params.set('maxArea', propertyFilters.maxArea.toString())

        const response = await fetch(`/api/properties?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setProperties(data.properties)

          // Convert properties to GeoJSON features
          const features = data.properties.map((property: Property) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [property.coordinates.lng, property.coordinates.lat],
            },
            properties: {
              property: JSON.stringify(property),
              price: property.valuation.woz_value,
              type: property.property.type,
            },
          }))

          // Update property source
          const source = map.current!.getSource('properties') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features,
            })
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error)
      } finally {
        setPropertiesLoading(false)
      }
    }

    // Fetch properties on load and on map move
    fetchProperties()

    const handleMoveEnd = () => {
      fetchProperties()
    }

    map.current!.on('moveend', handleMoveEnd)

    return () => {
      map.current?.off('moveend', handleMoveEnd)
    }
  }, [mapLoaded, showProperties, propertyFilters])

  // Fetch and display schools
  useEffect(() => {
    if (!map.current || !mapLoaded || !showSchools) return

    const fetchSchools = async () => {
      setSchoolsLoading(true)

      try {
        // Get current map bounds
        const bounds = map.current!.getBounds()

        const params = new URLSearchParams({
          minLat: bounds.getSouth().toString(),
          maxLat: bounds.getNorth().toString(),
          minLng: bounds.getWest().toString(),
          maxLng: bounds.getEast().toString(),
          limit: '200',
        })

        const response = await fetch(`/api/schools?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setSchools(data.schools)

          // Convert schools to GeoJSON features
          const features = data.schools.map((school: School) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [school.coordinates.lng, school.coordinates.lat],
            },
            properties: {
              school: JSON.stringify(school),
              type: school.type,
              name: school.name,
            },
          }))

          // Update schools source
          const source = map.current!.getSource('schools') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features,
            })
          }
        }
      } catch (error) {
        console.error('Error fetching schools:', error)
      } finally {
        setSchoolsLoading(false)
      }
    }

    // Fetch schools on load and on map move
    fetchSchools()

    const handleMoveEnd = () => {
      fetchSchools()
    }

    map.current!.on('moveend', handleMoveEnd)

    return () => {
      map.current?.off('moveend', handleMoveEnd)
    }
  }, [mapLoaded, showSchools])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="map-container" />

      {/* Map Overlay Info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-2">🗺️ Interactive Map</h3>
        <p className="text-sm text-gray-600">
          {mapLoaded ? (
            <>
              Map powered by <strong>PDOK</strong> (free Dutch government tiles).
              Add destinations in the sidebar to see reachable areas.
            </>
          ) : (
            'Loading map...'
          )}
        </p>
        {destinations.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {destinations.filter(d => d.coordinates).length} of {destinations.length} destinations on map
          </div>
        )}
      </div>

      {/* Legend */}
      {mapLoaded && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4">
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Legend</h4>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
              <span>Destinations</span>
            </div>
            {showProperties && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white"></div>
                <span>🏠 Properties ({properties.length})</span>
              </div>
            )}
            {showSchools && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white"></div>
                  <span className="text-xs">🎒 Basisscholen ({schools.filter(s => s.type === 'primary').length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white"></div>
                  <span className="text-xs">🎓 Middelbare scholen ({schools.filter(s => s.type === 'secondary').length})</span>
                </div>
              </>
            )}
            {destinations.filter(d => d.coordinates).length > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.4)', border: '2px solid rgb(5, 150, 105)' }}></div>
                <span className="font-semibold">✓ Overlap Area</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.3)', border: '1px solid rgb(34, 197, 94)' }}></div>
              <span>🚴 Bike reachable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)', border: '1px solid rgb(59, 130, 246)' }}></div>
              <span>🚊 Transit reachable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(168, 85, 247, 0.3)', border: '1px solid rgb(168, 85, 247)' }}></div>
              <span>🚴+🚊 Combined</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
            {propertiesLoading && 'Loading properties...'}
            {!propertiesLoading && 'Approximate reachable areas'}
          </div>
        </div>
      )}
    </div>
  )
}
