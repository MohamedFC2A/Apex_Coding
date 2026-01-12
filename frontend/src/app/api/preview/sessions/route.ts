import { NextResponse } from 'next/server';

const getRunnerConfig = () => {
  const url = String(process.env.PREVIEW_RUNNER_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.PREVIEW_RUNNER_TOKEN || '').trim();
  return { url, token };
};

const joinUrlPath = (baseUrl: string, path: string) => {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const p = String(path || '');
  if (!base) return p;
  if (!p) return base;
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/${p}`;
};

const rewritePreviewSessionUrl = (runnerBaseUrl: string, maybeUrl: string) => {
  const raw = String(maybeUrl || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/')) return joinUrlPath(runnerBaseUrl, raw);
  try {
    const parsed = new URL(raw);
    return joinUrlPath(runnerBaseUrl, `${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return raw;
  }
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
    const contentType = upstream.headers.get('content-type') || 'application/json';

    if (upstream.ok && contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && typeof data.url === 'string') {
          data.url = rewritePreviewSessionUrl(url, data.url);
          return NextResponse.json(data, { status: upstream.status });
        }
      } catch {
        // fall through
      }
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': contentType }
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

