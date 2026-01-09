const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting Vercel Build Script...');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const frontendNextDir = path.join(frontendDir, '.next');
const frontendPublicDir = path.join(frontendDir, 'public');

const rootNextDir = path.join(rootDir, '.next');
const rootPublicDir = path.join(rootDir, 'public');

// 1. Build Frontend
console.log('Building Frontend...');
try {
  execSync('npm --workspace frontend run build', { stdio: 'inherit', cwd: rootDir });
} catch (error) {
  console.error('Frontend build failed!');
  process.exit(1);
}

// 2. Copy .next to root
console.log('Copying .next to root...');
try {
  if (fs.existsSync(rootNextDir)) {
    fs.rmSync(rootNextDir, { recursive: true, force: true });
  }
  if (fs.existsSync(frontendNextDir)) {
    fs.cpSync(frontendNextDir, rootNextDir, { recursive: true });
    console.log('Successfully copied .next');
  } else {
    console.error('frontend/.next not found!');
    process.exit(1);
  }
} catch (error) {
  console.error('Failed to copy .next:', error);
  process.exit(1);
}

// 3. Copy public to root
console.log('Copying public to root...');
try {
  // We don't want to delete existing root public if it has important files, 
  // but for this deployment, we probably want frontend/public to be authoritative.
  // However, let's just copy over.
  if (!fs.existsSync(rootPublicDir)) {
    fs.mkdirSync(rootPublicDir);
  }
  if (fs.existsSync(frontendPublicDir)) {
    fs.cpSync(frontendPublicDir, rootPublicDir, { recursive: true });
    console.log('Successfully copied public assets');
  }
} catch (error) {
  console.error('Failed to copy public assets:', error);
  // Non-fatal, but good to know
}

// 4. Build/Check API
console.log('Checking API...');
try {
  execSync('npm run build:api', { stdio: 'inherit', cwd: rootDir });
} catch (error) {
  console.error('API check failed!');
  process.exit(1);
}

console.log('Build Script Completed Successfully.');
