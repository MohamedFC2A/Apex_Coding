import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, Eye, EyeOff, Github, Menu, X } from 'lucide-react';

import { useAIStore } from './stores/aiStore';
import { useProjectStore } from './stores/projectStore';
import { usePreviewStore } from './stores/previewStore';
import { aiService } from './services/aiService';
import { createProjectJSONStreamRouter } from './services/projectStreamRouter';
import { getLanguageFromExtension } from './utils/stackDetector';
import { ProjectFile } from './types';

import { CodeEditor } from './components/CodeEditor';
import { Sidebar } from './components/Sidebar';

import { PromptInput } from './components/ui/PromptInput';
import { ModeToggle } from './components/ui/ModeToggle';
import { ArchitectToggle } from './components/ui/ArchitectToggle';
import { MainActionButton, MainActionState } from './components/ui/MainActionButton';
import { PreviewWindow } from './components/ui/PreviewWindow';
import { BrainConsole } from './components/ui/BrainConsole';
import { Content, Description, Heading, Popover, Trigger } from './components/ui/InstructionPopover';
import { GlobalStyles } from './styles/GlobalStyles';
import { useWebContainer } from './context/WebContainerContext';

const Root = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: radial-gradient(900px 500px at 20% 10%, rgba(34, 211, 238, 0.12), transparent 55%),
    radial-gradient(900px 500px at 80% 85%, rgba(168, 85, 247, 0.12), transparent 55%),
    #0d1117;
  color: rgba(255, 255, 255, 0.92);
`;

const Container = styled.div`
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  min-height: 0;

  @media (max-width: 768px) {
    padding-bottom: 190px;
  }
`;

const HeaderArea = styled.div`
  flex-shrink: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BrandStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.05;
`;

const BrandTitle = styled.div`
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
`;

const BrandSubtitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.55);
`;

const BrandAccent = styled.span`
  color: rgba(250, 204, 21, 0.92);
`;

const StatusPill = styled.div<{ $active?: boolean }>`
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.92)' : 'rgba(255, 255, 255, 0.62)')};
  font-size: 12px;
  white-space: nowrap;
`;

const MobileMenuButton = styled.button`
  display: none;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: rgba(168, 85, 247, 0.22);
    background: rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 768px) {
    display: inline-flex;
  }
`;

const PreviewToggleButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: rgba(34, 211, 238, 0.24);
    background: rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const RepoButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: rgba(168, 85, 247, 0.28);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const MobileTabs = styled.div`
  display: none;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 6px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  gap: 6px;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileTabButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  height: 38px;
  border-radius: 14px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.22)' : 'rgba(255, 255, 255, 0.08)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.10)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.66)')};
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    border-color: rgba(168, 85, 247, 0.22);
    background: rgba(255, 255, 255, 0.05);
  }
`;

const InputArea = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
`;

const MainWorkspace = styled.div<{ $previewOpen: boolean }>`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: ${(p) =>
    p.$previewOpen ? '260px minmax(0, 1fr) minmax(0, 1fr)' : '260px minmax(0, 1fr)'};
  grid-template-rows: 1fr;
  gap: 14px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0;
    position: relative;
  }
`;

const DesktopSidebar = styled.div`
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 260px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: none;
  }
`;

const DrawerScrim = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 10, 0.6);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 180ms ease;
  z-index: 55;

  @media (min-width: 769px) {
    display: none;
  }
`;

const DrawerPanel = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(340px, 88vw);
  background: rgba(10, 12, 18, 0.92);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 18px 0 40px rgba(0, 0, 0, 0.6);
  transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
  transition: transform 220ms ease;
  z-index: 56;
  display: flex;
  flex-direction: column;
  padding: 12px;

  @media (min-width: 769px) {
    display: none;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
`;

const DrawerTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
`;

const DrawerClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: rgba(168, 85, 247, 0.22);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const PanelSlot = styled.div<{ $mobileActive?: boolean; $desktopHidden?: boolean }>`
  min-height: 0;
  min-width: 0;
  height: 100%;

  @media (min-width: 769px) {
    display: ${(p) => (p.$desktopHidden ? 'none' : 'block')};
  }

  @media (max-width: 768px) {
    position: absolute;
    inset: 0;
    opacity: ${(p) => (p.$mobileActive ? 1 : 0)};
    pointer-events: ${(p) => (p.$mobileActive ? 'auto' : 'none')};
    transition: opacity 160ms ease;
  }
`;

const ErrorToast = styled.div`
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: min(820px, calc(100vw - 28px));
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(239, 68, 68, 0.32);
  background: rgba(239, 68, 68, 0.10);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: rgba(255, 255, 255, 0.90);
  z-index: 60;
`;

function App() {
  const {
    prompt,
    architectMode,
    modelMode,
    interactionMode,
    isGenerating,
    isPlanning,
    thinkingContent,
    systemConsoleContent,
    isPreviewOpen,
    setPrompt,
    setIsGenerating,
    setInteractionMode,
    setSections,
    setStreamText,
    updateLastToken,
    clearThinkingContent,
    appendThinkingContent,
    clearSystemConsoleContent,
    appendSystemConsoleContent,
    setPlanSteps,
    generatePlan,
    clearFileStatuses,
    setFileStatus,
    setWritingFilePath,
    resetFiles,
    resolveFilePath,
    upsertFileNode,
    appendToFileNode,
    setFilesFromProjectFiles,
    addChatMessage,
    error,
    setError,
    setIsPreviewOpen
  } = useAIStore();
  const { deployAndRun } = useWebContainer();

  const {
    files,
    activeFile,
    reset: resetProject,
    setFiles,
    setFileStructure,
    setActiveFile,
    updateFile,
    upsertFile,
    appendToFile,
    setStack,
    setDescription,
    setProjectId,
    setProjectName
  } = useProjectStore();
  const { setPreviewUrl, addLog } = usePreviewStore();

  const [thinkingStatus, setThinkingStatus] = useState('');
  const [brainOpen, setBrainOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [resumeInfo, setResumeInfo] = useState<{ lastFilePath: string; streamTail: string } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const fileFlushTimerRef = useRef<number | null>(null);
  const fileChunkBuffersRef = useRef<Map<string, string>>(new Map());
  const tokenBeatTimerRef = useRef<number | null>(null);
  const reasoningFlushTimerRef = useRef<number | null>(null);
  const reasoningBufferRef = useRef('');
  const streamTailRef = useRef('');
  const lastCompletedFileRef = useRef('');

  const mainActionState = useMemo<MainActionState>(() => {
    if (isPlanning) return 'planning';
    if (isGenerating) return 'coding';
    if (files.length > 0) return 'done';
    return 'idle';
  }, [files.length, isGenerating, isPlanning]);

  const isConsoleVisible = true;

  useEffect(() => {
    if (isGenerating) return;

    let changed = false;
    const normalized = files.map((file) => {
      const rawPath = file.path || file.name || '';
      const resolvedPath = resolveFilePath(rawPath) || rawPath;
      if (resolvedPath !== rawPath) changed = true;
      return {
        ...file,
        name: file.name || resolvedPath.split('/').pop() || resolvedPath,
        path: resolvedPath
      };
    });

    if (changed) {
      setFiles(normalized);
      setFileStructure(normalized.map((file) => ({ path: file.path || file.name, type: 'file' as const })));
      if (activeFile) {
        const resolvedActive = resolveFilePath(activeFile) || activeFile;
        if (resolvedActive !== activeFile) setActiveFile(resolvedActive);
      }
      return;
    }

    setFilesFromProjectFiles(files);
  }, [
    activeFile,
    files,
    isGenerating,
    resolveFilePath,
    setActiveFile,
    setFileStructure,
    setFiles,
    setFilesFromProjectFiles
  ]);

  useEffect(() => {
    if (files.length > 0) return;
    if (interactionMode !== 'edit') return;
    setInteractionMode('create');
  }, [files.length, interactionMode, setInteractionMode]);

  const flushFileBuffers = useCallback(() => {
    if (fileChunkBuffersRef.current.size === 0) return;
    const entries = Array.from(fileChunkBuffersRef.current.entries());
    fileChunkBuffersRef.current.clear();
    for (const [path, chunk] of entries) {
      appendToFile(path, chunk);
      appendToFileNode(path, chunk);
    }
  }, [appendToFile, appendToFileNode]);

  const scheduleFileFlush = useCallback(() => {
    if (fileFlushTimerRef.current) return;
    fileFlushTimerRef.current = window.setTimeout(() => {
      fileFlushTimerRef.current = null;
      flushFileBuffers();
    }, 60);
  }, [flushFileBuffers]);

  const scheduleTokenBeat = useCallback(() => {
    if (tokenBeatTimerRef.current) return;
    tokenBeatTimerRef.current = window.setTimeout(() => {
      tokenBeatTimerRef.current = null;
      updateLastToken();
    }, 120);
  }, [updateLastToken]);

  const flushReasoningBuffer = useCallback(() => {
    if (reasoningBufferRef.current.length === 0) return;
    const chunk = reasoningBufferRef.current;
    reasoningBufferRef.current = '';
    appendThinkingContent(chunk);
  }, [appendThinkingContent]);

  const scheduleReasoningFlush = useCallback(() => {
    if (reasoningFlushTimerRef.current) return;
    reasoningFlushTimerRef.current = window.setTimeout(() => {
      reasoningFlushTimerRef.current = null;
      flushReasoningBuffer();
    }, 80);
  }, [flushReasoningBuffer]);

  const handleGenerate = useCallback(async (
    promptOverride?: string,
    options?: { skipPlanning?: boolean; preserveProjectMeta?: boolean }
  ) => {
    const rawPrompt = (promptOverride ?? prompt).trim();
    if (!rawPrompt || isPlanning || isGenerating) return;

    const resumeRequested = /^(continue|resume|go on)\b/i.test(rawPrompt);
    const canResume = resumeRequested && Boolean(resumeInfo?.streamTail || resumeInfo?.lastFilePath);

    const basePrompt = canResume
      ? [
          'Continue the previous generation WITHOUT rewriting files already produced.',
          resumeInfo?.lastFilePath ? `Last completed file received was: ${resumeInfo.lastFilePath}` : '',
          resumeInfo?.streamTail
            ? `The stream ended mid-JSON. Continue and COMPLETE the JSON starting from this tail (may be truncated):\n${resumeInfo.streamTail}`
            : '',
          'Return ONLY a single valid JSON object with the same schema: {"project_files":[{"name":"...","content":"..."}], "metadata": {...}, "instructions":"..."}.'
        ]
          .filter(Boolean)
          .join('\n\n')
      : rawPrompt;

    const skipPlanning = canResume || options?.skipPlanning === true;
    const preserveProjectMeta = canResume || options?.preserveProjectMeta === true;

    if (architectMode && !skipPlanning) {
      const currentPlanSteps = useAIStore.getState().planSteps;
      const currentPlannedPrompt = useAIStore.getState().lastPlannedPrompt;

      if (currentPlanSteps.length === 0 || currentPlannedPrompt !== basePrompt) {
        await generatePlan(basePrompt);
      }

      const stepsNow = useAIStore.getState().planSteps;
      if (stepsNow.length === 0) {
        setError('Failed to generate a plan. Try toggling Architect Mode off for direct generation.');
        return;
      }
    }

    setIsPreviewOpen(true);
    setIsGenerating(true);
    setError(null);
    setPreviewUrl(null);
    setSections({});
    setStreamText('');
    clearThinkingContent();
    clearSystemConsoleContent();
    appendSystemConsoleContent('[webcontainer] Waiting for code generation to finish...\n');
    setBrainOpen(false);
    setThinkingStatus('Initializing…');
    setResumeInfo(null);
    streamTailRef.current = '';
    lastCompletedFileRef.current = '';
    clearFileStatuses();
    setWritingFilePath(null);
    if (!preserveProjectMeta) resetProject();
    if (!preserveProjectMeta) resetFiles();

    if (fileFlushTimerRef.current) {
      window.clearTimeout(fileFlushTimerRef.current);
      fileFlushTimerRef.current = null;
    }
    fileChunkBuffersRef.current.clear();

    if (tokenBeatTimerRef.current) {
      window.clearTimeout(tokenBeatTimerRef.current);
      tokenBeatTimerRef.current = null;
    }

    if (reasoningFlushTimerRef.current) {
      window.clearTimeout(reasoningFlushTimerRef.current);
      reasoningFlushTimerRef.current = null;
    }
    reasoningBufferRef.current = '';

    if (architectMode && !skipPlanning) {
      const stepsNow = useAIStore.getState().planSteps;
      if (stepsNow.length > 0) setPlanSteps(stepsNow.map((s) => ({ ...s, completed: false })));
    }

    try {
      let generationSucceeded = false;
      const filePathMap = new Map<string, string>();
      const resolveGeneratedPath = (rawPath: string) => {
        if (filePathMap.has(rawPath)) return filePathMap.get(rawPath) as string;
        const normalized = resolveFilePath(rawPath);
        const finalPath = normalized || rawPath;
        filePathMap.set(rawPath, finalPath);
        return finalPath;
      };
      const router = createProjectJSONStreamRouter({
        onFileDiscovered: (path) => {
          const resolvedPath = resolveGeneratedPath(path);
          upsertFileNode(resolvedPath);
          const name = resolvedPath.split('/').pop() || resolvedPath;
          const exists = useProjectStore.getState().files.some((f) => (f.path || f.name) === resolvedPath);
          if (!exists) {
            upsertFile({ name, path: resolvedPath, content: '', language: getLanguageFromExtension(resolvedPath) });
          }
        },
        onFileStatus: (path, status) => {
          const resolvedPath = resolveGeneratedPath(path);
          setFileStatus(resolvedPath, status);
          if (status === 'writing') {
            flushFileBuffers();
            fileChunkBuffersRef.current.delete(resolvedPath);
            updateFile(resolvedPath, '');
            upsertFileNode(resolvedPath, '');
            setWritingFilePath(resolvedPath);
            setActiveFile(resolvedPath);
            setMobileTab('editor');
          }
        },
        onFileChunk: (path, chunk) => {
          const resolvedPath = resolveGeneratedPath(path);
          fileChunkBuffersRef.current.set(
            resolvedPath,
            (fileChunkBuffersRef.current.get(resolvedPath) || '') + chunk
          );
          scheduleFileFlush();
        },
        onFileComplete: (path) => {
          const resolvedPath = resolveGeneratedPath(path);
          lastCompletedFileRef.current = resolvedPath;

          if (!useAIStore.getState().architectMode) return;
          const next = useAIStore.getState().planSteps.find((s) => !s.completed);
          if (next) useAIStore.getState().setPlanStepCompleted(next.id, true);
        }
      });

      let reasoningChars = 0;
      const isThinkingMode = modelMode === 'thinking';
      let openedBrain = false;

      await aiService.generateCodeStream(
        basePrompt,
        (token) => {
          streamTailRef.current = (streamTailRef.current + token).slice(-8000);
          router.push(token);
          scheduleTokenBeat();
        },
        (phase, message) => {
          if (phase === 'thinking') setThinkingStatus('Thinking…');
          else if (phase === 'streaming') setThinkingStatus('Generating…');
          else if (phase === 'validating') setThinkingStatus('Validating…');
          else if (phase === 'done') setThinkingStatus('Complete');
          else setThinkingStatus(message);
        },
        (meta) => {
          if (meta?.model) {
            addLog({ timestamp: Date.now(), type: 'info', message: `Model: ${meta.model}` });
          }
          if (meta?.checkpoint?.lastCompletedFilePath) {
            lastCompletedFileRef.current = String(meta.checkpoint.lastCompletedFilePath);
          }
        },
        (payload) => {
          if (payload?.metadata?.partial) {
            flushFileBuffers();
            if (fileFlushTimerRef.current) {
              window.clearTimeout(fileFlushTimerRef.current);
              fileFlushTimerRef.current = null;
            }

            setResumeInfo({
              lastFilePath: lastCompletedFileRef.current,
              streamTail: streamTailRef.current
            });
            setError('Stream ended before valid JSON completed. Click Resume or type "continue".');
            addLog({ timestamp: Date.now(), type: 'error', message: 'Partial JSON received (checkpoint mode).' });
            setIsGenerating(false);
            setThinkingStatus('');
            generationSucceeded = false;
            return;
          }

          flushFileBuffers();
          if (fileFlushTimerRef.current) {
            window.clearTimeout(fileFlushTimerRef.current);
            fileFlushTimerRef.current = null;
          }
          const data = payload;
          const convertedFiles: ProjectFile[] = (data.project_files || []).map((file: any) => {
            const rawPath = file.name || file.path || '';
            const resolvedPath = resolveFilePath(rawPath);
            const name = resolvedPath.split('/').pop() || resolvedPath;
            return {
              name,
              path: resolvedPath,
              content: file.content,
              language: getLanguageFromExtension(resolvedPath)
            };
          });

          setFiles(convertedFiles);
          setFileStructure(
            convertedFiles.map((file) => ({ path: file.path || file.name, type: 'file' as const }))
          );
          setFilesFromProjectFiles(convertedFiles);
          setStack(data.metadata?.language || 'Unknown');
          setDescription(data.instructions || 'Generated by NEXUS AI CODING');

          if (!preserveProjectMeta) {
            const projectId = `project-${Date.now()}`;
            const projectName = (basePrompt || 'project').slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
            setProjectId(projectId);
            setProjectName(projectName);
          }

          if (architectMode && !skipPlanning && useAIStore.getState().planSteps.length > 0) {
            const finalSteps = useAIStore.getState().planSteps.map((s) => ({ ...s, completed: true }));
            useAIStore.getState().setPlanSteps(finalSteps);
          }

          for (const file of convertedFiles) {
            const filePath = file.path || file.name;
            if (filePath) setFileStatus(filePath, 'ready');
          }
          setWritingFilePath(null);
          setIsGenerating(false);
          setThinkingStatus('');
          generationSucceeded = true;
          setResumeInfo(null);

        },
        (err) => {
          flushFileBuffers();
          const message = typeof err === 'string' ? err : 'Generation failed';
          setError(message);
          addLog({ timestamp: Date.now(), type: 'error', message: `Generation failed: ${String(err)}` });

          if (/json|parse|truncat|abort|timeout/i.test(message)) {
            setResumeInfo({
              lastFilePath: lastCompletedFileRef.current,
              streamTail: streamTailRef.current
            });
          }

          setIsGenerating(false);
          setThinkingStatus('');
        },
        (chunk) => {
          reasoningChars += chunk.length;
          reasoningBufferRef.current += chunk;
          scheduleReasoningFlush();
          if (!openedBrain) {
            openedBrain = true;
            setBrainOpen(true);
          }
          if (!isThinkingMode) return;
          if (reasoningChars < 500) setThinkingStatus('Thinking…');
          else if (reasoningChars < 2000) setThinkingStatus('Deep thinking…');
          else setThinkingStatus('Reasoning…');
        },
        () => {
          flushFileBuffers();
          flushReasoningBuffer();
          setIsGenerating(false);
          setThinkingStatus('');
          if (generationSucceeded) {
            appendSystemConsoleContent('[webcontainer] Code Complete. Writing to Container...\n');
            setTimeout(() => {
              void deployAndRun();
            }, 0);
          }
        },
        { thinkingMode: isThinkingMode, architectMode, includeReasoning: isThinkingMode }
      );
    } catch (e: any) {
      flushFileBuffers();
      flushReasoningBuffer();
      setError(e?.message || 'Failed to generate code');
      setIsGenerating(false);
      setThinkingStatus('');
    }
  }, [
    architectMode,
    addLog,
    appendThinkingContent,
    clearThinkingContent,
    clearFileStatuses,
    deployAndRun,
    flushFileBuffers,
    flushReasoningBuffer,
    generatePlan,
    isGenerating,
    isPlanning,
    modelMode,
    prompt,
    resetProject,
    resetFiles,
    resolveFilePath,
    scheduleFileFlush,
    scheduleReasoningFlush,
    scheduleTokenBeat,
    setActiveFile,
    setDescription,
    setError,
    setFileStatus,
    setFileStructure,
    setFiles,
    setFilesFromProjectFiles,
    setIsGenerating,
    setIsPreviewOpen,
    setPreviewUrl,
    setPlanSteps,
    setProjectId,
    setProjectName,
    setSections,
    setStack,
    setStreamText,
    setThinkingStatus,
    setWritingFilePath,
    updateFile,
    upsertFile,
    upsertFileNode,
    resumeInfo
  ]);

  const buildFixPrompt = useCallback(
    (request: string) => {
      const entries = files
        .map((file) => ({
          path: file.path || file.name || '',
          content: file.content || ''
        }))
        .filter((f) => f.path.length > 0);

      const activePath = activeFile || '';
      entries.sort((a, b) => {
        if (a.path === activePath) return -1;
        if (b.path === activePath) return 1;
        return a.path.localeCompare(b.path);
      });

      const truncate = (text: string, max: number) => {
        if (text.length <= max) return text;
        return `${text.slice(0, max)}\n\n[TRUNCATED]`;
      };

      let total = 0;
      const maxTotal = 22000;
      const lines: string[] = [];

      for (const file of entries) {
        const isActive = file.path === activePath;
        const maxPer = isActive ? 9000 : 2800;
        const chunk = truncate(file.content, maxPer);
        total += chunk.length;
        if (total > maxTotal) break;
        lines.push(`--- ${file.path} ---\n${chunk}\n`);
      }

      return [
        'You are editing an existing project. Apply the requested change and return the FULL updated JSON object.',
        'Keep the same project structure unless the request requires changes.',
        '',
        `EDIT REQUEST: ${request}`,
        '',
        'CURRENT PROJECT FILES:',
        lines.join('\n'),
        '',
        'Return ONLY valid JSON.'
      ].join('\n');
    },
    [activeFile, files]
  );

  const handleMainActionClick = useCallback(() => {
    if (mainActionState === 'done') {
      if (interactionMode !== 'edit') {
        setInteractionMode('edit');
        setPrompt('');
        requestAnimationFrame(() => promptRef.current?.focus());
        return;
      }

      const request = prompt.trim();
      if (!request) {
        requestAnimationFrame(() => promptRef.current?.focus());
        return;
      }

      addChatMessage({ role: 'user', content: request });
      setPrompt('');

      const fixPrompt = buildFixPrompt(request);
      handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
      return;
    }
    handleGenerate();
  }, [
    addChatMessage,
    buildFixPrompt,
    handleGenerate,
    interactionMode,
    mainActionState,
    prompt,
    setInteractionMode,
    setPrompt
  ]);

  return (
    <>
      <GlobalStyles />
      <Root>
      {error && (
        <ErrorToast>
          <AlertCircle size={18} style={{ marginTop: 1, color: 'rgba(248,113,113,0.95)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>Error</div>
            <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>{error}</div>
          </div>
          {resumeInfo && (
            <button
              type="button"
              onClick={() => void handleGenerate('continue', { skipPlanning: true, preserveProjectMeta: true })}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.88)',
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 800,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
            }}
            style={{
              border: 0,
              background: 'transparent',
              color: 'rgba(255,255,255,0.65)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </ErrorToast>
      )}

      <Container>
        <HeaderArea>
          <HeaderLeft>
            <BrandStack>
              <BrandTitle>NEXUS AI</BrandTitle>
              <BrandSubtitle>
                A <BrandAccent>Matany</BrandAccent> Product
              </BrandSubtitle>
            </BrandStack>
            <StatusPill $active={isGenerating}>{isGenerating ? thinkingStatus || 'Working…' : 'Ready'}</StatusPill>
          </HeaderLeft>
          <HeaderRight>
            <RepoButton
              type="button"
              title="Repo Linked: MohamedFC2A/nexus-apex-coding"
              aria-label="Open GitHub repository"
              onClick={() => window.open('https://github.com/MohamedFC2A/nexus-apex-coding', '_blank', 'noopener,noreferrer')}
            >
              <Github size={18} />
            </RepoButton>
            <PreviewToggleButton
              type="button"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              aria-label={isPreviewOpen ? 'Hide preview' : 'Show preview'}
            >
              {isPreviewOpen ? <EyeOff size={18} /> : <Eye size={18} />}
            </PreviewToggleButton>
            <MobileMenuButton type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={18} />
            </MobileMenuButton>
          </HeaderRight>
        </HeaderArea>

        <InputArea>
          <PromptInput
            ref={promptRef}
            controls={
              <>
                <Popover>
                  <Trigger>
                    <ArchitectToggle />
                  </Trigger>
                  <Content>
                    <Heading>Architect Mode</Heading>
                    <Description>Generate a step-by-step implementation plan, then execute it.</Description>
                  </Content>
                </Popover>
                <Popover>
                  <Trigger>
                    <ModeToggle />
                  </Trigger>
                  <Content>
                    <Heading>Mode</Heading>
                    <Description>Switch between Fast generation and DeepSeek Reasoner “Thinking” mode.</Description>
                  </Content>
                </Popover>
                <Popover>
                  <Trigger>
                    <MainActionButton
                      state={mainActionState}
                      onClick={handleMainActionClick}
                      disabled={
                        (mainActionState === 'idle' && !prompt.trim()) ||
                        (mainActionState === 'done' && interactionMode === 'edit' && !prompt.trim())
                      }
                    />
                  </Trigger>
                  <Content>
                    <Heading>{mainActionState === 'done' ? 'Fix / Edit' : 'Generate'}</Heading>
                    <Description>
                      {mainActionState === 'done'
                        ? interactionMode === 'edit'
                          ? 'Describe what you want to change and apply it with full context.'
                          : 'Switch to Edit mode to apply changes with full project context.'
                        : architectMode
                          ? 'Plan then write code.'
                          : 'Write code immediately.'}
                    </Description>
                  </Content>
                </Popover>
              </>
            }
          />
        </InputArea>

        <MobileTabs role="tablist" aria-label="Workspace tabs">
          <MobileTabButton type="button" $active={mobileTab === 'editor'} onClick={() => setMobileTab('editor')}>
            Editor
          </MobileTabButton>
          <MobileTabButton type="button" $active={mobileTab === 'preview'} onClick={() => setMobileTab('preview')}>
            Preview
          </MobileTabButton>
        </MobileTabs>

        <MainWorkspace $previewOpen={isPreviewOpen}>
          <DesktopSidebar>
            <Sidebar />
          </DesktopSidebar>
          <PanelSlot $mobileActive={mobileTab === 'editor'}>
            <CodeEditor showFileTree={false} />
          </PanelSlot>
          <PanelSlot $mobileActive={mobileTab === 'preview'} $desktopHidden={!isPreviewOpen}>
            <PreviewWindow />
          </PanelSlot>
        </MainWorkspace>
      </Container>

      <DrawerScrim $open={sidebarOpen} onClick={() => setSidebarOpen(false)} />
      <DrawerPanel $open={sidebarOpen} aria-hidden={!sidebarOpen}>
        <DrawerHeader>
          <DrawerTitle>Workspace</DrawerTitle>
          <DrawerClose type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={16} />
          </DrawerClose>
        </DrawerHeader>
        <Sidebar />
      </DrawerPanel>

      <BrainConsole
        visible={isConsoleVisible}
        open={brainOpen}
        onToggle={() => setBrainOpen((v) => !v)}
        thought={thinkingContent}
        status={thinkingStatus}
        error={error}
        logs={systemConsoleContent}
      />
      </Root>
    </>
  );
}

export default App;
