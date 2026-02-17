import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { ProjectFile, FileStructure, FileSystem } from '@/types';
import { applyWorkspaceDelta, clearWorkspace, loadWorkspace } from '@/utils/workspaceDb';
import type { ConstraintEnforcement } from '@/types/constraints';

export type ProjectType = 'FULL_STACK' | 'FRONTEND_ONLY';

interface ProjectState {
  projectId: string;
  projectName: string;
  projectType: ProjectType | null;
  selectedFeatures: string[];
  customFeatureTags: string[];
  constraintsEnforcement: ConstraintEnforcement;
  files: ProjectFile[];
  fileStructure: FileStructure[];
  fileSystem?: FileSystem;
  activeFile: string | null;
  stack: string;
  description: string;
  isHydrating: boolean;

  hydrateFromDisk: () => Promise<void>;
  clearDisk: () => Promise<void>;

  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setProjectType: (type: ProjectType | null) => void;
  setSelectedFeatures: (features: string[]) => void;
  setCustomFeatureTags: (tags: string[]) => void;
  setConstraintsEnforcement: (mode: ConstraintEnforcement) => void;
  setFiles: (files: ProjectFile[]) => void;
  setFileStructure: (structure: FileStructure[]) => void;
  setActiveFile: (path: string) => void;
  setIsHydrating: (isHydrating: boolean) => void;
  updateFile: (path: string, content: string) => void;
  upsertFile: (file: ProjectFile) => void;
  appendToFile: (path: string, chunk: string) => void;
  addFile: (file: ProjectFile) => void;
  deleteFile: (path: string) => void;
  moveFile: (fromPath: string, toPath: string) => void;
  setStack: (stack: string) => void;
  setDescription: (description: string) => void;
  reset: () => void;
}

const initialState = {
  projectId: '',
  projectName: '',
  projectType: 'FRONTEND_ONLY' as ProjectType | null,
  selectedFeatures: [] as string[],
  customFeatureTags: [] as string[],
  constraintsEnforcement: 'hard' as ConstraintEnforcement,
  files: [],
  fileStructure: [],
  fileSystem: {},
  activeFile: null,
  stack: '',
  description: '',
  isHydrating: false
};

const normalizeStoredPath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .trim();

const buildFileStructureFromFiles = (files: ProjectFile[]): FileStructure[] => {
  const map = new Map<string, 'file' | 'directory'>();

  for (const file of files) {
    const rawPath = normalizeStoredPath(file.path || file.name || '');
    if (!rawPath) continue;

    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let cursor = '';
    for (let i = 0; i < parts.length - 1; i++) {
      cursor = cursor ? `${cursor}/${parts[i]}` : parts[i];
      if (cursor && !map.has(cursor)) {
        map.set(cursor, 'directory');
      }
    }

    map.set(rawPath, 'file');
  }

  return Array.from(map.entries())
    .map(([path, type]) => ({ path, type }))
    .sort((a, b) => {
      const depthA = a.path.split('/').length;
      const depthB = b.path.split('/').length;
      if (depthA !== depthB) return depthA - depthB;
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });
};

const mergeFileStructureWithFiles = (inputStructure: FileStructure[], files: ProjectFile[]): FileStructure[] => {
  const merged = new Map<string, 'file' | 'directory'>();

  for (const entry of inputStructure || []) {
    const path = normalizeStoredPath(entry.path || '');
    if (!path) continue;
    const type = entry.type === 'directory' ? 'directory' : 'file';
    const existing = merged.get(path);
    if (!existing) {
      merged.set(path, type);
      continue;
    }
    if (existing !== 'file' && type === 'file') merged.set(path, 'file');
  }

  for (const entry of buildFileStructureFromFiles(files)) {
    const path = normalizeStoredPath(entry.path || '');
    if (!path) continue;
    const existing = merged.get(path);
    if (!existing) {
      merged.set(path, entry.type);
      continue;
    }
    if (existing !== 'file' && entry.type === 'file') merged.set(path, 'file');
  }

  return Array.from(merged.entries())
    .map(([path, type]) => ({ path, type }))
    .sort((a, b) => {
      const depthA = a.path.split('/').length;
      const depthB = b.path.split('/').length;
      if (depthA !== depthB) return depthA - depthB;
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });
};

export const useProjectStore = createWithEqualityFn<ProjectState>()(
  persist(
    (set, get) => ({
      ...initialState,

      hydrateFromDisk: async () => {
        if (typeof window === 'undefined') return;
        if (get().isHydrating) return;

        set({ isHydrating: true });
        try {
          const current = get();
          if (current.files.length > 0) return;

          const loaded = await loadWorkspace().catch(() => ({ meta: null, files: [] }));
          if (loaded.files.length > 0) {
            const restoredFiles: ProjectFile[] = loaded.files
              .map((f) => ({
                name: f.name || f.path.split('/').pop() || f.path,
                path: f.path,
                content: f.content || '',
                language: f.language
              }))
              .filter((f) => Boolean(f.path || f.name));

            const latest = get();
            if (latest.files.length > 0) return;

            const fileStructure = mergeFileStructureWithFiles(loaded.meta?.fileStructure || [], restoredFiles);

            set({
              projectId: loaded.meta?.projectId ?? current.projectId,
              projectName: loaded.meta?.projectName ?? current.projectName,
              projectType: loaded.meta?.projectType ?? current.projectType,
              selectedFeatures: Array.isArray(loaded.meta?.selectedFeatures)
                ? loaded.meta.selectedFeatures
                : current.selectedFeatures,
              customFeatureTags: Array.isArray(loaded.meta?.customFeatureTags)
                ? loaded.meta.customFeatureTags
                : current.customFeatureTags,
              constraintsEnforcement: loaded.meta?.constraintsEnforcement ?? current.constraintsEnforcement,
              stack: loaded.meta?.stack ?? current.stack,
              description: loaded.meta?.description ?? current.description,
              activeFile: loaded.meta?.activeFile ?? current.activeFile ?? (restoredFiles[0]?.path || null),
              files: restoredFiles,
              fileStructure
            });
            return;
          }

          // Migration path from old localStorage autosave (pre-IDB).
          const legacy = window.localStorage.getItem('apex-coding-autosave');
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy);
              const legacyFiles: ProjectFile[] = Array.isArray(parsed?.files)
                ? parsed.files
                    .map((f: any) => ({
                      name: String(f?.name || f?.path || ''),
                      path: String(f?.path || f?.name || ''),
                      content: String(f?.content || ''),
                      language: undefined
                    }))
                    .filter((f: ProjectFile) => Boolean(f.path))
                : [];

              if (legacyFiles.length > 0) {
                const normalizedLegacyStructure = mergeFileStructureWithFiles([], legacyFiles);
                const legacyMeta = {
                  projectId: current.projectId || '',
                  projectName: String(parsed?.projectName || current.projectName || ''),
                  projectType: current.projectType || 'FRONTEND_ONLY',
                  selectedFeatures: current.selectedFeatures || [],
                  customFeatureTags: current.customFeatureTags || [],
                  constraintsEnforcement: current.constraintsEnforcement || 'hard',
                  stack: String(parsed?.stack || current.stack || ''),
                  description: String(parsed?.description || current.description || ''),
                  activeFile: String(parsed?.activeFile || current.activeFile || '') || null,
                  fileStructure: normalizedLegacyStructure
                };

                await applyWorkspaceDelta({ meta: legacyMeta, upsertFiles: legacyFiles });

                set({
                  projectName: legacyMeta.projectName,
                  projectType: legacyMeta.projectType,
                  selectedFeatures: legacyMeta.selectedFeatures,
                  customFeatureTags: legacyMeta.customFeatureTags,
                  constraintsEnforcement: legacyMeta.constraintsEnforcement,
                  stack: legacyMeta.stack,
                  description: legacyMeta.description,
                  activeFile: legacyMeta.activeFile ?? legacyFiles[0]?.path ?? null,
                  files: legacyFiles,
                  fileStructure: normalizedLegacyStructure
                });
              }
            } catch {
              // ignore parse failures
            } finally {
              // Always remove to prevent repeated parse + massive localStorage writes.
              window.localStorage.removeItem('apex-coding-autosave');
            }
          }
        } finally {
          set({ isHydrating: false });
        }
      },

      clearDisk: async () => {
        if (typeof window === 'undefined') return;
        await clearWorkspace().catch(() => undefined);
        try {
          window.localStorage.removeItem('apex-coding-autosave');
        } catch {
          // ignore
        }
      },
       
      setProjectId: (id) => set({ projectId: id }),
      
      setProjectName: (name) => set({ projectName: name }),

      setProjectType: (type) => set({ projectType: type }),

      setSelectedFeatures: (features) => set({ selectedFeatures: features }),

      setCustomFeatureTags: (tags) => set({ customFeatureTags: tags }),

      setConstraintsEnforcement: (mode) => set({ constraintsEnforcement: mode }),

      setFiles: (files) =>
        set({
          files,
          fileStructure: mergeFileStructureWithFiles([], files)
        }),
      
      setFileStructure: (structure) =>
        set((state) => ({
          fileStructure: mergeFileStructureWithFiles(structure, state.files)
        })),
      
      setActiveFile: (path) => set({ activeFile: path }),

      setIsHydrating: (isHydrating) => set({ isHydrating }),
      
      updateFile: (path, content) =>
        set((state) => {
          const nextFiles = state.files.map((file) =>
            file.path === path ? { ...file, content } : file
          );
          return {
            files: nextFiles,
            fileStructure: mergeFileStructureWithFiles(state.fileStructure, nextFiles)
          };
        }),

      upsertFile: (file) =>
        set((state) => {
          const path = file.path || file.name;
          if (!path) return state;
          const exists = state.files.some((f) => (f.path || f.name) === path);
          if (exists) {
            const nextFiles = state.files.map((f) => ((f.path || f.name) === path ? { ...f, ...file, path } : f));
            return {
              files: nextFiles,
              fileStructure: mergeFileStructureWithFiles(state.fileStructure, nextFiles)
            };
          }
          const nextFiles = [...state.files, { ...file, path }];
          return {
            files: nextFiles,
            fileStructure: mergeFileStructureWithFiles(state.fileStructure, nextFiles)
          };
        }),

      appendToFile: (path, chunk) =>
        set((state) => {
          const nextFiles = state.files.map((file) =>
            (file.path || file.name) === path
              ? { ...file, content: (file.content || '') + chunk, path }
              : file
          );
          return {
            files: nextFiles,
            fileStructure: mergeFileStructureWithFiles(state.fileStructure, nextFiles)
          };
        }),
      
      addFile: (file) =>
        set((state) => {
          const path = file.path || file.name;
          if (!path) return state;
          const nextFiles = [...state.files, { ...file, path }];
          return {
            files: nextFiles,
            fileStructure: mergeFileStructureWithFiles(state.fileStructure, nextFiles)
          };
        }),
      
      deleteFile: (path) => {
        const target = String(path || '').trim();
        if (!target) return;
        set((state) => ({
          files: state.files.filter((file) => (file.path || file.name) !== target),
          fileStructure: mergeFileStructureWithFiles(
            [],
            state.files.filter((file) => (file.path || file.name) !== target)
          ),
          activeFile: state.activeFile === target ? null : state.activeFile
        }));
        if (typeof window !== 'undefined') {
          void applyWorkspaceDelta({ deletePaths: [target] }).catch(() => undefined);
        }
      },

      moveFile: (fromPath, toPath) => {
        const from = String(fromPath || '').trim();
        const to = String(toPath || '').trim();
        if (!from || !to || from === to) return;

        set((state) => {
          const source = state.files.find((file) => (file.path || file.name) === from);
          if (!source) return state;

          const movedFile: ProjectFile = {
            ...source,
            path: to,
            name: to.split('/').pop() || to
          };

          const nextFiles = state.files
            .filter((file) => {
              const current = file.path || file.name;
              return current !== from && current !== to;
            })
            .concat(movedFile);

          const nextStructure = state.fileStructure
            .filter((entry) => entry.path !== from && entry.path !== to)
            .concat({ path: to, type: 'file' as const });

          const activeFile = state.activeFile === from ? to : state.activeFile;

          return {
            files: nextFiles,
            fileStructure: mergeFileStructureWithFiles(nextStructure, nextFiles),
            activeFile
          };
        });

        if (typeof window !== 'undefined') {
          void applyWorkspaceDelta({ movePaths: [{ from, to }] }).catch(() => undefined);
        }
      },
      
      setStack: (stack) => set({ stack }),
      
      setDescription: (description) => set({ description }),
      
      reset: () => set(initialState)
    }),
    {
      name: 'apex-project-store',
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectType: state.projectType,
        selectedFeatures: state.selectedFeatures,
        customFeatureTags: state.customFeatureTags,
        constraintsEnforcement: state.constraintsEnforcement,
        fileStructure: state.fileStructure,
        activeFile: state.activeFile,
        stack: state.stack,
        description: state.description
      })
    }
  )
);

// Expose store for global autosave access
if (typeof window !== 'undefined') {
  (window as any).__APEX_PROJECT_STORE__ = useProjectStore;

  const w = window as any;
  if (!w.__APEX_WORKSPACE_PERSIST__) {
    const sampleHash = (text: string) => {
      const prefix = text.slice(0, 512);
      const suffix = text.length > 1024 ? text.slice(-512) : '';
      const sample = prefix + '|' + suffix;
      let hash = 2166136261;
      for (let i = 0; i < sample.length; i++) {
        hash ^= sample.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    };

    const fileSig = (f: ProjectFile) => {
      const path = f.path || f.name;
      const content = f.content || '';
      return `${path}:${content.length}:${sampleHash(content)}`;
    };

    let flushTimer: number | null = null;
    let backupTimer: number | null = null;
    const pendingUpserts = new Map<string, ProjectFile>();
    const pendingDeletes = new Set<string>();
    let pendingMeta: {
      projectId: string;
      projectName: string;
      projectType: ProjectType | null;
      selectedFeatures: string[];
      customFeatureTags: string[];
      constraintsEnforcement: ConstraintEnforcement;
      stack: string;
      description: string;
      activeFile: string | null;
      fileStructure: FileStructure[];
    } | null = null;

    const flushNow = async () => {
      if (flushTimer) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }

      const upsertFiles = Array.from(pendingUpserts.values());
      const deletePaths = Array.from(pendingDeletes.values());
      const meta = pendingMeta;

      pendingUpserts.clear();
      pendingDeletes.clear();
      pendingMeta = null;

      if (!meta && upsertFiles.length === 0 && deletePaths.length === 0) return;
      await applyWorkspaceDelta({ meta: meta ?? undefined, upsertFiles, deletePaths }).catch(() => undefined);
    };

    const writeLegacyAutosaveBackup = () => {
      if (typeof window === 'undefined') return;
      try {
        const state = useProjectStore.getState();
        const payload = {
          projectName: state.projectName,
          stack: state.stack,
          description: state.description,
          activeFile: state.activeFile,
          files: state.files.map((file) => ({
            name: file.name || file.path,
            path: file.path || file.name,
            content: file.content || '',
            language: file.language
          }))
        };
        window.localStorage.setItem('apex-coding-autosave', JSON.stringify(payload));
      } catch {
        // ignore localStorage fallback errors
      }
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushNow();
      }, 650);
    };

    const scheduleBackup = () => {
      if (backupTimer) return;
      backupTimer = window.setTimeout(() => {
        backupTimer = null;
        writeLegacyAutosaveBackup();
      }, 150);
    };

    const prevSigs = new Map<string, string>();

    useProjectStore.subscribe((state) => {
      if (state.isHydrating) return;

      const nextMeta = {
        projectId: state.projectId,
        projectName: state.projectName,
        projectType: state.projectType,
        selectedFeatures: state.selectedFeatures,
        customFeatureTags: state.customFeatureTags,
        constraintsEnforcement: state.constraintsEnforcement,
        stack: state.stack,
        description: state.description,
        activeFile: state.activeFile,
        fileStructure: state.fileStructure
      };

      if (!pendingMeta) {
        pendingMeta = nextMeta;
      } else {
        pendingMeta = nextMeta;
      }

      const nextPaths = new Set<string>();
      for (const file of state.files) {
        const path = file.path || file.name;
        if (!path) continue;
        nextPaths.add(path);
        const sig = fileSig(file);
        if (prevSigs.get(path) !== sig) {
          prevSigs.set(path, sig);
          pendingUpserts.set(path, file);
          pendingDeletes.delete(path);
        }
      }

      for (const path of Array.from(prevSigs.keys())) {
        if (nextPaths.has(path)) continue;
        prevSigs.delete(path);
        pendingUpserts.delete(path);
        pendingDeletes.add(path);
      }

      scheduleFlush();
      scheduleBackup();
    });

    w.__APEX_WORKSPACE_PERSIST__ = {
      schedule: scheduleFlush,
      flush: async () => {
        if (backupTimer) {
          window.clearTimeout(backupTimer);
          backupTimer = null;
        }
        writeLegacyAutosaveBackup();
        await flushNow();
      }
    };

    if (!w.__APEX_WORKSPACE_PERSIST_EVENTS_BOUND__) {
      const flushWorkspaceOnExit = () => {
        try {
          // Intentionally fire-and-forget.
          void w.__APEX_WORKSPACE_PERSIST__?.flush?.();
        } catch {
          // ignore
        }
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushWorkspaceOnExit();
        }
      });
      window.addEventListener('pagehide', flushWorkspaceOnExit);
      window.addEventListener('beforeunload', flushWorkspaceOnExit);
      w.__APEX_WORKSPACE_PERSIST_EVENTS_BOUND__ = true;
    }
  }
}
