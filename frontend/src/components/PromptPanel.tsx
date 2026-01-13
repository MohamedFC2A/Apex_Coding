import React, { useState, useEffect } from 'react';
import { LiquidButton } from './GlassCard';
import { JSONValidationStatus } from './JSONValidationStatus';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { aiService } from '@/services/aiService';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { ProjectFile } from '@/types';
import { Sparkles, Loader2, Clock, ChevronDown, ChevronRight, ChevronLeft, Settings, Zap, Brain, AlertCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export const PromptPanel: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [localPrompt, setLocalPrompt] = useState('');
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{ valid: boolean; notes?: string } | null>(null);
  const [actualMode, setActualMode] = useState<string>(''); // Track actual mode being used
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
  const isSuperMode = modelMode === 'super';

  // Monitor token gaps for "Still thinking..." status (fallback only)
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

    setPrompt(localPrompt); // Persist prompt
    saveCurrentSession();
    setIsGenerating(true);
    setError(null);
    setSections({});
    setValidationStatus(null);
    setActualMode('');
    setThinkingStatus(t('app.plan.status.initializing'));

    try {
      let reasoningContent = ''; // Track accumulated reasoning
      
      const isResuming = executionPhase === 'interrupted';
      let effectivePrompt = localPrompt;
      let resumeContext = undefined;

      if (isResuming) {
        resumeContext = {
          completedFiles,
          lastSuccessfulFile,
          lastSuccessfulLine
        };

        // Check for partial file to force continue
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
        // onToken
        (token) => {
          appendStreamText(token);
        },
        // onStatus
        (phase, message) => {
          // Use phase to determine consistent status text
          if (phase === 'thinking') {
            setThinkingStatus(t('app.plan.status.thinking'));
          } else if (phase === 'streaming') {
            setThinkingStatus(t('app.plan.status.working'));
          } else if (phase === 'validating') {
            setThinkingStatus(t('app.plan.status.validating'));
          } else if (phase === 'done') {
            setThinkingStatus(t('app.plan.status.complete'));
          } else {
            // Fallback to server message
            setThinkingStatus(message);
          }
        },
        // onMeta (new callback for meta events)
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
        // onJSON
        (payload) => {
          const data = payload;

          // Convert project_files to ProjectFile format
          const convertedFiles = (data.project_files || []).map((file: any) => ({
            path: file.name,
            content: file.content,
            language: getLanguageFromExtension(file.name)
          }));

          setFiles(convertedFiles);

          // Build file structure from project_files
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

          // Store sections for display (contract v2 only has minimal fields)
          setSections({
            structure: data.project_files?.map((f: any) => f.name).join('\n'),
            download: data.instructions
          });

          // Validation status
          setValidationStatus({
            valid: true,
            notes: `Successfully generated ${data.project_files?.length || 0} files`
          });

          // Auto-run the code after generation
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
        // onError
        (error) => {
          // Show clear error message based on error content
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
        // onReasoning - handle chain-of-thought chunks from thinking mode
        (chunk) => {
          reasoningContent += chunk;
          // Update status to show thinking is in progress with visual feedback
          const charCount = reasoningContent.length;
          if (charCount < 500) {
            setThinkingStatus(t('app.plan.status.thinking'));
          } else if (charCount < 2000) {
            setThinkingStatus(t('app.plan.status.deepThinking'));
          } else {
            setThinkingStatus(t('app.plan.status.reasoning'));
          }
        },
        // onComplete - ensure loading state is ALWAYS reset when stream ends
        () => {
          setIsGenerating(false);
          if (!thinkingStatus.includes('Complete')) {
            setThinkingStatus('');
          }
        },
        // thinkingMode
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
    <div className="h-full flex flex-col overflow-hidden" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Liquid Glass Header */}
      <div className={`liquid-panel p-4 border-b border-white/10 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="liquid-glass p-2 rounded-lg glow-amber">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold enterprise-text">{t('app.workspace.title')}</h2>
        </div>
        <div className={`liquid-panel px-3 py-1.5 rounded-lg flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-white/70">{actualMode || 'DeepSeek'}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* User Prompt Section */}
        <div className="space-y-2">
          <label className={`text-sm font-semibold text-white/80 block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('app.workspace.promptLabel')}
          </label>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={t('app.workspace.promptPlaceholder')}
            className={`w-full liquid-input p-4 text-white placeholder-gray-400 resize-none scrollbar-thin font-mono text-sm leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
            style={{ height: 'calc(50vh - 8rem)', minHeight: '240px' }}
            disabled={isGenerating}
          />
        </div>

        {/* Model Settings (Collapsible) */}
        <div className="liquid-panel rounded-lg overflow-hidden">
          <button
            onClick={() => setShowModelSettings(!showModelSettings)}
            className={`w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Settings className="w-4 h-4 text-white/60" />
              <span className="text-sm font-semibold text-white/80">{t('app.workspace.settings')}</span>
            </div>
            {showModelSettings ? (
              <ChevronDown className="w-4 h-4 text-white/60" />
            ) : (
              isRTL ? <ChevronLeft className="w-4 h-4 text-white/60" /> : <ChevronRight className="w-4 h-4 text-white/60" />
            )}
          </button>

          {showModelSettings && (
            <div className="p-4 pt-0 space-y-4 border-t border-white/5">
              {/* Thinking Mode Toggle */}
              <div className="space-y-2">
                <label className={`text-xs text-white/60 block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('app.workspace.thinkingMode')}
                </label>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <button
                    onClick={() => setModelMode('fast')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isThinkingMode && !isSuperMode
                        ? 'liquid-glass border-amber-500/50 text-white glow-amber'
                        : 'liquid-panel hover:bg-white/5 text-white/60'
                      }`}
                  >
                    <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Zap className={`w-4 h-4 ${!isThinkingMode && !isSuperMode ? 'text-amber-400' : 'text-white/40'}`} />
                      <span>{t('app.workspace.modeFast')}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setModelMode('thinking')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isThinkingMode
                        ? 'liquid-glass border-amber-500/50 text-white glow-amber'
                        : 'liquid-panel hover:bg-white/5 text-white/60'
                      }`}
                  >
                    <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Brain className={`w-4 h-4 ${isThinkingMode ? 'text-amber-400' : 'text-white/40'}`} />
                      <span>{t('app.workspace.modeThinking')}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setModelMode('super')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSuperMode
                        ? 'liquid-glass border-amber-500/50 text-white glow-amber'
                        : 'liquid-panel hover:bg-white/5 text-white/60'
                      }`}
                  >
                    <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Sparkles className={`w-4 h-4 ${isSuperMode ? 'text-amber-400' : 'text-white/40'}`} />
                      <span>{t('app.workspace.modeSuper')}</span>
                    </div>
                  </button>
                </div>
                <p className={`text-xs text-white/30 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {isSuperMode
                    ? t('app.workspace.modeDescriptionSuper')
                    : isThinkingMode
                      ? t('app.workspace.modeDescriptionThinking')
                      : t('app.workspace.modeDescriptionFast')}
                </p>
              </div>

              <div className={`liquid-panel p-3 rounded-lg text-xs text-white/40 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p><strong className="text-white/60">{t('app.workspace.provider')}:</strong> DeepSeek</p>
                <p className="text-white/30 mt-2">Note: API credentials are configured server-side</p>
              </div>
            </div>
          )}
        </div>

        {/* Generation Button */}
        <LiquidButton
          onClick={handleGenerate}
          disabled={(isGenerating && executionPhase !== 'interrupted') || !localPrompt.trim()}
          glow
          loading={isGenerating && executionPhase !== 'interrupted'}
          className="w-full"
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
      <div className="liquid-panel p-4 space-y-3 border-t border-white/10">
        {isGenerating && thinkingStatus && (
          <div className={`liquid-glass p-3 rounded-lg flex items-center gap-2 glow-amber ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            {thinkingStatus.includes(t('app.plan.status.thinking')) ? (
              <Brain className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : thinkingStatus.includes(t('app.plan.status.working')) ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : thinkingStatus.includes(t('app.plan.status.validating')) ? (
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : (
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
            <p className="text-xs text-white/60">{thinkingStatus}</p>
            {actualMode && (
              <span className={`text-xs text-white/40 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>({actualMode})</span>
            )}
          </div>
        )}

        {error && (
          <div className={`liquid-glass p-3 rounded-lg flex items-center justify-between gap-2 border border-red-500/30 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                <p className={`text-xs text-white/80 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</p>
                <p className={`text-xs text-white/60 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('app.workspace.errorConfig')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {sections.trace && !isGenerating && (
          <div className="liquid-glass p-3 rounded-lg">
            <p className={`font-semibold text-white/80 mb-2 text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('app.workspace.trace')}
            </p>
            <pre className={`text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto scrollbar-thin ${isRTL ? 'text-right' : 'text-left'}`}>
              {sections.trace}
            </pre>
          </div>
        )}

        {validationStatus && !isGenerating && (
          <JSONValidationStatus
            valid={validationStatus.valid}
            notes={validationStatus.notes}
          />
        )}

        {sections.interpretation && !isGenerating && (
          <div className={`text-xs text-white/50 ${isRTL ? 'text-right' : 'text-left'}`}>
            {sections.interpretation}
          </div>
        )}
      </div>
    </div>
  );
};
