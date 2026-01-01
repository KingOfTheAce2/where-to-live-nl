'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SavedSearch {
  id: string
  name: string
  address: string
  coordinates: { lat: number; lng: number }
  area_code: string | null
  created_at: string
}

export default function SavedSearchesPage() {
  const t = useTranslations('savedSearches')
  const router = useRouter()
  const { user, isPremium, getFeatureLimit, loading: authLoading } = useAuthContext()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadSearches()
    }
  }, [user])

  const loadSearches = async () => {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSearches(data)
    }
    setLoading(false)
  }

  const deleteSearch = async (id: string) => {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)

    if (!error) {
      setSearches(searches.filter(s => s.id !== id))
    }
  }

  const openSearch = (search: SavedSearch) => {
    const params = new URLSearchParams({
      lat: search.coordinates.lat.toString(),
      lng: search.coordinates.lng.toString(),
      address: search.address,
    })
    router.push(`/?${params.toString()}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const limit = getFeatureLimit('savedSearches')
  const canSaveMore = isPremium || searches.length < limit

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            {!isPremium && (
              <p className="text-gray-600 mt-1">
                {t('usageCount', { count: searches.length, limit })}
              </p>
            )}
          </div>
          <a
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700"
          >
            {t('backToDashboard')}
          </a>
        </div>

        {!isPremium && searches.length >= limit && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-yellow-800">{t('limitReached')}</h2>
            <p className="text-yellow-700 mb-4">{t('upgradeForMore')}</p>
            <a
              href="/pricing"
              className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-colors font-medium"
            >
              {t('upgrade')}
            </a>
          </div>
        )}

        {searches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noSearches')}</h3>
            <p className="text-gray-600 mb-4">{t('noSearchesDescription')}</p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('startSearching')}
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {searches.map((search) => (
                <li key={search.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => openSearch(search)}
                      className="flex-1 text-left"
                    >
                      <h3 className="text-lg font-medium text-gray-900">{search.name}</h3>
                      <p className="text-gray-600 text-sm">{search.address}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        {t('savedOn')} {new Date(search.created_at).toLocaleDateString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openSearch(search)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('openSearch')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteSearch(search.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('deleteSearch')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
