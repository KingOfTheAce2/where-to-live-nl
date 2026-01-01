'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface AtAGlanceProps {
  neighborhood?: string
  city?: string
  livabilityScore?: number | null
  safetyScore?: number | null
  greenScore?: number | null
  transitScore?: number | null
  warnings?: number
  goodSignals?: number
  isLoading?: boolean
}

// Normalize scores to 0-10 scale for display
function normalizeScore(score: number | null | undefined, type: 'livability' | 'safety' | 'green' | 'transit'): number | null {
  if (score === null || score === undefined) return null

  switch (type) {
    case 'livability':
      // Livability is typically -3 to +3, normalize to 0-10
      return Math.min(10, Math.max(0, ((score + 3) / 6) * 10))
    case 'safety':
      // Crime rate per 1000, lower is better. 0-100 range, invert and scale
      return Math.min(10, Math.max(0, 10 - (score / 10)))
    case 'green':
      // Parks count or percentage, scale appropriately
      return Math.min(10, Math.max(0, score))
    case 'transit':
      // Distance to station in km, closer is better. 0-5km range
      if (score <= 0.5) return 10
      if (score <= 1) return 8
      if (score <= 2) return 6
      if (score <= 3) return 4
      if (score <= 5) return 2
      return 1
    default:
      return score
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400'
  if (score >= 7.5) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  if (score >= 3) return 'text-orange-500'
  return 'text-red-500'
}

function getScoreBg(score: number | null): string {
  if (score === null) return 'bg-gray-100'
  if (score >= 7.5) return 'bg-green-50'
  if (score >= 5) return 'bg-yellow-50'
  if (score >= 3) return 'bg-orange-50'
  return 'bg-red-50'
}

function ScoreIndicator({ score, type }: { score: number | null; type: 'livability' | 'safety' | 'green' | 'transit' }) {
  if (score === null) return <Minus className="w-3 h-3 text-gray-400" />

  // Compare to average (5.0)
  if (score >= 6) return <TrendingUp className="w-3 h-3 text-green-500" />
  if (score <= 4) return <TrendingDown className="w-3 h-3 text-red-500" />
  return <Minus className="w-3 h-3 text-gray-400" />
}

export default function AtAGlance({
  neighborhood,
  city,
  livabilityScore,
  safetyScore,
  greenScore,
  transitScore,
  warnings = 0,
  goodSignals = 0,
  isLoading = false
}: AtAGlanceProps) {
  const t = useTranslations()

  const normalizedLivability = normalizeScore(livabilityScore, 'livability')
  const normalizedSafety = normalizeScore(safetyScore, 'safety')
  const normalizedGreen = normalizeScore(greenScore, 'green')
  const normalizedTransit = normalizeScore(transitScore, 'transit')

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 animate-pulse">
        <div className="h-5 bg-blue-200 rounded w-2/3 mb-3"></div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-8 bg-blue-200 rounded mb-1"></div>
              <div className="h-3 bg-blue-100 rounded w-3/4 mx-auto"></div>
            </div>
          ))}
        </div>
        <div className="h-4 bg-blue-100 rounded w-1/2 mx-auto"></div>
      </div>
    )
  }

  const locationName = neighborhood
    ? `${neighborhood}${city ? `, ${city}` : ''}`
    : city || t('atAGlance.selectedLocation')

  const scores = [
    {
      key: 'livability',
      icon: '🏠',
      label: t('atAGlance.livability'),
      score: normalizedLivability,
      raw: livabilityScore
    },
    {
      key: 'safety',
      icon: '👮',
      label: t('atAGlance.safety'),
      score: normalizedSafety,
      raw: safetyScore
    },
    {
      key: 'green',
      icon: '🌳',
      label: t('atAGlance.green'),
      score: normalizedGreen,
      raw: greenScore
    },
    {
      key: 'transit',
      icon: '🚇',
      label: t('atAGlance.transit'),
      score: normalizedTransit,
      raw: transitScore
    },
  ]

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
      {/* Location Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📍</span>
        <h3 className="font-semibold text-gray-900 truncate flex-1">
          {locationName}
        </h3>
      </div>

      {/* Score Grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {scores.map(({ key, icon, label, score }) => (
          <div
            key={key}
            className={`text-center p-2 rounded-lg ${getScoreBg(score)} transition-colors`}
          >
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <span className="text-sm">{icon}</span>
              <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                {score !== null ? score.toFixed(1) : '--'}
              </span>
              <ScoreIndicator score={score} type={key as any} />
            </div>
            <div className="text-[10px] text-gray-600 leading-tight">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Warnings & Good Signals */}
      <div className="flex items-center justify-center gap-4 text-sm">
        {warnings > 0 && (
          <div className="flex items-center gap-1.5 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">{warnings} {t('atAGlance.warnings')}</span>
          </div>
        )}
        {goodSignals > 0 && (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">{goodSignals} {t('atAGlance.goodSignals')}</span>
          </div>
        )}
        {warnings === 0 && goodSignals === 0 && (
          <div className="text-gray-500 text-xs">
            {t('atAGlance.analyzing')}
          </div>
        )}
      </div>
    </div>
  )
}
