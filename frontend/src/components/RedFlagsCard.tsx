'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Info, AlertCircle, CheckCircle } from 'lucide-react'

interface RiskCheckResult {
  foundation_risk?: {
    in_risk_area: boolean
    risk_level?: string
    legenda?: string
    municipality?: string
    pct_pre_1970?: string
    source?: string
    warning?: string
    recommendation?: string
    note?: string
    error?: string
  }
  flood_risk?: {
    flood_depth_m?: number | null
    risk_level?: string
    warning?: string
    source?: string
  }
  noise?: {
    noise_db_lden?: number | null
    category?: string
    description?: string
    health_impact?: {
      sleep?: string
      cardiovascular?: string
      annoyance?: string
      overall?: string
    }
    source?: string
  }
  building_age?: {
    year_built?: number
    risk_level?: string
    warning?: string
  }
}

interface RedFlagsCardProps {
  coordinates: [number, number] | null
  address?: string
  buildingYear?: number
  isLoading?: boolean
}

type SeverityLevel = 'critical' | 'warning' | 'info' | 'safe'

interface RedFlag {
  id: string
  title: string
  description: string
  severity: SeverityLevel
  details?: string
  link?: { url: string; label: string }
  recommendation?: string
}

export default function RedFlagsCard({
  coordinates,
  address,
  buildingYear,
  isLoading: parentLoading = false
}: RedFlagsCardProps) {
  const t = useTranslations('redFlags')
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!coordinates) {
      setRiskData(null)
      return
    }

    const fetchRisks = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [lng, lat] = coordinates
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const response = await fetch(
          `${backendUrl}/api/risk-check?lat=${lat}&lng=${lng}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch risk data')
        }

        const data = await response.json()
        // Handle both direct response and wrapped response (backend returns { success, data })
        const riskInfo = data.data || data
        setRiskData(riskInfo)
      } catch (err) {
        console.error('Error fetching risk data:', err)
        // For any network error (CORS, connection refused, timeout, etc.)
        // Show "error" status rather than completely failing
        setRiskData({
          foundation_risk: { in_risk_area: false, risk_level: 'error', error: 'Service unavailable' },
          flood_risk: { risk_level: 'unknown' },
          noise: undefined
        })
        // Don't set error - we'll show graceful degradation instead
      } finally {
        setIsLoading(false)
      }
    }

    fetchRisks()
  }, [coordinates])

  // Generate red flags based on risk data
  const generateFlags = (): RedFlag[] => {
    const flags: RedFlag[] = []

    // Foundation risk
    if (riskData?.foundation_risk?.in_risk_area) {
      // HIGH RISK - Strong warning needed
      const severity: SeverityLevel = riskData.foundation_risk.risk_level === 'high' ? 'critical' :
        riskData.foundation_risk.risk_level === 'medium' ? 'warning' : 'info'
      const pctPre1970 = riskData.foundation_risk.pct_pre_1970 ? parseFloat(riskData.foundation_risk.pct_pre_1970).toFixed(0) : null
      flags.push({
        id: 'foundation',
        title: t('foundation.title'),
        description: riskData.foundation_risk.legenda || t('foundation.inRiskArea'),
        severity,
        details: riskData.foundation_risk.warning || (pctPre1970 ? `⚠️ ${pctPre1970}% of buildings in this area were built before 1970. Foundation problems are common in this region.` : 'This area has known foundation issues.'),
        recommendation: severity === 'critical'
          ? '🚨 MUST get a professional foundation inspection (bouwkundig rapport) before purchasing. Budget €1,000-1,500. Do NOT skip this!'
          : riskData.foundation_risk.recommendation || t('foundation.recommendation'),
        link: {
          url: 'https://www.kcaf.nl/',
          label: t('foundation.linkLabel')
        }
      })
    } else if (riskData?.foundation_risk?.error || riskData?.foundation_risk?.risk_level === 'error') {
      // API error - show unknown status
      flags.push({
        id: 'foundation-unknown',
        title: t('foundation.title'),
        description: t('foundation.unknown'),
        severity: 'info',
        recommendation: t('foundation.recommendation'),
        link: {
          url: 'https://www.kcaf.nl/',
          label: t('foundation.linkLabel')
        }
      })
    } else if (riskData?.foundation_risk && riskData.foundation_risk.in_risk_area === false) {
      // LOW RISK - Show positive message but still recommend caution
      const pctPre1970 = riskData.foundation_risk.pct_pre_1970 ? parseFloat(riskData.foundation_risk.pct_pre_1970).toFixed(0) : null
      flags.push({
        id: 'foundation-safe',
        title: t('foundation.title'),
        description: riskData.foundation_risk.legenda || 'No known foundation risk in this area',
        severity: 'safe',
        details: pctPre1970
          ? `${pctPre1970}% of buildings in this area were built before 1970. While this area has low foundation risk, it's still wise to verify for older properties.`
          : 'This area is not in a known foundation risk zone.',
        recommendation: 'Consider a foundation inspection for buildings built before 1970, especially in areas with clay or peat soil.',
        link: {
          url: 'https://www.kcaf.nl/',
          label: t('foundation.linkLabel')
        }
      })
    }

    // Building age check (pre-1970)
    if (buildingYear && buildingYear < 1970) {
      flags.push({
        id: 'building-age',
        title: t('buildingAge.title'),
        description: t('buildingAge.preBuildYear', { year: buildingYear }),
        severity: buildingYear < 1950 ? 'critical' : 'warning',
        details: t('buildingAge.details'),
        recommendation: t('buildingAge.recommendation'),
        link: {
          url: 'https://fundermaps.com/',
          label: t('buildingAge.linkLabel')
        }
      })
    }

    // Flood risk
    if (riskData?.flood_risk) {
      const depth = riskData.flood_risk.flood_depth_m
      if (depth && depth > 0) {
        let severity: SeverityLevel = 'info'
        if (depth > 2) severity = 'critical'
        else if (depth > 0.5) severity = 'warning'

        flags.push({
          id: 'flood',
          title: t('flood.title'),
          description: t('flood.description', { depth: depth.toFixed(1) }),
          severity,
          details: riskData.flood_risk.warning,
          recommendation: t('flood.recommendation'),
          link: {
            url: 'https://www.overstroomik.nl/',
            label: t('flood.linkLabel')
          }
        })
      }
    }

    // Noise pollution
    if (riskData?.noise?.noise_db_lden) {
      const db = riskData.noise.noise_db_lden
      if (db >= 60) {
        let severity: SeverityLevel = 'info'
        if (db >= 70) severity = 'critical'
        else if (db >= 65) severity = 'warning'

        flags.push({
          id: 'noise',
          title: t('noise.title'),
          description: t('noise.description', { db: db.toFixed(0) }),
          severity,
          details: riskData.noise.health_impact?.overall || riskData.noise.description,
          recommendation: t('noise.recommendation'),
          link: {
            url: 'https://www.atlasleefomgeving.nl/geluid-in-je-omgeving',
            label: t('noise.linkLabel')
          }
        })
      }
    }

    return flags
  }

  const flags = generateFlags()
  const criticalCount = flags.filter(f => f.severity === 'critical').length
  const warningCount = flags.filter(f => f.severity === 'warning').length
  const totalCount = flags.length

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'safe':
        return 'bg-green-50 border-green-200 text-green-800'
    }
  }

  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />
      case 'safe':
        return <CheckCircle className="w-5 h-5 text-green-600" />
    }
  }

  const getHeaderColor = () => {
    if (criticalCount > 0) return 'bg-red-600'
    if (warningCount > 0) return 'bg-amber-600'
    if (totalCount > 0) return 'bg-blue-600'
    return 'bg-green-600'
  }

  if (!coordinates) return null

  if (isLoading || parentLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gray-300 rounded-full animate-pulse" />
            <div className="h-5 w-32 bg-gray-300 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full p-4 ${getHeaderColor()} text-white flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">{t('title')}</span>
          {totalCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
              {totalCount} {totalCount === 1 ? t('issue') : t('issues')}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              {t('errorLoading')}: {error}
            </div>
          )}

          {flags.length === 0 && !error && (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-medium text-green-800">{t('noIssuesFound')}</div>
                <div className="text-sm text-green-700">{t('noIssuesDescription')}</div>
              </div>
            </div>
          )}

          {flags.map((flag) => (
            <div
              key={flag.id}
              className={`p-4 rounded-lg border ${getSeverityColor(flag.severity)}`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(flag.severity)}
                <div className="flex-1 space-y-2">
                  <div className="font-semibold">{flag.title}</div>
                  <div className="text-sm">{flag.description}</div>

                  {flag.details && (
                    <div className="text-sm opacity-80">{flag.details}</div>
                  )}

                  {flag.recommendation && (
                    <div className="text-sm font-medium mt-2">
                      💡 {flag.recommendation}
                    </div>
                  )}

                  {flag.link && (
                    <a
                      href={flag.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline hover:no-underline mt-2"
                    >
                      {flag.link.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Important notice for expats */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
            <p className="font-medium text-gray-900 mb-1">💡 {t('expatsNotice.title')}</p>
            <ul className="space-y-1">
              <li>• {t('expatsNotice.tip1')}</li>
              <li>• {t('expatsNotice.tip2')}</li>
              <li>• {t('expatsNotice.tip3')}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
