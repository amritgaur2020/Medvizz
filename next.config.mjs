/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.znkj.com' },
      { protocol: 'https', hostname: '**.myqcloud.com' },
      { protocol: 'https', hostname: 'alb.neural4d.com' },
    ],
  },
  // Exclude better-sqlite3 from serverless bundling (it's a native C++ module)
  serverExternalPackages: ['better-sqlite3'],
  // Allow large response bodies for GLB model proxy (Neural4D models can be ~10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
