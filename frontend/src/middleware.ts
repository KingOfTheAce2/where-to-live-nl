import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales: locales as unknown as string[],

  // Used when no locale matches
  defaultLocale: 'en',

  // Don't redirect the default locale
  localePrefix: 'as-needed'
});

export const config = {
  // Match all pathnames except for API routes, static files, etc.
  matcher: ['/', '/(en|nl|de|fr|pl|es|ru|uk|it|pt)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
