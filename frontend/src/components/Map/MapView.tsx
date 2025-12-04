'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination } from '@/types/destination'
import type { Property, PropertyFilters } from '@/types/property'
import type { School } from '@/types/school'
import { formatPrice, formatAddress, getPropertyTypeLabel } from '@/types/property'
import { getSchoolTypeLabel, getSchoolIcon } from '@/types/school'
import { createCircle, calculateRadius, getModeColor, getModeBorderColor} from '@/lib/isochrones'
import { approximateIntersectionPolygon } from '@/lib/intersections'

interface MapViewProps {
  destinations: Destination[]
  showProperties?: boolean
  showSchools?: boolean
  propertyFilters?: PropertyFilters
  amenities?: {
    supermarkets: { count: number; nearest?: any; items: any[] }
    healthcare: { count: number; nearest?: any; items: any[] }
    playgrounds: { count: number; nearest?: any; items: any[] }
    parks: { count: number; nearest?: any; items: any[] }
  }
  areaCode?: string  // Neighborhood code for boundary highlighting
}

export default function MapView({ destinations, showProperties = true, showSchools = true, propertyFilters = {}, amenities, areaCode }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(false)
  const [showCrimeOverlay, setShowCrimeOverlay] = useState(false)
  const [showAirQualityOverlay, setShowAirQualityOverlay] = useState(false)
  const [showFoundationRiskOverlay, setShowFoundationRiskOverlay] = useState(false)
  const [showLeefbaarometer, setShowLeefbaarometer] = useState(false)
  const [airQualityPollutant, setAirQualityPollutant] = useState<'NO2' | 'PM10' | 'PM25'>('NO2')
  const [crimeData, setCrimeData] = useState<any[]>([])
  const [airQualityData, setAirQualityData] = useState<any[]>([])
  const [foundationRiskData, setFoundationRiskData] = useState<any>(null)

  // Amenity layer toggles - enabled by default for direct visibility
  const [showHealthcare, setShowHealthcare] = useState(true)
  const [showSupermarkets, setShowSupermarkets] = useState(true)
  const [showPlaygrounds, setShowPlaygrounds] = useState(true)
  const [showTrainStations, setShowTrainStations] = useState(true)
  const [healthcareData, setHealthcareData] = useState<any[]>([])
  const [supermarketsData, setSupermarketsData] = useState<any[]>([])
  const [playgroundsData, setPlaygroundsData] = useState<any[]>([])
  const [trainStationsData, setTrainStationsData] = useState<any[]>([])
  const [amenitiesLoading, setAmenitiesLoading] = useState(false)
  const [mapBoundsVersion, setMapBoundsVersion] = useState(0) // Trigger refetch on map move

  // Backend URL from environment or default
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Netherlands bounding box to limit North Sea view
    // Expanded slightly to give more room for panning
    const netherlandsBounds: maplibregl.LngLatBoundsLike = [
      [2.5, 50.5],   // Southwest coordinates [lng, lat] - more room
      [7.5, 53.8]    // Northeast coordinates [lng, lat] - more room
    ]

    // Initialize map with PDOK tiles
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        name: 'PDOK Achtergrondkaart',
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', // Add glyphs for text labels
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
      maxBounds: netherlandsBounds, // Restrict panning to Netherlands bounds
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

    // Add error handling for map and tiles
    map.current.on('error', (e) => {
      console.error('❌ Map error:', e)
    })

    map.current.on('load', () => {
      setMapLoaded(true)
      console.log('✅ Map loaded successfully with PDOK tiles')

      // Refetch data when map stops moving (debounced)
      let moveTimeout: NodeJS.Timeout | null = null
      map.current!.on('moveend', () => {
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
          setMapBoundsVersion(v => v + 1)
        }, 300) // Debounce 300ms
      })

      // Add tile loading error handler
      map.current!.on('sourcedataloading', (e) => {
        if (e.sourceId && e.sourceId.includes('wms')) {
          console.log(`🌐 Loading WMS tiles for: ${e.sourceId}`)
        }
      })

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
        filter: ['all', ['has', 'point_count'], ['>', ['get', 'point_count'], 1]], // Only show clusters with 2+ properties
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
          'circle-color': [
            'match',
            ['get', 'energy_label'],
            'A+++++', '#059669',
            'A++++', '#059669',
            'A+++', '#10b981',
            'A++', '#22c55e',
            'A+', '#22c55e',
            'A', '#84cc16',
            'B', '#a3e635',
            'C', '#facc15',
            'D', '#fb923c',
            'E', '#f87171',
            'F', '#ef4444',
            'G', '#dc2626',
            '#9ca3af' // Default gray for no label
          ],
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

      // Add layer for primary schools - Backpack emoji
      map.current!.addLayer({
        id: 'primary-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'primary'],
        layout: {
          'text-field': '🎒',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Add layer for secondary schools - Graduation cap emoji
      map.current!.addLayer({
        id: 'secondary-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'secondary'],
        layout: {
          'text-field': '🎓',
          'text-size': 22,
          'text-allow-overlap': true,
        },
      })

      // Add layer for special education schools - School building emoji
      map.current!.addLayer({
        id: 'special-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'special'],
        layout: {
          'text-field': '🏫',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Add layer for higher education - University emoji
      map.current!.addLayer({
        id: 'higher-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'higher'],
        layout: {
          'text-field': '🏛️',
          'text-size': 24,
          'text-allow-overlap': true,
        },
      })

      // Add click handler for schools
      const handleSchoolClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const props = feature.properties

        if (!props) return

        // Get school icon based on type
        const getIcon = (type: string) => {
          if (type === 'primary') return '🎒'
          if (type === 'secondary') return '🎓'
          if (type === 'special') return '🏫'
          if (type === 'higher') return '🎓'
          return '📚'
        }

        const coordinates = (feature.geometry as any).coordinates
        const popup = new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 220px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${getIcon(props.type)} ${props.name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                ${props.typeLabel}
              </div>
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">
                ${props.address}<br/>
                ${props.postalCode} ${props.city}
              </div>
              <div style="font-size: 11px; color: #999;">
                ${props.denomination}
              </div>
              ${props.phone ? `<div style="font-size: 11px; color: #555; margin-top: 6px;">
                📞 ${props.phone}
              </div>` : ''}
              ${props.website ? `<div style="font-size: 11px; margin-top: 4px;">
                <a href="https://${props.website}" target="_blank" style="color: #3b82f6; text-decoration: underline;">
                  Website →
                </a>
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      }

      map.current!.on('click', 'primary-schools', handleSchoolClick)
      map.current!.on('click', 'secondary-schools', handleSchoolClick)
      map.current!.on('click', 'special-schools', handleSchoolClick)
      map.current!.on('click', 'higher-schools', handleSchoolClick)

      // Change cursor on hover for all school types
      const schoolLayers = ['primary-schools', 'secondary-schools', 'special-schools', 'higher-schools']
      schoolLayers.forEach(layer => {
        map.current!.on('mouseenter', layer, () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current!.on('mouseleave', layer, () => {
          map.current!.getCanvas().style.cursor = ''
        })
      })

      // Add source for healthcare facilities
      map.current!.addSource('healthcare', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for doctors/huisarts - Doctor emoji
      map.current!.addLayer({
        id: 'healthcare-doctors',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'doctors'],
        layout: {
          'text-field': '👨‍⚕️',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Add layer for pharmacies/apotheek - Pill emoji
      map.current!.addLayer({
        id: 'healthcare-pharmacy',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'pharmacy'],
        layout: {
          'text-field': '💊',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Add layer for hospitals - Hospital emoji
      map.current!.addLayer({
        id: 'healthcare-hospital',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'hospital'],
        layout: {
          'text-field': '🏥',
          'text-size': 24,
          'text-allow-overlap': true,
        },
      })

      // Add layer for clinics - Clinic emoji
      map.current!.addLayer({
        id: 'healthcare-clinic',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'clinic'],
        layout: {
          'text-field': '🩺',
          'text-size': 18,
          'text-allow-overlap': true,
        },
      })

      // Healthcare click handler
      const handleHealthcareClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        const getIcon = (type: string) => {
          if (type === 'doctors') return '👨‍⚕️'
          if (type === 'pharmacy') return '💊'
          if (type === 'hospital') return '🏥'
          if (type === 'clinic') return '🏨'
          return '🏥'
        }

        const coordinates = (feature.geometry as any).coordinates
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${getIcon(props.type)} ${props.name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                ${props.typeLabel}
              </div>
              ${props.address ? `<div style="font-size: 11px; color: #999; margin-bottom: 4px;">
                ${props.address}<br/>
                ${props.postalCode || ''} ${props.city || ''}
              </div>` : ''}
              ${props.phone ? `<div style="font-size: 11px; color: #555; margin-top: 6px;">
                📞 ${props.phone}
              </div>` : ''}
              ${props.website ? `<div style="font-size: 11px; margin-top: 4px;">
                <a href="${props.website.startsWith('http') ? props.website : 'https://' + props.website}" target="_blank" style="color: #3b82f6; text-decoration: underline;">
                  website →
                </a>
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      }

      const healthcareLayers = ['healthcare-doctors', 'healthcare-pharmacy', 'healthcare-hospital', 'healthcare-clinic']
      healthcareLayers.forEach(layer => {
        map.current!.on('click', layer, handleHealthcareClick)
        map.current!.on('mouseenter', layer, () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current!.on('mouseleave', layer, () => {
          map.current!.getCanvas().style.cursor = ''
        })
      })

      // Add source for supermarkets
      map.current!.addSource('supermarkets', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for supermarkets - Shopping cart emoji
      map.current!.addLayer({
        id: 'supermarkets-layer',
        type: 'symbol',
        source: 'supermarkets',
        layout: {
          'text-field': '🛒',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Supermarket click handler
      map.current!.on('click', 'supermarkets-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        const coordinates = (feature.geometry as any).coordinates
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                🏪 ${props.name}
              </div>
              ${props.brand ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                ${props.brand}
              </div>` : ''}
              ${props.address ? `<div style="font-size: 11px; color: #999; margin-bottom: 4px;">
                ${props.address}<br/>
                ${props.postalCode || ''} ${props.city || ''}
              </div>` : ''}
              ${props.openingHours ? `<div style="font-size: 11px; color: #555; margin-top: 6px;">
                🕒 ${props.openingHours}
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'supermarkets-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'supermarkets-layer', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Add source for playgrounds
      map.current!.addSource('playgrounds', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for playgrounds - Playground emoji
      map.current!.addLayer({
        id: 'playgrounds-layer',
        type: 'symbol',
        source: 'playgrounds',
        layout: {
          'text-field': '🛝',
          'text-size': 20,
          'text-allow-overlap': true,
        },
      })

      // Add source for train stations
      map.current!.addSource('train-stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layer for train stations - Train emoji
      map.current!.addLayer({
        id: 'train-stations-layer',
        type: 'symbol',
        source: 'train-stations',
        layout: {
          'text-field': '🚉',
          'text-size': 24,
          'text-allow-overlap': true,
        },
      })

      // Train station click handler
      map.current!.on('click', 'train-stations-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        const coordinates = (feature.geometry as any).coordinates
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                🚉 ${props.name}
              </div>
              ${props.operator ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                ${props.operator}
              </div>` : ''}
              ${props.station_code ? `<div style="font-size: 11px; color: #999;">
                Station code: ${props.station_code}
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'train-stations-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'train-stations-layer', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Playground click handler
      map.current!.on('click', 'playgrounds-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        const coordinates = (feature.geometry as any).coordinates
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 150px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                🎠 ${props.name || 'speeltuin'}
              </div>
              ${props.city ? `<div style="font-size: 11px; color: #999;">
                ${props.city}
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'playgrounds-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'playgrounds-layer', () => {
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
      }
      // Don't update position if marker already exists - keep it static

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
  // DISABLED: Properties API not yet implemented
  useEffect(() => {
    if (!map.current || !mapLoaded || !showProperties) return

    // Properties API will be implemented later with WOZ Parquet data
    // For now, just clear the properties source
    const source = map.current.getSource('properties') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      })
    }

    setPropertiesLoading(false)
  }, [mapLoaded, showProperties, propertyFilters])

  // Fetch and display schools from API
  useEffect(() => {
    if (!map.current || !mapLoaded || !showSchools) return

    console.log('🏫 Fetching schools from API...')
    setSchoolsLoading(true)

    // Get current map bounds
    const bounds = map.current.getBounds()
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '500'
    })

    fetch(`/api/schools?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`✅ Loaded ${data.count} schools`)

          // Convert schools to GeoJSON features
          const features = data.schools.map((school: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [school.coordinates.lng, school.coordinates.lat]
            },
            properties: {
              id: school.id,
              name: school.name,
              type: school.type,
              typeLabel: school.typeLabel,
              address: school.address,
              postalCode: school.postalCode,
              city: school.city,
              municipality: school.municipality,
              denomination: school.denomination || 'N/A',
              phone: school.phone,
              website: school.website
            }
          }))

          // Update schools source
          const source = map.current?.getSource('schools') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features
            })
          }
        } else {
          console.error('❌ Failed to load schools:', data)
        }
      })
      .catch(err => {
        console.error('❌ Error fetching schools:', err)
      })
      .finally(() => {
        setSchoolsLoading(false)
      })
  }, [mapLoaded, showSchools, mapBoundsVersion])

  // Fetch and display healthcare facilities
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (!showHealthcare) {
      // Clear healthcare data when toggle is off
      const source = map.current.getSource('healthcare') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
      return
    }

    console.log('🏥 Fetching healthcare from API...')
    setAmenitiesLoading(true)

    const bounds = map.current.getBounds()
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '1000'
    })

    fetch(`${BACKEND_URL}/api/healthcare?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`✅ Loaded ${data.count} healthcare facilities`)
          setHealthcareData(data.facilities)

          const features = data.facilities.map((facility: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [facility.coordinates.lng, facility.coordinates.lat]
            },
            properties: {
              id: facility.id,
              name: facility.name,
              type: facility.type,
              typeLabel: facility.typeLabel,
              address: facility.address,
              postalCode: facility.postalCode,
              city: facility.city,
              phone: facility.phone,
              website: facility.website,
            }
          }))

          const source = map.current?.getSource('healthcare') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({ type: 'FeatureCollection', features })
          }
        }
      })
      .catch(err => console.error('❌ Error fetching healthcare:', err))
      .finally(() => setAmenitiesLoading(false))
  }, [mapLoaded, showHealthcare, BACKEND_URL, mapBoundsVersion])

  // Fetch and display supermarkets
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (!showSupermarkets) {
      const source = map.current.getSource('supermarkets') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
      return
    }

    console.log('🏪 Fetching supermarkets from API...')
    setAmenitiesLoading(true)

    const bounds = map.current.getBounds()
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '1000'
    })

    fetch(`${BACKEND_URL}/api/supermarkets?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`✅ Loaded ${data.count} supermarkets`)
          setSupermarketsData(data.supermarkets)

          const features = data.supermarkets.map((s: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [s.coordinates.lng, s.coordinates.lat]
            },
            properties: {
              id: s.id,
              name: s.name,
              brand: s.brand,
              address: s.address,
              postalCode: s.postalCode,
              city: s.city,
              openingHours: s.openingHours,
            }
          }))

          const source = map.current?.getSource('supermarkets') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({ type: 'FeatureCollection', features })
          }
        }
      })
      .catch(err => console.error('❌ Error fetching supermarkets:', err))
      .finally(() => setAmenitiesLoading(false))
  }, [mapLoaded, showSupermarkets, BACKEND_URL, mapBoundsVersion])

  // Fetch and display playgrounds
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (!showPlaygrounds) {
      const source = map.current.getSource('playgrounds') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
      return
    }

    console.log('🎠 Fetching playgrounds from API...')
    setAmenitiesLoading(true)

    const bounds = map.current.getBounds()
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '1000'
    })

    fetch(`${BACKEND_URL}/api/playgrounds?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`✅ Loaded ${data.count} playgrounds`)
          setPlaygroundsData(data.playgrounds)

          const features = data.playgrounds.map((p: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [p.coordinates.lng, p.coordinates.lat]
            },
            properties: {
              id: p.id,
              name: p.name,
              address: p.address,
              city: p.city,
            }
          }))

          const source = map.current?.getSource('playgrounds') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({ type: 'FeatureCollection', features })
          }
        }
      })
      .catch(err => console.error('❌ Error fetching playgrounds:', err))
      .finally(() => setAmenitiesLoading(false))
  }, [mapLoaded, showPlaygrounds, BACKEND_URL, mapBoundsVersion])

  // Fetch and display train stations
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (!showTrainStations) {
      const source = map.current.getSource('train-stations') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
      return
    }

    console.log('🚉 Fetching train stations from API...')

    const bounds = map.current.getBounds()
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '500'
    })

    fetch(`${BACKEND_URL}/api/train-stations?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`✅ Loaded ${data.count} train stations`)
          setTrainStationsData(data.stations)

          const features = data.stations.map((s: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [s.coordinates.lng, s.coordinates.lat]
            },
            properties: {
              name: s.name,
              operator: s.operator,
              station_code: s.station_code,
              railway_type: s.railway_type,
            }
          }))

          const source = map.current?.getSource('train-stations') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({ type: 'FeatureCollection', features })
          }
        }
      })
      .catch(err => console.error('❌ Error fetching train stations:', err))
  }, [mapLoaded, showTrainStations, BACKEND_URL, mapBoundsVersion])

  // Display amenities on the map
  useEffect(() => {
    if (!map.current || !mapLoaded || !amenities) {
      console.log('⏭️ Skipping amenities render:', { mapLoaded, hasAmenities: !!amenities })
      return
    }

    console.log('🗺️ Rendering amenities on map:', amenities)

    // Add amenities source if it doesn't exist
    if (!map.current.getSource('amenities')) {
      map.current.addSource('amenities', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add layers for different amenity types using emojis
      // Supermarkets - 🏪
      map.current.addLayer({
        id: 'amenities-supermarkets',
        type: 'symbol',
        source: 'amenities',
        filter: ['==', 'type', 'supermarket'],
        layout: {
          'text-field': '🏪',
          'text-size': 28,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-opacity': 1.0,
        }
      })

      // Healthcare - 🏥
      map.current.addLayer({
        id: 'amenities-healthcare',
        type: 'symbol',
        source: 'amenities',
        filter: ['==', 'type', 'healthcare'],
        layout: {
          'text-field': '🏥',
          'text-size': 28,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-opacity': 1.0,
        }
      })

      // Playgrounds - 🎮
      map.current.addLayer({
        id: 'amenities-playgrounds',
        type: 'symbol',
        source: 'amenities',
        filter: ['==', 'type', 'playground'],
        layout: {
          'text-field': '🎮',
          'text-size': 28,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-opacity': 1.0,
        }
      })

      // Parks - 🌳
      map.current.addLayer({
        id: 'amenities-parks',
        type: 'symbol',
        source: 'amenities',
        filter: ['==', 'type', 'park'],
        layout: {
          'text-field': '🌳',
          'text-size': 28,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-opacity': 1.0,
        }
      })

      // Add click handlers
      const amenityLayers = ['amenities-supermarkets', 'amenities-healthcare', 'amenities-playgrounds', 'amenities-parks']

      amenityLayers.forEach(layer => {
        map.current!.on('click', layer, (e) => {
          if (!e.features || e.features.length === 0) return
          const feature = e.features[0]
          const props = feature.properties

          if (!props) return

          const popup = new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding: 12px; min-width: 180px;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                  ${props.name || 'Unknown'}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  ${props.type}
                </div>
                <div style="font-size: 11px; color: #999;">
                  ${props.distanceMeters}m away
                </div>
              </div>`
            )
            .addTo(map.current!)
        })

        map.current!.on('mouseenter', layer, () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })

        map.current!.on('mouseleave', layer, () => {
          map.current!.getCanvas().style.cursor = ''
        })
      })
    }

    // Update amenities data
    const features: GeoJSON.Feature[] = []

    if (amenities.supermarkets?.items) {
      amenities.supermarkets.items.forEach(item => {
        if (item.lat && item.lng) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [item.lng, item.lat],
            },
            properties: {
              type: 'supermarket',
              name: item.name || 'Supermarket',
              distanceMeters: item.distanceMeters,
            },
          })
        }
      })
    }

    if (amenities.healthcare?.items) {
      amenities.healthcare.items.forEach(item => {
        if (item.lat && item.lng) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [item.lng, item.lat],
            },
            properties: {
              type: 'healthcare',
              name: item.name || 'Healthcare',
              distanceMeters: item.distanceMeters,
            },
          })
        }
      })
    }

    if (amenities.playgrounds?.items) {
      amenities.playgrounds.items.forEach(item => {
        if (item.lat && item.lng) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [item.lng, item.lat],
            },
            properties: {
              type: 'playground',
              name: item.name || 'Playground',
              distanceMeters: item.distanceMeters,
            },
          })
        }
      })
    }

    if (amenities.parks?.items) {
      amenities.parks.items.forEach(item => {
        if (item.lat && item.lng) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [item.lng, item.lat],
            },
            properties: {
              type: 'park',
              name: item.name || 'Park',
              distanceMeters: item.distanceMeters,
            },
          })
        }
      })
    }

    const source = map.current.getSource('amenities') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      })
    }
  }, [mapLoaded, amenities])

  // Load crime overlay data
  useEffect(() => {
    if (!showCrimeOverlay) return

    console.log('🔍 Fetching crime overlay data...')
    fetch(`${BACKEND_URL}/api/map-overlays/crime`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Crime data loaded:', data.data.length, 'neighborhoods')
          setCrimeData(data.data)
        } else {
          console.error('❌ Crime data fetch failed:', data)
        }
      })
      .catch(err => console.error('❌ Error loading crime data:', err))
  }, [showCrimeOverlay])

  // Add crime overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showCrimeOverlay && crimeData.length > 0) {
      console.log('🗺️ Adding crime overlay to map with', crimeData.length, 'data points')

      // Add source and layers if they don't exist
      if (!map.current.getSource('crime-overlay')) {
        // Add GeoJSON source
        map.current.addSource('crime-overlay', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: crimeData.map(item => ({
              type: 'Feature',
              properties: {
                area_code: item.area_code,
                area_name: item.area_name,
                crime_rate: item.crime_rate_per_1000,
                total_crimes: item.total_crimes,
                population: item.population,
              },
              geometry: {
                type: 'Point',
                coordinates: [item.lng, item.lat]
              }
            }))
          }
        })

        // Add circle layer (don't use insertBefore as target layer may not exist)
        map.current.addLayer({
          id: 'crime-circles',
          type: 'circle',
          source: 'crime-overlay',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 8, 16, 15],
            'circle-color': ['interpolate', ['linear'], ['get', 'crime_rate'], 0, '#dbeafe', 50, '#93c5fd', 100, '#3b82f6', 200, '#1e40af'],
            'circle-opacity': 0.6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          }
        })

        // Add text labels
        map.current.addLayer({
          id: 'crime-labels',
          type: 'symbol',
          source: 'crime-overlay',
          layout: {
            'text-field': ['get', 'area_name'],
            'text-font': ['Open Sans Regular'],
            'text-size': 10,
            'text-offset': [0, 2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1e3a8a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
          }
        })

        // Add event handlers
        const crimeClickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${props.area_name}</div>
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Crime Rate: <strong>${props.crime_rate.toFixed(1)}</strong> per 1,000 residents</div>
              <div style="font-size: 12px; color: #999;">${props.total_crimes} crimes | Pop: ${props.population.toLocaleString()}</div>
            </div>`)
            .addTo(map.current!)
        }

        map.current.on('click', 'crime-circles', crimeClickHandler)
        map.current.on('mouseenter', 'crime-circles', () => { map.current!.getCanvas().style.cursor = 'pointer' })
        map.current.on('mouseleave', 'crime-circles', () => { map.current!.getCanvas().style.cursor = '' })
      }
    } else {
      // Remove layers when overlay is turned off
      if (map.current.getLayer('crime-circles')) {
        console.log('🗺️ Removing crime overlay from map')
        map.current.removeLayer('crime-circles')
        map.current.removeLayer('crime-labels')
        map.current.removeSource('crime-overlay')
      }
    }
  }, [mapLoaded, showCrimeOverlay, crimeData])

  // Add RIVM air quality WMS overlay
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'rivm-air-quality-wms'
    const layerId = 'rivm-air-quality-layer'

    if (showAirQualityOverlay) {
      console.log(`🗺️ Adding RIVM air quality WMS layer (${airQualityPollutant})`)

      // Layer mapping for RIVM WMS
      const layerMap = {
        'NO2': 'lucht:actueel_no2',
        'PM10': 'lucht:actueel_pm10',
        'PM25': 'lucht:actueel_pm25'
      }

      const wmsLayer = layerMap[airQualityPollutant]

      // Remove existing layer if pollutant changed
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }

      // Add new source - using proxy to avoid CORS issues
      const wmsUrl = `https://geodata.rivm.nl/geoserver/wms`
      map.current.addSource(sourceId, {
        type: 'raster',
        tiles: [
          `${BACKEND_URL}/api/wms-proxy?url=${encodeURIComponent(wmsUrl)}&service=WMS&version=1.1.1&request=GetMap&layers=${wmsLayer}&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true`
        ],
        tileSize: 256
      })

      // Add layer with proper z-index positioning
      map.current.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.6
        }
      }, 'isochrone-fills')  // Insert before isochrone layers to ensure visibility
    } else {
      // Remove layer and source when toggled off
      if (map.current.getLayer(layerId)) {
        console.log('🗺️ Removing RIVM air quality WMS layer')
        map.current.removeLayer(layerId)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }
    }
  }, [mapLoaded, showAirQualityOverlay, airQualityPollutant])

  // Load foundation risk overlay data
  useEffect(() => {
    if (!showFoundationRiskOverlay) return

    console.log('🔍 Fetching foundation risk overlay data...')
    fetch(`${BACKEND_URL}/api/map-overlays/foundation-risk`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Foundation risk data loaded:', data.data.features?.length, 'areas')
          setFoundationRiskData(data.data)
        } else {
          console.error('❌ Foundation risk data fetch failed:', data)
        }
      })
      .catch(err => console.error('❌ Error loading foundation risk data:', err))
  }, [showFoundationRiskOverlay])

  // Add foundation risk overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showFoundationRiskOverlay && foundationRiskData) {
      console.log('🗺️ Adding foundation risk overlay to map')

      // Add source and layers if they don't exist
      if (!map.current.getSource('foundation-risk-overlay')) {
        // Add GeoJSON source
        map.current.addSource('foundation-risk-overlay', {
          type: 'geojson',
          data: foundationRiskData
        })

        // Add fill layer
        map.current.addLayer({
          id: 'foundation-risk-fill',
          type: 'fill',
          source: 'foundation-risk-overlay',
          paint: {
            'fill-color': '#f97316',
            'fill-opacity': 0.4
          }
        })

        // Add outline layer
        map.current.addLayer({
          id: 'foundation-risk-outline',
          type: 'line',
          source: 'foundation-risk-overlay',
          paint: {
            'line-color': '#ea580c',
            'line-width': 2,
            'line-opacity': 0.8
          }
        })

        // Add event handlers
        const foundationClickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 220px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #ea580c;">Foundation Risk Area</div>
              <div style="font-size: 12px; color: #666;">This area has been identified as having potential foundation problems (funderingsproblematiek).</div>
              <div style="font-size: 11px; margin-top: 8px; color: #999;">Source: KCAF via PDOK</div>
            </div>`)
            .addTo(map.current!)
        }

        map.current.on('click', 'foundation-risk-fill', foundationClickHandler)
        map.current.on('mouseenter', 'foundation-risk-fill', () => { map.current!.getCanvas().style.cursor = 'pointer' })
        map.current.on('mouseleave', 'foundation-risk-fill', () => { map.current!.getCanvas().style.cursor = '' })
      }
    } else {
      // Remove layers when overlay is turned off
      if (map.current.getLayer('foundation-risk-fill')) {
        console.log('🗺️ Removing foundation risk overlay from map')
        map.current.removeLayer('foundation-risk-fill')
        map.current.removeLayer('foundation-risk-outline')
        map.current.removeSource('foundation-risk-overlay')
      }
    }
  }, [mapLoaded, showFoundationRiskOverlay, foundationRiskData])

  // Load Leefbaarometer data from API
  const [leefbaarometerData, setLeefbaarometerData] = useState<any>(null)

  useEffect(() => {
    if (!showLeefbaarometer) return

    console.log('🔍 Fetching Leefbaarometer overlay data...')
    fetch(`${BACKEND_URL}/api/map-overlays/leefbaarometer`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Leefbaarometer data loaded:', data.features?.length, 'neighborhoods')
          setLeefbaarometerData({
            type: 'FeatureCollection',
            features: data.features
          })
        } else {
          console.error('❌ Leefbaarometer data fetch failed:', data)
        }
      })
      .catch(err => console.error('❌ Error loading Leefbaarometer data:', err))
  }, [showLeefbaarometer])

  // Add Leefbaarometer vector overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showLeefbaarometer && leefbaarometerData) {
      console.log('🗺️ Adding Leefbaarometer vector overlay to map')

      // Add source and layers if they don't exist
      if (!map.current.getSource('leefbaarometer-overlay')) {
        // Add GeoJSON source
        map.current.addSource('leefbaarometer-overlay', {
          type: 'geojson',
          data: leefbaarometerData
        })

        // Add fill layer with color based on score
        map.current.addLayer({
          id: 'leefbaarometer-fill',
          type: 'fill',
          source: 'leefbaarometer-overlay',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'score_total'],
              1, '#ef4444',  // Red for low scores
              3, '#f97316',  // Orange
              5, '#eab308',  // Yellow
              7, '#84cc16',  // Lime
              9, '#22c55e'   // Green for high scores
            ],
            'fill-opacity': 0.5
          }
        })

        // Add outline layer
        map.current.addLayer({
          id: 'leefbaarometer-outline',
          type: 'line',
          source: 'leefbaarometer-overlay',
          paint: {
            'line-color': '#64748b',
            'line-width': 1,
            'line-opacity': 0.3
          }
        })

        // Add click handler
        const leefbaarometerClickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return

          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 260px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #1e293b;">${props.buurtnaam}</div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">${props.gemeentenaam}</div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #0f172a;">
                Overall Score: ${props.score_total || 'N/A'} / 10
              </div>
              <div style="font-size: 11px; color: #475569;">
                ${props.score_physical ? `🌳 Physical: ${props.score_physical}/10<br/>` : ''}
                ${props.score_social ? `👥 Social: ${props.score_social}/10<br/>` : ''}
                ${props.score_safety ? `🛡️ Safety: ${props.score_safety}/10<br/>` : ''}
                ${props.score_facilities ? `🏪 Facilities: ${props.score_facilities}/10<br/>` : ''}
                ${props.score_housing ? `🏠 Housing: ${props.score_housing}/10` : ''}
              </div>
              <div style="font-size: 10px; margin-top: 8px; color: #94a3b8;">Source: Leefbaarometer 2024</div>
            </div>`)
            .addTo(map.current!)
        }

        map.current.on('click', 'leefbaarometer-fill', leefbaarometerClickHandler)
        map.current.on('mouseenter', 'leefbaarometer-fill', () => { map.current!.getCanvas().style.cursor = 'pointer' })
        map.current.on('mouseleave', 'leefbaarometer-fill', () => { map.current!.getCanvas().style.cursor = '' })
      }
    } else {
      // Remove layers when overlay is turned off
      if (map.current.getLayer('leefbaarometer-fill')) {
        console.log('🗺️ Removing Leefbaarometer overlay from map')
        map.current.removeLayer('leefbaarometer-fill')
        map.current.removeLayer('leefbaarometer-outline')
        map.current.removeSource('leefbaarometer-overlay')
      }
    }
  }, [mapLoaded, showLeefbaarometer, leefbaarometerData])

  // Add neighborhood boundary highlighting
  useEffect(() => {
    if (!map.current || !mapLoaded || !areaCode) return

    // Fetch neighborhood boundary from backend
    fetch(`${BACKEND_URL}/api/neighborhood-boundary/${areaCode}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && map.current) {
          // Remove existing boundary if present
          if (map.current.getLayer('neighborhood-boundary-fill')) {
            map.current.removeLayer('neighborhood-boundary-fill')
            map.current.removeLayer('neighborhood-boundary-outline')
            map.current.removeSource('neighborhood-boundary')
          }

          // Determine colors based on whether this is foreign territory
          const isForeign = data.is_foreign || false
          const fillColor = isForeign ? '#fb923c' : '#a855f7'  // orange for foreign, purple for Dutch
          const outlineColor = isForeign ? '#ea580c' : '#9333ea'  // darker orange/purple

          // Add neighborhood boundary source
          map.current.addSource('neighborhood-boundary', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [data.data]
            }
          })

          // Add fill layer with color based on territory
          map.current.addLayer({
            id: 'neighborhood-boundary-fill',
            type: 'fill',
            source: 'neighborhood-boundary',
            paint: {
              'fill-color': fillColor,
              'fill-opacity': 0.15
            }
          })

          // Add outline layer for better visibility
          map.current.addLayer({
            id: 'neighborhood-boundary-outline',
            type: 'line',
            source: 'neighborhood-boundary',
            paint: {
              'line-color': outlineColor,
              'line-width': 3,
              'line-opacity': 0.8
            }
          })

          // Add label for foreign territory
          if (isForeign && data.foreign_country) {
            // Calculate centroid from polygon coordinates
            const coords = data.data.geometry.type === 'Polygon'
              ? data.data.geometry.coordinates[0]
              : data.data.geometry.coordinates[0][0]

            const avgLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length
            const avgLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length

            new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: 'foreign-territory-label'
            })
              .setLngLat([avgLng, avgLat])
              .setHTML(`<div style="background: #fb923c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">🇧🇪 ${data.foreign_country}</div>`)
              .addTo(map.current)
          }
        }
      })
      .catch(err => console.error('Error loading neighborhood boundary:', err))

    // Cleanup function
    return () => {
      if (map.current && map.current.getLayer('neighborhood-boundary-fill')) {
        map.current.removeLayer('neighborhood-boundary-fill')
        map.current.removeLayer('neighborhood-boundary-outline')
        map.current.removeSource('neighborhood-boundary')
      }
    }
  }, [mapLoaded, areaCode])

  // Note: All-neighborhoods overlay disabled due to PDOK WFS not supporting MVT format
  // Individual neighborhood boundaries are shown when you search for an address

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="map-container" />

      {/* Loading Indicator */}
      {!mapLoaded && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      )}

      {/* Overlay Toggle Controls */}
      {mapLoaded && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
          <h4 className="font-semibold text-xs text-gray-700 mb-2">Map overlays</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCrimeOverlay}
                onChange={(e) => setShowCrimeOverlay(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">crime rate</span>
            </label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAirQualityOverlay}
                  onChange={(e) => setShowAirQualityOverlay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">air quality (RIVM)</span>
              </label>
              {showAirQualityOverlay && (
                <select
                  value={airQualityPollutant}
                  onChange={(e) => setAirQualityPollutant(e.target.value as 'NO2' | 'PM10' | 'PM25')}
                  className="ml-6 text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="NO2">NO₂ (Nitrogen Dioxide)</option>
                  <option value="PM10">PM10 (Particulate Matter)</option>
                  <option value="PM25">PM2.5 (Fine Particles)</option>
                </select>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFoundationRiskOverlay}
                onChange={(e) => setShowFoundationRiskOverlay(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">foundation risk</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLeefbaarometer}
                onChange={(e) => setShowLeefbaarometer(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">livability heat map</span>
            </label>

            <div className="border-t border-gray-200 mt-2 pt-2">
              <span className="text-xs font-medium text-gray-500 block mb-2">amenities</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHealthcare}
                  onChange={(e) => setShowHealthcare(e.target.checked)}
                  className="w-4 h-4 text-red-500 rounded focus:ring-2 focus:ring-red-500"
                />
                <span className="text-xs text-gray-700">👨‍⚕️💊🏥 healthcare</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={showSupermarkets}
                  onChange={(e) => setShowSupermarkets(e.target.checked)}
                  className="w-4 h-4 text-teal-500 rounded focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-gray-700">🛒 supermarkets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={showPlaygrounds}
                  onChange={(e) => setShowPlaygrounds(e.target.checked)}
                  className="w-4 h-4 text-yellow-500 rounded focus:ring-2 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-700">🛝 playgrounds (speeltuinen)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={showTrainStations}
                  onChange={(e) => setShowTrainStations(e.target.checked)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">🚉 train stations</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {mapLoaded && (
        <div className="absolute bottom-12 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h4 className="font-semibold text-sm text-gray-900 mb-3">Map legend</h4>
          <div className="space-y-1.5 text-xs text-gray-700">
            {/* Map markers legend */}
            <div className="font-medium text-gray-600 mb-2">What the emojis mean:</div>

            {/* Schools */}
            {showSchools && (
              <div className="space-y-1 pb-2 border-b border-gray-100">
                <div className="font-medium text-gray-500">Schools</div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎒</span>
                  <span>Primary school (basisschool)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <span>Secondary school (middelbaar)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏫</span>
                  <span>Special education</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏛️</span>
                  <span>University / HBO</span>
                </div>
              </div>
            )}

            {/* Healthcare */}
            {showHealthcare && (
              <div className="space-y-1 pb-2 border-b border-gray-100">
                <div className="font-medium text-gray-500">Healthcare</div>
                <div className="flex items-center gap-2">
                  <span className="text-base">👨‍⚕️</span>
                  <span>Huisarts (GP/doctor)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💊</span>
                  <span>Apotheek (pharmacy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏥</span>
                  <span>Hospital</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🩺</span>
                  <span>Clinic</span>
                </div>
              </div>
            )}

            {/* Transport & Amenities */}
            <div className="space-y-1 pb-2 border-b border-gray-100">
              <div className="font-medium text-gray-500">Transport & amenities</div>
              {showTrainStations && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🚉</span>
                  <span>Train station</span>
                </div>
              )}
              {showSupermarkets && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🛒</span>
                  <span>Supermarket</span>
                </div>
              )}
              {showPlaygrounds && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🛝</span>
                  <span>Playground (speeltuin)</span>
                </div>
              )}
            </div>

            {areaCode && (
              <div className="flex items-center gap-2 pt-1">
                <div className="w-4 h-4 rounded border-2" style={{backgroundColor: '#a855f7', borderColor: '#9333ea', opacity: 0.4}}></div>
                <span>Neighborhood boundary</span>
              </div>
            )}

            {showCrimeOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  crime rate (blue)
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#dbeafe'}}></div>
                  <span>Low (&lt; 50 per 1,000)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#93c5fd'}}></div>
                  <span>Medium (50-100)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#3b82f6'}}></div>
                  <span>High (100-200)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#1e40af'}}></div>
                  <span>Very High (&gt; 200)</span>
                </div>
              </>
            )}

            {showAirQualityOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  air quality - PM2.5 (green)
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#d1fae5'}}></div>
                  <span>Good (0-15 µg/m³)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#6ee7b7'}}></div>
                  <span>Moderate (15-25)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#10b981'}}></div>
                  <span>Unhealthy (25-35)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#059669'}}></div>
                  <span>Very Unhealthy (&gt; 35)</span>
                </div>
              </>
            )}

            {showFoundationRiskOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  foundation risk (orange)
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#f97316', opacity: 0.6}}></div>
                  <span>Risk Area (KCAF)</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
