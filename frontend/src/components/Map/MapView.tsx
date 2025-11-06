'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination } from '@/app/page'
import { createCircle, calculateRadius, getModeColor, getModeBorderColor } from '@/lib/isochrones'

interface MapViewProps {
  destinations: Destination[]
}

export default function MapView({ destinations }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [mapLoaded, setMapLoaded] = useState(false)

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
    })

    // Update source data
    source.setData({
      type: 'FeatureCollection',
      features,
    })
  }, [destinations, mapLoaded])

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
            Approximate reachable areas
          </div>
        </div>
      )}
    </div>
  )
}
