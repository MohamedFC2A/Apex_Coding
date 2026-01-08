import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useWebContainer } from '@/context/WebContainerContext';

interface UseFileWatcherOptions {
  enabled?: boolean;
  debounceMs?: number;
  onFileChange?: (path: string) => void;
}

export const useFileWatcher = (options: UseFileWatcherOptions = {}) => {
  const { enabled = true, debounceMs = 500, onFileChange } = options;
  const { files } = useProjectStore();
  const { runProject } = useWebContainer();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousFilesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    // Build current files map
    const currentFiles = new Map<string, string>();
    files.forEach((file) => {
      const key = file.path || file.name;
      if (key) {
        currentFiles.set(key, file.content || '');
      }
    });

    // Detect changes
    const changedPaths: string[] = [];
    currentFiles.forEach((content, path) => {
      const previousContent = previousFilesRef.current.get(path);
      if (previousContent !== undefined && previousContent !== content) {
        changedPaths.push(path);
      }
    });

    // Update reference
    previousFilesRef.current = currentFiles;

    // If files changed, debounce reload
    if (changedPaths.length > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        changedPaths.forEach((path) => {
          onFileChange?.(path);
        });
        
        // Trigger WebContainer reload
        runProject().catch((error) => {
          console.error('File watcher reload failed:', error);
        });
      }, debounceMs);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [files, enabled, debounceMs, onFileChange, runProject]);

  return {
    isWatching: enabled,
  };
};
