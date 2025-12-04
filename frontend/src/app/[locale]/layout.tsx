import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/i18n'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Where to Live NL - Find Your Perfect Dutch Neighborhood',
  description: 'Multi-destination travel time calculator for finding housing in the Netherlands. Search by commute time to work, school, and other important locations.',
  keywords: ['Netherlands', 'housing', 'expat', 'travel time', 'Amsterdam', 'Rotterdam', 'Utrecht', 'livability'],
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound()
  }

  // Get messages for the locale
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
