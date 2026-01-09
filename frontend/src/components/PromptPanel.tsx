import React, { useState, useEffect } from 'react';
import { LiquidButton } from './GlassCard';
import { JSONValidationStatus } from './JSONValidationStatus';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { aiService } from '@/services/aiService';
import { executionService } from '@/services/executionService';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { ProjectFile } from '@/types';
import { Sparkles, Loader2, Clock, ChevronDown, ChevronRight, Settings, Zap, Brain, AlertCircle, X } from 'lucide-react';

export const PromptPanel: React.FC = () => {
  const [localPrompt, setLocalPrompt] = useState('');
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{ valid: boolean; notes?: string } | null>(null);
  const [actualMode, setActualMode] = useState<string>(''); // Track actual mode being used
  const {
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
    executionPhase
  } = useAIStore();
  const { setFiles, setFileStructure, setStack, setDescription, setProjectId, setProjectName } = useProjectStore();
  const { setIsExecuting, setExecutionResult, setPreviewUrl, setPreviewContent, addLog } = usePreviewStore();

  const isThinkingMode = modelMode === 'thinking';

  // Monitor token gaps for "Still thinking..." status (fallback only)
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      const gap = Date.now() - lastTokenAt;
      if (gap > 5000 && lastTokenAt > 0) {
        setThinkingStatus('Still thinking...');
      } else if (lastTokenAt > 0 && !thinkingStatus.includes('Generating')) {
        setThinkingStatus('Generating code...');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isGenerating, lastTokenAt, thinkingStatus]);

  const autoRunCode = async (files: ProjectFile[]) => {
    if (files.length === 0) return;

    setIsExecuting(true);
    addLog({
      timestamp: Date.now(),
      type: 'info',
      message: '[AUTO-RUN] Starting execution...'
    });

    try {
      const entryFile =
        files.find((file) => {
          const name = (file.path || file.name || '').split('/').pop() || '';
          return /^(main|index|app)\./i.test(name);
        }) || files[0];

      const entryLanguage =
        entryFile.language ||
        getLanguageFromExtension(entryFile.path || entryFile.name || '');

      if (entryLanguage === 'html') {
        setPreviewContent(entryFile.content || '');
        setPreviewUrl(null);
        setExecutionResult({ success: true, output: '' });
        addLog({
          timestamp: Date.now(),
          type: 'success',
          message: '[AUTO-RUN] HTML preview updated.'
        });
        return;
      }

      const result = await executionService.executeCode({
        sourceCode: entryFile.content || '',
        language: entryLanguage
      });

      setExecutionResult(result);
      setPreviewUrl(null);
      setPreviewContent(null);

      if (result.success) {
        if (result.output) {
          addLog({
            timestamp: Date.now(),
            type: 'info',
            message: result.output
          });
        }

        addLog({
          timestamp: Date.now(),
          type: 'success',
          message: '[AUTO-RUN] Code executed successfully!'
        });

        if (result.error) {
          addLog({
            timestamp: Date.now(),
            type: 'error',
            message: result.error
          });
        }
      } else {
        addLog({
          timestamp: Date.now(),
          type: 'error',
          message: `[AUTO-RUN] ${result.error || 'Execution failed'}`
        });
      }
    } catch (error: any) {
      addLog({
        timestamp: Date.now(),
        type: 'error',
        message: `[AUTO-RUN] ${error.message || 'Execution failed'}`
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleGenerate = async () => {
    if (!localPrompt.trim() || isGenerating) return;

    saveCurrentSession();
    setIsGenerating(true);
    setError(null);
    setSections({});
    setValidationStatus(null);
    setActualMode('');
    setThinkingStatus('Initializing...');

    try {
      let reasoningContent = ''; // Track accumulated reasoning

      await aiService.generateCodeStream(
        localPrompt,
        // onToken
        (token) => {
          appendStreamText(token);
        },
        // onStatus
        (phase, message) => {
          // Use phase to determine consistent status text
          if (phase === 'thinking') {
            setThinkingStatus('Thinking...');
          } else if (phase === 'streaming') {
            setThinkingStatus('Generating code...');
          } else if (phase === 'validating') {
            setThinkingStatus('Validating response...');
          } else if (phase === 'done') {
            setThinkingStatus('Complete!');
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

            setTimeout(async () => {
              await autoRunCode(convertedFiles);
            }, 500);
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
            setThinkingStatus('Thinking...');
          } else if (charCount < 2000) {
            setThinkingStatus('Deep thinking...');
          } else {
            setThinkingStatus('Reasoning...');
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
          onFileEvent: handleFileEvent
        }
      );
    } catch (error: any) {
      setError(error.message || 'Failed to generate code');
      setIsGenerating(false);
      setThinkingStatus('');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Liquid Glass Header */}
      <div className="liquid-panel p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="liquid-glass p-2 rounded-lg glow-blue">
            <Sparkles className="w-5 h-5 text-white/70" />
          </div>
          <h2 className="text-lg font-bold enterprise-text">AI Workspace</h2>
        </div>
        <div className="liquid-panel px-3 py-1.5 rounded-lg flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-white/70">{actualMode || 'DeepSeek'}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* User Prompt Section */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-white/80">Your Prompt</label>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="Describe your software idea in detail...&#x0a;&#x0a;Examples:&#x0a;• Create a todo app with React and TypeScript&#x0a;• Build a REST API with Node.js, Express, and MongoDB&#x0a;• Make a portfolio website with HTML, CSS, and JavaScript&#x0a;• Develop a chat application using Python Flask and WebSockets&#x0a;&#x0a;Be specific about features, design, and functionality."
            className="w-full liquid-input p-4 text-white placeholder-gray-400 resize-none scrollbar-thin font-mono text-sm leading-relaxed"
            style={{ height: 'calc(50vh - 8rem)', minHeight: '240px' }}
            disabled={isGenerating}
          />
        </div>

        {/* Model Settings (Collapsible) */}
        <div className="liquid-panel rounded-lg overflow-hidden">
          <button
            onClick={() => setShowModelSettings(!showModelSettings)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-white/60" />
              <span className="text-sm font-semibold text-white/80">Model Settings</span>
            </div>
            {showModelSettings ? (
              <ChevronDown className="w-4 h-4 text-white/60" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/60" />
            )}
          </button>

          {showModelSettings && (
            <div className="p-4 pt-0 space-y-4 border-t border-white/5">
              {/* Thinking Mode Toggle */}
              <div className="space-y-2">
                <label className="text-xs text-white/60">Thinking Mode</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModelMode('fast')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isThinkingMode
                        ? 'liquid-glass border-green-500/50 text-white'
                        : 'liquid-panel hover:bg-white/5 text-white/60'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span>Fast</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setModelMode('thinking')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isThinkingMode
                        ? 'liquid-glass border-purple-500/50 text-white'
                        : 'liquid-panel hover:bg-white/5 text-white/60'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span>Thinking</span>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-white/30">
                  {isThinkingMode
                    ? 'Uses DeepSeek Reasoner (slower but more detailed)'
                    : 'Uses configured DeepSeek model (fast response)'}
                </p>
              </div>

              <div className="liquid-panel p-3 rounded-lg text-xs text-white/40 space-y-1">
                <p><strong className="text-white/60">Provider:</strong> DeepSeek</p>
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
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{thinkingStatus || 'Generating...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>{executionPhase === 'interrupted' ? 'Resume Generation' : 'Generate Full Code'}</span>
            </>
          )}
        </LiquidButton>
      </div>

      {/* Status Footer */}
      <div className="liquid-panel p-4 space-y-3 border-t border-white/10">
        {isGenerating && thinkingStatus && (
          <div className="liquid-glass p-3 rounded-lg flex items-center gap-2 glow-blue">
            {thinkingStatus.includes('Thinking') ? (
              <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
            ) : thinkingStatus.includes('Generating') ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : thinkingStatus.includes('Validating') ? (
              <Clock className="w-4 h-4 text-green-400 animate-pulse" />
            ) : (
              <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
            )}
            <p className="text-xs text-white/60">{thinkingStatus}</p>
            {actualMode && (
              <span className="text-xs text-white/40 ml-auto">({actualMode})</span>
            )}
          </div>
        )}

        {error && (
          <div className="liquid-glass p-3 rounded-lg flex items-center justify-between gap-2 border border-red-500/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <div className="flex flex-col">
                <p className="text-xs text-white/80 mb-1">{error}</p>
                <p className="text-xs text-white/60">
                  The browser never sees your key. Configure <code>DEEPSEEK_API_KEY</code> on the backend (Vercel env vars or <code>backend/.env</code>).
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
            <p className="font-semibold text-white/80 mb-2 text-xs">Decision Trace</p>
            <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto scrollbar-thin">
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
          <div className="text-xs text-white/50">
            {sections.interpretation}
          </div>
        )}
      </div>
    </div>
  );
};
