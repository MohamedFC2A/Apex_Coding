import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { ProjectFile, FileStructure } from '@/types';

interface ProjectState {
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  fileStructure: FileStructure[];
  activeFile: string | null;
  stack: string;
  description: string;
  isHydrating: boolean;
  
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
  activeFile: null,
  stack: '',
  description: '',
  isHydrating: false
};

export const useProjectStore = createWithEqualityFn<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,
      
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
}
