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
    // We proxy both development and production internally on Replit
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ];
  }
};

export default nextConfig;
