'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFileOpParser } = require('../utils/fileOpParser');

test('parses patch markers split across chunks', () => {
  const events = [];
  const parser = createFileOpParser((event) => events.push(event));

  parser.push('[[PATCH_FILE: src/App.tsx | mode: edit | reason: refactor]]\n');
  parser.push('const a = 1;\n');
  parser.push('const b = 2;\n[[END_FILE]]');
  parser.finalize();

  assert.equal(events.length, 3);
  assert.deepEqual(events[0], {
    op: 'patch',
    phase: 'start',
    path: 'src/App.tsx',
    mode: 'edit',
    reason: 'refactor'
  });
  assert.equal(events[1].op, 'patch');
  assert.equal(events[1].phase, 'chunk');
  assert.equal(events[1].path, 'src/App.tsx');
  assert.equal(events[2].phase, 'end');
});

test('supports legacy START_FILE markers for limited compatibility', () => {
  const events = [];
  const parser = createFileOpParser((event) => events.push(event));

  parser.push('[[START_FILE: index.html]]<html></html>[[END_FILE]]');
  parser.finalize();

  assert.equal(events[0].op, 'patch');
  assert.equal(events[0].phase, 'start');
  assert.equal(events[0].mode, 'create');
  assert.equal(events[0].path, 'index.html');
  assert.equal(events[events.length - 1].phase, 'end');
});

test('parses delete and move operations', () => {
  const events = [];
  const parser = createFileOpParser((event) => events.push(event));

  parser.push('[[DELETE_FILE: old.js | reason: unused file]]');
  parser.push('[[MOVE_FILE: src/old.ts -> src/new.ts | reason: rename]]');
  parser.finalize();

  assert.deepEqual(events[0], {
    op: 'delete',
    phase: 'end',
    path: 'old.js',
    reason: 'unused file'
  });
  assert.deepEqual(events[1], {
    op: 'move',
    phase: 'end',
    path: 'src/old.ts',
    toPath: 'src/new.ts',
    reason: 'rename'
  });
});
