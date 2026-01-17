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
  // Suppress console errors for missing static files
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Ensure static files are served correctly + WebContainer COOP/COEP
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // WebContainer requires these headers for SharedArrayBuffer
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Local dev: proxy Next -> local Express API.
    // Vercel: DO NOT proxy to localhost; let `vercel.json` route `/api/*` to the serverless function.
    if (process.env.VERCEL) return [];

    return [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }];
  },
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  // The webpack fallbacks are not needed with Turbopack
  turbopack: {},
};

export default nextConfig;
