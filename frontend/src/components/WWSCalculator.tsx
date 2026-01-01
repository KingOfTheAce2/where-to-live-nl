'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calculator, Info, ExternalLink, HelpCircle } from 'lucide-react'

/**
 * WWS (Woningwaardering Stelsel) Points Calculator
 *
 * Calculates the maximum allowed rent for social housing based on:
 * - Square meters (living space)
 * - Energy label
 * - Amenities and facilities
 * - Location (WOZ value based)
 *
 * Reference: https://www.huurcommissie.nl/
 */

type WWSCalculatorProps = {
  initialSqm?: number
  initialEnergyLabel?: string
  initialWozValue?: number
}

const ENERGY_LABEL_POINTS: Record<string, number> = {
  'A++++': 44,
  'A+++': 40,
  'A++': 36,
  'A+': 32,
  'A': 28,
  'B': 21,
  'C': 14,
  'D': 7,
  'E': 0,
  'F': -4,
  'G': -8
}

// Updated 2025 WWS Thresholds (3-tier system since July 2024)
const LOW_SEGMENT_LIMIT_2025 = 900.07     // Up to 143 points (social housing)
const MIDDLE_SEGMENT_LIMIT_2025 = 1184.82 // 144-186 points (mid-range rental)
// Above 186 points = private sector (no rent cap)

const LOW_SEGMENT_MAX_POINTS = 143
const MIDDLE_SEGMENT_MAX_POINTS = 186

export default function WWSCalculator({
  initialSqm = 75,
  initialEnergyLabel = 'C',
  initialWozValue
}: WWSCalculatorProps) {
  const t = useTranslations('wws')
  const [sqm, setSqm] = useState(initialSqm)
  const [energyLabel, setEnergyLabel] = useState(initialEnergyLabel)
  const [hasGarden, setHasGarden] = useState(false)
  const [hasBalcony, setHasBalcony] = useState(false)
  const [hasParkingSpot, setHasParkingSpot] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showHuurcommissieInfo, setShowHuurcommissieInfo] = useState(false)

  // Calculate WWS points
  const calculatePoints = () => {
    let points = 0

    // 1. Square meters (most important)
    // Living space: 1 point per m² (up to 40m²), then tiered
    if (sqm <= 40) {
      points += sqm * 1
    } else if (sqm <= 90) {
      points += 40 + (sqm - 40) * 0.75
    } else {
      points += 40 + (50 * 0.75) + (sqm - 90) * 0.5
    }

    // 2. Energy label
    const energyPoints = ENERGY_LABEL_POINTS[energyLabel] || 0
    points += energyPoints

    // 3. Outdoor space
    if (hasGarden) points += 4  // Private garden (simplified)
    if (hasBalcony) points += 2  // Balcony (simplified)

    // 4. Parking
    if (hasParkingSpot) points += 2  // Private parking (simplified)

    // 5. WOZ-based scarcity points (if available)
    // Simplified: High WOZ = expensive area = more points
    if (initialWozValue && initialWozValue > 300000) {
      points += Math.min(15, Math.floor((initialWozValue - 300000) / 50000))
    }

    return Math.round(points)
  }

  const points = calculatePoints()

  // Calculate maximum rent based on points (2025 3-tier system)
  const BASE_RATE_2025 = 6.16
  const maxRent = points * BASE_RATE_2025

  // Determine rental segment (updated 2025 rules)
  let segment: 'low' | 'middle' | 'high'

  if (points <= LOW_SEGMENT_MAX_POINTS) {
    segment = 'low'
  } else if (points <= MIDDLE_SEGMENT_MAX_POINTS) {
    segment = 'middle'
  } else {
    segment = 'high'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            <h3 className="font-semibold">{t('title')}</h3>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
        {showInfo && (
          <div className="mt-3 text-sm text-purple-100 bg-purple-800/30 rounded p-3">
            <p className="font-medium mb-2">{t('whatIsWWS')}</p>
            <p className="text-xs leading-relaxed">
              {t('explanation')}
            </p>
          </div>
        )}
      </div>

      {/* Calculator Inputs */}
      <div className="p-4 space-y-4">
        {/* Living Space */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('livingSpace')}
          </label>
          <input
            type="number"
            value={sqm}
            onChange={(e) => setSqm(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            min="10"
            max="300"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('points')}: {sqm <= 40 ? sqm : sqm <= 90 ? (40 + (sqm - 40) * 0.75).toFixed(1) : (40 + 37.5 + (sqm - 90) * 0.5).toFixed(1)}
          </p>
        </div>

        {/* Energy Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('energyLabel')}
          </label>
          <select
            value={energyLabel}
            onChange={(e) => setEnergyLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {Object.keys(ENERGY_LABEL_POINTS).map(label => (
              <option key={label} value={label}>
                {label} ({ENERGY_LABEL_POINTS[label] > 0 ? '+' : ''}{ENERGY_LABEL_POINTS[label]} {t('points')})
              </option>
            ))}
          </select>
        </div>

        {/* Amenities */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('amenities')}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasGarden}
              onChange={(e) => setHasGarden(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span>{t('privateGarden')}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasBalcony}
              onChange={(e) => setHasBalcony(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span>{t('balconyTerrace')}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasParkingSpot}
              onChange={(e) => setHasParkingSpot(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span>{t('privateParking')}</span>
          </label>
        </div>

        {/* Results */}
        <div className={`rounded-lg p-4 space-y-3 border ${
          segment === 'low' ? 'bg-green-50 border-green-200' :
          segment === 'middle' ? 'bg-blue-50 border-blue-200' :
          'bg-purple-50 border-purple-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t('totalPoints')}</span>
            <span className={`text-2xl font-bold ${
              segment === 'low' ? 'text-green-600' :
              segment === 'middle' ? 'text-blue-600' :
              'text-purple-600'
            }`}>{points}</span>
          </div>

          <div className={`border-t pt-3 ${
            segment === 'low' ? 'border-green-200' :
            segment === 'middle' ? 'border-blue-200' :
            'border-purple-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('maxRent')}</span>
              <span className="text-xl font-bold text-gray-900">
                {segment === 'high' ? t('noCap') : `€${maxRent.toFixed(2)}${t('perMonth')}`}
              </span>
            </div>

            <div className={`text-xs px-3 py-2 rounded ${
              segment === 'low' ? 'bg-green-100 text-green-800 border border-green-200' :
              segment === 'middle' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
              'bg-purple-100 text-purple-800 border border-purple-200'
            }`}>
              <strong>
                {segment === 'low' && t('regulatedSocial')}
                {segment === 'middle' && t('regulatedMid')}
                {segment === 'high' && t('privateSector')}
              </strong>
              <p className="mt-1">
                {segment === 'low' && t('regulatedSocialDesc', { points: LOW_SEGMENT_MAX_POINTS, limit: LOW_SEGMENT_LIMIT_2025.toFixed(2) })}
                {segment === 'middle' && t('regulatedMidDesc', { minPoints: LOW_SEGMENT_MAX_POINTS + 1, maxPoints: MIDDLE_SEGMENT_MAX_POINTS, minLimit: LOW_SEGMENT_LIMIT_2025.toFixed(2), maxLimit: MIDDLE_SEGMENT_LIMIT_2025.toFixed(2) })}
                {segment === 'high' && t('privateSectorDesc', { points: MIDDLE_SEGMENT_MAX_POINTS + 1 })}
              </p>
            </div>
          </div>
        </div>

        {/* Huurcommissie Information */}
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowHuurcommissieInfo(!showHuurcommissieInfo)}
            className="flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            <HelpCircle className="w-4 h-4" />
            {t('whatIsHuurcommissie')}
          </button>

          {showHuurcommissieInfo && (
            <div className="mt-3 bg-blue-50 rounded-lg p-4 text-sm space-y-3 border border-blue-200">
              <div>
                <p className="font-semibold text-blue-900 mb-2">{t('huurcommissieTitle')}</p>
                <p className="text-blue-800 leading-relaxed">
                  {t('huurcommissieDesc')}
                </p>
              </div>

              <div className="space-y-2 text-blue-800">
                <p className="font-medium">{t('whatTheyCanDo')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('canDo1')}</li>
                  <li>{t('canDo2')}</li>
                  <li>{t('canDo3')}</li>
                  <li>{t('canDo4')}</li>
                  <li>{t('canDo5')}</li>
                </ul>
              </div>

              <div className="space-y-2 text-blue-800">
                <p className="font-medium">{t('tipsForExpats')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('expat1')}</li>
                  <li>{t('expat2')}</li>
                  <li>{t('expat3')}</li>
                  <li>{t('expat4')}</li>
                  <li>{t('expat5')}</li>
                </ul>
              </div>

              <div className="pt-3 border-t border-blue-200">
                <a
                  href="https://www.huurcommissie.nl/onderwerpen/huurprijs-en-punten/huurprijs-checken/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('checkRent')}
                </a>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                <strong>⚠️ {t('important')}</strong> {t('importantNote', { limit: LOW_SEGMENT_LIMIT_2025.toFixed(2) })}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
          <strong>Note:</strong> {t('disclaimer')}{' '}
          <a
            href="https://www.huurcommissie.nl/huurprijs-en-punten/huurprijscheck-doen/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            {t('officialCalculator')}
          </a>.
        </div>
      </div>
    </div>
  )
}
