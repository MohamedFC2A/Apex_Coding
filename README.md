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

### Live Preview (recommended: CodeSandbox)
This project can generate a CodeSandbox sandbox from the current project files and embed it in the app.

- `PREVIEW_PROVIDER=codesandbox`
- `CSB_API_KEY=csb_v1_...`

Notes:
- The key is stored server-side only (Vercel env). Do not put it in the frontend.

### Live Preview (legacy: self-hosted preview-runner)
If you prefer running previews on your own server via Docker:

- `PREVIEW_PROVIDER=preview-runner`
- `PREVIEW_RUNNER_URL=https://preview.example.com`
- `PREVIEW_RUNNER_TOKEN=...` (must match the runner)

## Deployment (Vercel)
1. Push to GitHub.
2. Import the repo in Vercel.
3. Add Environment Variables (Production + Preview).
4. Deploy.

### Vercel env checklist
- `DEEPSEEK_API_KEY`
- `PREVIEW_PROVIDER=codesandbox`
- `CSB_API_KEY`
- Optional: `NEXT_PUBLIC_SITE_URL` (used for metadata)

## Security
- Never commit API keys/tokens (`.env` is gitignored).
- If a token was pasted into chat/logs, rotate it in the provider dashboard.
