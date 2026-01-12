# Apex Preview Runner (StackBlitz Replacement)

Runs AI-generated TypeScript projects on your own server using Docker, then serves them as a live preview using per-session subdomains (e.g. `https://<session>.preview.example.com`).

## What you get
- Works with real `npm` projects (Vite/Next/Express/etc) instead of browser-only sandboxes.
- One runner port only; sessions are proxied internally (WebSockets supported for HMR).
- API is protected with a bearer token; the preview itself is public via an unguessable session subdomain.

## Local dev (no DNS needed)
On Windows, `*.localhost` does not always resolve in every tool, so local dev defaults to **path-based** session URLs like `http://localhost:8080/s/<id>/`.

1) Build + run:
```bash
cd preview-runner
docker compose up --build
```

2) Configure a token (recommended):
- Copy `preview-runner/.env.example` to `preview-runner/.env`
- Set `PREVIEW_RUNNER_TOKEN` to a long random string
 - If your machine is low on RAM, set `SESSION_MEMORY_MB=768` (or even `512` for tiny projects)

3) Set the same values in your app backend (server-side env):
- `PREVIEW_RUNNER_URL=http://localhost:8080`
- `PREVIEW_RUNNER_TOKEN=<same token>`

## Production (recommended)
1) Create a wildcard DNS record:
- `*.preview.example.com -> <your-server-ip>`

2) Run the runner on your server (Docker is recommended).

3) Put TLS in front of it (recommended). You will need a wildcard certificate for `*.preview.example.com` (usually via DNS challenge).

## URL modes
- `PREVIEW_URL_MODE=path` (best for local dev): URLs look like `http://localhost:8080/s/<id>/`
- `PREVIEW_URL_MODE=subdomain` (best for production): URLs look like `https://<id>.preview.example.com/`

## Requirements for generated projects
The preview runner expects:
- `npm run dev` starts the frontend on `0.0.0.0:3000`
- If there is a backend, it listens on `0.0.0.0:3001` and the frontend proxies `/api` to it during dev

