'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep minimal to avoid console noise loops.
    // eslint-disable-next-line no-console
    console.error('[app:error]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="text-sm font-semibold tracking-wide text-white/85">Server Error</div>
        <div className="mt-2 text-sm leading-relaxed text-white/65">
          The server timed out or returned an unexpected response. Retrying…
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-transparent px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur-md transition hover:bg-white/5"
          >
            Go Home
          </a>
        </div>
      </div>
    </main>
  );
}

