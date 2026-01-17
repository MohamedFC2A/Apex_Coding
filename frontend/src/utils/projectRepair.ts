export interface ProjectFile {
  path?: string;
  content: string;
  name?: string;
  language?: string;
}

const DEFAULT_PACKAGE_JSON = JSON.stringify({
  name: "vite-project",
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  dependencies: {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.344.0"
  },
  devDependencies: {
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.4"
  }
}, null, 2);

const DEFAULT_VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`;

const DEFAULT_INDEX_HTML = `<!doctype html>
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
</html>
`;

export function ensureProjectConfig(files: ProjectFile[]): { files: ProjectFile[], repaired: boolean } {
  const newFiles = [...files];
  let repaired = false;

  const hasFile = (name: string) => newFiles.some(f => (f.path === name || f.name === name || f.path?.endsWith('/' + name)));

  if (!hasFile('package.json')) {
    newFiles.push({
      path: 'package.json',
      name: 'package.json',
      content: DEFAULT_PACKAGE_JSON,
      language: 'json'
    });
    repaired = true;
  }

  if (!hasFile('vite.config.js') && !hasFile('vite.config.ts')) {
    newFiles.push({
      path: 'vite.config.js',
      name: 'vite.config.js',
      content: DEFAULT_VITE_CONFIG,
      language: 'javascript'
    });
    repaired = true;
  }

  if (!hasFile('index.html')) {
    newFiles.push({
      path: 'index.html',
      name: 'index.html',
      content: DEFAULT_INDEX_HTML,
      language: 'html'
    });
    repaired = true;
  }

  return { files: newFiles, repaired };
}
