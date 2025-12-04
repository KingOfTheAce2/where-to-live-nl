'use client'

import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export type ComparisonType = 'neighborhood' | 'house'

export type ComparisonItem = {
  id: string
  address: string
  coordinates: [number, number]
  areaCode?: string
  snapshot: any // Full snapshot data
}

type ComparisonPanelProps = {
  items: ComparisonItem[]
  type: ComparisonType
  onRemove: (id: string) => void
  onClose: () => void
}

export default function ComparisonPanel({ items, type, onRemove, onClose }: ComparisonPanelProps) {
  if (items.length === 0) return null

  const maxItems = type === 'neighborhood' ? 2 : 3
  const itemsToShow = items.slice(0, maxItems)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {type === 'neighborhood' ? 'Neighborhood' : 'House'} Comparison
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                {type === 'neighborhood'
                  ? 'Compare up to 2 neighborhoods side-by-side'
                  : 'Compare up to 3 houses side-by-side'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`grid ${itemsToShow.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-6`}>
            {itemsToShow.map((item, index) => (
              <div key={item.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                {/* Item Header */}
                <div className="p-4 bg-blue-600 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">
                        {type === 'neighborhood' ? 'Neighborhood' : 'Property'} #{index + 1}
                      </div>
                      <div className="text-sm">{item.address}</div>
                      {item.areaCode && (
                        <div className="text-xs text-blue-100 mt-1">
                          Area: {item.areaCode}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Data Sections */}
                <div className="p-4 space-y-4">
                  {item.snapshot ? (
                    <>
                      {/* Crime Rate */}
                      {item.snapshot.snapshot.crime && (
                        <ComparisonMetric
                          label="Crime Rate"
                          value={item.snapshot.snapshot.crime.crime_rate_per_1000
                            ? `${item.snapshot.snapshot.crime.crime_rate_per_1000.toFixed(2)}/1000`
                            : 'N/A'}
                          icon="🛡️"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.crime?.crime_rate_per_1000}
                          lowerIsBetter={true}
                        />
                      )}

                      {/* Livability Score */}
                      {item.snapshot.snapshot.livability && item.snapshot.snapshot.livability.overall_score && (
                        <ComparisonMetric
                          label="Livability Score"
                          value={`${item.snapshot.snapshot.livability.overall_score.toFixed(1)}/10`}
                          icon="⭐"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.livability?.overall_score}
                          lowerIsBetter={false}
                        />
                      )}

                      {/* Air Quality */}
                      {item.snapshot.snapshot.air_quality && item.snapshot.snapshot.air_quality.pm25 && (
                        <ComparisonMetric
                          label="Air Quality (PM2.5)"
                          value={`${item.snapshot.snapshot.air_quality.pm25.toFixed(1)} µg/m³`}
                          icon="🌬️"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.air_quality?.pm25}
                          lowerIsBetter={true}
                        />
                      )}

                      {/* Nearest Train Station */}
                      {item.snapshot.snapshot.nearest_train_station && (
                        <ComparisonMetric
                          label="Train Station Distance"
                          value={`${(item.snapshot.snapshot.nearest_train_station.distance_km).toFixed(1)} km - ${item.snapshot.snapshot.nearest_train_station.name}`}
                          icon="🚉"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.nearest_train_station?.distance_km}
                          lowerIsBetter={true}
                        />
                      )}

                      {/* Demographics */}
                      {item.snapshot.snapshot.demographics && (
                        <>
                          <ComparisonMetric
                            label="Population"
                            value={item.snapshot.snapshot.demographics.population?.toLocaleString() || 'N/A'}
                            icon="👥"
                          />
                          <ComparisonMetric
                            label="Avg Household Size"
                            value={item.snapshot.snapshot.demographics.avg_household_size
                              ? `${item.snapshot.snapshot.demographics.avg_household_size.toFixed(1)} persons`
                              : 'N/A'}
                            icon="🏠"
                          />

                          {/* Age Distribution */}
                          {item.snapshot.snapshot.demographics.age_0_15 !== undefined && (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-gray-600 uppercase">Age Distribution</div>
                              <div className="text-sm space-y-1">
                                <div>👶 0-15: {Math.round((item.snapshot.snapshot.demographics.age_0_15 / item.snapshot.snapshot.demographics.population) * 100)}%</div>
                                <div>🎓 15-25: {Math.round((item.snapshot.snapshot.demographics.age_15_25 / item.snapshot.snapshot.demographics.population) * 100)}%</div>
                                <div>💼 25-45: {Math.round((item.snapshot.snapshot.demographics.age_25_45 / item.snapshot.snapshot.demographics.population) * 100)}%</div>
                                <div>🏡 45-65: {Math.round((item.snapshot.snapshot.demographics.age_45_65 / item.snapshot.snapshot.demographics.population) * 100)}%</div>
                                <div>👴 65+: {Math.round((item.snapshot.snapshot.demographics.age_65_plus / item.snapshot.snapshot.demographics.population) * 100)}%</div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Amenities */}
                      {item.snapshot.snapshot.amenities && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-600 uppercase">Amenities (2km)</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>🏪 {item.snapshot.snapshot.amenities.supermarkets.count} Supermarkets</div>
                            <div>🏥 {item.snapshot.snapshot.amenities.healthcare.count} Healthcare</div>
                            <div>🎮 {item.snapshot.snapshot.amenities.playgrounds.count} Playgrounds</div>
                            <div>🌳 {item.snapshot.snapshot.amenities.parks.count} Parks</div>
                          </div>
                        </div>
                      )}

                      {/* Energy Consumption */}
                      {item.snapshot.snapshot.energy_consumption && (
                        <ComparisonMetric
                          label="Monthly Energy Cost"
                          value={`€${item.snapshot.snapshot.energy_consumption.monthly_cost_eur}/mo`}
                          icon="⚡"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.energy_consumption?.monthly_cost_eur}
                          lowerIsBetter={true}
                        />
                      )}

                      {/* Average WOZ Value */}
                      {item.snapshot.snapshot.demographics?.avg_woz_value && (
                        <ComparisonMetric
                          label="Avg Property Value"
                          value={`€${item.snapshot.snapshot.demographics.avg_woz_value.toLocaleString()}`}
                          icon="💰"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.demographics?.avg_woz_value}
                          lowerIsBetter={false}
                        />
                      )}

                      {/* Housing Mix */}
                      {item.snapshot.snapshot.demographics && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-600 uppercase">Housing</div>
                          <div className="text-sm space-y-1">
                            {item.snapshot.snapshot.demographics.owner_occupied_pct && (
                              <div>🏘️ {item.snapshot.snapshot.demographics.owner_occupied_pct.toFixed(0)}% Owner Occupied</div>
                            )}
                            {item.snapshot.snapshot.demographics.rental_pct && (
                              <div>🔑 {item.snapshot.snapshot.demographics.rental_pct.toFixed(0)}% Rental</div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      Loading data...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
          {itemsToShow.length < maxItems && (
            <p>Add {maxItems - itemsToShow.length} more {type === 'neighborhood' ? 'neighborhood' : 'house'}(s) to compare</p>
          )}
          {itemsToShow.length === maxItems && (
            <p>Maximum {maxItems} {type === 'neighborhood' ? 'neighborhoods' : 'houses'} reached</p>
          )}
        </div>
      </div>
    </div>
  )
}

type ComparisonMetricProps = {
  label: string
  value: string
  icon: string
  items?: ComparisonItem[]
  currentIndex?: number
  getValue?: (item: ComparisonItem) => number | undefined
  lowerIsBetter?: boolean
}

function ComparisonMetric({
  label,
  value,
  icon,
  items,
  currentIndex,
  getValue,
  lowerIsBetter = false
}: ComparisonMetricProps) {
  let indicator = null

  // Show comparison indicators if we have multiple items and a getValue function
  if (items && items.length > 1 && getValue !== undefined && currentIndex !== undefined) {
    const currentValue = getValue(items[currentIndex])
    if (currentValue !== undefined && currentValue !== null) {
      const otherValues = items
        .map((item, idx) => idx !== currentIndex ? getValue(item) : undefined)
        .filter((v): v is number => v !== undefined && v !== null)

      if (otherValues.length > 0) {
        const avgOthers = otherValues.reduce((a, b) => a + b, 0) / otherValues.length
        const diff = ((currentValue - avgOthers) / avgOthers) * 100

        if (Math.abs(diff) > 5) { // Only show if difference > 5%
          const isBetter = lowerIsBetter ? diff < 0 : diff > 0
          const isWorse = lowerIsBetter ? diff > 0 : diff < 0

          if (isBetter) {
            indicator = (
              <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                {Math.abs(diff).toFixed(0)}% better than other{items.length > 2 ? 's' : ''}
              </div>
            )
          } else if (isWorse) {
            indicator = (
              <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                <TrendingDown className="w-3 h-3" />
                {Math.abs(diff).toFixed(0)}% worse than other{items.length > 2 ? 's' : ''}
              </div>
            )
          } else {
            indicator = (
              <div className="flex items-center gap-1 text-gray-500 text-xs font-medium">
                <Minus className="w-3 h-3" />
                Similar to other{items.length > 2 ? 's' : ''}
              </div>
            )
          }
        }
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-gray-900">{value}</div>
        {indicator}
      </div>
    </div>
  )
}
