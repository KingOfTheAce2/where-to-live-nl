'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Search, Home, Loader2, GitCompare, X, Box } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { useAddressSnapshot } from '@/hooks/useAddressSnapshot'
import ComparisonPanel, { ComparisonItem, ComparisonType } from '@/components/ComparisonPanel'
import SmartIndicator from '@/components/SmartIndicator'
import WWSCalculator from '@/components/WWSCalculator'
import LanguageSelector from '@/components/LanguageSelector'
import RedFlagsCard from '@/components/RedFlagsCard'
import { UserMenu } from '@/components/auth/UserMenu'
import AtAGlance from '@/components/AtAGlance'
import CollapsibleSection from '@/components/CollapsibleSection'
import { SidebarSkeleton } from '@/components/SkeletonLoader'
import MobileBottomSheet from '@/components/MobileBottomSheet'
import { useIsMobile } from '@/hooks/useMediaQuery'
// Air Quality available in map overlays

// Dynamically import Map component (MapLibre requires window object)
const MapView = dynamic(() => import('@/components/Map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Loading map...</p>
    </div>
  ),
})

import type { Destination } from '@/types/destination'
export type { Destination }

export default function HomePage() {
  const t = useTranslations()
  const [searchAddress, setSearchAddress] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<{
    address: string
    coordinates: [number, number]
    areaCode?: string
  } | null>(null)

  const [workAddress, setWorkAddress] = useState('')
  const [selectedWorkAddress, setSelectedWorkAddress] = useState<{
    address: string
    coordinates: [number, number]
  } | null>(null)
  const [showWorkAddressInput, setShowWorkAddressInput] = useState(false)
  const [travelTime, setTravelTime] = useState<{
    byBike?: number
    byPublicTransport?: number
    byCar?: number
  } | null>(null)

  // Comparison state
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([])
  const [comparisonType, setComparisonType] = useState<ComparisonType>('neighborhood')
  const [showComparison, setShowComparison] = useState(false)

  // Toast notification state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Mobile detection
  const isMobile = useIsMobile()
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  const { snapshot, isLoading, error } = useAddressSnapshot(
    selectedAddress?.coordinates || null,
    selectedAddress?.address || '',
    selectedAddress?.areaCode
  )

  const handleAddressSelect = (address: string, coordinates: [number, number], details?: any) => {
    setSelectedAddress({
      address,
      coordinates,
      areaCode: details?.buurtcode  // Extract neighborhood code from PDOK data
    })
  }

  const handleWorkAddressSelect = (address: string, coordinates: [number, number]) => {
    setSelectedWorkAddress({ address, coordinates })
    calculateTravelTime(selectedAddress!.coordinates, coordinates)
  }

  const calculateTravelTime = async (from: [number, number], to: [number, number]) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/travel-time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_lng: from[0],
          from_lat: from[1],
          to_lng: to[0],
          to_lat: to[1],
          from_address: selectedAddress?.address || '',
          to_address: selectedWorkAddress?.address || ''
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to calculate travel time')
      }

      const data = await response.json()
      const times = data.travel_times

      setTravelTime({
        byBike: times.bike?.duration_minutes || undefined,
        byPublicTransport: undefined, // ORS doesn't support PT
        byCar: times.car?.duration_minutes || undefined,
      })
    } catch (error) {
      console.error('Error calculating travel time:', error)
      // Fall back to straight-line distance calculation
      const R = 6371 // Earth radius in km
      const [lng1, lat1] = from
      const [lng2, lat2] = to

      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      const byBike = Math.round((distance / 15) * 60)
      const byCar = Math.round((distance / 50) * 60)

      setTravelTime({ byBike, byPublicTransport: undefined, byCar })
    }
  }

  const handleAddToComparison = () => {
    if (!selectedAddress || !snapshot) return

    const maxItems = comparisonType === 'neighborhood' ? 2 : 3
    if (comparisonItems.length >= maxItems) {
      const typeKey = comparisonType === 'neighborhood' ? 'neighborhoods' : 'houses'
      setToastMessage(t('comparison.maxReached', { count: maxItems, type: t(`comparison.${typeKey}`) }))
      setShowToast(true)
      return
    }

    // Check if already added
    const exists = comparisonItems.some(item =>
      item.address === selectedAddress.address
    )
    if (exists) {
      setToastMessage(t('comparison.alreadyAdded'))
      setShowToast(true)
      return
    }

    const newItem: ComparisonItem = {
      id: `${Date.now()}`,
      address: selectedAddress.address,
      coordinates: selectedAddress.coordinates,
      areaCode: selectedAddress.areaCode,
      snapshot: snapshot
    }

    setComparisonItems([...comparisonItems, newItem])
  }

  const handleRemoveFromComparison = (id: string) => {
    setComparisonItems(comparisonItems.filter(item => item.id !== id))
  }

  const handleToggleComparisonType = () => {
    // Clear items when switching types
    setComparisonItems([])
    setComparisonType(comparisonType === 'neighborhood' ? 'house' : 'neighborhood')
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between px-6 shadow-md z-50">
        <div className="flex items-center gap-4">
          {/* Clear Home Button */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-sm font-medium"
            title={t('nav.backToHome') || 'Back to Home'}
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nav.home') || 'Home'}</span>
          </Link>
          {/* App Title */}
          <div className="hidden md:block">
            <h1 className="text-lg font-bold leading-tight">
              {t('app.title')}
            </h1>
            <p className="text-xs text-blue-100 leading-tight">
              {t('app.subtitle')}
            </p>
          </div>
          {/* Beta disclaimer */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded text-xs text-blue-100">
            <span className="text-blue-200">ℹ️</span>
            <span>{t('app.betaDisclaimer')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={selectedAddress
              ? `/3d-viewer?lat=${selectedAddress.coordinates[1]}&lng=${selectedAddress.coordinates[0]}&address=${encodeURIComponent(selectedAddress.address)}`
              : "/3d-viewer"
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-sm font-medium"
            title={t('viewer3d.title')}
          >
            <Box className="w-4 h-4" />
            <span className="hidden sm:inline">{t('viewer3d.viewIn3D')}</span>
          </Link>
          <LanguageSelector />
          <UserMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className={`${isMobile ? 'hidden' : 'block'} w-96 bg-white shadow-xl flex flex-col overflow-hidden`}>
          {/* Search Section */}
          <div className="p-5 border-b border-gray-200 bg-blue-50">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('search.title')}
            </h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('search.description')}
          </p>

          {/* Address Search */}
          <div className="relative">
            <AddressAutocomplete
              value={searchAddress}
              onChange={setSearchAddress}
              onSelect={handleAddressSelect}
              placeholder={t('search.placeholder')}
            />
          </div>

          {selectedAddress && (
            <div className="mt-4 space-y-2">
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{t('search.selected')}</div>
                    <div className="text-sm text-gray-700">{selectedAddress.address}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedAddress.coordinates[1].toFixed(4)}, {selectedAddress.coordinates[0].toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Controls */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-600 uppercase">{t('comparison.compare')}</div>
                  <button
                    onClick={handleToggleComparisonType}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {comparisonType === 'neighborhood' ? t('comparison.switchToHouses') : t('comparison.switchToNeighborhoods')}
                  </button>
                </div>

                <button
                  onClick={handleAddToComparison}
                  disabled={!snapshot || isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <GitCompare className="w-4 h-4" />
                  {comparisonType === 'neighborhood' ? t('comparison.addToNeighborhood') : t('comparison.addToHouse')}
                </button>

                {comparisonItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      {comparisonItems.length} / {comparisonType === 'neighborhood' ? '2' : '3'} {comparisonType === 'neighborhood' ? t('comparison.neighborhoods') : t('comparison.houses')}
                    </div>
                    <button
                      onClick={() => setShowComparison(true)}
                      className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                    >
                      {t('comparison.viewComparison')}
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Snapshot Preview */}
        {selectedAddress ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* At A Glance Summary Card */}
            <AtAGlance
              neighborhood={snapshot?.snapshot.demographics?.neighborhood || snapshot?.snapshot.demographics?.buurt}
              city={snapshot?.snapshot.demographics?.municipality}
              livabilityScore={snapshot?.snapshot.livability?.overall_score}
              safetyScore={snapshot?.snapshot.crime?.crime_rate_per_1000}
              greenScore={snapshot?.snapshot.environment?.parksNearby}
              transitScore={snapshot?.snapshot.proximity?.dist_to_train_station_km}
              warnings={0}
              goodSignals={0}
              isLoading={isLoading}
            />

            {/* === RISKS & WARNINGS SECTION === */}
            <CollapsibleSection
              title={t('sections.risks')}
              icon="🚨"
              defaultOpen={true}
            >
              {/* Red Flags & Warnings */}
              <RedFlagsCard
                coordinates={selectedAddress?.coordinates || null}
                address={selectedAddress?.address}
                isLoading={isLoading}
              />
            </CollapsibleSection>

            {/* === COSTS & VALUE SECTION === */}
            <CollapsibleSection
              title={t('sections.costs')}
              icon="💰"
              defaultOpen={true}
            >
            {/* WOZ Value Card */}
            {snapshot && snapshot.snapshot.woz && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('wozCard.title')}</h3>

                {snapshot.snapshot.woz.available && snapshot.snapshot.woz.value ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-gray-600">{t('wozCard.value2024')}</span>
                      <span className="text-lg font-bold text-gray-900">
                        €{snapshot.snapshot.woz.value.toLocaleString('nl-NL')}
                      </span>
                    </div>

                    {snapshot.snapshot.woz.historical?.woz_2024 && (
                      <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
                        <span>{t('wozCard.perSqm')}</span>
                        <span className="font-medium">€{Math.round(snapshot.snapshot.woz.historical.woz_2024 / 75).toLocaleString('nl-NL')}/m²</span>
                      </div>
                    )}

                    {snapshot.snapshot.woz.historical && (
                      <div className="pt-2 border-t border-gray-100">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            {t('wozCard.viewHistorical')}
                          </summary>
                          <div className="mt-2 space-y-1 text-gray-600">
                            {Object.entries(snapshot.snapshot.woz.historical)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .slice(0, 5)
                              .map(([year, value]: [string, any]) => (
                                <div key={year} className="flex justify-between">
                                  <span>{year.replace('woz_', '')}</span>
                                  <span>€{value?.toLocaleString('nl-NL') || 'N/A'}</span>
                                </div>
                              ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 space-y-3">
                    <p className="leading-relaxed">{t('wozCard.notIndexedYet')}</p>
                    <a
                      href="https://www.wozwaardeloket.nl/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium text-sm"
                    >
                      {t('wozCard.checkYourself')}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* WWS Rent Calculator */}
            <WWSCalculator
              initialSqm={75}
              initialEnergyLabel="C"
              initialWozValue={snapshot?.snapshot.demographics?.avg_woz_value}
            />
            </CollapsibleSection>

            {/* === LOCATION & AMENITIES SECTION === */}
            <CollapsibleSection
              title={t('sections.location')}
              icon="📍"
              defaultOpen={false}
            >
            {/* Nearby Amenities */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-900 mb-3">{t('amenities.title')}</div>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>🏪 {t('amenities.supermarkets')}</span>
                  <div className="text-right">
                    {snapshot ? (
                      <>
                        <span className="font-semibold text-gray-900">{snapshot.snapshot.amenities.supermarkets.count}</span>
                        {snapshot.snapshot.amenities.supermarkets.nearest && (
                          <div className="text-xs text-gray-500">
                            {snapshot.snapshot.amenities.supermarkets.nearest.name} · {snapshot.snapshot.amenities.supermarkets.nearest.distance}m
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">{t('snapshot.loading')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>🏥 {t('amenities.healthcare')}</span>
                  <div className="text-right">
                    {snapshot ? (
                      <>
                        <span className="font-semibold text-gray-900">{snapshot.snapshot.amenities.healthcare.count}</span>
                        {snapshot.snapshot.amenities.healthcare.nearest && (
                          <div className="text-xs text-gray-500">
                            {snapshot.snapshot.amenities.healthcare.nearest.distance}m {t('amenities.away')}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">{t('snapshot.loading')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>🎮 {t('amenities.playgrounds')}</span>
                  <div className="text-right">
                    {snapshot ? (
                      <>
                        <span className="font-semibold text-gray-900">{snapshot.snapshot.amenities.playgrounds.count}</span>
                        {snapshot.snapshot.amenities.playgrounds.nearest && (
                          <div className="text-xs text-gray-500">
                            {t('amenities.nearest')} {snapshot.snapshot.amenities.playgrounds.nearest.distance}m
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">{t('snapshot.loading')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>🌳 {t('amenities.parks')}</span>
                  <div className="text-right">
                    {snapshot ? (
                      <>
                        <span className="font-semibold text-gray-900">{snapshot.snapshot.amenities.parks.count}</span>
                        {snapshot.snapshot.amenities.parks.nearest && (
                          <div className="text-xs text-gray-500">
                            {snapshot.snapshot.amenities.parks.nearest.name} · {snapshot.snapshot.amenities.parks.nearest.distance}m
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">{t('snapshot.loading')}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </CollapsibleSection>

            {/* === NEIGHBORHOOD SECTION === */}
            <CollapsibleSection
              title={t('sections.neighborhood')}
              icon="👥"
              defaultOpen={false}
            >
            {/* Safety & Crime */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-900 mb-3">{t('crime.title')}</div>
              <div className="text-sm text-gray-600 space-y-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-gray-900 font-medium">{t('crime.crimeRate')}</span>{' '}
                    <span>{snapshot?.snapshot.crime.rate || t('crime.notAvailable')}</span>
                    {snapshot?.snapshot.crime.crime_rate_per_1000 && (
                      <SmartIndicator
                        currentValue={snapshot.snapshot.crime.crime_rate_per_1000}
                        compareValue={snapshot?.snapshot.crime_metadata?.netherlands_average || 45}
                        lowerIsBetter={true}
                      />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {t('crime.nlAverage', {
                      average: snapshot?.snapshot.crime_metadata?.netherlands_average || 45,
                      year: snapshot?.snapshot.crime_metadata?.year || 2024
                    })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {snapshot?.snapshot.crime.note || t('crime.dataFrom')}
                  </div>
                </div>

                {/* Wijkagent Information */}
                <div className="pt-3 border-t border-gray-100">
                  <details className="text-sm group">
                    <summary className="cursor-pointer bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 text-blue-700 font-medium flex items-center justify-between transition-colors">
                      <span className="flex items-center gap-2">
                        <span>🚔</span>
                        <span>{t('wijkagent.title')}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-blue-500">
                        <span className="hidden sm:inline">{t('wijkagent.clickToLearn')}</span>
                        <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-gray-700">
                      <div className="bg-blue-50 rounded p-3 border border-blue-100">
                        <p className="font-medium text-blue-900 mb-2">{t('wijkagent.whatIs')}</p>
                        <p className="text-blue-800">
                          {t('wijkagent.explanation')}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">{t('wijkagent.whatTheyDo')}</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                          <li>{t('wijkagent.roles.safety')}</li>
                          <li>{t('wijkagent.roles.knowledge')}</li>
                          <li>{t('wijkagent.roles.prevention')}</li>
                          <li>{t('wijkagent.roles.problems')}</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 rounded p-2 border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">{t('wijkagent.findYours')}</p>
                        <a
                          href={`https://www.politie.nl/mijn-buurt/wijkagenten?geoquery=${encodeURIComponent(selectedAddress.address)}&distance=5.0`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          politie.nl/mijn-buurt →
                        </a>
                        <p className="text-gray-600 mt-1 text-xs">
                          {t('wijkagent.enterPostal')}
                        </p>
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        <p className="font-medium text-gray-700 mb-1">{t('wijkagent.tipsForExpats')}</p>
                        <ul className="space-y-1">
                          <li>• {t('wijkagent.tips.english')}</li>
                          <li>• {t('wijkagent.tips.email')}</li>
                          <li>• {t('wijkagent.tips.approachable')}</li>
                          <li>• {t('wijkagent.tips.emergency')}</li>
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* Environment and Risks */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-900 mb-3">{t('environment.title')}</div>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>🌳 {t('environment.parksNearby')}</span>
                  <span className={`font-semibold ${(snapshot?.snapshot.environment.parksNearby ?? 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {snapshot?.snapshot.environment.parksNearby ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>🏞️ {t('environment.greenSpace')}</span>
                  <span className="text-gray-600">
                    {snapshot?.snapshot.environment.greenSpaceQuality || t('livability.dataUnavailable')}
                  </span>
                </div>
                {snapshot?.snapshot.environment.nearestPark && (
                  <div className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                    {t('amenities.nearest')} {snapshot.snapshot.environment.nearestPark.name} ({snapshot.snapshot.environment.nearestPark.distance}m)
                  </div>
                )}
              </div>
            </div>

            {/* Energy & Utility Costs */}
            {snapshot?.snapshot.energy_consumption && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">⚡ {t('utilities.title')}</div>

                {/* Energy Label Badge */}
                {snapshot.snapshot.energy_label?.available && (
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xl ${
                      snapshot.snapshot.energy_label.estimated_energy_label === 'A' ? 'bg-green-500' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'B' ? 'bg-lime-500' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'C' ? 'bg-yellow-500' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'D' ? 'bg-orange-400' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'E' ? 'bg-orange-500' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'F' ? 'bg-red-400' :
                      snapshot.snapshot.energy_label.estimated_energy_label === 'G' ? 'bg-red-600' :
                      'bg-gray-400'
                    }`}>
                      {snapshot.snapshot.energy_label.estimated_energy_label || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {t('utilities.energyLabel')} {snapshot.snapshot.energy_label.estimated_energy_label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {snapshot.snapshot.energy_label.energy_label_description}
                      </div>
                    </div>
                  </div>
                )}

                {snapshot.snapshot.energy_consumption.estimated_annual_cost_eur ? (
                  <>
                    {/* Total Cost Highlight */}
                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-center gap-3">
                        <div className="text-2xl font-bold text-blue-600">
                          €{snapshot.snapshot.energy_consumption.monthly_cost_eur}{t('utilities.perMonth')}
                        </div>
                        {snapshot.snapshot.energy_consumption.monthly_cost_eur && (
                          <SmartIndicator
                            currentValue={snapshot.snapshot.energy_consumption.monthly_cost_eur}
                            compareValue={180}  // Average Dutch household (CBS 2024-2025: €172-197/mo)
                            lowerIsBetter={true}
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-2 text-center">
                        €{snapshot.snapshot.energy_consumption.estimated_annual_cost_eur}{t('utilities.perYear')} {t('utilities.total')}
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-2 text-sm">
                      {/* Gas */}
                      {snapshot.snapshot.energy_consumption.cost_breakdown?.gas_eur && (
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <div>
                            <div className="text-gray-700">🔥 {t('utilities.gas')}</div>
                            <div className="text-xs text-gray-500">
                              {snapshot.snapshot.energy_consumption.avg_gas_consumption_m3} m³/year
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              €{snapshot.snapshot.energy_consumption.cost_breakdown?.gas_eur}/year
                            </div>
                            <div className="text-xs text-gray-500">
                              ~€{Math.round((snapshot.snapshot.energy_consumption.cost_breakdown?.gas_eur ?? 0) / 12)}/mo
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Electricity */}
                      {snapshot.snapshot.energy_consumption.cost_breakdown?.electricity_eur && (
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <div>
                            <div className="text-gray-700">⚡ {t('utilities.electricity')}</div>
                            <div className="text-xs text-gray-500">
                              {snapshot.snapshot.energy_consumption.avg_electricity_delivery_kwh} kWh/year
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              €{snapshot.snapshot.energy_consumption.cost_breakdown?.electricity_eur}/year
                            </div>
                            <div className="text-xs text-gray-500">
                              ~€{Math.round((snapshot.snapshot.energy_consumption.cost_breakdown?.electricity_eur ?? 0) / 12)}/mo
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Water */}
                      {snapshot.snapshot.energy_consumption.cost_breakdown?.water_eur && (
                        <div className="flex items-center justify-between pb-2">
                          <div>
                            <div className="text-gray-700">💧 {t('utilities.water')}</div>
                            <div className="text-xs text-gray-500">
                              {snapshot.snapshot.energy_consumption.avg_water_consumption_m3} m³/year (est.)
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              €{snapshot.snapshot.energy_consumption.cost_breakdown?.water_eur}/year
                            </div>
                            <div className="text-xs text-gray-500">
                              ~€{Math.round((snapshot.snapshot.energy_consumption.cost_breakdown?.water_eur ?? 0) / 12)}/mo
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* District Heating Notice */}
                    {snapshot.snapshot.energy_consumption.district_heating_percentage &&
                     snapshot.snapshot.energy_consumption.district_heating_percentage > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-600">
                        ℹ️ {snapshot.snapshot.energy_consumption.district_heating_percentage}% {t('utilities.districtHeating')}
                      </div>
                    )}

                    {/* Pricing Info */}
                    <details className="mt-3 pt-2 border-t border-gray-100 text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        ℹ️ {t('utilities.aboutCosts')}
                      </summary>
                      <div className="mt-2 space-y-1 text-gray-600">
                        <p>
                          <strong>{t('utilities.dataSource')}</strong> CBS 2024
                        </p>
                        <p>
                          <strong>{t('utilities.prices')}</strong>
                        </p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>{t('utilities.gas')}: €1.35/m³</li>
                          <li>{t('utilities.electricity')}: €0.34/kWh</li>
                          <li>{t('utilities.water')}: €2.61/m³</li>
                        </ul>
                        <p className="mt-2">
                          <strong>{t('utilities.note')}</strong> {t('utilities.noteDesc')}
                        </p>
                        <ul className="list-disc list-inside ml-2">
                          <li>{t('utilities.varFactor1')}</li>
                          <li>{t('utilities.varFactor2')}</li>
                          <li>{t('utilities.varFactor3')}</li>
                          <li>{t('utilities.varFactor4')}</li>
                        </ul>
                      </div>
                    </details>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">
                    {t('utilities.noData')}
                  </div>
                )}
              </div>
            )}

            {/* Livability Score */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-900 mb-3">{t('livability.title')}</div>
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-4xl font-bold text-blue-600">
                    {snapshot?.snapshot.livability.overall_score?.toFixed(1) || snapshot?.snapshot.livability.score || '--'}
                  </div>
                  {snapshot?.snapshot.livability.overall_score && (
                    <SmartIndicator
                      currentValue={snapshot.snapshot.livability.overall_score}
                      compareValue={0}  // National average is normalized to 0
                      lowerIsBetter={false}
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {snapshot?.snapshot.livability.note || 'NL average: 0 (higher is better)'}
                </div>
              </div>
              {snapshot?.snapshot.livability.breakdown && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
                  <div className="text-xs font-medium text-gray-700 mb-2">{t('livability.breakdown')}</div>
                  {snapshot.snapshot.livability.breakdown.physical !== null && snapshot.snapshot.livability.breakdown.physical !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('livability.physical')}</span>
                      <span className="font-semibold text-gray-900">{snapshot.snapshot.livability.breakdown.physical.toFixed(1)}</span>
                    </div>
                  )}
                  {snapshot.snapshot.livability.breakdown.social !== null && snapshot.snapshot.livability.breakdown.social !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('livability.social')}</span>
                      <span className="font-semibold text-gray-900">{snapshot.snapshot.livability.breakdown.social.toFixed(1)}</span>
                    </div>
                  )}
                  {snapshot.snapshot.livability.breakdown.safety !== null && snapshot.snapshot.livability.breakdown.safety !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('livability.safety')}</span>
                      <span className="font-semibold text-gray-900">{snapshot.snapshot.livability.breakdown.safety.toFixed(1)}</span>
                    </div>
                  )}
                  {snapshot.snapshot.livability.breakdown.facilities !== null && snapshot.snapshot.livability.breakdown.facilities !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('livability.facilities')}</span>
                      <span className="font-semibold text-gray-900">{snapshot.snapshot.livability.breakdown.facilities.toFixed(1)}</span>
                    </div>
                  )}
                  {snapshot.snapshot.livability.breakdown.housing !== null && snapshot.snapshot.livability.breakdown.housing !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('livability.housing')}</span>
                      <span className="font-semibold text-gray-900">{snapshot.snapshot.livability.breakdown.housing.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Demographics */}
            {snapshot?.snapshot.demographics && snapshot.snapshot.demographics.available && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">{t('demographics.title')}</div>
                <div className="space-y-3 text-sm">
                  {snapshot.snapshot.demographics.population && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('demographics.population')}</span>
                      <span className="font-semibold text-gray-900">
                        {snapshot.snapshot.demographics.population.toLocaleString('nl-NL')}
                      </span>
                    </div>
                  )}
                  {snapshot.snapshot.demographics.households_total && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('demographics.households')}</span>
                      <span className="font-semibold text-gray-900">
                        {snapshot.snapshot.demographics.households_total.toLocaleString('nl-NL')}
                      </span>
                    </div>
                  )}
                  {snapshot.snapshot.demographics.avg_household_size && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('demographics.avgHouseholdSize')}</span>
                      <span className="font-semibold text-gray-900">
                        {snapshot.snapshot.demographics.avg_household_size.toFixed(2)} {t('demographics.persons')}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">{t('demographics.ageDistribution')}</div>
                    {(() => {
                      const pop = snapshot.snapshot.demographics.population || 1
                      const age_0_15 = snapshot.snapshot.demographics.age_0_15 || 0
                      const age_15_25 = snapshot.snapshot.demographics.age_15_25 || 0
                      const age_25_45 = snapshot.snapshot.demographics.age_25_45 || 0
                      const age_45_65 = snapshot.snapshot.demographics.age_45_65 || 0
                      const age_65_plus = snapshot.snapshot.demographics.age_65_plus || 0

                      return (
                        <>
                          {age_0_15 > 0 && (
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{t('demographics.ageRanges.0-15')}</span>
                              <span className="text-gray-900">{Math.round((age_0_15 / pop) * 100)}%</span>
                            </div>
                          )}
                          {age_15_25 > 0 && (
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{t('demographics.ageRanges.15-25')}</span>
                              <span className="text-gray-900">{Math.round((age_15_25 / pop) * 100)}%</span>
                            </div>
                          )}
                          {age_25_45 > 0 && (
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{t('demographics.ageRanges.25-45')}</span>
                              <span className="text-gray-900">{Math.round((age_25_45 / pop) * 100)}%</span>
                            </div>
                          )}
                          {age_45_65 > 0 && (
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{t('demographics.ageRanges.45-65')}</span>
                              <span className="text-gray-900">{Math.round((age_45_65 / pop) * 100)}%</span>
                            </div>
                          )}
                          {age_65_plus > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">{t('demographics.ageRanges.65+')}</span>
                              <span className="text-gray-900">{Math.round((age_65_plus / pop) * 100)}%</span>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">{t('demographics.housing')}</div>
                    {snapshot.snapshot.demographics.pct_owner_occupied && (
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('demographics.ownerOccupied')}</span>
                        <span className="text-gray-900">{snapshot.snapshot.demographics.pct_owner_occupied}%</span>
                      </div>
                    )}
                    {snapshot.snapshot.demographics.pct_rental && (
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('demographics.rental')}</span>
                        <span className="text-gray-900">{snapshot.snapshot.demographics.pct_rental}%</span>
                      </div>
                    )}
                    {snapshot.snapshot.demographics.avg_woz_value_k && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">{t('demographics.avgWozValue')}</span>
                        <span className="text-gray-900">€ {(snapshot.snapshot.demographics.avg_woz_value_k * 1000).toLocaleString('nl-NL')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                  {snapshot.snapshot.demographics.note || 'CBS 2024 data'}
                </div>
              </div>
            )}

            {/* CBS Proximity to Facilities */}
            {snapshot?.snapshot.proximity && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">📏 {t('proximity.title')}</div>
                <div className="space-y-4 text-sm">
                  {/* Transport */}
                  {(snapshot.snapshot.proximity.dist_to_train_station_km || snapshot.snapshot.proximity.dist_to_highway_onramp_km) && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">{t('proximity.transport')}</div>
                      <div className="space-y-1">
                        {snapshot.snapshot.proximity.dist_to_train_station_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.trainStation')}</span>
                            <span className="text-gray-900 font-medium">{snapshot.snapshot.proximity.dist_to_train_station_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_major_train_station_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.majorTrainStation')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_major_train_station_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_highway_onramp_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.highwayOnramp')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_highway_onramp_km.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Shopping */}
                  {(snapshot.snapshot.proximity.dist_to_supermarket_km || snapshot.snapshot.proximity.dist_to_daily_groceries_km) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">{t('proximity.shopping')}</div>
                      <div className="space-y-1">
                        {snapshot.snapshot.proximity.dist_to_supermarket_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.largeSupermarket')}</span>
                            <span className="text-gray-900 font-medium">{snapshot.snapshot.proximity.dist_to_supermarket_km.toFixed(1)} km</span>
                            {snapshot.snapshot.proximity.supermarket_within_1km !== undefined && (
                              <span className="text-gray-500 ml-2">({snapshot.snapshot.proximity.supermarket_within_1km.toFixed(1)} {t('proximity.withinKm')})</span>
                            )}
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_daily_groceries_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.dailyGroceries')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_daily_groceries_km.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Healthcare */}
                  {(snapshot.snapshot.proximity.dist_to_gp_km || snapshot.snapshot.proximity.dist_to_hospital_km) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">{t('proximity.healthcare')}</div>
                      <div className="space-y-1">
                        {snapshot.snapshot.proximity.dist_to_gp_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.gp')}</span>
                            <span className="text-gray-900 font-medium">{snapshot.snapshot.proximity.dist_to_gp_km.toFixed(1)} km</span>
                            {snapshot.snapshot.proximity.gp_within_1km !== undefined && (
                              <span className="text-gray-500 ml-2">({snapshot.snapshot.proximity.gp_within_1km.toFixed(1)} {t('proximity.withinKm')})</span>
                            )}
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_pharmacy_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.pharmacy')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_pharmacy_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_hospital_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.hospital')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_hospital_km.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Education & Childcare */}
                  {(snapshot.snapshot.proximity.dist_to_primary_school_km || snapshot.snapshot.proximity.dist_to_daycare_km) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">{t('proximity.education')}</div>
                      <div className="space-y-1">
                        {snapshot.snapshot.proximity.dist_to_primary_school_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.primarySchool')}</span>
                            <span className="text-gray-900 font-medium">{snapshot.snapshot.proximity.dist_to_primary_school_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_daycare_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.daycare')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_daycare_km.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Culture & Recreation */}
                  {(snapshot.snapshot.proximity.dist_to_library_km || snapshot.snapshot.proximity.dist_to_museum_km || snapshot.snapshot.proximity.dist_to_cinema_km) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">{t('proximity.culture')}</div>
                      <div className="space-y-1">
                        {snapshot.snapshot.proximity.dist_to_library_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.library')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_library_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_museum_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.museum')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_museum_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_cinema_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.cinema')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_cinema_km.toFixed(1)} km</span>
                          </div>
                        )}
                        {snapshot.snapshot.proximity.dist_to_swimming_pool_km && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{t('proximity.swimmingPool')}</span>
                            <span className="text-gray-900">{snapshot.snapshot.proximity.dist_to_swimming_pool_km.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                  {t('proximity.officialMetrics')} {snapshot.snapshot.proximity.area_name}
                </div>
              </div>
            )}

            {/* Emergency Services */}
            {snapshot?.snapshot.emergency_services && snapshot.snapshot.emergency_services.count > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  {t('emergencyServices.title')} ({snapshot.snapshot.emergency_services.count})
                </div>
                <div className="space-y-2">
                  {snapshot.snapshot.emergency_services.items.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="mr-2">
                          {item.type?.includes('fire') ? '🚒' : item.type?.includes('police') ? '👮' : '🚑'}
                        </span>
                        <span className="text-gray-700">{item.name || item.type}</span>
                      </div>
                      <span className="text-gray-500">{item.distance_km?.toFixed(1)} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cultural Amenities */}
            {snapshot?.snapshot.cultural_amenities && snapshot.snapshot.cultural_amenities.count > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  {t('culturalAmenities.title')} ({snapshot.snapshot.cultural_amenities.count})
                </div>
                <div className="space-y-2">
                  {snapshot.snapshot.cultural_amenities.items.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="mr-2">
                          {item.type?.includes('museum') ? '🏛️' :
                           item.type?.includes('theater') || item.type?.includes('theatre') ? '🎭' :
                           item.type?.includes('library') ? '📚' :
                           item.type?.includes('cinema') ? '🎬' : '🎨'}
                        </span>
                        <span className="text-gray-700">{item.name || item.type}</span>
                      </div>
                      <span className="text-gray-500">{item.distance_km?.toFixed(1)} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Healthcare Facilities (Expanded) */}
            {snapshot?.snapshot.healthcare_facilities && snapshot.snapshot.healthcare_facilities.count > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  {t('healthcareFacilities.title')} ({snapshot.snapshot.healthcare_facilities.count})
                </div>
                <div className="space-y-2">
                  {snapshot.snapshot.healthcare_facilities.items.slice(0, 6).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="mr-2">
                          {item.type?.includes('hospital') ? '🏥' :
                           item.type?.includes('pharmacy') || item.type?.includes('apotheek') ? '💊' :
                           item.type?.includes('dentist') ? '🦷' :
                           item.type?.includes('doctor') || item.type?.includes('gp') ? '👨‍⚕️' : '🩺'}
                        </span>
                        <span className="text-gray-700">{item.name || item.type}</span>
                      </div>
                      <span className="text-gray-500">{item.distance_km?.toFixed(1)} km</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                  {t('healthcareFacilities.description')}
                </div>
              </div>
            )}

            {/* Gemeente (Municipality) Info */}
            {snapshot?.snapshot.demographics?.municipality && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-3">{t('municipality.title')}</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-gray-600">{t('municipality.gemeente')}</span>
                    <span className="font-semibold text-gray-900">
                      {snapshot.snapshot.demographics.municipality}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 font-medium">{t('municipality.quickLinks')}</p>
                    <div className="flex flex-col gap-2">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          snapshot.snapshot.demographics.municipality + ' gemeente website'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {t('municipality.website')}
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          snapshot.snapshot.demographics.municipality + ' afvalkalender'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-700 hover:underline"
                      >
                        {t('municipality.trash')}
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          snapshot.snapshot.demographics.municipality + ' parkeervergunning'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-700 hover:underline"
                      >
                        {t('municipality.parking')}
                      </a>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded p-3 text-xs text-blue-800 border border-blue-100">
                    <p><strong>{t('municipality.tipForExpats')}</strong> {t('municipality.tipDesc')}</p>
                  </div>
                </div>
              </div>
            )}
            </CollapsibleSection>

            {/* Optional: Work Commute */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900 mb-2">
                {t('travelTimeCard.title')}
              </div>
              <div className="text-xs text-blue-700 mb-3">
                {t('travelTimeCard.description')}
              </div>

              {!showWorkAddressInput && !selectedWorkAddress && (
                <button
                  onClick={() => setShowWorkAddressInput(true)}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('travelTimeCard.addCommute')}
                </button>
              )}

              {showWorkAddressInput && !selectedWorkAddress && (
                <div className="space-y-2">
                  <AddressAutocomplete
                    value={workAddress}
                    onChange={setWorkAddress}
                    onSelect={handleWorkAddressSelect}
                    placeholder={t('travelTimeCard.enterWorkAddress')}
                  />
                  <button
                    onClick={() => setShowWorkAddressInput(false)}
                    className="w-full py-1 px-3 text-sm text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    {t('travelTimeCard.cancel')}
                  </button>
                </div>
              )}

              {selectedWorkAddress && travelTime && (
                <div className="space-y-3">
                  <div className="bg-white rounded-md p-3 border border-blue-200">
                    <div className="text-xs font-medium text-gray-700 mb-1">{t('travelTimeCard.workAddress')}</div>
                    <div className="text-sm text-gray-900">{selectedWorkAddress.address}</div>
                  </div>

                  <div className="text-xs font-medium text-blue-900 mb-2">{t('travelTimeCard.estimatedCommute')}</div>

                  <div className="space-y-2 text-sm">
                    {travelTime.byBike && (
                      <div className="flex items-center justify-between bg-white rounded-md p-2 border border-blue-100">
                        <span className="flex items-center gap-2">
                          <span>🚴</span>
                          <span className="text-gray-700">{t('travelTimeCard.byBike')}</span>
                        </span>
                        <span className="font-semibold text-gray-900">{Math.round(travelTime.byBike)} min</span>
                      </div>
                    )}

                    {travelTime.byCar && (
                      <div className="flex items-center justify-between bg-white rounded-md p-2 border border-blue-100">
                        <span className="flex items-center gap-2">
                          <span>🚗</span>
                          <span className="text-gray-700">{t('travelTimeCard.byCar')}</span>
                        </span>
                        <span className="font-semibold text-gray-900">{Math.round(travelTime.byCar)} min</span>
                      </div>
                    )}

                    {!travelTime.byBike && !travelTime.byCar && (
                      <div className="text-gray-500 text-sm">
                        {t('travelTimeCard.calculating')}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-blue-600 mt-2">
                    {t('travelTimeCard.actualRoutes')}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWorkAddress(null)
                      setTravelTime(null)
                      setWorkAddress('')
                    }}
                    className="w-full py-1 px-3 text-sm text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    {t('travelTimeCard.changeAddress')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('snapshot.startSearch')}
              </h3>
              <p className="text-sm text-gray-600 max-w-xs mx-auto">
                {t('snapshot.startSearchDescription')}
              </p>

              <div className="mt-8 space-y-3 text-left max-w-sm mx-auto">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  {t('snapshot.discover')}
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="text-blue-600 mt-0.5">✓</div>
                  <div>{t('snapshot.discoverItems.crime')}</div>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="text-blue-600 mt-0.5">✓</div>
                  <div>{t('snapshot.discoverItems.amenities')}</div>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="text-blue-600 mt-0.5">✓</div>
                  <div>{t('snapshot.discoverItems.environment')}</div>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="text-blue-600 mt-0.5">✓</div>
                  <div>{t('snapshot.discoverItems.demographics')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="text-center space-y-3">
            {/* Built with love message */}
            <div className="text-sm text-gray-700 font-medium">
              {t('app.builtWith')}
            </div>

            {/* Data sources - collapsible */}
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700 inline-flex items-center gap-1 group">
                <span>📊</span>
                <span>Data sources</span>
                <span className="ml-1 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 space-y-1.5 text-left bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
                  <span className="text-gray-600 font-medium">Demographics:</span>
                  <a href="https://www.cbs.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CBS</a>

                  <span className="text-gray-600 font-medium">Crime:</span>
                  <a href="https://www.politie.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Politie.nl</a>

                  <span className="text-gray-600 font-medium">Livability:</span>
                  <a href="https://www.leefbaarometer.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Leefbaarometer</a>

                  <span className="text-gray-600 font-medium">WOZ:</span>
                  <a href="https://www.wozwaardeloket.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">WOZwaardeloket.nl</a>

                  <span className="text-gray-600 font-medium">Amenities:</span>
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenStreetMap</a>

                  <span className="text-gray-600 font-medium">Foundation risk:</span>
                  <a href="https://www.pdok.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">KCAF/PDOK</a>

                  <span className="text-gray-600 font-medium">Air quality:</span>
                  <a href="https://www.luchtmeetnet.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Luchtmeetnet</a>

                  <span className="text-gray-600 font-medium">Travel times:</span>
                  <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenRouteService</a>

                  <span className="text-gray-600 font-medium">Energy costs:</span>
                  <a href="https://www.cbs.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CBS OpenData</a>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            destinations={selectedAddress ? [{
              id: '1',
              label: 'Selected Property',
              address: selectedAddress.address,
              maxMinutes: 0,  // Set to 0 to not show travel time circles
              modes: [],
              coordinates: selectedAddress.coordinates
            }] : []}
            propertyFilters={{}}
            amenities={snapshot?.snapshot.amenities}
            areaCode={snapshot?.area_code}
          />

          {/* Mobile Search Bar - Floating on map */}
          {isMobile && (
            <div className="absolute top-4 left-4 right-4 z-30">
              <div className="bg-white rounded-xl shadow-lg p-3">
                <AddressAutocomplete
                  value={searchAddress}
                  onChange={setSearchAddress}
                  onSelect={handleAddressSelect}
                  placeholder={t('search.placeholder')}
                />
                {selectedAddress && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600 px-1">
                    <span className="truncate flex-1">{selectedAddress.address}</span>
                    <button
                      onClick={() => setMobileSheetOpen(true)}
                      className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && selectedAddress && (
        <MobileBottomSheet
          isOpen={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
          summaryContent={
            <div className="flex items-center gap-2" onClick={() => setMobileSheetOpen(true)}>
              <AtAGlance
                neighborhood={snapshot?.snapshot.demographics?.neighborhood || snapshot?.snapshot.demographics?.buurt}
                city={snapshot?.snapshot.demographics?.municipality}
                livabilityScore={snapshot?.snapshot.livability?.overall_score}
                safetyScore={snapshot?.snapshot.crime?.crime_rate_per_1000}
                greenScore={snapshot?.snapshot.environment?.parksNearby}
                transitScore={snapshot?.snapshot.proximity?.dist_to_train_station_km}
                warnings={0}
                goodSignals={0}
                isLoading={isLoading}
              />
            </div>
          }
        >
          {/* Reuse sidebar content */}
          <div className="p-4 space-y-3">
            <AtAGlance
              neighborhood={snapshot?.snapshot.demographics?.neighborhood || snapshot?.snapshot.demographics?.buurt}
              city={snapshot?.snapshot.demographics?.municipality}
              livabilityScore={snapshot?.snapshot.livability?.overall_score}
              safetyScore={snapshot?.snapshot.crime?.crime_rate_per_1000}
              greenScore={snapshot?.snapshot.environment?.parksNearby}
              transitScore={snapshot?.snapshot.proximity?.dist_to_train_station_km}
              warnings={0}
              goodSignals={0}
              isLoading={isLoading}
            />

            {/* Risks Section */}
            <CollapsibleSection title={t('sections.risks')} icon="🚨" defaultOpen={true}>
              <RedFlagsCard
                coordinates={selectedAddress?.coordinates || null}
                address={selectedAddress?.address}
                isLoading={isLoading}
              />
            </CollapsibleSection>

            {/* Costs Section */}
            <CollapsibleSection title={t('sections.costs')} icon="💰" defaultOpen={false}>
              {snapshot?.snapshot.woz && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('wozCard.title')}</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    €{snapshot.snapshot.woz.value?.toLocaleString() || '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Reference year: {snapshot.snapshot.woz.year || '2024'}
                  </p>
                </div>
              )}
              <WWSCalculator
                initialSqm={75}
                initialEnergyLabel="C"
                initialWozValue={snapshot?.snapshot.demographics?.avg_woz_value}
              />
            </CollapsibleSection>

            {/* Location Section */}
            <CollapsibleSection title={t('sections.location')} icon="📍" defaultOpen={false}>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-2">{t('amenities.title')}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>🏪 Supermarkets</span>
                    <span>{snapshot?.snapshot.amenities?.supermarkets?.count || 0} nearby</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🏥 Healthcare</span>
                    <span>{snapshot?.snapshot.amenities?.healthcare?.count || 0} nearby</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🛝 Playgrounds</span>
                    <span>{snapshot?.snapshot.amenities?.playgrounds?.count || 0} nearby</span>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Neighborhood Section */}
            <CollapsibleSection title={t('sections.neighborhood')} icon="👥" defaultOpen={false}>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-900 mb-2">{t('livability.title')}</div>
                <div className="text-center py-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {snapshot?.snapshot.livability?.overall_score?.toFixed(1) || '--'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{t('livability.leefbaarometer')}</p>
                </div>
              </div>
              {snapshot?.snapshot.crime && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-900 mb-2">{t('crime.title')}</div>
                  <div className="text-sm text-gray-600">
                    <span>{t('crime.crimeRate')}: </span>
                    <span className="font-medium">{snapshot.snapshot.crime.rate || t('crime.notAvailable')}</span>
                  </div>
                </div>
              )}
            </CollapsibleSection>
          </div>
        </MobileBottomSheet>
      )}

      {/* Comparison Panel */}
      {showComparison && (
        <ComparisonPanel
          items={comparisonItems}
          type={comparisonType}
          onRemove={handleRemoveFromComparison}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg">
            <span className="text-sm">{toastMessage}</span>
            <button
              onClick={() => setShowToast(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
