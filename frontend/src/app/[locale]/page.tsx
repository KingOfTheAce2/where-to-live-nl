'use client'

import { Home, MapPin, Shield, TrendingUp, Building2, Users, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import LanguageSelector from '@/components/LanguageSelector'
import { UserMenu } from '@/components/auth/UserMenu'

export default function LandingPage() {
  const t = useTranslations()

  const features = [
    {
      icon: Shield,
      titleKey: 'landing.features.safety.title',
      descKey: 'landing.features.safety.description',
    },
    {
      icon: TrendingUp,
      titleKey: 'landing.features.livability.title',
      descKey: 'landing.features.livability.description',
    },
    {
      icon: Building2,
      titleKey: 'landing.features.amenities.title',
      descKey: 'landing.features.amenities.description',
    },
    {
      icon: Users,
      titleKey: 'landing.features.demographics.title',
      descKey: 'landing.features.demographics.description',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">{t('app.title')}</span>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <UserMenu />
              <Link
                href="/map"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {t('landing.openMap')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              {t('landing.hero.title')}
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/map"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg shadow-blue-600/25"
              >
                <MapPin className="w-5 h-5" />
                {t('landing.hero.cta')}
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-lg border border-gray-200"
              >
                {t('landing.hero.learnMore')}
              </a>
            </div>
          </div>
        </div>

        {/* Decorative background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-100 rounded-full blur-3xl opacity-30" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-gray-600">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('landing.dataSources.title')}
            </h2>
            <p className="text-lg text-gray-600">
              {t('landing.dataSources.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>CBS (Statistics Netherlands)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>Politie.nl (Crime Data)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>Leefbaarometer (Livability)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>PDOK (Geo Data)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>OpenStreetMap</span>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Learn what this data means
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            {t('landing.cta.title')}
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            {t('landing.cta.subtitle')}
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-semibold text-lg"
          >
            <MapPin className="w-5 h-5" />
            {t('landing.cta.button')}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Home className="w-6 h-6 text-white" />
              <span className="text-white font-semibold">{t('app.title')}</span>
            </div>
            <p className="text-sm">
              {t('app.builtWith')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
