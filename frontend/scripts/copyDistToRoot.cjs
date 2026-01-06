/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const srcDir = path.join(frontendDir, 'dist');
const rootDir = path.resolve(frontendDir, '..');
const outDir = path.join(rootDir, 'dist');

const rmDir = (target) => {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
};

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(from);
      fs.symlinkSync(linkTarget, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
};

try {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[postbuild] frontend/dist not found at ${srcDir}`);
    process.exit(0);
  }
  rmDir(outDir);
  copyDir(srcDir, outDir);
  console.log(`[postbuild] copied ${srcDir} -> ${outDir}`);
} catch (err) {
  console.error('[postbuild] failed to copy dist:', err);
  process.exitCode = 1;
}

