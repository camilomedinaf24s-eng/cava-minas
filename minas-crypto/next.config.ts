import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Publish-app / grok.bot hosts Next route handlers under app/api/*
  poweredByHeader: false,
}

export default nextConfig
