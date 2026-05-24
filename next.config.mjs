/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Exclude better-sqlite3 from serverless bundling (it's a native C++ module)
  // On Vercel, the chat API gracefully skips SQLite and still works
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
