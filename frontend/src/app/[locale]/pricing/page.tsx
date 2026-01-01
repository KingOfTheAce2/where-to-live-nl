'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthContext } from '@/components/auth/AuthProvider'

export default function PricingPage() {
  const t = useTranslations('pricing')
  const { user, isPremium, loading } = useAuthContext()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      })
      const { url, error } = await response.json()

      if (error) {
        alert(error)
        setIsLoading(false)
        return
      }

      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('title')}</h1>
          <p className="text-xl text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('freePlan')}</h2>
            <p className="text-gray-600 mb-4">{t('freeDescription')}</p>
            <p className="text-4xl font-bold text-gray-900 mb-6">
              {t('free')}
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('unlimitedSearch')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('basicData')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('savedSearches3')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('favorites5')}</span>
              </li>
              <li className="flex items-center text-gray-400">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{t('noPdfExport')}</span>
              </li>
              <li className="flex items-center text-gray-400">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{t('noAdvancedData')}</span>
              </li>
            </ul>

            {!user && (
              <a
                href="/auth/signup"
                className="block w-full text-center py-3 px-4 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                {t('getStarted')}
              </a>
            )}
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
              {t('popular')}
            </div>

            <h2 className="text-2xl font-bold mb-2">{t('premiumPlan')}</h2>
            <p className="text-blue-100 mb-4">{t('premiumDescription')}</p>
            <p className="text-4xl font-bold mb-2">
              {t('price')}
              <span className="text-lg font-normal text-blue-200">{t('perMonth')}</span>
            </p>
            <p className="text-blue-200 text-sm mb-6">{t('cancelAnytime')}</p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('unlimitedSearch')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('fullData')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('unlimitedSaved')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('unlimitedFavorites')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('pdfExport')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('advancedData')}</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('historicalData')}</span>
              </li>
            </ul>

            {isPremium ? (
              <div className="w-full text-center py-3 px-4 bg-white/20 rounded-lg font-medium">
                {t('currentPlan')}
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={isLoading || loading}
                className="w-full py-3 px-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50"
              >
                {isLoading ? t('processing') : t('subscribe')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p>{t('securePayment')}</p>
        </div>
      </div>
    </div>
  )
}
