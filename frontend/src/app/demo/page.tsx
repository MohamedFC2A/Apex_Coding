'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { 
  Code2, 
  Zap, 
  Brain, 
  Rocket, 
  Sparkles, 
  Target,
  Monitor,
  Settings,
  Save,
  Download,
  Upload,
  FileText,
  FolderOpen,
  Search
} from 'lucide-react';

// Dynamically import the SuperEditor to avoid SSR issues
const SuperEditor = dynamic(
  () => import('@/components/Editor/SuperEditor'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Super Editor...</p>
        </div>
      </div>
    )
  }
);

export default function DemoPage() {
  const editorRef = useRef<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const handleSaveAll = async () => {
    if (editorRef.current) {
      await editorRef.current.saveAll();
    }
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.formatCode();
    }
  };

  const handleRunAIAnalysis = async () => {
    if (editorRef.current) {
      setIsAnalyzing(true);
      await editorRef.current.runAIAnalysis();
      setIsAnalyzing(false);
    }
  };

  const handleGenerateComponent = () => {
    if (editorRef.current) {
      editorRef.current.generateComponent('react');
    }
  };

  const handleOptimizeProject = async () => {
    if (editorRef.current) {
      setIsAnalyzing(true);
      await editorRef.current.optimizeProject();
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar - Features Panel */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
            <Code2 className="w-8 h-8 mr-3 text-cyan-400" />
            Super Editor
          </h1>
          <p className="text-gray-400 text-sm">
            AI-powered code editor with advanced features
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Features */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <Brain className="w-4 h-4 mr-2 text-purple-400" />
              AI Features
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleRunAIAnalysis}
                disabled={isAnalyzing}
                className="w-full flex items-center px-3 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all disabled:opacity-50"
              >
                <Target className="w-4 h-4 mr-2" />
                {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
              </button>
              <button
                onClick={handleGenerateComponent}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Component
              </button>
              <button
                onClick={handleOptimizeProject}
                disabled={isAnalyzing}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Optimize Project
              </button>
            </div>
          </div>

          {/* Editor Actions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <Settings className="w-4 h-4 mr-2 text-cyan-400" />
              Editor Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleSaveAll}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Save All Files
              </button>
              <button
                onClick={handleFormatCode}
                className="w-full flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Code2 className="w-4 h-4 mr-2" />
                Format Code
              </button>
            </div>
          </div>

          {/* Features List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Features</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start">
                <Zap className="w-4 h-4 mr-2 mt-0.5 text-yellow-400" />
                <span>AI-powered code completion</span>
              </li>
              <li className="flex items-start">
                <Brain className="w-4 h-4 mr-2 mt-0.5 text-purple-400" />
                <span>Smart code analysis & suggestions</span>
              </li>
              <li className="flex items-start">
                <Target className="w-4 h-4 mr-2 mt-0.5 text-cyan-400" />
                <span>Error detection & auto-fix</span>
              </li>
              <li className="flex items-start">
                <Sparkles className="w-4 h-4 mr-2 mt-0.5 text-pink-400" />
                <span>Code refactoring assistance</span>
              </li>
              <li className="flex items-start">
                <Rocket className="w-4 h-4 mr-2 mt-0.5 text-orange-400" />
                <span>Project optimization</span>
              </li>
              <li className="flex items-start">
                <FolderOpen className="w-4 h-4 mr-2 mt-0.5 text-green-400" />
                <span>Smart file organization</span>
              </li>
              <li className="flex items-start">
                <Search className="w-4 h-4 mr-2 mt-0.5 text-blue-400" />
                <span>Advanced search & replace</span>
              </li>
              <li className="flex items-start">
                <Monitor className="w-4 h-4 mr-2 mt-0.5 text-indigo-400" />
                <span>Multiple themes support</span>
              </li>
            </ul>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Shortcuts</h3>
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Save</span>
                <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+S</kbd>
              </div>
              <div className="flex justify-between">
                <span>Command Palette</span>
                <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+P</kbd>
              </div>
              <div className="flex justify-between">
                <span>Format</span>
                <kbd className="px-2 py-1 bg-gray-800 rounded">Shift+Alt+F</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Ready</span>
            <button
              onClick={() => setShowStats(!showStats)}
              className="hover:text-white transition-colors"
            >
              {showStats ? 'Hide' : 'Show'} Stats
            </button>
          </div>
          {showStats && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Files Open:</span>
                <span>3</span>
              </div>
              <div className="flex justify-between">
                <span>Lines of Code:</span>
                <span>1,247</span>
              </div>
              <div className="flex justify-between">
                <span>AI Score:</span>
                <span className="text-green-400">92%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        <SuperEditor ref={editorRef} />
      </div>
    </div>
  );
}
