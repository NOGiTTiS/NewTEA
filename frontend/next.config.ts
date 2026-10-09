import type { NextConfig } from 'next'

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  (process.env.NODE_ENV === 'production' ? 'http://tea-backend:8080' : 'http://127.0.0.1:8080')

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path((?!auth).*)',
        destination: `${backendUrl}/api/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`
      }
    ]
  }
}

export default nextConfig
