/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
