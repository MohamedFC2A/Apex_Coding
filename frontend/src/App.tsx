import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, History, ListTodo, Menu, X, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { SubscriptionIndicator } from './components/SubscriptionIndicator';

import { useAIStore } from './stores/aiStore';
import { useProjectStore } from './stores/projectStore';
import { usePreviewStore } from './stores/previewStore';
import { aiService } from './services/aiService';
import { getLanguageFromExtension } from './utils/stackDetector';

import { CodeEditor } from './components/CodeEditor';
import { Sidebar } from './components/Sidebar';
import { SidebarHistory } from './components/SidebarHistory';

import { PromptInput } from './components/ui/PromptInput';
import { ModeToggle } from './components/ui/ModeToggle';
import { ArchitectToggle } from './components/ui/ArchitectToggle';
import { MainActionButton, MainActionState } from './components/ui/MainActionButton';
import { PreviewWindow } from './components/ui/PreviewWindow';
import { BrainConsole } from './components/ui/BrainConsole';
import { PlanChecklist } from './components/ui/PlanChecklist';
import { Content, Description, Heading, Popover, Trigger } from './components/ui/InstructionPopover';
import { GlobalStyles } from './styles/GlobalStyles';
import { useWebContainer } from './context/WebContainerContext';

const Root = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: 
    radial-gradient(ellipse 1200px 600px at 15% 5%, rgba(34, 211, 238, 0.08), transparent 60%),
    radial-gradient(ellipse 1000px 500px at 85% 90%, rgba(168, 85, 247, 0.08), transparent 60%),
    linear-gradient(180deg, #0d1117 0%, #0a0d12 100%);
  color: rgba(255, 255, 255, 0.94);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
`;

const Container = styled.div`
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  padding-bottom: calc(20px + 40px);
  min-height: 0;
  max-width: 100%;

  @media (max-width: 1024px) {
    padding: 16px;
    padding-bottom: calc(16px + 40px);
    gap: 14px;
  }

  @media (max-width: 768px) {
    padding: 12px;
    padding-bottom: calc(12px + 44px);
    gap: 12px;
  }
`;

const HeaderArea = styled.div`
  flex-shrink: 0;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

  @media (max-width: 768px) {
    height: 64px;
    padding: 0 16px;
    gap: 12px;
  }
`;

const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;

  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 768px) {
    gap: 8px;
  }
`;

const HeaderIconButton = styled.button`
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(168, 85, 247, 0.15));
    opacity: 0;
    transition: opacity 200ms ease;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.20);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    color: rgba(255, 255, 255, 1);

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

const OverlayScrim = styled.button<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  border: 0;
  padding: 0;
  margin: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 220ms ease;
  z-index: 55;
`;

const OverlayPanel = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 80px;
  right: 20px;
  width: min(440px, calc(100vw - 40px));
  max-height: calc(100vh - 160px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(10, 10, 10, 0.70);
  backdrop-filter: blur(28px);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;
  transform: ${(p) => (p.$open ? 'translateY(0)' : 'translateY(-12px)')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 220ms ease, transform 220ms ease;
  z-index: 56;

  @media (max-width: 768px) {
    top: 70px;
    right: 12px;
    left: 12px;
    width: auto;
    border-radius: 18px;
  }
`;

const OverlayHeader = styled.div`
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.88);
`;

const OverlayBody = styled.div`
  height: calc(100% - 48px);
  overflow: hidden;
`;

const FloatingPlanWrap = styled.div<{ $open: boolean }>`
  position: fixed;
  right: 20px;
  bottom: 70px;
  width: min(380px, calc(100vw - 40px));
  max-height: 50vh;
  z-index: 54;

  ${(p) =>
    !p.$open &&
    `
      width: auto;
      max-height: none;
    `}

  @media (max-width: 768px) {
    right: 12px;
    bottom: 70px;
  }
`;

const FloatingPlanPanel = styled.div`
  position: relative;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(28px);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: -80px;
    background: radial-gradient(280px 160px at 20% 20%, rgba(34, 211, 238, 0.18), transparent 60%),
      radial-gradient(300px 180px at 80% 60%, rgba(168, 85, 247, 0.16), transparent 60%);
    filter: blur(24px);
    opacity: 0.9;
    pointer-events: none;
  }
`;

const FloatingPlanHeader = styled.button`
  position: relative;
  z-index: 1;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  border: 0;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 900;
  transition: background 200ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.20);
  }
`;

const FloatingPlanBody = styled.div`
  position: relative;
  z-index: 1;
  height: calc(50vh - 46px);
  max-height: calc(50vh - 46px);
  overflow: hidden;
`;

const FloatingPlanToggle = styled.button`
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(28px);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: all 200ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.22);
    transform: translateY(-2px);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
`;

const BrandStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.05;
`;

const BrandTitle = styled.div`
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 13px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(168, 85, 247, 0.95));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const BrandSubtitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.50);
`;

const StatusPill = styled.div<{ $active?: boolean }>`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.95)' : 'rgba(255, 255, 255, 0.65)')};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 200ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.20);
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: rgba(168, 85, 247, 0.30);
    background: rgba(255, 255, 255, 0.10);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    display: inline-flex;
  }
`;

const MobileTabs = styled.div`
  display: none;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileTabButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  height: 40px;
  border-radius: 12px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.30)' : 'rgba(255, 255, 255, 0.10)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)')};
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: rgba(168, 85, 247, 0.30);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const InputArea = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding-top: 8px;

  @media (max-width: 768px) {
    gap: 10px;
    padding-top: 4px;
  }
`;

const MainWorkspace = styled.div<{ $previewOpen: boolean }>`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: ${(p) =>
    p.$previewOpen ? '280px minmax(0, 1fr) minmax(0, 1fr)' : '280px minmax(0, 1fr)'};
  grid-template-rows: 1fr;
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: ${(p) =>
      p.$previewOpen ? '240px minmax(0, 1fr) minmax(0, 1fr)' : '240px minmax(0, 1fr)'};
    gap: 14px;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0;
    position: relative;
  }
`;

const IDEFooter = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 36px;
  display: grid;
  place-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 12, 16, 0.95);
  backdrop-filter: blur(20px);
  color: rgba(255, 255, 255, 0.50);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  z-index: 40;
  pointer-events: none;

  @media (max-width: 768px) {
    height: 40px;
    font-size: 10px;
  }
`;

const DesktopSidebar = styled.div`
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 280px;
  flex-shrink: 0;

  @media (max-width: 1024px) {
    width: 240px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const DrawerScrim = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 10, 0.75);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 260ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 55;
  backdrop-filter: blur(8px);

  @media (min-width: 769px) {
    display: none;
  }
`;

const DrawerPanel = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(380px, 92vw);
  background: rgba(10, 12, 18, 0.98);
  border-right: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 24px 0 60px rgba(0, 0, 0, 0.75);
  transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
  transition: transform 260ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 56;
  display: flex;
  flex-direction: column;
  padding: 16px;

  @media (min-width: 769px) {
    display: none;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 14px;
`;

const DrawerTitle = styled.div`
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
`;

const DrawerClose = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: rgba(168, 85, 247, 0.30);
    background: rgba(255, 255, 255, 0.10);
    transform: translateY(-1px);
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
    transition: opacity 200ms ease;
  }
`;

const ErrorToast = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: min(900px, calc(100vw - 40px));
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  backdrop-filter: blur(24px);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: rgba(255, 255, 255, 0.95);
  z-index: 60;
  box-shadow: 0 12px 40px rgba(239, 68, 68, 0.25);
`;

function App() {
  const {
    prompt,
    architectMode,
    modelMode,
    interactionMode,
    isGenerating,
    isPlanning,
    lastTokenAt,
    planSteps,
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
    projectName,
    stack,
    description,
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
  const { setPreviewUrl, addLog, logs, runtimeStatus, runtimeMessage } = usePreviewStore();

  const [thinkingStatus, setThinkingStatus] = useState('');
  const [brainOpen, setBrainOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const fileFlushTimerRef = useRef<number | null>(null);
  const fileChunkBuffersRef = useRef<Map<string, string>>(new Map());
  const tokenBeatTimerRef = useRef<number | null>(null);
  const reasoningFlushTimerRef = useRef<number | null>(null);
  const reasoningBufferRef = useRef('');
  const streamCharCountRef = useRef(0);
  const streamLastLogAtRef = useRef(0);
  const autoDebugRef = useRef<{ signature: string; attempts: number }>({ signature: '', attempts: 0 });

  const mainActionState = useMemo<MainActionState>(() => {
    if (isPlanning) return 'planning';
    if (isGenerating) return 'coding';
    if (files.length > 0) return 'done';
    return 'idle';
  }, [files.length, isGenerating, isPlanning]);

  const currentPlanStepId = useMemo(() => planSteps.find((step) => !step.completed)?.id, [planSteps]);

  const isConsoleVisible = true;

  const systemHealth = useMemo(() => {
    const now = Date.now();
    const tokenGapMs = lastTokenAt > 0 ? now - lastTokenAt : 0;
    const streamOk = !isGenerating || (lastTokenAt > 0 && tokenGapMs < 8000);
    const previewOk = runtimeStatus !== 'error';

    if (!streamOk) return 'DEGRADED: stream stalled';
    if (!previewOk) return `DEGRADED: preview ${runtimeMessage || 'error'}`;
    return 'OK';
  }, [isGenerating, lastTokenAt, runtimeMessage, runtimeStatus]);

  const stamp = () => new Date().toLocaleTimeString([], { hour12: false });
  const logSystem = useCallback(
    (message: string) => {
      appendSystemConsoleContent(`${stamp()} ${message}\n`);
    },
    [appendSystemConsoleContent]
  );

  useEffect(() => {
    if (!architectMode) return;
    if (planSteps.length === 0) return;
    setPlanOpen(true);
  }, [architectMode, planSteps.length]);

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

    const writingPath = useAIStore.getState().writingFilePath || '';
    const maxActive = 120;
    const maxOther = 420;

    for (const [path, buffer] of fileChunkBuffersRef.current.entries()) {
      if (!buffer) {
        fileChunkBuffersRef.current.delete(path);
        continue;
      }

      const max = path === writingPath ? maxActive : maxOther;
      const chunk = buffer.length <= max ? buffer : buffer.slice(0, max);
      const rest = buffer.length <= max ? '' : buffer.slice(max);

      appendToFile(path, chunk);
      appendToFileNode(path, chunk);

      if (rest.length === 0) fileChunkBuffersRef.current.delete(path);
      else fileChunkBuffersRef.current.set(path, rest);
    }

    if (fileChunkBuffersRef.current.size > 0 && !fileFlushTimerRef.current) {
      fileFlushTimerRef.current = window.setTimeout(() => {
        fileFlushTimerRef.current = null;
        flushFileBuffers();
      }, 24);
    }
  }, [appendToFile, appendToFileNode]);

  const scheduleFileFlush = useCallback(() => {
    if (fileFlushTimerRef.current) return;
    fileFlushTimerRef.current = window.setTimeout(() => {
      fileFlushTimerRef.current = null;
      flushFileBuffers();
    }, 24);
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

    // Auto-save current session before generating new output.
    useAIStore.getState().saveCurrentSession();

    const basePrompt = rawPrompt;
    const skipPlanning = options?.skipPlanning === true;
    const preserveProjectMeta = options?.preserveProjectMeta === true;

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

    autoDebugRef.current = { signature: '', attempts: 0 };

    // Don't auto-open preview during generation - let user click Run after completion
    setIsGenerating(true);
    setError(null);
    setPreviewUrl(null);
    setSections({});
    setStreamText('');
    clearThinkingContent();
    clearSystemConsoleContent();
    logSystem('[STATUS] Starting generation stream…');
    logSystem('[webcontainer] Waiting for code generation to finish...');
    setBrainOpen(false);
    setThinkingStatus('Initializing…');
    streamCharCountRef.current = 0;
    streamLastLogAtRef.current = Date.now();
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
      const partialPaths = new Set<string>();
      const editOriginalByPath = new Map<string, string>();

      let autosaveTimer: number | null = null;
      const writeAutosaveNow = () => {
        try {
          const project = useProjectStore.getState();
          const snapshot = {
            savedAt: Date.now(),
            projectName: project.projectName,
            stack: project.stack,
            description: project.description,
            activeFile: project.activeFile,
            files: project.files.map((f) => ({
              name: f.name,
              path: f.path || f.name,
              content: f.content || ''
            }))
          };
          localStorage.setItem('nexus-apex-autosave', JSON.stringify(snapshot));
        } catch {
          // ignore
        }
      };
      const scheduleAutosave = () => {
        if (autosaveTimer) return;
        autosaveTimer = window.setTimeout(() => {
          autosaveTimer = null;
          writeAutosaveNow();
        }, 0);
      };
      const resolveGeneratedPath = (rawPath: string) => {
        if (filePathMap.has(rawPath)) return filePathMap.get(rawPath) as string;
        const normalized = resolveFilePath(rawPath);
        const finalPath = normalized || rawPath;
        filePathMap.set(rawPath, finalPath);
        return finalPath;
      };

      const stripPartialMarkerAtEnd = (text: string) => {
        const lines = String(text || '').split(/\r?\n/);
        while (lines.length > 0) {
          const last = (lines[lines.length - 1] || '').trim();
          if (last.includes('[[PARTIAL_FILE_CLOSED]]')) {
            lines.pop();
            continue;
          }
          if (last.length === 0) {
            lines.pop();
            continue;
          }
          break;
        }
        return lines.join('\n') + (lines.length > 0 ? '\n' : '');
      };

      const BRANDING_FOOTER = `<footer style="text-align: center; padding: 20px; font-size: 0.8rem; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.1);">
  © 2026 Nexus Apex | Built by Matany Labs.
</footer>`;

      const injectBrandingFooter = (html: string) => {
        const signature = '© 2026 Nexus Apex | Built by Matany Labs.';
        if (html.includes(signature)) return html;

        const footerBlock = `\n${BRANDING_FOOTER}\n`;
        const bodyCloseMatch = html.match(/<\/body\s*>/i);
        if (bodyCloseMatch && typeof bodyCloseMatch.index === 'number') {
          const idx = bodyCloseMatch.index;
          return html.slice(0, idx) + footerBlock + html.slice(idx);
        }

        const htmlCloseMatch = html.match(/<\/html\s*>/i);
        if (htmlCloseMatch && typeof htmlCloseMatch.index === 'number') {
          const idx = htmlCloseMatch.index;
          return html.slice(0, idx) + footerBlock + html.slice(idx);
        }

        return html + footerBlock;
      };

      const healHtmlDocument = (html: string) => {
        const text = String(html || '');
        const voidTags = new Set([
          'area',
          'base',
          'br',
          'col',
          'embed',
          'hr',
          'img',
          'input',
          'link',
          'meta',
          'param',
          'source',
          'track',
          'wbr'
        ]);

        const stack: string[] = [];
        const tagRe = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
        let match: RegExpExecArray | null;
        while ((match = tagRe.exec(text)) !== null) {
          const full = match[0] || '';
          const name = (match[1] || '').toLowerCase();
          if (!name) continue;
          if (full.startsWith('<!--') || full.startsWith('<!')) continue;
          if (voidTags.has(name) || full.endsWith('/>')) continue;

          if (full.startsWith('</')) {
            const idx = stack.lastIndexOf(name);
            if (idx !== -1) stack.splice(idx, 1);
            continue;
          }

          stack.push(name);
        }

        if (stack.length === 0) return text;
        const closers = stack.reverse().map((name) => `</${name}>`).join('');
        return `${text}\n${closers}\n`;
      };

      const finalizeHtmlFile = (path: string, partial: boolean) => {
        const existing = useProjectStore.getState().files.find((f) => (f.path || f.name) === path);
        if (!existing) return;

        const cleaned = stripPartialMarkerAtEnd(existing.content || '');
        const healed = partial ? healHtmlDocument(cleaned) : cleaned;
        const branded = injectBrandingFooter(healed);
        const finalText = branded;

        updateFile(path, finalText);
        upsertFileNode(path, finalText);
        upsertFile({
          name: existing.name,
          path,
          content: finalText,
          language: getLanguageFromExtension(path)
        });
      };

      const parseSearchReplaceBlocks = (raw: string) => {
        const text = String(raw || '');
        const blocks: Array<{ search: string; replace: string }> = [];
        let cursor = 0;

        while (cursor < text.length) {
          const searchIdx = text.indexOf('[[SEARCH]]', cursor);
          if (searchIdx === -1) break;
          const replaceIdx = text.indexOf('[[REPLACE]]', searchIdx);
          if (replaceIdx === -1) break;
          const endIdx = text.indexOf('[[END_EDIT]]', replaceIdx);
          if (endIdx === -1) break;

          const search = text.slice(searchIdx + '[[SEARCH]]'.length, replaceIdx).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
          const replace = text.slice(replaceIdx + '[[REPLACE]]'.length, endIdx).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
          blocks.push({ search, replace });
          cursor = endIdx + '[[END_EDIT]]'.length;
        }

        return blocks;
      };

      const applySearchReplaceBlocks = (original: string, blocks: Array<{ search: string; replace: string }>) => {
        let out = original;
        for (const block of blocks) {
          if (!block.search) continue;
          if (out.includes(block.search)) {
            out = out.replace(block.search, block.replace);
            continue;
          }
          // Fallback: ignore missing search blocks.
        }
        return out;
      };

      const handleFileEvent = (event: {
        type: 'start' | 'chunk' | 'end';
        path: string;
        mode?: 'create' | 'edit';
        chunk?: string;
        partial?: boolean;
        line?: number;
        append?: boolean;
      }) => {
        const resolvedPath = resolveGeneratedPath(event.path || '');
        if (!resolvedPath) return;

        if (event.type === 'start') {
          const label = event.mode === 'edit' ? 'Editing' : 'Writing';
          logSystem(`[STATUS] ${label} ${resolvedPath}...`);
          setThinkingStatus(`Writing ${resolvedPath.split('/').pop() || resolvedPath}…`);
          setFileStatus(resolvedPath, 'writing');

          upsertFileNode(resolvedPath);
          const name = resolvedPath.split('/').pop() || resolvedPath;
          const existing = useProjectStore.getState().files.find((f) => (f.path || f.name) === resolvedPath);

          if (!existing) {
            upsertFile({ name, path: resolvedPath, content: '', language: getLanguageFromExtension(resolvedPath) });
          }

          if (event.mode === 'edit') {
            editOriginalByPath.set(resolvedPath, existing?.content || '');
          }

          if (event.append) {
            const current = existing?.content || '';
            const cleaned = stripPartialMarkerAtEnd(current);
            updateFile(resolvedPath, cleaned);
            upsertFileNode(resolvedPath, cleaned);
            upsertFile({ name, path: resolvedPath, content: cleaned, language: getLanguageFromExtension(resolvedPath) });
          } else {
            flushFileBuffers();
            fileChunkBuffersRef.current.delete(resolvedPath);
            updateFile(resolvedPath, '');
            upsertFileNode(resolvedPath, '');
          }

          setWritingFilePath(resolvedPath);
          setActiveFile(resolvedPath);
          setMobileTab('editor');
          setBrainOpen(true);
          return;
        }

        if (event.type === 'chunk') {
          const chunk = String(event.chunk || '');
          if (chunk.length === 0) return;
          fileChunkBuffersRef.current.set(resolvedPath, (fileChunkBuffersRef.current.get(resolvedPath) || '') + chunk);
          scheduleFileFlush();
          return;
        }

        if (event.type === 'end') {
          flushFileBuffers();
          setFileStatus(resolvedPath, 'ready');
          if (useAIStore.getState().writingFilePath === resolvedPath) setWritingFilePath(null);

          if (event.mode === 'edit') {
            const original = editOriginalByPath.get(resolvedPath) ?? '';
            const latest = useProjectStore.getState().files.find((f) => (f.path || f.name) === resolvedPath)?.content || '';
            const blocks = parseSearchReplaceBlocks(latest);
            if (blocks.length > 0) {
              const next = applySearchReplaceBlocks(original, blocks);
              updateFile(resolvedPath, next);
              upsertFileNode(resolvedPath, next);
              upsertFile({ name: resolvedPath.split('/').pop() || resolvedPath, path: resolvedPath, content: next, language: getLanguageFromExtension(resolvedPath) });
            }
          }

          if (resolvedPath.toLowerCase().endsWith('.html')) {
            finalizeHtmlFile(resolvedPath, Boolean(event.partial));
          }

          if (event.partial) {
            partialPaths.add(resolvedPath);
            const msg = `Stream interrupted: ${resolvedPath} cut at line ${event.line || '?'}`;
            logSystem(`[STATUS] ${msg} (healed & auto-resuming)`);
          } else {
            partialPaths.delete(resolvedPath);
            logSystem(`[STATUS] Completed ${resolvedPath}`);
            scheduleAutosave();
          }

          if (useAIStore.getState().architectMode) {
            const next = useAIStore.getState().planSteps.find((s) => !s.completed);
            if (next) useAIStore.getState().setPlanStepCompleted(next.id, true);
          }
        }
      };

      let reasoningChars = 0;
      const isThinkingMode = modelMode === 'thinking';
      let openedBrain = false;

      await aiService.generateCodeStream(
        basePrompt,
        (token) => {
          streamCharCountRef.current += token.length;
          const now = Date.now();
          if (now - streamLastLogAtRef.current > 900) {
            const k = Math.round(streamCharCountRef.current / 100) / 10;
            logSystem(`[STATUS] Received ${k}k chars...`);
            streamLastLogAtRef.current = now;
          }
          scheduleTokenBeat();
        },
        (phase, message) => {
          const writing = useAIStore.getState().writingFilePath;
          if (writing && phase === 'streaming') {
            setThinkingStatus(`Writing ${writing.split('/').pop() || writing}…`);
          } else if (phase === 'thinking') setThinkingStatus('Thinking…');
          else if (phase === 'streaming') setThinkingStatus('Generating…');
          else if (phase === 'validating') setThinkingStatus('Validating…');
          else if (phase === 'done') setThinkingStatus('Complete');
          else setThinkingStatus(message);
          if (message) logSystem(`[STATUS] ${message}`);
        },
        (meta) => {
          if (meta?.resume?.attempt) {
            logSystem(`[STATUS] Auto-resume attempt ${meta.resume.attempt}`);
          }
          if (meta?.raw) logSystem(`[STATUS] ${String(meta.raw)}`);
        },
        (payload) => {
          // File-marker protocol drives file updates incrementally; the service emits a minimal meta payload here.
          const protocol = payload?.metadata?.protocol;
          if (protocol === 'file-marker') {
            logSystem('[STATUS] File-Marker stream finished.');
          }
        },
        (err) => {
          flushFileBuffers();
          const message = typeof err === 'string' ? err : 'Generation failed';
          setError(message);
          addLog({ timestamp: Date.now(), type: 'error', message: `Generation failed: ${String(err)}` });
          logSystem(`[ERROR] ${message}`);
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
          generationSucceeded = useProjectStore.getState().files.length > 0;
          if (generationSucceeded) {
            if (partialPaths.size > 0) {
              logSystem(`[webcontainer] Code complete but partial files remain (${partialPaths.size}). Waiting for auto-resume...`);
            } else {
              logSystem('[webcontainer] Code Complete. Writing to Container...');
              setTimeout(() => {
                void deployAndRun();
              }, 0);
            }
          }
        },
        { thinkingMode: isThinkingMode, architectMode, includeReasoning: isThinkingMode, typingMs: 26, onFileEvent: handleFileEvent }
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
    logSystem
  ]);

  const buildFixPrompt = useCallback(
    (request: string) => {
      const paths = files
        .map((file) => file.path || file.name || '')
        .filter((p) => p.length > 0)
        .sort((a, b) => a.localeCompare(b));

      const activePath = activeFile || paths[0] || '';
      const active = files.find((f) => (f.path || f.name) === activePath);
      const activeContent = active?.content || '';

      const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max)}\n\n[[TRUNCATED]]`);

      const structureList = paths.slice(0, 220).map((p) => `- ${p}`).join('\n');
      const activeBlock = activePath
        ? `[[ACTIVE_FILE: ${activePath}]]\n${truncate(activeContent, 24000)}\n[[END_ACTIVE_FILE]]`
        : '[[ACTIVE_FILE: none]]';

      return [
        'SYSTEM: You are editing an existing project.',
        'CRITICAL: Output MUST be plain text only. No JSON. No markdown.',
        'Use ONLY these markers:',
        '  - [[EDIT_NODE: path/to/file.ext]] ... [[END_FILE]] for edits',
        '  - [[START_FILE: path/to/file.ext]] ... [[END_FILE]] for new files',
        'Prefer [[EDIT_NODE]] whenever possible. Do NOT repeat unchanged files.',
        'When editing, prefer search/replace blocks instead of rewriting entire files:',
        '  [[EDIT_NODE: path/to/file.ext]]',
        '  [[SEARCH]]',
        '  <exact text>',
        '  [[REPLACE]]',
        '  <replacement text>',
        '  [[END_EDIT]]',
        '  [[END_FILE]]',
        '',
        `USER REQUEST: ${request}`,
        '',
        'PROJECT STRUCTURE:',
        structureList,
        '',
        'ACTIVE FILE (full content):',
        activeBlock,
        '',
        'Branding rule: Ensure the Nexus Apex footer exists in the main layout (React App component or HTML page):',
        '© 2026 Nexus Apex | Built by Matany Labs.',
        'Output only markers + file contents. No filler.'
      ].join('\n');
    },
    [activeFile, files]
  );

  useEffect(() => {
    if (!isPreviewOpen) return;
    if (isGenerating || isPlanning) return;

    const last = logs[logs.length - 1];
    if (!last) return;

    const message = String(last.message || '');
    if (!message.includes('TypeError')) return;

    const signature = `typeerror:${message.slice(0, 500)}`;
    const attempts = autoDebugRef.current.signature === signature ? autoDebugRef.current.attempts : 0;
    if (attempts >= 1) return;

    autoDebugRef.current = { signature, attempts: attempts + 1 };

    const tail = logs
      .slice(-45)
      .map((line) => {
        const t = new Date(line.timestamp).toLocaleTimeString([], { hour12: false });
        return `${t} ${line.message}`;
      })
      .join('\n');

    logSystem('[STATUS] Auto-fix triggered: TypeError detected.');
    const requestText = [
      'AUTO-FIX: A TypeError appeared in the terminal/console. Fix the code so the preview runs without throwing.',
      message ? `Error: ${message}` : '',
      tail ? `Recent logs:\n${tail}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const fixPrompt = buildFixPrompt(requestText);
    void handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
  }, [autoDebugRef, buildFixPrompt, handleGenerate, isGenerating, isPlanning, isPreviewOpen, logSystem, logs]);

  useEffect(() => {
    if (runtimeStatus !== 'error') return;
    if (!isPreviewOpen) return;
    if (isGenerating || isPlanning) return;

    const signature = String(runtimeMessage || 'preview-error');
    const attempts = autoDebugRef.current.signature === signature ? autoDebugRef.current.attempts : 0;
    if (attempts >= 1) return;

    autoDebugRef.current = { signature, attempts: attempts + 1 };

    const tail = logs
      .slice(-45)
      .map((line) => {
        const t = new Date(line.timestamp).toLocaleTimeString([], { hour12: false });
        return `${t} ${line.message}`;
      })
      .join('\n');

    logSystem(`[STATUS] Auto-debugging: ${signature}`);
    const requestText = [
      'AUTO-DEBUG: The WebContainer preview failed to run. Fix the code so it starts successfully.',
      signature ? `Error: ${signature}` : '',
      tail ? `Recent logs:\n${tail}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const fixPrompt = buildFixPrompt(requestText);
    void handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
  }, [
    autoDebugRef,
    buildFixPrompt,
    handleGenerate,
    isGenerating,
    isPlanning,
    isPreviewOpen,
    logSystem,
    logs,
    runtimeMessage,
    runtimeStatus
  ]);

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
              <BrandTitle>NEXUS APEX</BrandTitle>
              <BrandSubtitle>{projectName?.trim() || 'Untitled Project'}</BrandSubtitle>
            </BrandStack>
            <StatusPill $active={isGenerating}>{isGenerating ? thinkingStatus || 'Working…' : 'Ready'}</StatusPill>
          </HeaderLeft>
          <HeaderRight>
            <SubscriptionIndicator />
            <div style={{ marginRight: '4px' }}>
              <LanguageSwitcher />
            </div>
            <HeaderIconButton
              type="button"
              onClick={async () => {
                const shouldOpen = !isPreviewOpen;
                setIsPreviewOpen(shouldOpen);
                if (shouldOpen && files.length > 0) {
                  try {
                    await deployAndRun();
                  } catch (err) {
                    console.error('Failed to start preview:', err);
                  }
                }
              }}
              aria-label={isPreviewOpen ? 'Close preview' : 'Open preview'}
              title={isPreviewOpen ? 'Close preview' : 'Open preview'}
              style={{
                borderColor: isPreviewOpen ? 'rgba(34, 211, 238, 0.30)' : undefined,
                background: isPreviewOpen ? 'rgba(34, 211, 238, 0.12)' : undefined,
              }}
            >
              {isPreviewOpen ? <EyeOff size={18} /> : <Eye size={18} />}
            </HeaderIconButton>
            <HeaderIconButton
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-label="View history"
              title="View history"
            >
              <History size={18} />
            </HeaderIconButton>
            <HeaderIconButton
              type="button"
              onClick={() => setPlanOpen((v) => !v)}
              aria-label="View plan"
              title="View plan"
            >
              <ListTodo size={18} />
            </HeaderIconButton>
            <MobileMenuButton type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={18} />
            </MobileMenuButton>
          </HeaderRight>
        </HeaderArea>

        <InputArea>
          <PromptInput
            ref={promptRef}
            onSubmit={handleMainActionClick}
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
            <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
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
      <DrawerPanel $open={sidebarOpen}>
        <DrawerHeader>
          <DrawerTitle>Workspace</DrawerTitle>
          <DrawerClose type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={16} />
          </DrawerClose>
        </DrawerHeader>
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      </DrawerPanel>

      <OverlayScrim
        $open={historyOpen || settingsOpen}
        onClick={() => {
          setHistoryOpen(false);
          setSettingsOpen(false);
        }}
      />
      <OverlayPanel $open={historyOpen}>
        <OverlayHeader>
          History
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,0.70)', cursor: 'pointer' }}
            aria-label="Close history"
          >
            <X size={16} />
          </button>
        </OverlayHeader>
        <OverlayBody>
          <SidebarHistory />
        </OverlayBody>
      </OverlayPanel>

      <OverlayPanel $open={settingsOpen}>
        <OverlayHeader>
          Project Settings
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,0.70)', cursor: 'pointer' }}
            aria-label="Close project settings"
          >
            <X size={16} />
          </button>
        </OverlayHeader>
        <OverlayBody>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                Project Name
              </div>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My project"
                style={{
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.90)',
                  padding: '0 12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                Stack
              </div>
              <input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="react-vite"
                style={{
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.90)',
                  padding: '0 12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this project does…"
                rows={3}
                className="scrollbar-thin"
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.90)',
                  padding: '10px 12px',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
              Autosave is enabled. Generated projects must include the Nexus Apex footer.
            </div>
          </div>
        </OverlayBody>
      </OverlayPanel>

      {architectMode && planSteps.length > 0 && (
        <FloatingPlanWrap $open={planOpen}>
          {planOpen ? (
            <FloatingPlanPanel>
              <FloatingPlanHeader type="button" onClick={() => setPlanOpen(false)} aria-label="Collapse plan">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ListTodo size={16} />
                  Plan
                </span>
                <span style={{ opacity: 0.7 }}>×</span>
              </FloatingPlanHeader>
              <FloatingPlanBody>
                <PlanChecklist
                  items={planSteps}
                  currentStepId={isGenerating ? currentPlanStepId : undefined}
                  embedded
                />
              </FloatingPlanBody>
            </FloatingPlanPanel>
          ) : (
            <FloatingPlanToggle type="button" onClick={() => setPlanOpen(true)} aria-label="Open plan">
              <ListTodo size={18} />
            </FloatingPlanToggle>
          )}
        </FloatingPlanWrap>
      )}

      <IDEFooter>© 2026 Nexus Apex | Built by Matany Labs.</IDEFooter>
      <BrainConsole
        visible={isConsoleVisible}
        open={brainOpen}
        onToggle={() => setBrainOpen((v) => !v)}
        health={systemHealth}
        thought={thinkingContent}
        status={thinkingStatus}
        error={error}
        logs={systemConsoleContent}
        canFixResume={false}
      />
      </Root>
    </>
  );
}

export default App;
