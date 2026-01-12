import { NextResponse } from 'next/server';

const getRunnerConfig = () => {
  const url = String(process.env.PREVIEW_RUNNER_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.PREVIEW_RUNNER_TOKEN || '').trim();
  return { url, token };
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { url, token } = getRunnerConfig();
  if (!url || !token) return NextResponse.json({ error: 'Preview runner is not configured' }, { status: 500 });

  const { id } = await ctx.params;
  const upstream = await fetch(`${url}/api/sessions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { url, token } = getRunnerConfig();
  if (!url || !token) return NextResponse.json({ error: 'Preview runner is not configured' }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { id } = await ctx.params;
  const upstream = await fetch(`${url}/api/sessions/${encodeURIComponent(id)}/files`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { url, token } = getRunnerConfig();
  if (!url || !token) return NextResponse.json({ error: 'Preview runner is not configured' }, { status: 500 });

  const { id } = await ctx.params;
  const upstream = await fetch(`${url}/api/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
  });
}

