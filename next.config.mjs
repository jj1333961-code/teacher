/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        // الجذر يعرض شاشة ترحيب خفيفة ومستقلة؛ التطبيق الكامل يُحمّل فقط بعد انتهاء التلاوة.
        { source: '/', destination: '/index.html' },
        { source: '/login', destination: '/app.html?page=lockScreen' },
        { source: '/forgot-account', destination: '/app.html?page=accountRecoveryPage' },
        { source: '/create-account', destination: '/app.html?page=signupStep1' },
        { source: '/home', destination: '/app.html?page=homePage' },
        { source: '/admin/:page', destination: '/admin.html?page=:page' },
        { source: '/student/:page', destination: '/student.html?page=:page' },
        { source: '/parent/:page', destination: '/parent.html?page=:page' },
      ],
    }
  },
}

export default nextConfig
