// This file exists for the default locale (en) when using localePrefix: 'as-needed'
// The actual page content is in [locale]/page.tsx
// This redirect ensures proper locale handling

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/en')
}
