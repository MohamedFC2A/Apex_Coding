'use client';

import Link from 'next/link';

export default function LivePreviewMissingProjectPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <h1 className="text-xl font-semibold">Live preview link is incomplete</h1>
        <p className="mt-3 text-sm text-white/70">
          Open the IDE and click Open Preview once to generate a project-specific link.
        </p>
        <div className="mt-5">
          <Link href="/app" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/85 hover:bg-white/10">
            Open IDE
          </Link>
        </div>
      </div>
    </main>
  );
}
