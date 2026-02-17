import { useCallback, useRef } from 'react';
import type * as monaco from 'monaco-editor';

type SyncOptions = {
  preferIncremental?: boolean;
};

export const useStreamingEditorBridge = () => {
  const lastValueRef = useRef('');

  const resetBridge = useCallback((value = '') => {
    lastValueRef.current = value;
  }, []);

  const syncValueToEditor = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor | null, nextValue: string, options: SyncOptions = {}) => {
      if (!editor) return false;
      const model = editor.getModel();
      if (!model) return false;

      const preferIncremental = options.preferIncremental !== false;
      const current = model.getValue();
      if (current === nextValue) {
        lastValueRef.current = nextValue;
        return false;
      }

      if (preferIncremental && nextValue.startsWith(current)) {
        const appendChunk = nextValue.slice(current.length);
        if (appendChunk.length > 0) {
          const lastLine = model.getLineCount();
          const lastColumn = model.getLineMaxColumn(lastLine);
          model.pushEditOperations(
            [],
            [
              {
                range: {
                  startLineNumber: lastLine,
                  startColumn: lastColumn,
                  endLineNumber: lastLine,
                  endColumn: lastColumn
                },
                text: appendChunk
              }
            ],
            () => null
          );
          lastValueRef.current = nextValue;
          return true;
        }
      }

      model.setValue(nextValue);
      lastValueRef.current = nextValue;
      return true;
    },
    []
  );

  return {
    lastValueRef,
    resetBridge,
    syncValueToEditor
  };
};
