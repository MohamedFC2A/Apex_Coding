import { ProjectFile } from '@/types';

export const getStackBlitzFiles = (files: ProjectFile[]) => {
  const sbFiles: { [key: string]: string } = {};
  
  files.forEach(file => {
    // Use path if available, otherwise name (for root files)
    const filePath = file.path || file.name;
    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    sbFiles[cleanPath] = file.content;
  });

  // Ensure package.json exists and has necessary dependencies
  if (!sbFiles['package.json']) {
    sbFiles['package.json'] = JSON.stringify({
      name: 'apex-coding-project',
      version: '0.0.0',
      private: true,
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.2.43',
        '@types/react-dom': '^18.2.17',
        'typescript': '^5.0.0',
        'vite': '^5.0.0',
        '@vitejs/plugin-react': '^4.2.1'
      },
      scripts: {
        'dev': 'vite',
        'build': 'tsc && vite build',
        'preview': 'vite preview'
      }
    }, null, 2);
  } else {
      // If it exists, parse and ensure essential deps are present for TS support
      try {
          const pkg = JSON.parse(sbFiles['package.json']);
          pkg.dependencies = { ...pkg.dependencies };
          pkg.devDependencies = { ...pkg.devDependencies };
          
          // Add React types if missing and it's a React project
          if (!pkg.devDependencies['@types/react']) {
              pkg.devDependencies['@types/react'] = '^18.2.43';
          }
          if (!pkg.devDependencies['@types/react-dom']) {
              pkg.devDependencies['@types/react-dom'] = '^18.2.17';
          }
          if (!pkg.devDependencies['typescript']) {
              pkg.devDependencies['typescript'] = '^5.0.0';
          }

          sbFiles['package.json'] = JSON.stringify(pkg, null, 2);
      } catch (e) {
          console.error('Error parsing package.json', e);
      }
  }

  // Ensure index.html exists for Vite
  if (!sbFiles['index.html']) {
      sbFiles['index.html'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vite + React + TS</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }

  // Ensure vite.config.ts exists
  if (!sbFiles['vite.config.ts'] && !sbFiles['vite.config.js']) {
      sbFiles['vite.config.ts'] = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
plugins: [react()],
})`;
  }

  return sbFiles;
};
