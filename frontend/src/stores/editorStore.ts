import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Enhanced Editor Store with AI Integration
interface EditorFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isOpen: boolean;
  isModified: boolean;
  version: number;
  lastModified: Date;
  aiSuggestions?: string[];
  analysis?: {
    complexity: number;
    issues: number;
    suggestions: string[];
  };
}

interface EditorTheme {
  name: string;
  base: 'vs-dark' | 'vs' | 'hc-black';
  colors?: Record<string, string>;
}

interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'trailing';
  renderLineHighlight: 'none' | 'line' | 'all' | 'gutter';
  folding: boolean;
  bracketPairColorization: boolean;
  guides: {
    indentation: boolean;
    bracketPairs: boolean;
    highlightActiveIndentation: boolean;
  };
  suggestOnTriggerCharacters: boolean;
  quickSuggestions: boolean;
  parameterHints: boolean;
  codeLens: boolean;
  occurrencesHighlight: boolean;
  semanticHighlighting: boolean;
  stickyScroll: boolean;
  smoothScrolling: boolean;
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
  mouseWheelZoom: boolean;
  multiCursorModifier: 'ctrlCmd' | 'alt';
  formatOnPaste: boolean;
  formatOnType: boolean;
}

interface AIAssistantState {
  isEnabled: boolean;
  isAnalyzing: boolean;
  lastAnalysis: any;
  suggestions: string[];
  autoFix: boolean;
  explainCode: boolean;
  generateTests: boolean;
  optimizeImports: boolean;
}

interface EditorState {
  // Files and tabs
  files: EditorFile[];
  openFiles: EditorFile[];
  activeFileId: string | null;
  
  // Editor settings
  settings: EditorSettings;
  theme: string;
  customThemes: EditorTheme[];
  
  // AI Assistant
  aiAssistant: AIAssistantState;
  
  // UI State
  sidebarWidth: number;
  showMinimap: boolean;
  showExplorer: boolean;
  showSearch: boolean;
  showAIAssistant: boolean;
  showCommandPalette: boolean;
  showProblems: boolean;
  
  // History and navigation
  history: Array<{ fileId: string; position: number; timestamp: Date }>;
  currentHistoryIndex: number;
  
  // Actions
  // File management
  openFile: (fileId: string) => void;
  closeFile: (fileId: string) => void;
  updateFile: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  createFile: (path: string, content?: string) => void;
  deleteFile: (fileId: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<EditorSettings>) => void;
  setTheme: (theme: string) => void;
  addCustomTheme: (theme: EditorTheme) => void;
  
  // AI Assistant
  toggleAIAssistant: () => void;
  runAIAnalysis: () => Promise<void>;
  applyAISuggestion: (suggestion: string) => void;
  updateAIAssistant: (state: Partial<AIAssistantState>) => void;
  
  // UI
  setSidebarWidth: (width: number) => void;
  toggleExplorer: () => void;
  toggleSearch: () => void;
  toggleProblems: () => void;
  
  // Navigation
  goBack: () => void;
  goForward: () => void;
  addToHistory: (fileId: string, position: number) => void;
  
  // Bulk operations
  saveAll: () => Promise<void>;
  closeAll: () => void;
  formatAll: () => void;
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    files: [],
    openFiles: [],
    activeFileId: null,
    
    settings: {
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
      lineHeight: 1.5,
      wordWrap: 'on',
      minimap: true,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      renderLineHighlight: 'all',
      folding: true,
      bracketPairColorization: true,
      guides: {
        indentation: true,
        bracketPairs: true,
        highlightActiveIndentation: true,
      },
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: true,
      codeLens: true,
      occurrencesHighlight: true,
      semanticHighlighting: true,
      stickyScroll: true,
      smoothScrolling: true,
      cursorBlinking: 'blink',
      cursorStyle: 'line',
      mouseWheelZoom: true,
      multiCursorModifier: 'ctrlCmd',
      formatOnPaste: true,
      formatOnType: true,
    },
    
    theme: 'vs-dark',
    customThemes: [
      {
        name: 'Apex Dark',
        base: 'vs-dark',
        colors: {
          'editor.background': '#0a0a0a',
          'editor.foreground': '#e0e0e0',
          'editor.lineHighlightBackground': '#1a1a1a',
          'editorCursor.foreground': '#00ff88',
          'editor.selectionBackground': '#00ff8820',
        }
      },
      {
        name: 'Cyberpunk',
        base: 'vs-dark',
        colors: {
          'editor.background': '#0d0221',
          'editor.foreground': '#ff00ff',
          'editorCursor.foreground': '#00ffff',
          'editor.selectionBackground': '#ff00ff30',
        }
      },
      {
        name: 'Matrix',
        base: 'vs-dark',
        colors: {
          'editor.background': '#000000',
          'editor.foreground': '#00ff00',
          'editorCursor.foreground': '#00ff00',
          'editor.selectionBackground': '#00ff0020',
        }
      }
    ],
    
    aiAssistant: {
      isEnabled: true,
      isAnalyzing: false,
      lastAnalysis: null,
      suggestions: [],
      autoFix: false,
      explainCode: true,
      generateTests: true,
      optimizeImports: true,
    },
    
    sidebarWidth: 300,
    showMinimap: true,
    showExplorer: true,
    showSearch: false,
    showAIAssistant: false,
    showCommandPalette: false,
    showProblems: false,
    
    history: [],
    currentHistoryIndex: -1,
    
    // File management actions
    openFile: (fileId: string) => {
      const { files, openFiles } = get();
      const file = files.find(f => f.id === fileId);
      
      if (!file) return;
      
      // Add to open files if not already there
      if (!openFiles.find(f => f.id === fileId)) {
        set({ openFiles: [...openFiles, { ...file, isOpen: true }] });
      }
      
      set({ activeFileId: fileId });
      
      // Add to history
      get().addToHistory(fileId, 0);
    },
    
    closeFile: (fileId: string) => {
      const { openFiles, activeFileId } = get();
      const newOpenFiles = openFiles.filter(f => f.id !== fileId);
      
      // If closing the active file, activate another
      let newActiveFileId = activeFileId;
      if (activeFileId === fileId) {
        const index = openFiles.findIndex(f => f.id === fileId);
        if (newOpenFiles.length > 0) {
          newActiveFileId = index > 0 ? newOpenFiles[index - 1].id : newOpenFiles[0].id;
        } else {
          newActiveFileId = null;
        }
      }
      
      set({ 
        openFiles: newOpenFiles, 
        activeFileId: newActiveFileId 
      });
    },
    
    updateFile: (fileId: string, content: string) => {
      const { files, openFiles } = get();
      const now = new Date();
      
      // Update in files array
      const updatedFiles = files.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              content, 
              isModified: true, 
              lastModified: now,
              version: file.version + 1
            }
          : file
      );
      
      // Update in open files
      const updatedOpenFiles = openFiles.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              content, 
              isModified: true, 
              lastModified: now,
              version: file.version + 1
            }
          : file
      );
      
      set({ 
        files: updatedFiles, 
        openFiles: updatedOpenFiles 
      });
      
      // Trigger AI analysis if enabled
      const { aiAssistant } = get();
      if (aiAssistant.isEnabled && !aiAssistant.isAnalyzing) {
        // Debounce AI analysis
        setTimeout(() => get().runAIAnalysis(), 1000);
      }
    },
    
    saveFile: async (fileId: string) => {
      const { files, openFiles } = get();
      
      // Mark as not modified
      const updatedFiles = files.map(file => 
        file.id === fileId ? { ...file, isModified: false } : file
      );
      
      const updatedOpenFiles = openFiles.map(file => 
        file.id === fileId ? { ...file, isModified: false } : file
      );
      
      set({ 
        files: updatedFiles, 
        openFiles: updatedOpenFiles 
      });
    },
    
    createFile: (path: string, content = '') => {
      const { files } = get();
      const id = `file_${Date.now()}_${Math.random()}`;
      const name = path.split('/').pop() || 'untitled';
      const language = getLanguageFromPath(path);
      
      const newFile: EditorFile = {
        id,
        name,
        path,
        content,
        language,
        isOpen: false,
        isModified: false,
        version: 1,
        lastModified: new Date()
      };
      
      set({ files: [...files, newFile] });
      get().openFile(id);
    },
    
    deleteFile: (fileId: string) => {
      const { files, openFiles, activeFileId } = get();
      
      const newFiles = files.filter(f => f.id !== fileId);
      const newOpenFiles = openFiles.filter(f => f.id !== fileId);
      
      let newActiveFileId = activeFileId;
      if (activeFileId === fileId && newOpenFiles.length > 0) {
        newActiveFileId = newOpenFiles[0].id;
      } else if (activeFileId === fileId) {
        newActiveFileId = null;
      }
      
      set({ 
        files: newFiles, 
        openFiles: newOpenFiles,
        activeFileId: newActiveFileId
      });
    },
    
    // Settings actions
    updateSettings: (newSettings: Partial<EditorSettings>) => {
      set(state => ({
        settings: { ...state.settings, ...newSettings }
      }));
      
      // Save to localStorage
      const { settings } = get();
      localStorage.setItem('editor-settings', JSON.stringify(settings));
    },
    
    setTheme: (theme: string) => {
      set({ theme });
      localStorage.setItem('editor-theme', theme);
    },
    
    addCustomTheme: (theme: EditorTheme) => {
      set(state => ({
        customThemes: [...state.customThemes, theme]
      }));
    },
    
    // AI Assistant actions
    toggleAIAssistant: () => {
      set(state => ({
        showAIAssistant: !state.showAIAssistant
      }));
    },
    
    runAIAnalysis: async () => {
      const { activeFileId, files, aiAssistant } = get();
      
      if (!activeFileId || !aiAssistant.isEnabled) return;
      
      set(state => ({
        aiAssistant: { ...state.aiAssistant, isAnalyzing: true }
      }));
      
      try {
        // Import and run AI analysis
        const { codeAnalyzer } = await import('@/services/codeAnalyzer');
        const file = files.find(f => f.id === activeFileId);
        
        if (file) {
          const analysis = await codeAnalyzer.analyzeFile(
            file.content,
            file.language,
            file.path
          );
          
          set(state => ({
            aiAssistant: {
              ...state.aiAssistant,
              isAnalyzing: false,
              lastAnalysis: analysis,
              suggestions: analysis.suggestions.map(s => s.title)
            }
          }));
        }
      } catch (error) {
        console.error('AI Analysis failed:', error);
        set(state => ({
          aiAssistant: { ...state.aiAssistant, isAnalyzing: false }
        }));
      }
    },
    
    applyAISuggestion: (suggestion: string) => {
      // Apply the selected AI suggestion
      console.log('Applying suggestion:', suggestion);
    },
    
    updateAIAssistant: (newState: Partial<AIAssistantState>) => {
      set(state => ({
        aiAssistant: { ...state.aiAssistant, ...newState }
      }));
    },
    
    // UI actions
    setSidebarWidth: (width: number) => {
      set({ sidebarWidth: width });
    },
    
    toggleExplorer: () => {
      set(state => ({ showExplorer: !state.showExplorer }));
    },
    
    toggleSearch: () => {
      set(state => ({ showSearch: !state.showSearch }));
    },
    
    toggleProblems: () => {
      set(state => ({ showProblems: !state.showProblems }));
    },
    
    // Navigation actions
    goBack: () => {
      const { history, currentHistoryIndex } = get();
      if (currentHistoryIndex > 0) {
        const newIndex = currentHistoryIndex - 1;
        const entry = history[newIndex];
        set({ 
          currentHistoryIndex: newIndex,
          activeFileId: entry.fileId
        });
        get().openFile(entry.fileId);
      }
    },
    
    goForward: () => {
      const { history, currentHistoryIndex } = get();
      if (currentHistoryIndex < history.length - 1) {
        const newIndex = currentHistoryIndex + 1;
        const entry = history[newIndex];
        set({ 
          currentHistoryIndex: newIndex,
          activeFileId: entry.fileId
        });
        get().openFile(entry.fileId);
      }
    },
    
    addToHistory: (fileId: string, position: number) => {
      const { history, currentHistoryIndex } = get();
      
      // Remove any entries after current index
      const newHistory = history.slice(0, currentHistoryIndex + 1);
      
      // Add new entry
      newHistory.push({
        fileId,
        position,
        timestamp: new Date()
      });
      
      // Limit history size
      if (newHistory.length > 100) {
        newHistory.shift();
      }
      
      set({ 
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1
      });
    },
    
    // Bulk operations
    saveAll: async () => {
      const { openFiles } = get();
      for (const file of openFiles) {
        if (file.isModified) {
          await get().saveFile(file.id);
        }
      }
    },
    
    closeAll: () => {
      set({ 
        openFiles: [],
        activeFileId: null
      });
    },
    
    formatAll: () => {
      // Format all open files
      console.log('Formatting all files');
    },
  }))
);

// Helper function
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rs: 'rust',
    php: 'php',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    vue: 'html',
    svelte: 'javascript',
  };
  return langMap[ext || ''] || 'plaintext';
}

// Subscribe to changes and persist to localStorage
useEditorStore.subscribe(
  (state) => state.settings,
  (settings) => {
    localStorage.setItem('editor-settings', JSON.stringify(settings));
  }
);

useEditorStore.subscribe(
  (state) => state.theme,
  (theme) => {
    localStorage.setItem('editor-theme', theme);
  }
);

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const savedSettings = localStorage.getItem('editor-settings');
  if (savedSettings) {
    try {
      useEditorStore.setState({
        settings: { ...useEditorStore.getState().settings, ...JSON.parse(savedSettings) }
      });
    } catch (e) {
      console.error('Failed to load editor settings:', e);
    }
  }
  
  const savedTheme = localStorage.getItem('editor-theme');
  if (savedTheme) {
    useEditorStore.setState({ theme: savedTheme });
  }
}
