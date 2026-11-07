import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Publish-app / grok.bot hosts Next route handlers under app/api/*
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
