'use client'

import { useState } from 'react'
import type { PropertyFilters as Filters, PropertyType } from '@/types/property'
import { getPropertyTypeLabel } from '@/types/property'
import { useTranslations } from 'next-intl'

interface PropertyFiltersProps {
  onFiltersChange: (filters: Filters) => void
  initialFilters?: Filters
}

export default function PropertyFilters({
  onFiltersChange,
  initialFilters = {},
}: PropertyFiltersProps) {
  const t = useTranslations('filters')
  const [minPrice, setMinPrice] = useState<number | undefined>(initialFilters.minPrice)
  const [maxPrice, setMaxPrice] = useState<number | undefined>(initialFilters.maxPrice)
  const [selectedTypes, setSelectedTypes] = useState<PropertyType[]>(
    initialFilters.propertyTypes || []
  )
  const [minRooms, setMinRooms] = useState<number | undefined>(initialFilters.minRooms)
  const [maxRooms, setMaxRooms] = useState<number | undefined>(initialFilters.maxRooms)
  const [minArea, setMinArea] = useState<number | undefined>(initialFilters.minArea)
  const [maxArea, setMaxArea] = useState<number | undefined>(initialFilters.maxArea)

  const propertyTypes: PropertyType[] = [
    'appartement',
    'tussenwoning',
    'hoekwoning',
    'vrijstaand',
    '2-onder-1-kap',
  ]

  const handleApplyFilters = () => {
    const filters: Filters = {}

    if (minPrice !== undefined && minPrice > 0) filters.minPrice = minPrice
    if (maxPrice !== undefined && maxPrice > 0) filters.maxPrice = maxPrice
    if (selectedTypes.length > 0) filters.propertyTypes = selectedTypes
    if (minRooms !== undefined && minRooms > 0) filters.minRooms = minRooms
    if (maxRooms !== undefined && maxRooms > 0) filters.maxRooms = maxRooms
    if (minArea !== undefined && minArea > 0) filters.minArea = minArea
    if (maxArea !== undefined && maxArea > 0) filters.maxArea = maxArea

    onFiltersChange(filters)
  }

  const handleResetFilters = () => {
    setMinPrice(undefined)
    setMaxPrice(undefined)
    setSelectedTypes([])
    setMinRooms(undefined)
    setMaxRooms(undefined)
    setMinArea(undefined)
    setMaxArea(undefined)
    onFiltersChange({})
  }

  const togglePropertyType = (type: PropertyType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const hasActiveFilters =
    minPrice !== undefined ||
    maxPrice !== undefined ||
    selectedTypes.length > 0 ||
    minRooms !== undefined ||
    maxRooms !== undefined ||
    minArea !== undefined ||
    maxArea !== undefined

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{t('title')}</h3>
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {t('resetAll')}
          </button>
        )}
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('priceRange')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              placeholder={t('minPrice')}
              value={minPrice || ''}
              onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder={t('maxPrice')}
              value={maxPrice || ''}
              onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        {/* Quick price buttons */}
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            { label: '< €300k', max: 300000 },
            { label: '€300k-500k', min: 300000, max: 500000 },
            { label: '€500k-750k', min: 500000, max: 750000 },
            { label: '> €750k', min: 750000 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setMinPrice(preset.min)
                setMaxPrice(preset.max)
              }}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('propertyType')}
        </label>
        <div className="space-y-2">
          {propertyTypes.map((type) => (
            <label key={type} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => togglePropertyType(type)}
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">
                {getPropertyTypeLabel(type)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Number of Rooms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('numberOfRooms')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              placeholder={t('min')}
              min="1"
              max="10"
              value={minRooms || ''}
              onChange={(e) => setMinRooms(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder={t('max')}
              min="1"
              max="10"
              value={maxRooms || ''}
              onChange={(e) => setMaxRooms(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        {/* Quick room buttons */}
        <div className="mt-2 flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map((rooms) => (
            <button
              key={rooms}
              onClick={() => setMinRooms(rooms)}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              {rooms}+ {t('rooms')}
            </button>
          ))}
        </div>
      </div>

      {/* Living Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('livingArea')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              placeholder={t('minArea')}
              value={minArea || ''}
              onChange={(e) => setMinArea(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder={t('maxArea')}
              value={maxArea || ''}
              onChange={(e) => setMaxArea(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        {/* Quick area buttons */}
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            { label: '< 75m²', max: 75 },
            { label: '75-100m²', min: 75, max: 100 },
            { label: '100-150m²', min: 100, max: 150 },
            { label: '> 150m²', min: 150 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setMinArea(preset.min)
                setMaxArea(preset.max)
              }}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Apply Button */}
      <button
        onClick={handleApplyFilters}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        {t('applyFilters')}
      </button>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-medium">{t('activeFilters')}</div>
          {minPrice && <div>• {t('minPriceLabel')} €{minPrice.toLocaleString('nl-NL')}</div>}
          {maxPrice && <div>• {t('maxPriceLabel')} €{maxPrice.toLocaleString('nl-NL')}</div>}
          {selectedTypes.length > 0 && (
            <div>• {t('types')} {selectedTypes.map(getPropertyTypeLabel).join(', ')}</div>
          )}
          {minRooms && <div>• {t('minRoomsLabel')} {minRooms}</div>}
          {maxRooms && <div>• {t('maxRoomsLabel')} {maxRooms}</div>}
          {minArea && <div>• {t('minAreaLabel')} {minArea}m²</div>}
          {maxArea && <div>• {t('maxAreaLabel')} {maxArea}m²</div>}
        </div>
      )}
    </div>
  )
}
