# Troubleshooting: "Failed to Fetch" Error

## Quick Diagnosis

The "Failed to fetch" error occurs when the frontend cannot communicate with the backend API. Follow this checklist:

### ✅ Step 1: Verify Backend is Running
Check your terminal for this message:
```
[api] listening on http://0.0.0.0:3001
```

**If NOT showing**:
- Kill any existing processes: `taskkill /F /IM node.exe`
- Clear lock files: `Remove-Item -Path "C:\Projects\Apex_Coding\frontend\.next" -Recurse -Force -ErrorAction SilentlyContinue`
- Restart: `npm run dev`

### ✅ Step 2: Verify Port 3001 is Free
In PowerShell:
```powershell
netstat -ano | findstr :3001
```

**If port in use**:
```powershell
# Find PID from above command
taskkill /PID <PID> /F

# Then restart npm run dev
```

### ✅ Step 3: Check Environment Variables

Verify `backend/.env` has:
```
DEEPSEEK_API_KEY=sk_... (your actual key)
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

**If missing**:
1. Get API key from https://platform.deepseek.com/api_keys
2. Add to `backend/.env`
3. Save and restart server

---

## Common Causes & Fixes

### Issue: "Failed to fetch" after entering prompt
**Likely Cause**: Backend not responding to requests

**Solution**:
1. Check browser DevTools (F12) → Network tab
2. Look for POST request to `http://localhost:3001/ai/chat`
3. Check response:
   - **404**: Backend endpoint not found (restart server)
   - **401/403**: API key issue (check env variables)
   - **500**: Server error (check terminal logs)
   - **No response**: Timeout (backend might be hanging)

### Issue: Prompt validation error
**Likely Cause**: Prompt is empty or too long

**Solution**:
- Ensure prompt has actual text (not just spaces)
- Keep prompt under 80,000 characters
- Try with a simple test: "Hello world"

### Issue: CORS error in console
**Likely Cause**: Frontend and backend on different ports (expected in dev)

**Solution**:
- This is normal for local dev
- Backend is configured to allow `http://localhost:5000`
- If using different port, update `NEXT_PUBLIC_BACKEND_URL`

### Issue: Connection timeout (60+ seconds)
**Likely Cause**: AI service is slow or offline

**Solution**:
1. Try a shorter prompt (fewer tokens = faster)
2. Wait and try again (API might be temporarily slow)
3. Check DeepSeek service status
4. Try without thinking mode (Fast mode is faster)

---

## Advanced Debugging

### Enable Browser Network Logging
```javascript
// In DevTools console:
localStorage.setItem('DEBUG', 'apex:*');
// Refresh page and try again
```

### Check Backend Logs
Look for POST request in terminal:
```
[timestamp] [request-id] POST /ai/chat ...
```

If NOT appearing:
- Browser fetch might be failing before reaching server
- Check CORS headers in response
- Verify frontend `apiUrl()` is pointing to correct base URL

### Test API Directly
```powershell
$json = @{
    prompt = "test"
    thinkingMode = $false
} | ConvertTo-Json

$response = Invoke-WebRequest `
  -Uri "http://localhost:3001/ai/chat" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $json `
  -UseBasicParsing `
  -ErrorAction Stop

Write-Host "Status: $($response.StatusCode)"
Write-Host "Headers: $($response.Headers | ConvertTo-Json)"
```

---

## Network Issues

### If behind corporate proxy
Set environment variables before starting:
```powershell
$env:HTTP_PROXY="http://proxy:port"
$env:HTTPS_PROXY="http://proxy:port"
$env:NO_PROXY="localhost"

npm run dev
```

### If on Windows with firewall
Allow port 3001:
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Node Backend 3001" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001
```

---

## Recovery Steps

If nothing works:

### Complete Reset
```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Clear caches
Remove-Item -Path "C:\Projects\Apex_Coding\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Projects\Apex_Coding\frontend\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Projects\Apex_Coding\frontend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue

# Clean install
npm run setup

# Start fresh
npm run dev
```

### Verify Installation
```powershell
# Check Node version
node --version  # Should be v18+

# Check npm version
npm --version   # Should be v8+

# Check backend can start
node backend/server.js
# Should see: [api] listening on http://0.0.0.0:3001
```

---

## When All Else Fails

### Check Backend Directly
```powershell
# In new terminal, start backend only:
node backend/server.js

# In another terminal, test:
curl -X POST http://localhost:3001/ai/chat `
  -H "Content-Type: application/json" `
  -d '{"prompt":"test"}'

# Should get streaming event-stream response
```

### Check Frontend Build
```powershell
# Clear Next.js build
Remove-Item -Path "frontend/.next" -Recurse -Force

# Rebuild
cd frontend
npm run build

# Test built version
npm run start
```

---

## Getting Help

If you still see "Failed to fetch":

1. **Include in bug report**:
   - Browser console errors (F12)
   - Terminal/server logs
   - Network response status (F12 → Network)
   - Environment variables check
   - npm/node versions

2. **Test cases**:
   - Try different prompts
   - Try with/without thinking mode
   - Try with shorter prompts
   - Try at different times

3. **Check logs file** (if available):
   ```powershell
   # Redirect server output
   npm run dev 2>&1 | Tee-Object server.log
   ```

---

## Summary

| Step | Check | Fix If Fail |
|------|-------|-----------|
| 1 | Backend running | `npm run dev` |
| 2 | Port 3001 free | Kill process, restart |
| 3 | API key set | Update backend/.env |
| 4 | Prompt not empty | Enter valid prompt |
| 5 | Network working | Check firewall/proxy |
| 6 | Browser console | Look for specific errors |

**Most Common Fix**: Simply restart the dev server with `npm run dev`

**If restarting doesn't work**: Clear lock files, restart terminal, and try again.
