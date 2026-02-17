import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { shallow } from 'zustand/shallow';
import { GlassCard } from './GlassCard';
import { FileTree } from './FileTree';
import { Play, Download, Sparkles, FolderOpen, X } from 'lucide-react';
import { downloadService } from '@/services/downloadService';
import { usePreviewStore } from '@/stores/previewStore';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import type * as monaco from 'monaco-editor';
import { useLanguage } from '@/context/LanguageContext';
import { useEditorAutoFollow } from '@/hooks/useEditorAutoFollow';
import { useStreamingEditorBridge } from '@/hooks/useStreamingEditorBridge';
import { LanguageIconBadge } from '@/components/files/LanguageIconBadge';
import { Content, Description, Heading, Popover, Trigger } from '@/components/ui/InstructionPopover';

interface CodeEditorProps {
  showFileTree?: boolean;
  isVisible?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ showFileTree = true, isVisible = true }) => {
  const { t, isRTL } = useLanguage();
  const { files, activeFile, setActiveFile, updateFile, projectName, isHydrating } = useProjectStore();

  const [isGenerating, streamText, modelMode, isPlanning, writingFilePath, setIsPreviewOpen] = useAIStore(
    (state) => [
      state.isGenerating,
      state.streamText,
      state.modelMode,
      state.isPlanning,
      state.writingFilePath,
      state.setIsPreviewOpen
    ],
    shallow
  );

  const { addLog } = usePreviewStore();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(false);
  const [isMobileExplorerOpen, setIsMobileExplorerOpen] = useState(false);
  const [svgSourcePath, setSvgSourcePath] = useState<string | null>(null);
  const [mountedEditor, setMountedEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [editorRenderValue, setEditorRenderValue] = useState('');

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const autoPickedNonEmptyRef = useRef(false);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);

  const { syncValueToEditor, resetBridge } = useStreamingEditorBridge();
  const { followState, notifyContentAppended } = useEditorAutoFollow(mountedEditor);

  const currentFile = files.find((f) => (f.path || f.name) === activeFile);
  const currentFilePath = currentFile?.path || currentFile?.name || '';
  const showSvgSource = Boolean(svgSourcePath && svgSourcePath === currentFilePath);
  const currentFileName = currentFilePath ? currentFilePath.split('/').pop() || currentFilePath : '';
  const isSvgFile = Boolean(currentFilePath && currentFilePath.toLowerCase().endsWith('.svg'));
  const currentFileLanguage = currentFile
    ? currentFile.language || getLanguageFromExtension(currentFile.path || currentFile.name || '')
    : 'plaintext';

  const isStreamingView =
    isGenerating &&
    streamText.length > 0 &&
    (!currentFile || (currentFile.content || '').length === 0);

  const sourceEditorValue = isStreamingView ? streamText : currentFile?.content ?? '';

  const isActiveWritingFile = Boolean(
    writingFilePath &&
      currentFilePath &&
      writingFilePath === currentFilePath
  );

  const tabPaths = useMemo(() => {
    const unique = Array.from(new Set(files.map((f) => f.path || f.name).filter(Boolean)));
    if (!activeFile || !unique.includes(activeFile)) return unique;
    return [activeFile, ...unique.filter((p) => p !== activeFile)];
  }, [files, activeFile]);
  const nonEmptyFileCandidates = useMemo(
    () =>
      files.filter((file) => {
        const path = (file.path || file.name || '').toLowerCase();
        const content = String(file.content || '');
        if (content.trim().length === 0) return false;
        if (path.startsWith('backend/')) return false;
        if (!/\.(html?|css|js|jsx|ts|tsx|json|md|svg)$/i.test(path)) return false;
        return true;
      }),
    [files]
  );
  const isCurrentFileEmpty = Boolean(currentFile && String(currentFile.content || '').trim().length === 0);

  const lineCount = useMemo(() => {
    const content = currentFile?.content || '';
    if (!content) return 0;
    return content.split('\n').length;
  }, [currentFile?.content]);

  const charCount = useMemo(() => (currentFile?.content || '').length, [currentFile?.content]);
  const modeLabel = useMemo(() => {
    if (modelMode === 'thinking') return t('app.mode.thinking');
    return t('app.mode.fast');
  }, [modelMode, t]);
  const svgDataUrl = useMemo(() => {
    if (!isSvgFile || !currentFile?.content) return '';
    const raw = String(currentFile.content || '').trim();
    if (!raw.includes('<svg')) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  }, [currentFile, isSvgFile]);
  const shouldRenderSvgPreview = Boolean(
    isSvgFile &&
    !isStreamingView &&
    !isActiveWritingFile &&
    !showSvgSource &&
    svgDataUrl
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const isMobile = media.matches;
      setIsMobileViewport(isMobile);
      setIsCompactMobile(isMobile && window.innerHeight <= 760);
      if (!isMobile) setIsMobileExplorerOpen(false);
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  useEffect(() => {
    if (files.length === 0) return;
    const activeExists = Boolean(activeFile && files.some((file) => (file.path || file.name) === activeFile));
    if (activeExists) return;
    const preferredFile =
      files.find((file) => {
        const path = (file.path || file.name || '').toLowerCase();
        return path.includes('frontend/index.html');
      }) ||
      files.find((file) => {
        const path = (file.path || file.name || '').toLowerCase();
        return path.endsWith('/index.html') || path === 'index.html';
      }) ||
      nonEmptyFileCandidates[0] ||
      files[0];
    const nextPath = preferredFile.path || preferredFile.name;
    if (nextPath) setActiveFile(nextPath);
  }, [activeFile, files, nonEmptyFileCandidates, setActiveFile]);

  useEffect(() => {
    if (autoPickedNonEmptyRef.current) return;
    if (!currentFile) return;
    const shouldSwitchFromBackend = currentFilePath.toLowerCase().startsWith('backend/');
    if (!shouldSwitchFromBackend && !isCurrentFileEmpty) return;
    if (nonEmptyFileCandidates.length === 0) return;
    const best = nonEmptyFileCandidates[0];
    const bestPath = best.path || best.name;
    if (!bestPath || bestPath === currentFilePath) return;
    autoPickedNonEmptyRef.current = true;
    setActiveFile(bestPath);
  }, [currentFile, currentFilePath, isCurrentFileEmpty, nonEmptyFileCandidates, setActiveFile]);

  useEffect(() => {
    if (!mountedEditor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditorRenderValue(sourceEditorValue);
      return;
    }

    const isLiveAppendMode = Boolean(isGenerating && isActiveWritingFile && !isStreamingView);
    if (isLiveAppendMode) {
      const changed = syncValueToEditor(mountedEditor, sourceEditorValue, { preferIncremental: true });
      if (changed) notifyContentAppended();
      return;
    }

    setEditorRenderValue(sourceEditorValue);
    syncValueToEditor(mountedEditor, sourceEditorValue, { preferIncremental: false });
    resetBridge(sourceEditorValue);
  }, [
    isActiveWritingFile,
    isGenerating,
    isStreamingView,
    mountedEditor,
    notifyContentAppended,
    resetBridge,
    sourceEditorValue,
    syncValueToEditor
  ]);

  useEffect(() => {
    if (!mountedEditor || !isVisible) return;
    const raf1 = window.requestAnimationFrame(() => {
      mountedEditor.layout();
    });
    const raf2 = window.requestAnimationFrame(() => {
      mountedEditor.layout();
    });
    const timer = window.setTimeout(() => {
      mountedEditor.layout();
    }, 120);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [activeFile, isVisible, mountedEditor]);

  useEffect(() => {
    if (!mountedEditor || !isVisible) return;
    const host = editorViewportRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      mountedEditor.layout();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [isVisible, mountedEditor]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMountedEditor(editor);

    monaco.editor.setTheme('vs-dark');

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.React
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  };

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      readOnly: isGenerating && (isStreamingView || isActiveWritingFile),
      automaticLayout: true,
      fontSize: isMobileViewport ? 16 : 15,
      lineHeight: isMobileViewport ? 24 : 21,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: isMobileViewport ? 'on' : 'on',
      lineNumbersMinChars: isMobileViewport ? 3 : 4,
      glyphMargin: false,
      folding: true,
      renderWhitespace: 'selection',
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      scrollBeyondLastColumn: 3,
      minimap: {
        enabled: !isMobileViewport && !isStreamingView,
        side: 'right',
        showSlider: 'always',
        renderCharacters: false,
        maxColumn: 80
      },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'hidden',
        useShadows: true,
        verticalScrollbarSize: isMobileViewport ? 10 : 12,
        horizontalScrollbarSize: 0
      },
      formatOnPaste: true,
      formatOnType: false,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'bounded',
      wordWrapColumn: isMobileViewport ? 64 : 110,
      wrappingIndent: 'indent',
      wrappingStrategy: 'advanced',
      smoothScrolling: true,
      padding: { top: isMobileViewport ? 12 : 10, bottom: isMobileViewport ? 14 : 10 },
      bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
        highlightActiveBracketPair: true
      },
      stickyScroll: { enabled: !isMobileViewport, maxLineCount: 4 },
      contextmenu: true
    }),
    [isActiveWritingFile, isGenerating, isMobileViewport, isStreamingView]
  );

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    if (isGenerating && isActiveWritingFile) return;
    setEditorRenderValue(value);
    if (activeFile) updateFile(activeFile, value);
  };

  const handleRun = () => {
    if (files.length === 0) return;
    setIsPreviewOpen(true);
    addLog({ timestamp: Date.now(), type: 'info', message: 'Opening preview...' });
  };

  const handleDownload = async () => {
    if (files.length === 0) return;
    try {
      await downloadService.downloadAsZip(files, projectName || 'apex-project');
      addLog({ timestamp: Date.now(), type: 'success', message: 'Project downloaded successfully!' });
    } catch {
      addLog({ timestamp: Date.now(), type: 'error', message: 'Failed to download project' });
    }
  };

  if (isHydrating && files.length === 0) {
    return (
      <GlassCard className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 p-4">
          <div className="h-full rounded-xl border border-cyan-500/10 bg-cyan-500/5 backdrop-blur-2xl animate-pulse flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <p className="text-cyan-500/60 font-medium">{t('app.editor.loading')}</p>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`h-full min-h-0 flex flex-col overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className={`flex-1 min-h-0 flex ${isRTL ? 'flex-col md:flex-row-reverse' : 'flex-col md:flex-row'}`}>
        {showFileTree && !isMobileViewport && (
          <aside className={`w-64 min-h-0 border-b md:border-b-0 ${isRTL ? 'md:border-l' : 'md:border-r'} border-white/10 bg-black/25`}>
            <div className={`h-11 px-3 border-b border-white/10 flex items-center ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/75">{t('app.sidebar.files')}</h3>
            </div>
            <FileTree />
          </aside>
        )}

        <section className="flex-1 flex flex-col min-h-0 relative">
          {showFileTree && isMobileViewport && (
            <>
              <div className="h-10 px-3 border-b border-white/10 bg-black/20 flex items-center justify-between gap-2">
                <Popover>
                  <Trigger>
                    <button
                      type="button"
                      onClick={() => setIsMobileExplorerOpen(true)}
                      className="h-8 px-3 rounded-md border border-white/15 bg-white/5 text-white/85 text-xs font-semibold inline-flex items-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {t('app.sidebar.files')}
                    </button>
                  </Trigger>
                  <Content>
                    <Heading>Files</Heading>
                    <Description>Open project files. On mobile, hold to view this help and release to hide.</Description>
                  </Content>
                </Popover>
                <div className="text-xs text-white/70 truncate max-w-[55vw] inline-flex items-center gap-2">
                  {currentFilePath ? <LanguageIconBadge size="sm" language={currentFileLanguage} /> : null}
                  <span>{currentFileName || t('app.editor.title')}</span>
                </div>
              </div>

              {isMobileExplorerOpen && (
                <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm">
                  <div className={`h-full w-[82%] max-w-[320px] bg-[#0b0f17] border-white/10 ${isRTL ? 'ml-auto border-l' : 'border-r'}`}>
                    <div className="h-11 px-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">{t('app.sidebar.files')}</span>
                      <button
                        type="button"
                        onClick={() => setIsMobileExplorerOpen(false)}
                        className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-white/70 inline-flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <FileTree />
                  </div>
                </div>
              )}
            </>
          )}

          <div
            className={`border-b border-white/10 bg-black/20 flex items-center gap-2 px-2 ${
              isMobileViewport ? 'h-9' : 'h-11'
            } ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <Popover>
              <Trigger>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={files.length === 0 || isGenerating || Boolean(writingFilePath)}
                  className={`rounded-md border border-white/15 bg-white/5 text-white/85 text-xs font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMobileViewport ? 'h-8 w-8 justify-center px-0' : 'h-8 px-3 gap-2'
                  }`}
                  title="Run project"
                >
                  <Play className="w-4 h-4" />
                  {!isMobileViewport ? t('app.editor.run') : null}
                </button>
              </Trigger>
              <Content>
                <Heading>Run Preview</Heading>
                <Description>Builds and opens the live preview for your current files.</Description>
              </Content>
            </Popover>

            <Popover>
              <Trigger>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={files.length === 0}
                  className={`rounded-md border border-white/15 bg-white/5 text-white/85 text-xs font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMobileViewport ? 'h-8 w-8 justify-center px-0' : 'h-8 px-3 gap-2'
                  }`}
                  title="Download ZIP"
                >
                  <Download className="w-4 h-4" />
                  {!isMobileViewport ? t('app.editor.download') : null}
                </button>
              </Trigger>
              <Content>
                <Heading>Download</Heading>
                <Description>Export the full project as a ZIP archive.</Description>
              </Content>
            </Popover>
          </div>

          <div
            className={`border-b border-white/10 bg-black/10 flex items-center overflow-x-auto scrollbar-thin ${
              isMobileViewport ? 'h-8' : 'h-10'
            } ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
              {tabPaths.map((path) => {
                const active = activeFile === path;
                const lang = getLanguageFromExtension(path);
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setActiveFile(path)}
                    className={`h-full whitespace-nowrap border-r border-white/8 transition-colors inline-flex items-center gap-2 ${
                      isMobileViewport ? 'px-2 text-[10.5px]' : 'px-3 text-xs'
                    } ${
                      active ? 'text-cyan-300 bg-cyan-400/10' : 'text-white/55 hover:text-white/85 hover:bg-white/5'
                    }`}
                  >
                    <LanguageIconBadge size="sm" language={lang} />
                    <span className={isMobileViewport ? 'max-w-[110px] truncate' : ''}>{path.split('/').pop()}</span>
                  </button>
                );
              })}
          </div>

          <div className="flex-1 overflow-hidden min-h-0 bg-[#0a0a0f] relative">
            {shouldRenderSvgPreview ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-4">
                <div className="text-xs uppercase tracking-[0.12em] text-white/55 font-semibold">SVG Visual</div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-6 max-w-full max-h-[60%] overflow-auto">
                  <img
                    src={svgDataUrl}
                    alt={currentFileName || 'SVG preview'}
                    className="max-w-full max-h-[240px] md:max-h-[320px] object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSvgSourcePath(currentFilePath)}
                  className="h-8 px-3 rounded-md border border-white/20 bg-white/10 text-white/80 text-xs font-semibold hover:bg-white/15"
                >
                  View SVG Code
                </button>
              </div>
            ) : isStreamingView || currentFile ? (
              <>
                {isCurrentFileEmpty && nonEmptyFileCandidates.length > 0 ? (
                  <div className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2">
                    <div className="text-[11px] font-semibold text-amber-100/90">
                      Current file is empty. Open a file with code:
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {nonEmptyFileCandidates.slice(0, 3).map((candidate) => {
                        const path = candidate.path || candidate.name || '';
                        return (
                          <button
                            key={path}
                            type="button"
                            onClick={() => setActiveFile(path)}
                            className="h-7 px-2 rounded-md border border-white/20 bg-black/40 text-[11px] text-white/90"
                          >
                            {path.split('/').pop()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {isSvgFile && svgDataUrl && !isStreamingView && !isActiveWritingFile && showSvgSource ? (
                  <div className="absolute top-3 right-3 z-20">
                    <button
                      type="button"
                      onClick={() => setSvgSourcePath(null)}
                      className="h-8 px-3 rounded-md border border-white/20 bg-black/55 text-white/80 text-xs font-semibold hover:bg-black/70"
                    >
                      Show SVG Visual
                    </button>
                  </div>
                ) : null}
                <div
                  ref={editorViewportRef}
                  className="h-full w-full min-h-0"
                  style={isMobileViewport ? { minHeight: isCompactMobile ? 260 : 300 } : undefined}
                >
                  <Editor
                    height="100%"
                    language={isStreamingView ? 'markdown' : currentFileLanguage}
                    value={editorRenderValue}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={editorOptions}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                      </div>
                    }
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/25 gap-4 text-center px-6">
                <div className="w-20 h-20 rounded-2xl bg-cyan-500/8 border border-white/10 flex items-center justify-center">
                  <Sparkles size={34} className="text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white/80">{t('app.editor.welcome')}</h3>
                  <p className="text-sm text-white/45 mt-1">{t('app.editor.welcomeDesc')}</p>
                </div>
              </div>
            )}
          </div>

          <div
            className={`px-3 border-t border-white/10 bg-black/20 flex items-center justify-between ${
              isMobileViewport ? (isCompactMobile ? 'h-7' : 'h-8') : 'h-9'
            } ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className="text-xs text-white/70">
              {isPlanning
                ? `${t('app.plan.status.working')}...`
                : isGenerating
                  ? `${t('app.plan.status.working')}...`
                  : t('app.editor.ready')}
            </div>
            <div className={`text-xs text-white/55 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMobileViewport ? <span>{t('app.status.line')} {lineCount}</span> : null}
              {!isMobileViewport ? <span className="opacity-30">•</span> : null}
              {!isMobileViewport ? <span>{charCount} {t('app.status.chars')}</span> : null}
              {isMobileViewport ? <span className="truncate max-w-[100px]">{currentFileName || t('app.editor.title')}</span> : null}
              <span className="opacity-30">•</span>
              <span className={followState.mode === 'following' ? 'text-emerald-300/85' : 'text-amber-300/85'}>
                {followState.mode === 'following' ? 'Auto-follow' : 'Paused follow'}
              </span>
              <span className="opacity-30">•</span>
              <span className="text-cyan-300/80 font-semibold">{modeLabel}</span>
            </div>
          </div>
        </section>
      </div>
    </GlassCard>
  );
};
