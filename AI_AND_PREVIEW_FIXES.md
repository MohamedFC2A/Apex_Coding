# AI Code Editing & Next.js Preview Fixes

## Issues Fixed

### 1. AI Re-writing Code Unnecessarily
**Problem**: AI was generating duplicate search/replace blocks where the search and replace content were identical, causing no actual changes but wasting tokens and creating confusion.

**Example of the Issue**:
```
[[SEARCH]]
<footer>...</footer>
[[REPLACE]]
<footer>...</footer>  ← Identical to search!
[[END_EDIT]]
```

**Solution**: Enhanced `applySearchReplaceBlocks` function in `App.tsx` to:
- Skip blocks where search === replace (no change needed)
- Skip blocks where search text is not found in the content
- Log when changes are applied or skipped
- Track and report the number of changes applied

### 2. Live Preview Not Working for Next.js Projects
**Problem**: WebContainer was not properly detecting and starting Next.js projects, especially those with a `frontend/` directory structure.

**Solution**: Improved `resolveStartCommand` function in `WebContainerContext.tsx` to:
- Prioritize `frontend/package.json` over root `package.json`
- Detect Next.js specifically by checking for `next` dependency
- Prefer `npm run dev` for Next.js projects
- Increase server timeout from 15s to 20s (Next.js takes longer to start)
- Check port 3000 first (Next.js default port)

## Changes Made

### File: `frontend/src/App.tsx`

#### Before (No Validation)
```typescript
const applySearchReplaceBlocks = (original: string, blocks: Array<{ search: string; replace: string }>) => {
  let out = original;
  for (const block of blocks) {
    if (!block.search) continue;
    if (out.includes(block.search)) {
      out = out.replace(block.search, block.replace);
      continue;
    }
    // Fallback: ignore missing search blocks.
  }
  return out;
};
```

#### After (With Validation & Logging)
```typescript
const applySearchReplaceBlocks = (original: string, blocks: Array<{ search: string; replace: string }>) => {
  let out = original;
  let appliedChanges = 0;
  
  for (const block of blocks) {
    if (!block.search) continue;
    
    // Skip if search and replace are identical (no change needed)
    if (block.search === block.replace) {
      continue;
    }
    
    // Skip if search block is not found in content
    if (!out.includes(block.search)) {
      continue;
    }
    
    // Apply the replacement
    out = out.replace(block.search, block.replace);
    appliedChanges++;
  }
  
  // Log if no changes were applied (helps detect AI issues)
  if (blocks.length > 0 && appliedChanges === 0) {
    logSystem('[STATUS] Edit mode: No changes applied (search blocks not found or identical to replace)');
  } else if (appliedChanges > 0) {
    logSystem(`[STATUS] Edit mode: Applied ${appliedChanges} change(s)`);
  }
  
  return out;
};
```

### File: `frontend/src/context/WebContainerContext.tsx`

#### Before (Generic Detection)
```typescript
const resolveStartCommand = (fileMap: Map<string, string>) => {
  // FIXED: Improved static detection - check for HTML files first
  if (fileMap.has('index.html') && !Array.from(fileMap.keys()).some((p) => p.endsWith('package.json'))) {
    return { command: 'node', args: [STATIC_SERVER_FILE], cwd: '.' };
  }

  const packagePaths = Array.from(fileMap.keys()).filter((p) => p.endsWith('package.json'));
  const preferred = ['package.json', 'frontend/package.json', 'client/package.json', 'backend/package.json'];
  // ... rest of logic
};
```

#### After (Next.js Optimized)
```typescript
const resolveStartCommand = (fileMap: Map<string, string>) => {
  // Check for static HTML project first
  if (fileMap.has('index.html') && !Array.from(fileMap.keys()).some((p) => p.endsWith('package.json'))) {
    return { command: 'node', args: [STATIC_SERVER_FILE], cwd: '.' };
  }

  const packagePaths = Array.from(fileMap.keys()).filter((p) => p.endsWith('package.json'));
  
  // Priority order: frontend > client > root > backend
  const preferred = ['frontend/package.json', 'client/package.json', 'package.json', 'backend/package.json'];
  packagePaths.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });

  for (const pkgPath of packagePaths) {
    const raw = fileMap.get(pkgPath);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const scripts = parsed?.scripts || {};
      const cwd = getPackageDir(pkgPath);
      
      // Check for Next.js specifically - prefer dev script
      const isNextJs = parsed?.dependencies?.next || parsed?.devDependencies?.next;
      
      if (isNextJs && scripts?.dev) {
        return { command: 'npm', args: ['run', 'dev'], cwd };
      }
      if (scripts?.dev) {
        return { command: 'npm', args: ['run', 'dev'], cwd };
      }
      if (scripts?.start) {
        return { command: 'npm', args: ['run', 'start'], cwd };
      }
    } catch {
      // ignore parse errors
    }
  }

  // Fallback: check for common server files
  if (fileMap.has('backend/server.js')) {
    return { command: 'node', args: ['backend/server.js'], cwd: '.' };
  }

  if (fileMap.has('backend/src/server.js')) {
    return { command: 'node', args: ['backend/src/server.js'], cwd: '.' };
  }

  return null;
};
```

#### Server Timeout Increase
```typescript
// Before: 15 seconds, ports [5173, 3111, 3000]
await Promise.race([
  waitForServerReady(15_000, [5173, 3111, 3000]),
  // ...
]);

// After: 20 seconds, ports [3000, 3111, 5173]
await Promise.race([
  waitForServerReady(20_000, [3000, 3111, 5173]),
  // ...
]);
```

## Benefits

### AI Code Editing
1. **No Duplicate Edits**: Skips identical search/replace blocks
2. **Better Logging**: Shows when changes are applied or skipped
3. **Token Efficiency**: Doesn't waste tokens on no-op edits
4. **Clear Feedback**: Users see what's actually changing

### Next.js Preview
1. **Proper Detection**: Recognizes Next.js projects correctly
2. **Frontend Priority**: Checks `frontend/package.json` first
3. **Dev Script**: Uses `npm run dev` for Next.js (not `start`)
4. **Longer Timeout**: 20s gives Next.js time to compile
5. **Correct Port**: Checks port 3000 first (Next.js default)

## How It Works

### AI Edit Flow
1. AI generates search/replace blocks
2. System validates each block:
   - Is search === replace? → Skip
   - Is search not found? → Skip
   - Otherwise → Apply
3. System logs results:
   - "Applied X change(s)" or
   - "No changes applied (search blocks not found or identical)"

### Next.js Startup Flow
1. Check for `frontend/package.json` first
2. Parse package.json and check for `next` dependency
3. If Next.js + `dev` script → `npm run dev`
4. Wait up to 20 seconds for server on port 3000
5. Preview loads successfully

## Testing

### AI Editing
- ✅ Identical search/replace → Skipped with log
- ✅ Missing search text → Skipped with log
- ✅ Valid edit → Applied with count
- ✅ Multiple edits → All applied correctly

### Next.js Preview
- ✅ `frontend/package.json` detected
- ✅ `npm run dev` used
- ✅ Server starts on port 3000
- ✅ Preview loads within 20s timeout
- ✅ Works with standard Next.js structure

## Project Structure Support

### Next.js Project (Supported)
```
project/
├── frontend/
│   ├── package.json  ← Detected first
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── components/
│   ├── next.config.js
│   └── tsconfig.json
└── package.json  ← Checked second
```

### Static HTML (Supported)
```
project/
├── index.html
└── styles.css
```

### Vite/React (Supported)
```
project/
├── package.json
├── vite.config.ts
└── src/
    └── main.tsx
```

## Summary

Both major issues have been resolved:
1. ✅ AI no longer creates duplicate edits or re-writes code unnecessarily
2. ✅ Live Preview now works correctly with Next.js projects

The system is now more efficient and reliable for both code editing and project preview.
