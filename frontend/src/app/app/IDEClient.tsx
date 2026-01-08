'use client';

import App from '@/App';
import { WebContainerProvider } from '@/context/WebContainerContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function IDEClient() {
  return (
    <ErrorBoundary>
      <WebContainerProvider>
        <App />
      </WebContainerProvider>
    </ErrorBoundary>
  );
}

