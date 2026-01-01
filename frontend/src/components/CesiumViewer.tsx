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

        // Create the viewer with Cesium World Terrain for proper elevation
        const viewer = new Cesium.Viewer(containerRef.current, {
          terrain: Cesium.Terrain.fromWorldTerrain({
            requestWaterMask: true,
            requestVertexNormals: true
          }),
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

        // Enable depth testing against terrain so 3D buildings sit properly on the ground
        // But disable it initially to avoid marker rendering issues - will be re-enabled after tilesets load
        viewer.scene.globe.depthTestAgainstTerrain = false

        viewerRef.current = viewer

        // Set up imagery - use PDOK BRT-A standaard as base layer (Dutch topographic map)
        // Same base map as 2D MapView for consistency
        // Remove default base layer and add our preferred imagery
        try {
          viewer.imageryLayers.removeAll()

          // Use PDOK BRT-A standaard as primary base layer
          // Using UrlTemplateImageryProvider with same URL format as 2D MapView
          const pdokProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png',
            maximumLevel: 19,
            credit: new Cesium.Credit('© PDOK | © Kadaster')
          })
          viewer.imageryLayers.addImageryProvider(pdokProvider)
          console.log('🗺️ PDOK BRT-A standaard base layer added')
        } catch (pdokError) {
          console.warn('Could not load PDOK imagery, trying OSM:', pdokError)
          try {
            // Fallback to OpenStreetMap
            const osmProvider = new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/',
            })
            viewer.imageryLayers.addImageryProvider(osmProvider)
            console.log('🗺️ OpenStreetMap base layer added as fallback')
          } catch (osmError) {
            console.warn('Could not load OSM imagery, using Cesium Ion default:', osmError)
            // Final fallback to Cesium Ion default imagery
            viewer.imageryLayers.addImageryProvider(
              new Cesium.IonImageryProvider({ assetId: 2 })
            )
          }
        }

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
          console.log('🏢 Buildings tileset loaded, initial visibility:', showBuildings)

          // Store reference for toggle - use a dedicated property
          viewer._buildingsTileset = buildingsTileset
        } catch (e) {
          console.warn('Could not load buildings tileset:', e)
        }

        // Load PDOK 3D Terrain tileset (trees, vegetation, terrain features)
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
          console.log('🌲 Terrain tileset loaded, initial visibility:', showTerrain)

          // Store reference for toggle - use a dedicated property
          viewer._terrainTileset = terrainTileset
        } catch (e) {
          console.warn('Could not load terrain tileset:', e)
        }

        // Fly to initial position (target coordinates or default Amsterdam)
        const initialLon = targetCoordinates?.[0] ?? 4.9
        const initialLat = targetCoordinates?.[1] ?? 52.37
        const initialAlt = targetCoordinates ? targetAltitude : 2000

        // Add marker pin at target location if coordinates provided
        if (targetCoordinates) {
          // Use CLAMP_TO_3D_TILE to position marker on top of buildings
          // This works with 3D Tiles like the PDOK buildings dataset
          const markerHeightOffset = 5 // Small offset above the building roof

          viewer.entities.add({
            id: 'targetMarker',
            name: 'Target Location',
            position: Cesium.Cartesian3.fromDegrees(
              targetCoordinates[0],
              targetCoordinates[1],
              markerHeightOffset
            ),
            billboard: {
              image: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M12 0C7.31 0 3.5 3.81 3.5 8.5C3.5 14.88 12 24 12 24S20.5 14.88 20.5 8.5C20.5 3.81 16.69 0 12 0ZM12 11.5C10.34 11.5 9 10.16 9 8.5C9 6.84 10.34 5.5 12 5.5C13.66 5.5 15 6.84 15 8.5C15 10.16 13.66 11.5 12 11.5Z"/>
                </svg>
              `),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: 1.5,
              // CLAMP_TO_3D_TILE places marker on top of 3D buildings
              heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: 'Target Location',
              font: '14px sans-serif',
              fillColor: Cesium.Color.WHITE,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -60),
              heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        }

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
    if (!isReady || !viewerRef.current) return

    const viewer = viewerRef.current
    const tileset = viewer._buildingsTileset
    if (tileset) {
      console.log(`🏢 Toggling buildings visibility: ${showBuildings}`)
      tileset.show = showBuildings
      // Force scene update
      viewer.scene.requestRender()
    } else {
      console.warn('⚠️ Buildings tileset not yet loaded')
    }
  }, [showBuildings, isReady])

  // Handle terrain visibility toggle
  useEffect(() => {
    if (!isReady || !viewerRef.current) return

    const viewer = viewerRef.current
    const tileset = viewer._terrainTileset
    if (tileset) {
      console.log(`🌲 Toggling terrain visibility: ${showTerrain}`)
      tileset.show = showTerrain
      // Force scene update
      viewer.scene.requestRender()
    } else {
      console.warn('⚠️ Terrain tileset not yet loaded')
    }
  }, [showTerrain, isReady])

  // Handle coordinate changes - fly to new location and update marker
  useEffect(() => {
    if (!isReady || !viewerRef.current || !targetCoordinates) return

    const Cesium = window.Cesium
    if (!Cesium) return

    const viewer = viewerRef.current

    // Remove existing marker entity if any
    const existingMarker = viewer.entities.getById('targetMarker')
    if (existingMarker) {
      viewer.entities.remove(existingMarker)
    }

    // Use CLAMP_TO_3D_TILE to position marker on top of buildings
    const markerHeightOffset = 5 // Small offset above building roof

    viewer.entities.add({
      id: 'targetMarker',
      name: 'Target Location',
      position: Cesium.Cartesian3.fromDegrees(
        targetCoordinates[0],
        targetCoordinates[1],
        markerHeightOffset
      ),
      billboard: {
        image: 'data:image/svg+xml;base64,' + btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 0C7.31 0 3.5 3.81 3.5 8.5C3.5 14.88 12 24 12 24S20.5 14.88 20.5 8.5C20.5 3.81 16.69 0 12 0ZM12 11.5C10.34 11.5 9 10.16 9 8.5C9 6.84 10.34 5.5 12 5.5C13.66 5.5 15 6.84 15 8.5C15 10.16 13.66 11.5 12 11.5Z"/>
          </svg>
        `),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 1.5,
        // CLAMP_TO_3D_TILE places marker on top of 3D buildings
        heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: 'Target Location',
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -60),
        // CLAMP_TO_3D_TILE places label on top of 3D buildings
        heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    viewer.camera.flyTo({
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
