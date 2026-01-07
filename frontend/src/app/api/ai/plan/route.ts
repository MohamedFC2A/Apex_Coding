export const runtime = 'edge';

const PLAN_SYSTEM_PROMPT =
  'You are a Software Architect. Output ONLY raw JSON (no markdown, no code fences) with shape {"title":"...","steps":[{"id":"1","title":"..."}]}.';

const normalizeDeepSeekBaseUrl = (raw: string | undefined) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const json = (status: number, body: any, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extraHeaders
    }
  });

const cleanAndParseJSON = (raw: string) => {
  const text = String(raw || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  return JSON.parse(text);
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const prompt = String(body?.prompt || '').trim();
    if (!prompt) return json(400, { error: 'Prompt is required' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return json(500, { error: 'API Key missing on Backend' });

    const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL);
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const request = {
      model,
      temperature: 0.0,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    };

    const fetchOnce = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        return await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ ...request, response_format: { type: 'json_object' } }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let res = await fetchOnce();
    if (!res.ok) {
      // One lightweight retry to smooth out transient upstream timeouts.
      await new Promise((r) => setTimeout(r, 450));
      res = await fetchOnce();
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json(500, { error: text || `DeepSeek request failed (${res.status})` });
    }

    const completion = await res.json().catch(() => ({} as any));
    let content = completion?.choices?.[0]?.message?.content || '';
    if (!content) return json(500, { error: 'Empty AI response' });

    const parsed = cleanAndParseJSON(content);
    const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
    const steps = Array.isArray(stepsRaw)
      ? stepsRaw
          .map((step: any, index: number) => {
            if (typeof step === 'string') {
              const title = step.trim();
              return title ? { id: String(index + 1), title } : null;
            }
            const title = String(step?.title ?? step?.text ?? step?.step ?? '').trim();
            if (!title) return null;
            return { id: String(step?.id ?? index + 1), title };
          })
          .filter(Boolean)
      : [];

    const title = typeof parsed?.title === 'string' ? parsed.title : 'Architecture Plan';
    return json(200, { title, steps });
  } catch (e: any) {
    return json(500, {
      error: e?.message || 'Plan Generation Failed',
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.' }]
    });
  }
}
