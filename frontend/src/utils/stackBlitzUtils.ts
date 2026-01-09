import { ProjectFile } from '@/types';

export const getStackBlitzFiles = (files: ProjectFile[]) => {
  const sbFiles: { [key: string]: string } = {};
  
  files.forEach(file => {
    const filePath = file.path || file.name;
    // Remove leading slash if present
    let cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // Handle nested structure: Flatten 'frontend/' and 'backend/' to root
    // But prefer 'frontend/' files if we are doing a frontend preview
    // For now, let's keep it simple: if it starts with frontend/, strip it.
    // If it starts with backend/, we might not need it in the browser preview unless it's a fullstack container.
    // StackBlitz WebContainers can run Node, so we can include backend files, but typically we want the vite app at root.
    
    // STRATEGY: 
    // 1. If path starts with 'frontend/', strip 'frontend/' and map to root.
    // 2. If path starts with 'backend/', map to 'backend/' folder (keep it side-by-side if needed, or ignore).
    //    The user error suggests it's looking for 'stackblitz:/frontend/tailwind.config.js' which implies 
    //    the environment expects files at root but they might be nested or vice versa.
    //    The error "Could not find source file: 'stackblitz:/frontend/tailwind.config.js'" usually means 
    //    something is trying to import/read it from that path but it's not there.
    
    // Let's normalize everything to ROOT for the frontend preview.
    if (cleanPath.startsWith('frontend/')) {
        cleanPath = cleanPath.replace('frontend/', '');
    } else if (cleanPath.startsWith('backend/')) {
        // Optional: include backend files in a 'backend' folder if we want to run a server later
        // For now, let's just keep them as is (so they go into a backend folder)
        // or ignore them if they are causing noise.
        // However, the user errors show 'stackblitz:/backend/api/...' not found.
        // This might be because some code is trying to fetch from there?
        // Let's keep them but ensure the structure is clean.
    }

    sbFiles[cleanPath] = file.content;
  });

  // Ensure tsconfig.json exists
  if (!sbFiles['tsconfig.json']) {
    sbFiles['tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }]
    }, null, 2);
  }

  // Ensure tsconfig.node.json exists
  if (!sbFiles['tsconfig.node.json']) {
      sbFiles['tsconfig.node.json'] = JSON.stringify({
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true
        },
        include: ['vite.config.ts']
      }, null, 2);
  }

  // Ensure package.json exists
  if (!sbFiles['package.json']) {
    sbFiles['package.json'] = JSON.stringify({
      name: 'apex-coding-project',
      version: '0.0.0',
      private: true,
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'lucide-react': '^0.294.0',
        'tailwindcss': '^3.4.0',
        'postcss': '^8.4.32',
        'autoprefixer': '^10.4.16'
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
      try {
          const pkg = JSON.parse(sbFiles['package.json']);
          // Ensure scripts are set for Vite
          pkg.scripts = { 
              ...pkg.scripts, 
              dev: 'vite', 
              build: 'tsc && vite build', 
              preview: 'vite preview' 
          };
          
          // Ensure dependencies
          pkg.devDependencies = pkg.devDependencies || {};
          if (!pkg.devDependencies['vite']) pkg.devDependencies['vite'] = '^5.0.0';
          if (!pkg.devDependencies['@vitejs/plugin-react']) pkg.devDependencies['@vitejs/plugin-react'] = '^4.2.1';
          if (!pkg.devDependencies['typescript']) pkg.devDependencies['typescript'] = '^5.0.0';

          // Ensure basic runtime deps if missing
          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies['react']) pkg.dependencies['react'] = '^18.2.0';
          if (!pkg.dependencies['react-dom']) pkg.dependencies['react-dom'] = '^18.2.0';
          
          sbFiles['package.json'] = JSON.stringify(pkg, null, 2);
      } catch (e) {
          console.error('Error parsing package.json', e);
      }
  }

  // Ensure index.html exists
  if (!sbFiles['index.html']) {
      sbFiles['index.html'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vite App</title>
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

export default defineConfig({
  plugins: [react()],
})`;
  }

  return sbFiles;
};
