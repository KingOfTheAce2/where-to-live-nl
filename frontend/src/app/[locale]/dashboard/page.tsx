'use client'

import { useTranslations } from 'next-intl'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const { user, profile, isPremium, loading } = useAuthContext()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('welcome')}, {profile?.full_name || user.email?.split('@')[0]}</h1>

        {!isPremium && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-yellow-800">{t('upgradeBanner')}</h2>
                <p className="text-yellow-700">{t('upgradeDescription')}</p>
              </div>
              <a
                href="/pricing"
                className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-colors font-medium"
              >
                {t('upgradeCta')}
              </a>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <a
            href="/dashboard/saved-searches"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('savedSearches')}</h3>
            <p className="text-gray-600 text-sm">{t('savedSearchesDescription')}</p>
          </a>

          <a
            href="/dashboard/subscription"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('subscription')}</h3>
            <p className="text-gray-600 text-sm">{t('subscriptionDescription')}</p>
          </a>

          <a
            href="/"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('searchMap')}</h3>
            <p className="text-gray-600 text-sm">{t('searchMapDescription')}</p>
          </a>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('accountInfo')}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">{t('email')}</dt>
              <dd className="text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">{t('plan')}</dt>
              <dd className="text-gray-900">
                {isPremium ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                    Premium
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Free
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">{t('memberSince')}</dt>
              <dd className="text-gray-900">{new Date(user.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
