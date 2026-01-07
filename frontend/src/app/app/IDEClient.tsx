'use client';

import App from '@/App';
import { WebContainerProvider } from '@/context/WebContainerContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ConvexOptionalProvider } from '@/services/convex/ConvexOptionalProvider';
import { ConvexProjectSync } from '@/services/convex/ConvexProjectSync';

export default function IDEClient() {
  return (
    <ErrorBoundary>
      <ConvexOptionalProvider>
        <ConvexProjectSync />
        <WebContainerProvider>
          <App />
        </WebContainerProvider>
      </ConvexOptionalProvider>
    </ErrorBoundary>
  );
}

