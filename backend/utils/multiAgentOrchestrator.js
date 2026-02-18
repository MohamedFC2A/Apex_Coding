'use strict';

const { createFileOpParser } = require('./fileOpParser');

const DEFAULT_FAST_MODEL = 'deepseek-chat';
const DEFAULT_THINKING_MODEL = 'deepseek-reasoner';
const DEFAULT_TIMEOUT_MS = 120_000;

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

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
};

const normalizePath = (rawPath) => String(rawPath || '').replace(/\\/g, '/').trim();
const basename = (rawPath) => {
  const path = normalizePath(rawPath);
  if (!path) return '';
  const parts = path.split('/');
  return String(parts[parts.length - 1] || '').toLowerCase();
};

const extname = (rawPath) => {
  const name = basename(rawPath);
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  return name.slice(idx + 1).toLowerCase();
};

const withTimeout = async (promise, timeoutMs, timeoutCode) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(timeoutCode || 'MULTI_AGENT_TIMEOUT');
          err.code = timeoutCode || 'MULTI_AGENT_TIMEOUT';
          reject(err);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const parseJsonLoose = (text) => {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty AI response');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/);
    if (fenced && fenced[1]) return JSON.parse(fenced[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw error;
  }
};

const normalizePlanPayload = (parsed) => {
  const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw
        .map((step, index) => {
          if (typeof step === 'string') {
            const title = step.trim();
            return title
              ? {
                  id: String(index + 1),
                  title,
                  category: 'frontend',
                  files: [],
                  description: ''
                }
              : null;
          }

          const title = String(step?.title ?? step?.text ?? step?.step ?? '').trim();
          if (!title) return null;

          return {
            id: String(step?.id ?? index + 1),
            title,
            category: String(step?.category ?? 'frontend').trim().toLowerCase(),
            files: Array.isArray(step?.files)
              ? step.files.map((item) => normalizePath(item)).filter(Boolean)
              : [],
            description: String(step?.description ?? '').trim()
          };
        })
        .filter(Boolean)
    : [];

  const fileTree = Array.isArray(parsed?.fileTree)
    ? parsed.fileTree.map((item) => normalizePath(item)).filter(Boolean)
    : [];

  return {
    title: typeof parsed?.title === 'string' ? parsed.title : 'Architecture Plan',
    description: typeof parsed?.description === 'string' ? parsed.description : '',
    stack: typeof parsed?.stack === 'string' ? parsed.stack : '',
    fileTree,
    steps
  };
};

const getRoleEnvModel = (role, thinkingMode) => {
  const upperRole = String(role || '').trim().toUpperCase();
  if (!upperRole) return '';
  const suffix = thinkingMode ? 'THINKING' : 'FAST';
  const key = `DEEPSEEK_MODEL_${upperRole}_${suffix}`;
  return String(process.env[key] || '').trim();
};

const defaultRoleModel = (thinkingMode) => (thinkingMode ? DEFAULT_THINKING_MODEL : DEFAULT_FAST_MODEL);

const resolveRoleModels = ({ thinkingMode, modelRouting = {} }) => {
  const fromRouting = modelRouting?.multiAgent?.models || {};
  const plannerFallback = String(modelRouting?.plannerModel || '').trim();
  const executorFallback = String(modelRouting?.executorModel || '').trim();

  const getModel = (role, fallback) => {
    const routeModel = String(fromRouting?.[role] || '').trim();
    const envModel = getRoleEnvModel(role, thinkingMode);
    return routeModel || envModel || fallback || defaultRoleModel(thinkingMode);
  };

  return {
    planner: getModel('planner', plannerFallback || defaultRoleModel(thinkingMode)),
    html: getModel('html', executorFallback || defaultRoleModel(thinkingMode)),
    css: getModel('css', executorFallback || defaultRoleModel(thinkingMode)),
    javascript: getModel('js', executorFallback || defaultRoleModel(thinkingMode)),
    resolver: getModel('resolver', plannerFallback || executorFallback || defaultRoleModel(thinkingMode))
  };
};

const createGateError = (issues, fallbackMessage) => {
  const list = Array.isArray(issues) ? issues.filter(Boolean) : [];
  const message = list.length > 0 ? list.join(' | ') : fallbackMessage || 'Strict gate failed';
  const err = new Error(message);
  err.code = 'MULTI_AGENT_GATE_FAILED';
  err.statusCode = 422;
  err.issues = list;
  return err;
};

const runChatCompletion = async ({
  createChatCompletion,
  model,
  systemPrompt,
  userPrompt,
  expectJson = false,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) => {
  const payload = {
    model,
    temperature: 0.0,
    messages: [
      { role: 'system', content: String(systemPrompt || '') },
      { role: 'user', content: String(userPrompt || '') }
    ]
  };

  const invoke = (withJsonFormat) =>
    withTimeout(
      createChatCompletion(withJsonFormat ? { ...payload, response_format: { type: 'json_object' } } : payload),
      timeoutMs,
      'MULTI_AGENT_TIMEOUT'
    );

  let response;
  if (expectJson) {
    try {
      response = await invoke(true);
    } catch {
      response = await invoke(false);
    }
  } else {
    response = await invoke(false);
  }

  const content = String(response?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('Empty model response');
  }

  if (expectJson) {
    return { content, parsed: parseJsonLoose(content) };
  }
  return { content };
};

const validatePlanStrict = (planLike) => {
  const normalized = normalizePlanPayload(planLike);
  const issues = [];
  const allowedCategories = new Set([
    'setup',
    'layout',
    'components',
    'interactivity',
    'styling',
    'polish',
    'config',
    'frontend',
    'backend',
    'integration',
    'testing',
    'deployment'
  ]);

  if (!normalized.title || normalized.title.trim().length === 0) {
    issues.push('Plan title is missing');
  }

  if (normalized.steps.length < 4 || normalized.steps.length > 8) {
    issues.push(`Plan must include 4-8 steps, received ${normalized.steps.length}`);
  }

  const fileTreeSet = new Set();
  for (const file of normalized.fileTree) {
    const key = file.toLowerCase();
    if (fileTreeSet.has(key)) {
      issues.push(`Duplicate fileTree entry: ${file}`);
    }
    fileTreeSet.add(key);
  }

  let hasHtml = false;
  let hasCss = false;
  let hasJs = false;

  const registerExt = (path) => {
    const ext = extname(path);
    if (ext === 'html') hasHtml = true;
    if (ext === 'css') hasCss = true;
    if (ext === 'js') hasJs = true;
  };

  normalized.fileTree.forEach(registerExt);

  normalized.steps.forEach((step, index) => {
    if (!step.title || step.title.trim().length === 0) {
      issues.push(`Step ${index + 1}: title is required`);
    }
    if (!step.description || step.description.trim().length === 0) {
      issues.push(`Step ${index + 1}: description is required`);
    }
    if (!allowedCategories.has(String(step.category || '').toLowerCase())) {
      issues.push(`Step ${index + 1}: invalid category "${step.category}"`);
    }

    const expectedId = String(index + 1);
    if (String(step.id) !== expectedId) {
      issues.push(`Step order mismatch at index ${index + 1}: expected id "${expectedId}"`);
    }

    if (step.files.length > 0 && normalized.fileTree.length > 0) {
      for (const file of step.files) {
        registerExt(file);
        const key = file.toLowerCase();
        if (!fileTreeSet.has(key)) {
          issues.push(`Step ${step.id} references file not present in fileTree: ${file}`);
        }
      }
    } else {
      step.files.forEach(registerExt);
    }
  });

  if (!hasHtml) issues.push('Plan must include HTML responsibility');
  if (!hasCss) issues.push('Plan must include CSS responsibility');
  if (!hasJs) issues.push('Plan must include JavaScript responsibility');

  return {
    ok: issues.length === 0,
    issues,
    normalized
  };
};

const validatePatchStrict = (patchText) => {
  const text = String(patchText || '');
  const issues = [];
  const events = [];
  const chunkByPath = new Map();

  const starts = (text.match(/\[\[(PATCH_FILE|START_FILE|EDIT_FILE|EDIT_NODE):/g) || []).length;
  const ends = (text.match(/\[\[END_FILE\]\]/g) || []).length;
  if (starts === 0) issues.push('No patch file markers were found');
  if (starts !== ends) {
    issues.push(`File marker mismatch: starts=${starts}, ends=${ends}`);
  }

  const parser = createFileOpParser((event) => {
    events.push(event);
    if (event?.op === 'patch' && event?.phase === 'chunk') {
      const key = normalizePath(event.path);
      const prev = chunkByPath.get(key) || '';
      chunkByPath.set(key, `${prev}${String(event.chunk || '')}`);
    }
  });
  parser.push(text);
  parser.finalize();

  const cssCandidates = new Set();
  const jsCandidates = new Set();

  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const path = normalizePath(event.path || '');
    const name = basename(path);
    if (event.op === 'delete' || event.op === 'move') {
      if (SENSITIVE_ROOT_BASENAMES.has(name)) {
        issues.push(`Unsafe ${event.op} operation for sensitive file: ${path}`);
      }
      continue;
    }
    if (event.op !== 'patch' || event.phase !== 'start') continue;
    if (!path) {
      issues.push('Patch start without a valid path');
      continue;
    }
    if (CSS_DUP_BASENAMES.has(name)) cssCandidates.add(path.toLowerCase());
    if (JS_DUP_BASENAMES.has(name)) jsCandidates.add(path.toLowerCase());
  }

  if (cssCandidates.size > 1) {
    issues.push(`Duplicate-purpose CSS files in one output: ${Array.from(cssCandidates).join(', ')}`);
  }
  if (jsCandidates.size > 1) {
    issues.push(`Duplicate-purpose JavaScript files in one output: ${Array.from(jsCandidates).join(', ')}`);
  }

  for (const [path, content] of chunkByPath.entries()) {
    const name = basename(path);
    if (['index.html', 'style.css', 'script.js'].includes(name)) {
      if (String(content || '').trim().length === 0) {
        issues.push(`Critical file emitted with empty content: ${path}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      events: events.length,
      starts,
      ends
    }
  };
};

const isResumePrompt = (prompt) => /(?:^|\n)\s*CONTINUE\s+.+\s+FROM\s+LINE\s+\d+/i.test(String(prompt || ''));

const isMultiAgentArchitectEnabled = ({ architectMode, modelRouting = {} }) => {
  const envEnabled = toBool(process.env.MULTI_AGENT_ARCHITECT_ENABLED, true);
  const requested = modelRouting?.multiAgent || {};
  const requestedEnabled = requested?.enabled !== false;
  const activation = String(requested?.activation || 'architect_only').trim().toLowerCase();
  if (!envEnabled || !requestedEnabled) return false;
  if (activation === 'architect_only') return Boolean(architectMode);
  return Boolean(architectMode);
};

const buildPlanSpecialistPrompt = (role, userPrompt, plannerCandidate) => {
  return [
    `[SPECIALIST:${role.toUpperCase()}]`,
    'Return ONLY JSON matching shape:',
    '{"title":"...","description":"...","stack":"...","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}',
    '',
    '[BASE PLAN CANDIDATE]',
    plannerCandidate,
    '',
    '[USER REQUEST]',
    userPrompt,
    '',
    `Focus strictly on ${role.toUpperCase()} responsibilities while preserving end-to-end consistency.`
  ].join('\n');
};

const buildResolverPlanPrompt = ({ userPrompt, plannerCandidate, htmlCandidate, cssCandidate, jsCandidate }) => {
  return [
    '[RESOLVE_PLAN]',
    'Merge the following plan candidates into one final JSON plan.',
    'Must keep strict consistency between fileTree and step files.',
    'Must include HTML + CSS + JavaScript responsibilities.',
    'Return ONLY JSON with the required shape.',
    '',
    '[USER REQUEST]',
    userPrompt,
    '',
    '[PLANNER CANDIDATE]',
    plannerCandidate,
    '',
    '[HTML CANDIDATE]',
    htmlCandidate,
    '',
    '[CSS CANDIDATE]',
    cssCandidate,
    '',
    '[JAVASCRIPT CANDIDATE]',
    jsCandidate
  ].join('\n');
};

const buildResolverPlanRepairPrompt = ({ candidate, issues }) => {
  return [
    '[REPAIR_PLAN]',
    'Repair the plan to satisfy strict validation.',
    'Return ONLY JSON.',
    '',
    '[VALIDATION_ISSUES]',
    issues.map((item) => `- ${item}`).join('\n'),
    '',
    '[CANDIDATE]',
    candidate
  ].join('\n');
};

const buildGenerateSpecialistPrompt = (role, userPrompt) => {
  return [
    `[SPECIALIST:${role.toUpperCase()}]`,
    'Output ONLY file-op protocol markers and file content.',
    'No explanations, no markdown, no JSON wrappers.',
    'Keep cross-file references valid.',
    '',
    '[USER REQUEST]',
    userPrompt
  ].join('\n');
};

const buildResolverGeneratePrompt = ({ userPrompt, html, css, javascript }) => {
  return [
    '[RESOLVE_PATCH]',
    'Merge specialist outputs into one canonical patch stream.',
    'Respect file-op protocol strictly.',
    'Avoid duplicate-purpose stylesheet/script files.',
    '',
    '[USER REQUEST]',
    userPrompt,
    '',
    '[HTML OUTPUT]',
    html,
    '',
    '[CSS OUTPUT]',
    css,
    '',
    '[JAVASCRIPT OUTPUT]',
    javascript
  ].join('\n');
};

const buildResolverGenerateRepairPrompt = ({ merged, issues }) => {
  return [
    '[REPAIR_PATCH]',
    'Repair this patch stream to satisfy strict validator.',
    'Output ONLY fixed patch stream with protocol markers.',
    '',
    '[VALIDATION_ISSUES]',
    issues.map((item) => `- ${item}`).join('\n'),
    '',
    '[PATCH_STREAM]',
    merged
  ].join('\n');
};

const resolveConflictsWithLeadPlanner = async ({
  createChatCompletion,
  resolverModel,
  systemPrompt,
  userPrompt,
  timeoutMs
}) => {
  const result = await runChatCompletion({
    createChatCompletion,
    model: resolverModel,
    systemPrompt,
    userPrompt,
    expectJson: false,
    timeoutMs
  });
  return result.content;
};

const runPlanMultiAgent = async ({
  prompt,
  thinkingMode = false,
  modelRouting = {},
  plannerSystemPrompt,
  createChatCompletion,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onStatus
}) => {
  const roleModels = resolveRoleModels({ thinkingMode, modelRouting });
  const emit = typeof onStatus === 'function' ? onStatus : () => {};

  emit('planning', 'Planner');
  const planner = await runChatCompletion({
    createChatCompletion,
    model: roleModels.planner,
    systemPrompt: plannerSystemPrompt,
    userPrompt: prompt,
    expectJson: true,
    timeoutMs
  });

  emit('planning', 'HTML');
  emit('planning', 'CSS');
  emit('planning', 'JavaScript');
  const [html, css, javascript] = await Promise.all([
    runChatCompletion({
      createChatCompletion,
      model: roleModels.html,
      systemPrompt: plannerSystemPrompt,
      userPrompt: buildPlanSpecialistPrompt('html', prompt, planner.content),
      expectJson: true,
      timeoutMs
    }),
    runChatCompletion({
      createChatCompletion,
      model: roleModels.css,
      systemPrompt: plannerSystemPrompt,
      userPrompt: buildPlanSpecialistPrompt('css', prompt, planner.content),
      expectJson: true,
      timeoutMs
    }),
    runChatCompletion({
      createChatCompletion,
      model: roleModels.javascript,
      systemPrompt: plannerSystemPrompt,
      userPrompt: buildPlanSpecialistPrompt('javascript', prompt, planner.content),
      expectJson: true,
      timeoutMs
    })
  ]);

  emit('planning', 'Resolver');
  const resolver = await runChatCompletion({
    createChatCompletion,
    model: roleModels.resolver,
    systemPrompt: plannerSystemPrompt,
    userPrompt: buildResolverPlanPrompt({
      userPrompt: prompt,
      plannerCandidate: planner.content,
      htmlCandidate: html.content,
      cssCandidate: css.content,
      jsCandidate: javascript.content
    }),
    expectJson: true,
    timeoutMs
  });

  emit('validating', 'Strict gate');
  let validation = validatePlanStrict(resolver.parsed);
  let finalParsed = resolver.parsed;

  if (!validation.ok) {
    const repaired = await runChatCompletion({
      createChatCompletion,
      model: roleModels.resolver,
      systemPrompt: plannerSystemPrompt,
      userPrompt: buildResolverPlanRepairPrompt({
        candidate: resolver.content,
        issues: validation.issues
      }),
      expectJson: true,
      timeoutMs
    });
    finalParsed = repaired.parsed;
    validation = validatePlanStrict(finalParsed);
  }

  if (!validation.ok) {
    throw createGateError(validation.issues, 'Plan strict gate failed');
  }

  return {
    plan: validation.normalized,
    roleModels,
    validation: { ok: true, issues: [] }
  };
};

const runGenerateMultiAgent = async ({
  prompt,
  thinkingMode = false,
  modelRouting = {},
  codeSystemPrompt,
  createChatCompletion,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onStatus
}) => {
  if (isResumePrompt(prompt)) {
    return { bypass: true, reason: 'resume_prompt' };
  }

  const roleModels = resolveRoleModels({ thinkingMode, modelRouting });
  const emit = typeof onStatus === 'function' ? onStatus : () => {};

  emit('planning', 'HTML');
  emit('planning', 'CSS');
  emit('planning', 'JavaScript');
  const [html, css, javascript] = await Promise.all([
    runChatCompletion({
      createChatCompletion,
      model: roleModels.html,
      systemPrompt: codeSystemPrompt,
      userPrompt: buildGenerateSpecialistPrompt('html', prompt),
      expectJson: false,
      timeoutMs
    }),
    runChatCompletion({
      createChatCompletion,
      model: roleModels.css,
      systemPrompt: codeSystemPrompt,
      userPrompt: buildGenerateSpecialistPrompt('css', prompt),
      expectJson: false,
      timeoutMs
    }),
    runChatCompletion({
      createChatCompletion,
      model: roleModels.javascript,
      systemPrompt: codeSystemPrompt,
      userPrompt: buildGenerateSpecialistPrompt('javascript', prompt),
      expectJson: false,
      timeoutMs
    })
  ]);

  emit('planning', 'Resolver');
  const merged = await resolveConflictsWithLeadPlanner({
    createChatCompletion,
    resolverModel: roleModels.resolver,
    systemPrompt: codeSystemPrompt,
    userPrompt: buildResolverGeneratePrompt({
      userPrompt: prompt,
      html: html.content,
      css: css.content,
      javascript: javascript.content
    }),
    timeoutMs
  });

  emit('validating', 'Strict gate');
  let validation = validatePatchStrict(merged);
  let output = merged;

  if (!validation.ok) {
    const repaired = await resolveConflictsWithLeadPlanner({
      createChatCompletion,
      resolverModel: roleModels.resolver,
      systemPrompt: codeSystemPrompt,
      userPrompt: buildResolverGenerateRepairPrompt({
        merged,
        issues: validation.issues
      }),
      timeoutMs
    });
    output = repaired;
    validation = validatePatchStrict(output);
  }

  if (!validation.ok) {
    throw createGateError(validation.issues, 'Patch strict gate failed');
  }

  return {
    bypass: false,
    text: output,
    roleModels,
    validation
  };
};

module.exports = {
  isMultiAgentArchitectEnabled,
  isResumePrompt,
  runPlanMultiAgent,
  runGenerateMultiAgent,
  validatePlanStrict,
  validatePatchStrict,
  resolveConflictsWithLeadPlanner,
  resolveRoleModels
};
