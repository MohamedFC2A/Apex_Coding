'use client';

import App from '../../App';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

export default function IDEClient() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

