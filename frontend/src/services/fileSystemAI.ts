import { useProjectStore } from '@/stores/projectStore';

// Advanced AI-powered File System Management
export class FileSystemAI {
  private static instance: FileSystemAI;
  private projectStructure: Map<string, any> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  static getInstance(): FileSystemAI {
    if (!FileSystemAI.instance) {
      FileSystemAI.instance = new FileSystemAI();
    }
    return FileSystemAI.instance;
  }

  // Analyze and optimize project structure
  async analyzeProjectStructure(files: any[]): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
    structure: any;
  }> {
    const structure = this.buildStructureMap(files);
    const analysis = this.evaluateStructure(structure);
    
    return {
      score: analysis.score,
      issues: analysis.issues,
      recommendations: analysis.recommendations,
      structure
    };
  }

  // Generate optimal file/folder structure
  async generateOptimalStructure(projectType: string, features: string[]): Promise<{
    folders: string[];
    files: Array<{ path: string; content: string; }>;
    dependencies: string[];
  }> {
    const templates = {
      'react-app': {
        folders: [
          'src',
          'src/components',
          'src/components/ui',
          'src/components/features',
          'src/pages',
          'src/hooks',
          'src/services',
          'src/utils',
          'src/types',
          'src/styles',
          'src/assets',
          'public',
          'tests',
          'docs'
        ],
        files: [
          { path: 'src/App.tsx', content: this.getAppTemplate() },
          { path: 'src/main.tsx', content: this.getMainTemplate() },
          { path: 'src/index.css', content: this.getIndexCSS() },
          { path: 'vite.config.ts', content: this.getViteConfig() },
          { path: 'tsconfig.json', content: this.getTSConfig() },
          { path: 'package.json', content: this.getPackageJSON(features) },
          { path: '.env.example', content: this.getEnvExample() },
          { path: 'README.md', content: this.getReadme() }
        ],
        dependencies: this.getDependencies('react', features)
      },
      'next-app': {
        folders: [
          'src',
          'src/app',
          'src/components',
          'src/components/ui',
          'src/lib',
          'src/hooks',
          'src/types',
          'src/styles',
          'public',
          'docs'
        ],
        files: [
          { path: 'src/app/layout.tsx', content: this.getNextLayout() },
          { path: 'src/app/page.tsx', content: this.getNextPage() },
          { path: 'src/app/globals.css', content: this.getGlobalsCSS() },
          { path: 'next.config.js', content: this.getNextConfig() },
          { path: 'package.json', content: this.getNextPackageJSON(features) },
          { path: '.env.local.example', content: this.getEnvExample() }
        ],
        dependencies: this.getDependencies('next', features)
      },
      'node-api': {
        folders: [
          'src',
          'src/controllers',
          'src/services',
          'src/models',
          'src/middleware',
          'src/routes',
          'src/utils',
          'src/types',
          'src/config',
          'tests',
          'docs'
        ],
        files: [
          { path: 'src/app.ts', content: this.getNodeApp() },
          { path: 'src/server.ts', content: this.getNodeServer() },
          { path: 'package.json', content: this.getNodePackageJSON(features) },
          { path: 'tsconfig.json', content: this.getNodeTSConfig() },
          { path: '.env.example', content: this.getNodeEnvExample() }
        ],
        dependencies: this.getDependencies('node', features)
      }
    };

    return templates[projectType as keyof typeof templates] || templates['react-app'];
  }

  // Optimize existing project
  async optimizeProject(files: any[]): Promise<Array<{
    type: 'file' | 'delete' | 'move' | 'create';
    path: string;
    newPath?: string;
    content?: string;
    reason: string;
  }>> {
    const optimizations: any[] = [];
    const structure = this.buildStructureMap(files);
    
    // Find duplicate or similar files
    const duplicates = this.findDuplicateFiles(files);
    duplicates.forEach(dup => {
      optimizations.push({
        type: 'delete',
        path: dup.path,
        reason: 'Duplicate file detected'
      });
    });
    
    // Find misplaced files
    const misplaced = this.findMisplacedFiles(structure);
    misplaced.forEach(file => {
      optimizations.push({
        type: 'move',
        path: file.current,
        newPath: file.suggested,
        reason: `File should be in ${file.suggested}`
      });
    });
    
    // Suggest missing files
    const missing = this.findMissingFiles(structure);
    missing.forEach(file => {
      optimizations.push({
        type: 'create',
        path: file.path,
        content: file.content,
        reason: file.reason
      });
    });
    
    // Optimize imports
    const importOptimizations = await this.optimizeImports(files);
    optimizations.push(...importOptimizations);
    
    return optimizations;
  }

  // Smart file naming suggestions
  async suggestFileName(content: string, fileType: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Analyze content to extract purpose
    const keywords = this.extractKeywords(content);
    
    // Generate names based on conventions
    if (fileType === 'component') {
      suggestions.push(
        `${this.pascalCase(keywords.primary)}.tsx`,
        `${this.pascalCase(keywords.primary)}Component.tsx`,
        `${this.pascalCase(keywords.primary)}View.tsx`
      );
    } else if (fileType === 'hook') {
      suggestions.push(
        `use${this.pascalCase(keywords.primary)}.ts`,
        `use${this.pascalCase(keywords.action)}.ts`
      );
    } else if (fileType === 'service') {
      suggestions.push(
        `${keywords.primary}Service.ts`,
        `${keywords.primary}API.ts`,
        `${keywords.primary}Client.ts`
      );
    } else if (fileType === 'utility') {
      suggestions.push(
        `${keywords.primary}Utils.ts`,
        `${keywords.primary}Helpers.ts`,
        `${this.pascalCase(keywords.primary)}.ts`
      );
    }
    
    return suggestions;
  }

  // Generate boilerplate code
  async generateBoilerplate(type: string, options: any): Promise<string> {
    const templates = {
      'react-component': this.getReactComponentTemplate(options),
      'react-hook': this.getReactHookTemplate(options),
      'api-service': this.getAPIServiceTemplate(options),
      'utility': this.getUtilityTemplate(options),
      'test': this.getTestTemplate(options)
    };
    
    return templates[type as keyof typeof templates] || '';
  }

  // Private helper methods
  private buildStructureMap(files: any[]): any {
    const structure: any = {
      components: [],
      pages: [],
      hooks: [],
      services: [],
      utils: [],
      types: [],
      assets: [],
      tests: [],
      config: []
    };
    
    files.forEach(file => {
      const path = file.path;
      
      if (path.includes('components/')) {
        structure.components.push(file);
      } else if (path.includes('pages/') || path.includes('app/')) {
        structure.pages.push(file);
      } else if (path.includes('hooks/')) {
        structure.hooks.push(file);
      } else if (path.includes('services/')) {
        structure.services.push(file);
      } else if (path.includes('utils/') || path.includes('helpers/')) {
        structure.utils.push(file);
      } else if (path.includes('types/')) {
        structure.types.push(file);
      } else if (path.includes('assets/') || path.includes('public/')) {
        structure.assets.push(file);
      } else if (path.includes('test') || path.includes('spec')) {
        structure.tests.push(file);
      } else if (path.includes('config/')) {
        structure.config.push(file);
      }
    });
    
    return structure;
  }

  private evaluateStructure(structure: any): any {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check for missing folders
    if (structure.components.length === 0) {
      issues.push('No components folder found');
      score -= 20;
    }
    
    if (structure.utils.length === 0) {
      recommendations.push('Consider adding a utils folder for shared utilities');
      score -= 10;
    }
    
    if (structure.tests.length === 0) {
      issues.push('No test files found');
      recommendations.push('Add unit tests for better code quality');
      score -= 15;
    }
    
    // Check file organization
    const totalFiles = Object.values(structure).reduce((sum: number, files: any) => sum + files.length, 0);
    if (totalFiles > 50 && structure.components.length > 20) {
      recommendations.push('Consider splitting components into subfolders (ui, features, etc.)');
      score -= 5;
    }
    
    // Check for TypeScript
    const hasTS = Object.values(structure).some((files: any) => 
      files.some((file: any) => file.path.endsWith('.ts') || file.path.endsWith('.tsx'))
    );
    if (!hasTS) {
      recommendations.push('Consider using TypeScript for better type safety');
      score -= 10;
    }
    
    return { score, issues, recommendations };
  }

  private findDuplicateFiles(files: any[]): any[] {
    const duplicates: any[] = [];
    const contentMap = new Map<string, string[]>();
    
    files.forEach(file => {
      const hash = this.hashContent(file.content || '');
      if (!contentMap.has(hash)) {
        contentMap.set(hash, []);
      }
      contentMap.get(hash)!.push(file.path);
    });
    
    contentMap.forEach((paths, hash) => {
      if (paths.length > 1) {
        // Keep the first one, mark others as duplicates
        for (let i = 1; i < paths.length; i++) {
          duplicates.push({ path: paths[i], hash });
        }
      }
    });
    
    return duplicates;
  }

  private findMisplacedFiles(structure: any): any[] {
    const misplaced: any[] = [];
    
    // Check for components in wrong places
    structure.pages.forEach((file: any) => {
      if (file.content?.includes('export default function') && 
          !file.path.includes('components') && 
          file.content.includes('<')) {
        misplaced.push({
          current: file.path,
          suggested: file.path.replace('pages/', 'components/')
        });
      }
    });
    
    return misplaced;
  }

  private findMissingFiles(structure: any): any[] {
    const missing: any[] = [];
    
    // Check for essential files
    if (!structure.config.some((f: any) => f.path.includes('package.json'))) {
      missing.push({
        path: 'package.json',
        content: this.getPackageJSON([]),
        reason: 'Essential package.json file missing'
      });
    }
    
    if (!structure.types.some((f: any) => f.path.includes('index'))) {
      missing.push({
        path: 'src/types/index.ts',
        content: 'export type {};\n',
        reason: 'Centralized types file recommended'
      });
    }
    
    return missing;
  }

  private async optimizeImports(files: any[]): Promise<any[]> {
    const optimizations: any[] = [];
    
    files.forEach(file => {
      if (file.content && (file.path.endsWith('.ts') || file.path.endsWith('.tsx'))) {
        // Check for unused imports
        const unusedImports = this.findUnusedImports(file.content);
        unusedImports.forEach(imp => {
          optimizations.push({
            type: 'file',
            path: file.path,
            content: file.content.replace(imp, ''),
            reason: 'Remove unused import'
          });
        });
      }
    });
    
    return optimizations;
  }

  private findUnusedImports(content: string): string[] {
    const unused: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"][^'"]+['"];?/g;
    const imports = content.match(importRegex) || [];
    
    imports.forEach(imp => {
      const importName = imp.match(/import\s+({?\s*\w+}?)/)?.[1];
      if (importName && !content.includes(importName.replace(/[{}]/g, '').trim())) {
        unused.push(imp);
      }
    });
    
    return unused;
  }

  private extractKeywords(content: string): { primary: string; action: string } {
    const words = content.toLowerCase().split(/\W+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    
    const filtered = words.filter(word => 
      word.length > 3 && 
      !commonWords.has(word) &&
      !/^\d+$/.test(word)
    );
    
    const frequency: Record<string, number> = {};
    filtered.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    const sorted = Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return {
      primary: sorted[0]?.[0] || 'component',
      action: sorted[1]?.[0] || 'handler'
    };
  }

  private pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  // Template generators
  private getAppTemplate(): string {
    return `import React from 'react';
import './index.css';

function App() {
  return (
    <div className="App">
      <h1>Welcome to Your App</h1>
    </div>
  );
}

export default App;`;
  }

  private getMainTemplate(): string {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  private getIndexCSS(): string {
    return `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`;
  }

  private getViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  }
})`;
  }

  private getTSConfig(): string {
    return `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`;
  }

  private getPackageJSON(features: string[]): string {
    return `{
  "name": "my-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"${features.includes('router') ? ',\n    "react-router-dom": "^6.8.0"' : ''}${features.includes('state') ? ',\n    "zustand": "^4.3.0"' : ''}
  },
  "devDependencies": {
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "@typescript-eslint/eslint-plugin": "^5.57.1",
    "@typescript-eslint/parser": "^5.57.1",
    "@vitejs/plugin-react": "^4.0.0",
    "eslint": "^8.38.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.3.4",
    "typescript": "^5.0.2",
    "vite": "^4.3.2"
  }
}`;
  }

  private getEnvExample(): string {
    return `VITE_API_URL=http://localhost:3001
VITE_APP_TITLE=My App
VITE_ENVIRONMENT=development`;
  }

  private getReadme(): string {
    return `# My App

## Description

A modern web application built with React and TypeScript.

## Features

- ⚡ Fast development with Vite
- 🔒 Type-safe with TypeScript
- 🎨 Modern UI with CSS
- 📱 Responsive design

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open your browser and navigate to \`http://localhost:3000\`

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run lint\` - Run ESLint

## License

MIT`;
  }

  private getDependencies(framework: string, features: string[]): string[] {
    const baseDeps = {
      react: ['react', 'react-dom'],
      next: ['next', 'react', 'react-dom'],
      node: ['express', 'cors', 'helmet']
    };
    
    const featureDeps: Record<string, string[]> = {
      router: ['react-router-dom'],
      state: ['zustand'],
      ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
      http: ['axios'],
      testing: ['@testing-library/react', '@testing-library/jest-dom', 'vitest']
    };
    
    const deps = [...(baseDeps[framework as keyof typeof baseDeps] || [])];
    
    features.forEach(feature => {
      if (featureDeps[feature]) {
        deps.push(...featureDeps[feature]);
      }
    });
    
    return deps;
  }

  // Additional template methods for Next.js and Node.js would go here...
  private getNextLayout(): string { /* ... */ return ''; }
  private getNextPage(): string { /* ... */ return ''; }
  private getGlobalsCSS(): string { /* ... */ return ''; }
  private getNextConfig(): string { /* ... */ return ''; }
  private getNextPackageJSON(features: string[]): string { /* ... */ return ''; }
  private getNodeApp(): string { /* ... */ return ''; }
  private getNodeServer(): string { /* ... */ return ''; }
  private getNodePackageJSON(features: string[]): string { /* ... */ return ''; }
  private getNodeTSConfig(): string { /* ... */ return ''; }
  private getNodeEnvExample(): string { /* ... */ return ''; }
  private getReactComponentTemplate(options: any): string { /* ... */ return ''; }
  private getReactHookTemplate(options: any): string { /* ... */ return ''; }
  private getAPIServiceTemplate(options: any): string { /* ... */ return ''; }
  private getUtilityTemplate(options: any): string { /* ... */ return ''; }
  private getTestTemplate(options: any): string { /* ... */ return ''; }
}

export const fileSystemAI = FileSystemAI.getInstance();
