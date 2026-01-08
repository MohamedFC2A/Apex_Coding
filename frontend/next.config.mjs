/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backend && /^https?:\/\//i.test(backend)) return [];
    // Rewrite specific API routes to external backend, excluding AI routes
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*'
      },
      {
        source: '/api/download/:path*',
        destination: 'http://localhost:3001/api/download/:path*'
      }
      // AI routes (/api/ai/*) will be handled by Next.js API routes
    ];
  }
};

export default nextConfig;
