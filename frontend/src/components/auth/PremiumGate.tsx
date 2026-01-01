'use client'

import { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthContext } from './AuthProvider'

interface PremiumGateProps {
  children: ReactNode
  feature: 'pdf' | 'savedSearches' | 'favorites' | 'advancedData'
  fallback?: ReactNode
  showUpgradePrompt?: boolean
}

export function PremiumGate({
  children,
  feature,
  fallback,
  showUpgradePrompt = true
}: PremiumGateProps) {
  const t = useTranslations('premium')
  const { user, canAccessFeature, isPremium } = useAuthContext()

  if (canAccessFeature(feature)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradePrompt) {
    return null
  }

  if (!user) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 mb-3">{t('loginRequired')}</p>
        <a
          href="/auth/login"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('loginToAccess')}
        </a>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg text-center">
      <div className="flex items-center justify-center mb-2">
        <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="ml-1 text-lg font-semibold text-yellow-700">{t('premiumFeature')}</span>
      </div>
      <p className="text-gray-600 mb-3">{t(`${feature}Description`)}</p>
      <a
        href="/pricing"
        className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-md hover:from-yellow-500 hover:to-orange-600 transition-colors font-medium"
      >
        {t('upgradeNow')}
      </a>
    </div>
  )
}
