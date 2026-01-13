import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { 
  File, 
  Folder, 
  FolderOpen, 
  Search, 
  Settings, 
  Sparkles, 
  Zap, 
  Code2, 
  Layout, 
  Palette, 
  GitBranch, 
  Save,
  Copy,
  Download,
  Upload,
  Play,
  Pause,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Check,
  AlertCircle,
  Lightbulb,
  Brain,
  Target,
  Rocket
} from 'lucide-react';

import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { aiCodeGenerator } from '@/services/aiCodeGenerator';
import { fileSystemAI } from '@/services/fileSystemAI';
import { codeAnalyzer } from '@/services/codeAnalyzer';
import { smartTemplates } from '@/services/smartTemplates';

// Types
interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  language?: string;
  children?: FileNode[];
  isOpen?: boolean;
  isModified?: boolean;
  errors?: number;
  warnings?: number;
}

interface EditorTheme {
  name: string;
  base: 'vs-dark' | 'vs' | 'hc-black';
  colors: Record<string, string>;
}

interface AIAssistant {
  analyzeCode: (code: string, language: string) => Promise<{
    suggestions: string[];
    optimizations: string[];
    issues: Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }>;
    complexity: number;
    improvements: string[];
  }>;
  generateCode: (prompt: string, context: any) => Promise<string>;
  refactorCode: (code: string, instructions: string) => Promise<string>;
  explainCode: (code: string) => Promise<string>;
}

interface SuperEditorHandle {
  saveAll: () => Promise<void>;
  formatCode: () => void;
  runAIAnalysis: () => Promise<void>;
  generateComponent: (template: string) => void;
  optimizeProject: () => Promise<void>;
}

export const SuperEditor = forwardRef<SuperEditorHandle>((props, ref) => {
  // Stores
  const { files, addFile, updateFile, deleteFile } = useProjectStore();
  const { appendThinkingContent, isGenerating } = useAIStore();
  const { 
    openFiles, 
    activeFileId, 
    setOpenFile, 
    closeFile, 
    fontSize, 
    theme, 
    wordWrap,
    minimap,
    lineNumbers 
  } = useEditorStore();

  // State
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Editor Ref
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Custom themes
  const customThemes: EditorTheme[] = [
    {
      name: 'Apex Dark',
      base: 'vs-dark',
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#e0e0e0',
        'editor.lineHighlightBackground': '#1a1a1a',
        'editorCursor.foreground': '#00ff88',
        'editor.selectionBackground': '#00ff8820',
        'editor.inactiveSelectionBackground': '#00ff8810',
        'editorIndentGuide.background': '#ffffff10',
        'editorIndentGuide.activeBackground': '#ffffff20',
      }
    },
    {
      name: 'Cyberpunk',
      base: 'vs-dark',
      colors: {
        'editor.background': '#0d0221',
        'editor.foreground': '#ff00ff',
        'editor.lineHighlightBackground': '#1a0033',
        'editorCursor.foreground': '#00ffff',
        'editor.selectionBackground': '#ff00ff30',
        'editorIndentGuide.background': '#ff00ff10',
        'editorIndentGuide.activeBackground': '#ff00ff20',
      }
    },
    {
      name: 'Matrix',
      base: 'vs-dark',
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#00ff00',
        'editor.lineHighlightBackground': '#001100',
        'editorCursor.foreground': '#00ff00',
        'editor.selectionBackground': '#00ff0020',
        'editorIndentGuide.background': '#00ff0005',
        'editorIndentGuide.activeBackground': '#00ff0010',
      }
    }
  ];

  // Initialize file tree
  useEffect(() => {
    const buildFileTree = (files: any[]): FileNode[] => {
      const tree: FileNode[] = [];
      const map = new Map();

      // Create nodes
      files.forEach(file => {
        const parts = file.path.split('/');
        let currentPath = '';
        let currentLevel = tree;

        parts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isLastPart = index === parts.length - 1;
          const isFile = isLastPart && file.content !== undefined;

          if (!map.has(currentPath)) {
            const node: FileNode = {
              id: currentPath,
              name: part,
              type: isFile ? 'file' : 'folder',
              path: currentPath,
              content: file.content,
              language: getFileLanguage(part),
              children: isFile ? undefined : []
            };
            map.set(currentPath, node);
            currentLevel.push(node);
          }

          const node = map.get(currentPath);
          if (!isLastPart && node.children) {
            currentLevel = node.children;
          }
        });
      });

      return tree;
    };

    setFileTree(buildFileTree(files));
  }, [files]);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor;
    setEditor(editor);

    // Configure editor
    editor.updateOptions({
      fontSize,
      wordWrap,
      minimap: { enabled: minimap },
      lineNumbers,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      codeLens: true,
      folding: true,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      occurrencesHighlight: true,
      renderWhitespace: 'selection',
      guides: {
        indentation: true,
        bracketPairs: true
      }
    });

    // Add custom commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentFile();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      setShowCommandPalette(true);
    });

    // AI-powered code completion
    monaco.languages.registerCompletionItemProvider('*', {
      provideCompletionItems: async (model: any, position: any) => {
        const suggestions = await aiCodeGenerator.getCompletions(
          model.getValue(),
          model.getLanguageId(),
          position
        );
        return { suggestions };
      }
    });

    // AI error detection
    editor.onDidChangeModelContent(async () => {
      if (showAIPanel) {
        const analysis = await analyzeCurrentCode();
        setAiSuggestions(analysis.suggestions);
      }
    });
  }, [fontSize, wordWrap, minimap, lineNumbers, showAIPanel]);

  // Save current file
  const saveCurrentFile = useCallback(async () => {
    if (!editor || !activeFileId) return;
    
    const content = editor.getValue();
    updateFile(activeFileId, content);
    
    // Show save animation
    const statusBar = document.querySelector('.save-status');
    if (statusBar) {
      statusBar.textContent = 'Saved';
      setTimeout(() => {
        statusBar.textContent = 'Ready';
      }, 2000);
    }
  }, [editor, activeFileId, updateFile]);

  // Analyze current code with AI
  const analyzeCurrentCode = useCallback(async () => {
    if (!editor || !activeFileId) return { suggestions: [], optimizations: [], issues: [], complexity: 0, improvements: [] };
    
    const code = editor.getValue();
    const language = editor.getModel()?.getLanguageId() || 'javascript';
    
    setIsAnalyzing(true);
    try {
      const analysis = await aiCodeGenerator.analyzeCode(code, language);
      
      // Add decorations for issues
      const decorations: monaco.editor.IModelDeltaDecoration[] = analysis.issues.map(issue => ({
        range: new monaco.Range(
          issue.line,
          1,
          issue.line,
          1
        ),
        options: {
          isWholeLine: true,
          className: `issue-${issue.severity}`,
          glyphMarginClassName: `glyph-${issue.severity}`,
          hoverMessage: { value: issue.message }
        }
      }));
      
      editor.deltaDecorations([], decorations);
      
      return analysis;
    } finally {
      setIsAnalyzing(false);
    }
  }, [editor, activeFileId]);

  // Generate new file/folder structure
  const generateFileStructure = useCallback(async (type: 'component' | 'page' | 'api' | 'hook') => {
    const structure = await smartTemplates.getStructure(type);
    const files = await smartTemplates.generateFiles(structure);
    
    files.forEach(file => {
      addFile(file.path, file.content);
    });
    
    appendThinkingContent(`[AI] Generated ${type} structure with ${files.length} files\n`);
  }, [addFile, appendThinkingContent]);

  // AI-powered refactoring
  const refactorWithAI = useCallback(async (instructions: string) => {
    if (!editor || !activeFileId) return;
    
    const code = editor.getValue();
    const language = editor.getModel()?.getLanguageId() || 'javascript';
    
    setIsAnalyzing(true);
    try {
      const refactored = await aiCodeGenerator.refactorCode(code, instructions, language);
      editor.setValue(refactored);
      appendThinkingContent(`[AI] Refactored code: ${instructions}\n`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [editor, activeFileId, appendThinkingContent]);

  // Optimize entire project
  const optimizeProject = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const optimizations = await fileSystemAI.optimizeProject(files);
      
      // Apply optimizations
      optimizations.forEach(opt => {
        if (opt.type === 'file') {
          updateFile(opt.path, opt.content);
        } else if (opt.type === 'delete') {
          deleteFile(opt.path);
        } else if (opt.type === 'move') {
          // Handle file move
          addFile(opt.newPath, opt.content);
          deleteFile(opt.oldPath);
        }
      });
      
      appendThinkingContent(`[AI] Applied ${optimizations.length} optimizations\n`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, updateFile, deleteFile, appendThinkingContent]);

  // Format code with AI
  const formatCode = useCallback(() => {
    if (!editor) return;
    
    editor.getAction('editor.action.formatDocument')?.run();
  }, [editor]);

  // Command palette
  const CommandPalette = useMemo(() => {
    const commands = [
      { id: 'save', name: 'Save File', icon: Save, action: saveCurrentFile },
      { id: 'format', name: 'Format Code', icon: Code2, action: formatCode },
      { id: 'analyze', name: 'AI Analysis', icon: Brain, action: runAIAnalysis },
      { id: 'component', name: 'New Component', icon: Plus, action: () => generateFileStructure('component') },
      { id: 'page', name: 'New Page', icon: Layout, action: () => generateFileStructure('page') },
      { id: 'optimize', name: 'Optimize Project', icon: Rocket, action: optimizeProject },
    ];

    return (
      <div className="absolute top-16 right-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 w-80">
        <div className="p-2">
          <input
            type="text"
            placeholder="Type a command..."
            className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
            autoFocus
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {commands.map(cmd => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setShowCommandPalette(false);
                }}
                className="flex items-center w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded transition-colors"
              >
                <cmd.icon className="w-4 h-4 mr-3 text-cyan-400" />
                <span>{cmd.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }, [saveCurrentFile, formatCode, runAIAnalysis, generateFileStructure, optimizeProject]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      openFiles.forEach(file => {
        if (file.content) {
          updateFile(file.id, file.content);
        }
      });
    },
    formatCode,
    runAIAnalysis: analyzeCurrentCode,
    generateComponent: (template: string) => generateFileStructure('component'),
    optimizeProject
  }), [openFiles, updateFile, formatCode, analyzeCurrentCode, generateFileStructure, optimizeProject]);

  const activeFile = openFiles.find(f => f.id === activeFileId);

  return (
    <div className="flex h-full bg-gray-950">
      {/* Sidebar - File Explorer */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center">
              <Folder className="w-4 h-4 mr-2 text-cyan-400" />
              Explorer
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => generateFileStructure('component')}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title="New Component"
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={optimizeProject}
                disabled={isAnalyzing}
                className="p-1 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                title="Optimize Project"
              >
                <Rocket className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-gray-800 text-gray-300 text-sm rounded border border-gray-700 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {fileTree.map(node => (
            <FileTreeNode
              key={node.id}
              node={node}
              level={0}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              activeFileId={activeFileId}
              onFileSelect={setOpenFile}
            />
          ))}
        </div>

        {/* AI Assistant Panel */}
        <div className="border-t border-gray-800 p-4">
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all"
          >
            <span className="flex items-center text-sm font-medium">
              <Brain className="w-4 h-4 mr-2" />
              AI Assistant
            </span>
            <Zap className="w-4 h-4" />
          </button>
          
          {showAIPanel && (
            <div className="mt-3 space-y-2">
              <button
                onClick={analyzeCurrentCode}
                disabled={isAnalyzing}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
              >
                <Target className="w-4 h-4 mr-2" />
                Analyze Code
              </button>
              <button
                onClick={() => refactorWithAI('Optimize for performance')}
                disabled={isAnalyzing}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Refactor Code
              </button>
              
              {aiSuggestions.length > 0 && (
                <div className="mt-3 p-2 bg-gray-800 rounded">
                  <div className="text-xs font-semibold text-cyan-400 mb-1">Suggestions:</div>
                  {aiSuggestions.slice(0, 3).map((suggestion, i) => (
                    <div key={i} className="text-xs text-gray-400 mt-1">
                      • {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto">
          {openFiles.map(file => (
            <div
              key={file.id}
              className={`flex items-center px-3 py-2 border-r border-gray-800 cursor-pointer group ${
                file.id === activeFileId ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
              onClick={() => setOpenFile(file.id)}
            >
              <File className="w-4 h-4 mr-2" style={{ color: getLanguageColor(file.language) }} />
              <span className="text-sm">{file.name}</span>
              {file.isModified && (
                <div className="w-2 h-2 bg-orange-400 rounded-full ml-2" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 relative">
          {activeFile ? (
            <Editor
              height="100%"
              language={activeFile.language || 'plaintext'}
              value={activeFile.content || ''}
              theme={selectedTheme}
              onChange={(value) => {
                if (value !== undefined) {
                  updateFile(activeFile.id, value);
                }
              }}
              onMount={handleEditorDidMount}
              options={{
                readOnly: false,
                minimap: { enabled: minimap },
                fontSize,
                wordWrap,
                lineNumbers,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Code2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No file selected</p>
                <p className="text-sm mt-2">Select a file from the explorer to start editing</p>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-1 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="save-status">Ready</span>
              {activeFile && (
                <>
                  <span>{activeFile.language}</span>
                  <span>Ln {editor?.getPosition()?.lineNumber}, Col {editor?.getPosition()?.column}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="hover:text-white transition-colors"
              >
                Commands (Ctrl+P)
              </button>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="bg-transparent border-none text-gray-400 focus:text-white"
              >
                <option value="vs-dark">Dark</option>
                <option value="apex-dark">Apex Dark</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="matrix">Matrix</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCommandPalette(false)}>
          {CommandPalette}
        </div>
      )}
    </div>
  );
});

// Helper Components
const FileTreeNode: React.FC<{
  node: FileNode;
  level: number;
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
}> = ({ node, level, expandedFolders, setExpandedFolders, activeFileId, onFileSelect }) => {
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;

  const toggleFolder = () => {
    const newExpanded = new Set(expandedFolders);
    if (isExpanded) {
      newExpanded.delete(node.id);
    } else {
      newExpanded.add(node.id);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div>
      <div
        className={`flex items-center px-2 py-1 cursor-pointer hover:bg-gray-800 rounded transition-colors ${
          isActive ? 'bg-gray-800 text-white' : 'text-gray-400'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            toggleFolder();
          } else {
            onFileSelect(node.id);
          }
        }}
      >
        {node.type === 'folder' ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            <FolderOpen className="w-4 h-4 mr-2 text-yellow-500" />
          </>
        ) : (
          <File className="w-4 h-4 mr-2 ml-5" style={{ color: getLanguageColor(node.language) }} />
        )}
        <span className="text-sm">{node.name}</span>
        {node.errors && node.errors > 0 && (
          <div className="ml-auto">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
        )}
      </div>
      
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Helper Functions
const getFileLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
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
};

const getLanguageColor = (language?: string): string => {
  const colors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    json: '#000000',
    css: '#1572b6',
    html: '#e34f26',
    markdown: '#083fa1',
    python: '#3776ab',
    java: '#007396',
    cpp: '#00599c',
    go: '#00add8',
    rust: '#dea584',
    php: '#777bb4',
    sql: '#336791',
    yaml: '#cb171e',
  };
  return colors[language || ''] || '#808080';
};

SuperEditor.displayName = 'SuperEditor';
