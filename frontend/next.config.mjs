/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow cross-origin requests to FastAPI backend in dev
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
