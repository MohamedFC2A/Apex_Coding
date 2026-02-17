import React, { useState, useEffect } from 'react';
import { LiquidButton, LiquidPanel, LiquidInput, GlassCard } from './GlassCard';
import { JSONValidationStatus } from './JSONValidationStatus';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { aiService } from '@/services/aiService';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { ProjectFile } from '@/types';
import { Sparkles, Loader2, Clock, ChevronDown, ChevronRight, ChevronLeft, Settings, Zap, Brain, AlertCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import styled from 'styled-components';

// --- Styled Components for advanced glass effects ---

const PanelContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.6) 0%, rgba(13, 17, 23, 0.2) 100%);
`;

const GlassHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 16px;
  color: #fff;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  &:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(0, 0, 0, 0.3);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 20px rgba(59, 130, 246, 0.1);
  }
`;

const SettingsButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }
`;

const ModeButton = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  ${props => props.$active ? `
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid ${props.$color};
    color: #fff;
    box-shadow: 0 0 15px ${props.$color}40;
  ` : `
    background: transparent;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.8);
    }
  `}
`;

export const PromptPanel: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [localPrompt, setLocalPrompt] = useState('');
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{ valid: boolean; notes?: string } | null>(null);
  const [actualMode, setActualMode] = useState<string>('');
  
  const {
    prompt,
    isGenerating,
    sections,
    lastTokenAt,
    modelMode,
    setIsGenerating,
    appendStreamText,
    setSections,
    setModelMode,
    saveCurrentSession,
    setError,
    error,
    handleFileEvent,
    executionPhase,
    setPrompt,
    fileStatuses,
    completedFiles,
    lastSuccessfulFile,
    lastSuccessfulLine
  } = useAIStore();
  
  const { setFiles, setFileStructure, setStack, setDescription, setProjectId, setProjectName } = useProjectStore();
  const { addLog } = usePreviewStore();

  const isThinkingMode = modelMode === 'thinking';

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      const gap = Date.now() - lastTokenAt;
      if (gap > 5000 && lastTokenAt > 0) {
        setThinkingStatus(t('app.plan.status.thinking'));
      } else if (lastTokenAt > 0 && !thinkingStatus.includes('Generating')) {
        setThinkingStatus(t('app.plan.status.working'));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isGenerating, lastTokenAt, thinkingStatus]);

  const handleGenerate = async () => {
    if (!localPrompt.trim() || (isGenerating && executionPhase !== 'interrupted')) return;

    setPrompt(localPrompt);
    saveCurrentSession();
    setIsGenerating(true);
    setError(null);
    setSections({});
    setValidationStatus(null);
    setActualMode('');
    setThinkingStatus(t('app.plan.status.initializing'));

    try {
      let reasoningContent = '';
      
      const isResuming = executionPhase === 'interrupted';
      let effectivePrompt = localPrompt;
      let resumeContext = undefined;

      if (isResuming) {
        resumeContext = {
          completedFiles,
          lastSuccessfulFile,
          lastSuccessfulLine
        };

        const partialFile = Object.entries(fileStatuses).find(([_, s]) => s === 'partial')?.[0];
        if (partialFile) {
          effectivePrompt = `CONTINUE ${partialFile} FROM LINE ${lastSuccessfulLine + 1}. \n\nOriginal Request: ${localPrompt}`;
          addLog({
            timestamp: Date.now(),
            type: 'info',
            message: `Resuming partial file: ${partialFile}`
          });
        } else {
          addLog({
            timestamp: Date.now(),
            type: 'info',
            message: `Resuming execution... (${completedFiles.length} files already done)`
          });
        }
      }

      await aiService.generateCodeStream(
        effectivePrompt,
        (token) => {
          appendStreamText(token);
        },
        (phase, message) => {
          if (phase === 'thinking') {
            setThinkingStatus(t('app.plan.status.thinking'));
          } else if (phase === 'streaming') {
            setThinkingStatus(t('app.plan.status.working'));
          } else if (phase === 'validating') {
            setThinkingStatus(t('app.plan.status.validating'));
          } else if (phase === 'done') {
            setThinkingStatus(t('app.plan.status.complete'));
          } else {
            setThinkingStatus(message);
          }
        },
        (meta) => {
          if (meta.provider) {
            const label = meta.model ? `${meta.model}` : meta.provider;
            setActualMode(label);
            addLog({
              timestamp: Date.now(),
              type: 'info',
              message: `Using DeepSeek (${label})`
            });
          }
        },
        (payload) => {
          const data = payload;
          const convertedFiles = (data.project_files || []).map((file: any) => ({
            path: file.name,
            content: file.content,
            language: getLanguageFromExtension(file.name)
          }));

          setFiles(convertedFiles);
          setFileStructure((data.project_files || []).map((file: any) => ({
            path: file.name,
            type: 'file' as const
          })));

          const protocol = data?.metadata?.protocol;
          if (protocol !== 'file-marker') {
            setStack(data.metadata?.language || 'Unknown');
            setDescription(data.instructions || 'Generated by Apex Coding');
            const projectId = `project-${Date.now()}`;
            const projectName = localPrompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
            setProjectId(projectId);
            setProjectName(projectName);
          }

          setSections({
            structure: data.project_files?.map((f: any) => f.name).join('\n'),
            download: data.instructions
          });

          setValidationStatus({
            valid: true,
            notes: `Successfully generated ${data.project_files?.length || 0} files`
          });

          if (data.project_files && data.project_files.length > 0) {
            addLog({
              timestamp: Date.now(),
              type: 'info',
              message: `Generated ${data.project_files.length} files for ${data.metadata?.framework || data.metadata?.language || 'Unknown'} project`
            });
          }

          setIsGenerating(false);
          setThinkingStatus('');
        },
        (error) => {
          let errorMessage = error;
          if (typeof error === 'string') {
            if (error.includes('DEEPSEEK_NOT_CONFIGURED')) {
              errorMessage = 'DeepSeek is not configured. Set DEEPSEEK_API_KEY in the backend environment (Vercel project env vars or backend/.env for local dev).';
            } else if (error.includes('AI_CONN_REFUSED')) {
              errorMessage = 'Cannot connect to DeepSeek API. Please check your network connection.';
            } else if (error.includes('Invalid API key')) {
              errorMessage = 'Invalid API key. Check DEEPSEEK_API_KEY in the backend environment (Vercel project env vars or backend/.env).';
            }
          }

          setError(errorMessage);
          addLog({
            timestamp: Date.now(),
            type: 'error',
            message: `Generation failed: ${errorMessage}`
          });

          setIsGenerating(false);
          setThinkingStatus('');
        },
        (chunk) => {
          reasoningContent += chunk;
          const charCount = reasoningContent.length;
          if (charCount < 500) {
            setThinkingStatus(t('app.plan.status.thinking'));
          } else if (charCount < 2000) {
            setThinkingStatus(t('app.plan.status.deepThinking'));
          } else {
            setThinkingStatus(t('app.plan.status.reasoning'));
          }
        },
        () => {
          setIsGenerating(false);
          if (!thinkingStatus.includes('Complete')) {
            setThinkingStatus('');
          }
        },
        {
          thinkingMode: isThinkingMode,
          onFileEvent: handleFileEvent,
          resumeContext
        }
      );
    } catch (error: any) {
      setError(error.message || 'Failed to generate code');
      setIsGenerating(false);
      setThinkingStatus('');
    }
  };

  return (
    <PanelContainer style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Liquid Glass Header */}
      <GlassHeader className={`${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <GlassCard glow="amber" className="p-2 rounded-lg flex items-center justify-center bg-amber-500/10 border-amber-500/20">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </GlassCard>
          <h2 className="text-lg font-bold text-white tracking-tight">{t('app.workspace.title')}</h2>
        </div>
        <div className={`glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 border-white/5 bg-white/5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-white/70">{actualMode || 'DeepSeek'}</span>
        </div>
      </GlassHeader>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
        {/* User Prompt Section */}
        <div className="space-y-3">
          <label className={`text-sm font-semibold text-white/90 block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('app.workspace.promptLabel')}
          </label>
          <TextArea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={t('app.workspace.promptPlaceholder')}
            className={`scrollbar-thin ${isRTL ? 'text-right' : 'text-left'}`}
            style={{ height: 'calc(50vh - 8rem)', minHeight: '240px' }}
            disabled={isGenerating}
          />
        </div>

        {/* Model Settings (Collapsible) */}
        <div className="space-y-2">
          <SettingsButton
            onClick={() => setShowModelSettings(!showModelSettings)}
            className={`${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Settings className="w-4 h-4 text-white/60" />
              <span className="text-sm font-semibold">{t('app.workspace.settings')}</span>
            </div>
            {showModelSettings ? (
              <ChevronDown className="w-4 h-4 text-white/60" />
            ) : (
              isRTL ? <ChevronLeft className="w-4 h-4 text-white/60" /> : <ChevronRight className="w-4 h-4 text-white/60" />
            )}
          </SettingsButton>

          {showModelSettings && (
            <GlassCard className="p-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
              {/* Thinking Mode Toggle */}
              <div className="space-y-3">
                <label className={`text-xs font-semibold text-white/50 uppercase tracking-wider block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('app.workspace.thinkingMode')}
                </label>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <ModeButton
                    $active={!isThinkingMode}
                    $color="#f59e0b"
                    onClick={() => setModelMode('fast')}
                    className={isRTL ? 'flex-row-reverse' : 'flex-row'}
                  >
                    <Zap className="w-4 h-4" />
                    <span>{t('app.workspace.modeFast')}</span>
                  </ModeButton>
                  <ModeButton
                    $active={isThinkingMode}
                    $color="#8b5cf6"
                    onClick={() => setModelMode('thinking')}
                    className={isRTL ? 'flex-row-reverse' : 'flex-row'}
                  >
                    <Brain className="w-4 h-4" />
                    <span>{t('app.workspace.modeThinking')}</span>
                  </ModeButton>
                </div>
                <p className={`text-xs text-white/40 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                  {isThinkingMode
                    ? t('app.workspace.modeDescriptionThinking')
                    : t('app.workspace.modeDescriptionFast')}
                </p>
              </div>

              <div className={`p-3 rounded-lg bg-white/5 border border-white/5 text-xs space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p><strong className="text-white/70">{t('app.workspace.provider')}:</strong> <span className="text-white/90">DeepSeek</span></p>
                <p className="text-white/30 italic">Note: API credentials are configured server-side</p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Generation Button */}
        <LiquidButton
          onClick={handleGenerate}
          disabled={(isGenerating && executionPhase !== 'interrupted') || !localPrompt.trim()}
          glow={!isGenerating}
          loading={isGenerating && executionPhase !== 'interrupted'}
          className="w-full shadow-lg shadow-blue-500/10"
        >
          {isGenerating && executionPhase !== 'interrupted' ? (
            <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{thinkingStatus || t('app.workspace.generating')}</span>
            </div>
          ) : (
            <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Sparkles className="w-5 h-5" />
              <span>{executionPhase === 'interrupted' ? t('app.workspace.resume') : t('app.workspace.generate')}</span>
            </div>
          )}
        </LiquidButton>
      </div>

      {/* Status Footer */}
      <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md space-y-3">
        {isGenerating && thinkingStatus && (
          <GlassCard glow="blue" className="p-3 flex items-center gap-3 bg-blue-500/5 border-blue-500/10">
            <div className={`${isRTL ? 'order-2' : 'order-1'}`}>
              {thinkingStatus.includes(t('app.plan.status.thinking')) ? (
                <Brain className="w-4 h-4 text-blue-400 animate-pulse" />
              ) : thinkingStatus.includes(t('app.plan.status.working')) ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
              )}
            </div>
            <div className={`flex-1 min-w-0 ${isRTL ? 'text-right order-1' : 'text-left order-2'}`}>
              <p className="text-xs font-medium text-blue-100 truncate">{thinkingStatus}</p>
            </div>
            {actualMode && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 ${isRTL ? 'order-3 mr-auto' : 'order-3 ml-auto'}`}>
                {actualMode}
              </span>
            )}
          </GlassCard>
        )}

        {error && (
          <GlassCard className="p-3 flex items-start justify-between gap-3 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <div className={`flex gap-3 w-full ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className={`flex flex-col flex-1 min-w-0 ${isRTL ? 'items-end' : 'items-start'}`}>
                <p className={`text-xs font-medium text-red-200 mb-1 break-words w-full ${isRTL ? 'text-right' : 'text-left'}`}>{error}</p>
                <p className={`text-[10px] text-red-300/60 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('app.workspace.errorConfig')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-300/60 hover:text-red-200 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </GlassCard>
        )}

        {sections.trace && !isGenerating && (
          <GlassCard className="p-3 bg-white/5 border-white/10">
            <p className={`font-semibold text-white/80 mb-2 text-xs uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('app.workspace.trace')}
            </p>
            <pre className={`text-[10px] text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto scrollbar-thin ${isRTL ? 'text-right' : 'text-left'}`}>
              {sections.trace}
            </pre>
          </GlassCard>
        )}

        {validationStatus && !isGenerating && (
          <JSONValidationStatus
            valid={validationStatus.valid}
            notes={validationStatus.notes}
          />
        )}

        {sections.interpretation && !isGenerating && (
          <div className={`text-xs text-white/40 italic px-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {sections.interpretation}
          </div>
        )}
      </div>
    </PanelContainer>
  );
};
