import React, { useEffect, useMemo, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { shallow } from 'zustand/shallow';
import { GlassCard } from './GlassCard';
import { FileTree } from './FileTree';
import { X, Play, Download, Sparkles } from 'lucide-react';
import { downloadService } from '@/services/downloadService';
import { usePreviewStore } from '@/stores/previewStore';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import type * as monaco from 'monaco-editor';
import { useLanguage } from '@/context/LanguageContext';

interface CodeEditorProps {
  showFileTree?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ showFileTree = true }) => {
  const { t, isRTL } = useLanguage();
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
  const [openTabs, setOpenTabs] = React.useState<string[]>([]);
  const [editorTheme, setEditorTheme] = React.useState<'vs-dark' | 'nord' | 'dracula' | 'apex-gold'>('apex-gold');

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

    // Define Apex Gold theme (User's request)
    monaco.editor.defineTheme('apex-gold', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'F59E0B', fontStyle: 'bold' },
        { token: 'string', foreground: 'FFFFFF' },
        { token: 'number', foreground: 'FCD34D' },
        { token: 'type', foreground: 'F59E0B' },
        { token: 'function', foreground: 'FFFFFF', fontStyle: 'bold' },
        { token: 'variable', foreground: 'E5E7EB' },
        { token: 'operator', foreground: 'F59E0B' }
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#E5E7EB',
        'editor.lineHighlightBackground': '#1F2937',
        'editor.selectionBackground': '#F59E0B33',
        'editorCursor.foreground': '#F59E0B',
        'editorLineNumber.foreground': '#4B5563', 
        'editorLineNumber.activeForeground': '#F59E0B',
        'editor.selectionHighlightBackground': '#F59E0B11',
        'scrollbarSlider.background': '#F59E0B22',
        'scrollbarSlider.hoverBackground': '#F59E0B44',
        'scrollbarSlider.activeBackground': '#F59E0B66'
      },
    });

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

    monaco.editor.setTheme('apex-gold');

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

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme('apex-gold');
    }
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
      message: 'Opening preview...'
    });
  };

  const handleDownload = async () => {
    if (files.length === 0) return;
    try {
      await downloadService.downloadAsZip(files, projectName || 'apex-project');
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

  // Auto-scroll to bottom during generation
  useEffect(() => {
    if (isGenerating && editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        const lastColumn = model.getLineMaxColumn(lastLine);
        editor.revealPosition(
          { lineNumber: lastLine, column: lastColumn },
          0 // Smooth scrolling
        );
      }
    }
  }, [typedValue, isGenerating]);

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
          <div className="h-full rounded-xl border border-cyan-500/10 bg-cyan-500/5 backdrop-blur-2xl animate-pulse flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <p className="text-cyan-500/60 font-medium">{t('app.editor.loading')}</p>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`h-full flex flex-col overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className={`flex-1 min-h-0 flex ${isRTL ? 'flex-col md:flex-row-reverse' : 'flex-col md:flex-row'}`}>
        {showFileTree && (
          <div className={`w-full md:w-64 min-h-0 border-b md:border-b-0 ${isRTL ? 'md:border-l' : 'md:border-r'} border-white/10 glass-panel`}>
            <div className={`p-3 border-b border-white/10 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h3 className="text-sm font-semibold text-white/80">{t('app.sidebar.files')}</h3>
            </div>
            <FileTree />
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`flex items-center border-b border-white/10 glass-panel ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex items-center gap-2 px-3 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>

              <button
                onClick={() => setEditorTheme(t => t === 'vs-dark' ? 'nord' : t === 'nord' ? 'dracula' : 'vs-dark')}
                className="glass-button px-3 py-1.5 rounded text-xs font-medium"
                title="Toggle theme"
              >
                {editorTheme === 'vs-dark' ? '🌙' : editorTheme === 'nord' ? '❄️' : '🧛'}
              </button>
              <button
                onClick={handleRun}
                className="glass-button px-3 py-1.5 rounded flex items-center justify-center gap-2 text-sm font-semibold"
                disabled={files.length === 0 || isGenerating || Boolean(writingFilePath)}
                title="Run project (Ctrl/Cmd + R)"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">{t('app.editor.run')}</span>
              </button>
              <button
                onClick={handleDownload}
                className="glass-button px-3 py-1.5 rounded flex items-center justify-center gap-2 text-sm font-semibold"
                disabled={files.length === 0}
                title="Download as ZIP"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('app.editor.download')}</span>
              </button>
            </div>
            
            <div className={`flex-1 flex overflow-x-auto scrollbar-thin min-w-0 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              {openTabs.map(path => (
                <div
                  key={path}
                  className={`flex items-center gap-2 px-3 py-2 border-r border-white/5 cursor-pointer transition-all duration-200 whitespace-nowrap min-w-0 ${
                    activeFile === path
                      ? 'bg-white/10 text-cyan-400 border-b-2 border-b-cyan-500 shadow-[inset_0_-10px_20px_rgba(34,211,238,0.05)]'
                      : 'hover:bg-white/5 text-white/40 hover:text-white/70'
                  }`}
                  onClick={() => setActiveFile(path)}
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <span className="text-sm truncate max-w-[120px]">
                    {path.split('/').pop()}
                  </span>
                  <X
                    className="w-3 h-3 hover:text-red-400 flex-shrink-0"
                    onClick={(e) => closeTab(path, e)}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden min-h-0 bg-[#0D1117]/50 backdrop-blur-sm relative">
            {isStreamingView || currentFile ? (
              <Editor
                height="100%"
                language={isStreamingView ? 'markdown' : currentFileLanguage}
                value={editorValue}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme={editorTheme}
                options={{
                  ...editorOptions,
                  theme: 'vs-dark' // Force dark theme for better glass integration
                }}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/20 gap-6 text-center px-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.1)] backdrop-blur-xl">
                  <Sparkles size={40} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white/80 tracking-wide">{t('app.editor.welcome')}</h3>
                  <p className="text-sm leading-relaxed max-w-xs text-white/40">
                    {t('app.editor.welcomeDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={`h-9 flex items-center justify-between px-3 border-t border-white/10 glass-panel ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="text-xs text-white/70 font-medium tracking-wide">
              {isPlanning
                ? t('app.plan.status.working') + '...'
                : isGenerating
                  ? t('app.plan.status.working') + '...'
                  : t('app.editor.ready')}
            </div>
            <div className={`text-xs text-white/50 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="text-cyan-400/80 font-semibold shadow-cyan-500/20 drop-shadow-sm">{modelMode === 'thinking' ? t('app.mode.thinking') : t('app.mode.fast')}</span>
              <span className="opacity-30">•</span>
              <span>{editorTheme}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
