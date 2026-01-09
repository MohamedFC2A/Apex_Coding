import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // In dev, keep the frontend talking to the backend via the Vite proxy (`/api`).
  // Resolve the backend port from env so we don't hardcode 3001/3000 mismatches.
  const workspaceRoot = path.resolve(__dirname, '..');
  const backendRoot = path.resolve(__dirname, '../backend');

  const rootEnv = loadEnv(mode, workspaceRoot, '');
  const backendEnv = loadEnv(mode, backendRoot, '');

  // Always use local backend since we don't have a deployed Vercel backend
  const backendTarget = `http://localhost:${rootEnv.PORT || 3001}`;

  return {
    envDir: workspaceRoot,
    plugins: [
      react({
        babel: {
          plugins: [
            [
              'babel-plugin-styled-components',
              {
                displayName: true,
                fileName: false,
                pure: true
              }
            ]
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared')
      }
    },
    server: {
      port: 5173,
      headers: {
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin'
      },
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true
        }
      }
    }
  };
});
