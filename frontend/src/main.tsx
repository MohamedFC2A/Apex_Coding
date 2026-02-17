import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/consolidated.css';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
