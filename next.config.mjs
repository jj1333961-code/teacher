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
        // توافق مرحلي: لا تُحمّل المنصة القديمة إلا عند طلب هذا المسار صراحة.
        { source: '/legacy', destination: '/index.html' },
      ],
    }
  },
}

export default nextConfig
