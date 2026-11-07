import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Default distDir `.next` — publish-app Next host looks for `.next` after build.
  // Do NOT set distDir:'dist' (that broke the host while vercel.json says nextjs).
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
