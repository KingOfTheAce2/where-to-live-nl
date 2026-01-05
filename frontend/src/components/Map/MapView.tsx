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
import Link from 'next/link'

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
  const [showAirQualityRealtimeOverlay, setShowAirQualityRealtimeOverlay] = useState(false)
  const [showFoundationRiskOverlay, setShowFoundationRiskOverlay] = useState(false)
  const [showLeefbaarometer, setShowLeefbaarometer] = useState(false)
  const [showLivabilityChange, setShowLivabilityChange] = useState(false)
  const [showCadastralParcels, setShowCadastralParcels] = useState(false)
  const [baseMapStyle, setBaseMapStyle] = useState<'standard' | 'aerial'>('standard')
  const [showNationalParks, setShowNationalParks] = useState(false)
  const [showNatura2000, setShowNatura2000] = useState(false)
  const [showDroneNoFly, setShowDroneNoFly] = useState(false)
  const [showNoiseOverlay, setShowNoiseOverlay] = useState(false)
  const [noiseLayerType, setNoiseLayerType] = useState<'combined_lden' | 'road_lden' | 'rail_lden' | 'aircraft_lden'>('combined_lden')
  const [nationalParksData, setNationalParksData] = useState<any>(null)
  const [natura2000Data, setNatura2000Data] = useState<any>(null)
  const [droneNoFlyData, setDroneNoFlyData] = useState<any>(null)
  const [airQualityPollutant, setAirQualityPollutant] = useState<'NO2' | 'PM10' | 'PM25'>('NO2')
  const [airQualityYear, setAirQualityYear] = useState<'current' | '2023' | '2022' | '2021' | '2020' | '2019'>('current')
  const [crimeData, setCrimeData] = useState<any[]>([])
  const [crimeLoading, setCrimeLoading] = useState(false)
  const [neighborhoodLoading, setNeighborhoodLoading] = useState(false)
  const [cadastralLoading, setCadastralLoading] = useState(false)
  const [airQualityData, setAirQualityData] = useState<any[]>([])
  const [airQualityRealtimeData, setAirQualityRealtimeData] = useState<any[]>([])

  // Unified Flood Risk - combines zone + depth data from PDOK + Lizard
  const [showFloodRisk, setShowFloodRisk] = useState(false)
  const [floodScenario, setFloodScenario] = useState<'t10' | 't100' | 't1000'>('t100')
  const [floodRiskData, setFloodRiskData] = useState<any>(null)

  // Amenity layer toggles - OFF by default to reduce clutter (except train stations)
  const [showHealthcare, setShowHealthcare] = useState(false)
  const [showSupermarkets, setShowSupermarkets] = useState(false)
  const [showPlaygrounds, setShowPlaygrounds] = useState(false)
  const [showSpeelbossen, setShowSpeelbossen] = useState(false)
  const [showTrainStations, setShowTrainStations] = useState(false)
  const [showMetroStations, setShowMetroStations] = useState(false)
  const [showTramStops, setShowTramStops] = useState(false)
  const [showTramLines, setShowTramLines] = useState(false)
  const [showMetroLines, setShowMetroLines] = useState(false)
  const [showNeighborhoodBoundaries, setShowNeighborhoodBoundaries] = useState(false)
  const [neighborhoodBoundariesData, setNeighborhoodBoundariesData] = useState<any>(null)

  // School type toggles - individual control per type
  const [showPrimarySchools, setShowPrimarySchools] = useState(false)
  const [showSecondarySchools, setShowSecondarySchools] = useState(false)
  const [showMboSchools, setShowMboSchools] = useState(false)
  const [showHboSchools, setShowHboSchools] = useState(false)
  const [showWoSchools, setShowWoSchools] = useState(false)
  const [showSpecialSchools, setShowSpecialSchools] = useState(false)

  // Compact toolbar state - which panel is currently open
  const [activeToolbarPanel, setActiveToolbarPanel] = useState<'mapStyle' | 'layers' | 'mapLayers' | 'insights' | 'environment' | 'nature' | 'schools' | 'amenities' | 'legend' | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [healthcareData, setHealthcareData] = useState<any[]>([])
  const [supermarketsData, setSupermarketsData] = useState<any[]>([])
  const [playgroundsData, setPlaygroundsData] = useState<any[]>([])
  const [trainStationsData, setTrainStationsData] = useState<any[]>([])
  const [metroStationsData, setMetroStationsData] = useState<any[]>([])
  const [tramStopsData, setTramStopsData] = useState<any[]>([])
  const [tramLinesData, setTramLinesData] = useState<any>(null)
  const [metroLinesData, setMetroLinesData] = useState<any>(null)
  const [amenitiesLoading, setAmenitiesLoading] = useState(false)
  const [mapBoundsVersion, setMapBoundsVersion] = useState(0) // Trigger refetch on map move

  // Refs for tracking event handlers to enable proper cleanup
  const eventHandlersRef = useRef<Map<string, { event: string; layer: string; handler: any }[]>>(new Map())

  // Ref for abort controllers to cancel pending requests
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  // Ref to track last fetched bounds for threshold-based refetching
  const lastFetchedBoundsRef = useRef<{ sw: [number, number]; ne: [number, number] } | null>(null)

  // LRU cache for layer data to avoid refetching on toggle
  const layerDataCacheRef = useRef<Map<string, { data: any; bounds: string; timestamp: number }>>(new Map())
  const CACHE_TTL = 60000 // 1 minute cache TTL
  const CACHE_MAX_SIZE = 20 // Maximum cached items

  // Helper to check if bounds have changed significantly (>15% area change)
  const boundsChangedSignificantly = (newBounds: maplibregl.LngLatBounds): boolean => {
    if (!lastFetchedBoundsRef.current) return true

    const lastBounds = lastFetchedBoundsRef.current
    const newSW = newBounds.getSouthWest()
    const newNE = newBounds.getNorthEast()

    // Calculate overlap percentage
    const lastWidth = lastBounds.ne[0] - lastBounds.sw[0]
    const lastHeight = lastBounds.ne[1] - lastBounds.sw[1]
    const newWidth = newNE.lng - newSW.lng
    const newHeight = newNE.lat - newSW.lat

    // Check if new bounds extend beyond old bounds by more than 15%
    const extendLeft = Math.max(0, lastBounds.sw[0] - newSW.lng)
    const extendRight = Math.max(0, newNE.lng - lastBounds.ne[0])
    const extendBottom = Math.max(0, lastBounds.sw[1] - newSW.lat)
    const extendTop = Math.max(0, newNE.lat - lastBounds.ne[1])

    const totalExtend = extendLeft + extendRight + extendBottom + extendTop
    const threshold = (lastWidth + lastHeight) * 0.15

    return totalExtend > threshold
  }

  // Helper to get cached data if valid
  const getCachedData = (cacheKey: string, currentBounds: string): any | null => {
    const cached = layerDataCacheRef.current.get(cacheKey)
    if (cached && cached.bounds === currentBounds && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data
    }
    return null
  }

  // Helper to set cached data with LRU eviction
  const setCachedData = (cacheKey: string, data: any, bounds: string) => {
    // Evict oldest if at capacity
    if (layerDataCacheRef.current.size >= CACHE_MAX_SIZE) {
      const oldestKey = layerDataCacheRef.current.keys().next().value
      if (oldestKey) layerDataCacheRef.current.delete(oldestKey)
    }
    layerDataCacheRef.current.set(cacheKey, { data, bounds, timestamp: Date.now() })
  }

  // Backend URL from environment or default
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  // Utility function to safely remove a layer and its source
  const safeRemoveLayer = (layerId: string, sourceId?: string) => {
    if (!map.current) return
    try {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
    } catch (e) {
      console.warn(`Could not remove layer ${layerId}:`, e)
    }
    if (sourceId) {
      try {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }
      } catch (e) {
        console.warn(`Could not remove source ${sourceId}:`, e)
      }
    }
  }

  // Utility function to safely add a source with retry logic
  const safeAddSource = (sourceId: string, sourceConfig: any): boolean => {
    if (!map.current) return false
    try {
      if (map.current.getSource(sourceId)) {
        // Source already exists, remove it first
        const layers = map.current.getStyle().layers || []
        layers.forEach((layer: any) => {
          if (layer.source === sourceId) {
            safeRemoveLayer(layer.id)
          }
        })
        map.current.removeSource(sourceId)
      }
      map.current.addSource(sourceId, sourceConfig)
      return true
    } catch (e) {
      console.error(`Error adding source ${sourceId}:`, e)
      return false
    }
  }

  // Utility function to safely add a layer
  const safeAddLayer = (layerConfig: any, beforeId?: string): boolean => {
    if (!map.current) return false
    try {
      if (map.current.getLayer(layerConfig.id)) {
        map.current.removeLayer(layerConfig.id)
      }
      map.current.addLayer(layerConfig, beforeId)
      return true
    } catch (e) {
      console.error(`Error adding layer ${layerConfig.id}:`, e)
      return false
    }
  }

  // Utility function to safely add event listener and track for cleanup
  const safeAddEventListener = (
    overlayId: string,
    layerId: string,
    event: 'click' | 'mouseenter' | 'mouseleave' | 'mousemove',
    handler: (ev: maplibregl.MapLayerMouseEvent) => void
  ) => {
    if (!map.current) return

    // Add the event listener
    map.current.on(event, layerId, handler)

    // Track it for later cleanup
    const handlers = eventHandlersRef.current.get(overlayId) || []
    handlers.push({ event, layer: layerId, handler })
    eventHandlersRef.current.set(overlayId, handlers)
  }

  // Utility function to clean up all event listeners for an overlay
  const cleanupOverlayEvents = (overlayId: string) => {
    if (!map.current) return

    const handlers = eventHandlersRef.current.get(overlayId)
    if (handlers) {
      handlers.forEach(({ event, layer, handler }) => {
        try {
          map.current?.off(event as 'click' | 'mouseenter' | 'mouseleave', layer, handler)
        } catch (e) {
          // Layer might already be removed, ignore
        }
      })
      eventHandlersRef.current.delete(overlayId)
    }
  }

  // Utility function to cleanup an overlay completely (events + layers + source)
  const cleanupOverlay = (
    overlayId: string,
    layerIds: string[],
    sourceId?: string
  ) => {
    // First remove event listeners
    cleanupOverlayEvents(overlayId)

    // Then remove layers
    layerIds.forEach(layerId => safeRemoveLayer(layerId))

    // Finally remove source if specified
    if (sourceId) {
      try {
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }

  // Utility function to abort pending requests
  const abortPendingRequest = (requestId: string) => {
    const controller = abortControllersRef.current.get(requestId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(requestId)
    }
  }

  // Utility function to create new abort controller
  const createAbortController = (requestId: string): AbortController => {
    abortPendingRequest(requestId) // Cancel any existing request
    const controller = new AbortController()
    abortControllersRef.current.set(requestId, controller)
    return controller
  }

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
          // CartoDB Voyager labels - high contrast labels for aerial view navigation
          'carto-labels': {
            type: 'raster',
            tiles: [
              'https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© CARTO © OpenStreetMap',
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
          {
            id: 'aerial-labels-overlay',
            type: 'raster',
            source: 'carto-labels',
            minzoom: 0,
            maxzoom: 22,
            layout: {
              visibility: 'none',
            },
            paint: {
              'raster-opacity': 1,
              'raster-contrast': 0.2,  // Boost contrast for better visibility
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

      // Add shape icons for unified category styling
      // This prevents "polkadot overload" - one color per category, different shapes
      const addShapeIcons = () => {
        if (!map.current) return

        // Create canvas-based shape icons
        const createShapeIcon = (shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'plus' | 'cross', color: string, size: number = 24, strokeColor: string = '#ffffff'): ImageData => {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          const center = size / 2
          const radius = size / 2 - 3

          ctx.fillStyle = color
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 2

          switch (shape) {
            case 'circle':
              ctx.beginPath()
              ctx.arc(center, center, radius, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
              break
            case 'square':
              ctx.fillRect(3, 3, size - 6, size - 6)
              ctx.strokeRect(3, 3, size - 6, size - 6)
              break
            case 'triangle':
              ctx.beginPath()
              ctx.moveTo(center, 3)
              ctx.lineTo(size - 3, size - 3)
              ctx.lineTo(3, size - 3)
              ctx.closePath()
              ctx.fill()
              ctx.stroke()
              break
            case 'diamond':
              ctx.beginPath()
              ctx.moveTo(center, 3)
              ctx.lineTo(size - 3, center)
              ctx.lineTo(center, size - 3)
              ctx.lineTo(3, center)
              ctx.closePath()
              ctx.fill()
              ctx.stroke()
              break
            case 'plus':
              const w = size / 4
              ctx.fillRect(center - w/2, 3, w, size - 6)
              ctx.fillRect(3, center - w/2, size - 6, w)
              ctx.strokeRect(center - w/2, 3, w, size - 6)
              ctx.strokeRect(3, center - w/2, size - 6, w)
              break
            case 'cross':
              ctx.lineWidth = 4
              ctx.strokeStyle = color
              ctx.beginPath()
              ctx.moveTo(5, 5)
              ctx.lineTo(size - 5, size - 5)
              ctx.moveTo(size - 5, 5)
              ctx.lineTo(5, size - 5)
              ctx.stroke()
              // Add white outline
              ctx.lineWidth = 6
              ctx.strokeStyle = strokeColor
              ctx.globalCompositeOperation = 'destination-over'
              ctx.stroke()
              break
          }
          return ctx.getImageData(0, 0, size, size)
        }

        // Category colors - unified palette
        const colors = {
          healthcare: '#3b82f6',   // Blue
          transport: '#64748b',    // Slate gray
          shopping: '#f97316',     // Orange
          recreation: '#22c55e',   // Green
          education: '#8b5cf6',    // Purple
        }

        // Healthcare shapes (all blue)
        map.current.addImage('shape-healthcare-doctor', createShapeIcon('circle', colors.healthcare, 20))
        map.current.addImage('shape-healthcare-pharmacy', createShapeIcon('plus', colors.healthcare, 20))
        map.current.addImage('shape-healthcare-hospital', createShapeIcon('cross', '#dc2626', 28)) // Hospital stays red, larger
        map.current.addImage('shape-healthcare-clinic', createShapeIcon('diamond', colors.healthcare, 20))

        // Transport shapes (all slate)
        map.current.addImage('shape-transport-train', createShapeIcon('square', colors.transport, 22))
        map.current.addImage('shape-transport-metro', createShapeIcon('circle', colors.transport, 20))
        map.current.addImage('shape-transport-tram', createShapeIcon('triangle', colors.transport, 18))

        // Shopping & Recreation
        map.current.addImage('shape-shopping-supermarket', createShapeIcon('square', colors.shopping, 18))
        map.current.addImage('shape-recreation-playground', createShapeIcon('triangle', colors.recreation, 22)) // Larger for visibility
        map.current.addImage('shape-recreation-speelbos', createShapeIcon('diamond', '#166534', 24)) // Dark green diamond for speelbossen (nature play)

        // Education shapes (all purple) - size indicates level
        map.current.addImage('shape-education-primary', createShapeIcon('circle', colors.education, 16))
        map.current.addImage('shape-education-secondary', createShapeIcon('circle', colors.education, 18))
        map.current.addImage('shape-education-mbo', createShapeIcon('square', colors.education, 18))
        map.current.addImage('shape-education-hbo', createShapeIcon('diamond', colors.education, 20))
        map.current.addImage('shape-education-university', createShapeIcon('triangle', colors.education, 22))
        map.current.addImage('shape-education-special', createShapeIcon('plus', colors.education, 18))

        console.log('✅ Shape icons added for unified map styling')
      }

      addShapeIcons()

      // Refetch data when map stops moving (debounced with bounds threshold)
      let moveTimeout: NodeJS.Timeout | null = null
      map.current!.on('moveend', () => {
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
          const currentBounds = map.current?.getBounds()
          if (currentBounds && boundsChangedSignificantly(currentBounds)) {
            // Update last fetched bounds
            lastFetchedBoundsRef.current = {
              sw: [currentBounds.getWest(), currentBounds.getSouth()],
              ne: [currentBounds.getEast(), currentBounds.getNorth()]
            }
            setMapBoundsVersion(v => v + 1)
          }
        }, 800) // Debounce 800ms (increased from 300ms)
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

      // Education layers - using symbol layers with geometric shapes
      // All purple color, different shapes for each type (matches legend)
      map.current!.addLayer({
        id: 'primary-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'primary'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-primary',
          'icon-size': 1,
          'icon-allow-overlap': true,
        },
      })

      map.current!.addLayer({
        id: 'secondary-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'secondary'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-secondary',
          'icon-size': 1,
          'icon-allow-overlap': true,
        },
      })

      map.current!.addLayer({
        id: 'special-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'special'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-special',
          'icon-size': 1,
          'icon-allow-overlap': true,
        },
      })

      map.current!.addLayer({
        id: 'mbo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'mbo'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-mbo',
          'icon-size': 1,
          'icon-allow-overlap': true,
        },
      })

      map.current!.addLayer({
        id: 'hbo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'hbo'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-hbo',
          'icon-size': 1,
          'icon-allow-overlap': true,
        },
      })

      map.current!.addLayer({
        id: 'wo-schools',
        type: 'symbol',
        source: 'schools',
        filter: ['==', ['get', 'type'], 'wo'],
        layout: {
          'visibility': 'none',
          'icon-image': 'shape-education-university',
          'icon-size': 1,
          'icon-allow-overlap': true,
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
          if (type === 'primary') return '🎒'  // Primary education
          if (type === 'secondary') return '🎓'  // Secondary education
          if (type === 'special') return '🏫'  // Special education
          if (type === 'mbo') return '🔧'  // Vocational education
          if (type === 'hbo') return '🏢'  // Universities of Applied Sciences
          if (type === 'wo') return '🏛️'  // Research Universities
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

      // Healthcare layers - unified blue color, different shapes
      // Doctors: circle, Pharmacy: plus, Hospital: cross (red), Clinic: diamond
      map.current!.addLayer({
        id: 'healthcare-doctors',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'doctors'],
        layout: {
          'icon-image': 'shape-healthcare-doctor',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      map.current!.addLayer({
        id: 'healthcare-pharmacy',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'pharmacy'],
        layout: {
          'icon-image': 'shape-healthcare-pharmacy',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      map.current!.addLayer({
        id: 'healthcare-hospital',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'hospital'],
        layout: {
          'icon-image': 'shape-healthcare-hospital',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      map.current!.addLayer({
        id: 'healthcare-clinic',
        type: 'symbol',
        source: 'healthcare',
        filter: ['==', 'type', 'clinic'],
        layout: {
          'icon-image': 'shape-healthcare-clinic',
          'icon-allow-overlap': true,
          'icon-size': 1,
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

      // Supermarkets - orange square (shopping category)
      map.current!.addLayer({
        id: 'supermarkets-layer',
        type: 'symbol',
        source: 'supermarkets',
        layout: {
          'icon-image': 'shape-shopping-supermarket',
          'icon-allow-overlap': true,
          'icon-size': 1,
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

      // Playgrounds - green triangle (recreation category) - only regular playgrounds
      map.current!.addLayer({
        id: 'playgrounds-layer',
        type: 'symbol',
        source: 'playgrounds',
        filter: ['!=', ['get', 'type'], 'speelnatuur'],  // Exclude speelnatuur
        minzoom: 10,  // Show from zoom level 10
        layout: {
          'icon-image': 'shape-recreation-playground',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            10, 0.8,
            14, 1.2,
            18, 1.5
          ],
        },
      })

      // Add label layer for playgrounds (show names at higher zoom)
      map.current!.addLayer({
        id: 'playgrounds-labels',
        type: 'symbol',
        source: 'playgrounds',
        filter: ['!=', ['get', 'type'], 'speelnatuur'],  // Exclude speelnatuur
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#16a34a',  // Green to match recreation category
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
        minzoom: 14,
      })

      // Speelbossen (nature play forests) - dark green diamond - Staatsbosbeheer speelnatuur
      map.current!.addLayer({
        id: 'speelbossen-layer',
        type: 'symbol',
        source: 'playgrounds',  // Same source, different filter
        filter: ['==', ['get', 'type'], 'speelnatuur'],  // Only speelnatuur
        minzoom: 8,  // Show from further out since they're larger destinations
        layout: {
          'icon-image': 'shape-recreation-speelbos',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.7,
            12, 1.0,
            16, 1.3
          ],
          'visibility': 'none',  // Hidden by default
        },
      })

      // Add label layer for speelbossen (show names at higher zoom)
      map.current!.addLayer({
        id: 'speelbossen-labels',
        type: 'symbol',
        source: 'playgrounds',
        filter: ['==', ['get', 'type'], 'speelnatuur'],  // Only speelnatuur
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
          'visibility': 'none',  // Hidden by default
        },
        paint: {
          'text-color': '#166534',  // Dark green to match speelbos icon
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
        minzoom: 12,
      })

      // Add source for train stations
      map.current!.addSource('train-stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Transport layers - unified slate color, different shapes
      // Train: square, Metro: circle, Tram: triangle
      map.current!.addLayer({
        id: 'train-stations-layer',
        type: 'symbol',
        source: 'train-stations',
        layout: {
          'icon-image': 'shape-transport-train',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      // Add label layer for train stations
      map.current!.addLayer({
        id: 'train-stations-labels',
        type: 'symbol',
        source: 'train-stations',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#475569',  // Slate to match transport category
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
        minzoom: 11,
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

      // Add source for metro stations
      map.current!.addSource('metro-stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Metro stations - slate circle
      map.current!.addLayer({
        id: 'metro-stations-layer',
        type: 'symbol',
        source: 'metro-stations',
        layout: {
          'icon-image': 'shape-transport-metro',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      // Add label layer for metro stations
      map.current!.addLayer({
        id: 'metro-stations-labels',
        type: 'symbol',
        source: 'metro-stations',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#475569',  // Slate to match transport category
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
        minzoom: 13,
      })

      // Metro station click handler
      map.current!.on('click', 'metro-stations-layer', (e) => {
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
                🚇 ${props.name}
              </div>
              ${props.operator ? `<div style="font-size: 12px; color: #666;">
                ${props.operator}
              </div>` : ''}
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'metro-stations-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'metro-stations-layer', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Add source for tram stops
      map.current!.addSource('tram-stops', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Tram stops - slate triangle
      map.current!.addLayer({
        id: 'tram-stops-layer',
        type: 'symbol',
        source: 'tram-stops',
        layout: {
          'icon-image': 'shape-transport-tram',
          'icon-allow-overlap': true,
          'icon-size': 1,
        },
      })

      // Add label layer for tram stops
      map.current!.addLayer({
        id: 'tram-stops-labels',
        type: 'symbol',
        source: 'tram-stops',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#475569',  // Slate to match transport category
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
        minzoom: 14,
      })

      // Tram stop click handler
      map.current!.on('click', 'tram-stops-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        const coordinates = (feature.geometry as any).coordinates
        const operators = typeof props.operators === 'string' ? JSON.parse(props.operators) : props.operators
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="padding: 12px; min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                🚊 ${props.name}
              </div>
              <div style="font-size: 12px; color: #666;">
                ${operators?.join(', ') || 'Tram'}
              </div>
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'tram-stops-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'tram-stops-layer', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Add source for tram lines (LineStrings)
      map.current!.addSource('tram-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Tram lines layer - colored by line
      map.current!.addLayer({
        id: 'tram-lines-layer',
        type: 'line',
        source: 'tram-lines',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.8,
        },
      }, 'tram-stops-layer')  // Insert below tram stops so stops are on top

      // Tram line labels
      map.current!.addLayer({
        id: 'tram-lines-labels',
        type: 'symbol',
        source: 'tram-lines',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'line_name'],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'symbol-spacing': 200,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
        minzoom: 12,
      })

      // Tram line click handler
      map.current!.on('click', 'tram-lines-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        new maplibregl.Popup({ offset: 15 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="padding: 12px; min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: ${props.color}; color: ${props.text_color || '#fff'}; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 14px;">
                  ${props.line_name}
                </span>
                <span style="font-weight: 600; font-size: 13px;">🚊 Tram</span>
              </div>
              <div style="font-size: 12px; color: #666;">
                ${props.line_long_name || ''}
              </div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">
                ${props.operator}
              </div>
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'tram-lines-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'tram-lines-layer', () => {
        map.current!.getCanvas().style.cursor = ''
      })

      // Add source for metro lines (LineStrings)
      map.current!.addSource('metro-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Metro lines layer - colored by line with thicker width
      map.current!.addLayer({
        id: 'metro-lines-layer',
        type: 'line',
        source: 'metro-lines',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.85,
        },
      }, 'metro-stations-layer')  // Insert below metro stations

      // Metro line labels
      map.current!.addLayer({
        id: 'metro-lines-labels',
        type: 'symbol',
        source: 'metro-lines',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'line_name'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'symbol-spacing': 250,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
        minzoom: 11,
      })

      // Metro line click handler
      map.current!.on('click', 'metro-lines-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const props = feature.properties
        if (!props) return

        new maplibregl.Popup({ offset: 15 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="padding: 12px; min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: ${props.color}; color: ${props.text_color || '#fff'}; padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 14px;">
                  ${props.line_name}
                </span>
                <span style="font-weight: 600; font-size: 13px;">🚇 Metro</span>
              </div>
              <div style="font-size: 12px; color: #666;">
                ${props.line_long_name || ''}
              </div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">
                ${props.operator}
              </div>
            </div>`
          )
          .addTo(map.current!)
      })

      map.current!.on('mouseenter', 'metro-lines-layer', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'metro-lines-layer', () => {
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
        // Create new marker with pin-style design for better visibility
        const el = document.createElement('div')
        el.className = 'destination-marker'
        el.style.width = '40px'
        el.style.height = '50px'
        el.style.position = 'relative'
        el.style.cursor = 'pointer'
        el.style.transition = 'transform 0.2s'

        // Pin marker SVG - red with white border, very visible
        el.innerHTML = `
          <svg viewBox="0 0 40 50" width="40" height="50" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
            <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="#dc2626" stroke="white" stroke-width="2"/>
            <circle cx="20" cy="18" r="8" fill="white"/>
            <text x="20" y="22" text-anchor="middle" fill="#dc2626" font-size="12" font-weight="bold">${index + 1}</text>
          </svg>
        `

        // Hover effect
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.15) translateY(-5px)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
        })

        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(dest.coordinates)
          .addTo(map.current!)

        markers.current.set(dest.id, marker)
      }
      // Don't update position if marker already exists - keep it static

      // Update popup with cleaner content
      const travelInfo = dest.maxMinutes > 0
        ? `<div style="font-size: 11px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
            <span style="color: #3b82f6;">⏱️</span> Max ${dest.maxMinutes} min •
            ${dest.modes.includes('bike') ? '🚴' : ''}
            ${dest.modes.includes('pt') ? '🚊' : ''}
            ${dest.modes.includes('both') ? '🚴+🚊' : ''}
          </div>`
        : ''

      marker.setPopup(
        new maplibregl.Popup({ offset: [0, -40], closeButton: true }).setHTML(
          `<div style="padding: 12px; min-width: 220px;">
            <div style="font-weight: 600; font-size: 15px; color: #dc2626; margin-bottom: 6px;">📍 ${dest.label}</div>
            <div style="font-size: 13px; color: #333; line-height: 1.4;">${dest.address}</div>
            ${travelInfo}
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

  // Consolidated parallel data fetching for all POI layers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Determine which layers need fetching
    const layersToFetch: string[] = []
    if (showSchools) layersToFetch.push('schools')
    if (showHealthcare) layersToFetch.push('healthcare')
    if (showSupermarkets) layersToFetch.push('supermarkets')
    if (showPlaygrounds || showSpeelbossen) layersToFetch.push('playgrounds')  // Both use same data source
    if (showTrainStations) layersToFetch.push('train-stations')
    if (showMetroStations) layersToFetch.push('metro-stations')
    if (showTramStops) layersToFetch.push('tram-stops')
    if (showTramLines) layersToFetch.push('tram-lines')
    if (showMetroLines) layersToFetch.push('metro-lines')

    if (layersToFetch.length === 0) return

    // Create abort controller for this batch
    const controller = createAbortController('poi-batch')

    const bounds = map.current.getBounds()
    const boundsKey = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
      limit: '500'
    })
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

    console.log(`🚀 Parallel fetching ${layersToFetch.length} layers...`)
    setSchoolsLoading(layersToFetch.includes('schools'))
    setAmenitiesLoading(layersToFetch.some(l => ['healthcare', 'supermarkets', 'playgrounds'].includes(l)))

    // Build fetch promises based on enabled layers
    const fetchPromises: Promise<{ layer: string; data: any }>[] = []

    if (showSchools) {
      const cached = getCachedData('schools', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'schools', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/schools?${params}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('schools', data, boundsKey)
              return { layer: 'schools', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Schools fetch error:', err)
              return { layer: 'schools', data: null }
            })
        )
      }
    }

    if (showHealthcare) {
      const cached = getCachedData('healthcare', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'healthcare', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/healthcare?${params.toString()}&limit=1000`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('healthcare', data, boundsKey)
              return { layer: 'healthcare', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Healthcare fetch error:', err)
              return { layer: 'healthcare', data: null }
            })
        )
      }
    }

    if (showSupermarkets) {
      const cached = getCachedData('supermarkets', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'supermarkets', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/supermarkets?${params.toString()}&limit=1000`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('supermarkets', data, boundsKey)
              return { layer: 'supermarkets', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Supermarkets fetch error:', err)
              return { layer: 'supermarkets', data: null }
            })
        )
      }
    }

    if (showPlaygrounds) {
      const cached = getCachedData('playgrounds', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'playgrounds', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/playgrounds?${params.toString()}&limit=1000`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('playgrounds', data, boundsKey)
              return { layer: 'playgrounds', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Playgrounds fetch error:', err)
              return { layer: 'playgrounds', data: null }
            })
        )
      }
    }

    if (showTrainStations) {
      const cached = getCachedData('train-stations', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'train-stations', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/train-stations?${params.toString()}&type=train`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('train-stations', data, boundsKey)
              return { layer: 'train-stations', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Train stations fetch error:', err)
              return { layer: 'train-stations', data: null }
            })
        )
      }
    }

    if (showMetroStations) {
      const cached = getCachedData('metro-stations', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'metro-stations', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/tram-metro?type=metro&bbox=${bbox}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('metro-stations', data, boundsKey)
              return { layer: 'metro-stations', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Metro stations fetch error:', err)
              return { layer: 'metro-stations', data: null }
            })
        )
      }
    }

    if (showTramStops) {
      const cached = getCachedData('tram-stops', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'tram-stops', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/tram-metro?type=tram&bbox=${bbox}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('tram-stops', data, boundsKey)
              return { layer: 'tram-stops', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Tram stops fetch error:', err)
              return { layer: 'tram-stops', data: null }
            })
        )
      }
    }

    if (showTramLines) {
      const cached = getCachedData('tram-lines', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'tram-lines', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/tram-lines?type=tram&bbox=${bbox}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('tram-lines', data, boundsKey)
              return { layer: 'tram-lines', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Tram lines fetch error:', err)
              return { layer: 'tram-lines', data: null }
            })
        )
      }
    }

    if (showMetroLines) {
      const cached = getCachedData('metro-lines', boundsKey)
      if (cached) {
        fetchPromises.push(Promise.resolve({ layer: 'metro-lines', data: cached }))
      } else {
        fetchPromises.push(
          fetch(`/api/tram-lines?type=metro&bbox=${bbox}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
              if (data.success) setCachedData('metro-lines', data, boundsKey)
              return { layer: 'metro-lines', data }
            })
            .catch(err => {
              if (err.name !== 'AbortError') console.error('❌ Metro lines fetch error:', err)
              return { layer: 'metro-lines', data: null }
            })
        )
      }
    }

    // Execute all fetches in parallel
    Promise.all(fetchPromises).then(results => {
      console.log(`✅ Parallel fetch complete: ${results.filter(r => r.data).length}/${results.length} successful`)

      results.forEach(({ layer, data }) => {
        if (!data || !data.success) return

        switch (layer) {
          case 'schools': {
            const features = data.schools.map((school: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [school.coordinates.lng, school.coordinates.lat] },
              properties: {
                id: school.id, name: school.name, type: school.type, typeLabel: school.typeLabel,
                address: school.address, postalCode: school.postalCode, city: school.city,
                municipality: school.municipality, denomination: school.denomination || 'N/A',
                phone: school.phone, website: school.website
              }
            }))
            const source = map.current?.getSource('schools') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'FeatureCollection', features })
            break
          }
          case 'healthcare': {
            setHealthcareData(data.healthcare)
            const features = data.healthcare.map((f: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [f.coordinates.lng, f.coordinates.lat] },
              properties: { id: f.id, name: f.name, type: f.type, typeLabel: f.type, address: f.address, phone: f.phone, website: f.website }
            }))
            const source = map.current?.getSource('healthcare') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'FeatureCollection', features })
            break
          }
          case 'supermarkets': {
            setSupermarketsData(data.supermarkets)
            const features = data.supermarkets.map((s: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.coordinates.lng, s.coordinates.lat] },
              properties: { id: s.id, name: s.name, brand: s.brand, address: s.address, openingHours: s.openingHours }
            }))
            const source = map.current?.getSource('supermarkets') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'FeatureCollection', features })
            break
          }
          case 'playgrounds': {
            setPlaygroundsData(data.playgrounds)
            const features = data.playgrounds.map((p: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [p.coordinates.lng, p.coordinates.lat] },
              properties: { id: p.id, name: p.name, type: p.type, address: p.address, city: p.city, operator: p.operator }
            }))
            const source = map.current?.getSource('playgrounds') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'FeatureCollection', features })
            break
          }
          case 'train-stations': {
            setTrainStationsData(data.stations)
            const features = data.stations.map((s: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.coordinates.lng, s.coordinates.lat] },
              properties: { name: s.name, operator: s.operator, station_code: s.stationCode, railway_type: s.type }
            }))
            const source = map.current?.getSource('train-stations') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'FeatureCollection', features })
            break
          }
          case 'metro-stations': {
            setMetroStationsData(data.geojson.features)
            const source = map.current?.getSource('metro-stations') as maplibregl.GeoJSONSource
            if (source) source.setData(data.geojson)
            break
          }
          case 'tram-stops': {
            setTramStopsData(data.geojson.features)
            const source = map.current?.getSource('tram-stops') as maplibregl.GeoJSONSource
            if (source) source.setData(data.geojson)
            break
          }
          case 'tram-lines': {
            setTramLinesData(data.geojson)
            const source = map.current?.getSource('tram-lines') as maplibregl.GeoJSONSource
            if (source) source.setData(data.geojson)
            break
          }
          case 'metro-lines': {
            setMetroLinesData(data.geojson)
            const source = map.current?.getSource('metro-lines') as maplibregl.GeoJSONSource
            if (source) source.setData(data.geojson)
            break
          }
        }
      })

      setSchoolsLoading(false)
      setAmenitiesLoading(false)
    })

    return () => {
      controller.abort()
    }
  }, [mapLoaded, showSchools, showHealthcare, showSupermarkets, showPlaygrounds, showSpeelbossen, showTrainStations, showMetroStations, showTramStops, showTramLines, showMetroLines, mapBoundsVersion])

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
    ]

    layers.forEach(({ id, visible }) => {
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      }
    })
  }, [mapLoaded, showPrimarySchools, showSecondarySchools, showSpecialSchools, showMboSchools, showHboSchools, showWoSchools])

  // Clear layer data when toggled off (fetching handled by consolidated useEffect)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Toggle visibility for both the fetched healthcare layers and snapshot amenities layer
    if (map.current.getLayer('amenities-healthcare')) {
      map.current.setLayoutProperty('amenities-healthcare', 'visibility', showHealthcare ? 'visible' : 'none')
    }

    if (!showHealthcare) {
      const source = map.current.getSource('healthcare') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showHealthcare])

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Toggle visibility for snapshot amenities layer
    if (map.current.getLayer('amenities-supermarkets')) {
      map.current.setLayoutProperty('amenities-supermarkets', 'visibility', showSupermarkets ? 'visible' : 'none')
    }

    if (!showSupermarkets) {
      const source = map.current.getSource('supermarkets') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showSupermarkets])

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Toggle visibility for snapshot amenities layers (playgrounds and parks)
    if (map.current.getLayer('amenities-playgrounds')) {
      map.current.setLayoutProperty('amenities-playgrounds', 'visibility', showPlaygrounds ? 'visible' : 'none')
    }
    if (map.current.getLayer('amenities-parks')) {
      map.current.setLayoutProperty('amenities-parks', 'visibility', showPlaygrounds ? 'visible' : 'none')
    }

    if (!showPlaygrounds) {
      const source = map.current.getSource('playgrounds') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showPlaygrounds])

  // Toggle speelbossen (nature play forests) visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Toggle visibility for speelbossen layers
    if (map.current.getLayer('speelbossen-layer')) {
      map.current.setLayoutProperty('speelbossen-layer', 'visibility', showSpeelbossen ? 'visible' : 'none')
    }
    if (map.current.getLayer('speelbossen-labels')) {
      map.current.setLayoutProperty('speelbossen-labels', 'visibility', showSpeelbossen ? 'visible' : 'none')
    }
  }, [mapLoaded, showSpeelbossen])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!showTrainStations) {
      const source = map.current.getSource('train-stations') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showTrainStations])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!showMetroStations) {
      const source = map.current.getSource('metro-stations') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showMetroStations])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!showTramStops) {
      const source = map.current.getSource('tram-stops') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showTramStops])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!showTramLines) {
      const source = map.current.getSource('tram-lines') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showTramLines])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!showMetroLines) {
      const source = map.current.getSource('metro-lines') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapLoaded, showMetroLines])

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

      // Add layers for different amenity types using colored circles
      // Supermarkets - Green circle (hidden by default)
      map.current.addLayer({
        id: 'amenities-supermarkets',
        type: 'circle',
        source: 'amenities',
        filter: ['==', 'type', 'supermarket'],
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': 10,
          'circle-color': '#16a34a',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Healthcare - Red circle (hidden by default, shown when toggle enabled)
      map.current.addLayer({
        id: 'amenities-healthcare',
        type: 'circle',
        source: 'amenities',
        filter: ['==', 'type', 'healthcare'],
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': 10,
          'circle-color': '#dc2626',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Playgrounds - Yellow circle (hidden by default)
      map.current.addLayer({
        id: 'amenities-playgrounds',
        type: 'circle',
        source: 'amenities',
        filter: ['==', 'type', 'playground'],
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': 8,
          'circle-color': '#eab308',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Parks - Green circle (darker, hidden by default - shown with playgrounds)
      map.current.addLayer({
        id: 'amenities-parks',
        type: 'circle',
        source: 'amenities',
        filter: ['==', 'type', 'park'],
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': 8,
          'circle-color': '#15803d',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
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

  // Load crime overlay data from backend
  useEffect(() => {
    if (!showCrimeOverlay) return

    console.log('🔍 Fetching crime overlay data from backend...', BACKEND_URL)
    setCrimeLoading(true)
    fetch(`${BACKEND_URL}/api/map-overlays/crime`)
      .then(res => {
        console.log('Crime API response status:', res.status)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (data.success && data.features) {
          console.log('✅ Crime data loaded:', data.count, 'neighborhoods, first feature:', data.features[0]?.properties)
          setCrimeData(data.features)
        } else {
          console.error('❌ Crime data fetch failed - unexpected format:', data)
        }
      })
      .catch(err => console.error('❌ Error loading crime data:', err.message, err))
      .finally(() => setCrimeLoading(false))
  }, [showCrimeOverlay])

  // Add crime overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showCrimeOverlay && crimeData.length > 0) {
      console.log('🗺️ Adding crime overlay to map with', crimeData.length, 'features')
      console.log('Sample crime feature geometry type:', crimeData[0]?.geometry?.type)

      // Add source and layers if they don't exist
      if (!map.current.getSource('crime-overlay')) {
        // Add GeoJSON source - crime data now has polygon geometries
        map.current.addSource('crime-overlay', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: crimeData
          }
        })

        // Find a good insertion point (after base layers but before amenities)
        const layers = map.current.getStyle().layers
        let insertBeforeId: string | undefined
        for (const layer of layers) {
          if (layer.id.startsWith('healthcare-') || layer.id.startsWith('supermarkets') ||
              layer.id.startsWith('playgrounds') || layer.id.startsWith('train-stations') ||
              layer.id.startsWith('primary-') || layer.id.startsWith('secondary-')) {
            insertBeforeId = layer.id
            break
          }
        }

        // Add fill layer with color based on crime count
        map.current.addLayer({
          id: 'crime-fill',
          type: 'fill',
          source: 'crime-overlay',
          paint: {
            'fill-color': ['interpolate', ['linear'], ['get', 'crime_count'],
              0, '#dbeafe',
              10, '#93c5fd',
              50, '#3b82f6',
              100, '#1e40af',
              500, '#1e3a8a'
            ],
            'fill-opacity': 0.5
          }
        }, insertBeforeId)

        // Add outline layer
        map.current.addLayer({
          id: 'crime-outline',
          type: 'line',
          source: 'crime-overlay',
          paint: {
            'line-color': '#1e3a8a',
            'line-width': 1,
            'line-opacity': 0.7
          }
        }, insertBeforeId)

        // Add event handlers with proper tracking for cleanup
        const crimeClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${props.area_name}</div>
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Total Crimes: <strong>${props.crime_count}</strong></div>
              <div style="font-size: 12px; color: #999;">Area: ${props.area_code} | Year: ${props.year}</div>
              <div style="font-size: 11px; margin-top: 4px; color: #666;">${props.municipality}</div>
            </div>`)
            .addTo(map.current!)
        }

        const crimeMouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
        const crimeMouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

        safeAddEventListener('crime', 'crime-fill', 'click', crimeClickHandler)
        safeAddEventListener('crime', 'crime-fill', 'mouseenter', crimeMouseEnter)
        safeAddEventListener('crime', 'crime-fill', 'mouseleave', crimeMouseLeave)
      }
    } else {
      // Remove layers and event listeners when overlay is turned off
      console.log('🗺️ Removing crime overlay from map')
      cleanupOverlay('crime', ['crime-outline', 'crime-fill'], 'crime-overlay')
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanupOverlay('crime', ['crime-outline', 'crime-fill'], 'crime-overlay')
    }
  }, [mapLoaded, showCrimeOverlay, crimeData])

  // Add RIVM air quality WMS overlay
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'rivm-air-quality-wms'
    const layerId = 'rivm-air-quality-layer'

    if (showAirQualityOverlay) {
      console.log(`🗺️ Adding RIVM air quality WMS layer (${airQualityPollutant}, year: ${airQualityYear})`)

      // Layer mapping for Atlas Leefomgeving WMS (data.rivm.nl)
      // Verified layer names from WMS GetCapabilities - 2019-2023 plus current
      const getLayerName = (pollutant: string, year: string): string => {
        if (year === 'current') {
          // Use the "actueel" (current/latest) layers - these are official RIVM layer names
          const currentLayers: Record<string, string> = {
            'NO2': 'rivm_jaargemiddeld_NO2_actueel',
            'PM10': 'rivm_jaargemiddeld_PM10_actueel',
            'PM25': 'rivm_jaargemiddeld_PM25_actueel'
          }
          return currentLayers[pollutant]
        }

        // Historical year layers - VERIFIED from RIVM WMS GetCapabilities
        // Format: rivm_nsl_YYYYMMDD_gm_POLLUTANTYEAR (exact layer names)
        const yearLayerMap: Record<string, Record<string, string>> = {
          '2023': {
            'NO2': 'rivm_nsl_20250401_gm_NO22023',
            'PM10': 'rivm_nsl_20250401_gm_PM102023',
            'PM25': 'rivm_nsl_20250401_gm_PM252023'
          },
          '2022': {
            'NO2': 'rivm_nsl_20240401_gm_NO22022',
            'PM10': 'rivm_nsl_20240401_gm_PM102022',
            'PM25': 'rivm_nsl_20240401_gm_PM252022'
          },
          '2021': {
            'NO2': 'rivm_nsl_20230101_gm_NO22021',
            'PM10': 'rivm_nsl_20230101_gm_PM102021',
            'PM25': 'rivm_nsl_20230101_gm_PM252021'
          },
          '2020': {
            // Note: These have '_Int' suffix versions too, using base names
            'NO2': 'rivm_nsl_20220101_gm_NO22020',
            'PM10': 'rivm_nsl_20220101_gm_PM102020',
            'PM25': 'rivm_nsl_20220101_gm_PM252020'
          },
          '2019': {
            'NO2': 'rivm_nsl_20210101_gm_NO22019',
            'PM10': 'rivm_nsl_20210101_gm_PM102019',
            'PM25': 'rivm_nsl_20210101_gm_PM252019'
          }
        }

        return yearLayerMap[year]?.[pollutant] || 'rivm_jaargemiddeld_NO2_actueel'
      }

      const wmsLayer = getLayerName(airQualityPollutant, airQualityYear)

      // Remove existing layer if pollutant changed - use safe removal
      safeRemoveLayer(layerId, sourceId)

      // Add new source - using Atlas Leefomgeving WMS via Next.js proxy to avoid CORS issues
      const wmsUrl = `https://data.rivm.nl/geo/alo/wms`
      const tileUrl = `/api/wms-proxy?url=${encodeURIComponent(wmsUrl)}&service=WMS&version=1.1.1&request=GetMap&layers=${wmsLayer}&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true`

      const sourceAdded = safeAddSource(sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256
      })

      if (sourceAdded) {
        // Add layer - insert before isochrones if they exist, otherwise just add
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined
        safeAddLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': 0.6
          }
        }, beforeLayerId)
      }
    } else {
      // Remove layer and source when toggled off - use safe removal
      console.log('🗺️ Removing RIVM air quality WMS layer')
      safeRemoveLayer(layerId, sourceId)
    }

    // Cleanup on unmount
    return () => {
      safeRemoveLayer('rivm-air-quality-layer', 'rivm-air-quality-wms')
    }
  }, [mapLoaded, showAirQualityOverlay, airQualityPollutant, airQualityYear])

  // Fetch and display real-time air quality stations from Luchtmeetnet with auto-refresh
  useEffect(() => {
    if (!showAirQualityRealtimeOverlay) {
      setAirQualityRealtimeData([])
      return
    }

    const fetchAirQualityData = () => {
      console.log('🌬️ Fetching real-time air quality data from Luchtmeetnet...')
      fetch('/api/air-quality/realtime')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log(`✅ Real-time air quality data loaded: ${data.data.length} stations${data.cached ? ' (cached)' : ''}`)
            setAirQualityRealtimeData(data.data)
          } else {
            console.error('❌ Real-time air quality fetch failed:', data.error)
          }
        })
        .catch(err => console.error('❌ Error loading real-time air quality:', err))
    }

    // Fetch immediately
    fetchAirQualityData()

    // Refresh every 5 minutes (API caches for 5 minutes)
    const intervalId = setInterval(fetchAirQualityData, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [showAirQualityRealtimeOverlay])

  // Add real-time air quality stations to map as markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'air-quality-realtime-stations'
    const layerId = 'air-quality-realtime-points'
    const labelLayerId = 'air-quality-realtime-labels'

    if (showAirQualityRealtimeOverlay && airQualityRealtimeData.length > 0) {
      console.log('🗺️ Adding real-time air quality stations to map')

      // Convert to GeoJSON
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: airQualityRealtimeData
          .filter(s => s.coordinates && s.coordinates.length === 2)
          .map(station => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: station.coordinates
            },
            properties: {
              number: station.number,
              location: station.location,
              municipality: station.municipality || 'Unknown',
              type: station.type || 'Unknown',
              NO2: station.measurements?.NO2 ?? null,
              PM10: station.measurements?.PM10 ?? null,
              PM25: station.measurements?.PM25 ?? null,
              O3: station.measurements?.O3 ?? null,
              lki: station.lki ?? null,
              lki_label: station.lki_label || 'Unknown',
              timestamp: station.measurements?.timestamp || null
            }
          }))
      }

      // Remove existing layers
      safeRemoveLayer(labelLayerId, undefined)
      safeRemoveLayer(layerId, sourceId)

      // Add source
      const sourceAdded = safeAddSource(sourceId, {
        type: 'geojson',
        data: geojson
      })

      if (sourceAdded) {
        // Color based on LKI (Air Quality Index): 1-3 = good, 4-6 = moderate, 7-8 = unhealthy sensitive, 9-10 = unhealthy, 11+ = very unhealthy
        safeAddLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 10,
            'circle-color': [
              'case',
              ['==', ['get', 'lki'], null], '#808080', // Gray for no data
              ['<=', ['get', 'lki'], 3], '#4ade80', // Green for good
              ['<=', ['get', 'lki'], 6], '#facc15', // Yellow for moderate
              ['<=', ['get', 'lki'], 8], '#fb923c', // Orange for unhealthy for sensitive
              ['<=', ['get', 'lki'], 10], '#ef4444', // Red for unhealthy
              '#7c2d12' // Dark red for very unhealthy
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        })

        // Add labels showing LKI value
        safeAddLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['coalesce', ['to-string', ['get', 'lki']], '-'],
            'text-size': 10,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.5)',
            'text-halo-width': 0.5
          }
        })

        // Add click popup for station details
        map.current.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates

          const measurements = []
          if (props.NO2 !== null) measurements.push(`NO₂: ${props.NO2} µg/m³`)
          if (props.PM10 !== null) measurements.push(`PM10: ${props.PM10} µg/m³`)
          if (props.PM25 !== null) measurements.push(`PM2.5: ${props.PM25} µg/m³`)
          if (props.O3 !== null) measurements.push(`O₃: ${props.O3} µg/m³`)

          const lkiDisplay = props.lki !== null ? `<strong>LKI: ${props.lki}</strong> (${props.lki_label})` : 'LKI: No data'

          new maplibregl.Popup()
            .setLngLat(coords as [number, number])
            .setHTML(`
              <div style="font-size: 12px; max-width: 200px;">
                <strong>${props.location}</strong><br/>
                <span style="color: #666;">${props.municipality}</span><br/>
                <hr style="margin: 4px 0;"/>
                ${lkiDisplay}<br/>
                ${measurements.length > 0 ? measurements.join('<br/>') : 'No measurements available'}
                ${props.timestamp ? `<br/><span style="color: #999; font-size: 10px;">Updated: ${new Date(props.timestamp).toLocaleString()}</span>` : ''}
              </div>
            `)
            .addTo(map.current!)
        })

        // Change cursor on hover
        map.current.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = ''
        })
      }
    } else {
      // Remove when toggled off
      console.log('🗺️ Removing real-time air quality stations from map')
      safeRemoveLayer(labelLayerId, undefined)
      safeRemoveLayer(layerId, sourceId)
    }

    return () => {
      safeRemoveLayer('air-quality-realtime-labels', undefined)
      safeRemoveLayer('air-quality-realtime-points', 'air-quality-realtime-stations')
    }
  }, [mapLoaded, showAirQualityRealtimeOverlay, airQualityRealtimeData])

  // Add foundation risk overlay to map (using WMS from Klimaateffectatlas - bodemdaling/subsidence data)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // WMS URL for subsidence/foundation risk from Klimaateffectatlas
    // bodemdaling_2020_2050hoog shows expected subsidence 2020-2050 (high scenario)
    const wmsUrl = 'https://cas.cloud.sogelink.com/public/data/org/gws/YWFMLMWERURF/kea_public/wms'
    const wmsLayer = 'bodemdaling_2020_2050hoog'

    if (showFoundationRiskOverlay) {
      console.log('🗺️ Adding foundation risk (subsidence) WMS overlay to map')

      // Add WMS raster source if it doesn't exist
      if (!map.current.getSource('foundation-risk-wms')) {
        map.current.addSource('foundation-risk-wms', {
          type: 'raster',
          tiles: [
            `${wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${wmsLayer}&styles=&format=image/png&transparent=true&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}`
          ],
          tileSize: 256,
          attribution: '© Klimaateffectatlas - Bodemdaling (subsidence) data'
        })

        // Find insertion point (before amenity layers)
        const layers = map.current.getStyle().layers
        let insertBeforeId: string | undefined
        for (const layer of layers) {
          if (layer.id.startsWith('healthcare-') || layer.id.startsWith('supermarkets') ||
              layer.id.startsWith('playgrounds') || layer.id.startsWith('train-stations') ||
              layer.id.startsWith('primary-') || layer.id.startsWith('secondary-')) {
            insertBeforeId = layer.id
            break
          }
        }

        // Add raster layer
        map.current.addLayer({
          id: 'foundation-risk-raster',
          type: 'raster',
          source: 'foundation-risk-wms',
          paint: {
            'raster-opacity': 0.7
          }
        }, insertBeforeId)

        console.log('✅ Foundation risk WMS layer added')
      }
    } else {
      // Remove WMS layer when overlay is turned off
      if (map.current.getLayer('foundation-risk-raster')) {
        console.log('🗺️ Removing foundation risk WMS overlay from map')
        map.current.removeLayer('foundation-risk-raster')
      }
      if (map.current.getSource('foundation-risk-wms')) {
        map.current.removeSource('foundation-risk-wms')
      }
    }

    // Cleanup on unmount
    return () => {
      if (map.current?.getLayer('foundation-risk-raster')) {
        map.current.removeLayer('foundation-risk-raster')
      }
      if (map.current?.getSource('foundation-risk-wms')) {
        map.current.removeSource('foundation-risk-wms')
      }
    }
  }, [mapLoaded, showFoundationRiskOverlay])

  // Unified Flood Risk Layer - combines zone data from PDOK + water depth from Lizard
  useEffect(() => {
    if (!showFloodRisk) return

    console.log(`🌊 Fetching unified flood risk data for scenario ${floodScenario}...`)
    fetch(`/api/map-overlays/flood-combined?scenario=${floodScenario}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Unified flood data loaded:', data.count, 'features')
          setFloodRiskData({
            type: 'FeatureCollection',
            features: data.features
          })
        } else {
          console.error('❌ Unified flood data fetch failed:', data)
        }
      })
      .catch(err => console.error('❌ Error loading unified flood data:', err))
  }, [showFloodRisk, floodScenario])

  // Add unified flood risk overlay to map
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (showFloodRisk && floodRiskData) {
      console.log('🗺️ Adding unified flood risk overlay to map')

      // Clean up existing layers first to handle scenario changes
      cleanupOverlay('flood-risk', ['flood-risk-outline', 'flood-risk-fill'], 'flood-risk-overlay')

      // Add GeoJSON source
      map.current.addSource('flood-risk-overlay', {
        type: 'geojson',
        data: floodRiskData
      })

      // Find insertion point (before amenity markers)
      const layers = map.current.getStyle().layers
      let insertBeforeId: string | undefined
      for (const layer of layers) {
        if (layer.id.startsWith('healthcare-') || layer.id.startsWith('supermarkets') ||
            layer.id.startsWith('playgrounds') || layer.id.startsWith('train-stations') ||
            layer.id.startsWith('primary-') || layer.id.startsWith('secondary-')) {
          insertBeforeId = layer.id
          break
        }
      }

      // Add fill layer with unified risk coloring
      // Colors: red for high risk, amber for medium, blue for low
      map.current.addLayer({
        id: 'flood-risk-fill',
        type: 'fill',
        source: 'flood-risk-overlay',
        paint: {
          'fill-color': [
            'match',
            ['get', 'combined_risk_level'],
            'very_high', '#7c2d12',  // Dark red/brown for critical
            'high', '#dc2626',        // Red
            'medium', '#f59e0b',      // Amber
            'low', '#3b82f6',         // Blue
            'very_low', '#93c5fd',    // Light blue
            '#6b7280'                 // Gray default
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'has_depth_data'], true], 0.65,  // Higher opacity where we have depth data
            0.45  // Lower opacity for zone-only areas
          ]
        }
      }, insertBeforeId)

      // Add outline layer with depth indicator
      map.current.addLayer({
        id: 'flood-risk-outline',
        type: 'line',
        source: 'flood-risk-overlay',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'has_depth_data'], true], '#1e3a8a',  // Dark blue for verified depth
            '#475569'  // Gray for zone-only
          ],
          'line-width': [
            'case',
            ['==', ['get', 'has_depth_data'], true], 2,
            1
          ],
          'line-opacity': 0.8
        }
      }, insertBeforeId)

      // Click handler for flood info popup
      const floodClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
        const features = e.features
        if (!features || features.length === 0) return

        const props = features[0].properties
        const combinedRisk = props.combined_risk_level || 'unknown'
        const zoneRisk = props.zone_risk_level || 'N/A'
        const depthRisk = props.depth_risk_level || 'N/A'
        const hasDepth = props.has_depth_data
        const maxDepth = props.max_water_depth

        // Risk level colors and labels
        const riskColors: Record<string, string> = {
          very_high: '#7c2d12',
          high: '#dc2626',
          medium: '#f59e0b',
          low: '#3b82f6',
          very_low: '#93c5fd',
          unknown: '#6b7280'
        }

        const riskLabels: Record<string, string> = {
          very_high: 'Very High Risk',
          high: 'High Risk',
          medium: 'Medium Risk',
          low: 'Low Risk',
          very_low: 'Very Low Risk',
          unknown: 'Unknown'
        }

        // Human-readable scenario descriptions
        const scenarioLabels: Record<string, string> = {
          t10: 'Common (1x per 10 years)',
          t100: 'Rare (1x per 100 years)',
          t1000: 'Extreme (1x per 1000 years)'
        }
        const scenario = props.scenario || floodScenario
        const scenarioDisplay = scenarioLabels[scenario] || scenario

        new maplibregl.Popup({ closeOnClick: true, maxWidth: '320px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: system-ui, sans-serif; padding: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="background: ${riskColors[combinedRisk]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  🌊 ${riskLabels[combinedRisk]}
                </span>
                ${hasDepth ? '<span style="background: #1e40af; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">💧 Depth Data</span>' : ''}
              </div>

              ${maxDepth ? `<div style="font-size: 13px; margin-bottom: 6px;"><strong>Max Water Level:</strong> ${maxDepth}</div>` : ''}

              <table style="font-size: 11px; width: 100%; border-collapse: collapse;">
                <tr style="background: #f3f4f6;">
                  <td style="padding: 4px;">Zone Risk:</td>
                  <td style="padding: 4px;"><span style="background: ${riskColors[zoneRisk]}; color: white; padding: 1px 4px; border-radius: 2px;">${riskLabels[zoneRisk] || zoneRisk}</span></td>
                </tr>
                ${hasDepth ? `<tr>
                  <td style="padding: 4px;">Depth Risk:</td>
                  <td style="padding: 4px;"><span style="background: ${riskColors[depthRisk]}; color: white; padding: 1px 4px; border-radius: 2px;">${riskLabels[depthRisk] || depthRisk}</span></td>
                </tr>` : ''}
                <tr style="background: #f3f4f6;">
                  <td style="padding: 4px;">Flood frequency:</td>
                  <td style="padding: 4px;">${scenarioDisplay}</td>
                </tr>
              </table>

              <div style="margin-top: 8px; font-size: 10px; color: #6b7280;">
                Sources: PDOK Rijkswaterstaat + Lizard (LIWO)
              </div>
            </div>
          `)
          .addTo(map.current!)
      }

      const floodMouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
      const floodMouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

      safeAddEventListener('flood-risk', 'flood-risk-fill', 'click', floodClickHandler)
      safeAddEventListener('flood-risk', 'flood-risk-fill', 'mouseenter', floodMouseEnter)
      safeAddEventListener('flood-risk', 'flood-risk-fill', 'mouseleave', floodMouseLeave)
    } else {
      console.log('🗺️ Removing unified flood risk overlay from map')
      cleanupOverlay('flood-risk', ['flood-risk-outline', 'flood-risk-fill'], 'flood-risk-overlay')
    }

    return () => {
      cleanupOverlay('flood-risk', ['flood-risk-outline', 'flood-risk-fill'], 'flood-risk-overlay')
    }
  }, [mapLoaded, showFloodRisk, floodRiskData, floodScenario])

  // Load Leefbaarometer data from API
  const [leefbaarometerData, setLeefbaarometerData] = useState<any>(null)

  useEffect(() => {
    if (!showLeefbaarometer) return

    console.log('🔍 Fetching Leefbaarometer overlay data...')
    fetch(`/api/map-overlays/leefbaarometer`)
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

        // Find a good insertion point (after isochrones but before amenities)
        const layers = map.current.getStyle().layers
        let insertBeforeId: string | undefined
        for (const layer of layers) {
          // Insert before any amenity or school layers
          if (layer.id.startsWith('healthcare-') || layer.id.startsWith('supermarkets') ||
              layer.id.startsWith('playgrounds') || layer.id.startsWith('train-stations') ||
              layer.id.startsWith('primary-') || layer.id.startsWith('secondary-')) {
            insertBeforeId = layer.id
            break
          }
        }

        // Add fill layer with color based on score - higher opacity and visibility
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
            'fill-opacity': 0.6
          }
        }, insertBeforeId)

        // Add outline layer with better visibility
        map.current.addLayer({
          id: 'leefbaarometer-outline',
          type: 'line',
          source: 'leefbaarometer-overlay',
          paint: {
            'line-color': '#334155',
            'line-width': 1.5,
            'line-opacity': 0.7
          }
        }, insertBeforeId)

        // Add click handler with proper tracking for cleanup
        const leefbaarometerClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
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

        const leefbaarometerMouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
        const leefbaarometerMouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

        safeAddEventListener('leefbaarometer', 'leefbaarometer-fill', 'click', leefbaarometerClickHandler)
        safeAddEventListener('leefbaarometer', 'leefbaarometer-fill', 'mouseenter', leefbaarometerMouseEnter)
        safeAddEventListener('leefbaarometer', 'leefbaarometer-fill', 'mouseleave', leefbaarometerMouseLeave)
      }
    } else {
      // Remove layers and event listeners when overlay is turned off
      console.log('🗺️ Removing Leefbaarometer overlay from map')
      cleanupOverlay('leefbaarometer', ['leefbaarometer-outline', 'leefbaarometer-fill'], 'leefbaarometer-overlay')
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanupOverlay('leefbaarometer', ['leefbaarometer-outline', 'leefbaarometer-fill'], 'leefbaarometer-overlay')
    }
  }, [mapLoaded, showLeefbaarometer, leefbaarometerData])

  // Add PDOK Cadastral Parcels WMS overlay (switched from vector tiles which were unreliable)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'cadastral-parcels-wms'
    const layerId = 'cadastral-parcels-layer'

    if (showCadastralParcels) {
      console.log('🗺️ Adding cadastral parcels WMS layer')

      // Remove existing layer if it exists
      safeRemoveLayer(layerId, sourceId)

      // PDOK Cadastral Map WMS - shows parcel boundaries and labels
      const wmsUrl = 'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0'

      safeAddSource(sourceId, {
        type: 'raster',
        tiles: [
          `${wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=Kadastralekaart&styles=&format=image/png&transparent=true&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}`
        ],
        tileSize: 256,
        attribution: '© Kadaster'
      })

      // Find the first symbol layer to insert before (so labels stay on top)
      const layers = map.current.getStyle().layers || []
      let insertBeforeId: string | undefined
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          insertBeforeId = layer.id
          break
        }
      }

      map.current.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.85
        },
        minzoom: 15  // Only show at higher zoom levels for performance
      }, insertBeforeId)

      console.log('🗺️ Cadastral parcels WMS layer added (visible at zoom 15+)')

    } else {
      // Remove layer and source when toggled off
      console.log('🗺️ Removing cadastral parcels layer')
      safeRemoveLayer(layerId, sourceId)
    }
  }, [mapLoaded, showCadastralParcels])

  // Toggle between standard and aerial base map (with labels overlay for aerial)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const standardLayer = map.current.getLayer('pdok-background')
    const aerialLayer = map.current.getLayer('pdok-aerial-background')
    const labelsLayer = map.current.getLayer('aerial-labels-overlay')

    if (!standardLayer || !aerialLayer) return

    if (baseMapStyle === 'aerial') {
      console.log('🗺️ Switching to aerial photo base map with labels')
      map.current.setLayoutProperty('pdok-background', 'visibility', 'none')
      map.current.setLayoutProperty('pdok-aerial-background', 'visibility', 'visible')
      // Show labels overlay for navigation when viewing aerial photos
      if (labelsLayer) {
        map.current.setLayoutProperty('aerial-labels-overlay', 'visibility', 'visible')
      }
    } else {
      console.log('🗺️ Switching to standard base map')
      map.current.setLayoutProperty('pdok-background', 'visibility', 'visible')
      map.current.setLayoutProperty('pdok-aerial-background', 'visibility', 'none')
      // Hide labels overlay when not in aerial view
      if (labelsLayer) {
        map.current.setLayoutProperty('aerial-labels-overlay', 'visibility', 'none')
      }
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

        // Add event handlers with proper tracking
        const nationalParksClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return
          new maplibregl.Popup({ offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #15803d;">🌲 ${props.naam}</div>
              <div style="font-size: 12px; color: #666;">Nationaal Park</div>
              <div style="font-size: 11px; color: #999; margin-top: 4px;">${props.hectares?.toLocaleString()} hectare</div>
              <div style="font-size: 10px; color: #999; margin-top: 4px;">Sinds: ${props.datum || 'N/A'}</div>
            </div>`)
            .addTo(map.current!)
        }

        const nationalParksMouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
        const nationalParksMouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

        safeAddEventListener('national-parks', 'national-parks-fill', 'click', nationalParksClickHandler)
        safeAddEventListener('national-parks', 'national-parks-fill', 'mouseenter', nationalParksMouseEnter)
        safeAddEventListener('national-parks', 'national-parks-fill', 'mouseleave', nationalParksMouseLeave)
      }
    } else {
      // Remove layers and event listeners
      console.log('🗺️ Removing National Parks overlay')
      cleanupOverlay('national-parks', ['national-parks-outline', 'national-parks-fill'], 'national-parks')
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanupOverlay('national-parks', ['national-parks-outline', 'national-parks-fill'], 'national-parks')
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

        // Add event handlers with proper tracking
        const natura2000ClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return
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
        }

        const natura2000MouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
        const natura2000MouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

        safeAddEventListener('natura-2000', 'natura-2000-fill', 'click', natura2000ClickHandler)
        safeAddEventListener('natura-2000', 'natura-2000-fill', 'mouseenter', natura2000MouseEnter)
        safeAddEventListener('natura-2000', 'natura-2000-fill', 'mouseleave', natura2000MouseLeave)
      }
    } else {
      // Remove layers and event listeners
      console.log('🗺️ Removing Natura 2000 overlay')
      cleanupOverlay('natura-2000', ['natura-2000-outline', 'natura-2000-fill'], 'natura-2000')
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanupOverlay('natura-2000', ['natura-2000-outline', 'natura-2000-fill'], 'natura-2000')
    }
  }, [mapLoaded, showNatura2000, natura2000Data])

  // Unified Flood Risk layer uses showFloodRisk with /api/map-overlays/flood-combined API

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

        // Add event handlers with proper tracking
        const droneNoFlyClickHandler = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return
          const props = e.features[0].properties
          if (!props) return
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
        }

        const droneNoFlyMouseEnter = () => { map.current!.getCanvas().style.cursor = 'pointer' }
        const droneNoFlyMouseLeave = () => { map.current!.getCanvas().style.cursor = '' }

        safeAddEventListener('drone-no-fly', 'drone-no-fly-fill', 'click', droneNoFlyClickHandler)
        safeAddEventListener('drone-no-fly', 'drone-no-fly-fill', 'mouseenter', droneNoFlyMouseEnter)
        safeAddEventListener('drone-no-fly', 'drone-no-fly-fill', 'mouseleave', droneNoFlyMouseLeave)
      }
    } else {
      // Remove layers and event listeners
      console.log('🗺️ Removing Drone No-Fly Zones overlay')
      cleanupOverlay('drone-no-fly', ['drone-no-fly-outline', 'drone-no-fly-fill'], 'drone-no-fly')
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanupOverlay('drone-no-fly', ['drone-no-fly-outline', 'drone-no-fly-fill'], 'drone-no-fly')
    }
  }, [mapLoaded, showDroneNoFly, droneNoFlyData])

  // Add Noise pollution WMS overlay from Atlas Leefomgeving (RIVM)
  // Layer names from RIVM WMS GetCapabilities - using latest 2022/2023 data
  const noiseLayerNames: Record<string, string> = {
    combined_lden: 'rivm_20250801_Geluid_lden_allebronnen_2022',
    road_lden: 'rivm_20250101_Geluid_lden_wegverkeer_2022',
    rail_lden: 'rivm_20250101_Geluid_lden_treinverkeer_2023',
    aircraft_lden: 'rivm_20241201_Geluid_lden_vliegverkeer_2022'
  }

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const noiseSourceId = 'noise-wms'
    const noiseLayerId = 'noise-wms-layer'

    if (showNoiseOverlay) {
      console.log('🔊 Adding Noise overlay:', noiseLayerType)

      const layerName = noiseLayerNames[noiseLayerType] || 'rivm_20250801_Geluid_lden_allebronnen_2022'
      // Use Next.js WMS proxy to avoid CORS issues with data.rivm.nl
      const baseWmsUrl = 'https://data.rivm.nl/geo/alo/wms'
      const wmsUrl = `/api/wms-proxy?url=${encodeURIComponent(baseWmsUrl)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${layerName}&CRS=EPSG:3857&STYLES=&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`

      // Remove existing noise layer if present using safe removal
      safeRemoveLayer(noiseLayerId, noiseSourceId)

      // Add WMS source as raster tiles via proxy using safe method
      const sourceAdded = safeAddSource(noiseSourceId, {
        type: 'raster',
        tiles: [wmsUrl],
        tileSize: 256,
        attribution: '© RIVM / Atlas Leefomgeving'
      })

      if (sourceAdded) {
        // Add layer - insert before isochrones if they exist, otherwise just add
        const beforeLayerId = map.current.getLayer('isochrone-fills') ? 'isochrone-fills' : undefined
        safeAddLayer({
          id: noiseLayerId,
          type: 'raster',
          source: noiseSourceId,
          paint: {
            'raster-opacity': 0.7
          }
        }, beforeLayerId)
      }
    } else {
      console.log('🔊 Removing Noise overlay')
      safeRemoveLayer(noiseLayerId, noiseSourceId)
    }

    // Cleanup on unmount
    return () => {
      safeRemoveLayer('noise-layer', 'noise-wms')
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
          // Remove existing boundary if present using safe removal
          safeRemoveLayer('neighborhood-boundary-outline')
          safeRemoveLayer('neighborhood-boundary-fill', 'neighborhood-boundary')

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
              'line-width': 5,
              'line-opacity': 0.9
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

    // Cleanup function using safe removal
    return () => {
      safeRemoveLayer('neighborhood-boundary-outline')
      safeRemoveLayer('neighborhood-boundary-fill', 'neighborhood-boundary')
    }
  }, [mapLoaded, areaCode])

  // Add all-neighborhoods boundaries overlay (for aerial map navigation)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const sourceId = 'all-neighborhood-boundaries'
    const fillLayerId = 'neighborhood-boundaries-fill'
    const lineLayerId = 'neighborhood-boundaries-line'
    const labelLayerId = 'neighborhood-boundaries-labels'

    // Find insertBeforeId - before any overlay layers
    const layers = map.current.getStyle().layers
    let insertBeforeId: string | undefined = undefined
    for (const layer of layers) {
      if (layer.id.includes('overlay') || layer.id.includes('markers')) {
        insertBeforeId = layer.id
        break
      }
    }

    if (showNeighborhoodBoundaries) {
      // Add CBS neighborhoods WMS as a raster layer (fast loading)
      if (!map.current.getSource('cbs-neighborhoods-wms')) {
        // Use the correct layer name 'buurten' with default style showing boundaries
        const wmsUrl = 'https://service.pdok.nl/cbs/wijkenbuurten/2023/wms/v1_0'

        map.current.addSource('cbs-neighborhoods-wms', {
          type: 'raster',
          tiles: [
            `${wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=buurten&styles=wijkenbuurten_thema_buurten_default&format=image/png&transparent=true&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}`
          ],
          tileSize: 256,
          attribution: '© CBS | Buurten 2023'
        })

        map.current.addLayer({
          id: 'cbs-neighborhoods-layer',
          type: 'raster',
          source: 'cbs-neighborhoods-wms',
          paint: {
            'raster-opacity': 0.9,
            'raster-contrast': 0.2,
            'raster-saturation': 0.3
          }
        }, insertBeforeId)

        console.log('🏘️ Showing neighborhood boundaries (CBS WMS)')
      }
    } else {
      // Remove CBS WMS layer
      if (map.current.getLayer('cbs-neighborhoods-layer')) {
        map.current.removeLayer('cbs-neighborhoods-layer')
      }
      if (map.current.getSource('cbs-neighborhoods-wms')) {
        map.current.removeSource('cbs-neighborhoods-wms')
      }
    }
  }, [mapLoaded, showNeighborhoodBoundaries])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="map-container" />

      {/* Loading Indicator */}
      {!mapLoaded && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-600">{t('loading')}</p>
        </div>
      )}

      {/* Layer Loading Progress Bar */}
      {(crimeLoading || schoolsLoading || amenitiesLoading || propertiesLoading) && (
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="h-1 bg-gray-200">
            <div className="h-full bg-blue-600 animate-pulse" style={{ width: '100%' }} />
          </div>
          <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-600 font-medium">
              {crimeLoading && 'Loading crime data...'}
              {schoolsLoading && 'Loading schools...'}
              {amenitiesLoading && 'Loading amenities...'}
              {propertiesLoading && 'Loading properties...'}
            </span>
          </div>
        </div>
      )}

      {/* Top Bar - Map Type Selector */}
      {mapLoaded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-white rounded-lg shadow-lg p-1.5 flex gap-1">
            <button
              onClick={() => setBaseMapStyle('standard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${baseMapStyle === 'standard' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t('standardMap')}
            </button>
            <button
              onClick={() => setBaseMapStyle('aerial')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${baseMapStyle === 'aerial' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t('aerialPhoto')}
            </button>
          </div>
        </div>
      )}

      {/* Labeled Icon Toolbar - More intuitive with text labels */}
      {mapLoaded && (() => {
        // Calculate active layer counts for each category
        const riskLayerCount = [showCrimeOverlay, showFoundationRiskOverlay, showFloodRisk].filter(Boolean).length
        const mapLayerCount = [showCadastralParcels, showNeighborhoodBoundaries].filter(Boolean).length
        const insightLayerCount = [showLeefbaarometer, showLivabilityChange].filter(Boolean).length
        const envLayerCount = [showAirQualityOverlay, showAirQualityRealtimeOverlay, showNoiseOverlay].filter(Boolean).length
        const natureLayerCount = [showNationalParks, showNatura2000, showDroneNoFly].filter(Boolean).length
        const schoolLayerCount = [showPrimarySchools, showSecondarySchools, showMboSchools, showHboSchools, showWoSchools, showSpecialSchools].filter(Boolean).length
        const amenityLayerCount = [showHealthcare, showSupermarkets, showPlaygrounds, showSpeelbossen, showTrainStations, showMetroStations, showTramStops, showTramLines, showMetroLines].filter(Boolean).length

        return (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
          {/* Icon buttons with labels */}
          <div className="bg-white rounded-xl shadow-lg p-2 flex flex-col gap-0.5">
            {/* Risk Layers */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'layers' ? null : 'layers')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'layers' ? 'bg-red-100 text-red-700' : 'hover:bg-gray-100 text-gray-600'} ${riskLayerCount > 0 ? 'ring-2 ring-red-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('risks')}</span>
              {riskLayerCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{riskLayerCount}</span>
              )}
            </button>

            {/* Map Layers (Cadastral, Neighborhoods) */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'mapLayers' ? null : 'mapLayers')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'mapLayers' ? 'bg-slate-100 text-slate-700' : 'hover:bg-gray-100 text-gray-600'} ${mapLayerCount > 0 ? 'ring-2 ring-slate-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('mapLayers')}</span>
              {mapLayerCount > 0 && (
                <span className="ml-auto bg-slate-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{mapLayerCount}</span>
              )}
            </button>

            {/* Insights (Livability, Trends) */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'insights' ? null : 'insights')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'insights' ? 'bg-teal-100 text-teal-700' : 'hover:bg-gray-100 text-gray-600'} ${insightLayerCount > 0 ? 'ring-2 ring-teal-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('insights')}</span>
              {insightLayerCount > 0 && (
                <span className="ml-auto bg-teal-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{insightLayerCount}</span>
              )}
            </button>

            {/* Environment (Air, Noise) */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'environment' ? null : 'environment')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'environment' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100 text-gray-600'} ${envLayerCount > 0 ? 'ring-2 ring-green-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('airAndNoise')}</span>
              {envLayerCount > 0 && (
                <span className="ml-auto bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{envLayerCount}</span>
              )}
            </button>

            {/* Nature */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'nature' ? null : 'nature')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'nature' ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100 text-gray-600'} ${natureLayerCount > 0 ? 'ring-2 ring-emerald-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('nature')}</span>
              {natureLayerCount > 0 && (
                <span className="ml-auto bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{natureLayerCount}</span>
              )}
            </button>

            {/* Schools */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'schools' ? null : 'schools')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'schools' ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-100 text-gray-600'} ${schoolLayerCount > 0 ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('schools')}</span>
              {schoolLayerCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{schoolLayerCount}</span>
              )}
            </button>

            {/* Amenities */}
            <button
              onClick={() => setActiveToolbarPanel(activeToolbarPanel === 'amenities' ? null : 'amenities')}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${activeToolbarPanel === 'amenities' ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100 text-gray-600'} ${amenityLayerCount > 0 ? 'ring-2 ring-purple-400 ring-inset' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('pois')}</span>
              {amenityLayerCount > 0 && (
                <span className="ml-auto bg-purple-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{amenityLayerCount}</span>
              )}
            </button>

            <div className="border-t border-gray-200 my-1" />

            {/* Help/Guide link */}
            <Link
              href="/guide"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium whitespace-nowrap">{t('help')}</span>
            </Link>
          </div>

          {/* Popup panels - positioned to the right of the icon bar */}
          {activeToolbarPanel === 'layers' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[200px] border border-gray-200 max-h-[60vh] overflow-y-auto">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('risks')}</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showCrimeOverlay} onChange={(e) => setShowCrimeOverlay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-xs text-gray-700">{t('crimeRate')}</span>
                  {crimeLoading && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showFoundationRiskOverlay} onChange={(e) => setShowFoundationRiskOverlay(e.target.checked)} className="w-4 h-4 text-orange-600 rounded" />
                  <span className="text-xs text-gray-700">{t('foundationRisk')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showFloodRisk} onChange={(e) => setShowFloodRisk(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-xs text-gray-700">{t('floodRisk')}</span>
                </label>
                {showFloodRisk && (
                  <div className="ml-6 flex flex-col gap-1">
                    <select
                      value={floodScenario}
                      onChange={(e) => setFloodScenario(e.target.value as 't10' | 't100' | 't1000')}
                      className="text-xs border rounded px-2 py-1 w-full"
                    >
                      <option value="t10">Common floods (1x per 10 years)</option>
                      <option value="t100">Rare floods (1x per 100 years)</option>
                      <option value="t1000">Extreme floods (1x per 1000 years)</option>
                    </select>
                    <span className="text-[10px] text-gray-500">How often this flooding could occur</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeToolbarPanel === 'mapLayers' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[200px] border border-gray-200 max-h-[60vh] overflow-y-auto">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('mapLayers')}</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showCadastralParcels} onChange={(e) => setShowCadastralParcels(e.target.checked)} className="w-4 h-4 text-slate-600 rounded" />
                  <span className="text-xs text-gray-700">{t('cadastralParcels')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showNeighborhoodBoundaries} onChange={(e) => setShowNeighborhoodBoundaries(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                  <span className="text-xs text-gray-700">{t('neighborhoodBoundaries')}</span>
                </label>
              </div>
            </div>
          )}

          {activeToolbarPanel === 'insights' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[200px] border border-gray-200">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('insights')}</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showLeefbaarometer} onChange={(e) => setShowLeefbaarometer(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                  <span className="text-xs text-gray-700">{t('livabilityHeatmap')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showLivabilityChange} onChange={(e) => setShowLivabilityChange(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
                  <span className="text-xs text-gray-700">{t('livabilityChange')}</span>
                </label>
              </div>
            </div>
          )}

          {activeToolbarPanel === 'environment' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[220px] border border-gray-200">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('airQuality')}</h4>
              <div className="space-y-2 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showAirQualityOverlay} onChange={(e) => setShowAirQualityOverlay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-xs text-gray-700">Yearly Average</span>
                </label>
                {showAirQualityOverlay && (
                  <>
                    <div className="ml-6 flex gap-1">
                      <select value={airQualityPollutant} onChange={(e) => setAirQualityPollutant(e.target.value as any)} className="text-xs border rounded px-1 py-0.5 flex-1">
                        <option value="NO2">NO₂</option>
                        <option value="PM10">PM10</option>
                        <option value="PM25">PM2.5</option>
                      </select>
                      <select value={airQualityYear} onChange={(e) => setAirQualityYear(e.target.value as any)} className="text-xs border rounded px-1 py-0.5 flex-1">
                        <option value="current">2023</option>
                        <option value="2022">2022</option>
                        <option value="2021">2021</option>
                        <option value="2020">2020</option>
                      </select>
                    </div>
                    {airQualityPollutant === 'PM25' && (
                      <p className="ml-6 mt-1 text-[9px] text-gray-500 leading-tight">WHO limit: 5 µg/m³. NL average: 8-12 µg/m³. EU limit: 25 µg/m³.</p>
                    )}
                  </>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showAirQualityRealtimeOverlay} onChange={(e) => setShowAirQualityRealtimeOverlay(e.target.checked)} className="w-4 h-4 text-orange-600 rounded" />
                  <span className="text-xs text-gray-700">Real-time Stations</span>
                  {showAirQualityRealtimeOverlay && <span className="text-[9px] px-1 py-0.5 bg-orange-500 text-white rounded animate-pulse">LIVE</span>}
                </label>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('noiseOverlay')}</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showNoiseOverlay} onChange={(e) => setShowNoiseOverlay(e.target.checked)} className="w-4 h-4 text-orange-500 rounded" />
                  <span className="text-xs text-gray-700">Noise Pollution</span>
                </label>
                {showNoiseOverlay && (
                  <select value={noiseLayerType} onChange={(e) => setNoiseLayerType(e.target.value as any)} className="ml-6 mt-1 text-[10px] border rounded px-1 py-0.5 w-[100px]">
                    <option value="combined_lden">All sources</option>
                    <option value="road_lden">Road</option>
                    <option value="rail_lden">Rail</option>
                    <option value="aircraft_lden">Aircraft</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {activeToolbarPanel === 'nature' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[180px] border border-gray-200">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('natureEnvironment')}</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showNationalParks} onChange={(e) => setShowNationalParks(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                  <span className="text-xs text-gray-700">{t('nationalParks')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showNatura2000} onChange={(e) => setShowNatura2000(e.target.checked)} className="w-4 h-4 text-sky-600 rounded" />
                  <span className="text-xs text-gray-700">{t('natura2000')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showDroneNoFly} onChange={(e) => setShowDroneNoFly(e.target.checked)} className="w-4 h-4 text-red-600 rounded" />
                  <span className="text-xs text-gray-700">{t('droneNoFlyZones')}</span>
                </label>
              </div>
            </div>
          )}

          {activeToolbarPanel === 'schools' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[200px] border border-gray-200">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('schools')} <span className="text-purple-600">(purple)</span></h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showPrimarySchools} onChange={(e) => setShowPrimarySchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-3 h-3 rounded-full bg-purple-500 border border-white shadow-sm"></div>
                  <span className="text-xs text-gray-700">{t('legend.primarySchool')} (●)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSecondarySchools} onChange={(e) => setShowSecondarySchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-3.5 h-3.5 rounded-full bg-purple-500 border border-white shadow-sm"></div>
                  <span className="text-xs text-gray-700">{t('legend.secondarySchool')} (●)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showMboSchools} onChange={(e) => setShowMboSchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-3 h-3 bg-purple-500 border border-white shadow-sm"></div>
                  <span className="text-xs text-gray-700">MBO (■)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showHboSchools} onChange={(e) => setShowHboSchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-3 h-3 bg-purple-500 border border-white shadow-sm rotate-45"></div>
                  <span className="text-xs text-gray-700">HBO (◆)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showWoSchools} onChange={(e) => setShowWoSchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-purple-500"></div>
                  <span className="text-xs text-gray-700">{t('legend.university')} (▲)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSpecialSchools} onChange={(e) => setShowSpecialSchools(e.target.checked)} className="w-4 h-4 accent-purple-500 rounded" />
                  <div className="w-3 h-3 flex items-center justify-center text-purple-500 font-bold text-sm">+</div>
                  <span className="text-xs text-gray-700">{t('legend.specialEducation')} (+)</span>
                </label>
              </div>
            </div>
          )}

          {activeToolbarPanel === 'amenities' && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl p-3 min-w-[180px] border border-gray-200">
              <h4 className="font-semibold text-xs text-gray-700 mb-2">{t('amenities')}</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showHealthcare} onChange={(e) => setShowHealthcare(e.target.checked)} className="w-4 h-4 text-red-500 rounded" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <span className="text-xs text-gray-700">{t('healthcare')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSupermarkets} onChange={(e) => setShowSupermarkets(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
                  <span className="text-xs text-gray-700">{t('supermarkets')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showPlaygrounds} onChange={(e) => setShowPlaygrounds(e.target.checked)} className="w-4 h-4 text-yellow-500 rounded" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                  <span className="text-xs text-gray-700">{t('playgrounds')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSpeelbossen} onChange={(e) => setShowSpeelbossen(e.target.checked)} className="w-4 h-4 text-green-800 rounded" />
                  <div className="w-2.5 h-2.5 rotate-45 bg-green-800"></div>
                  <span className="text-xs text-gray-700">{t('speelbossen')}</span>
                </label>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-[10px] text-gray-500 mb-1">Transport</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showTrainStations} onChange={(e) => setShowTrainStations(e.target.checked)} className="w-4 h-4 text-blue-800 rounded" />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-800"></div>
                    <span className="text-xs text-gray-700">{t('trainStations')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showMetroStations} onChange={(e) => setShowMetroStations(e.target.checked)} className="w-4 h-4 text-orange-600 rounded" />
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-600"></div>
                    <span className="text-xs text-gray-700">{t('metroStations')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showTramStops} onChange={(e) => setShowTramStops(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
                    <span className="text-xs text-gray-700">{t('tramStops')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showTramLines} onChange={(e) => setShowTramLines(e.target.checked)} className="w-4 h-4 text-teal-500 rounded" />
                    <div className="w-4 h-0.5 bg-teal-500 rounded"></div>
                    <span className="text-xs text-gray-700">{t('tramLines') || 'Tram Lines'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showMetroLines} onChange={(e) => setShowMetroLines(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                    <div className="w-4 h-1 bg-blue-600 rounded"></div>
                    <span className="text-xs text-gray-700">{t('metroLines') || 'Metro Lines'}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* Click outside to close panels */}
      {activeToolbarPanel && (
        <div
          className="absolute inset-0 z-10"
          onClick={() => setActiveToolbarPanel(null)}
        />
      )}

      {/* Legend - Always visible */}
      {mapLoaded && (
        <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5 min-w-[280px] max-w-sm max-h-[75vh] overflow-y-auto border border-gray-200">
          <h4 className="font-bold text-base text-gray-900 mb-4">{t('legend.title')}</h4>
          <div className="space-y-2 text-sm text-gray-700">
            {/* Base map colors - only show for standard map, not aerial photos */}
            {baseMapStyle === 'standard' && (
              <div className="pb-3 mb-3 border-b border-gray-200">
                <div className="font-semibold text-gray-600 mb-2">{t('legend.baseMap')}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
                    <div className="w-4 h-1" style={{
                      background: 'repeating-linear-gradient(90deg, #000000, #000000 2px, #ffffff 2px, #ffffff 4px)',
                      border: '0.5px solid #333333'
                    }}></div>
                    <span>{t('legend.railways')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Map markers legend */}
            <div className="font-semibold text-gray-600 mb-3">{t('legend.markers')}</div>

            {/* Schools - unified purple, different shapes */}
            {(showPrimarySchools || showSecondarySchools || showMboSchools || showHboSchools || showWoSchools || showSpecialSchools) && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-purple-600">{t('legend.schools')} (purple)</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-sm"></div>
                  <span>{t('legend.primarySchool')} (●)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-sm"></div>
                  <span>{t('legend.secondarySchool')} (●)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-purple-500 border-2 border-white shadow-sm"></div>
                  <span>MBO (■)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-purple-500 border-2 border-white shadow-sm rotate-45"></div>
                  <span>HBO (◆)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-transparent border-b-purple-500"></div>
                  <span>{t('legend.university')} (▲)</span>
                </div>
              </div>
            )}

            {/* Healthcare - unified blue, different shapes */}
            {showHealthcare && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-blue-600">{t('legend.healthcareTitle')} (blue)</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                  <span>{t('legend.gp')} (●)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center text-white text-[9px] font-bold">+</div>
                  <span>{t('legend.pharmacy')} (+)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-red-600 border-2 border-white shadow-sm flex items-center justify-center text-white text-[11px] font-bold">✕</div>
                  <span>{t('legend.hospital')} (✕ red)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 border-2 border-white shadow-sm rotate-45"></div>
                  <span>{t('legend.clinic')} (◆)</span>
                </div>
              </div>
            )}

            {/* Transport - unified slate gray */}
            {(showTrainStations || showMetroStations || showTramStops || showTramLines || showMetroLines) && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-slate-600">{t('legend.transport')} (gray)</div>
                {showTrainStations && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-slate-500 border-2 border-white shadow-sm"></div>
                    <span>{t('legend.trainStation')} (■)</span>
                  </div>
                )}
                {showMetroStations && (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-500 border-2 border-white shadow-sm"></div>
                    <span>{t('legend.metroStation')} (●)</span>
                  </div>
                )}
                {showTramStops && (
                  <div className="flex items-center gap-3">
                    <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-transparent border-b-slate-500"></div>
                    <span>{t('legend.tramStop')} (▲)</span>
                  </div>
                )}
                {showTramLines && (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-1 rounded bg-teal-500"></div>
                    <span>{t('legend.tramLine') || 'Tram Lines'} (colored)</span>
                  </div>
                )}
                {showMetroLines && (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-1.5 rounded bg-blue-600"></div>
                    <span>{t('legend.metroLine') || 'Metro Lines'} (colored)</span>
                  </div>
                )}
              </div>
            )}

            {/* Shopping - orange */}
            {showSupermarkets && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-orange-600">{t('legend.shopping')} (orange)</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-orange-500 border-2 border-white shadow-sm"></div>
                  <span>{t('legend.supermarket')} (■)</span>
                </div>
              </div>
            )}

            {/* Recreation - green */}
            {showPlaygrounds && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-green-600">{t('legend.recreation')} (green)</div>
                <div className="flex items-center gap-3">
                  <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-transparent border-b-green-500"></div>
                  <span>{t('legend.playground')} (▲)</span>
                </div>
              </div>
            )}

            {/* Speelbossen (Nature Play) - dark green */}
            {showSpeelbossen && (
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="font-semibold text-green-800">{t('legend.naturePlay')} (dark green)</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-green-800 rotate-45"></div>
                  <span>{t('legend.speelbos')} (◆)</span>
                </div>
              </div>
            )}

            {areaCode && (
              <div className="flex items-center gap-3 pt-2">
                <div className="w-5 h-5 rounded border-2" style={{backgroundColor: '#a855f7', borderColor: '#9333ea', opacity: 0.4}}></div>
                <span>{t('legend.neighborhoodBoundary')}</span>
              </div>
            )}

            {showCrimeOverlay && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.crimeRateLegend')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#dbeafe'}}></div>
                  <span>{t('legend.low')} (&lt; 50 per 1,000)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#93c5fd'}}></div>
                  <span>{t('legend.medium')} (50-100)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#3b82f6'}}></div>
                  <span>{t('legend.high')} (100-200)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#1e40af'}}></div>
                  <span>{t('legend.veryHigh')} (&gt; 200)</span>
                </div>
              </div>
            )}

            {showAirQualityOverlay && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.airQualityLegend')} (RIVM)
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#e0f0ff'}}></div>
                  <span>{t('legend.good')} (0-10 µg/m³)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#a0d0ff'}}></div>
                  <span>{t('legend.moderate')} (10-20)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#60a0e0'}}></div>
                  <span>Elevated (20-30)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#3070c0'}}></div>
                  <span>{t('legend.unhealthy')} (30-40)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#1040a0'}}></div>
                  <span>{t('legend.veryUnhealthy')} (&gt; 40)</span>
                </div>
              </div>
            )}

            {showFoundationRiskOverlay && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.foundationRiskLegend')}
                </div>
                <div className="text-xs text-gray-500 mb-2">{t('legend.subsidenceRisk')}</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#22c55e'}}></div>
                  <span>{t('legend.lowRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#facc15'}}></div>
                  <span>{t('legend.moderateRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#f97316'}}></div>
                  <span>{t('legend.highRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#dc2626'}}></div>
                  <span>{t('legend.veryHighRisk')}</span>
                </div>
              </div>
            )}

            {showCadastralParcels && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.cadastralParcelsLegend')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-1" style={{backgroundColor: '#000000'}}></div>
                  <span>{t('legend.definiteBoundary')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-1" style={{backgroundColor: '#CC9900'}}></div>
                  <span>{t('legend.provisionalBoundary')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-1" style={{backgroundColor: '#5CF6D1'}}></div>
                  <span>{t('legend.adminBoundary')}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1 italic">
                  {t('legend.cadastralZoomNote')}
                </div>
              </div>
            )}

            {showNationalParks && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.nationalParksLegend')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#16a34a', opacity: 0.5, border: '2px solid #15803d'}}></div>
                  <span>{t('legend.nationalPark')}</span>
                </div>
              </div>
            )}

            {showNatura2000 && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.natura2000Legend')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#0ea5e9', opacity: 0.5, border: '2px solid #0284c7'}}></div>
                  <span>{t('legend.protectedArea')}</span>
                </div>
              </div>
            )}

            {showDroneNoFly && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  {t('legend.droneNoFlyLegend')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#ef4444', opacity: 0.5, border: '2px dashed #dc2626'}}></div>
                  <span>{t('legend.restrictedZone')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#f97316', opacity: 0.5, border: '2px dashed #ea580c'}}></div>
                  <span>{t('legend.natura2000NoFly')}</span>
                </div>
              </div>
            )}

            {showFloodRisk && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-200">
                <div className="font-semibold text-gray-600">
                  🌊 {t('floodRisk')} ({floodScenario === 't10' ? '1x/10yr' : floodScenario === 't100' ? '1x/100yr' : '1x/1000yr'})
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#7c2d12', opacity: 0.7, border: '2px solid #1e3a8a'}}></div>
                  <span>{t('legend.veryHighRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#dc2626', opacity: 0.7, border: '1px solid #991b1b'}}></div>
                  <span>{t('legend.highRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#f59e0b', opacity: 0.7, border: '1px solid #d97706'}}></div>
                  <span>{t('legend.mediumRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#3b82f6', opacity: 0.6, border: '1px solid #1d4ed8'}}></div>
                  <span>{t('legend.lowRisk')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: '#93c5fd', opacity: 0.5, border: '1px solid #3b82f6'}}></div>
                  <span>{t('legend.veryLowRisk')}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 pt-1 border-t border-gray-100">
                  <div className="w-4 h-4 rounded" style={{backgroundColor: 'transparent', border: '2px solid #1e3a8a'}}></div>
                  <span className="text-xs text-gray-500">= Water depth data available</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Sources: PDOK Rijkswaterstaat + Lizard (LIWO)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
