'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Destination } from '@/app/page'

interface MapViewProps {
  destinations: Destination[]
}

export default function MapView({ destinations }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
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
        showUserHeading: true,
      }),
      'top-right'
    )

    map.current.on('load', () => {
      setMapLoaded(true)
      console.log('Map loaded successfully with PDOK tiles')
    })

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Add destination markers when destinations change
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing markers (in a real app, we'd track these)
    // For now, this is a simplified version

    destinations.forEach((dest, index) => {
      if (dest.coordinates) {
        // Create custom marker element
        const el = document.createElement('div')
        el.className = 'destination-marker'
        el.style.width = '30px'
        el.style.height = '30px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = '#3b82f6'
        el.style.border = '3px solid white'
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'
        el.style.cursor = 'pointer'
        el.innerHTML = `<div style="color: white; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">${index + 1}</div>`

        // Add marker to map
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(dest.coordinates)
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<div style="padding: 8px;">
                <strong>${dest.label}</strong><br/>
                ${dest.address}<br/>
                <span style="color: #666; font-size: 12px;">Max: ${dest.maxMinutes} min</span>
              </div>`
            )
          )
          .addTo(map.current!)
      }
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
              <span>Your destinations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 opacity-50"></div>
              <span>Reachable areas (coming soon)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
