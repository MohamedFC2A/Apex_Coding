#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const repoUrl = 'https://github.com/MohamedFC2A/nexus-apex-coding.git';

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

const cwd = process.cwd();
const gitDir = resolve(cwd, '.git');

try {
  if (!existsSync(gitDir)) run('git init');
  run('git add .');
  run('git commit -m "Initial commit from Nexus Apex AI"');
  run('git branch -M main');
  run(`git remote add origin ${repoUrl}`);
  console.log('');
  console.log('Remote configured. Push manually:');
  console.log('  git push -u origin main');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`setup-git failed: ${msg}`);
  process.exitCode = 1;
}
