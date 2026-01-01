'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Home,
  ArrowLeft,
  Map,
  Shield,
  Wind,
  Droplets,
  Volume2,
  TreePine,
  Plane,
  Building2,
  GraduationCap,
  Heart,
  ShoppingCart,
  Train,
  TramFront,
  Baby,
  Layers,
  AlertTriangle,
  Thermometer,
  LandPlot,
  Activity,
  Info,
  ExternalLink
} from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'

interface LayerInfo {
  id: string
  icon: React.ReactNode
  category: 'environment' | 'safety' | 'nature' | 'infrastructure' | 'amenities'
  dutchTerm?: string
  source: string
  sourceUrl?: string
}

const layers: LayerInfo[] = [
  // Environment & Quality of Life
  {
    id: 'leefbaarometer',
    icon: <Activity className="w-6 h-6 text-emerald-600" />,
    category: 'environment',
    dutchTerm: 'Leefbaarometer',
    source: 'Ministerie van Binnenlandse Zaken',
    sourceUrl: 'https://www.leefbaarometer.nl/'
  },
  {
    id: 'airQuality',
    icon: <Wind className="w-6 h-6 text-blue-500" />,
    category: 'environment',
    dutchTerm: 'Luchtkwaliteit',
    source: 'RIVM / Atlas Leefomgeving',
    sourceUrl: 'https://www.atlasleefomgeving.nl/'
  },
  {
    id: 'noise',
    icon: <Volume2 className="w-6 h-6 text-orange-500" />,
    category: 'environment',
    dutchTerm: 'Geluidhinder',
    source: 'RIVM / Atlas Leefomgeving',
    sourceUrl: 'https://www.atlasleefomgeving.nl/'
  },
  // Safety & Risk
  {
    id: 'crime',
    icon: <Shield className="w-6 h-6 text-red-600" />,
    category: 'safety',
    dutchTerm: 'Criminaliteit',
    source: 'Politie.nl / CBS',
    sourceUrl: 'https://data.politie.nl/'
  },
  {
    id: 'flooding',
    icon: <Droplets className="w-6 h-6 text-blue-600" />,
    category: 'safety',
    dutchTerm: 'Overstromingsrisico',
    source: 'Klimaateffectatlas / Waterschappen',
    sourceUrl: 'https://www.klimaateffectatlas.nl/'
  },
  {
    id: 'foundationRisk',
    icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    category: 'safety',
    dutchTerm: 'Funderingsrisico',
    source: 'KCAF / Rijksoverheid',
    sourceUrl: 'https://www.kcaf.nl/'
  },
  // Nature & Protected Areas
  {
    id: 'natura2000',
    icon: <TreePine className="w-6 h-6 text-green-600" />,
    category: 'nature',
    dutchTerm: 'Natura 2000-gebieden',
    source: 'PDOK / European Commission',
    sourceUrl: 'https://ec.europa.eu/environment/nature/natura2000/'
  },
  {
    id: 'nationalParks',
    icon: <TreePine className="w-6 h-6 text-green-700" />,
    category: 'nature',
    dutchTerm: 'Nationale Parken',
    source: 'Nationaal Park Nederland',
    sourceUrl: 'https://www.nationaalpark.nl/'
  },
  {
    id: 'droneNoFly',
    icon: <Plane className="w-6 h-6 text-red-500" />,
    category: 'nature',
    dutchTerm: 'Drone-verbodsgebieden',
    source: 'LVNL / Rijksoverheid',
    sourceUrl: 'https://www.lvnl.nl/'
  },
  // Infrastructure & Property
  {
    id: 'cadastral',
    icon: <LandPlot className="w-6 h-6 text-purple-600" />,
    category: 'infrastructure',
    dutchTerm: 'Kadastrale percelen',
    source: 'Kadaster',
    sourceUrl: 'https://www.kadaster.nl/'
  },
  {
    id: 'neighborhoods',
    icon: <Map className="w-6 h-6 text-purple-500" />,
    category: 'infrastructure',
    dutchTerm: 'Buurten',
    source: 'CBS',
    sourceUrl: 'https://www.cbs.nl/'
  },
  // Amenities
  {
    id: 'schools',
    icon: <GraduationCap className="w-6 h-6 text-amber-500" />,
    category: 'amenities',
    dutchTerm: 'Scholen',
    source: 'DUO / Rijksoverheid',
    sourceUrl: 'https://www.duo.nl/'
  },
  {
    id: 'healthcare',
    icon: <Heart className="w-6 h-6 text-red-500" />,
    category: 'amenities',
    dutchTerm: 'Zorgvoorzieningen',
    source: 'Vektis / RIVM',
  },
  {
    id: 'supermarkets',
    icon: <ShoppingCart className="w-6 h-6 text-green-600" />,
    category: 'amenities',
    dutchTerm: 'Supermarkten',
    source: 'OpenStreetMap / CBS',
  },
  {
    id: 'trainStations',
    icon: <Train className="w-6 h-6 text-blue-800" />,
    category: 'amenities',
    dutchTerm: 'Treinstations',
    source: 'NS / ProRail',
    sourceUrl: 'https://www.ns.nl/'
  },
  {
    id: 'publicTransport',
    icon: <TramFront className="w-6 h-6 text-orange-600" />,
    category: 'amenities',
    dutchTerm: 'Metro & Tram',
    source: 'GVB / RET / HTM',
  },
  {
    id: 'playgrounds',
    icon: <Baby className="w-6 h-6 text-yellow-500" />,
    category: 'amenities',
    dutchTerm: 'Speeltuinen',
    source: 'OpenStreetMap / Gemeenten',
  },
]

const categoryLabels: Record<string, { label: string, color: string }> = {
  environment: { label: 'Environment & Quality', color: 'bg-emerald-100 text-emerald-800' },
  safety: { label: 'Safety & Risks', color: 'bg-red-100 text-red-800' },
  nature: { label: 'Nature & Protected Areas', color: 'bg-green-100 text-green-800' },
  infrastructure: { label: 'Infrastructure & Property', color: 'bg-purple-100 text-purple-800' },
  amenities: { label: 'Amenities & Services', color: 'bg-blue-100 text-blue-800' },
}

export default function MapGuide() {
  const t = useTranslations('guide')

  // Group layers by category
  const groupedLayers = layers.reduce((acc, layer) => {
    if (!acc[layer.category]) acc[layer.category] = []
    acc[layer.category].push(layer)
    return acc
  }, {} as Record<string, LayerInfo[]>)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Home className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">WhereToLive</span>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <Link
                href="/map"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Map className="w-4 h-4" />
                <span className="hidden sm:inline">{t('openMap')}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <Link
          href="/map"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToMap')}
        </Link>

        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Introduction */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-12">
          <div className="flex gap-4">
            <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-2">{t('intro.title')}</h2>
              <p className="text-blue-800">{t('intro.description')}</p>
            </div>
          </div>
        </div>

        {/* Layer Categories */}
        {Object.entries(groupedLayers).map(([category, categoryLayers]) => (
          <section key={category} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryLabels[category].color}`}>
                {categoryLabels[category].label}
              </span>
            </div>

            <div className="grid gap-6">
              {categoryLayers.map((layer) => (
                <article
                  key={layer.id}
                  id={layer.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      {layer.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {t(`layers.${layer.id}.title`)}
                          </h3>
                          {layer.dutchTerm && (
                            <p className="text-sm text-gray-500 italic">
                              Dutch: {layer.dutchTerm}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-600 mb-4">
                        {t(`layers.${layer.id}.description`)}
                      </p>

                      {/* Why it matters */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">{t('whyMatters')}</h4>
                        <p className="text-gray-700 text-sm">
                          {t(`layers.${layer.id}.whyMatters`)}
                        </p>
                      </div>

                      {/* Source */}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{t('dataSource')}:</span>
                        {layer.sourceUrl ? (
                          <a
                            href={layer.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            {layer.source}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span>{layer.source}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Dutch Terms Glossary */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('glossary.title')}</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{t('glossary.places')}</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Buurt</dt>
                    <dd className="text-gray-900 font-medium">Neighborhood</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Wijk</dt>
                    <dd className="text-gray-900 font-medium">District</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Gemeente</dt>
                    <dd className="text-gray-900 font-medium">Municipality</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Provincie</dt>
                    <dd className="text-gray-900 font-medium">Province</dd>
                  </div>
                </dl>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{t('glossary.terms')}</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Leefbaarheid</dt>
                    <dd className="text-gray-900 font-medium">Livability</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Veiligheid</dt>
                    <dd className="text-gray-900 font-medium">Safety</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Woonomgeving</dt>
                    <dd className="text-gray-900 font-medium">Living environment</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Voorzieningen</dt>
                    <dd className="text-gray-900 font-medium">Amenities/Facilities</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">{t('cta.subtitle')}</p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            <Map className="w-5 h-5" />
            {t('cta.button')}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </div>
  )
}
