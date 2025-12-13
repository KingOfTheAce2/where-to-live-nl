'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTranslations } from 'next-intl'

type SmartIndicatorProps = {
  currentValue: number
  compareValue: number  // National average, neighborhood average, etc.
  lowerIsBetter?: boolean
  label?: string
  showValue?: boolean
  threshold?: number  // Only show if difference exceeds this percentage (default: 5)
}

export default function SmartIndicator({
  currentValue,
  compareValue,
  lowerIsBetter = false,
  label,
  showValue = true,
  threshold = 5
}: SmartIndicatorProps) {
  const t = useTranslations('smartIndicator')

  if (!currentValue || !compareValue) return null

  const diff = ((currentValue - compareValue) / compareValue) * 100
  const absDiff = Math.abs(diff)

  // Only show if difference exceeds threshold
  if (absDiff < threshold) return null

  const isBetter = lowerIsBetter ? diff < 0 : diff > 0
  const isWorse = lowerIsBetter ? diff > 0 : diff < 0

  if (isBetter) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
        <TrendingUp className="w-3 h-3" />
        {showValue && <span>{t('better', { value: absDiff.toFixed(0) })}</span>}
        {label && !showValue && <span>{label}</span>}
      </div>
    )
  } else if (isWorse) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium">
        <TrendingDown className="w-3 h-3" />
        {showValue && <span>{t('worse', { value: absDiff.toFixed(0) })}</span>}
        {label && !showValue && <span>{label}</span>}
      </div>
    )
  } else {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-md text-xs font-medium">
        <Minus className="w-3 h-3" />
        <span>{t('similar')}</span>
      </div>
    )
  }
}
