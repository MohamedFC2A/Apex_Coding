// Local dev server for the Vercel-style Express app in `api/index.js`.
const app = require('./index.js');

const portRaw = process.env.PORT || process.env.API_PORT || 3001;
const port = Number(portRaw) || 3001;

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://0.0.0.0:${port}`);
});

