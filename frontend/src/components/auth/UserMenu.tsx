'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuthContext } from './AuthProvider'

export function UserMenu() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { user, profile, isPremium, loading, signOut } = useAuthContext()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    )
  }

  // Show login button when not authenticated
  if (!user) {
    return (
      <a
        href="/auth/login"
        className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-sm font-medium text-white"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="hidden sm:inline">{t('signIn')}</span>
      </a>
    )
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'
  const avatarUrl = profile?.avatar_url || null
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        {isPremium && (
          <span className="px-1.5 py-0.5 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-medium">
            PRO
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {!isPremium && (
              <a
                href="/pricing"
                className="mt-2 block text-xs text-blue-600 hover:text-blue-700"
              >
                {t('upgradeToPremium')}
              </a>
            )}
          </div>

          <div className="py-1">
            <a
              href="/dashboard"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              {t('dashboard')}
            </a>
            <a
              href="/dashboard/saved-searches"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              {t('savedSearches')}
            </a>
            <a
              href="/dashboard/subscription"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              {t('subscription')}
            </a>
          </div>

          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
