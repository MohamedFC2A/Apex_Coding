# Apex Coding IDE - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Git

### Installation

```bash
# 1. Clone the repository (if needed)
git clone https://github.com/yourusername/apex-coding.git
cd apex-coding

# 2. Install dependencies
npm install

# 3. Start development servers
npm run dev
```

This will start:
- **Frontend**: http://localhost:5173 (Next.js + React)
- **Backend**: http://localhost:3001 (Express.js)

---

## 🎬 Live Preview Setup

### Quick Setup (Recommended - WebContainer)

**Default Configuration** - No additional setup needed!

```bash
# The default .env is already configured for WebContainer:
# PREVIEW_PROVIDER=webcontainer

# Just run:
npm run dev

# Open http://localhost:5173 in your browser
# Generate code → See live preview instantly
```

**Benefits:**
- ✅ Zero configuration
- ✅ Works offline
- ✅ Instant preview
- ✅ No API keys needed

---

### Advanced Setup (CodeSandbox - Optional)

If you prefer CodeSandbox Preview, you can enable it:

#### Step 1: Get CodeSandbox API Key
1. Visit: https://codesandbox.io/dashboard/settings/api-keys
2. Click "Create API Key"
3. Copy the generated key

#### Step 2: Configure .env
```env
PREVIEW_PROVIDER=codesandbox
CSB_API_KEY=csb_v1_your_key_here_1a2b3c4d5e6f7g8h9i0j
```

#### Step 3: Restart Development Server
```bash
# Stop current npm run dev (Ctrl+C)
npm run dev
```

---

## 📊 Preview Engine Comparison

| Feature | WebContainer | CodeSandbox |
|---------|-------------|-------------|
| **Setup** | None | Requires API Key |
| **Cost** | Free | Free |
| **Speed** | ⚡ Lightning Fast | ⏱️ Depends on Sandbox |
| **Offline** | ✅ Works | ❌ Requires Internet |
| **Backend** | ✅ Supports Node.js | ✅ Yes |
| **First Load** | ~5-10s | ~20-30s |
| **Subsequent** | ~2-3s | ~5-10s |

**Recommendation**: Use **WebContainer** for development (default). Use **CodeSandbox** only if you need specific features.

---

## 🔧 Environment Variables Explained

### Frontend (`VITE_*` prefix required)

```env
# API Backend URL - Change to your production backend
VITE_BACKEND_URL=http://localhost:3001

# DeepSeek AI API (for code generation)
VITE_DEEPSEEK_API_KEY=sk_your_key_here
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-chat

# Frontend URL (for CORS in backend)
FRONTEND_URL=http://localhost:5173
```

### Backend (No prefix)

```env
# Same DeepSeek key
DEEPSEEK_API_KEY=sk_your_key_here

# Frontend origin (for CORS)
FRONTEND_URL=http://localhost:5173
```

### Preview Configuration

```env
# Choose: webcontainer (default) or codesandbox
PREVIEW_PROVIDER=webcontainer

# Only if using CodeSandbox
CSB_API_KEY=csb_v1_your_key_here
```

---

## 🎯 How Live Preview Works

### WebContainer Preview (Default)
```
1. You write/generate code
2. Files are mounted to WebContainer filesystem
3. npm install runs (if package.json exists)
4. Dev server starts (Vite, Next.js, etc.)
5. Preview iframe loads dev server URL
6. Any file changes auto-sync
```

### CodeSandbox Preview
```
1. Backend receives files
2. Backend uploads to CodeSandbox API
3. CodeSandbox creates a sandbox
4. Preview iframe loads sandbox URL
5. Requires CSB_API_KEY to be configured
```

---

## 🚨 Troubleshooting Live Preview

### "Preview Not Available"
**Cause**: Usually means WebContainer failed to boot or CodeSandbox API isn't configured
**Solution**:
1. Check browser console (F12) for errors
2. Ensure backend is running (`npm run dev`)
3. Try refreshing the page
4. Check that your .env is configured correctly

### "CodeSandbox API key is not configured"
**Cause**: Using CodeSandbox but CSB_API_KEY is missing
**Solutions**:
- **Option A**: Switch to default WebContainer (set `PREVIEW_PROVIDER=webcontainer`)
- **Option B**: Configure CodeSandbox API key (see "Advanced Setup" above)

### Preview loads but shows blank/white page
**Cause**: Dev server may not be responding
**Solution**:
1. Check terminal for build errors
2. Verify package.json has proper build scripts
3. Check if port 3000+ is available
4. Try "Retry Preview" button

### Preview very slow
**Cause**: First load with package.json installs dependencies (can take 1-3 min)
**Solution**:
- **Wait it out** - First load is slowest
- Subsequent previews load much faster
- Consider using WebContainer instead if CodeSandbox is slow

---

## 📝 Project Types & Preview Selection

The IDE automatically chooses the right preview engine based on your project:

| Project Type | Files | Engine Used | Notes |
|--------------|-------|-------------|-------|
| HTML/CSS/JS only | `*.html`, `*.css`, `*.js` | Simple | Lightweight, instant |
| React/Vue/Svelte | Has `package.json` | WebContainer | Full build tools support |
| Backend + Frontend | `backend/` folder | CodeSandbox* | Requires API key* |

*Can use WebContainer for backends with proper configuration

---

## 🎨 Customizing Preview

### Change Default Preview Engine

Edit `.env`:
```env
# Use WebContainer (recommended for frontend projects)
PREVIEW_PROVIDER=webcontainer

# OR use CodeSandbox (requires setup)
PREVIEW_PROVIDER=codesandbox
```

### Toggle Preview Visibility

In the IDE, use the eye icon in the top right to show/hide the preview panel.

### View Terminal Output

Click the terminal icon in the preview titlebar to see build output and errors.

---

## 🚀 Production Deployment

### Frontend (Vercel)

```bash
# Vercel automatically deploys from git
# Set these environment variables in Vercel dashboard:

VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_DEEPSEEK_API_KEY=sk_your_key
FRONTEND_URL=https://your-frontend.vercel.app
```

### Backend (Render or Railway)

```bash
# Set these environment variables:

DEEPSEEK_API_KEY=sk_your_key
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## 📚 Useful Resources

- [WebContainer Documentation](https://webcontainer.io/)
- [CodeSandbox API Docs](https://codesandbox.io/docs/api)
- [DeepSeek API Docs](https://platform.deepseek.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Documentation](https://expressjs.com/docs)

---

## 💡 Tips & Best Practices

1. **Use WebContainer by default** - It's the fastest and requires no setup
2. **Keep .env.local private** - Never commit real API keys
3. **Test locally first** - Use `npm run dev` before deploying
4. **Check terminal output** - Preview errors show in the terminal tab
5. **Use specific node versions** - Add `.nvmrc` or `package.json` engines

---

## 🐛 Getting Help

If you encounter issues:

1. **Check the terminal** - Most errors are logged there
2. **View browser console** - F12 → Console tab
3. **Check .env file** - Compare with `.env.example`
4. **Restart dev server** - Sometimes helps with stale state
5. **Clear browser cache** - Ctrl+Shift+Delete

---

**Happy coding! 🎉**
