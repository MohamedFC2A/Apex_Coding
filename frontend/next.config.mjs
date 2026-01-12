/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  allowedDevOrigins: ['*'],
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backend && /^https?:\/\//i.test(backend)) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*'
      },
      {
        source: '/api/download/:path*',
        destination: 'http://localhost:3001/api/download/:path*'
      }
    ];
  }
};

export default nextConfig;
