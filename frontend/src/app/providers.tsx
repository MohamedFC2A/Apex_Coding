'use client';

import { ConvexOptionalProvider } from '@/services/convex/ConvexOptionalProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexOptionalProvider>{children}</ConvexOptionalProvider>;
}

