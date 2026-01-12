# Deployment (Vercel) + Keys

## Vercel environment variables
Set these in Vercel for both **Production** and **Preview**.

### Live Preview (recommended: CodeSandbox)
- `PREVIEW_PROVIDER=codesandbox`
- `CSB_API_KEY=csb_v1_...`

### AI (required to generate code)
- `DEEPSEEK_API_KEY=...`
- Optional: `LLM_PROVIDER=deepseek`
- Optional: `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- Optional: `DEEPSEEK_MODEL=deepseek-chat`

### Optional
- `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app` (metadata)

## Where to get the keys

### CodeSandbox API key (`CSB_API_KEY`)
1. Open CodeSandbox.
2. Go to **Settings** → **API Tokens / Personal Access Tokens**.
3. Create a token and copy it once.
4. Paste it into Vercel as `CSB_API_KEY`.

Security:
- Never commit this token to git.
- If you pasted it into chat/console by accident, revoke/rotate it immediately and use a new one.

### DeepSeek API key (`DEEPSEEK_API_KEY`)
1. Open the DeepSeek developer dashboard.
2. Create an API key.
3. Paste it into Vercel as `DEEPSEEK_API_KEY`.
