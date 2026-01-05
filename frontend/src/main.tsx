import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/theme.css';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { WebContainerProvider } from './context/WebContainerContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WebContainerProvider>
        <App />
      </WebContainerProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
