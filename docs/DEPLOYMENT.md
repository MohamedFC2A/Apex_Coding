# Deployment (Vercel) + Keys

## Vercel environment variables
Set these in Vercel for both **Production** and **Preview**.

### Live Preview
- Built-in Simple Live Preview only
- No external provider keys required

### AI (required to generate code)
- `DEEPSEEK_API_KEY=...`
- Optional: `LLM_PROVIDER=deepseek`
- Optional: `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- Optional: `DEEPSEEK_MODEL=deepseek-chat`

### Optional
- `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app` (metadata)

## Where to get the keys

### DeepSeek API key (`DEEPSEEK_API_KEY`)
1. Open the DeepSeek developer dashboard.
2. Create an API key.
3. Paste it into Vercel as `DEEPSEEK_API_KEY`.
