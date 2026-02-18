'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMultiAgentArchitectEnabled,
  isResumePrompt,
  runPlanMultiAgent,
  runGenerateMultiAgent,
  validatePlanStrict,
  validatePatchStrict
} = require('../utils/multiAgentOrchestrator');

const asResponse = (content) => ({
  choices: [{ message: { content } }]
});

const basePlan = {
  title: 'Landing Build Plan',
  description: 'Build a complete static site with linked pages.',
  stack: 'html-css-javascript',
  fileTree: ['index.html', 'style.css', 'script.js', 'pages/about.html'],
  steps: [
    { id: '1', title: 'Scaffold', category: 'setup', files: ['index.html', 'style.css', 'script.js'], description: 'Create base files.' },
    { id: '2', title: 'Layout', category: 'layout', files: ['index.html', 'style.css'], description: 'Build semantic layout.' },
    { id: '3', title: 'Components', category: 'components', files: ['index.html', 'pages/about.html', 'style.css'], description: 'Build page sections and links.' },
    { id: '4', title: 'Interactivity', category: 'interactivity', files: ['script.js'], description: 'Add navigation and form behavior.' }
  ]
};

test('validatePlanStrict accepts valid plan', () => {
  const result = validatePlanStrict(basePlan);
  assert.equal(result.ok, true);
  assert.equal(result.normalized.steps.length, 4);
});

test('validatePlanStrict rejects invalid plan', () => {
  const invalid = {
    ...basePlan,
    fileTree: ['index.html', 'index.html', 'style.css'],
    steps: [{ id: '2', title: '', category: 'unknown', files: ['missing.js'], description: '' }]
  };
  const result = validatePlanStrict(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.issues.length >= 3);
});

test('validatePatchStrict rejects unsafe and duplicate-purpose operations', () => {
  const patch = [
    '[[PATCH_FILE: style.css | mode: create]]',
    'body{margin:0;}',
    '[[END_FILE]]',
    '[[PATCH_FILE: main.css | mode: create]]',
    'h1{color:red;}',
    '[[END_FILE]]',
    '[[DELETE_FILE: package.json | reason: cleanup]]'
  ].join('\n');

  const result = validatePatchStrict(patch);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes('Unsafe delete')));
  assert.ok(result.issues.some((issue) => issue.includes('Duplicate-purpose CSS')));
});

test('isMultiAgentArchitectEnabled enforces architect-only activation', () => {
  const prev = process.env.MULTI_AGENT_ARCHITECT_ENABLED;
  try {
    process.env.MULTI_AGENT_ARCHITECT_ENABLED = 'true';
    assert.equal(isMultiAgentArchitectEnabled({ architectMode: false, modelRouting: { multiAgent: { enabled: true } } }), false);
    assert.equal(isMultiAgentArchitectEnabled({ architectMode: true, modelRouting: { multiAgent: { enabled: true } } }), true);

    process.env.MULTI_AGENT_ARCHITECT_ENABLED = 'false';
    assert.equal(isMultiAgentArchitectEnabled({ architectMode: true, modelRouting: { multiAgent: { enabled: true } } }), false);
  } finally {
    process.env.MULTI_AGENT_ARCHITECT_ENABLED = prev;
  }
});

test('runPlanMultiAgent merges specialist outputs and passes strict gate', async () => {
  const createChatCompletion = async (payload) => {
    const userPrompt = String(payload?.messages?.[1]?.content || '');
    if (userPrompt.includes('[RESOLVE_PLAN]')) return asResponse(JSON.stringify(basePlan));
    if (userPrompt.includes('[SPECIALIST:HTML]')) return asResponse(JSON.stringify(basePlan));
    if (userPrompt.includes('[SPECIALIST:CSS]')) return asResponse(JSON.stringify(basePlan));
    if (userPrompt.includes('[SPECIALIST:JAVASCRIPT]')) return asResponse(JSON.stringify(basePlan));
    return asResponse(JSON.stringify(basePlan));
  };

  const statusEvents = [];
  const result = await runPlanMultiAgent({
    prompt: 'Build a landing page with contact form',
    thinkingMode: false,
    modelRouting: { plannerModel: 'deepseek-chat', executorModel: 'deepseek-chat' },
    plannerSystemPrompt: 'system prompt',
    createChatCompletion,
    timeoutMs: 10_000,
    onStatus: (phase, message) => statusEvents.push(`${phase}:${message}`)
  });

  assert.equal(result.plan.title, basePlan.title);
  assert.equal(result.plan.steps.length, 4);
  assert.ok(statusEvents.includes('planning:Planner'));
  assert.ok(statusEvents.includes('planning:Resolver'));
  assert.ok(statusEvents.includes('validating:Strict gate'));
});

test('isResumePrompt identifies continuation prompts', () => {
  assert.equal(isResumePrompt('CONTINUE src/app.js FROM LINE 50.\n\nOriginal Request: ...'), true);
  assert.equal(isResumePrompt('Build a new app from scratch'), false);
});

test('runGenerateMultiAgent bypasses multi-agent for resume prompts', async () => {
  const result = await runGenerateMultiAgent({
    prompt: 'CONTINUE src/main.js FROM LINE 10',
    thinkingMode: false,
    modelRouting: {},
    codeSystemPrompt: 'sys',
    createChatCompletion: async () => {
      throw new Error('Should not be called');
    }
  });
  assert.equal(result.bypass, true);
});

test('runGenerateMultiAgent throws strict gate failure when repair still invalid', async () => {
  const invalidMerged = [
    '[[PATCH_FILE: style.css | mode: create]]',
    'body{}',
    '[[END_FILE]]',
    '[[PATCH_FILE: app.css | mode: create]]',
    '.x{}',
    '[[END_FILE]]'
  ].join('\n');

  const createChatCompletion = async (payload) => {
    const userPrompt = String(payload?.messages?.[1]?.content || '');
    if (userPrompt.includes('[SPECIALIST:HTML]')) return asResponse('[[PATCH_FILE: index.html | mode: create]]<html></html>[[END_FILE]]');
    if (userPrompt.includes('[SPECIALIST:CSS]')) return asResponse('[[PATCH_FILE: style.css | mode: create]]body{}[[END_FILE]]');
    if (userPrompt.includes('[SPECIALIST:JAVASCRIPT]')) return asResponse('[[PATCH_FILE: script.js | mode: create]]console.log(1);[[END_FILE]]');
    if (userPrompt.includes('[RESOLVE_PATCH]')) return asResponse(invalidMerged);
    if (userPrompt.includes('[REPAIR_PATCH]')) return asResponse(invalidMerged);
    return asResponse(invalidMerged);
  };

  await assert.rejects(
    runGenerateMultiAgent({
      prompt: 'Build static site',
      thinkingMode: false,
      modelRouting: {},
      codeSystemPrompt: 'sys',
      createChatCompletion
    }),
    (error) => {
      assert.equal(error.code, 'MULTI_AGENT_GATE_FAILED');
      return true;
    }
  );
});

test('runGenerateMultiAgent returns merged patch on success', async () => {
  const merged = [
    '[[PATCH_FILE: index.html | mode: create]]',
    '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><script src="script.js"></script></body></html>',
    '[[END_FILE]]',
    '[[PATCH_FILE: style.css | mode: create]]',
    'body{margin:0;}',
    '[[END_FILE]]',
    '[[PATCH_FILE: script.js | mode: create]]',
    'console.log("ok");',
    '[[END_FILE]]'
  ].join('\n');

  const createChatCompletion = async (payload) => {
    const userPrompt = String(payload?.messages?.[1]?.content || '');
    if (userPrompt.includes('[SPECIALIST:HTML]')) return asResponse('[[PATCH_FILE: index.html | mode: create]]<html></html>[[END_FILE]]');
    if (userPrompt.includes('[SPECIALIST:CSS]')) return asResponse('[[PATCH_FILE: style.css | mode: create]]body{}[[END_FILE]]');
    if (userPrompt.includes('[SPECIALIST:JAVASCRIPT]')) return asResponse('[[PATCH_FILE: script.js | mode: create]]console.log(1);[[END_FILE]]');
    if (userPrompt.includes('[RESOLVE_PATCH]')) return asResponse(merged);
    return asResponse(merged);
  };

  const result = await runGenerateMultiAgent({
    prompt: 'Build a complete static landing page',
    thinkingMode: true,
    modelRouting: {},
    codeSystemPrompt: 'sys',
    createChatCompletion
  });

  assert.equal(result.bypass, false);
  assert.equal(result.validation.ok, true);
  assert.ok(result.text.includes('[[PATCH_FILE: index.html'));
});
