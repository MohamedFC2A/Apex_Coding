# Apex Coding — Next‑Gen AI IDE

A dark, glassy AI coding environment with a Monaco editor, project‑aware generation, and a shareable Live Preview.

## Local dev

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5000` and proxies `/api/*` to the local API on `http://localhost:3001`.

## Environment

Copy `env.example.txt` to `.env` and set your real values.

### Required (AI)
- `DEEPSEEK_API_KEY` (server-side, never commit)
- Optional: `LLM_PROVIDER`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`

### Live Preview
This project uses built-in **Simple Live Preview** only (static HTML/CSS/JS rendering in-app + open route).

- No external preview provider
- No API key required
- Open links use `/live-preview/{projectId}` or `/app/live-preview/{projectId}`

## Deployment (Vercel)
1. Push to GitHub.
2. Import the repo in Vercel.
3. Add Environment Variables (Production + Preview).
4. Deploy.

### Vercel env checklist
- `DEEPSEEK_API_KEY`
- Optional: `NEXT_PUBLIC_SITE_URL` (used for metadata)

## Security
- Never commit API keys/tokens (`.env` is gitignored).
- If a token was pasted into chat/logs, rotate it in the provider dashboard.
