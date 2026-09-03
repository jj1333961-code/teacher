/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/login/:path*', destination: '/app.html' },
        { source: '/login', destination: '/app.html' },
        { source: '/signup/:path*', destination: '/app.html' },
        { source: '/signup', destination: '/app.html' },
        { source: '/register/:path*', destination: '/app.html' },
        { source: '/register', destination: '/app.html' },
        { source: '/forgot-password', destination: '/app.html' },
        // Dashboard, students, profile, and settings are App Router pages.
        // Only legacy screens below still use their role-specific static shell.
        { source: '/quran-reader/:path*', destination: '/app.html' },
        { source: '/quran-reader', destination: '/app.html' },
        { source: '/tuhfat/:path*', destination: '/app.html' },
        { source: '/tuhfat', destination: '/app.html' },
        { source: '/admin/:path*', destination: '/admin.html' },
        { source: '/student/:path*', destination: '/student.html' },
        { source: '/parent/:path*', destination: '/parent.html' },
      ],
    }
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/:path*.(woff2|png|jpg|jpeg|svg|webp)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/:path*.(js|css)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
      { source: '/quran/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ]
  },
}

export default nextConfig
