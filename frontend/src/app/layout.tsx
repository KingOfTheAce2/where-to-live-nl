import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Where to Live NL - Find Your Perfect Dutch Neighborhood',
  description: 'Multi-destination travel time calculator for finding housing in the Netherlands. Search by commute time to work, school, and other important locations.',
  keywords: ['Netherlands', 'housing', 'expat', 'travel time', 'Amsterdam', 'Rotterdam', 'Utrecht', 'livability'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
