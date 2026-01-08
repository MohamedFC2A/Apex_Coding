# Vercel Deployment Guide

## Environment Variables Setup

You need to configure the following environment variables in your Vercel project settings:

### Backend API Variables (Required)
Go to Vercel Project Settings → Environment Variables and add:

```
DEEPSEEK_API_KEY=sk-abdd5c2f95804095bf94338040ac74a8
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_THINKING_MODEL=deepseek-reasoner
```

### Frontend Variables (Required)
```
NEXT_PUBLIC_BACKEND_URL=/api
NEXT_PUBLIC_CONVEX_URL=https://necessary-terrier-448.convex.cloud
VITE_DEEPSEEK_API_KEY=sk-abdd5c2f95804095bf94338040ac74a8
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-chat
VITE_DEEPSEEK_THINKING_MODEL=deepseek-reasoner
```

## Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Fix Vercel deployment configuration"
   git push origin main
   ```

2. **Configure Vercel Project Settings**
   - Go to https://vercel.com/dashboard
   - Select your project (apex-coding)
   - Go to Settings → Environment Variables
   - Add all the variables listed above
   - Make sure to add them for all environments (Production, Preview, Development)

3. **Redeploy**
   - Go to Deployments tab
   - Click on the three dots menu on the latest deployment
   - Click "Redeploy"
   - Or push a new commit to trigger automatic deployment

## Troubleshooting

### 405 Error on /api/ai/plan
This means the API route is not properly configured. Make sure:
- ✅ All environment variables are set in Vercel
- ✅ The `vercel.json` file is in the root directory
- ✅ The API key is valid and not expired
- ✅ You've redeployed after adding environment variables

### Check Deployment Logs
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Check the "Build Logs" and "Function Logs" tabs
4. Look for any errors related to missing environment variables

## Local Development vs Production

- **Local**: Uses `http://localhost:3001/api` (set in `frontend/.env`)
- **Production**: Uses `/api` (relative path, handled by Vercel routing)

The `NEXT_PUBLIC_BACKEND_URL` should be:
- Local: `http://localhost:3001/api`
- Production: `/api`
