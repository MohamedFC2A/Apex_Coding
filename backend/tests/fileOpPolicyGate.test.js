'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFileOpPolicyGate } = require('../utils/fileOpPolicyGate');

test('blocks patch edit outside allowed scope', () => {
  const gate = createFileOpPolicyGate({
    writePolicy: {
      interactionMode: 'edit',
      allowedEditPaths: ['frontend/src/style.css'],
      allowedCreateRules: [],
      maxTouchedFiles: 1,
      manifestPaths: ['frontend/src/style.css']
    }
  });

  const result = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'edit',
    path: 'frontend/src/App.tsx'
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violation.code, 'PATCH_OUT_OF_SCOPE');
});

test('blocks sensitive delete without explicit safety reason', () => {
  const gate = createFileOpPolicyGate({
    writePolicy: {
      allowedEditPaths: ['package.json'],
      allowedCreateRules: [],
      maxTouchedFiles: 2,
      manifestPaths: ['package.json']
    }
  });

  const result = gate.check({
    op: 'delete',
    phase: 'end',
    path: 'package.json',
    reason: 'cleanup'
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violation.code, 'SENSITIVE_DELETE_BLOCKED');
});

test('blocks duplicate-purpose create when canonical css exists', () => {
  const gate = createFileOpPolicyGate({
    writePolicy: {
      allowedEditPaths: [],
      allowedCreateRules: [{ pattern: 'frontend/**' }],
      maxTouchedFiles: 3,
      manifestPaths: ['frontend/src/style.css']
    }
  });

  const result = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'create',
    path: 'frontend/src/main.css'
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violation.code, 'DUPLICATE_PURPOSE_CREATE');
});

test('enforces minimal touch budget', () => {
  const gate = createFileOpPolicyGate({
    writePolicy: {
      interactionMode: 'edit',
      allowedEditPaths: ['frontend/src/style.css', 'frontend/src/App.tsx'],
      allowedCreateRules: [],
      maxTouchedFiles: 1,
      manifestPaths: ['frontend/src/style.css', 'frontend/src/App.tsx']
    }
  });

  const first = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'edit',
    path: 'frontend/src/style.css'
  });
  const second = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'edit',
    path: 'frontend/src/App.tsx'
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.violation.code, 'TOUCH_BUDGET_EXCEEDED');
});

test('allows explicit create rule in edit mode then edit on created file', () => {
  const gate = createFileOpPolicyGate({
    writePolicy: {
      interactionMode: 'edit',
      allowedEditPaths: ['frontend/src/style.css'],
      allowedCreateRules: [{ pattern: 'frontend/src/new-widget.css' }],
      maxTouchedFiles: 2,
      manifestPaths: ['frontend/src/style.css']
    }
  });

  const createResult = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'create',
    path: 'frontend/src/new-widget.css'
  });
  const editCreatedResult = gate.check({
    op: 'patch',
    phase: 'start',
    mode: 'edit',
    path: 'frontend/src/new-widget.css'
  });

  assert.equal(createResult.allowed, true);
  assert.equal(editCreatedResult.allowed, true);
});
