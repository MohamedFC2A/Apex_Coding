import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, History, ListTodo, Menu, X, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { SubscriptionIndicator } from './components/SubscriptionIndicator';
import { useLanguage } from './context/LanguageContext';

import { AI_NEW_CHAT_GUARD_KEY, useAIStore } from './stores/aiStore';
import { useProjectStore } from './stores/projectStore';
import { usePreviewStore } from './stores/previewStore';
import { aiService, type StreamFileEvent } from './services/aiService';
import { getLanguageFromExtension } from './utils/stackDetector';
import { repairTruncatedContent } from './utils/codeRepair';
import { normalizePlanCategory } from './utils/planCategory';

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
import { ToolsPanel } from './components/ui/ToolsPanel';
import { GlobalStyles } from './styles/GlobalStyles';
import { MobileNav } from './components/ui/MobileNav';
import type { ProjectType } from './stores/projectStore';
import { recommendProjectMode } from './services/projectModeAdvisor';
import {
  buildConstraintsRepairPrompt,
  buildGenerationConstraintsBlock,
  mergePromptWithConstraints
} from './services/constraintPromptBuilder';
import { validateConstraints } from './services/constraintValidator';
import type { GenerationConstraints } from './types/constraints';
import { createFileMutationEngine } from './services/fileMutationEngine';
import { buildContextBundle } from './services/contextRetrievalEngine';

// ============================================================================
// GLOBAL AUTOSAVE - INDEPENDENT OF CHAT/COMPONENT LIFECYCLE
// ============================================================================
let globalAutosaveTimer: number | null = null;
const AUTO_RESUME_KEY = 'apex-ai-pending-run';
const AUTO_RESUME_MAX_ATTEMPTS = 2;
const AUTO_RESUME_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const NEW_CHAT_GUARD_TTL_MS = 45_000;

type AutoResumePayload = {
  prompt: string;
  at: number;
  attempts?: number;
  runId?: string;
  state?: 'running' | 'completed' | 'stopped' | 'failed';
  resumeEligible?: boolean;
  lastPhase?: string;
  lastWritingPath?: string;
};

const readAutoResumePayload = (): AutoResumePayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTO_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const prompt = String(parsed?.prompt || '').trim();
    const at = Number(parsed?.at || 0);
    const attempts = Number(parsed?.attempts || 0);
    if (!prompt || !Number.isFinite(at) || at <= 0) return null;
    return { prompt, at, attempts: Number.isFinite(attempts) ? attempts : 0 };
  } catch {
    return null;
  }
};

const writeAutoResumePayload = (payload: AutoResumePayload) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTO_RESUME_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage issues
  }
};

const clearAutoResumePayload = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTO_RESUME_KEY);
  } catch {
    // ignore storage issues
  }
};

const consumeNewChatGuard = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(AI_NEW_CHAT_GUARD_KEY);
    if (!raw) return false;
    window.localStorage.removeItem(AI_NEW_CHAT_GUARD_KEY);
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return false;
    return Date.now() - at <= NEW_CHAT_GUARD_TTL_MS;
  } catch {
    return false;
  }
};

const globalWriteAutosaveNow = () => {
  try {
    useAIStore.getState().saveCurrentSession();
  } catch (e) {
    console.warn('[HistorySave] Failed:', e);
  }

  try {
    (window as any).__APEX_WORKSPACE_PERSIST__?.flush?.();
  } catch (e) {
    console.warn('[AutoSave] Failed:', e);
  }
};

const globalScheduleAutosave = () => {
  if (globalAutosaveTimer) return;
  globalAutosaveTimer = window.setTimeout(() => {
    globalAutosaveTimer = null;
    globalWriteAutosaveNow();
  }, 500); // 500ms debounce for instant feel
};

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).__APEX_AUTOSAVE__ = { save: globalWriteAutosaveNow, schedule: globalScheduleAutosave };
}

const Root = styled.div`
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  /* Use global background with noise from globals.css */
  background: transparent; 
  color: var(--nexus-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
`;

const Container = styled.div<{ $reserveConsole: boolean }>`
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  padding-bottom: calc(16px + 40px);
  min-height: 0;
  max-width: 100%;
  width: 100%;

  @media (max-width: 1024px) {
    padding: 12px;
    padding-bottom: calc(12px + 40px);
    gap: 12px;
  }

  @media (max-width: 768px) {
    padding: 12px;
    padding-bottom: calc(
      var(--mobile-nav-height) +
      env(safe-area-inset-bottom) +
      ${(p) => (p.$reserveConsole ? 'var(--brain-console-collapsed-height)' : '0px')}
    );
    gap: 12px;
  }
`;

const HeaderArea = styled.div`
  flex-shrink: 0;
  min-height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  
  /* Glassmorphism */
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    
  padding: 0 16px;
  flex-wrap: nowrap;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 1024px) {
    gap: 12px;
    padding: 0 12px;
  }

  @media (max-width: 768px) {
    min-height: auto;
    padding: 8px 10px;
    gap: 8px;
    flex-wrap: wrap;
    border-radius: 14px;
  }
`;

const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;

  @media (max-width: 1024px) {
    gap: 12px;
  }

  @media (max-width: 768px) {
    width: auto;
    flex: 1;
    min-width: 0;
    gap: 10px;
    justify-content: flex-start;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  @media (max-width: 1024px) {
    gap: 10px;
  }

  @media (max-width: 768px) {
    width: auto;
    max-width: 100%;
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const HeaderIconButton = styled.button`
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(12px);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    color: white;

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
`;

const DesktopOnly = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`;

const OverlayScrim = styled.button<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  border: 0;
  padding: 0;
  margin: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 55;
`;

const OverlayPanel = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 80px;
  right: 20px;
  width: min(440px, calc(100vw - 40px));
  max-height: calc(100dvh - 160px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(20, 20, 24, 0.6);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  transform: ${(p) => (p.$open ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.98)')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 56;

  @media (max-width: 768px) {
    top: 70px;
    right: 12px;
    left: 12px;
    width: auto;
    border-radius: 20px;
    max-height: calc(100dvh - 70px - var(--mobile-nav-height) - env(safe-area-inset-bottom));
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
    display: none;
  }
`;

const FloatingPlanPanel = styled.div`
  position: relative;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(18, 18, 20, 0.7);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  box-shadow: 
    0 24px 80px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    inset: -100px;
    background: radial-gradient(300px 300px at 20% 20%, rgba(34, 211, 238, 0.1), transparent 60%),
      radial-gradient(300px 300px at 80% 80%, rgba(168, 85, 247, 0.08), transparent 60%);
    filter: blur(60px);
    opacity: 0.6;
    pointer-events: none;
  }
`;

const FloatingPlanHeader = styled.button`
  position: relative;
  z-index: 1;
  width: 100%;
  height: 52px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  border: 0;
  cursor: pointer;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 13px;
  font-weight: 700;
  transition: background 200ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
`;

const FloatingPlanBody = styled.div`
  position: relative;
  z-index: 1;
  height: calc(50vh - 52px);
  max-height: calc(50vh - 52px);
  overflow: hidden;
`;

const FloatingPlanToggle = styled.button`
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-4px) scale(1.05);
    box-shadow: 
      0 20px 40px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(255, 255, 255, 0.1);
  }

  &:active {
    transform: translateY(0) scale(0.95);
  }
`;

const BrandStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.05;

  @media (max-width: 768px) {
    gap: 0;
  }
`;

const BrandTitle = styled.div`
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 14px;
  background: linear-gradient(135deg, #FFF 0%, rgba(255,255,255,0.7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);

  @media (max-width: 768px) {
    font-size: 12px;
    letter-spacing: 0.05em;
  }
`;

const BrandSubtitle = styled.div`
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.5);
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 768px) {
    font-size: 10px;
    max-width: 20ch;
  }

  @media (max-width: 480px) {
    display: none;
  }
`;

const StatusPill = styled.div<{ $active?: boolean }>`
  padding: 6px 14px;
  border-radius: 99px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.3)' : 'rgba(255, 255, 255, 0.1)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.1)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? '#22d3ee' : 'rgba(255, 255, 255, 0.6)')};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
  box-shadow: ${(p) => (p.$active ? '0 0 15px rgba(34, 211, 238, 0.2)' : 'none')};

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.08)')};
    border-color: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.2)')};
  }

  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 10px;
  }

  @media (max-width: 560px) {
    display: none;
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

const InputArea = styled.div<{ $mobileHidden?: boolean }>`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
  padding-top: 0;
  width: 100%;
  min-width: 0;

  @media (max-width: 768px) {
    display: ${(p) => (p.$mobileHidden ? 'none' : 'flex')};
    gap: 10px;
    padding-top: 0;
    height: 100%;
    min-height: 0;
    justify-content: flex-start;
    align-items: stretch;
    overflow: hidden;
  }
`;

const MobileAIBoard = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    height: 100%;
  }
`;

const MobileAIIntro = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    padding: 10px 12px;
  }
`;

const MobileAITitle = styled.div`
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
`;

const MobileAISubtitle = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.35;
`;

const MobilePlanPane = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(16, 18, 24, 0.72);
    backdrop-filter: blur(20px);
  }
`;

const MobilePlanBody = styled.div`
  height: 100%;
  min-height: 0;
  overflow: auto;
`;

const MainWorkspace = styled.div<{ $previewOpen: boolean; $mobileHidden?: boolean }>`
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: ${(p) =>
    p.$previewOpen
      ? 'minmax(var(--ide-sidebar-width), 18vw) minmax(var(--ide-editor-min-width), 1.15fr) minmax(var(--ide-preview-min-width), 0.95fr)'
      : 'minmax(var(--ide-sidebar-width), 18vw) minmax(var(--ide-editor-min-width), 1fr)'};
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  scrollbar-width: thin;

  @media (max-width: 1280px) {
    grid-template-columns: ${(p) =>
      p.$previewOpen
        ? 'minmax(248px, 17vw) minmax(620px, 1.1fr) minmax(410px, 0.9fr)'
        : 'minmax(248px, 17vw) minmax(620px, 1fr)'};
  }

  @media (max-width: 1024px) {
    width: 100%;
    overflow-x: hidden;
    grid-template-columns: ${(p) =>
      p.$previewOpen ? '240px minmax(0, 1fr) minmax(0, 0.95fr)' : '240px minmax(0, 1fr)'};
    gap: 10px;
  }

  @media (max-width: 768px) {
    display: ${(p) => (p.$mobileHidden ? 'none' : 'grid')};
    grid-template-columns: 1fr;
    gap: 0;
    position: relative;
    min-height: 0;
    border-radius: 14px;
    overflow: hidden;
    height: 100%;
    width: 100%;
  }
`;

const DesktopLayout = styled.div`
  display: none;

  @media (min-width: 769px) {
    display: grid;
    flex: 1;
    min-height: 0;
    min-width: 0;
    grid-template-columns: minmax(320px, 0.27fr) minmax(0, 0.73fr);
    gap: 12px;
    width: 100%;
  }
`;

const ChatColumn = styled.div`
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 60fr) minmax(0, 40fr);
  gap: 10px;
`;

const ChatPanel = styled.div`
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(10, 14, 22, 0.62);
  backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
`;

const ChatHeader = styled.div`
  flex-shrink: 0;
  display: grid;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
`;

const ChatHeaderTitle = styled.div`
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.86);
`;

const ChatHeaderMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.62);
`;

const ContextBarTrack = styled.div`
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.09);
`;

const ContextBarFill = styled.div<{ $status: 'ok' | 'warning' | 'critical'; $width: number }>`
  height: 100%;
  width: ${(p) => `${Math.max(0, Math.min(100, p.$width))}%`};
  border-radius: inherit;
  background: ${(p) => (
    p.$status === 'critical'
      ? 'linear-gradient(90deg, #ef4444, #f97316)'
      : p.$status === 'warning'
        ? 'linear-gradient(90deg, #f59e0b, #eab308)'
        : 'linear-gradient(90deg, #22d3ee, #3b82f6)'
  )};
  transition: width 220ms ease;
`;

const ChatScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ChatBubble = styled.div<{ $role: 'user' | 'assistant' | 'system' }>`
  align-self: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
  width: fit-content;
  max-width: 92%;
  border-radius: 12px;
  padding: 9px 11px;
  border: 1px solid ${(p) => (
    p.$role === 'user'
      ? 'rgba(34, 211, 238, 0.34)'
      : p.$role === 'assistant'
        ? 'rgba(34, 197, 94, 0.28)'
        : 'rgba(255, 255, 255, 0.12)'
  )};
  background: ${(p) => (
    p.$role === 'user'
      ? 'rgba(34, 211, 238, 0.14)'
      : p.$role === 'assistant'
        ? 'rgba(34, 197, 94, 0.11)'
        : 'rgba(255, 255, 255, 0.05)'
  )};
`;

const ChatBubbleRole = styled.div<{ $role: 'user' | 'assistant' | 'system' }>`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
  color: ${(p) => (
    p.$role === 'user'
      ? 'rgba(103, 232, 249, 0.95)'
      : p.$role === 'assistant'
        ? 'rgba(134, 239, 172, 0.95)'
        : 'rgba(255, 255, 255, 0.74)'
  )};
`;

const ChatBubbleText = styled.div`
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
  white-space: pre-wrap;
  word-break: break-word;
`;

const ChatRoundBadge = styled.span`
  font-size: 9px;
  font-weight: 600;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  vertical-align: middle;
`;

const ChatTimestamp = styled.span`
  font-size: 9px;
  font-weight: 400;
  margin-left: 8px;
  color: rgba(255, 255, 255, 0.35);
  vertical-align: middle;
`;

const ChatEmpty = styled.div`
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.45;
`;

const ChatComposerWrap = styled.div`
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
`;

const WorkbenchColumn = styled.div`
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const WorkbenchTabs = styled.div`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  width: fit-content;
`;

const WorkbenchTab = styled.button<{ $active: boolean }>`
  height: 32px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.34)' : 'rgba(255, 255, 255, 0.1)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.16)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.72)')};
  border-radius: 10px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
`;

const WorkbenchBody = styled.div`
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(250px, 0.28fr) minmax(0, 0.72fr);
  gap: 12px;

  @media (max-width: 1220px) {
    grid-template-columns: minmax(220px, 0.28fr) minmax(0, 0.72fr);
    gap: 10px;
  }
`;

const WorkbenchSidebar = styled.div`
  min-height: 0;
  min-width: 0;
`;

const WorkbenchPanel = styled.div`
  min-height: 0;
  min-width: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 20, 0.65);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
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
    display: none;
  }
`;

const DesktopSidebar = styled.div`
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
  flex-shrink: 0;
  padding-right: 0;

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
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 20, 0.65);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);

  @media (min-width: 769px) {
    display: ${(p) => (p.$desktopHidden ? 'none' : 'flex')};
  }

  @media (max-width: 768px) {
    display: ${(p) => (p.$mobileActive ? 'flex' : 'none')};
    position: relative;
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

const normalizePlanStepsForProfile = <T extends { title?: string; category?: string; files?: string[] }>(
  steps: T[],
  projectMode: ProjectType
) => {
  const normalizedSteps = steps.map((step) => ({
    ...step,
    category: normalizePlanCategory(step.category, step.title, Array.isArray(step.files) ? step.files : [])
  }));

  const backendHints = /(backend|server|api|database|db|auth|middleware|route)/i;
  const baseFiltered = normalizedSteps.filter((step) => {
    const category = String(step.category || '').toLowerCase();
    if (projectMode === 'FRONTEND_ONLY' && category === 'backend') return false;
    const title = String(step.title || '');
    if (projectMode === 'FRONTEND_ONLY' && backendHints.test(title)) return false;
    if (
      projectMode === 'FRONTEND_ONLY' &&
      Array.isArray(step.files) &&
      step.files.some((f) => backendHints.test(String(f || '')))
    ) {
      return false;
    }
    return true;
  });

  const normalizeText = (text: string) =>
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const seen = new Set<string>();
  const deduped = baseFiltered.filter((step) => {
    const titleKey = normalizeText(String(step.title || ''));
    const filesKey = (Array.isArray(step.files) ? step.files : [])
      .map((f) => String(f || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');
    const key = `${titleKey || 'untitled'}::${filesKey || 'nofiles'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const phaseScore = (step: T) => {
    const text = normalizeText(`${step.title || ''} ${step.category || ''} ${(step.files || []).join(' ')}`);
    if (/(init|setup|scaffold|config|install|bootstrap|foundation|structure)/i.test(text)) return 0;
    if (/(layout|routing|state|store|schema|service|api|client)/i.test(text)) return 1;
    if (/(component|feature|logic|form|interaction|ui|page)/i.test(text)) return 2;
    if (/(test|qa|fix|refactor|optimi|polish|a11y|seo|performance)/i.test(text)) return 3;
    return 4;
  };

  const ordered = deduped
    .map((step, index) => ({ step, index, phase: phaseScore(step) }))
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase;
      return a.index - b.index;
    })
    .map((entry) => entry.step)
    .slice(0, 8);

  if (ordered.length > 0) return ordered;

  return normalizedSteps.slice(0, 4).map((step) => ({
    ...step,
    category: projectMode === 'FRONTEND_ONLY' ? 'frontend' : step.category
  }));
};

const createProjectId = (seed: string) => {
  const base = String(seed || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const prefix = base || 'project';
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const FULLSTACK_TEMP_LOCK = true;
const SUPER_MODE_TEMP_DISABLED = true;

type CompletionSuggestion = {
  id: string;
  question: string;
  actionLabel: string;
  prompt: string;
};

const PREVIEW_ERROR_PATTERN = /(TypeError|ReferenceError|SyntaxError|Unexpected token|Cannot read|is not defined|Uncaught|Failed to fetch|<path> attribute d|missing \) after argument list)/i;

const extractTopFolders = (paths: string[]) => {
  const buckets = new Map<string, number>();
  for (const path of paths) {
    const normalized = String(path || '').replace(/\\/g, '/').trim();
    if (!normalized) continue;
    const root = normalized.split('/')[0] || normalized;
    buckets.set(root, (buckets.get(root) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ');
};

const buildCompletionSuggestions = (args: {
  selectedFeatures: string[];
  projectMode: ProjectType;
  files: Array<{ path?: string; name?: string; content?: string }>;
  lastPrompt: string;
}): CompletionSuggestion[] => {
  const { selectedFeatures, projectMode, files, lastPrompt } = args;
  const textSample = files
    .slice(0, 40)
    .map((f) => String(f.content || '').slice(0, 1500))
    .join('\n')
    .toLowerCase();

  const suggestions: CompletionSuggestion[] = [];

  if (!selectedFeatures.includes('responsive-mobile-first')) {
    suggestions.push({
      id: 'responsive-mobile-first',
      question: 'اقتراح: هل تريد إضافة تحسين Mobile-first كامل للواجهات؟',
      actionLabel: 'Add Mobile UX',
      prompt: 'Please improve the project with a complete mobile-first responsive pass, optimize spacing/typography for phones, and fix overflow issues across all key screens.'
    });
  }

  if (!selectedFeatures.includes('a11y-landmarks')) {
    suggestions.push({
      id: 'a11y-landmarks',
      question: 'اقتراح: هل تضيف تحسينات Accessibility احترافية (A11y)؟',
      actionLabel: 'Add A11y',
      prompt: 'Apply a full accessibility pass: semantic landmarks, aria labels, keyboard navigation, focus states, and color contrast fixes without breaking current UI.'
    });
  }

  if (!selectedFeatures.includes('performance-optimized-assets')) {
    suggestions.push({
      id: 'performance-optimized-assets',
      question: 'اقتراح: هل تريد تحسين أداء التحميل والـ assets؟',
      actionLabel: 'Optimize Perf',
      prompt: 'Run a performance optimization pass: lazy-load heavy sections/assets, reduce unnecessary re-renders, and optimize images/SVG loading while keeping behavior unchanged.'
    });
  }

  if (!selectedFeatures.includes('seo-meta-og') && /<html|<head|meta/i.test(textSample)) {
    suggestions.push({
      id: 'seo-meta-og',
      question: 'اقتراح: هل تضيف SEO + Open Graph جاهز للنشر؟',
      actionLabel: 'Add SEO',
      prompt: 'Add complete SEO metadata and Open Graph tags for all relevant pages, including title/description/canonical and social preview metadata.'
    });
  }

  if (projectMode === 'FRONTEND_ONLY' && !selectedFeatures.includes('api-integration-ready')) {
    suggestions.push({
      id: 'api-integration-ready',
      question: 'اقتراح: هل تجهز المشروع لربط API بشكل منظم؟',
      actionLabel: 'Prepare API',
      prompt: 'Prepare the frontend for API integration with a clean service layer, typed request helpers, loading states, retry handling, and consistent error boundaries.'
    });
  }

  suggestions.push({
    id: 'quality-pass',
    question: 'اقتراح ذكي: هل تنفذ Quality pass شامل قبل التسليم؟',
    actionLabel: 'Run Quality Pass',
    prompt: `Do a final quality pass for the project built from this request: "${lastPrompt}". Focus on reliability, code organization, edge-case handling, and production readiness.`
  });

  return suggestions.slice(0, 3);
};

function App() {
  const { t, isRTL } = useLanguage();
  const {
    prompt,
    architectMode,
    modelMode,
    interactionMode,
    isGenerating,
    isPlanning,
    lastTokenAt,
    planSteps,
    projectType,
    selectedFeatures,
    customFeatureTags,
    constraintsEnforcement,
    chatHistory,
    thinkingContent,
    systemConsoleContent,
    isPreviewOpen,
    writingFilePath,
    contextBudget,
    brainEvents,
    setPrompt,
    setProjectType,
    setSelectedFeatures,
    setCustomFeatureTags,
    setConstraintsEnforcement,
    setModelMode,
    setIsGenerating,
    setInteractionMode,
    setSections,
    setStreamText,
    appendStreamText,
    updateLastToken,
    clearThinkingContent,
    appendThinkingContent,
    clearSystemConsoleContent,
    appendSystemConsoleContent,
    setPlanSteps,
    setLastPlannedPrompt,
    generatePlan,
    clearFileStatuses,
    setFileStatus,
    setWritingFilePath,
    resetFiles,
    resolveFilePath,
    upsertFileNode,
    setFilesFromProjectFiles,
    addChatMessage,
    error,
    setError,
    setIsPreviewOpen,
    recoverSession,
    executionPhase,
    setExecutionPhase,
    addBrainEvent,
    clearBrainEvents
  } = useAIStore();

  useEffect(() => {
    recoverSession();
  }, [recoverSession]);

  useEffect(() => {
    let cancelled = false;
    const checkProvider = async () => {
      try {
        const status = await aiService.getProviderStatus();
        if (cancelled) return;
        setLlmConfigured(Boolean(status.configured));
        setLlmConfigHint(String(status.hint || ''));
      } catch {
        if (cancelled) return;
        setLlmConfigured(false);
        setLlmConfigHint('Cannot verify backend AI provider. Check backend connectivity and DEEPSEEK_API_KEY.');
      }
    };
    void checkProvider();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapHistory = async () => {
      const hasFreshNewChatGuard = consumeNewChatGuard();
      if (hasFreshNewChatGuard) {
        useAIStore.setState({
          files: {},
          chatHistory: [],
          plan: '',
          planSteps: [],
          prompt: '',
          lastPlannedPrompt: '',
          decisionTrace: '',
          streamText: '',
          thinkingContent: '',
          systemConsoleContent: '',
          fileStatuses: {},
          writingFilePath: null,
          sections: {},
          isGenerating: false,
          isPlanning: false,
          generationStatus: {
            isGenerating: false,
            currentStep: 'idle',
            progress: 0
          },
          error: null,
          currentSessionId: null
        });
      }

      await useProjectStore.getState().hydrateFromDisk();
      if (cancelled) return;

      if (hasFreshNewChatGuard) {
        await useProjectStore.getState().clearDisk();
        if (cancelled) return;
        useProjectStore.getState().reset();
      }

      const ai = useAIStore.getState();
      await ai.hydrateHistoryFromDisk();
      if (cancelled) return;

      if (hasFreshNewChatGuard) return;

      const latestAI = useAIStore.getState();
      const hasLiveContext =
        latestAI.chatHistory.length > 0 ||
        latestAI.planSteps.length > 0 ||
        useProjectStore.getState().files.length > 0;
      if (hasLiveContext) return;

      const targetSessionId =
        latestAI.currentSessionId &&
        latestAI.history.some((session) => session.id === latestAI.currentSessionId)
          ? latestAI.currentSessionId
          : null;

      if (!targetSessionId) return;
      useAIStore.getState().restoreSession(targetSessionId);
    };

    void bootstrapHistory().finally(() => {
      if (!cancelled) {
        setBootstrapReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    files,
    activeFile,
    projectName,
    projectType: storedProjectType,
    selectedFeatures: storedSelectedFeatures,
    customFeatureTags: storedCustomFeatureTags,
    constraintsEnforcement: storedConstraintsEnforcement,
    stack,
    description,
    isHydrating: isProjectHydrating,
    reset: resetProject,
    setFiles,
    setFileStructure,
    setActiveFile,
    updateFile,
    upsertFile,
    appendToFile,
    deleteFile,
    moveFile,
    setProjectType: setProjectStoreType,
    setSelectedFeatures: setProjectStoreSelectedFeatures,
    setCustomFeatureTags: setProjectStoreCustomFeatureTags,
    setConstraintsEnforcement: setProjectStoreConstraintsEnforcement,
    setStack,
    setProjectName,
    setProjectId
  } = useProjectStore();
  const { setPreviewUrl, logs, runtimeStatus, runtimeMessage } = usePreviewStore();

  const [thinkingStatus, setThinkingStatus] = useState('');
  const [brainOpen, setBrainOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview' | 'ai'>('editor');
  const [desktopWorkbenchTab, setDesktopWorkbenchTab] = useState<'editor' | 'preview'>('editor');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [constraintsPanelOpen, setConstraintsPanelOpen] = useState(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [completionSuggestions, setCompletionSuggestions] = useState<CompletionSuggestion[]>([]);
  const chatRoundRef = useRef(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [chatAutoFollow, setChatAutoFollow] = useState(true);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [llmConfigHint, setLlmConfigHint] = useState<string>('');
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatResumeTimerRef = useRef<number | null>(null);
  const fileFlushTimerRef = useRef<number | null>(null);
  const fileChunkBuffersRef = useRef<Map<string, string>>(new Map());
  const tokenBeatTimerRef = useRef<number | null>(null);
  const reasoningFlushTimerRef = useRef<number | null>(null);
  const reasoningBufferRef = useRef('');
  const streamCharCountRef = useRef(0);
  const streamLastLogAtRef = useRef(0);
  const lastStatusLogRef = useRef<{ message: string; at: number }>({ message: '', at: 0 });
  const lastChunkEventAtRef = useRef<Record<string, number>>({});
  const autoDebugRef = useRef<{ signature: string; attempts: number }>({ signature: '', attempts: 0 });
  const completionWatchRef = useRef<{ at: number; prompt: string }>({ at: 0, prompt: '' });
  const generationAbortRef = useRef<AbortController | null>(null);
  const pendingEditRequestsRef = useRef<string[]>([]);
  const completionSummaryRef = useRef<{ phase: string; key: string }>({ phase: '', key: '' });
  const autoResumeTriggeredRef = useRef(false);
  const prevPlanCountRef = useRef(0);

  const mainActionState = useMemo<MainActionState>(() => {
    if (isPlanning) return 'planning';
    if (isGenerating) return 'coding';
    if (executionPhase === 'interrupted') return 'interrupted';
    if (files.length > 0) return 'done';
    return 'idle';
  }, [executionPhase, files.length, isGenerating, isPlanning]);

  const currentPlanStepId = useMemo(() => planSteps.find((step) => !step.completed)?.id, [planSteps]);
  const isConsoleVisible = isMobileViewport
    ? mobileTab === 'ai'
    : true;
  const requestedProjectType: ProjectType = projectType || 'FRONTEND_ONLY';
  const effectiveProjectType: ProjectType = FULLSTACK_TEMP_LOCK ? 'FRONTEND_ONLY' : requestedProjectType;
  const modeRecommendation = useMemo(() => {
    const suggested = recommendProjectMode(prompt, effectiveProjectType);
    if (!suggested) return null;
    if (FULLSTACK_TEMP_LOCK && suggested.recommendedMode === 'FULL_STACK') return null;
    return {
      mode: suggested.recommendedMode,
      reason: `${t('app.prompt.projectMode.recommend').replace('{{mode}}', suggested.recommendedMode === 'FULL_STACK'
        ? t('app.workspace.projectType.fullstack')
        : t('app.workspace.projectType.frontend'))} - ${suggested.reason}`
    };
  }, [effectiveProjectType, prompt, t]);

  const chatMessageCountText = useMemo(() => {
    const messageCount = chatHistory.length;
    if (messageCount <= 0) return 'No messages yet';
    return `${messageCount} message${messageCount === 1 ? '' : 's'}`;
  }, [chatHistory.length]);

  const handleChatScroll = useCallback(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nearBottom = distanceToBottom < 36;
    if (nearBottom) {
      setChatAutoFollow(true);
      if (chatResumeTimerRef.current) {
        window.clearTimeout(chatResumeTimerRef.current);
        chatResumeTimerRef.current = null;
      }
      return;
    }

    setChatAutoFollow(false);
    if (chatResumeTimerRef.current) window.clearTimeout(chatResumeTimerRef.current);
    chatResumeTimerRef.current = window.setTimeout(() => {
      setChatAutoFollow(true);
      chatResumeTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (chatResumeTimerRef.current) {
        window.clearTimeout(chatResumeTimerRef.current);
        chatResumeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isMobileViewport) return;
    if (!chatAutoFollow) return;
    const node = chatScrollRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [chatAutoFollow, chatHistory.length, isMobileViewport]);

  useEffect(() => {
    if (!projectType || (FULLSTACK_TEMP_LOCK && projectType !== 'FRONTEND_ONLY')) {
      setProjectType('FRONTEND_ONLY');
    }
  }, [projectType, setProjectType]);

  useEffect(() => {
    if (constraintsEnforcement !== 'hard') {
      setConstraintsEnforcement('hard');
    }
  }, [constraintsEnforcement, setConstraintsEnforcement]);

  useEffect(() => {
    if (!SUPER_MODE_TEMP_DISABLED) return;
    if (modelMode !== 'super') return;
    setModelMode('thinking');
  }, [modelMode, setModelMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (mobileTab === 'ai') return;
    setBrainOpen(false);
  }, [isMobileViewport, mobileTab]);

  const handleProjectTypeSelect = useCallback((type: ProjectType) => {
    const normalized = FULLSTACK_TEMP_LOCK ? 'FRONTEND_ONLY' : type;
    setProjectType(normalized);
    setProjectStoreType(normalized);
    if (error) setError(null);
  }, [error, setError, setProjectType, setProjectStoreType]);

  useEffect(() => {
    setProjectStoreType(effectiveProjectType);
    setProjectStoreSelectedFeatures(selectedFeatures);
    setProjectStoreCustomFeatureTags(customFeatureTags);
    setProjectStoreConstraintsEnforcement(constraintsEnforcement);
  }, [
    constraintsEnforcement,
    customFeatureTags,
    effectiveProjectType,
    selectedFeatures,
    setProjectStoreConstraintsEnforcement,
    setProjectStoreCustomFeatureTags,
    setProjectStoreSelectedFeatures,
    setProjectStoreType
  ]);

  useEffect(() => {
    const normalizedStoredType: ProjectType = FULLSTACK_TEMP_LOCK
      ? 'FRONTEND_ONLY'
      : (storedProjectType || 'FRONTEND_ONLY');

    if (storedProjectType && storedProjectType !== normalizedStoredType) {
      setProjectStoreType(normalizedStoredType);
    }

    if (projectType !== normalizedStoredType) {
      setProjectType(normalizedStoredType);
    }
    if (selectedFeatures.length === 0 && storedSelectedFeatures.length > 0) {
      setSelectedFeatures(storedSelectedFeatures);
    }
    if (customFeatureTags.length === 0 && storedCustomFeatureTags.length > 0) {
      setCustomFeatureTags(storedCustomFeatureTags);
    }
    if (constraintsEnforcement !== storedConstraintsEnforcement) {
      setConstraintsEnforcement(storedConstraintsEnforcement);
    }
  }, [
    constraintsEnforcement,
    customFeatureTags,
    projectType,
    selectedFeatures,
    setConstraintsEnforcement,
    setCustomFeatureTags,
    setProjectStoreType,
    setProjectType,
    setSelectedFeatures,
    storedConstraintsEnforcement,
    storedCustomFeatureTags,
    storedProjectType,
    storedSelectedFeatures
  ]);

  const handleToggleFeature = useCallback(
    (featureId: string) => {
      const exists = selectedFeatures.includes(featureId);
      const next = exists ? selectedFeatures.filter((id) => id !== featureId) : [...selectedFeatures, featureId];
      setSelectedFeatures(next);
    },
    [selectedFeatures, setSelectedFeatures]
  );

  const handleAddCustomFeatureTag = useCallback(
    (tag: string) => {
      const cleaned = String(tag || '').trim();
      if (!cleaned) return;
      if (customFeatureTags.includes(cleaned)) return;
      setCustomFeatureTags([...customFeatureTags, cleaned]);
    },
    [customFeatureTags, setCustomFeatureTags]
  );

  const handleRemoveCustomFeatureTag = useCallback(
    (tag: string) => {
      setCustomFeatureTags(customFeatureTags.filter((entry) => entry !== tag));
    },
    [customFeatureTags, setCustomFeatureTags]
  );

  const constraintsSummary = useMemo(() => {
    const selected = selectedFeatures.length;
    const custom = customFeatureTags.length;
    if (selected === 0 && custom === 0) return t('app.tools.selected.none');
    return `${selected} selected • ${custom} custom`;
  }, [customFeatureTags.length, selectedFeatures.length, t]);

  const constraintsPanelNode = (
    <ToolsPanel
      inline
      selectedFeatures={selectedFeatures}
      customFeatureTags={customFeatureTags}
      onToggleFeature={handleToggleFeature}
      onAddCustomTag={handleAddCustomFeatureTag}
      onRemoveCustomTag={handleRemoveCustomFeatureTag}
    />
  );

  const handleApplyCompletionSuggestion = useCallback((index: number) => {
    const s = completionSuggestions[index];
    if (!s?.prompt) return;
    setPrompt(s.prompt);
    setCompletionSuggestions([]);
    requestAnimationFrame(() => promptRef.current?.focus());
  }, [completionSuggestions, setPrompt]);

  const handleDismissCompletionSuggestions = useCallback(() => {
    setCompletionSuggestions([]);
  }, []);

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
    (message: string, source: 'system' | 'stream' | 'file' | 'preview' | 'user' = 'system') => {
      const now = Date.now();
      const trimmed = String(message || '').trim();
      const isStatus = trimmed.startsWith('[STATUS]');
      if (isStatus) {
        const last = lastStatusLogRef.current;
        if (last.message === trimmed && now - last.at < 900) {
          return;
        }
        lastStatusLogRef.current = { message: trimmed, at: now };
      }
      appendSystemConsoleContent(`${stamp()} ${message}\n`);
      const level = /\b(error|failed|interrupt|timeout)\b/i.test(trimmed)
        ? 'error'
        : /\bwarn|degraded|partial\b/i.test(trimmed)
          ? 'warn'
          : /\bcomplete|ready|fixed|applied|ok\b/i.test(trimmed)
            ? 'success'
            : 'info';
      addBrainEvent({
        source,
        level,
        message: trimmed
      });
    },
    [addBrainEvent, appendSystemConsoleContent]
  );

  useEffect(() => {
    addBrainEvent({
      source: 'system',
      level: executionPhase === 'interrupted' ? 'warn' : executionPhase === 'completed' ? 'success' : 'info',
      message: `Execution phase → ${executionPhase}`,
      phase: executionPhase
    });
  }, [addBrainEvent, executionPhase]);

  useEffect(() => {
    addBrainEvent({
      source: 'preview',
      level: runtimeStatus === 'error' ? 'error' : runtimeStatus === 'ready' ? 'success' : 'info',
      message: `Preview runtime → ${runtimeStatus}`
    });
  }, [addBrainEvent, runtimeStatus]);

  useEffect(() => {
    if (isGenerating || isPlanning) return;
    if (executionPhase !== 'completed' && executionPhase !== 'interrupted') return;
    if (!lastTokenAt || Date.now() - lastTokenAt > 120000) return;

    const completedFiles = useAIStore.getState().completedFiles || [];
    const fallbackRecent = files
      .slice(-5)
      .map((f) => f.path || f.name || '')
      .filter(Boolean);
    const recent = (completedFiles.slice(-5).length > 0 ? completedFiles.slice(-5) : fallbackRecent).slice(-5);
    const planTotal = planSteps.length;
    const planDone = planSteps.filter((step) => step.completed).length;
    const defaultFollowUp =
      executionPhase === 'completed'
        ? 'هل تريد أن أنفذ تحسين جودة نهائي (Quality pass) قبل التسليم النهائي؟'
        : 'هل تريد مني الاستكمال من آخر نقطة مستقرة أم تعديل المطلوب أولاً؟';
    const followUpQuestion = completionSuggestions[0]?.question || defaultFollowUp;
    const summaryKey = [
      executionPhase,
      files.length,
      planDone,
      planTotal,
      recent.join('|'),
      followUpQuestion
    ].join('::');
    if (completionSummaryRef.current.phase === executionPhase && completionSummaryRef.current.key === summaryKey) {
      return;
    }
    completionSummaryRef.current = { phase: executionPhase, key: summaryKey };

    if (executionPhase === 'completed') {
      addChatMessage({
        role: 'assistant',
        kind: 'completion-summary',
        signature: summaryKey,
        round: chatRoundRef.current,
        createdAt: Date.now(),
        content: [
          'تم تنفيذ المهمة بنجاح.',
          `- عدد الملفات التي تم إنشاؤها/تحديثها: ${files.length}.`,
          planTotal > 0 ? `- التقدّم في الخطة: ${planDone}/${planTotal}.` : '',
          recent.length > 0 ? `- آخر الملفات المتأثرة: ${recent.join(', ')}.` : '',
          `- حالة المعاينة الحالية: ${runtimeStatus}${runtimeMessage ? ` (${runtimeMessage})` : ''}.`,
          '',
          `سؤال متابعة: ${followUpQuestion}`
        ]
          .filter(Boolean)
          .join('\n')
      });
      return;
    }

    addChatMessage({
      role: 'assistant',
      content: [
        'التنفيذ توقف قبل الاكتمال.',
        recent.length > 0 ? `- آخر الملفات التي تم العمل عليها: ${recent.join(', ')}.` : '',
        `- حالة المعاينة الحالية: ${runtimeStatus}${runtimeMessage ? ` (${runtimeMessage})` : ''}.`,
        '',
        `سؤال متابعة: ${followUpQuestion}`
      ]
        .filter(Boolean)
        .join('\n')
    });
  }, [
    addChatMessage,
    completionSuggestions,
    executionPhase,
    files,
    isGenerating,
    isPlanning,
    lastTokenAt,
    planSteps,
    runtimeMessage,
    runtimeStatus
  ]);

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
    if (!bootstrapReady || isProjectHydrating) return;
    if (files.length > 0) return;
    if (interactionMode !== 'edit') return;
    setInteractionMode('create');
  }, [bootstrapReady, files.length, interactionMode, isProjectHydrating, setInteractionMode]);

  const flushFileBuffers = useCallback((options?: { onlyPath?: string; force?: boolean }) => {
    if (fileChunkBuffersRef.current.size === 0) return;

    const writingPath = useAIStore.getState().writingFilePath || '';
    const activePath = useProjectStore.getState().activeFile || '';
    const onlyPath = options?.onlyPath;
    const force = options?.force === true;

    // Keep UI responsive: only stream partial updates for the active/writing file.
    // Flush all remaining content for a file only on "end" (force=true).
    const maxActive = 6000;
    let needsAnotherFlush = false;

    for (const [path, buffer] of fileChunkBuffersRef.current.entries()) {
      if (onlyPath && path !== onlyPath) continue;
      if (!buffer) {
        fileChunkBuffersRef.current.delete(path);
        continue;
      }

      const shouldFlush = force || path === writingPath || path === activePath;
      if (!shouldFlush) continue;

      const max = force ? buffer.length : maxActive;
      const chunk = buffer.length <= max ? buffer : buffer.slice(0, max);
      const rest = buffer.length <= max ? '' : buffer.slice(max);

      appendToFile(path, chunk);

      if (rest.length === 0) fileChunkBuffersRef.current.delete(path);
      else {
        fileChunkBuffersRef.current.set(path, rest);
        needsAnotherFlush = true;
      }
    }

    if (!fileFlushTimerRef.current && needsAnotherFlush) {
      fileFlushTimerRef.current = window.setTimeout(() => {
        fileFlushTimerRef.current = null;
        flushFileBuffers(options);
      }, 140);
    }
  }, [appendToFile]);

  const scheduleFileFlush = useCallback(() => {
    if (fileFlushTimerRef.current) return;
    fileFlushTimerRef.current = window.setTimeout(() => {
      fileFlushTimerRef.current = null;
      flushFileBuffers();
    }, 140);
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

  const stopGeneration = useCallback(() => {
    const controller = generationAbortRef.current;
    if (!controller) return;

    logSystem('[STATUS] Stop requested by user.');
    clearAutoResumePayload();
    setExecutionPhase('interrupted');
    setThinkingStatus('Stopping…');

    try {
      controller.abort();
    } catch {
      // ignore
    }

    flushFileBuffers({ force: true });
    flushReasoningBuffer();
  }, [flushFileBuffers, flushReasoningBuffer, logSystem, setExecutionPhase]);

  const getGenerationConstraints = useCallback((): GenerationConstraints => {
    return {
      projectMode: effectiveProjectType,
      selectedFeatures,
      customFeatureTags,
      enforcement: constraintsEnforcement,
      qualityGateMode: 'strict',
      siteArchitectureMode: 'adaptive_multi_page',
      fileControlMode: 'safe_full',
      contextIntelligenceMode: 'balanced_graph'
    };
  }, [constraintsEnforcement, customFeatureTags, effectiveProjectType, selectedFeatures]);

  const buildAgentContextBlock = useCallback((requestPrompt: string) => {
    const projectState = useProjectStore.getState();
    const aiState = useAIStore.getState();
    const previewState = usePreviewStore.getState();
    const recentPreviewErrors = previewState.logs.slice(-24).map((entry) => String(entry.message || ''));
    const contextBundle = buildContextBundle({
      files: projectState.files,
      activeFile: projectState.activeFile,
      recentPreviewErrors,
      prompt: requestPrompt,
      mode: 'balanced_graph',
      maxFiles: 12
    });

    const paths = projectState.files
      .map((f) => String(f.path || f.name || '').replace(/\\/g, '/').trim())
      .filter(Boolean);
    const foldersDigest = extractTopFolders(paths);
    const recentLogTail = previewState.logs
      .slice(-12)
      .map((entry) => String(entry.message || '').trim())
      .filter(Boolean)
      .join(' | ')
      .slice(0, 2200);
    const contextSnippets = contextBundle.files
      .slice(0, 8)
      .map((file) => `[[CTX_FILE: ${file.path} | score=${file.score.toFixed(1)}]]\n${String(file.snippet || '').slice(0, 1200)}\n[[END_CTX_FILE]]`)
      .join('\n');
    const frontendCompletionTarget =
      effectiveProjectType === 'FRONTEND_ONLY'
        ? [
            '[FRONTEND COMPLETION TARGET]',
            '- Build full UI flow with coherent visual design and complete sections.',
            '- Return runnable frontend files only with clean structure and no backend files.',
            '- Guarantee simple preview health before final completion.'
          ].join('\n')
        : '';

    return [
      '[AGENT WORKSPACE INTELLIGENCE]',
      `User Intent: ${requestPrompt || '(empty)'}`,
      `Project Mode: ${effectiveProjectType}`,
      `Project Name: ${projectState.projectName || '(untitled)'}`,
      `Stack: ${projectState.stack || '(auto)'}`,
      `Known Files Count: ${paths.length}`,
      `Top Folders: ${foldersDigest || '(none)'}`,
      `Active File: ${projectState.activeFile || '(none)'}`,
      `Execution Phase: ${aiState.executionPhase}`,
      `Context Utilization: ${Number(aiState.contextBudget?.utilizationPct || 0).toFixed(1)}%`,
      `Preview Runtime: ${previewState.runtimeStatus}${previewState.runtimeMessage ? ` (${previewState.runtimeMessage})` : ''}`,
      recentLogTail ? `Recent Preview Logs: ${recentLogTail}` : 'Recent Preview Logs: (none)',
      contextSnippets ? `Retrieved Context Snippets:\n${contextSnippets}` : 'Retrieved Context Snippets: (none)',
      frontendCompletionTarget,
      'Agent Duties: diagnose, implement, self-verify, and auto-heal preview/runtime issues before finalizing.'
    ]
      .filter(Boolean)
      .join('\n');
  }, [effectiveProjectType]);

  const handleGenerate = useCallback(async (
    promptOverride?: string,
    options?: { skipPlanning?: boolean; preserveProjectMeta?: boolean; resume?: boolean }
  ) => {
    const requestedResume = options?.resume === true;
    const rawPrompt = (promptOverride ?? prompt).trim();
    const fallbackPrompt = requestedResume ? String(useAIStore.getState().lastPlannedPrompt || '').trim() : '';
    const basePrompt = (rawPrompt || fallbackPrompt).trim();
    if (!basePrompt || isPlanning || isGenerating) return;
    try {
      const providerStatus = await aiService.getProviderStatus();
      setLlmConfigured(providerStatus.configured);
      setLlmConfigHint(String(providerStatus.hint || ''));
      if (!providerStatus.configured) {
        const msg = providerStatus.hint || 'LLM_NOT_CONFIGURED: backend AI provider is not configured.';
        setError(msg);
        logSystem(`[STATUS] ${msg}`);
        return;
      }
    } catch {
      const msg = 'LLM_NOT_CONFIGURED: cannot verify backend AI provider. Check API server and DEEPSEEK_API_KEY.';
      setLlmConfigured(false);
      setLlmConfigHint(msg);
      setError(msg);
      logSystem(`[STATUS] ${msg}`);
      return;
    }
    const generationConstraints = getGenerationConstraints();
    const constraintsBlock = buildGenerationConstraintsBlock(generationConstraints);
    const scopedPrompt = mergePromptWithConstraints(basePrompt, generationConstraints);
    const agentContextBlock = buildAgentContextBlock(basePrompt);
    const scopedPromptWithAgentContext = `${scopedPrompt}\n\n${agentContextBlock}`.trim();

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeAutoResumePayload({
      prompt: basePrompt,
      at: Date.now(),
      attempts: 0,
      runId,
      state: 'running',
      resumeEligible: true
    });

    useAIStore.getState().saveCurrentSession();

    const skipPlanning = options?.skipPlanning === true;
    const isResuming = requestedResume;
    const preserveProjectMeta = options?.preserveProjectMeta === true || isResuming;

    autoDebugRef.current = { signature: '', attempts: 0 };
    completionWatchRef.current = { at: 0, prompt: '' };
    setCompletionSuggestions([]);

    const abortController = new AbortController();
    generationAbortRef.current = abortController;

    clearBrainEvents();
    setIsGenerating(true);
    setExecutionPhase(architectMode && !skipPlanning && !isResuming ? 'planning' : 'executing');
    setError(null);
    setPreviewUrl(null);
    setSections({});
    setStreamText('');
    clearThinkingContent();
    clearSystemConsoleContent();
    logSystem('[STATUS] Starting generation pipeline…');
    logSystem('[preview] Waiting for code generation to finish…');
    setBrainOpen(false);
    setThinkingStatus(isResuming ? 'Resuming…' : 'Initializing…');
    streamCharCountRef.current = 0;
    streamLastLogAtRef.current = Date.now();
    if (!isResuming) clearFileStatuses();
    setWritingFilePath(null);
    if (!preserveProjectMeta) resetProject();
    if (!preserveProjectMeta) resetFiles();
    if (!preserveProjectMeta) {
      setStack(effectiveProjectType === 'FRONTEND_ONLY' ? 'Frontend (HTML/CSS/JS)' : 'Fullstack (Frontend + Backend)');
    }
    if (!String(useProjectStore.getState().projectId || '').trim()) {
      setProjectId(createProjectId(projectName || basePrompt));
    }

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

    try {
      let generationSucceeded = false;
      const filePathMap = new Map<string, string>();
      const partialPaths = new Set<string>();
      const filesByBaseName = new Map<string, string>();
      for (const file of useProjectStore.getState().files) {
        const existingPath = String(file.path || file.name || '').replace(/\\/g, '/').trim();
        if (!existingPath) continue;
        const base = (existingPath.split('/').pop() || existingPath).toLowerCase();
        filesByBaseName.set(base, existingPath);
      }

      const resumeSnapshot = useAIStore.getState();
      const resumeContext = isResuming
        ? {
            completedFiles: resumeSnapshot.completedFiles,
            lastSuccessfulFile: resumeSnapshot.lastSuccessfulFile,
            lastSuccessfulLine: resumeSnapshot.lastSuccessfulLine
          }
        : undefined;

      const partialFile = isResuming
        ? Object.entries(resumeSnapshot.fileStatuses).find(([_, s]) => s === 'partial')?.[0] || null
        : null;

      const baseStreamPrompt = partialFile
        ? `CONTINUE ${partialFile} FROM LINE ${Number(resumeSnapshot.lastSuccessfulLine || 0) + 1}.\n\nOriginal Request: ${scopedPromptWithAgentContext}`
        : scopedPromptWithAgentContext;

      // Use global autosave function (defined outside for independence)
      const scheduleAutosave = globalScheduleAutosave;
      const resolveGeneratedPath = (rawPath: string) => {
        if (filePathMap.has(rawPath)) return filePathMap.get(rawPath) as string;
        const normalized = resolveFilePath(rawPath);
        const finalPath = normalized || rawPath;
        filePathMap.set(rawPath, finalPath);
        return finalPath;
      };
      const fileMutationEngine = createFileMutationEngine({
        resolvePath: resolveGeneratedPath,
        basenameRegistry: filesByBaseName,
        duplicateSensitiveBasenames: new Set([
          'index.html',
          'style.css',
          'styles.css',
          'script.js',
          'main.js',
          'app.js',
          'index.css',
          'package.json'
        ])
      });

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
  © 2026 Apex Coding | AI-Powered Developer Platform
</footer>`;

      const injectBrandingFooter = (html: string) => {
        const signature = '© 2026 Apex Coding | AI-Powered Developer Platform';
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

      const repairCommentKeywordGlue = (input: string) => {
        const lines = String(input || '').split('\n');
        let changed = false;
        const repaired = lines.flatMap((line) => {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith('//')) return [line];

          const match = line.match(/\b(const|let|var|function|class)\b/);
          if (!match || typeof match.index !== 'number') return [line];
          const idx = match.index;
          if (idx <= 0) return [line];
          const prevChar = line[idx - 1];
          if (/\s/.test(prevChar)) return [line];

          changed = true;
          return [line.slice(0, idx), line.slice(idx)];
        });

        if (!changed) return input;
        return repaired.join('\n');
      };

      const analyzeScriptIntegrity = (source: string, extension: string) => {
        const text = String(source || '');
        if (!text.trim()) return { ok: true as const, reason: '' };

        let brace = 0;
        let paren = 0;
        let bracket = 0;
        let inSingle = false;
        let inDouble = false;
        let inTemplate = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const next = text[i + 1];

          if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
          }

          if (inBlockComment) {
            if (ch === '*' && next === '/') {
              inBlockComment = false;
              i += 1;
            }
            continue;
          }

          if (inSingle) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '\'') inSingle = false;
            continue;
          }

          if (inDouble) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inDouble = false;
            continue;
          }

          if (inTemplate) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '`') inTemplate = false;
            continue;
          }

          if (ch === '/' && next === '/') {
            inLineComment = true;
            i += 1;
            continue;
          }

          if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 1;
            continue;
          }

          if (ch === '\'') {
            inSingle = true;
            continue;
          }
          if (ch === '"') {
            inDouble = true;
            continue;
          }
          if (ch === '`') {
            inTemplate = true;
            continue;
          }

          if (ch === '{') brace += 1;
          else if (ch === '}') brace -= 1;
          else if (ch === '(') paren += 1;
          else if (ch === ')') paren -= 1;
          else if (ch === '[') bracket += 1;
          else if (ch === ']') bracket -= 1;

          if (brace < 0 || paren < 0 || bracket < 0) {
            return { ok: false as const, reason: 'Unexpected closing token sequence' };
          }
        }

        if (inSingle || inDouble || inTemplate || inBlockComment) {
          return { ok: false as const, reason: 'Unterminated string/template/comment' };
        }

        if (brace !== 0 || paren !== 0 || bracket !== 0) {
          return { ok: false as const, reason: 'Unbalanced brackets/parentheses/braces' };
        }

        const isPlainScript = extension === 'js' && !/^\s*(import|export)\s/m.test(text);
        if (isPlainScript) {
          try {
            // eslint-disable-next-line no-new-func
            new Function(text);
          } catch (err: any) {
            return { ok: false as const, reason: err?.message || 'Syntax check failed' };
          }
        }

        return { ok: true as const, reason: '' };
      };

      const analyzeCssIntegrity = (source: string) => {
        const text = String(source || '');
        if (!text.trim()) return { ok: true as const, reason: '' };

        let brace = 0;
        let inSingle = false;
        let inDouble = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const next = text[i + 1];

          if (inBlockComment) {
            if (ch === '*' && next === '/') {
              inBlockComment = false;
              i += 1;
            }
            continue;
          }

          if (inSingle) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '\'') inSingle = false;
            continue;
          }

          if (inDouble) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inDouble = false;
            continue;
          }

          if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 1;
            continue;
          }

          if (ch === '\'') {
            inSingle = true;
            continue;
          }
          if (ch === '"') {
            inDouble = true;
            continue;
          }

          if (ch === '{') brace += 1;
          else if (ch === '}') {
            brace -= 1;
            if (brace < 0) {
              return { ok: false as const, reason: 'Unexpected closing brace' };
            }
          }
        }

        if (inSingle || inDouble || inBlockComment) {
          return { ok: false as const, reason: 'Unterminated CSS string/comment' };
        }
        if (brace !== 0) {
          return { ok: false as const, reason: 'Unbalanced CSS braces' };
        }
        return { ok: true as const, reason: '' };
      };

      const repairCssBraceMismatch = (source: string) => {
        const text = String(source || '');
        if (!text.trim()) return text;

        let brace = 0;
        let inSingle = false;
        let inDouble = false;
        let inBlockComment = false;
        let escaped = false;
        let changed = false;
        const out: string[] = [];

        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const next = text[i + 1];

          if (inBlockComment) {
            out.push(ch);
            if (ch === '*' && next === '/') {
              out.push(next);
              inBlockComment = false;
              i += 1;
            }
            continue;
          }

          if (inSingle) {
            out.push(ch);
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '\'') inSingle = false;
            continue;
          }

          if (inDouble) {
            out.push(ch);
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inDouble = false;
            continue;
          }

          if (ch === '/' && next === '*') {
            out.push(ch, next);
            inBlockComment = true;
            i += 1;
            continue;
          }

          if (ch === '\'') {
            out.push(ch);
            inSingle = true;
            continue;
          }

          if (ch === '"') {
            out.push(ch);
            inDouble = true;
            continue;
          }

          if (ch === '{') {
            brace += 1;
            out.push(ch);
            continue;
          }

          if (ch === '}') {
            if (brace <= 0) {
              changed = true;
              continue;
            }
            brace -= 1;
            out.push(ch);
            continue;
          }

          out.push(ch);
        }

        if (brace > 0) {
          changed = true;
          out.push(`\n${'}\n'.repeat(brace)}`);
        }

        return changed ? out.join('') : text;
      };

      const deterministicCssSelfHeal = (path: string, source: string) => {
        const current = String(source || '');
        const integrity = analyzeCssIntegrity(current);
        if (integrity.ok) return { content: current, repaired: false, ok: true as const, reason: '' };

        const repaired = repairCssBraceMismatch(current);
        if (repaired !== current) {
          const post = analyzeCssIntegrity(repaired);
          return { content: repaired, repaired: true, ok: post.ok, reason: post.reason };
        }

        return { content: current, repaired: false, ok: false as const, reason: integrity.reason };
      };

      const repairScriptBracketMismatch = (source: string) => {
        const text = String(source || '');
        if (!text.trim()) return text;

        const closers: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
        const expectedOpeners: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
        const stack: string[] = [];

        let inSingle = false;
        let inDouble = false;
        let inTemplate = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;
        let changed = false;
        const out: string[] = [];

        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const next = text[i + 1];

          if (inLineComment) {
            out.push(ch);
            if (ch === '\n') inLineComment = false;
            continue;
          }

          if (inBlockComment) {
            out.push(ch);
            if (ch === '*' && next === '/') {
              out.push(next);
              inBlockComment = false;
              i += 1;
            }
            continue;
          }

          if (inSingle) {
            out.push(ch);
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '\'') inSingle = false;
            continue;
          }

          if (inDouble) {
            out.push(ch);
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inDouble = false;
            continue;
          }

          if (inTemplate) {
            out.push(ch);
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '`') inTemplate = false;
            continue;
          }

          if (ch === '/' && next === '/') {
            out.push(ch, next);
            inLineComment = true;
            i += 1;
            continue;
          }

          if (ch === '/' && next === '*') {
            out.push(ch, next);
            inBlockComment = true;
            i += 1;
            continue;
          }

          if (ch === '\'') {
            out.push(ch);
            inSingle = true;
            continue;
          }
          if (ch === '"') {
            out.push(ch);
            inDouble = true;
            continue;
          }
          if (ch === '`') {
            out.push(ch);
            inTemplate = true;
            continue;
          }

          if (ch === '{' || ch === '(' || ch === '[') {
            stack.push(ch);
            out.push(ch);
            continue;
          }

          if (ch === '}' || ch === ')' || ch === ']') {
            const expected = expectedOpeners[ch];
            const top = stack.length > 0 ? stack[stack.length - 1] : '';
            if (top !== expected) {
              changed = true;
              continue;
            }
            stack.pop();
            out.push(ch);
            continue;
          }

          out.push(ch);
        }

        if (stack.length > 0) {
          changed = true;
          for (let i = stack.length - 1; i >= 0; i--) {
            const opener = stack[i];
            out.push(closers[opener] || '');
          }
        }

        return changed ? out.join('') : text;
      };

      const deterministicJsSelfHeal = (path: string, source: string, extension: string) => {
        const current = String(source || '');
        const firstPass = repairCommentKeywordGlue(current);
        const secondPass = repairScriptBracketMismatch(firstPass);
        if (secondPass === current) {
          const integrity = analyzeScriptIntegrity(current, extension);
          return { content: current, repaired: false, ok: integrity.ok, reason: integrity.reason };
        }

        const post = analyzeScriptIntegrity(secondPass, extension);
        if (post.ok) {
          return { content: secondPass, repaired: true, ok: true as const, reason: '' };
        }

        return { content: current, repaired: false, ok: false as const, reason: post.reason || 'Syntax check failed' };
      };

      const deterministicHtmlSelfHeal = (path: string, source: string) => {
        const current = String(source || '');
        const healed = healHtmlDocument(stripPartialMarkerAtEnd(current));
        const branded = injectBrandingFooter(healed);
        const repaired = branded !== current;
        return { content: branded, repaired, ok: true as const, reason: '' };
      };

      const applyDeterministicHiddenSyntaxSelfHeal = () => {
        const filesSnapshot = useProjectStore.getState().files;
        const touched: string[] = [];
        const createOrUpdateFile = (path: string, content: string) => {
          updateFile(path, content);
          upsertFileNode(path, content);
          upsertFile({
            name: path.split('/').pop() || path,
            path,
            content,
            language: getLanguageFromExtension(path)
          });
        };

        for (const file of filesSnapshot) {
          const path = String(file.path || file.name || '').trim();
          if (!path) continue;
          const lower = path.toLowerCase();
          const content = String(file.content || '');

          let result:
            | { content: string; repaired: boolean; ok: boolean; reason: string }
            | null = null;

          if (lower.endsWith('.css')) {
            result = deterministicCssSelfHeal(path, content);
          } else if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
            const extension = lower.split('.').pop() || 'js';
            result = deterministicJsSelfHeal(path, content, extension);
          } else if (lower.endsWith('/index.html') || lower === 'index.html') {
            result = deterministicHtmlSelfHeal(path, content);
          }

          if (!result) continue;
          if (!result.repaired) continue;

          createOrUpdateFile(path, result.content);
          touched.push(path);
        }

        if (touched.length > 0) {
          setFilesFromProjectFiles(useProjectStore.getState().files);
        }

        return touched;
      };


      const SENSITIVE_PATH_RE = /(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|vite\.config\.(js|ts)|next\.config\.(js|mjs|ts)|tsconfig\.json)$/i;
      const normalizeRefPath = (value: string) =>
        String(value || '')
          .replace(/\\/g, '/')
          .replace(/^\.\//, '')
          .trim();

      const collectPathReferenceHits = (targetPath: string) => {
        const normalizedTarget = normalizeRefPath(targetPath);
        const targetName = normalizedTarget.split('/').pop() || normalizedTarget;
        return useProjectStore
          .getState()
          .files.filter((file) => {
            const filePath = normalizeRefPath(file.path || file.name || '');
            if (!filePath || filePath === normalizedTarget) return false;
            const content = String(file.content || '');
            if (!content) return false;
            return (
              content.includes(normalizedTarget) ||
              content.includes(`/${normalizedTarget}`) ||
              content.includes(`./${targetName}`) ||
              content.includes(`/${targetName}`)
            );
          })
          .map((file) => normalizeRefPath(file.path || file.name || ''));
      };

      const hasExplicitSafetyReason = (reason?: string) =>
        /\b(import|imports|link|links|route|routing|rewrite|refactor|safe|cleanup|unused|orphan)\b/i.test(
          String(reason || '')
        );

      const handleFileEvent = (incomingEvent: StreamFileEvent) => {
        const event = fileMutationEngine.applyFileOperation(incomingEvent);
        if (!event) return;
        if (event.type === 'delete') {
          const resolvedPath = resolveGeneratedPath(event.path || '');
          if (!resolvedPath) return;

          const reason = String(event.reason || '').trim();
          const isSensitive = SENSITIVE_PATH_RE.test(resolvedPath);
          if (isSensitive && !hasExplicitSafetyReason(reason)) {
            logSystem(`[SAFETY] Blocked delete for sensitive file: ${resolvedPath} (missing explicit reason)`);
            addBrainEvent({
              source: 'file',
              level: 'warn',
              message: `Blocked delete for sensitive file ${resolvedPath}`,
              path: resolvedPath,
              phase: 'recovering'
            });
            return;
          }

          deleteFile(resolvedPath);
          filesByBaseName.delete((resolvedPath.split('/').pop() || resolvedPath).toLowerCase());
          setFilesFromProjectFiles(useProjectStore.getState().files);
          setFileStatus(resolvedPath, 'ready');
          logSystem(`[STATUS] Deleted ${resolvedPath}${reason ? ` (${reason})` : ''}`);
          addBrainEvent({
            source: 'file',
            level: 'info',
            message: `Deleted ${resolvedPath}`,
            path: resolvedPath,
            phase: 'executing'
          });
          scheduleAutosave();
          return;
        }

        if (event.type === 'move') {
          const fromPath = resolveGeneratedPath(event.path || '');
          const toPath = resolveGeneratedPath(event.toPath || '');
          if (!fromPath || !toPath) return;

          const reason = String(event.reason || '').trim();
          const isSensitive = SENSITIVE_PATH_RE.test(fromPath);
          if (isSensitive && !hasExplicitSafetyReason(reason)) {
            logSystem(`[SAFETY] Blocked move for sensitive file: ${fromPath} -> ${toPath}`);
            addBrainEvent({
              source: 'file',
              level: 'warn',
              message: `Blocked move for sensitive file ${fromPath}`,
              path: fromPath,
              phase: 'recovering'
            });
            return;
          }

          const referenceHits = collectPathReferenceHits(fromPath);
          if (referenceHits.length > 0 && !hasExplicitSafetyReason(reason)) {
            logSystem(
              `[SAFETY] Blocked move ${fromPath} -> ${toPath}. References exist in: ${referenceHits.slice(0, 6).join(', ')}`
            );
            addBrainEvent({
              source: 'file',
              level: 'warn',
              message: `Blocked move for ${fromPath}; unresolved references detected`,
              path: fromPath,
              phase: 'recovering'
            });
            return;
          }

          moveFile(fromPath, toPath);
          filesByBaseName.delete((fromPath.split('/').pop() || fromPath).toLowerCase());
          filesByBaseName.set((toPath.split('/').pop() || toPath).toLowerCase(), toPath);
          setFilesFromProjectFiles(useProjectStore.getState().files);
          setFileStatus(fromPath, 'ready');
          setFileStatus(toPath, 'ready');
          logSystem(`[STATUS] Moved ${fromPath} -> ${toPath}${reason ? ` (${reason})` : ''}`);
          addBrainEvent({
            source: 'file',
            level: 'info',
            message: `Moved ${fromPath} -> ${toPath}`,
            path: toPath,
            phase: 'executing'
          });
          scheduleAutosave();
          return;
        }

        let resolvedPath = resolveGeneratedPath(event.path || '');
        if (!resolvedPath) return;

        const baseName = resolvedPath.split('/').pop() || resolvedPath;
        filesByBaseName.set(baseName.toLowerCase(), resolvedPath);

        if (event.type === 'start') {
          const label = event.mode === 'edit' ? 'Editing' : 'Writing';
          logSystem(`[STATUS] ${label} ${resolvedPath}...`);
          addBrainEvent({
            source: 'file',
            level: 'info',
            message: `${label} ${resolvedPath}`,
            path: resolvedPath,
            phase: 'writing'
          });
          setThinkingStatus(`Writing ${resolvedPath.split('/').pop() || resolvedPath}…`);
          setFileStatus(resolvedPath, 'writing');
          setStreamText('');

          upsertFileNode(resolvedPath);
          const name = resolvedPath.split('/').pop() || resolvedPath;
          const existing = useProjectStore.getState().files.find((f) => (f.path || f.name) === resolvedPath);

          if (!existing) {
            upsertFile({ name, path: resolvedPath, content: '', language: getLanguageFromExtension(resolvedPath) });
          }

          if (event.append) {
            const current = existing?.content || '';
            const cleaned = stripPartialMarkerAtEnd(current);
            let finalText = cleaned;
            
            if (event.partial) {
               finalText = repairTruncatedContent(cleaned, resolvedPath, { isKnownPartial: true, allowAggressiveFixes: false });
               if (finalText !== cleaned) {
                  logSystem(`[REPAIR] Fixed truncated file: ${resolvedPath}`);
                  setFileStatus(resolvedPath, 'compromised');
               } else {
                  setFileStatus(resolvedPath, 'partial');
               }
            } else {
               setFileStatus(resolvedPath, 'ready');
            }

            updateFile(resolvedPath, finalText);
            upsertFileNode(resolvedPath, finalText);
            upsertFile({ name, path: resolvedPath, content: finalText, language: getLanguageFromExtension(resolvedPath) });
          } else if (event.mode === 'edit') {
            // EDIT MODE: preserve existing content as backup
            // The AI will send the full updated version — if stream is interrupted, old content stays
            const prevWriting = useAIStore.getState().writingFilePath;
            if (prevWriting) flushFileBuffers({ onlyPath: prevWriting, force: true });
            fileChunkBuffersRef.current.delete(resolvedPath);
            // Do NOT clear the file — keep existing content as safety net
          } else {
            // CREATE MODE: clear and start fresh
            const prevWriting = useAIStore.getState().writingFilePath;
            if (prevWriting) flushFileBuffers({ onlyPath: prevWriting, force: true });
            fileChunkBuffersRef.current.delete(resolvedPath);
            updateFile(resolvedPath, '');
            upsertFileNode(resolvedPath, '');
          }

          setWritingFilePath(resolvedPath);
          setActiveFile(resolvedPath);
          setMobileTab('editor');
          setBrainOpen(true);
          if (effectiveProjectType === 'FRONTEND_ONLY') {
            const lower = resolvedPath.toLowerCase();
            if (/\.(html|css|js|jsx|ts|tsx)$/i.test(lower) || lower.endsWith('index.html')) {
              setIsPreviewOpen(true);
            }
          }
          return;
        }

        if (event.type === 'chunk') {
          const chunk = String(event.chunk || '');
          if (chunk.length === 0) return;
          fileChunkBuffersRef.current.set(resolvedPath, (fileChunkBuffersRef.current.get(resolvedPath) || '') + chunk);
          scheduleFileFlush();
          const now = Date.now();
          const last = Number(lastChunkEventAtRef.current[resolvedPath] || 0);
          if (now - last > 1800) {
            lastChunkEventAtRef.current[resolvedPath] = now;
            addBrainEvent({
              source: 'file',
              level: 'info',
              message: `Streaming chunk → ${resolvedPath}`,
              path: resolvedPath,
              phase: 'executing'
            });
          }
          return;
        }

        if (event.type === 'end') {
          flushFileBuffers({ onlyPath: resolvedPath, force: true });
          fileChunkBuffersRef.current.delete(resolvedPath);
          const currentStatus = useAIStore.getState().fileStatuses?.[resolvedPath];
          let effectivePartial = Boolean(event.partial);
          if (effectivePartial) setFileStatus(resolvedPath, 'partial');
          else if (currentStatus !== 'compromised') setFileStatus(resolvedPath, 'ready');
          if (useAIStore.getState().writingFilePath === resolvedPath) setWritingFilePath(null);

          if (typeof event.line === 'number') {
            useAIStore.getState().setExecutionCursor(resolvedPath, event.line);
          }

          let latest = useProjectStore.getState().files.find((f) => (f.path || f.name) === resolvedPath)?.content || '';
          const extension = resolvedPath.includes('.') ? (resolvedPath.split('.').pop() || '').toLowerCase() : '';

          if (!effectivePartial && extension === 'js') {
            const healed = repairCommentKeywordGlue(latest);
            if (healed !== latest) {
              latest = healed;
              updateFile(resolvedPath, healed);
              upsertFileNode(resolvedPath, healed);
              upsertFile({
                name: resolvedPath.split('/').pop() || resolvedPath,
                path: resolvedPath,
                content: healed,
                language: getLanguageFromExtension(resolvedPath)
              });
              logSystem(`[REPAIR] Fixed glued comment/code boundary in ${resolvedPath}`);
            }
          }

          if (!effectivePartial && extension === 'css') {
            const cssResult = deterministicCssSelfHeal(resolvedPath, latest);
            if (cssResult.repaired) {
              latest = cssResult.content;
              updateFile(resolvedPath, latest);
              upsertFileNode(resolvedPath, latest);
              upsertFile({
                name: resolvedPath.split('/').pop() || resolvedPath,
                path: resolvedPath,
                content: latest,
                language: getLanguageFromExtension(resolvedPath)
              });
              logSystem(`[REPAIR] Balanced CSS braces in ${resolvedPath}`);
            }

            if (!cssResult.ok) {
              effectivePartial = true;
              setFileStatus(resolvedPath, 'partial');
              logSystem(`[STATUS] CSS integrity check failed for ${resolvedPath}: ${cssResult.reason}. Marked as partial for auto-resume.`);
              addBrainEvent({
                source: 'file',
                level: 'warn',
                message: `Integrity mismatch in ${resolvedPath} -> auto-resume`,
                path: resolvedPath,
                phase: 'recovering'
              });
            }
          }

          if (
            !effectivePartial &&
            ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(extension)
          ) {
            const integrity = analyzeScriptIntegrity(latest, extension);
            if (!integrity.ok) {
              effectivePartial = true;
              setFileStatus(resolvedPath, 'partial');
              logSystem(`[STATUS] Integrity check failed for ${resolvedPath}: ${integrity.reason}. Marked as partial for auto-resume.`);
              addBrainEvent({
                source: 'file',
                level: 'warn',
                message: `Integrity mismatch in ${resolvedPath} -> auto-resume`,
                path: resolvedPath,
                phase: 'recovering'
              });
            }
          }

          if (resolvedPath.toLowerCase().endsWith('.html')) {
            finalizeHtmlFile(resolvedPath, effectivePartial);
            latest = useProjectStore.getState().files.find((f) => (f.path || f.name) === resolvedPath)?.content || latest;
          }

          // Keep the AI file tree in sync without per-chunk updates.
          if (event.mode !== 'edit') {
            upsertFileNode(resolvedPath, latest);
          }

          if (effectivePartial) {
            partialPaths.add(resolvedPath);
            const msg = `Stream interrupted: ${resolvedPath} cut at line ${event.line || '?'}`;
            logSystem(`[STATUS] ${msg} (healed & auto-resuming)`);
            addBrainEvent({
              source: 'file',
              level: 'warn',
              message: msg,
              path: resolvedPath,
              phase: 'recovering'
            });
          } else {
            partialPaths.delete(resolvedPath);
            logSystem(`[STATUS] Completed ${resolvedPath}`);
            addBrainEvent({
              source: 'file',
              level: 'success',
              message: `Completed ${resolvedPath}`,
              path: resolvedPath,
              phase: 'executing'
            });
            useAIStore.getState().addCompletedFile(resolvedPath);
            scheduleAutosave();
          }

          if (useAIStore.getState().architectMode) {
            // Plan step completion handled in main loop now
          }
        }
      };

      let reasoningChars = 0;
      const isThinkingMode = modelMode === 'thinking';
      let openedBrain = false;

      const runStream = async (streamPrompt: string) => {
        await aiService.generateCodeStream(
          streamPrompt,
          (token) => {
            appendStreamText(token);
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
            if (phase === 'heartbeat') {
              addBrainEvent({
                source: 'stream',
                level: 'info',
                message: 'Heartbeat',
                phase: 'heartbeat'
              });
              return;
            }
            const compactStageKey = String(message || '').trim().toLowerCase();
            const compactStageLabel =
              compactStageKey === 'planner'
                ? t('app.plan.stage.planner')
                : compactStageKey === 'html'
                  ? t('app.plan.stage.html')
                  : compactStageKey === 'css'
                    ? t('app.plan.stage.css')
                    : compactStageKey === 'javascript'
                      ? t('app.plan.stage.javascript')
                      : compactStageKey === 'resolver'
                        ? t('app.plan.stage.resolver')
                        : /strict gate/i.test(compactStageKey)
                          ? t('app.plan.stage.strictGate')
                          : message;
            const writing = useAIStore.getState().writingFilePath;
            if (writing && phase === 'streaming') {
              setThinkingStatus(`Writing ${writing.split('/').pop() || writing}…`);
            } else if (phase === 'planning') {
              setThinkingStatus(`${t('app.plan.status.planning')}: ${compactStageLabel}`);
            } else if (phase === 'thinking') setThinkingStatus('Thinking…');
            else if (phase === 'streaming') setThinkingStatus('Generating…');
            else if (phase === 'validating') {
              if (/strict gate/i.test(String(message || ''))) {
                setThinkingStatus(`${t('app.plan.status.validating')}: ${t('app.plan.stage.strictGate')}`);
              } else {
                setThinkingStatus('Validating…');
              }
            }
            else if (phase === 'done') setThinkingStatus('Complete');
            else if (phase === 'recovering') setThinkingStatus('Recovering…');
            else setThinkingStatus(message);
            if (phase === 'done' && String(message || '').trim().toLowerCase() === 'stopped') {
              setExecutionPhase('interrupted');
            }
            const shouldSkipVerboseLog = phase === 'planning' || (phase === 'validating' && /strict gate/i.test(String(message || '')));
            if (message && !shouldSkipVerboseLog) logSystem(`[STATUS] ${message}`);
            if (message) {
              addBrainEvent({
                source: 'stream',
                level: phase === 'error' ? 'error' : phase === 'recovering' ? 'warn' : 'info',
                message,
                phase: (phase as any) || 'executing'
              });
            }
          },
          (meta) => {
            if (meta?.resume?.attempt) {
              logSystem(`[STATUS] Auto-resume attempt ${meta.resume.attempt}`);
            }
            if (meta?.raw) logSystem(`[STATUS] ${String(meta.raw)}`);
          },
          (payload) => {
            try {
              const protocol = payload?.metadata?.protocol;
              if (protocol === 'file-marker') {
                logSystem('[STATUS] File-Marker stream finished.');
              }
            } catch (e) {
              // Silently handle payload parsing errors
              console.debug('Payload parsing error (non-critical):', e);
            }
          },
          (err) => {
            throw new Error(typeof err === 'string' ? err : 'Stream error');
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
          },
          {
            thinkingMode: isThinkingMode,
            architectMode,
            includeReasoning: isThinkingMode,
            typingMs: 26,
            onFileEvent: handleFileEvent,
            abortSignal: abortController.signal,
            resumeContext,
            constraints: generationConstraints
          }
        );
      };

      type ConstraintValidationSnapshot = ReturnType<typeof validateConstraints>;

      const hasBlockingConstraintIssues = (snapshot: ConstraintValidationSnapshot) =>
        snapshot.shouldAutoFix || !snapshot.readyForFinalize;

      const buildConstraintSignature = (snapshot: ConstraintValidationSnapshot) =>
        [
          ...snapshot.missingFeatures.map((x) => `missing:${x}`),
          ...snapshot.criticalViolations.map((x) => `critical:${x}`),
          ...snapshot.hiddenIssues.map((x) => `hidden:${x}`)
        ]
          .sort()
          .join('|');

      const buildAutoFixIssueBatches = (snapshot: ConstraintValidationSnapshot) => {
        const hidden = snapshot.hiddenIssues.map((x) => `hidden:${x}`);
        const missing = snapshot.missingFeatures.map((x) => `missing:${x}`);
        const critical = snapshot.criticalViolations.map((x) => `critical:${x}`);
        const routing = snapshot.routingViolations.map((x) => `routing:${x}`);
        const quality = snapshot.qualityViolations.map((x) => `quality:${x}`);
        const naming = snapshot.namingViolations.map((x) => `naming:${x}`);

        const batches: Array<{ label: string; issues: string[] }> = [];
        if (hidden.length > 0) batches.push({ label: 'hidden-syntax', issues: hidden });
        if (missing.length > 0 || critical.length > 0) {
          batches.push({ label: 'critical-structure', issues: [...missing, ...critical] });
        }
        if (routing.length > 0) batches.push({ label: 'routing-integrity', issues: routing });
        const qualityPack = [...quality, ...naming];
        if (qualityPack.length > 0) batches.push({ label: 'quality-hardening', issues: qualityPack });

        const seen = new Set<string>();
        return batches
          .map((batch) => ({
            ...batch,
            issues: batch.issues.filter((issue) => {
              const key = String(issue || '').trim();
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            })
          }))
          .filter((batch) => batch.issues.length > 0);
      };

      const runSmartConstraintAutoFix = async (initial: ConstraintValidationSnapshot) => {
        const MAX_AUTO_FIX_ROUNDS = 3;
        let validation = initial;
        let signature = buildConstraintSignature(validation);

        for (let round = 1; round <= MAX_AUTO_FIX_ROUNDS; round++) {
          if (!hasBlockingConstraintIssues(validation)) break;

          const deterministicHeals = applyDeterministicHiddenSyntaxSelfHeal();
          if (deterministicHeals.length > 0) {
            logSystem(`[constraints] Deterministic syntax self-heal: ${deterministicHeals.join(', ')}`);
          }

          validation = validateConstraints(useProjectStore.getState().files, generationConstraints);
          if (!hasBlockingConstraintIssues(validation)) break;

          const batches = buildAutoFixIssueBatches(validation);
          if (batches.length === 0) break;

          let progressed = false;
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            logSystem(
              `[constraints] Smart auto-fix round ${round}/${MAX_AUTO_FIX_ROUNDS} · ${batch.label} (${batchIndex + 1}/${batches.length})`
            );

            const repairPrompt = buildConstraintsRepairPrompt(batch.issues, generationConstraints, {
              focus: batch.label,
              attempt: round,
              maxAttempts: MAX_AUTO_FIX_ROUNDS,
              recentlyHealedFiles: deterministicHeals
            });
            await runStream(repairPrompt);

            const postHeals = applyDeterministicHiddenSyntaxSelfHeal();
            if (postHeals.length > 0) {
              logSystem(`[constraints] Post auto-fix syntax self-heal: ${postHeals.join(', ')}`);
            }

            const nextValidation = validateConstraints(useProjectStore.getState().files, generationConstraints);
            const nextSignature = buildConstraintSignature(nextValidation);
            if (nextSignature !== signature) progressed = true;
            signature = nextSignature;
            validation = nextValidation;

            if (!hasBlockingConstraintIssues(validation)) break;
          }

          if (!progressed) {
            logSystem('[constraints] Smart auto-fix stalled (no issue delta). Using best-effort result.');
            break;
          }
        }

        return validation;
      };

      if (!SUPER_MODE_TEMP_DISABLED && modelMode === 'super') {
        setExecutionPhase('planning');
        logSystem('[SUPER-THINKING] Initializing Fast-Mode Blueprint...');
        const data = await aiService.generatePlan(
          scopedPrompt,
          false,
          abortController.signal,
          generationConstraints.projectMode,
          generationConstraints,
          true
        );
        const rawSteps: any[] = Array.isArray(data?.steps) ? data.steps : [];
        const generatedSteps = rawSteps
          .map((s, i) => ({
            id: String(s?.id ?? i + 1),
            title: String(s?.title ?? s?.text ?? s?.step ?? '').trim(),
            completed: false,
            category: normalizePlanCategory(s?.category, s?.title ?? s?.text ?? s?.step ?? '', Array.isArray(s?.files) ? s.files : []),
            status: 'pending' as const,
            files: Array.isArray(s?.files) ? s.files : [],
            description: String(s?.description ?? ''),
            estimatedSize: (s?.estimatedSize || 'medium') as 'small' | 'medium' | 'large',
            depends_on: Array.isArray(s?.depends_on) ? s.depends_on : []
          }))
          .filter((s) => s.title.length > 0);
        const planStepsLocal = normalizePlanStepsForProfile(generatedSteps, effectiveProjectType);
        setPlanSteps(planStepsLocal);
        setLastPlannedPrompt(scopedPrompt);
        logSystem('[WORKFLOW] Mapping automated logic nodes...');
        setExecutionPhase('executing');
        logSystem('[SUPER-THINKING] Deep-Thinking Engine Engaged...');

        if (isResuming && partialFile) {
          logSystem('[STATUS] Resuming partial file before continuing plan…');
          await runStream(baseStreamPrompt);
        }

        for (const step of planStepsLocal) {
          logSystem(`[PLAN] Executing step: ${step.title}`);
          const stepPrompt = `
[PROJECT CONTEXT]
Project: ${projectName}
Stack: ${stack}
Description: ${description}
${constraintsBlock}
${agentContextBlock}

[CURRENT PLAN]
${planStepsLocal.map(s => `- [${s.completed ? 'x' : ' '}] ${s.title}`).join('\n')}

[TASK]
Implement this step: "${step.title}"
Description: ${step.description}
Target Files: ${step.files?.join(', ') || 'Auto-detect'}

Output ONLY the code for these files.
`.trim();
          await runStream(stepPrompt);
          useAIStore.getState().setPlanStepCompleted(step.id, true);
          if (useAIStore.getState().executionPhase === 'interrupted') break;
        }
      } else if (architectMode && (!skipPlanning || isResuming)) {
        setExecutionPhase('planning');
        const currentSteps = useAIStore.getState().planSteps;
        const lastPlanned = useAIStore.getState().lastPlannedPrompt;
        
        if (!isResuming && (currentSteps.length === 0 || lastPlanned !== scopedPrompt)) {
           await generatePlan(scopedPrompt, abortController.signal);
        }
        
        const rawPlannedSteps = useAIStore.getState().planSteps;
        const normalizedPlannedSteps = rawPlannedSteps.map((step) => ({
          ...step,
          category: normalizePlanCategory(step?.category, step?.title, Array.isArray(step?.files) ? step.files : [])
        }));
        const steps = normalizePlanStepsForProfile(normalizedPlannedSteps, effectiveProjectType);
        if (steps.length !== rawPlannedSteps.length) {
          setPlanSteps(steps);
        }
        if (steps.length === 0) {
          setExecutionPhase('executing');
          await runStream(baseStreamPrompt);
        } else {
        
          if (!isResuming && lastPlanned !== scopedPrompt) {
               setPlanSteps(steps.map(s => ({...s, completed: false})));
          }

          setExecutionPhase('executing');
          const updatedSteps = useAIStore.getState().planSteps;

          if (isResuming && partialFile) {
            logSystem('[STATUS] Resuming partial file before continuing plan…');
            await runStream(baseStreamPrompt);
          }
          
          for (const step of updatedSteps) {
              if (step.completed) continue;
              
              logSystem(`[PLAN] Executing step: ${step.title}`);
              const stepPrompt = `
[PROJECT CONTEXT]
 Project: ${projectName}
 Stack: ${stack}
 Description: ${description}
 ${constraintsBlock}
 ${agentContextBlock}

[CURRENT PLAN]
${updatedSteps.map(s => `- [${s.completed ? 'x' : ' '}] ${s.title}`).join('\n')}

[TASK]
Implement this step: "${step.title}"
Description: ${step.description}
Target Files: ${step.files?.join(', ') || 'Auto-detect'}

 Output ONLY the code for these files.
 `.trim();
              
              await runStream(stepPrompt);
              useAIStore.getState().setPlanStepCompleted(step.id, true);
              
              // Safety check for interruptions
              if (useAIStore.getState().executionPhase === 'interrupted') break;
          }
        }
      } else {
        setExecutionPhase('executing');
        await runStream(baseStreamPrompt);
      }

      if (useAIStore.getState().executionPhase !== 'interrupted' && partialPaths.size === 0) {
        const currentFiles = useProjectStore.getState().files;
        if (generationConstraints.enforcement === 'hard') {
          const initialValidation = validateConstraints(currentFiles, generationConstraints);
          const {
            missingFeatures,
            qualityViolations,
            routingViolations,
            namingViolations,
            advisoryViolations,
            hiddenIssues,
            shouldAutoFix,
            retrievalCoverageScore,
            readyForFinalize
          } = initialValidation;
          if (advisoryViolations.length > 0 && !shouldAutoFix) {
            logSystem(
              `[constraints] Advisory findings only (no auto-fix): ${advisoryViolations.slice(0, 8).join(', ')}${
                advisoryViolations.length > 8 ? ' ...' : ''
              } | Retrieval coverage=${retrievalCoverageScore}%`
            );
          }
          if (shouldAutoFix) {
            const qualitySummary = qualityViolations.length > 0 ? ` | Quality issues: ${qualityViolations.join(', ')}` : '';
            const routingSummary = routingViolations.length > 0 ? ` | Routing: ${routingViolations.join(', ')}` : '';
            const namingSummary = namingViolations.length > 0 ? ` | Naming: ${namingViolations.join(', ')}` : '';
            const hiddenSummary = hiddenIssues.length > 0 ? ` | Hidden: ${hiddenIssues.join(', ')}` : '';
            logSystem(
              `[constraints] Critical auto-fix required. Missing features: ${missingFeatures.join(', ') || 'none'}${qualitySummary}${routingSummary}${namingSummary}${hiddenSummary} | Retrieval coverage=${retrievalCoverageScore}%`
            );
            const postFixValidation = await runSmartConstraintAutoFix(initialValidation);
            if (hasBlockingConstraintIssues(postFixValidation)) {
              const unresolved = [
                ...postFixValidation.missingFeatures.map((x) => `missing:${x}`),
                ...postFixValidation.criticalViolations.map((x) => `critical:${x}`),
                ...postFixValidation.hiddenIssues.map((x) => `hidden:${x}`)
              ];
              throw new Error(
                `QUALITY_GATE_BLOCKED: unresolved critical issues after smart auto-fix -> ${unresolved.slice(0, 10).join(', ')}${
                  unresolved.length > 10 ? ' ...' : ''
                }`
              );
            }
          } else if (!readyForFinalize) {
            logSystem('[constraints] Non-critical issues detected. Finalizing without extra edits to avoid unnecessary token usage.');
          }
        }
      }

      if (useAIStore.getState().executionPhase !== 'interrupted') {
        setExecutionPhase('completed');
        const generatedFiles = useProjectStore.getState().files;
        generationSucceeded = generatedFiles.length > 0;
        if (generationSucceeded) {
          clearAutoResumePayload();
          completionWatchRef.current = { at: Date.now(), prompt: basePrompt };
          setCompletionSuggestions(
            buildCompletionSuggestions({
              selectedFeatures: generationConstraints.selectedFeatures,
              projectMode: generationConstraints.projectMode,
              files: generatedFiles,
              lastPrompt: basePrompt
            })
          );
          if (partialPaths.size > 0) {
            logSystem(`[preview] Code complete but partial files remain (${partialPaths.size}). Waiting for auto-resume…`);
          } else {
            logSystem('[preview] Code complete. Preview updating…');
            setIsPreviewOpen(true);
          }
        }
      } else {
        setThinkingStatus('Interrupted');
      }
    } catch (e: any) {
      flushFileBuffers();
      flushReasoningBuffer();
      if (e?.abortedByUser || e?.message === 'ABORTED_BY_USER' || e?.name === 'AbortError') {
        clearAutoResumePayload();
        setError(null);
      } else {
        setError(e?.message || 'Failed to generate code');
      }
      setExecutionPhase('interrupted');
      setThinkingStatus('Interrupted');
    } finally {
      setIsGenerating(false);
      setThinkingStatus('');
      if (generationAbortRef.current === abortController) generationAbortRef.current = null;
    }
  }, [
    architectMode,
    appendStreamText,
    addBrainEvent,
    clearBrainEvents,
    clearThinkingContent,
    clearSystemConsoleContent,
    clearFileStatuses,
    flushFileBuffers,
    flushReasoningBuffer,
    generatePlan,
    isGenerating,
    isPlanning,
    modelMode,
    moveFile,
    prompt,
    deleteFile,
    resetProject,
    resetFiles,
    resolveFilePath,
    scheduleFileFlush,
    scheduleReasoningFlush,
    scheduleTokenBeat,
    setActiveFile,
    setError,
    setFileStatus,
    setIsGenerating,
    setIsPreviewOpen,
    setLastPlannedPrompt,
    setPreviewUrl,
    setPlanSteps,
    setSections,
    setLlmConfigured,
    setLlmConfigHint,
    setStack,
    setStreamText,
    setThinkingStatus,
    setWritingFilePath,
    updateFile,
    upsertFile,
    upsertFileNode,
    logSystem,
    setExecutionPhase,
    setFilesFromProjectFiles,
    getGenerationConstraints,
    buildAgentContextBlock,
    effectiveProjectType,
    projectName,
    stack,
    description,
    t,
    setProjectId
  ]);

  const buildFixPrompt = useCallback(
    (request: string) => {
      const constraints = getGenerationConstraints();
      const constraintsBlock = buildGenerationConstraintsBlock(constraints);
      const agentContextBlock = buildAgentContextBlock(request);
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

      // Check if this is a "continue" request
      const lowerRequest = request.toLowerCase();
      const isContinueRequest = lowerRequest.includes('continue') || 
                                 lowerRequest.includes('كمل') || 
                                 lowerRequest.includes('اكمل') ||
                                 lowerRequest.includes('resume') ||
                                 lowerRequest.includes('go on');

      const continueInstructions = isContinueRequest ? [
        '',
        'IMPORTANT: This is a CONTINUE request.',
        '- Do NOT show any internal messages like "SEARCH", "REPLACE", "Replaced X with Y"',
        '- Do NOT explain what you are doing - just output the code',
        '- Continue seamlessly from where you left off',
        '- Output ONLY file markers and code - no commentary'
      ].join('\n') : '';

      return [
        'SYSTEM: You are editing an existing project. You are an ELITE code generator.',
        'CRITICAL RULES:',
        '1. Output MUST be plain text only. No JSON. No markdown. No explanations.',
        '2. NEVER output messages like "Searching...", "Replacing...", "Found X", "Replaced X with Y"',
        '3. Output ONLY file markers and actual code content',
        '',
        constraintsBlock,
        '',
        'Use ONLY these markers:',
        '  - [[PATCH_FILE: path/to/file.ext | mode: edit | reason: ...]] ... [[END_FILE]] for edits',
        '  - [[PATCH_FILE: path/to/file.ext | mode: create | reason: ...]] ... [[END_FILE]] for new files',
        '  - [[DELETE_FILE: path/to/file.ext | reason: ...]] for safe deletes',
        '  - [[MOVE_FILE: from/path.ext -> to/path.ext | reason: ...]] for safe moves',
        'Prefer [[PATCH_FILE ... mode: edit]] whenever possible. Do NOT repeat unchanged files.',
        continueInstructions,
        '',
        agentContextBlock,
        '',
        `USER REQUEST: ${request}`,
        '',
        'PROJECT STRUCTURE (you know EXACTLY where every file is):',
        structureList,
        '',
        'ACTIVE FILE (full content):',
        activeBlock,
        '',
        'Output ONLY markers + file contents. NO explanations. NO filler. NO status messages.'
      ].join('\n');
    },
    [activeFile, buildAgentContextBlock, files, getGenerationConstraints]
  );

  const enqueueEditRequest = useCallback((request: string) => {
    const trimmed = String(request || '').trim();
    if (!trimmed) return;
    if (pendingEditRequestsRef.current.length >= 3) {
      pendingEditRequestsRef.current.shift();
    }
    pendingEditRequestsRef.current.push(trimmed);
  }, []);

  useEffect(() => {
    if (isGenerating || isPlanning) return;
    const next = pendingEditRequestsRef.current.shift();
    if (!next) return;
    chatRoundRef.current += 1; addChatMessage({ role: 'user', content: next, round: chatRoundRef.current, createdAt: Date.now() });
    const fixPrompt = buildFixPrompt(next);
    void handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
  }, [addChatMessage, buildFixPrompt, handleGenerate, isGenerating, isPlanning]);

  useEffect(() => {
    const prev = prevPlanCountRef.current;
    const next = planSteps.length;
    if (prev === 0 && next > 0) {
      setPlanOpen(true);
    }
    prevPlanCountRef.current = next;
  }, [planSteps.length]);

  useEffect(() => {
    if (!bootstrapReady || isProjectHydrating) return;
    if (autoResumeTriggeredRef.current) return;
    if (isGenerating || isPlanning) return;

    const payload = readAutoResumePayload();
    if (!payload) return;

    // Only resume if state is 'running' and eligible
    if (payload.state && payload.state !== 'running') { clearAutoResumePayload(); return; }
    if (payload.resumeEligible === false) { clearAutoResumePayload(); return; }

    if (Date.now() - payload.at > AUTO_RESUME_MAX_AGE_MS) {
      clearAutoResumePayload();
      return;
    }

    const attempts = Number(payload.attempts || 0);
    if (attempts >= AUTO_RESUME_MAX_ATTEMPTS) {
      clearAutoResumePayload();
      return;
    }

    const aiSnapshot = useAIStore.getState();
    const hasFiles = useProjectStore.getState().files.length > 0;
    const hasPartialFiles = Object.values(aiSnapshot.fileStatuses || {}).some((status) => status === 'partial' || status === 'compromised');
    const isInterrupted = aiSnapshot.executionPhase === 'interrupted';
    const isStillWriting = Boolean(aiSnapshot.writingFilePath);

    if (aiSnapshot.executionPhase === 'completed' && hasFiles && !hasPartialFiles) {
      clearAutoResumePayload();
      return;
    }

    const resumable = isInterrupted || hasPartialFiles || isStillWriting;
    if (!resumable) return;

    autoResumeTriggeredRef.current = true;
    writeAutoResumePayload({
      prompt: payload.prompt,
      at: Date.now(),
      attempts: attempts + 1,
      state: 'running',
      resumeEligible: true
    });

    logSystem('[STATUS] Auto-resume detected after refresh. Continuing generation…');
    void handleGenerate(payload.prompt, { resume: true, preserveProjectMeta: true });
  }, [bootstrapReady, executionPhase, handleGenerate, isGenerating, isPlanning, isProjectHydrating, logSystem]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    if (isGenerating || isPlanning) return;
    if (executionPhase !== 'completed') return;

    const watch = completionWatchRef.current;
    if (!watch.at) return;
    if (Date.now() - watch.at > 90_000) return;

    const last = logs[logs.length - 1];
    const message = String(last?.message || '').trim();
    const runtimeMsg = String(runtimeMessage || '').trim();
    const previewIsBroken = runtimeStatus === 'error';
    const hasKnownErrorPattern = PREVIEW_ERROR_PATTERN.test(`${runtimeMsg}\n${message}`);
    if (!previewIsBroken && !hasKnownErrorPattern) return;

    const tail = logs
      .slice(-45)
      .map((line) => {
        const t = new Date(line.timestamp).toLocaleTimeString([], { hour12: false });
        return `${t} ${line.message}`;
      })
      .join('\n');

    const signature = `preview-fail:${runtimeStatus}:${runtimeMsg.slice(0, 260)}:${message.slice(0, 260)}`;
    const attempts = autoDebugRef.current.signature === signature ? autoDebugRef.current.attempts : 0;
    if (attempts >= 1) return;
    autoDebugRef.current = { signature, attempts: attempts + 1 };

    logSystem('[STATUS] Auto-fix triggered: preview/runtime issue detected.');
    const requestText = [
      'AUTO-FIX: Preview has runtime/compile issue. Repair project so preview starts clean with no runtime errors.',
      runtimeMsg ? `Runtime: ${runtimeMsg}` : '',
      message ? `Latest Error: ${message}` : '',
      tail ? `Recent logs:\n${tail}` : '',
      `Original request summary: ${watch.prompt || '(not available)'}`
    ]
      .filter(Boolean)
      .join('\n\n');

    const fixPrompt = buildFixPrompt(requestText);
    void handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
  }, [
    buildFixPrompt,
    executionPhase,
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
    if (llmConfigured === false) {
      setError(llmConfigHint || 'LLM_NOT_CONFIGURED: backend AI provider is not configured.');
      return;
    }
    if (mainActionState === 'planning' || mainActionState === 'coding') {
      stopGeneration();
      return;
    }

    if (mainActionState === 'interrupted') {
      handleGenerate(undefined, { resume: true, preserveProjectMeta: true });
      return;
    }

    if (mainActionState === 'done') {
      const request = prompt.trim();
      if (!request) {
        if (interactionMode !== 'edit') setInteractionMode('edit');
        requestAnimationFrame(() => promptRef.current?.focus());
        return;
      }

      if (interactionMode !== 'edit') setInteractionMode('edit');
      enqueueEditRequest(request);
      setPrompt('');
      if (isGenerating || isPlanning) return;
      const next = pendingEditRequestsRef.current.shift();
      if (!next) return;
      chatRoundRef.current += 1; addChatMessage({ role: 'user', content: next, round: chatRoundRef.current, createdAt: Date.now() });
      const fixPrompt = buildFixPrompt(next);
      handleGenerate(fixPrompt, { skipPlanning: true, preserveProjectMeta: true });
      return;
    }
    const request = prompt.trim();
    if (request) {
      chatRoundRef.current += 1; addChatMessage({ role: 'user', content: request, round: chatRoundRef.current, createdAt: Date.now() });
    }
    handleGenerate();
  }, [
    addChatMessage,
    buildFixPrompt,
    enqueueEditRequest,
    stopGeneration,
    handleGenerate,
    interactionMode,
    isGenerating,
    isPlanning,
    mainActionState,
    llmConfigured,
    llmConfigHint,
    prompt,
    setInteractionMode,
    setError,
    setPrompt
  ]);

  const desktopPromptControls = (
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
              llmConfigured === false ||
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
  );

  const mobilePromptControls = (
    <>
      <Popover>
        <Trigger>
          <MainActionButton
            state={mainActionState}
            onClick={handleMainActionClick}
            disabled={
              llmConfigured === false ||
              (mainActionState === 'idle' && !prompt.trim()) ||
              (mainActionState === 'done' && interactionMode === 'edit' && !prompt.trim())
            }
          />
        </Trigger>
        <Content>
          <Heading>{mainActionState === 'done' ? 'Fix / Edit' : 'Generate'}</Heading>
          <Description>
            Hold on mobile to show this tip. Release to hide.
          </Description>
        </Content>
      </Popover>
      <Popover>
        <Trigger>
          <ModeToggle />
        </Trigger>
        <Content>
          <Heading>Mode</Heading>
          <Description>Fast for speed, Think/Super for deeper reasoning.</Description>
        </Content>
      </Popover>
      <Popover>
        <Trigger>
          <ArchitectToggle />
        </Trigger>
        <Content>
          <Heading>Architect Mode</Heading>
          <Description>Build a step-by-step plan before code generation.</Description>
        </Content>
      </Popover>
    </>
  );

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

      <Container $reserveConsole={isConsoleVisible}>
        <HeaderArea style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <HeaderLeft style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <BrandStack style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <BrandTitle>{t('brand.name')}</BrandTitle>
              <BrandSubtitle>{projectName?.trim() || t('app.header.untitled')}</BrandSubtitle>
            </BrandStack>
            <StatusPill $active={isGenerating}>
              {isGenerating ? thinkingStatus || t('app.header.status.working') : executionPhase === 'interrupted' ? t('app.header.status.stopped') : t('app.header.status.ready')}
            </StatusPill>
          </HeaderLeft>
          <HeaderRight style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <DesktopOnly>
              <SubscriptionIndicator />
            </DesktopOnly>
            <div style={{ marginLeft: isRTL ? '0' : '4px', marginRight: isRTL ? '4px' : '0' }}>
              <LanguageSwitcher />
            </div>
            <DesktopOnly>
              <HeaderIconButton
                type="button"
                onClick={() => {
                  const shouldOpen = !isPreviewOpen;
                  setIsPreviewOpen(shouldOpen);
                  if (shouldOpen) setDesktopWorkbenchTab('preview');
                  if (!shouldOpen && desktopWorkbenchTab === 'preview') setDesktopWorkbenchTab('editor');
                }}
                aria-label={isPreviewOpen ? t('app.header.preview.close') : t('app.header.preview.open')}
                title={isPreviewOpen ? t('app.header.preview.close') : t('app.header.preview.open')}
                style={{
                  borderColor: isPreviewOpen ? 'rgba(245, 158, 11, 0.30)' : undefined,
                  background: isPreviewOpen ? 'rgba(245, 158, 11, 0.12)' : undefined,
                }}
              >
                {isPreviewOpen ? <EyeOff size={18} /> : <Eye size={18} />}
              </HeaderIconButton>
            </DesktopOnly>
            <DesktopOnly>
              <HeaderIconButton
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label="View history"
                title="View history"
              >
                <History size={18} />
              </HeaderIconButton>
            </DesktopOnly>
            <DesktopOnly>
              <HeaderIconButton
                type="button"
                onClick={() => setPlanOpen((v) => !v)}
                aria-label="View plan"
                title="View plan"
              >
                <ListTodo size={18} />
              </HeaderIconButton>
            </DesktopOnly>
            <MobileMenuButton type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={18} />
            </MobileMenuButton>
          </HeaderRight>
        </HeaderArea>

        {!isMobileViewport ? (
          <DesktopLayout>
            <ChatColumn>
              <ChatPanel>
                <ChatHeader>
                  <ChatHeaderTitle>{t('app.workspace.title')}</ChatHeaderTitle>
                  <ChatHeaderMeta>
                    <span>{chatMessageCountText}</span>
                    <span>{Math.round(contextBudget.utilizationPct)}%</span>
                  </ChatHeaderMeta>
                  <ContextBarTrack>
                    <ContextBarFill $status={contextBudget.status} $width={contextBudget.utilizationPct} />
                  </ContextBarTrack>
                </ChatHeader>
                <ChatScroll
                  ref={chatScrollRef}
                  onScroll={handleChatScroll}
                  className="scrollbar-thin scrollbar-glass"
                >
                  {chatHistory.length === 0 ? (
                    <ChatEmpty>
                      Start by writing a prompt below. This panel shows only your conversation and the final AI delivery summary.
                    </ChatEmpty>
                  ) : null}

                  {chatHistory.map((message, index) => {
                    const roleLabel =
                      message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : 'System';
                    return (
                      <ChatBubble
                        key={`${message.role}-${index}-${message.content.slice(0, 32)}`}
                        $role={message.role}
                      >
                        <ChatBubbleRole $role={message.role}>
                          {roleLabel}
                          {message.round != null && <ChatRoundBadge>#{message.round}</ChatRoundBadge>}
                          {message.createdAt && <ChatTimestamp>{new Date(message.createdAt).toLocaleTimeString()}</ChatTimestamp>}
                        </ChatBubbleRole>
                        <ChatBubbleText>{message.content}</ChatBubbleText>
                      </ChatBubble>
                    );
                  })}

                </ChatScroll>
              </ChatPanel>

              <ChatComposerWrap>
                <PromptInput
                  ref={promptRef}
                  onSubmit={handleMainActionClick}
                  controls={desktopPromptControls}
                  projectMode={effectiveProjectType}
                  onProjectModeChange={handleProjectTypeSelect}
                  recommendation={modeRecommendation}
                  onApplyRecommendation={() => {
                    if (!modeRecommendation) return;
                    handleProjectTypeSelect(modeRecommendation.mode);
                  }}
                  labels={{
                    projectModeLabel: t('app.prompt.projectMode.label'),
                    frontendLabel: t('app.prompt.projectMode.frontend'),
                    fullstackLabel: t('app.prompt.projectMode.fullstack'),
                    applyLabel: t('app.prompt.projectMode.apply')
                  }}
                  fullstackLocked={FULLSTACK_TEMP_LOCK}
                  constraintsPanel={constraintsPanelNode}
                  constraintsPanelOpen={constraintsPanelOpen}
                  onToggleConstraintsPanel={() => setConstraintsPanelOpen((v) => !v)}
                  constraintsSummary={constraintsSummary}
                  constraintsLabel={t('app.tools.title')}
                  completionSuggestions={completionSuggestions}
                  onApplyCompletionSuggestion={handleApplyCompletionSuggestion}
                  onDismissCompletionSuggestions={handleDismissCompletionSuggestions}
                />
              </ChatComposerWrap>
            </ChatColumn>

            <WorkbenchColumn>
              <WorkbenchTabs>
                <WorkbenchTab
                  type="button"
                  $active={desktopWorkbenchTab === 'editor'}
                  onClick={() => setDesktopWorkbenchTab('editor')}
                >
                  Editor
                </WorkbenchTab>
                <WorkbenchTab
                  type="button"
                  $active={desktopWorkbenchTab === 'preview'}
                  onClick={() => {
                    setDesktopWorkbenchTab('preview');
                    setIsPreviewOpen(true);
                  }}
                >
                  Live Preview
                </WorkbenchTab>
              </WorkbenchTabs>

              <WorkbenchBody>
                <WorkbenchSidebar>
                  <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
                </WorkbenchSidebar>

                <WorkbenchPanel>
                  {desktopWorkbenchTab === 'editor' ? (
                    <CodeEditor showFileTree={false} isVisible />
                  ) : (
                    <PreviewWindow
                      enabled={isPreviewOpen}
                      projectProfile={effectiveProjectType === 'FULL_STACK' ? 'fullstack' : 'frontend'}
                    />
                  )}
                </WorkbenchPanel>
              </WorkbenchBody>
            </WorkbenchColumn>
          </DesktopLayout>
        ) : (
          <>
            <InputArea $mobileHidden={mobileTab !== 'ai'}>
              <MobileAIBoard>
                <MobileAIIntro>
                  <MobileAITitle>{t('app.mobile.workspace.title')}</MobileAITitle>
                  <MobileAISubtitle>{t('app.mobile.workspace.subtitle')}</MobileAISubtitle>
                </MobileAIIntro>
                <PromptInput
                  ref={promptRef}
                  onSubmit={handleMainActionClick}
                  controls={isMobileViewport ? mobilePromptControls : desktopPromptControls}
                  projectMode={effectiveProjectType}
                  onProjectModeChange={handleProjectTypeSelect}
                  recommendation={modeRecommendation}
                  onApplyRecommendation={() => {
                    if (!modeRecommendation) return;
                    handleProjectTypeSelect(modeRecommendation.mode);
                  }}
                  labels={{
                    projectModeLabel: t('app.prompt.projectMode.label'),
                    frontendLabel: t('app.prompt.projectMode.frontend'),
                    fullstackLabel: t('app.prompt.projectMode.fullstack'),
                    applyLabel: t('app.prompt.projectMode.apply')
                  }}
                  fullstackLocked={FULLSTACK_TEMP_LOCK}
                  constraintsPanel={constraintsPanelNode}
                  constraintsPanelOpen={constraintsPanelOpen}
                  onToggleConstraintsPanel={() => setConstraintsPanelOpen((v) => !v)}
                  constraintsSummary={constraintsSummary}
                  constraintsLabel={t('app.tools.title')}
                  completionSuggestions={completionSuggestions}
                  onApplyCompletionSuggestion={handleApplyCompletionSuggestion}
                  onDismissCompletionSuggestions={handleDismissCompletionSuggestions}
                />
                {(architectMode || planSteps.length > 0) && (
                  <MobilePlanPane>
                    <MobilePlanBody>
                      {planSteps.length > 0 ? (
                        <PlanChecklist
                          items={planSteps}
                          currentStepId={isGenerating ? currentPlanStepId : undefined}
                          embedded
                        />
                      ) : (
                        <div style={{ padding: 12, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                          {t('app.plan.empty')}
                        </div>
                      )}
                    </MobilePlanBody>
                  </MobilePlanPane>
                )}
              </MobileAIBoard>
            </InputArea>

            <MainWorkspace $previewOpen={isPreviewOpen} $mobileHidden={mobileTab === 'ai'}>
              <DesktopSidebar>
                <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
              </DesktopSidebar>
              <PanelSlot $mobileActive={mobileTab === 'editor'}>
                <CodeEditor showFileTree={isMobileViewport} isVisible={!isMobileViewport || mobileTab === 'editor'} />
              </PanelSlot>
              <PanelSlot $mobileActive={mobileTab === 'preview'} $desktopHidden={!isPreviewOpen}>
                <PreviewWindow
                  enabled={isPreviewOpen || mobileTab === 'preview'}
                  projectProfile={effectiveProjectType === 'FULL_STACK' ? 'fullstack' : 'frontend'}
                />
              </PanelSlot>
            </MainWorkspace>

            <MobileNav
              activeTab={mobileTab}
              onTabChange={setMobileTab}
              isGenerating={isGenerating}
            />
          </>
        )}
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
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                This name is used for saving and restoring your project.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                  Stack
                </div>
                <span style={{ 
                  fontSize: 9, 
                  background: 'rgba(34, 211, 238, 0.15)', 
                  color: 'rgba(34, 211, 238, 0.95)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  AUTO
                </span>
              </div>
              <input
                value={stack || 'Detected automatically by AI'}
                readOnly
                style={{
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'rgba(255,255,255,0.60)',
                  padding: '0 12px',
                  outline: 'none',
                  cursor: 'not-allowed'
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                  Description
                </div>
                <span style={{ 
                  fontSize: 9, 
                  background: 'rgba(34, 211, 238, 0.15)', 
                  color: 'rgba(34, 211, 238, 0.95)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  AUTO
                </span>
              </div>
              <textarea
                value={description || 'Generated automatically from your prompt'}
                readOnly
                rows={3}
                className="scrollbar-thin"
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'rgba(255,255,255,0.60)',
                  padding: '10px 12px',
                  outline: 'none',
                  resize: 'none',
                  cursor: 'not-allowed'
                }}
              />
            </div>

            <div style={{ 
              fontSize: 11, 
              color: 'rgba(34, 197, 94, 0.85)', 
              lineHeight: 1.4,
              background: 'rgba(34, 197, 94, 0.1)',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}>
              Auto-save enabled. AI determines stack and description automatically.
            </div>
          </div>
        </OverlayBody>
      </OverlayPanel>

      {planSteps.length > 0 && (
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

      <IDEFooter>© 2026 Apex Coding | AI-Powered Developer Platform</IDEFooter>

      <BrainConsole
        visible={isConsoleVisible}
        open={brainOpen}
        onToggle={() => setBrainOpen((v) => !v)}
        health={systemHealth}
        thought={thinkingContent}
        status={thinkingStatus}
        error={error}
        logs={systemConsoleContent}
        events={brainEvents}
        executionPhase={executionPhase}
        writingFilePath={writingFilePath}
        contextUtilizationPct={contextBudget.utilizationPct}
        contextStatus={contextBudget.status}
        runtimeStatus={runtimeStatus}
        lastTokenAt={lastTokenAt}
        canFixResume={false}
      />
      </Root>
    </>
  );
}

export default App;
