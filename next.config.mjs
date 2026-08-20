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
        // النسخة القديمة: الجذر يعرض صفحة الترحيب (التطبيق الكامل) من public/index.html
        { source: '/', destination: '/index.html' },
      ],
    }
  },
}

export default nextConfig
