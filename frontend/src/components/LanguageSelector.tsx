'use client'

import { useState, useEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

// SVG flag components for reliable cross-platform rendering
const flags: Record<string, JSX.Element> = {
  en: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40" fill="none">
      <rect width="60" height="40" fill="#012169"/>
      <path d="M0 0L60 40M60 0L0 40" stroke="white" strokeWidth="6"/>
      <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4" clipPath="polygon(30 0, 30 20, 60 20, 60 0)"/>
      <path d="M30 0V40M0 20H60" stroke="white" strokeWidth="10"/>
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="6"/>
    </svg>
  ),
  nl: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="13.33" fill="#AE1C28"/>
      <rect y="13.33" width="60" height="13.33" fill="white"/>
      <rect y="26.67" width="60" height="13.33" fill="#21468B"/>
    </svg>
  ),
  de: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="13.33" fill="#000"/>
      <rect y="13.33" width="60" height="13.33" fill="#DD0000"/>
      <rect y="26.67" width="60" height="13.33" fill="#FFCC00"/>
    </svg>
  ),
  fr: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="20" height="40" fill="#002395"/>
      <rect x="20" width="20" height="40" fill="white"/>
      <rect x="40" width="20" height="40" fill="#ED2939"/>
    </svg>
  ),
  es: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="10" fill="#AA151B"/>
      <rect y="10" width="60" height="20" fill="#F1BF00"/>
      <rect y="30" width="60" height="10" fill="#AA151B"/>
    </svg>
  ),
  it: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="20" height="40" fill="#009246"/>
      <rect x="20" width="20" height="40" fill="white"/>
      <rect x="40" width="20" height="40" fill="#CE2B37"/>
    </svg>
  ),
  pl: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="20" fill="white"/>
      <rect y="20" width="60" height="20" fill="#DC143C"/>
    </svg>
  ),
  pt: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="24" height="40" fill="#006600"/>
      <rect x="24" width="36" height="40" fill="#FF0000"/>
      <circle cx="24" cy="20" r="8" fill="#FFCC00"/>
    </svg>
  ),
  ru: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="13.33" fill="white"/>
      <rect y="13.33" width="60" height="13.33" fill="#0039A6"/>
      <rect y="26.67" width="60" height="13.33" fill="#D52B1E"/>
    </svg>
  ),
  uk: (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
      <rect width="60" height="20" fill="#005BBB"/>
      <rect y="20" width="60" height="20" fill="#FFD500"/>
    </svg>
  ),
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
]

export default function LanguageSelector() {
  const locale = useLocale()
  const [currentLang, setCurrentLang] = useState(locale || 'en')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Sync with current locale
    if (locale) {
      setCurrentLang(locale)
    }
  }, [locale])

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode)
    localStorage.setItem('language', langCode)
    setIsOpen(false)

    // Get the path without locale prefix
    // pathname could be /en/something or /something
    let pathWithoutLocale = pathname || ''
    const localePattern = /^\/(en|nl|de|fr|es|it|pl|pt|ru|uk)(\/|$)/
    if (localePattern.test(pathWithoutLocale)) {
      pathWithoutLocale = pathWithoutLocale.replace(localePattern, '/')
    }
    if (pathWithoutLocale === '/') pathWithoutLocale = ''

    // Navigate to new language path
    const newPath = `/${langCode}${pathWithoutLocale}`
    startTransition(() => {
      router.push(newPath)
      router.refresh()
    })
  }

  const currentLanguage = languages.find(l => l.code === currentLang) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-md transition-colors ${isPending ? 'opacity-70 cursor-wait' : ''}`}
        aria-label="Select language"
      >
        {isPending ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          flags[currentLang]
        )}
        <span>{currentLanguage.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  lang.code === currentLang ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {flags[lang.code]}
                <span>{lang.name}</span>
                {lang.code === currentLang && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
