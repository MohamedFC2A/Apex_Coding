const path = require('path');
const tar = require('tar-stream');

const normalizeWorkspacePath = (raw) => {
  const p = String(raw || '').replace(/\\/g, '/').trim();
  if (!p) return null;
  const noLead = p.startsWith('/') ? p.slice(1) : p;
  if (!noLead) return null;
  if (noLead.includes('\0')) return null;
  const posix = path.posix.normalize(noLead);
  if (!posix || posix === '.' || posix.startsWith('..') || posix.includes('/../')) return null;
  return posix;
};

const buildTarFromFiles = ({ rootPrefix, files }) => {
  const pack = tar.pack();
  const prefix = String(rootPrefix || '').trim();

  const entries = Object.entries(files || {});
  (async () => {
    try {
      const dirSet = new Set();
      for (const [rawPath] of entries) {
        const normalized = normalizeWorkspacePath(rawPath);
        if (!normalized) continue;
        const dir = path.posix.dirname(normalized);
        if (!dir || dir === '.' || dir === '/') continue;
        const parts = dir.split('/').filter(Boolean);
        let acc = '';
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          dirSet.add(acc);
        }
      }

      const sortedDirs = Array.from(dirSet).sort((a, b) => a.localeCompare(b));
      for (const d of sortedDirs) {
        const name = prefix ? `${prefix}/${d}` : d;
        await new Promise((resolve, reject) => {
          pack.entry({ name, mode: 0o755, type: 'directory' }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      for (const [rawPath, content] of entries) {
        const normalized = normalizeWorkspacePath(rawPath);
        if (!normalized) continue;
        const name = prefix ? `${prefix}/${normalized}` : normalized;
        const buf = Buffer.from(String(content || ''), 'utf8');
        await new Promise((resolve, reject) => {
          pack.entry({ name, mode: 0o644, type: 'file', size: buf.length }, buf, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      pack.finalize();
    }
  })();

  return pack;
};

module.exports = { buildTarFromFiles, normalizeWorkspacePath };
