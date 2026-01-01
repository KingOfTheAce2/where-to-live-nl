'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function SubscriptionPage() {
  const t = useTranslations('subscription')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, subscription, isPremium, loading: authLoading } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true)
      // Remove success param from URL
      router.replace('/dashboard/subscription')
    }
  }, [searchParams, router])

  const handleManageSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })
      const { url, error } = await response.json()

      if (error) {
        alert(error)
        setLoading(false)
        return
      }

      window.location.href = url
    } catch (err) {
      console.error('Portal error:', err)
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      })
      const { url, error } = await response.json()

      if (error) {
        alert(error)
        setLoading(false)
        return
      }

      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
      setLoading(false)
    }
  }

  if (authLoading) {
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
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <a
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700"
          >
            {t('backToDashboard')}
          </a>
        </div>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-700 font-medium">{t('subscriptionSuccess')}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('currentPlan')}</h2>
              <p className="text-gray-600">{t('planDetails')}</p>
            </div>
            {isPremium ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                Premium
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Free
              </span>
            )}
          </div>

          {isPremium ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-gray-600">{t('status')}</span>
                <span className="text-green-600 font-medium">{t('active')}</span>
              </div>
              {subscription?.current_period_end && (
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <span className="text-gray-600">{t('renewsOn')}</span>
                  <span className="text-gray-900">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-gray-600">{t('price')}</span>
                <span className="text-gray-900">{t('priceValue')}</span>
              </div>

              <button
                onClick={handleManageSubscription}
                disabled={loading}
                className="w-full mt-4 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? t('loading') : t('manageSubscription')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">{t('freeDescription')}</p>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">{t('premiumBenefits')}</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('benefit1')}
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('benefit2')}
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('benefit3')}
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('benefit4')}
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? t('loading') : t('upgradeToPremium')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
