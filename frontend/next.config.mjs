/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '.replit.dev',
    '.repl.co',
    '.janeway.replit.dev'
  ],
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ];
  }
};

export default nextConfig;
