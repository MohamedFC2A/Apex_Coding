'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import { Search, Folder, File, X, Code2, Save } from 'lucide-react';

import { useAIStore, useProjectStore, useEditorStore } from '@/stores';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  language?: string;
  children?: FileNode[];
}

interface SuperEditorHandle {
  saveAll: () => Promise<void>;
  formatCode: () => void;
}

export const SuperEditor = forwardRef<SuperEditorHandle>((props, ref) => {
  const { files, addFile, updateFile, deleteFile } = useProjectStore();
  const { appendThinkingContent } = useAIStore();
  const { 
    openFiles, 
    activeFileId, 
    openFile,
    closeFile,
    settings
  } = useEditorStore();

  const [editor, setEditor] = useState<any>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const editorRef = useRef<any>(null);

  const saveCurrentFile = useCallback(async () => {
    if (!editor || !activeFileId) return;
    
    const content = editor.getValue();
    updateFile(activeFileId, content);
  }, [editor, activeFileId, updateFile]);

  useEffect(() => {
    const buildFileTree = (files: any[]): FileNode[] => {
      const tree: FileNode[] = [];
      const map = new Map();

      files.forEach((file: any) => {
        const parts = file.path.split('/');
        let currentPath = '';
        let currentLevel = tree;

        parts.forEach((part: string, index: number) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isLastPart = index === parts.length - 1;
          const isFile = isLastPart && file.content !== undefined;

          if (!map.has(currentPath)) {
            const node: FileNode = {
              id: currentPath,
              name: part,
              type: isFile ? 'file' : 'folder',
              path: currentPath,
              content: file.content,
              language: getFileLanguage(part),
              children: isFile ? undefined : []
            };
            map.set(currentPath, node);
            currentLevel.push(node);
          }

          const node = map.get(currentPath);
          if (!isLastPart && node.children) {
            currentLevel = node.children;
          }
        });
      });

      return tree;
    };

    setFileTree(buildFileTree(files));
  }, [files]);

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    setEditor(editor);

    editor.updateOptions({
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers,
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentFile();
    });
  }, [settings, saveCurrentFile]);

  const formatCode = useCallback(() => {
    if (!editor) return;
    editor.getAction('editor.action.formatDocument')?.run();
  }, [editor]);

  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      openFiles.forEach((file: any) => {
        if (file.content) {
          updateFile(file.id, file.content);
        }
      });
    },
    formatCode
  }), [openFiles, updateFile, formatCode]);

  const activeFile = openFiles.find((f: any) => f.id === activeFileId);

  return (
    <div className="flex h-full bg-gray-950">
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center">
            <Folder className="w-4 h-4 mr-2 text-cyan-400" />
            Explorer
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {fileTree.map(node => (
            <div key={node.id} className="flex items-center px-2 py-1 text-gray-400 hover:text-white cursor-pointer">
              <File className="w-4 h-4 mr-2" />
              <span className="text-sm">{node.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto">
          {openFiles.map((file: any) => (
            <div
              key={file.id}
              className={`flex items-center px-3 py-2 border-r border-gray-800 cursor-pointer ${
                file.id === activeFileId ? 'bg-gray-800 text-white' : 'text-gray-400'
              }`}
              onClick={() => openFile(file.id)}
            >
              <File className="w-4 h-4 mr-2" />
              <span className="text-sm">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
                className="ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex-1 relative">
          {activeFile ? (
            <Editor
              height="100%"
              language={activeFile.language || 'plaintext'}
              value={activeFile.content || ''}
              theme="vs-dark"
              onChange={(value) => {
                if (value !== undefined) {
                  updateFile(activeFile.id, value);
                }
              }}
              onMount={handleEditorDidMount}
              options={{
                readOnly: false,
                minimap: { enabled: settings.minimap },
                fontSize: settings.fontSize,
                wordWrap: settings.wordWrap,
                lineNumbers: settings.lineNumbers,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Code2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No file selected</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-1 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="save-status">Ready</span>
              {activeFile && (
                <>
                  <span>{activeFile.language}</span>
                  <span>Ln {editor?.getPosition()?.lineNumber}, Col {editor?.getPosition()?.column}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={formatCode}
                className="hover:text-white transition-colors"
              >
                Format
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});


const getFileLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
  };
  return langMap[ext || ''] || 'plaintext';
};

SuperEditor.displayName = 'SuperEditor';