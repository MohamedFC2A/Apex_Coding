'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectFile } from '@/types';

// Note: `convex dev` typically generates this, but we ship a lightweight proxy to keep the app compiling.
import { api } from '../../../convex/_generated/api';

const convexEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type ConvexFileRow = {
  path: string;
  content: string;
  updatedAt: number;
};

function ConvexProjectSyncEnabled() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const setProjectIdInStore = useProjectStore((s) => s.setProjectId);
  const setFiles = useProjectStore((s) => s.setFiles);
  const setIsHydrating = useProjectStore((s) => s.setIsHydrating);

  const localFiles = useProjectStore((s) => s.files);
  const isGenerating = useAIStore((s) => s.isGenerating);

  const ensureDefaultProject = useMutation((api as any).projects.ensureDefault);
  const upsertFile = useMutation((api as any).files.upsert);

  const remoteFiles = useQuery(
    (api as any).files.list,
    projectId ? ({ projectId } as any) : 'skip'
  ) as ConvexFileRow[] | undefined;

  const hydratingRef = useRef(false);
  const lastSentRef = useRef<Map<string, string>>(new Map());
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const remoteAsProjectFiles = useMemo<ProjectFile[]>(() => {
    if (!remoteFiles) return [];
    return remoteFiles.map((row) => ({
      name: row.path.split('/').pop() || row.path,
      path: row.path,
      content: row.content,
      language: undefined
    }));
  }, [remoteFiles]);

  useEffect(() => {
    if (!convexEnabled) return;
    let cancelled = false;

    (async () => {
      setIsHydrating(true);
      try {
        const result = (await ensureDefaultProject({} as any)) as any;
        if (cancelled) return;

        const nextProjectId = String(result?.projectId || '');
        setProjectId(nextProjectId || null);
        setProjectIdInStore(nextProjectId);
        if (typeof result?.name === 'string') setProjectName(result.name);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureDefaultProject, setIsHydrating, setProjectIdInStore, setProjectName]);

  useEffect(() => {
    if (!convexEnabled) return;
    if (!projectId) return;
    if (!remoteFiles) return;

    hydratingRef.current = true;
    setIsHydrating(true);

    try {
      setFiles(remoteAsProjectFiles);
      useAIStore.getState().setFilesFromProjectFiles(remoteAsProjectFiles);

      const next = new Map<string, string>();
      for (const file of remoteAsProjectFiles) {
        const path = file.path || file.name;
        if (!path) continue;
        next.set(path, file.content || '');
      }
      lastSentRef.current = next;
    } finally {
      hydratingRef.current = false;
      setIsHydrating(false);
    }
  }, [projectId, remoteAsProjectFiles, remoteFiles, setFiles, setIsHydrating]);

  useEffect(() => {
    if (!convexEnabled) return;
    if (!projectId) return;
    if (hydratingRef.current) return;
    if (isGenerating) return;

    const changed: Array<{ path: string; content: string }> = [];

    for (const file of localFiles) {
      const path = file.path || file.name;
      if (!path) continue;
      const content = file.content || '';
      const last = lastSentRef.current.get(path);
      if (last !== content) changed.push({ path, content });
    }

    if (changed.length === 0) return;

    for (const item of changed) {
      lastSentRef.current.set(item.path, item.content);
      writeChainRef.current = writeChainRef.current.then(async () => {
        await upsertFile({ projectId, path: item.path, content: item.content } as any);
      });
    }
  }, [isGenerating, localFiles, projectId, upsertFile]);

  return null;
}

export function ConvexProjectSync() {
  if (!convexEnabled) return null;
  return <ConvexProjectSyncEnabled />;
}
