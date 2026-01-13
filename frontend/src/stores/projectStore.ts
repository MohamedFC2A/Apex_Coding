import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { ProjectFile, FileStructure, FileSystem } from '@/types';
import { applyWorkspaceDelta, clearWorkspace, loadWorkspace } from '@/utils/workspaceDb';

interface ProjectState {
  projectId: string;
  projectName: string;
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
  setFiles: (files: ProjectFile[]) => void;
  setFileStructure: (structure: FileStructure[]) => void;
  setActiveFile: (path: string) => void;
  setIsHydrating: (isHydrating: boolean) => void;
  updateFile: (path: string, content: string) => void;
  upsertFile: (file: ProjectFile) => void;
  appendToFile: (path: string, chunk: string) => void;
  addFile: (file: ProjectFile) => void;
  deleteFile: (path: string) => void;
  setStack: (stack: string) => void;
  setDescription: (description: string) => void;
  reset: () => void;
}

const initialState = {
  projectId: '',
  projectName: '',
  files: [],
  fileStructure: [],
  fileSystem: {},
  activeFile: null,
  stack: '',
  description: '',
  isHydrating: false
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

            const fileStructure = loaded.meta?.fileStructure?.length
              ? loaded.meta.fileStructure
              : restoredFiles.map((f) => ({ path: f.path || f.name, type: 'file' as const }));

            set({
              projectId: loaded.meta?.projectId ?? current.projectId,
              projectName: loaded.meta?.projectName ?? current.projectName,
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
                const legacyMeta = {
                  projectId: current.projectId || '',
                  projectName: String(parsed?.projectName || current.projectName || ''),
                  stack: String(parsed?.stack || current.stack || ''),
                  description: String(parsed?.description || current.description || ''),
                  activeFile: String(parsed?.activeFile || current.activeFile || '') || null,
                  fileStructure: legacyFiles.map((f) => ({ path: f.path || f.name, type: 'file' as const }))
                };

                await applyWorkspaceDelta({ meta: legacyMeta, upsertFiles: legacyFiles });

                set({
                  projectName: legacyMeta.projectName,
                  stack: legacyMeta.stack,
                  description: legacyMeta.description,
                  activeFile: legacyMeta.activeFile ?? legacyFiles[0]?.path ?? null,
                  files: legacyFiles,
                  fileStructure: legacyMeta.fileStructure
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
      },
       
      setProjectId: (id) => set({ projectId: id }),
      
      setProjectName: (name) => set({ projectName: name }),
      
      setFiles: (files) => set({ files }),
      
      setFileStructure: (structure) => set({ fileStructure: structure }),
      
      setActiveFile: (path) => set({ activeFile: path }),

      setIsHydrating: (isHydrating) => set({ isHydrating }),
      
      updateFile: (path, content) => set((state) => ({
        files: state.files.map(file =>
          file.path === path ? { ...file, content } : file
        )
      })),

      upsertFile: (file) =>
        set((state) => {
          const path = file.path || file.name;
          if (!path) return state;
          const exists = state.files.some((f) => (f.path || f.name) === path);
          if (exists) {
            return {
              files: state.files.map((f) => ((f.path || f.name) === path ? { ...f, ...file, path } : f))
            };
          }
          return { files: [...state.files, { ...file, path }] };
        }),

      appendToFile: (path, chunk) =>
        set((state) => ({
          files: state.files.map((file) =>
            (file.path || file.name) === path
              ? { ...file, content: (file.content || '') + chunk, path }
              : file
          )
        })),
      
      addFile: (file) => set((state) => ({
        files: [...state.files, file]
      })),
      
      deleteFile: (path) => set((state) => ({
        files: state.files.filter(file => file.path !== path),
        activeFile: state.activeFile === path ? null : state.activeFile
      })),
      
      setStack: (stack) => set({ stack }),
      
      setDescription: (description) => set({ description }),
      
      reset: () => set(initialState)
    }),
    {
      name: 'apex-project-store',
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
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
    const pendingUpserts = new Map<string, ProjectFile>();
    const pendingDeletes = new Set<string>();
    let pendingMeta: {
      projectId: string;
      projectName: string;
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

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushNow();
      }, 650);
    };

    const prevSigs = new Map<string, string>();

    useProjectStore.subscribe((state) => {
      if (state.isHydrating) return;

      const nextMeta = {
        projectId: state.projectId,
        projectName: state.projectName,
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
    });

    w.__APEX_WORKSPACE_PERSIST__ = {
      schedule: scheduleFlush,
      flush: flushNow
    };
  }
}
