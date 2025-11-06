/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_PDOK_TILES_URL: process.env.NEXT_PUBLIC_PDOK_TILES_URL || 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0',
    NEXT_PUBLIC_PDOK_GEOCODING_URL: process.env.NEXT_PUBLIC_PDOK_GEOCODING_URL || 'https://api.pdok.nl/bzk/locatieserver/search/v3_1',
  },

  // Webpack configuration for MapLibre
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    return config;
  },
};

module.exports = nextConfig;
