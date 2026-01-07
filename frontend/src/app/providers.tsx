'use client';

import { ConvexOptionalProvider } from '@/services/convex/ConvexOptionalProvider';
import { LanguageProvider } from '@/context/LanguageContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ConvexOptionalProvider>{children}</ConvexOptionalProvider>
    </LanguageProvider>
  );
}

