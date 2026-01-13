import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { PreviewDiagnostic, type DiagnosticResult } from '@/utils/previewDiagnostic';

interface PreviewDiagnosticPanelProps {
  onClose?: () => void;
}

export const PreviewDiagnosticPanel: React.FC<PreviewDiagnosticPanelProps> = ({ onClose }) => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    try {
      const diagnosticResults = await PreviewDiagnostic.runFullDiagnostic();
      setResults(diagnosticResults);
    } catch (error) {
      console.error('Diagnostic failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const errors = results.filter(r => r.status === 'error');
  const warnings = results.filter(r => r.status === 'warning');
  const successes = results.filter(r => r.status === 'success');

  return (
    <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Preview Diagnostic</h3>
        </div>
        <button
          onClick={() => onClose?.()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={runDiagnostic}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running...' : 'Re-run Diagnostic'}
        </button>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{errors.length}</div>
          <div className="text-sm text-red-300">Errors</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{warnings.length}</div>
          <div className="text-sm text-yellow-300">Warnings</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{successes.length}</div>
          <div className="text-sm text-green-300">OK</div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={index}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <div className="text-white font-medium">{result.message}</div>
                {showDetails && result.details && (
                  <div className="mt-2 text-sm text-gray-400">
                    <pre className="bg-gray-900/50 p-2 rounded overflow-x-auto">
                      {typeof result.details === 'string'
                        ? result.details
                        : JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
                {result.fix && (
                  <div className="mt-2 text-sm text-cyan-400">
                    💡 {result.fix}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Fixes */}
      {errors.length > 0 && (
        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="text-blue-400 font-medium mb-2">Quick Fixes:</h4>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>1. Restart your development server</li>
            <li>2. Check .env file for CSB_API_KEY</li>
            <li>3. Ensure backend is running on port 3001</li>
            <li>4. Clear browser cache and reload</li>
          </ul>
        </div>
      )}
    </div>
  );
};
