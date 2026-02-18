'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { readLivePreviewSnapshot, subscribeLivePreviewSnapshot, type LivePreviewSnapshot } from '@/utils/livePreviewLink';

const formatTimestamp = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Unknown';
  }
};

export default function LivePreviewPage() {
  const params = useParams<{ projectId: string }>();
  const rawProjectId = Array.isArray(params?.projectId) ? params.projectId[0] : params?.projectId;
  const projectId = useMemo(() => decodeURIComponent(String(rawProjectId || '').trim()), [rawProjectId]);
  const [snapshot, setSnapshot] = useState<LivePreviewSnapshot | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshot(readLivePreviewSnapshot(projectId));
    const unsubscribe = subscribeLivePreviewSnapshot(projectId, (nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    const refreshFromStorage = () => {
      setSnapshot(readLivePreviewSnapshot(projectId));
    };

    window.addEventListener('focus', refreshFromStorage);
    document.addEventListener('visibilitychange', refreshFromStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshFromStorage);
      document.removeEventListener('visibilitychange', refreshFromStorage);
    };
  }, [projectId]);

  if (!projectId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <h1 className="text-xl font-semibold">Invalid preview link</h1>
          <p className="mt-3 text-sm text-white/70">Project ID is missing from the URL.</p>
        </div>
      </main>
    );
  }

  if (!snapshot || !snapshot.html) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <h1 className="text-xl font-semibold">No preview snapshot yet</h1>
          <p className="mt-3 text-sm text-white/70">
            Open the project in IDE, run/generate preview once, then refresh this page.
          </p>
          <p className="mt-4 text-xs text-white/50">Project: {projectId}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="font-semibold">Live Preview</div>
          <div className="text-white/70">Project: {projectId}</div>
          <div className="text-white/60">Updated: {formatTimestamp(snapshot.updatedAt)}</div>
        </div>
      </header>
      <iframe
        title={`Live Preview ${projectId}`}
        className="h-[calc(100vh-56px)] w-full border-0"
        srcDoc={snapshot.html}
        sandbox="allow-scripts allow-modals allow-popups allow-forms allow-presentation"
      />
    </main>
  );
}
