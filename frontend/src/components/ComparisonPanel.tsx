'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Download, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { generateComparisonPDF, hasPremiumAccess } from '@/lib/pdfExport'

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
  const t = useTranslations('comparisonPanel')
  const [isExporting, setIsExporting] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  if (items.length === 0) return null

  const maxItems = type === 'neighborhood' ? 2 : 3
  const itemsToShow = items.slice(0, maxItems)

  const handleExportPDF = async () => {
    if (!hasPremiumAccess()) {
      setShowPremiumModal(true)
      return
    }

    setIsExporting(true)
    try {
      await generateComparisonPDF(itemsToShow, type, t)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(t('exportError'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {type === 'neighborhood' ? t('neighborhoodComparison') : t('houseComparison')}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                {type === 'neighborhood'
                  ? t('compareNeighborhoods')
                  : t('compareHouses')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* PDF Export Button */}
              <button
                onClick={handleExportPDF}
                disabled={isExporting || itemsToShow.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
                title={t('exportPDF')}
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t('exportPDF')}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
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
                        {type === 'neighborhood' ? t('neighborhood') : t('property')} #{index + 1}
                      </div>
                      <div className="text-sm">{item.address}</div>
                      {item.areaCode && (
                        <div className="text-xs text-blue-100 mt-1">
                          {t('area')} {item.areaCode}
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
                          label={t('crimeRate')}
                          value={item.snapshot.snapshot.crime.crime_rate_per_1000
                            ? `${item.snapshot.snapshot.crime.crime_rate_per_1000.toFixed(2)}/1000`
                            : 'N/A'}
                          icon="🛡️"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.crime?.crime_rate_per_1000}
                          lowerIsBetter={true}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Livability Score */}
                      {item.snapshot.snapshot.livability && item.snapshot.snapshot.livability.overall_score && (
                        <ComparisonMetric
                          label={t('livabilityScore')}
                          value={`${item.snapshot.snapshot.livability.overall_score.toFixed(1)}/10`}
                          icon="⭐"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.livability?.overall_score}
                          lowerIsBetter={false}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Air Quality */}
                      {item.snapshot.snapshot.air_quality && item.snapshot.snapshot.air_quality.pm25 && (
                        <ComparisonMetric
                          label={t('airQuality')}
                          value={`${item.snapshot.snapshot.air_quality.pm25.toFixed(1)} µg/m³`}
                          icon="🌬️"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.air_quality?.pm25}
                          lowerIsBetter={true}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Nearest Train Station */}
                      {item.snapshot.snapshot.nearest_train_station && (
                        <ComparisonMetric
                          label={t('trainStationDistance')}
                          value={`${(item.snapshot.snapshot.nearest_train_station.distance_km).toFixed(1)} km - ${item.snapshot.snapshot.nearest_train_station.name}`}
                          icon="🚉"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.nearest_train_station?.distance_km}
                          lowerIsBetter={true}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Demographics */}
                      {item.snapshot.snapshot.demographics && (
                        <>
                          <ComparisonMetric
                            label={t('population')}
                            value={item.snapshot.snapshot.demographics.population?.toLocaleString() || 'N/A'}
                            icon="👥"
                          />
                          <ComparisonMetric
                            label={t('avgHouseholdSize')}
                            value={item.snapshot.snapshot.demographics.avg_household_size
                              ? `${item.snapshot.snapshot.demographics.avg_household_size.toFixed(1)} ${t('persons')}`
                              : 'N/A'}
                            icon="🏠"
                          />

                          {/* Age Distribution */}
                          {item.snapshot.snapshot.demographics.age_0_15 !== undefined && (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-gray-600 uppercase">{t('ageDistribution')}</div>
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
                          <div className="text-xs font-semibold text-gray-600 uppercase">{t('amenities2km')}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>🏪 {item.snapshot.snapshot.amenities.supermarkets.count} {t('supermarkets')}</div>
                            <div>🏥 {item.snapshot.snapshot.amenities.healthcare.count} {t('healthcare')}</div>
                            <div>🎮 {item.snapshot.snapshot.amenities.playgrounds.count} {t('playgrounds')}</div>
                            <div>🌳 {item.snapshot.snapshot.amenities.parks.count} {t('parks')}</div>
                          </div>
                        </div>
                      )}

                      {/* Energy Consumption */}
                      {item.snapshot.snapshot.energy_consumption && (
                        <ComparisonMetric
                          label={t('monthlyEnergyCost')}
                          value={`€${item.snapshot.snapshot.energy_consumption.monthly_cost_eur}/mo`}
                          icon="⚡"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.energy_consumption?.monthly_cost_eur}
                          lowerIsBetter={true}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Average WOZ Value */}
                      {item.snapshot.snapshot.demographics?.avg_woz_value && (
                        <ComparisonMetric
                          label={t('avgPropertyValue')}
                          value={`€${item.snapshot.snapshot.demographics.avg_woz_value.toLocaleString()}`}
                          icon="💰"
                          items={itemsToShow}
                          currentIndex={index}
                          getValue={(s) => s.snapshot.snapshot.demographics?.avg_woz_value}
                          lowerIsBetter={false}
                          translations={{ betterSingular: t('betterThanOther', { value: '' }), betterPlural: t('betterThanOthers', { value: '' }), worseSingular: t('worseThanOther', { value: '' }), worsePlural: t('worseThanOthers', { value: '' }), similarSingular: t('similarToOther'), similarPlural: t('similarToOthers') }}
                        />
                      )}

                      {/* Housing Mix */}
                      {item.snapshot.snapshot.demographics && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-600 uppercase">{t('housing')}</div>
                          <div className="text-sm space-y-1">
                            {item.snapshot.snapshot.demographics.owner_occupied_pct && (
                              <div>🏘️ {item.snapshot.snapshot.demographics.owner_occupied_pct.toFixed(0)}% {t('ownerOccupied')}</div>
                            )}
                            {item.snapshot.snapshot.demographics.rental_pct && (
                              <div>🔑 {item.snapshot.snapshot.demographics.rental_pct.toFixed(0)}% {t('rental')}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      {t('loadingData')}
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
            <p>{t('addMore', { count: maxItems - itemsToShow.length, type: type === 'neighborhood' ? t('neighborhood').toLowerCase() : t('property').toLowerCase() })}</p>
          )}
          {itemsToShow.length === maxItems && (
            <p>{t('maxReached', { count: maxItems, type: type === 'neighborhood' ? t('neighborhood').toLowerCase() + 's' : t('property').toLowerCase() + 's' })}</p>
          )}
        </div>
      </div>

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {t('premiumFeature')}
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {t('premiumDescription')}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {t('upgradeToPremium')}
              </button>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                {t('maybeLater')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ComparisonMetricTranslations = {
  betterSingular: string
  betterPlural: string
  worseSingular: string
  worsePlural: string
  similarSingular: string
  similarPlural: string
}

type ComparisonMetricProps = {
  label: string
  value: string
  icon: string
  items?: ComparisonItem[]
  currentIndex?: number
  getValue?: (item: ComparisonItem) => number | undefined
  lowerIsBetter?: boolean
  translations?: ComparisonMetricTranslations
}

function ComparisonMetric({
  label,
  value,
  icon,
  items,
  currentIndex,
  getValue,
  lowerIsBetter = false,
  translations
}: ComparisonMetricProps) {
  let indicator = null

  // Show comparison indicators if we have multiple items and a getValue function
  if (items && items.length > 1 && getValue !== undefined && currentIndex !== undefined && translations) {
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
          const isPlural = items.length > 2

          if (isBetter) {
            indicator = (
              <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                {Math.abs(diff).toFixed(0)}{isPlural ? translations.betterPlural : translations.betterSingular}
              </div>
            )
          } else if (isWorse) {
            indicator = (
              <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                <TrendingDown className="w-3 h-3" />
                {Math.abs(diff).toFixed(0)}{isPlural ? translations.worsePlural : translations.worseSingular}
              </div>
            )
          } else {
            indicator = (
              <div className="flex items-center gap-1 text-gray-500 text-xs font-medium">
                <Minus className="w-3 h-3" />
                {isPlural ? translations.similarPlural : translations.similarSingular}
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
