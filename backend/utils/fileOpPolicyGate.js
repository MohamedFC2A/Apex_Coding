'use strict';

const SENSITIVE_ROOT_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.base.json',
  'vite.config.js',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs'
]);

const CSS_DUP_BASENAMES = new Set(['style.css', 'styles.css', 'main.css', 'app.css']);
const JS_DUP_BASENAMES = new Set(['script.js', 'main.js', 'app.js']);
const FORBIDDEN_STATIC_CSS_BASENAMES = new Set(['styles.css', 'main.css', 'global.css', 'app.css', 'index.css']);
const FORBIDDEN_STATIC_JS_BASENAMES = new Set(['app.js', 'main.js', 'index.js']);
const SCRIPT_FILE_RE = /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i;
const STYLE_FILE_RE = /\.(?:css|scss|sass|less)$/i;
const HTML_FILE_RE = /\.(?:html?|xhtml)$/i;
const STATIC_ALLOWED_PATCH_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'cjs',
  'json',
  'md',
  'txt',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf'
]);

const normalizePath = (rawPath) =>
  String(rawPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .trim();

const basename = (rawPath) => {
  const normalized = normalizePath(rawPath);
  if (!normalized) return '';
  const parts = normalized.split('/');
  return String(parts[parts.length - 1] || '').toLowerCase();
};

const extname = (rawPath) => {
  const name = basename(rawPath);
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  return name.slice(idx + 1).toLowerCase();
};

const duplicatePurposeKey = (name) => {
  const lower = String(name || '').toLowerCase();
  if (CSS_DUP_BASENAMES.has(lower)) return 'css:primary';
  if (JS_DUP_BASENAMES.has(lower)) return 'js:primary';
  return `file:${lower}`;
};

const globToRegExp = (pattern) => {
  const escaped = String(pattern || '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};

const hasExplicitSecurityReason = (reason) =>
  /\b(security|vuln|vulnerability|cve|exploit|malware|credential|secret|token|compromise|exposure|leak)\b/i.test(
    String(reason || '')
  );

const buildPolicyViolation = (code, message, path, extra = {}) => ({
  code: String(code || 'POLICY_VIOLATION'),
  message: String(message || 'Policy violation'),
  path: normalizePath(path || ''),
  ...extra
});

const hasScriptSyntaxSignal = (source) => {
  const text = String(source || '');
  if (!text.trim()) return false;
  return /\b(?:const|let|var|function|class|import|export|return|if|for|while|switch|try|catch|async|await|new)\b|=>|document\.|window\.|addEventListener\(/m.test(
    text
  );
};

const hasCssSelectorSignal = (source) => {
  const text = String(source || '');
  if (!text.trim()) return false;
  return /(?:^|\n)\s*(?:@media[^{]+\{|[:.#]?[a-zA-Z][\w-]*(?:\s+[:.#]?[a-zA-Z][\w-]*)*\s*\{)/m.test(text);
};

const hasCssPropertySignal = (source) =>
  /\b(?:color|background(?:-color)?|display|position|margin|padding|font-size|font-family|border(?:-radius)?|width|height|grid|flex|justify-content|align-items)\s*:/i.test(
    String(source || '')
  );

const hasCssSyntaxSignal = (source) => hasCssSelectorSignal(source) && hasCssPropertySignal(source);

const hasHtmlMarkupSignal = (source) =>
  /<(?:!doctype|html|head|body|main|section|article|header|footer|nav|div|span|script|style|meta|link)\b/i.test(
    String(source || '')
  );

const countCssLines = (text) => {
  const lines = String(text || '').split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if (/^[.#@:][a-zA-Z]/.test(trimmed) || /^\w[\w-]*\s*\{/.test(trimmed) || /^\s*[\w-]+\s*:\s*.+;/.test(trimmed)) {
      count += 1;
    }
  }
  return count;
};

const countScriptLines = (text) => {
  const lines = String(text || '').split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if (
      /\b(?:const|let|var|function|class|import|export|return|if|for|while|switch|try|catch|async|await|new)\b/.test(
        trimmed
      ) ||
      /=>|document\.|window\.|addEventListener\(/.test(trimmed)
    ) {
      count += 1;
    }
  }
  return count;
};

const hasInlineStyleBlock = (source) => {
  const text = String(source || '');
  const matches = text.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
  if (!matches) return false;
  for (const block of matches) {
    const inner = String(block)
      .replace(/^<style\b[^>]*>/i, '')
      .replace(/<\/style>$/i, '')
      .trim();
    if (inner.length > 0) return true;
  }
  return false;
};

const hasInlineScriptBlock = (source) => {
  const text = String(source || '');
  const matches = text.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi);
  if (!matches) return false;
  for (const block of matches) {
    const inner = String(block)
      .replace(/^<script\b[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();
    if (inner.length > 0) return true;
  }
  return false;
};

const isStaticPatchExtensionAllowed = (path) => {
  const ext = extname(path);
  if (!ext) return true;
  return STATIC_ALLOWED_PATCH_EXTENSIONS.has(ext);
};

const detectLanguageMismatchViolation = (path, content, { isStaticProfile = false } = {}) => {
  const normalizedPath = normalizePath(path);
  const text = String(content || '');
  if (!normalizedPath || !text.trim()) return null;

  const hasScript = hasScriptSyntaxSignal(text);
  const hasCss = hasCssSyntaxSignal(text);
  const hasHtml = hasHtmlMarkupSignal(text);

  if (SCRIPT_FILE_RE.test(normalizedPath)) {
    if (hasCss && !hasScript && !hasHtml) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_JS',
        'JavaScript file appears to contain CSS content; move styles to CSS files',
        normalizedPath
      );
    }
    if (hasCss && hasScript) {
      const cssLines = countCssLines(text);
      const jsLines = countScriptLines(text);
      if (cssLines > 0 && jsLines > 0 && cssLines > jsLines * 1.5) {
        return buildPolicyViolation(
          'LANGUAGE_MISMATCH_JS',
          'JavaScript file is dominated by CSS content; keep JavaScript and CSS separated',
          normalizedPath
        );
      }
    }
    if (hasHtml && !hasScript && !hasCss) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_JS',
        'JavaScript file appears to contain HTML markup; move markup to HTML files',
        normalizedPath
      );
    }
    return null;
  }

  if (STYLE_FILE_RE.test(normalizedPath)) {
    const hasSoftCss = hasCssSelectorSignal(text) || hasCssPropertySignal(text);
    if (hasScript && !hasSoftCss && !hasHtml) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_CSS',
        'CSS file appears to contain JavaScript logic; move logic to JavaScript files',
        normalizedPath
      );
    }
    if (hasScript && hasSoftCss) {
      const cssLines = countCssLines(text);
      const jsLines = countScriptLines(text);
      if (jsLines > 0 && cssLines > 0 && jsLines > cssLines * 1.5) {
        return buildPolicyViolation(
          'LANGUAGE_MISMATCH_CSS',
          'CSS file is dominated by JavaScript content; keep CSS and JavaScript separated',
          normalizedPath
        );
      }
    }
    if (hasHtml && !hasSoftCss && !hasScript) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_CSS',
        'CSS file appears to contain HTML markup; move markup to HTML files',
        normalizedPath
      );
    }
    return null;
  }

  if (HTML_FILE_RE.test(normalizedPath)) {
    if (!hasHtml && hasCss) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_HTML',
        'HTML file appears to contain only CSS content and lacks HTML markup',
        normalizedPath
      );
    }
    if (!hasHtml && hasScript) {
      return buildPolicyViolation(
        'LANGUAGE_MISMATCH_HTML',
        'HTML file appears to contain only JavaScript content and lacks HTML markup',
        normalizedPath
      );
    }
    if (isStaticProfile && (hasInlineStyleBlock(text) || hasInlineScriptBlock(text))) {
      return buildPolicyViolation(
        'STATIC_INLINE_LANGUAGE_MIXED',
        'Static frontend requires CSS/JS in dedicated files; inline <style>/<script> blocks are not allowed',
        normalizedPath
      );
    }
    return null;
  }

  return null;
};

const createFileOpPolicyGate = ({ writePolicy = {}, workspaceAnalysis = null } = {}) => {
  const allowedEditSet = new Set((writePolicy?.allowedEditPaths || []).map((path) => normalizePath(path).toLowerCase()).filter(Boolean));
  const createRules = Array.isArray(writePolicy?.allowedCreateRules)
    ? writePolicy.allowedCreateRules
        .map((rule) => {
          const pattern = String(rule?.pattern || '').trim();
          if (!pattern) return null;
          try {
            return { rule, regex: globToRegExp(pattern) };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];
  const isStaticProfile = createRules.some((entry) => String(entry?.rule?.pattern || '').trim().toLowerCase() === 'index.html');

  const manifestPaths =
    (Array.isArray(writePolicy?.manifestPaths) ? writePolicy.manifestPaths : null) ||
    (Array.isArray(workspaceAnalysis?.manifest) ? workspaceAnalysis.manifest.map((entry) => entry.path) : []) ||
    [];
  const manifestHasAnyHtml = manifestPaths.some((path) => {
    const name = basename(path);
    return name.endsWith('.html') || name.endsWith('.htm');
  });

  const existingByPurpose = new Map();
  const purposeByPath = new Map();
  const registerPath = (rawPath) => {
    const normalized = normalizePath(rawPath);
    if (!normalized) return;
    const lowerPath = normalized.toLowerCase();
    const purpose = duplicatePurposeKey(basename(normalized));
    purposeByPath.set(lowerPath, purpose);
    if (!existingByPurpose.has(purpose)) existingByPurpose.set(purpose, normalized);
  };
  const unregisterPath = (rawPath) => {
    const normalized = normalizePath(rawPath);
    if (!normalized) return;
    const lowerPath = normalized.toLowerCase();
    const knownPurpose = purposeByPath.get(lowerPath);
    if (!knownPurpose) return;
    purposeByPath.delete(lowerPath);
    const current = existingByPurpose.get(knownPurpose);
    if (typeof current === 'string' && current.toLowerCase() === lowerPath) {
      existingByPurpose.delete(knownPurpose);
    }
  };
  for (const path of manifestPaths) {
    const normalized = normalizePath(path);
    if (!normalized) continue;
    registerPath(normalized);
  }

  const touchedPaths = new Set();
  const createdPaths = new Set();
  const activePatchByPath = new Map();
  let seenHtmlInRun = false;
  const requestedTouchMode = String(writePolicy?.touchBudgetMode || 'minimal').toLowerCase();
  const providedMaxTouched = Number(writePolicy?.maxTouchedFiles || 0);
  const inferredAdaptiveBudget = Math.max(
    2,
    Math.min(48, allowedEditSet.size + createRules.length + Math.max(2, Math.ceil(allowedEditSet.size / 6)))
  );
  const maxTouchedFiles =
    Number.isFinite(providedMaxTouched) && providedMaxTouched > 0
      ? Math.max(1, providedMaxTouched)
      : requestedTouchMode === 'adaptive'
        ? inferredAdaptiveBudget
        : 1;
  const strictEditScope = allowedEditSet.size > 0 && String(writePolicy?.interactionMode || '').toLowerCase() === 'edit';

  const isCreateAllowed = (path) => {
    const normalized = normalizePath(path);
    if (!normalized) return false;
    if (createRules.length === 0) return false;
    return createRules.some((entry) => entry.regex.test(normalized));
  };

  const trackTouchedPath = (path) => {
    const normalized = normalizePath(path).toLowerCase();
    if (!normalized) return { ok: true };
    if (touchedPaths.has(normalized)) return { ok: true };
    if (touchedPaths.size + 1 > maxTouchedFiles) {
      return {
        ok: false,
        violation: buildPolicyViolation(
          'TOUCH_BUDGET_EXCEEDED',
          `Touched files exceeded budget (${touchedPaths.size + 1}/${maxTouchedFiles})`,
          normalized
        )
      };
    }
    touchedPaths.add(normalized);
    return { ok: true };
  };

  const checkPatchStart = (event) => {
    const path = normalizePath(event.path);
    const mode = String(event.mode || 'create').toLowerCase() === 'edit' ? 'edit' : 'create';
    if (!path) {
      return {
        allowed: false,
        violation: buildPolicyViolation('INVALID_PATH', 'Patch operation without path', event.path)
      };
    }

    const touch = trackTouchedPath(path);
    if (!touch.ok) return { allowed: false, violation: touch.violation };

    const name = basename(path);
    if (name.endsWith('.html') || name.endsWith('.htm')) {
      seenHtmlInRun = true;
    }

    if (mode === 'edit') {
      if (strictEditScope && !allowedEditSet.has(path.toLowerCase()) && !createdPaths.has(path.toLowerCase())) {
        return {
          allowed: false,
          violation: buildPolicyViolation(
            'PATCH_OUT_OF_SCOPE',
            'Edit path is outside write policy scope',
            path
          )
        };
      }
      activePatchByPath.set(path.toLowerCase(), { path, mode, content: '' });
      return { allowed: true };
    }

    if (!isCreateAllowed(path)) {
      return {
        allowed: false,
        violation: buildPolicyViolation('CREATE_OUT_OF_SCOPE', 'Create path is outside allowed create rules', path)
      };
    }

    if (isStaticProfile && !isStaticPatchExtensionAllowed(path)) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'STATIC_UNSUPPORTED_FILETYPE',
          `Static frontend forbids creating unsupported file type "${extname(path) || 'unknown'}"`,
          path
        )
      };
    }

    if (isStaticProfile && FORBIDDEN_STATIC_CSS_BASENAMES.has(name)) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'FORBIDDEN_STATIC_FILENAME',
          `Static frontend forbids creating ${name}; use style.css and styles/*.css only`,
          path
        )
      };
    }
    if (isStaticProfile && FORBIDDEN_STATIC_JS_BASENAMES.has(name)) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'FORBIDDEN_STATIC_FILENAME',
          `Static frontend forbids creating ${name}; use script.js and scripts/*.js only`,
          path
        )
      };
    }

    if (
      isStaticProfile &&
      !manifestHasAnyHtml &&
      !seenHtmlInRun &&
      (name.endsWith('.css') || name.endsWith('.js'))
    ) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'STATIC_ORDER_HTML_FIRST',
          'Static frontend requires an HTML file to be emitted before CSS/JS',
          path
        )
      };
    }

    const purpose = duplicatePurposeKey(name);
    const existing = existingByPurpose.get(purpose);
    if (
      existing &&
      existing.toLowerCase() !== path.toLowerCase() &&
      (purpose === 'css:primary' || purpose === 'js:primary')
    ) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'DUPLICATE_PURPOSE_CREATE',
          `Duplicate-purpose create blocked; canonical file already exists at ${existing}`,
          path,
          { existingPath: existing }
        )
      };
    }

    registerPath(path);
    createdPaths.add(path.toLowerCase());
    activePatchByPath.set(path.toLowerCase(), { path, mode, content: '' });
    return { allowed: true };
  };

  const checkPatchChunk = (event) => {
    const path = normalizePath(event.path);
    if (!path) return { allowed: true };
    const key = path.toLowerCase();
    const active = activePatchByPath.get(key);
    if (!active) return { allowed: true };
    const chunk = String(event.chunk || '');
    if (!chunk) return { allowed: true };
    active.content += chunk;
    activePatchByPath.set(key, active);
    return { allowed: true };
  };

  const checkPatchEnd = (event) => {
    const path = normalizePath(event.path);
    if (!path) return { allowed: true };
    const key = path.toLowerCase();
    const active = activePatchByPath.get(key);
    activePatchByPath.delete(key);
    if (!active) return { allowed: true };

    const mode = active.mode === 'edit' ? 'edit' : 'create';
    const content = String(active.content || '');
    if (mode === 'create' && content.trim().length === 0) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'EMPTY_CREATE_CONTENT',
          'Create operation emitted empty file content',
          path
        )
      };
    }

    const mismatchViolation = detectLanguageMismatchViolation(path, content, { isStaticProfile });
    if (mismatchViolation) {
      return {
        allowed: false,
        violation: mismatchViolation
      };
    }
    return { allowed: true };
  };

  const checkDelete = (event) => {
    const path = normalizePath(event.path);
    const name = basename(path);
    const reason = String(event.reason || '').trim();
    if (!path) {
      return {
        allowed: false,
        violation: buildPolicyViolation('INVALID_PATH', 'Delete operation without path', event.path)
      };
    }
    const touch = trackTouchedPath(path);
    if (!touch.ok) return { allowed: false, violation: touch.violation };

    if (strictEditScope && !allowedEditSet.has(path.toLowerCase())) {
      return {
        allowed: false,
        violation: buildPolicyViolation('DELETE_OUT_OF_SCOPE', 'Delete path is outside write policy scope', path)
      };
    }

    if (SENSITIVE_ROOT_BASENAMES.has(name) && !hasExplicitSecurityReason(reason)) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'SENSITIVE_DELETE_BLOCKED',
          'Sensitive file delete blocked without explicit safety reason',
          path
        )
      };
    }

    unregisterPath(path);
    return { allowed: true };
  };

  const checkMove = (event) => {
    const fromPath = normalizePath(event.path);
    const toPath = normalizePath(event.toPath);
    const fromName = basename(fromPath);
    const reason = String(event.reason || '').trim();
    if (!fromPath || !toPath) {
      return {
        allowed: false,
        violation: buildPolicyViolation('INVALID_MOVE', 'Move operation missing source/target path', fromPath || toPath)
      };
    }

    const fromTouch = trackTouchedPath(fromPath);
    if (!fromTouch.ok) return { allowed: false, violation: fromTouch.violation };
    const toTouch = trackTouchedPath(toPath);
    if (!toTouch.ok) return { allowed: false, violation: toTouch.violation };

    if (strictEditScope && !allowedEditSet.has(fromPath.toLowerCase())) {
      return {
        allowed: false,
        violation: buildPolicyViolation('MOVE_OUT_OF_SCOPE', 'Move source path is outside write policy scope', fromPath)
      };
    }
    if (strictEditScope && !allowedEditSet.has(toPath.toLowerCase()) && !isCreateAllowed(toPath)) {
      return {
        allowed: false,
        violation: buildPolicyViolation('MOVE_TARGET_OUT_OF_SCOPE', 'Move target path is outside allowed scope', toPath)
      };
    }

    if (SENSITIVE_ROOT_BASENAMES.has(fromName) && !hasExplicitSecurityReason(reason)) {
      return {
        allowed: false,
        violation: buildPolicyViolation(
          'SENSITIVE_MOVE_BLOCKED',
          'Sensitive file move blocked without explicit safety reason',
          fromPath
        )
      };
    }

    unregisterPath(fromPath);
    registerPath(toPath);
    return { allowed: true };
  };

  return {
    check(event) {
      if (!event || typeof event !== 'object') return { allowed: true };
      const op = String(event.op || '').toLowerCase();
      const phase = String(event.phase || '').toLowerCase();
      if (op === 'patch' && phase === 'start') return checkPatchStart(event);
      if (op === 'patch' && phase === 'chunk') return checkPatchChunk(event);
      if (op === 'patch' && phase === 'end') return checkPatchEnd(event);
      if (op === 'delete' && phase === 'end') return checkDelete(event);
      if (op === 'move' && phase === 'end') return checkMove(event);
      return { allowed: true };
    },
    snapshot() {
      return {
        touchedCount: touchedPaths.size,
        touchedPaths: Array.from(touchedPaths),
        createdPaths: Array.from(createdPaths)
      };
    }
  };
};

const buildPolicyRepairPrompt = ({ originalPrompt, violation, writePolicy, workspaceAnalysis }) => {
  const policyText = JSON.stringify(
    {
      allowedEditPaths: writePolicy?.allowedEditPaths || [],
      allowedCreateRules: writePolicy?.allowedCreateRules || [],
      maxTouchedFiles: writePolicy?.maxTouchedFiles || 1,
      touchBudgetMode: writePolicy?.touchBudgetMode || 'minimal',
      analysisConfidence: writePolicy?.analysisConfidence ?? workspaceAnalysis?.confidence ?? null
    },
    null,
    2
  );

  return [
    '[POLICY_REPAIR_ATTEMPT]',
    'Your last patch stream violated strict write policy.',
    'Output ONLY valid file-op protocol markers and full file contents.',
    'Do not output explanations.',
    'Keep HTML/CSS/JavaScript separated by file type.',
    'For static frontend mode, keep CSS in .css files and JS in .js files (no inline <style>/<script>).',
    '',
    '[VIOLATION]',
    `code=${violation?.code || 'UNKNOWN'}`,
    `message=${violation?.message || 'Policy violation'}`,
    violation?.path ? `path=${violation.path}` : '',
    '',
    '[WRITE_POLICY]',
    policyText,
    '',
    '[ORIGINAL_REQUEST]',
    String(originalPrompt || '')
  ]
    .filter(Boolean)
    .join('\n');
};

module.exports = {
  createFileOpPolicyGate,
  buildPolicyRepairPrompt
};
