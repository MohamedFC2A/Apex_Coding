import React, { useEffect, useMemo, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { shallow } from 'zustand/shallow';
import { GlassCard } from './GlassCard';
import { FileTree } from './FileTree';
import { X, Play, Download } from 'lucide-react';
import { downloadService } from '@/services/downloadService';
import { usePreviewStore } from '@/stores/previewStore';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { useWebContainer } from '@/context/WebContainerContext';
import type * as monaco from 'monaco-editor';

interface CodeEditorProps {
  showFileTree?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ showFileTree = true }) => {
  const { 
    files, 
    activeFile, 
    setActiveFile, 
    updateFile, 
    projectName,
    isHydrating
  } = useProjectStore();

  const [isGenerating, streamText, modelMode, isPlanning, writingFilePath, setIsPreviewOpen] = useAIStore(
    (state) => [state.isGenerating, state.streamText, state.modelMode, state.isPlanning, state.writingFilePath, state.setIsPreviewOpen],
    shallow
  );
  
  const { addLog } = usePreviewStore();
  const { runProject } = useWebContainer();
  const [openTabs, setOpenTabs] = React.useState<string[]>([]);
  const [editorTheme, setEditorTheme] = React.useState<'vs-dark' | 'nord' | 'dracula'>('vs-dark');

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const currentFile = files.find(f => f.path === activeFile);
  const currentFileLanguage = currentFile
    ? currentFile.language || getLanguageFromExtension(currentFile.path || currentFile.name || '')
    : 'plaintext';
  const typingTimerRef = useRef<number | null>(null);
  const targetContentRef = useRef('');
  const [typedValue, setTypedValue] = React.useState('');

  useEffect(() => {
    if (!activeFile) return;
    setOpenTabs((prev) => (prev.includes(activeFile) ? prev : [...prev, activeFile]));
  }, [activeFile]);

  useEffect(() => {
    if (files.length === 0) return;
    const activeExists = Boolean(activeFile && files.some((file) => file.path === activeFile));
    if (activeExists) return;
    const firstFile = files[0];
    const nextPath = firstFile.path || firstFile.name;
    if (nextPath) setActiveFile(nextPath);
  }, [activeFile, files, setActiveFile]);

  const handleEditorDidMount: OnMount = React.useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define Nord theme
    monaco.editor.defineTheme('nord', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
        { token: 'keyword', foreground: '81a1c1' },
        { token: 'string', foreground: 'a3be8c' },
        { token: 'number', foreground: 'b48ead' },
        { token: 'type', foreground: '8fbcbb' },
        { token: 'function', foreground: '88c0d0' },
      ],
      colors: {
        'editor.background': '#2e3440',
        'editor.foreground': '#d8dee9',
        'editor.lineHighlightBackground': '#3b4252',
        'editor.selectionBackground': '#434c5e',
        'editorCursor.foreground': '#d8dee9',
      },
    });

    // Define Dracula theme
    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#44475a',
        'editor.selectionBackground': '#44475a',
      },
    });

    // Configure TypeScript
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });

    // Add format on save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (isGenerating) return;
    if (activeFile && value !== undefined) {
      updateFile(activeFile, value);
    }
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t !== path);
    setOpenTabs(newTabs);
    if (activeFile === path && newTabs.length > 0) {
      setActiveFile(newTabs[newTabs.length - 1]);
    }
  };

  const handleRun = async () => {
    if (files.length === 0) return;
    setIsPreviewOpen(true);
    addLog({
      timestamp: Date.now(),
      type: 'info',
      message: 'Booting WebContainer preview...'
    });

    try {
      await runProject();
    } catch (error: any) {
      addLog({
        timestamp: Date.now(),
        type: 'error',
        message: error?.message || 'Failed to start WebContainer'
      });
    }
  };

  const handleDownload = async () => {
    if (files.length === 0) return;
    try {
      await downloadService.downloadAsZip(files, projectName || 'nexus-project');
      addLog({
        timestamp: Date.now(),
        type: 'success',
        message: 'Project downloaded successfully!'
      });
    } catch (error: any) {
      addLog({
        timestamp: Date.now(),
        type: 'error',
        message: 'Failed to download project'
      });
    }
  };

  const isStreamingView = isGenerating && files.length === 0 && streamText.length > 0;
  const storeContent = currentFile?.content ?? '';

  useEffect(() => {
    targetContentRef.current = storeContent;
  }, [storeContent]);

  useEffect(() => {
    if (!currentFile) {
      setTypedValue('');
      return;
    }

    if (!isGenerating) {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setTypedValue(storeContent);
      return;
    }

    setTypedValue((prev) => (targetContentRef.current.startsWith(prev) ? prev : targetContentRef.current));

    if (!typingTimerRef.current) {
      typingTimerRef.current = window.setInterval(() => {
        setTypedValue((prev) => {
          const target = targetContentRef.current;
          if (prev === target) return prev;
          const step = 140;
          const nextBoundary = target.indexOf('\n', prev.length);
          const maxNext = Math.min(prev.length + step, target.length);
          const nextLen =
            nextBoundary !== -1 && nextBoundary < maxNext
              ? Math.min(nextBoundary + 1, target.length)
              : maxNext;
          return target.slice(0, nextLen);
        });
      }, 22);
    }

    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [activeFile, currentFile, isGenerating, storeContent]);

  const editorValue = useMemo(() => {
    if (isStreamingView) return streamText;
    if (!currentFile) return undefined;
    return isGenerating ? typedValue : storeContent;
  }, [currentFile, isGenerating, isStreamingView, storeContent, streamText, typedValue]);

  // ENHANCED OPTIONS - 100x better
  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    readOnly: isStreamingView,
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontLigatures: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    minimap: {
      enabled: true,
      side: 'right',
      showSlider: 'mouseover',
      renderCharacters: true,
      maxColumn: 120,
    },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: true,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    suggest: {
      showMethods: true,
      showFunctions: true,
      showConstructors: true,
      showFields: true,
      showVariables: true,
      showClasses: true,
      showKeywords: true,
      showSnippets: true,
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    parameterHints: {
      enabled: true,
      cycle: true,
    },
    hover: {
      enabled: true,
      delay: 300,
      sticky: true,
    },
    bracketPairColorization: {
      enabled: true,
    },
    guides: {
      bracketPairs: true,
      indentation: true,
      highlightActiveIndentation: true,
    },
    stickyScroll: {
      enabled: true,
      maxLineCount: 5,
    },
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full',
    formatOnPaste: true,
    formatOnType: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    trimAutoWhitespace: true,
    wordWrap: 'on',
    wrappingIndent: 'indent',
    rulers: [80, 120],
    cursorBlinking: 'smooth',
    smoothScrolling: true,
    mouseWheelZoom: true,
    multiCursorModifier: 'alt',
    padding: {
      top: 16,
      bottom: 16,
    },
    links: true,
    colorDecorators: true,
  };

  if (isHydrating && files.length === 0) {
    return (
      <GlassCard className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 p-4">
          <div className="h-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-2xl animate-pulse" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {showFileTree && (
          <div className="w-full md:w-64 min-h-0 border-b md:border-b-0 md:border-r border-white/10 glass-panel">
            <div className="p-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white/80">Files</h3>
            </div>
            <FileTree />
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center border-b border-white/10 glass-panel">
            <div className="flex-1 flex overflow-x-auto scrollbar-thin">
              {openTabs.map(path => (
                <div
                  key={path}
                  className={`flex items-center gap-2 px-4 py-2 border-r border-white/10 cursor-pointer transition-colors whitespace-nowrap ${
                    activeFile === path
                      ? 'bg-white/5 text-white/90'
                      : 'hover:bg-white/5'
                  }`}
                  onClick={() => setActiveFile(path)}
                >
                  <span className="text-sm truncate max-w-[150px]">
                    {path.split('/').pop()}
                  </span>
                  <X
                    className="w-3 h-3 hover:text-red-400 flex-shrink-0"
                    onClick={(e) => closeTab(path, e)}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 px-3">
              <button
                onClick={() => setEditorTheme(t => t === 'vs-dark' ? 'nord' : t === 'nord' ? 'dracula' : 'vs-dark')}
                className="glass-button px-3 py-1.5 rounded text-xs font-medium"
                title="Toggle theme"
              >
                {editorTheme === 'vs-dark' ? '🌙 Dark' : editorTheme === 'nord' ? '❄️ Nord' : '🧛 Dracula'}
              </button>
              <button
                onClick={handleRun}
                className="glass-button px-4 py-1.5 rounded flex items-center justify-center gap-2 text-sm"
                disabled={files.length === 0 || isGenerating || Boolean(writingFilePath)}
              >
                <Play className="w-5 h-5" />
                <span className="hidden sm:inline">Run</span>
              </button>
              <button
                onClick={handleDownload}
                className="glass-button px-4 py-1.5 rounded flex items-center justify-center gap-2 text-sm"
                disabled={files.length === 0}
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">ZIP</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden min-h-0">
            {isStreamingView || currentFile ? (
              <Editor
                height="100%"
                language={isStreamingView ? 'markdown' : currentFileLanguage}
                value={editorValue}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme={editorTheme}
                options={editorOptions}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
                  </div>
                }
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a file to edit</p>
              </div>
            )}
          </div>

          <div className="h-9 flex items-center justify-between px-3 border-t border-white/10 glass-panel">
            <div className="text-xs text-white/70">
              {isPlanning
                ? 'Creating plan…'
                : isGenerating
                  ? 'Generating…'
                  : 'Ready'}
            </div>
            <div className="text-xs text-white/50">
              {modelMode === 'thinking' ? '🧠 Thinking' : '⚡ Fast'} • {editorTheme}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
