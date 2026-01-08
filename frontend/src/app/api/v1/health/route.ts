export const runtime = 'edge';

export async function GET() {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? process.uptime() : 0,
    service: 'nexus-apex-api',
    version: '1.0.0',
    checks: {
      api: 'ok',
      deepseek: process.env.DEEPSEEK_API_KEY ? 'ok' : 'missing_key',
    },
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
