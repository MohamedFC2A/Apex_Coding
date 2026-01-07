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
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ];
  }
};

export default nextConfig;
