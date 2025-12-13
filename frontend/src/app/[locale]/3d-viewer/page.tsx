'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Search, X } from 'lucide-react'

// Dynamically import Cesium viewer to avoid SSR issues
const CesiumViewer = dynamic(() => import('@/components/CesiumViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading 3D Netherlands...</p>
      </div>
    </div>
  ),
})

export default function ThreeDViewerPage() {
  const t = useTranslations('viewer3d')
  const tSearch = useTranslations('search')
  const searchParams = useSearchParams()

  const [showBuildings, setShowBuildings] = useState(true)
  const [showTerrain, setShowTerrain] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [targetCoordinates, setTargetCoordinates] = useState<[number, number] | undefined>(undefined)
  const [showSearch, setShowSearch] = useState(false)

  // Read coordinates from URL params on mount
  useEffect(() => {
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const address = searchParams.get('address')

    if (lat && lng) {
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        setTargetCoordinates([lngNum, latNum])
        if (address) {
          setSelectedAddress(decodeURIComponent(address))
        }
      }
    }
  }, [searchParams])

  const handleAddressSelect = (address: string, coordinates: [number, number]) => {
    setSelectedAddress(address)
    setTargetCoordinates(coordinates)
    setSearchValue(address)
    setShowSearch(false)

    // Update URL without reload for shareability
    const url = new URL(window.location.href)
    url.searchParams.set('lat', coordinates[1].toString())
    url.searchParams.set('lng', coordinates[0].toString())
    url.searchParams.set('address', encodeURIComponent(address))
    window.history.pushState({}, '', url.toString())
  }

  return (
    <div className="h-screen w-screen relative">
      {/* Navigation header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-white hover:text-blue-300 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              {t('backToMap')}
            </Link>
            <div className="h-6 w-px bg-white/30"></div>
            <h1 className="text-white font-semibold text-lg">{t('title')}</h1>
          </div>

          {/* Search and location info */}
          <div className="flex items-center gap-4">
            {selectedAddress && !showSearch && (
              <div className="text-white text-sm bg-black/40 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="max-w-[300px] truncate">{selectedAddress}</span>
                <button
                  onClick={() => {
                    setSelectedAddress(null)
                    setTargetCoordinates(undefined)
                    setSearchValue('')
                    // Clear URL params
                    const url = new URL(window.location.href)
                    url.searchParams.delete('lat')
                    url.searchParams.delete('lng')
                    url.searchParams.delete('address')
                    window.history.pushState({}, '', url.toString())
                  }}
                  className="hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {showSearch ? (
              <div className="flex items-center gap-2">
                <div className="w-80">
                  <AddressAutocomplete
                    value={searchValue}
                    onChange={setSearchValue}
                    onSelect={handleAddressSelect}
                    placeholder={tSearch('placeholder')}
                    className="bg-white/90 backdrop-blur-sm text-gray-900"
                  />
                </div>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-white hover:text-gray-300 p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="text-white hover:text-blue-300 transition-colors flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">{t('searchAddress')}</span>
              </button>
            )}

            <div className="text-white/70 text-sm hidden md:block">
              {t('dataSource')}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Viewer */}
      <CesiumViewer
        showBuildings={showBuildings}
        showTerrain={showTerrain}
        targetCoordinates={targetCoordinates}
        targetAltitude={500}
      />

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white text-sm max-w-xs">
        <h3 className="font-semibold mb-2">{t('controls.title')}</h3>
        <ul className="space-y-1 text-white/80">
          <li>{t('controls.rotate')}</li>
          <li>{t('controls.pan')}</li>
          <li>{t('controls.zoom')}</li>
          <li>{t('controls.tilt')}</li>
        </ul>
      </div>

      {/* Layer toggle */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white text-sm">
        <h3 className="font-semibold mb-2">{t('layers.title')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showBuildings}
              onChange={(e) => setShowBuildings(e.target.checked)}
              className="rounded"
            />
            <span>{t('layers.buildings')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTerrain}
              onChange={(e) => setShowTerrain(e.target.checked)}
              className="rounded"
            />
            <span>{t('layers.terrain')}</span>
          </label>
        </div>
      </div>
    </div>
  )
}
