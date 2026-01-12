import { NextResponse } from 'next/server';

const getRunnerConfig = () => {
  const url = String(process.env.PREVIEW_RUNNER_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.PREVIEW_RUNNER_TOKEN || '').trim();
  return { url, token };
};

export async function POST(req: Request) {
  const { url, token } = getRunnerConfig();
  if (!url || !token) {
    return NextResponse.json(
      {
        error: 'Preview runner is not configured (PREVIEW_RUNNER_URL / PREVIEW_RUNNER_TOKEN)',
        missing: ['PREVIEW_RUNNER_URL', 'PREVIEW_RUNNER_TOKEN'].filter((k) => !String(process.env[k] || '').trim())
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  try {
    const upstream = await fetch(`${url}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    const text = await upstream.text().catch(() => '');
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Failed to reach preview runner',
        details: String(err?.message || err || 'unknown'),
        previewRunnerUrl: url
      },
      { status: 502 }
    );
  }
}

