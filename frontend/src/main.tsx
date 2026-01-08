import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/theme.css';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { WebContainerProvider } from './context/WebContainerContext';
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <WebContainerProvider>
          <App />
        </WebContainerProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
