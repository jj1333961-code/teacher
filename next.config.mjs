/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/app.html', destination: '/login', permanent: true },
      { source: '/admin.html', destination: '/admin', permanent: true },
      { source: '/student.html', destination: '/student', permanent: true },
      { source: '/parent.html', destination: '/parent', permanent: true },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        { source: '/login', destination: '/app.html' },
        { source: '/signup', destination: '/app.html?page=signupStep1' },
        { source: '/forgot-password', destination: '/app.html?page=accountRecoveryPage' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/student', destination: '/student.html' },
        { source: '/parent', destination: '/parent.html' },
      ],
    }
  },
  async headers() {
    return [
      { source: '/:path*.(js|css|woff2|png|jpg|jpeg|svg|webp)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/quran/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ]
  },
}

export default nextConfig
