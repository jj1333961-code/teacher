/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/app.html' },
        { source: '/login/:path*', destination: '/app.html' },
        { source: '/login', destination: '/app.html' },
        { source: '/signup/:path*', destination: '/app.html' },
        { source: '/signup', destination: '/app.html' },
        { source: '/forgot-password', destination: '/app.html' },
        { source: '/quran-reader', destination: '/app.html' },
        { source: '/tuhfat', destination: '/app.html' },
        // واجهة واحدة مشتركة تمنع تكرار HTML الكبير وتضمن اتساق الحالة بين كل الأدوار.
        { source: '/admin/:path*', destination: '/app.html' },
        { source: '/admin', destination: '/app.html' },
        { source: '/student/:path*', destination: '/app.html' },
        { source: '/student', destination: '/app.html' },
        { source: '/parent/:path*', destination: '/app.html' },
        { source: '/parent', destination: '/app.html' },
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
