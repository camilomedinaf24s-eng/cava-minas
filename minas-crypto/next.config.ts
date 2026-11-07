import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // publish-app / grok.bot expects Output Directory `dist` (Vite legacy name).
  // Next still emits a full server build here — NOT a static export — so
  // `next start` + app/api route handlers keep working on the host.
  distDir: 'dist',
  poweredByHeader: false,
  // cursor/identity.ts imports ./identity.dev.js (generated); map to .ts locally
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return config
  },
}

export default nextConfig
