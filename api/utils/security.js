const redactHeaders = (headers) => {
  const out = {};
  const input = headers && typeof headers === 'object' ? headers : {};

  for (const [kRaw, v] of Object.entries(input)) {
    const k = String(kRaw || '').toLowerCase();
    const isSensitive =
      k === 'authorization' ||
      k === 'cookie' ||
      k === 'set-cookie' ||
      k.includes('token') ||
      k.includes('secret') ||
      k.includes('key');

    if (isSensitive) {
      out[kRaw] = '[REDACTED]';
      continue;
    }

    out[kRaw] = v;
  }

  return out;
};

const parseAllowedOrigins = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

module.exports = { redactHeaders, parseAllowedOrigins };

