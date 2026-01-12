/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '.csb.app',
    'codesandbox.io',
    '.codesandbox.io',
    '.replit.dev',
    '.repl.co',
    '.janeway.replit.dev'
  ],
  async rewrites() {
    // Local dev: proxy Next -> local Express API.
    // Vercel: DO NOT proxy to localhost; let `vercel.json` route `/api/*` to the serverless function.
    if (process.env.VERCEL) return [];

    return [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }];
  }
};

export default nextConfig;
