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

  const manifestPaths =
    (Array.isArray(writePolicy?.manifestPaths) ? writePolicy.manifestPaths : null) ||
    (Array.isArray(workspaceAnalysis?.manifest) ? workspaceAnalysis.manifest.map((entry) => entry.path) : []) ||
    [];

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
      return { allowed: true };
    }

    if (!isCreateAllowed(path)) {
      return {
        allowed: false,
        violation: buildPolicyViolation('CREATE_OUT_OF_SCOPE', 'Create path is outside allowed create rules', path)
      };
    }

    const name = basename(path);
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
