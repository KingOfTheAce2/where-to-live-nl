'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('map')
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
  const [showCadastralParcels, setShowCadastralParcels] = useState(false)
  const [baseMapStyle, setBaseMapStyle] = useState<'standard' | 'aerial'>('standard')
  const [showNationalParks, setShowNationalParks] = useState(false)
  const [showNatura2000, setShowNatura2000] = useState(false)
  const [showFloodRisk, setShowFloodRisk] = useState(false)
  const [showDroneNoFly, setShowDroneNoFly] = useState(false)
  const [showNoiseOverlay, setShowNoiseOverlay] = useState(false)
  const [noiseLayerType, setNoiseLayerType] = useState<'combined_lden' | 'road_lden' | 'rail_lden' | 'aircraft_lden'>('combined_lden')
  const [nationalParksData, setNationalParksData] = useState<any>(null)
  const [natura2000Data, setNatura2000Data] = useState<any>(null)
  const [floodRiskData, setFloodRiskData] = useState<any>(null)
  const [droneNoFlyData, setDroneNoFlyData] = useState<any>(null)
  const [airQualityPollutant, setAirQualityPollutant] = useState<'NO2' | 'PM10' | 'PM25'>('NO2')
  const [crimeData, setCrimeData] = useState<any[]>([])
  const [airQualityData, setAirQualityData] = useState<any[]>([])
  const [foundationRiskData, setFoundationRiskData] = useState<any>(null)

  // Amenity layer toggles - OFF by default to reduce clutter (except train stations)
  const [showHealthcare, setShowHealthcare] = useState(false)
  const [showSupermarkets, setShowSupermarkets] = useState(false)
  const [showPlaygrounds, setShowPlaygrounds] = useState(false)
  const [showTrainStations, setShowTrainStations] = useState(true)

  // School type toggles - individual control per type
  const [showPrimarySchools, setShowPrimarySchools] = useState(true)
  const [showSecondarySchools, setShowSecondarySchools] = useState(true)
  const [showMboSchools, setShowMboSchools] = useState(true)
  const [showHboSchools, setShowHboSchools] = useState(true)
  const [showWoSchools, setShowWoSchools] = useState(true)
  const [showSpecialSchools, setShowSpecialSchools] = useState(false)

  // Collapsible section states
  const [overlaysExpanded, setOverlaysExpanded] = useState(true)
  const [natureExpanded, setNatureExpanded] = useState(false)
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(true)
  const [schoolsExpanded, setSchoolsExpanded] = useState(false)
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
          'pdok-aerial': {
            type: 'raster',
            tiles: [
              'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg'
            ],
            tileSize: 256,
            attribution: '© PDOK | © Kadaster | Luchtfoto',
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
          {
            id: 'pdok-aerial-background',
            type: 'raster',
            source: 'pdok-aerial',
            minzoom: 0,
            maxzoom: 22,
            layout: {
              visibility: 'none',
            },
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

      // Add layer for MBO (Vocational) - Wrench emoji
      map.current!.addLayer({
        id: 'mbo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'mbo'],
        layout: {
          'text-field': '🔧',
          'text-size': 22,
          'text-allow-overlap': true,
        },
      })

      // Add layer for HBO (Universities of Applied Sciences) - Building emoji
      map.current!.addLayer({
        id: 'hbo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'hbo'],
        layout: {
          'text-field': '🏢',
          'text-size': 22,
          'text-allow-overlap': true,
        },
      })

      // Add layer for WO (Research Universities) - University emoji
      map.current!.addLayer({
        id: 'wo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', 'type', 'wo'],
        layout: {
          'text-field': '🏛️',
          'text-size': 24,
          'text-allow-overlap': true,
        },
      })

      // Add layer for older "higher" type (backward compatibility)
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
          if (type === 'mbo') return '🔧'
          if (type === 'hbo') return '🏢'
          if (type === 'wo') return '🏛️'
          if (type === 'higher') return '🏛️'  // Backward compatibility
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
      map.current!.on('click', 'mbo-schools', handleSchoolClick)
      map.current!.on('click', 'hbo-schools', handleSchoolClick)
      map.current!.on('click', 'wo-schools', handleSchoolClick)
      map.current!.on('click', 'higher-schools', handleSchoolClick)

      // Change cursor on hover for all school types
      const schoolLayers = ['primary-schools', 'secondary-schools', 'special-schools', 'mbo-schools', 'hbo-schools', 'wo-schools', 'higher-schools']
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

  // Control individual school layer visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layers = [
      { id: 'primary-schools', visible: showPrimarySchools },
      { id: 'secondary-schools', visible: showSecondarySchools },
      { id: 'special-schools', visible: showSpecialSchools },
      { id: 'mbo-schools', visible: showMboSchools },
      { id: 'hbo-schools', visible: showHboSchools },
      { id: 'wo-schools', visible: showWoSchools },
      { id: 'higher-schools', visible: showHboSchools || showWoSchools }, // Backward compat for old "higher" type
    ]

    layers.forEach(({ id, visible }) => {
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      }
    })
  }, [mapLoaded, showPrimarySchools, showSecondarySchools, showSpecialSchools, showMboSchools, showHboSchools, showWoSchools])

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

      // Add layer - insert before isochrones if they exist, otherwise just add
      const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined
      map.current.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.6
        }
      }, beforeLayerId)
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

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

        // Add fill layer
        map.current.addLayer({
          id: 'foundation-risk-fill',
          type: 'fill',
          source: 'foundation-risk-overlay',
          paint: {
            'fill-color': '#f97316',
            'fill-opacity': 0.4
          }
        }, beforeLayerId)

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
        }, beforeLayerId)

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

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

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
        }, beforeLayerId)

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
        }, beforeLayerId)

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

  // Add PDOK Cadastral Parcels Vector Tiles overlay
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'cadastral-parcels'
    const layerIdBoundaries = 'cadastral-boundaries'
    const layerIdLabels = 'cadastral-labels'

    if (showCadastralParcels) {
      console.log('🗺️ Adding cadastral parcels vector tile layer')

      // Remove existing layers if they exist (for clean re-add)
      if (map.current.getLayer(layerIdLabels)) {
        map.current.removeLayer(layerIdLabels)
      }
      if (map.current.getLayer(layerIdBoundaries)) {
        map.current.removeLayer(layerIdBoundaries)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }

      // Add vector tile source from PDOK
      map.current.addSource(sourceId, {
        type: 'vector',
        tiles: [
          'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/tiles/WebMercatorQuad/{z}/{x}/{y}?f=mvt'
        ],
        minzoom: 14,
        maxzoom: 17
      })

      // Add layer for cadastral boundaries (definitive) - black lines
      map.current.addLayer({
        id: layerIdBoundaries,
        type: 'line',
        source: sourceId,
        'source-layer': 'kadastralegreens',  // Layer name from the PDOK tile
        minzoom: 14,
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'typeGrens'], 'Definitieve grens'], '#000000',
            ['==', ['get', 'typeGrens'], 'Voorlopige grens'], '#CC9900',
            ['==', ['get', 'typeGrens'], 'Administratieve grens'], '#5CF6D1',
            '#666666'  // default
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            14, 0.5,
            17, 1.5
          ],
          'line-opacity': 0.8
        }
      })

      // Add layer for parcel labels
      map.current.addLayer({
        id: layerIdLabels,
        type: 'symbol',
        source: sourceId,
        'source-layer': 'perceellabel',  // Layer name from the PDOK tile
        minzoom: 16,
        layout: {
          'text-field': ['get', 'perceelnummer'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            16, 10,
            18, 14
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      })

      // Add click handler for parcel boundaries
      map.current.on('click', layerIdBoundaries, (e) => {
        if (!e.features || e.features.length === 0) return
        const props = e.features[0].properties
        if (!props) return

        new maplibregl.Popup({ offset: 15 })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding: 12px; min-width: 180px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">Kadastrale Grens</div>
            <div style="font-size: 12px; color: #666;">
              Type: ${props.typeGrens || 'Onbekend'}
            </div>
          </div>`)
          .addTo(map.current!)
      })

      map.current.on('mouseenter', layerIdBoundaries, () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current.on('mouseleave', layerIdBoundaries, () => {
        map.current!.getCanvas().style.cursor = ''
      })

    } else {
      // Remove layers and source when toggled off
      if (map.current.getLayer(layerIdLabels)) {
        console.log('🗺️ Removing cadastral parcels layer')
        map.current.removeLayer(layerIdLabels)
      }
      if (map.current.getLayer(layerIdBoundaries)) {
        map.current.removeLayer(layerIdBoundaries)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }
    }
  }, [mapLoaded, showCadastralParcels])

  // Toggle between standard and aerial base map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const standardLayer = map.current.getLayer('pdok-background')
    const aerialLayer = map.current.getLayer('pdok-aerial-background')

    if (!standardLayer || !aerialLayer) return

    if (baseMapStyle === 'aerial') {
      console.log('🗺️ Switching to aerial photo base map')
      map.current.setLayoutProperty('pdok-background', 'visibility', 'none')
      map.current.setLayoutProperty('pdok-aerial-background', 'visibility', 'visible')
    } else {
      console.log('🗺️ Switching to standard base map')
      map.current.setLayoutProperty('pdok-background', 'visibility', 'visible')
      map.current.setLayoutProperty('pdok-aerial-background', 'visibility', 'none')
    }
  }, [mapLoaded, baseMapStyle])

  // Fetch National Parks data
  useEffect(() => {
    if (!showNationalParks || nationalParksData) return

    console.log('🌲 Fetching National Parks data...')
    fetch('https://api.pdok.nl/rvo/nationale-parken/ogc/v1/collections/nationaleparken/items?f=json&limit=100')
      .then(res => res.json())
      .then(data => {
        console.log('✅ National Parks data loaded:', data.features?.length, 'parks')
        setNationalParksData(data)
      })
      .catch(err => console.error('❌ Error fetching National Parks:', err))
  }, [showNationalParks, nationalParksData])

  // Add National Parks overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showNationalParks && nationalParksData) {
      console.log('🗺️ Adding National Parks overlay')

      if (!map.current.getSource('national-parks')) {
        map.current.addSource('national-parks', {
          type: 'geojson',
          data: nationalParksData
        })

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

        map.current.addLayer({
          id: 'national-parks-fill',
          type: 'fill',
          source: 'national-parks',
          paint: {
            'fill-color': '#16a34a',
            'fill-opacity': 0.3
          }
        }, beforeLayerId)

        map.current.addLayer({
          id: 'national-parks-outline',
          type: 'line',
          source: 'national-parks',
          paint: {
            'line-color': '#15803d',
            'line-width': 2
          }
        }, beforeLayerId)

        map.current.on('click', 'national-parks-fill', (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #15803d;">🌲 ${props.naam}</div>
              <div style="font-size: 12px; color: #666;">Nationaal Park</div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">${props.hectares?.toLocaleString()} hectare</div>
              <div style="font-size: 10px; color: #999; margin-top: 4px;">Sinds: ${props.datum || 'N/A'}</div>
            </div>`)
            .addTo(map.current!)
        })

        map.current.on('mouseenter', 'national-parks-fill', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'national-parks-fill', () => {
          map.current!.getCanvas().style.cursor = ''
        })
      }
    } else {
      if (map.current.getLayer('national-parks-fill')) {
        console.log('🗺️ Removing National Parks overlay')
        map.current.removeLayer('national-parks-fill')
        map.current.removeLayer('national-parks-outline')
        map.current.removeSource('national-parks')
      }
    }
  }, [mapLoaded, showNationalParks, nationalParksData])

  // Fetch Natura 2000 data
  useEffect(() => {
    if (!showNatura2000 || natura2000Data) return

    console.log('🦅 Fetching Natura 2000 data...')
    fetch('https://api.pdok.nl/rvo/natura2000/ogc/v1/collections/natura2000/items?f=json&limit=200')
      .then(res => res.json())
      .then(data => {
        console.log('✅ Natura 2000 data loaded:', data.features?.length, 'areas')
        setNatura2000Data(data)
      })
      .catch(err => console.error('❌ Error fetching Natura 2000:', err))
  }, [showNatura2000, natura2000Data])

  // Add Natura 2000 overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showNatura2000 && natura2000Data) {
      console.log('🗺️ Adding Natura 2000 overlay')

      if (!map.current.getSource('natura-2000')) {
        map.current.addSource('natura-2000', {
          type: 'geojson',
          data: natura2000Data
        })

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

        map.current.addLayer({
          id: 'natura-2000-fill',
          type: 'fill',
          source: 'natura-2000',
          paint: {
            'fill-color': '#0ea5e9',
            'fill-opacity': 0.25
          }
        }, beforeLayerId)

        map.current.addLayer({
          id: 'natura-2000-outline',
          type: 'line',
          source: 'natura-2000',
          paint: {
            'line-color': '#0284c7',
            'line-width': 2
          }
        }, beforeLayerId)

        map.current.on('click', 'natura-2000-fill', (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 220px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #0284c7;">🦅 ${props.naam_n2k}</div>
              <div style="font-size: 12px; color: #666;">Natura 2000 beschermd gebied</div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">
                ${props.beschermin === 'HR' ? 'Habitatrichtlijn' : props.beschermin === 'VR' ? 'Vogelrichtlijn' : props.beschermin || 'EU beschermd'}
              </div>
              <div style="font-size: 10px; color: #999; margin-top: 4px;">Code: ${props.sitecode_h || props.sitecode_v || 'N/A'}</div>
            </div>`)
            .addTo(map.current!)
        })

        map.current.on('mouseenter', 'natura-2000-fill', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'natura-2000-fill', () => {
          map.current!.getCanvas().style.cursor = ''
        })
      }
    } else {
      if (map.current.getLayer('natura-2000-fill')) {
        console.log('🗺️ Removing Natura 2000 overlay')
        map.current.removeLayer('natura-2000-fill')
        map.current.removeLayer('natura-2000-outline')
        map.current.removeSource('natura-2000')
      }
    }
  }, [mapLoaded, showNatura2000, natura2000Data])

  // Fetch Flood Risk data
  useEffect(() => {
    if (!showFloodRisk || floodRiskData) return

    console.log('🌊 Fetching Flood Risk data...')
    fetch('https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?f=json&limit=500')
      .then(res => res.json())
      .then(data => {
        console.log('✅ Flood Risk data loaded:', data.features?.length, 'zones')
        setFloodRiskData(data)
      })
      .catch(err => console.error('❌ Error fetching Flood Risk:', err))
  }, [showFloodRisk, floodRiskData])

  // Add Flood Risk overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showFloodRisk && floodRiskData) {
      console.log('🗺️ Adding Flood Risk overlay')

      if (!map.current.getSource('flood-risk')) {
        map.current.addSource('flood-risk', {
          type: 'geojson',
          data: floodRiskData
        })

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

        map.current.addLayer({
          id: 'flood-risk-fill',
          type: 'fill',
          source: 'flood-risk',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.3
          }
        }, beforeLayerId)

        map.current.addLayer({
          id: 'flood-risk-outline',
          type: 'line',
          source: 'flood-risk',
          paint: {
            'line-color': '#1d4ed8',
            'line-width': 1.5,
            'line-dasharray': [2, 1]
          }
        }, beforeLayerId)

        map.current.on('click', 'flood-risk-fill', (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 240px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #1d4ed8;">🌊 Overstromingsrisicogebied</div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${props.name || 'Risicozone'}</div>
              <div style="font-size: 11px; color: #999;">${props.qualitative_value || props.description || 'Potentieel significant overstromingsrisico'}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Bron: Rijkswaterstaat (ROR)</div>
            </div>`)
            .addTo(map.current!)
        })

        map.current.on('mouseenter', 'flood-risk-fill', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'flood-risk-fill', () => {
          map.current!.getCanvas().style.cursor = ''
        })
      }
    } else {
      if (map.current.getLayer('flood-risk-fill')) {
        console.log('🗺️ Removing Flood Risk overlay')
        map.current.removeLayer('flood-risk-fill')
        map.current.removeLayer('flood-risk-outline')
        map.current.removeSource('flood-risk')
      }
    }
  }, [mapLoaded, showFloodRisk, floodRiskData])

  // Fetch Drone No-Fly Zones data
  useEffect(() => {
    if (!showDroneNoFly || droneNoFlyData) return

    console.log('🚁 Fetching Drone No-Fly Zones data...')
    // Fetch both collections and merge them
    Promise.all([
      fetch('https://api.pdok.nl/lvnl/drone-no-flyzones/ogc/v1/collections/luchtvaartgebieden_zonder_natura2000/items?f=json&limit=500'),
      fetch('https://api.pdok.nl/lvnl/drone-no-flyzones/ogc/v1/collections/luchtvaartgebieden/items?f=json&limit=500')
    ])
      .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
      .then(([data1, data2]) => {
        // Merge features from both collections
        const mergedData = {
          type: 'FeatureCollection',
          features: [
            ...(data1.features || []).map((f: any) => ({ ...f, properties: { ...f.properties, zoneType: 'restricted' } })),
            ...(data2.features || []).map((f: any) => ({ ...f, properties: { ...f.properties, zoneType: 'natura2000' } }))
          ]
        }
        console.log('✅ Drone No-Fly Zones data loaded:', mergedData.features?.length, 'zones')
        setDroneNoFlyData(mergedData)
      })
      .catch(err => console.error('❌ Error fetching Drone No-Fly Zones:', err))
  }, [showDroneNoFly, droneNoFlyData])

  // Add Drone No-Fly Zones overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showDroneNoFly && droneNoFlyData) {
      console.log('🗺️ Adding Drone No-Fly Zones overlay')

      if (!map.current.getSource('drone-no-fly')) {
        map.current.addSource('drone-no-fly', {
          type: 'geojson',
          data: droneNoFlyData
        })

        // Insert before isochrones if they exist for proper layer ordering
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined

        map.current.addLayer({
          id: 'drone-no-fly-fill',
          type: 'fill',
          source: 'drone-no-fly',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'zoneType'], 'restricted'], '#ef4444',
              '#f97316'  // natura2000 zones
            ],
            'fill-opacity': 0.25
          }
        }, beforeLayerId)

        map.current.addLayer({
          id: 'drone-no-fly-outline',
          type: 'line',
          source: 'drone-no-fly',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'zoneType'], 'restricted'], '#dc2626',
              '#ea580c'
            ],
            'line-width': 1.5,
            'line-dasharray': [3, 2]
          }
        }, beforeLayerId)

        map.current.on('click', 'drone-no-fly-fill', (e) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          const isRestricted = props.zoneType === 'restricted'
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 220px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: ${isRestricted ? '#dc2626' : '#ea580c'};">
                🚁 ${isRestricted ? 'Drone Verboden Zone' : 'Natura 2000 No-Fly Zone'}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${props.source_txt || props.localtype || 'No-fly zone'}</div>
              <div style="font-size: 11px; color: #999;">
                ${isRestricted ? 'Vitale infrastructuur / beveiligd gebied' : 'Beschermd natuurgebied'}
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Bron: LVNL / Rijksoverheid</div>
            </div>`)
            .addTo(map.current!)
        })

        map.current.on('mouseenter', 'drone-no-fly-fill', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'drone-no-fly-fill', () => {
          map.current!.getCanvas().style.cursor = ''
        })
      }
    } else {
      if (map.current.getLayer('drone-no-fly-fill')) {
        console.log('🗺️ Removing Drone No-Fly Zones overlay')
        map.current.removeLayer('drone-no-fly-fill')
        map.current.removeLayer('drone-no-fly-outline')
        map.current.removeSource('drone-no-fly')
      }
    }
  }, [mapLoaded, showDroneNoFly, droneNoFlyData])

  // Add Noise pollution WMS overlay from Atlas Leefomgeving (RIVM)
  const noiseLayerNames: Record<string, string> = {
    combined_lden: 'geluid_cumulatief_lden',
    road_lden: 'geluid_wegverkeer_lden',
    rail_lden: 'geluid_spoorwegen_lden',
    aircraft_lden: 'geluid_luchtvaart_lden'
  }

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const noiseSourceId = 'noise-wms'
    const noiseLayerId = 'noise-wms-layer'

    if (showNoiseOverlay) {
      console.log('🔊 Adding Noise overlay:', noiseLayerType)

      const layerName = noiseLayerNames[noiseLayerType] || 'geluid_cumulatief_lden'
      // Use WMS proxy to avoid CORS issues with data.rivm.nl
      const baseWmsUrl = 'https://data.rivm.nl/geo/alo/wms'
      const wmsUrl = `${BACKEND_URL}/api/wms-proxy?url=${encodeURIComponent(baseWmsUrl)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${layerName}&CRS=EPSG:3857&STYLES=&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`

      // Remove existing noise layer if present
      if (map.current.getLayer(noiseLayerId)) {
        map.current.removeLayer(noiseLayerId)
        map.current.removeSource(noiseSourceId)
      }

      // Add WMS source as raster tiles via proxy
      map.current.addSource(noiseSourceId, {
        type: 'raster',
        tiles: [wmsUrl],
        tileSize: 256,
        attribution: '© RIVM / Atlas Leefomgeving'
      })

      // Add layer - insert before isochrones if they exist, otherwise just add
      const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined
      map.current.addLayer({
        id: noiseLayerId,
        type: 'raster',
        source: noiseSourceId,
        paint: {
          'raster-opacity': 0.7
        }
      }, beforeLayerId)
    } else {
      if (map.current.getLayer(noiseLayerId)) {
        console.log('🔊 Removing Noise overlay')
        map.current.removeLayer(noiseLayerId)
        map.current.removeSource(noiseSourceId)
      }
    }
  }, [mapLoaded, showNoiseOverlay, noiseLayerType])

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
          <p className="text-sm text-gray-600">{t('loading')}</p>
        </div>
      )}

      {/* Overlay Toggle Controls */}
      {mapLoaded && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
          {/* Base Map Selector */}
          <div className="mb-3 pb-2 border-b border-gray-200">
            <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('baseMap')}</h4>
            <div className="flex gap-1">
              <button
                onClick={() => setBaseMapStyle('standard')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  baseMapStyle === 'standard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('standardMap')}
              </button>
              <button
                onClick={() => setBaseMapStyle('aerial')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  baseMapStyle === 'aerial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('aerialPhoto')}
              </button>
            </div>
          </div>

          <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('overlays')}</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCrimeOverlay}
                onChange={(e) => setShowCrimeOverlay(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">{t('crimeRate')}</span>
            </label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAirQualityOverlay}
                  onChange={(e) => setShowAirQualityOverlay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">{t('airQuality')}</span>
              </label>
              {showAirQualityOverlay && (
                <select
                  value={airQualityPollutant}
                  onChange={(e) => setAirQualityPollutant(e.target.value as 'NO2' | 'PM10' | 'PM25')}
                  className="ml-6 text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="NO2">{t('pollutants.NO2')}</option>
                  <option value="PM10">{t('pollutants.PM10')}</option>
                  <option value="PM25">{t('pollutants.PM25')}</option>
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
              <span className="text-xs text-gray-700">{t('foundationRisk')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLeefbaarometer}
                onChange={(e) => setShowLeefbaarometer(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">{t('livabilityHeatmap')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCadastralParcels}
                onChange={(e) => setShowCadastralParcels(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">{t('cadastralParcels')}</span>
            </label>

            {/* Nature & Environment - Collapsible */}
            <div className="border-t border-gray-200 mt-2 pt-2">
              <button
                onClick={() => setNatureExpanded(!natureExpanded)}
                className="flex items-center justify-between w-full text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <span>{t('natureEnvironment')}</span>
                <span className="text-gray-400">{natureExpanded ? '▼' : '▶'}</span>
              </button>
              {natureExpanded && (
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNationalParks}
                      onChange={(e) => setShowNationalParks(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <span className="text-xs text-gray-700">{t('nationalParks')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNatura2000}
                      onChange={(e) => setShowNatura2000(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="text-xs text-gray-700">{t('natura2000')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFloodRisk}
                      onChange={(e) => setShowFloodRisk(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">{t('floodRiskZones')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDroneNoFly}
                      onChange={(e) => setShowDroneNoFly(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-xs text-gray-700">{t('droneNoFlyZones')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNoiseOverlay}
                      onChange={(e) => setShowNoiseOverlay(e.target.checked)}
                      className="w-4 h-4 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-gray-700">{t('noiseOverlay')}</span>
                  </label>
                  {showNoiseOverlay && (
                    <select
                      value={noiseLayerType}
                      onChange={(e) => setNoiseLayerType(e.target.value as any)}
                      className="ml-6 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="combined_lden">{t('noiseCombined')}</option>
                      <option value="road_lden">{t('noiseRoad')}</option>
                      <option value="rail_lden">{t('noiseRail')}</option>
                      <option value="aircraft_lden">{t('noiseAircraft')}</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Schools - Collapsible with individual type toggles */}
            <div className="border-t border-gray-200 mt-2 pt-2">
              <button
                onClick={() => setSchoolsExpanded(!schoolsExpanded)}
                className="flex items-center justify-between w-full text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <span>🎓 {t('schools')}</span>
                <span className="text-gray-400">{schoolsExpanded ? '▼' : '▶'}</span>
              </button>
              {schoolsExpanded && (
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrimarySchools}
                      onChange={(e) => setShowPrimarySchools(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-gray-700">🎒 {t('legend.primarySchool')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSecondarySchools}
                      onChange={(e) => setShowSecondarySchools(e.target.checked)}
                      className="w-4 h-4 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-xs text-gray-700">🎓 {t('legend.secondarySchool')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMboSchools}
                      onChange={(e) => setShowMboSchools(e.target.checked)}
                      className="w-4 h-4 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-gray-700">🔧 MBO (Vocational)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHboSchools}
                      onChange={(e) => setShowHboSchools(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">🏢 HBO (Applied Sciences)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWoSchools}
                      onChange={(e) => setShowWoSchools(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-700">🏛️ {t('legend.university')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSpecialSchools}
                      onChange={(e) => setShowSpecialSchools(e.target.checked)}
                      className="w-4 h-4 text-teal-500 rounded focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-xs text-gray-700">🏫 {t('legend.specialEducation')}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Amenities - Collapsible */}
            <div className="border-t border-gray-200 mt-2 pt-2">
              <button
                onClick={() => setAmenitiesExpanded(!amenitiesExpanded)}
                className="flex items-center justify-between w-full text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <span>{t('amenities')}</span>
                <span className="text-gray-400">{amenitiesExpanded ? '▼' : '▶'}</span>
              </button>
              {amenitiesExpanded && (
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHealthcare}
                      onChange={(e) => setShowHealthcare(e.target.checked)}
                      className="w-4 h-4 text-red-500 rounded focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-xs text-gray-700">👨‍⚕️💊🏥 {t('healthcare')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSupermarkets}
                      onChange={(e) => setShowSupermarkets(e.target.checked)}
                      className="w-4 h-4 text-teal-500 rounded focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-xs text-gray-700">🛒 {t('supermarkets')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPlaygrounds}
                      onChange={(e) => setShowPlaygrounds(e.target.checked)}
                      className="w-4 h-4 text-yellow-500 rounded focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-xs text-gray-700">🛝 {t('playgrounds')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTrainStations}
                      onChange={(e) => setShowTrainStations(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">🚉 {t('trainStations')}</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {mapLoaded && (
        <div className="absolute bottom-12 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs max-h-[70vh] overflow-y-auto">
          <h4 className="font-semibold text-sm text-gray-900 mb-3">{t('legend.title')}</h4>
          <div className="space-y-1.5 text-xs text-gray-700">
            {/* Base map colors - only show for standard map, not aerial photos */}
            {baseMapStyle === 'standard' && (
              <div className="pb-2 mb-2 border-b border-gray-100">
                <div className="font-medium text-gray-500 mb-2">{t('legend.baseMap')}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#b5d6f0'}}></div>
                    <span>{t('legend.water')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#cdebb4'}}></div>
                    <span>{t('legend.parks')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#e8d1c9'}}></div>
                    <span>{t('legend.buildings')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#f7f4eb'}}></div>
                    <span>{t('legend.residential')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#e8dce8'}}></div>
                    <span>{t('legend.industrial')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{backgroundColor: '#ffffb3', border: '1px solid #f5a623'}}></div>
                    <span>{t('legend.roads')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 rounded-sm" style={{backgroundColor: '#333333'}}></div>
                    <span>{t('legend.railways')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Map markers legend */}
            <div className="font-medium text-gray-600 mb-2">{t('legend.markers')}</div>

            {/* Schools */}
            {showSchools && (
              <div className="space-y-1 pb-2 border-b border-gray-100">
                <div className="font-medium text-gray-500">{t('legend.schools')}</div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎒</span>
                  <span>{t('legend.primarySchool')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <span>{t('legend.secondarySchool')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏫</span>
                  <span>{t('legend.specialEducation')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏛️</span>
                  <span>{t('legend.university')}</span>
                </div>
              </div>
            )}

            {/* Healthcare */}
            {showHealthcare && (
              <div className="space-y-1 pb-2 border-b border-gray-100">
                <div className="font-medium text-gray-500">{t('legend.healthcareTitle')}</div>
                <div className="flex items-center gap-2">
                  <span className="text-base">👨‍⚕️</span>
                  <span>{t('legend.gp')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💊</span>
                  <span>{t('legend.pharmacy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏥</span>
                  <span>{t('legend.hospital')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🩺</span>
                  <span>{t('legend.clinic')}</span>
                </div>
              </div>
            )}

            {/* Transport & Amenities */}
            <div className="space-y-1 pb-2 border-b border-gray-100">
              <div className="font-medium text-gray-500">{t('legend.transportAmenities')}</div>
              {showTrainStations && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🚉</span>
                  <span>{t('legend.trainStation')}</span>
                </div>
              )}
              {showSupermarkets && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🛒</span>
                  <span>{t('legend.supermarket')}</span>
                </div>
              )}
              {showPlaygrounds && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🛝</span>
                  <span>{t('legend.playground')}</span>
                </div>
              )}
            </div>

            {areaCode && (
              <div className="flex items-center gap-2 pt-1">
                <div className="w-4 h-4 rounded border-2" style={{backgroundColor: '#a855f7', borderColor: '#9333ea', opacity: 0.4}}></div>
                <span>{t('legend.neighborhoodBoundary')}</span>
              </div>
            )}

            {showCrimeOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.crimeRateLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#dbeafe'}}></div>
                  <span>{t('legend.low')} (&lt; 50 per 1,000)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#93c5fd'}}></div>
                  <span>{t('legend.medium')} (50-100)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#3b82f6'}}></div>
                  <span>{t('legend.high')} (100-200)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#1e40af'}}></div>
                  <span>{t('legend.veryHigh')} (&gt; 200)</span>
                </div>
              </>
            )}

            {showAirQualityOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.airQualityLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#d1fae5'}}></div>
                  <span>{t('legend.good')} (0-15 µg/m³)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#6ee7b7'}}></div>
                  <span>{t('legend.moderate')} (15-25)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#10b981'}}></div>
                  <span>{t('legend.unhealthy')} (25-35)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#059669'}}></div>
                  <span>{t('legend.veryUnhealthy')} (&gt; 35)</span>
                </div>
              </>
            )}

            {showFoundationRiskOverlay && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.foundationRiskLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#f97316', opacity: 0.6}}></div>
                  <span>{t('legend.riskArea')}</span>
                </div>
              </>
            )}

            {showCadastralParcels && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.cadastralParcelsLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{backgroundColor: '#000000'}}></div>
                  <span>{t('legend.definiteBoundary')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{backgroundColor: '#CC9900'}}></div>
                  <span>{t('legend.provisionalBoundary')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{backgroundColor: '#5CF6D1'}}></div>
                  <span>{t('legend.adminBoundary')}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1 italic">
                  {t('legend.cadastralZoomNote')}
                </div>
              </>
            )}

            {showNationalParks && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.nationalParksLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#16a34a', opacity: 0.5, border: '2px solid #15803d'}}></div>
                  <span>{t('legend.nationalPark')}</span>
                </div>
              </>
            )}

            {showNatura2000 && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.natura2000Legend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#0ea5e9', opacity: 0.5, border: '2px solid #0284c7'}}></div>
                  <span>{t('legend.protectedArea')}</span>
                </div>
              </>
            )}

            {showFloodRisk && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.floodRiskLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#3b82f6', opacity: 0.5, border: '2px dashed #1d4ed8'}}></div>
                  <span>{t('legend.floodRiskZone')}</span>
                </div>
              </>
            )}

            {showDroneNoFly && (
              <>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 font-medium">
                  {t('legend.droneNoFlyLegend')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#ef4444', opacity: 0.5, border: '2px dashed #dc2626'}}></div>
                  <span>{t('legend.restrictedZone')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#f97316', opacity: 0.5, border: '2px dashed #ea580c'}}></div>
                  <span>{t('legend.natura2000NoFly')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
