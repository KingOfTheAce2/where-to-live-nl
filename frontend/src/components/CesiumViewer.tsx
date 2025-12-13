'use client'

import { useEffect, useRef, useState } from 'react'

// Cesium types
declare global {
  interface Window {
    Cesium: any
  }
}

interface CesiumViewerProps {
  showBuildings?: boolean
  showTerrain?: boolean
  targetCoordinates?: [number, number] // [longitude, latitude]
  targetAltitude?: number // Camera height in meters
}

export default function CesiumViewer({
  showBuildings = true,
  showTerrain = true,
  targetCoordinates,
  targetAltitude = 500
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const initCesium = async () => {
      try {
        // Dynamically load Cesium
        if (!window.Cesium) {
          // Load Cesium CSS
          const cssLink = document.createElement('link')
          cssLink.rel = 'stylesheet'
          cssLink.href = 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Widgets/widgets.css'
          document.head.appendChild(cssLink)

          // Load Cesium JS
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Cesium.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load Cesium'))
            document.head.appendChild(script)
          })

          // Wait for Cesium to be available
          await new Promise<void>((resolve) => {
            const checkCesium = () => {
              if (window.Cesium) {
                resolve()
              } else {
                setTimeout(checkCesium, 100)
              }
            }
            checkCesium()
          })
        }

        if (!mounted || !containerRef.current) return

        const Cesium = window.Cesium

        // Set default access token (using Cesium Ion default token for basic usage)
        // For production, you should use your own token
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc1MTEsImlhdCI6MTYyMjA0OTU3M30.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

        // Create the viewer
        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          animation: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          vrButton: false,
          infoBox: false,
          shadows: true,
          shouldAnimate: true,
        })

        viewerRef.current = viewer

        // Set up imagery - use OpenStreetMap as base
        viewer.imageryLayers.removeAll()
        viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          })
        )

        // Load PDOK 3D Buildings tileset
        try {
          const buildingsTileset = await Cesium.Cesium3DTileset.fromUrl(
            'https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1_1/collections/gebouwen/3dtiles',
            {
              maximumScreenSpaceError: 16,
              skipLevelOfDetail: true,
              preferLeaves: true,
            }
          )

          buildingsTileset.style = new Cesium.Cesium3DTileStyle({
            color: "color('white', 0.9)",
          })

          viewer.scene.primitives.add(buildingsTileset)
          buildingsTileset.show = showBuildings

          // Store reference for toggle
          ;(viewer as any).buildingsTileset = buildingsTileset
        } catch (e) {
          console.warn('Could not load buildings tileset:', e)
        }

        // Load PDOK 3D Terrain tileset
        try {
          const terrainTileset = await Cesium.Cesium3DTileset.fromUrl(
            'https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1_1/collections/terrein/3dtiles',
            {
              maximumScreenSpaceError: 16,
              skipLevelOfDetail: true,
              preferLeaves: true,
            }
          )

          terrainTileset.style = new Cesium.Cesium3DTileStyle({
            color: "color('lightgreen', 0.8)",
          })

          viewer.scene.primitives.add(terrainTileset)
          terrainTileset.show = showTerrain

          // Store reference for toggle
          ;(viewer as any).terrainTileset = terrainTileset
        } catch (e) {
          console.warn('Could not load terrain tileset:', e)
        }

        // Fly to initial position (target coordinates or default Amsterdam)
        const initialLon = targetCoordinates?.[0] ?? 4.9
        const initialLat = targetCoordinates?.[1] ?? 52.37
        const initialAlt = targetCoordinates ? targetAltitude : 2000

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat, initialAlt),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2,
        })

        if (mounted) {
          setIsLoading(false)
          setIsReady(true)
        }
      } catch (err) {
        console.error('Error initializing Cesium:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize 3D viewer')
          setIsLoading(false)
        }
      }
    }

    initCesium()

    return () => {
      mounted = false
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // Handle building visibility toggle
  useEffect(() => {
    if (viewerRef.current?.buildingsTileset) {
      viewerRef.current.buildingsTileset.show = showBuildings
    }
  }, [showBuildings])

  // Handle terrain visibility toggle
  useEffect(() => {
    if (viewerRef.current?.terrainTileset) {
      viewerRef.current.terrainTileset.show = showTerrain
    }
  }, [showTerrain])

  // Handle coordinate changes - fly to new location
  useEffect(() => {
    if (!isReady || !viewerRef.current || !targetCoordinates) return

    const Cesium = window.Cesium
    if (!Cesium) return

    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        targetCoordinates[0],
        targetCoordinates[1],
        targetAltitude
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.5,
    })
  }, [targetCoordinates, targetAltitude, isReady])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center text-white">
          <p className="text-red-400 text-lg mb-2">Error loading 3D viewer</p>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Initializing 3D viewer...</p>
            <p className="text-gray-400 text-sm mt-2">Loading PDOK 3D data for the Netherlands</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
