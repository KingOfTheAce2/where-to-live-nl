'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import PropertyFilters from '@/components/PropertyFilters'
import type { PropertyFilters as Filters } from '@/types/property'

// Dynamically import Map component (MapLibre requires window object)
const MapView = dynamic(() => import('@/components/Map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Loading map...</p>
    </div>
  ),
})

export type Destination = {
  id: string
  label: string
  address: string
  maxMinutes: number
  modes: ('bike' | 'pt' | 'both')[]
  coordinates?: [number, number]  // [lng, lat]
}

export default function HomePage() {
  const [destinations, setDestinations] = useState<Destination[]>([
    {
      id: '1',
      label: 'Work',
      address: '',
      maxMinutes: 30,
      modes: ['both'],
    },
  ])

  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null)
  const [propertyFilters, setPropertyFilters] = useState<Filters>({})
  const [showFilters, setShowFilters] = useState(false)

  const addDestination = () => {
    const newId = (destinations.length + 1).toString()
    setDestinations([
      ...destinations,
      {
        id: newId,
        label: `Destination ${newId}`,
        address: '',
        maxMinutes: 30,
        modes: ['both'],
      },
    ])
  }

  const updateDestination = (id: string, updates: Partial<Destination>) => {
    setDestinations(destinations.map(d =>
      d.id === id ? { ...d, ...updates } : d
    ))
  }

  const removeDestination = (id: string) => {
    setDestinations(destinations.filter(d => d.id !== id))
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-96 bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Find Your Perfect Neighborhood
          </h1>
          <p className="text-sm text-gray-600">
            Where do you need to be? Add your important destinations below.
          </p>
        </div>

        {/* Destinations List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {destinations.map((dest, index) => (
            <div
              key={dest.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-400 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  <input
                    type="text"
                    value={dest.label}
                    onChange={(e) => updateDestination(dest.id, { label: e.target.value })}
                    className="font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    placeholder="Label"
                  />
                </div>
                {destinations.length > 1 && (
                  <button
                    onClick={() => removeDestination(dest.id)}
                    className="text-gray-400 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Address Autocomplete */}
              <div className="mb-3">
                <AddressAutocomplete
                  value={dest.address}
                  onChange={(value) => updateDestination(dest.id, { address: value })}
                  onSelect={(address, coordinates) => {
                    updateDestination(dest.id, {
                      address,
                      coordinates,
                    })
                  }}
                  placeholder="Search for address..."
                />
              </div>

              {/* Time Slider */}
              <div className="mb-3">
                <label className="text-sm text-gray-700 mb-1 block">
                  Max travel time: <span className="font-semibold">{dest.maxMinutes} min</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={dest.maxMinutes}
                  onChange={(e) => updateDestination(dest.id, { maxMinutes: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
              </div>

              {/* Travel Modes */}
              <div>
                <label className="text-sm text-gray-700 mb-2 block">Travel mode:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateDestination(dest.id, { modes: ['bike'] })}
                    className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                      dest.modes.includes('bike') && !dest.modes.includes('pt')
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🚴 Bike
                  </button>
                  <button
                    onClick={() => updateDestination(dest.id, { modes: ['pt'] })}
                    className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                      dest.modes.includes('pt') && !dest.modes.includes('bike')
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🚊 Transit
                  </button>
                  <button
                    onClick={() => updateDestination(dest.id, { modes: ['both'] })}
                    className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                      dest.modes.includes('both')
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🚴+🚊 Both
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add Destination Button */}
          {destinations.length < 5 && (
            <button
              onClick={addDestination}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add another destination
            </button>
          )}

          {/* Property Filters Toggle */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between text-left font-semibold text-gray-900 hover:text-primary-600 transition-colors"
            >
              <span>Property Filters</span>
              {showFilters ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            {showFilters && (
              <div className="mt-4">
                <PropertyFilters
                  onFiltersChange={setPropertyFilters}
                  initialFilters={propertyFilters}
                />
              </div>
            )}
          </div>
        </div>

        {/* Calculate Button */}
        <div className="p-6 border-t border-gray-200">
          <button
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={destinations.some(d => !d.address)}
          >
            Show me where to live
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            {destinations.filter(d => d.address).length} of {destinations.length} destinations set
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView destinations={destinations} propertyFilters={propertyFilters} />
      </div>
    </div>
  )
}
