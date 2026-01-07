'use client';

import { useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

export function ConvexOptionalProvider({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    const url = String(convexUrl || '').trim();
    if (!url) return null;
    return new ConvexReactClient(url);
  }, [convexUrl]);

  if (!client) return <>{children}</>;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
