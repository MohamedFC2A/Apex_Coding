import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink, Settings, Info, Server, Key, Globe } from 'lucide-react';

interface PreviewConfig {
  provider: string;
  configured: boolean;
  missing: string[];
  baseUrl: string;
  tokenPresent: boolean;
  tokenLast4: string | null;
  tokenValid: boolean;
}

interface DiagnosticsData {
  config: PreviewConfig;
  serverStatus: 'ok' | 'error' | 'checking';
  sandboxConnection: 'ok' | 'error' | 'checking';
  environment: string;
  timestamp: string;
  errors: string[];
}

export const PreviewDiagnostics: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    const isRefreshing = refreshing || !loading;
    if (!isRefreshing) setLoading(true);
    
    try {
      const configRes = await fetch('/api/preview/config');
      const configData = await configRes.json();
      
      const diagRes = await fetch('/api/preview/diagnostics');
      const diagData = await diagRes.ok ? await diagRes.json() : {};

      const data: DiagnosticsData = {
        config: configData,
        serverStatus: configRes.ok ? 'ok' : 'error',
        sandboxConnection: diagData.sandboxConnection || 'checking',
        environment: diagData.environment || process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString(),
        errors: []
      };

      if (!configData.configured) {
        data.errors.push('CodeSandbox API key is not configured');
      }
      if (configData.missing && configData.missing.length > 0) {
        data.errors.push(`Missing configuration: ${configData.missing.join(', ')}`);
      }
      if (!configData.tokenValid) {
        data.errors.push('CodeSandbox API key appears to be invalid or placeholder');
      }

      setDiagnostics(data);
    } catch (error) {
      setDiagnostics({
        config: {
          provider: 'unknown',
          configured: false,
          missing: ['CSB_API_KEY'],
          baseUrl: '',
          tokenPresent: false,
          tokenLast4: null,
          tokenValid: false
        },
        serverStatus: 'error',
        sandboxConnection: 'error',
        environment: 'unknown',
        timestamp: new Date().toISOString(),
        errors: [`Failed to fetch diagnostics: ${error}`]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDiagnostics();
  };

  const StatusIcon = ({ status }: { status: 'ok' | 'error' | 'checking' }) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const StatusText = ({ status }: { status: 'ok' | 'error' | 'checking' }) => {
    switch (status) {
      case 'ok':
        return <span className="text-green-400 font-medium">OK</span>;
      case 'error':
        return <span className="text-red-400 font-medium">Error</span>;
      case 'checking':
        return <span className="text-blue-400 font-medium">Checking...</span>;
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="text-white font-medium">Loading diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Settings className="w-6 h-6 text-blue-400 mr-3" />
          <h2 className="text-xl font-bold text-white">Preview Diagnostics</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {diagnostics && (
        <>
          {/* Summary Card */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Status Summary</h3>
              </div>
              <div className="text-sm text-gray-400">
                Last checked: {new Date(diagnostics.timestamp).toLocaleTimeString()}
              </div>
            </div>
            
            {diagnostics.errors.length > 0 ? (
              <div className="space-y-2">
                {diagnostics.errors.map((error, index) => (
                  <div key={index} className="flex items-start p-3 bg-red-900/20 border border-red-800/30 rounded">
                    <XCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-red-300 text-sm">{error}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center p-3 bg-green-900/20 border border-green-800/30 rounded">
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                <span className="text-green-300 text-sm">All systems operational</span>
              </div>
            )}
          </div>

          {/* Configuration Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Server Status */}
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex items-center mb-3">
                <Server className="w-5 h-5 text-blue-400 mr-2" />
                <h4 className="font-medium text-white">Server Status</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">API Connection</div>
                  <div className="text-xs text-gray-400">Backend server reachable</div>
                </div>
                <div className="flex items-center">
                  <StatusIcon status={diagnostics.serverStatus} />
                  <span className="ml-2">
                    <StatusText status={diagnostics.serverStatus} />
                  </span>
                </div>
              </div>
            </div>

            {/* CodeSandbox Connection */}
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex items-center mb-3">
                <Globe className="w-5 h-5 text-purple-400 mr-2" />
                <h4 className="font-medium text-white">CodeSandbox</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">API Connection</div>
                  <div className="text-xs text-gray-400">External service reachable</div>
                </div>
                <div className="flex items-center">
                  <StatusIcon status={diagnostics.sandboxConnection} />
                  <span className="ml-2">
                    <StatusText status={diagnostics.sandboxConnection} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* API Key Details */}
          <div className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <div className="flex items-center mb-4">
              <Key className="w-5 h-5 text-amber-400 mr-2" />
              <h4 className="font-medium text-white">CodeSandbox API Key</h4>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Configured</span>
                <div className="flex items-center">
                  {diagnostics.config.configured ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      <span className="text-green-400 text-sm">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500 mr-1" />
                      <span className="text-red-400 text-sm">No</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Key Present</span>
                <div className="flex items-center">
                  {diagnostics.config.tokenPresent ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      <span className="text-green-400 text-sm">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500 mr-1" />
                      <span className="text-red-400 text-sm">No</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Key Valid</span>
                <div className="flex items-center">
                  {diagnostics.config.tokenValid ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      <span className="text-green-400 text-sm">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500 mr-1" />
                      <span className="text-red-400 text-sm">No</span>
                    </>
                  )}
                </div>
              </div>

              {diagnostics.config.tokenLast4 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Key Last 4</span>
                  <code className="text-sm font-mono bg-black/40 px-2 py-1 rounded">
                    ...{diagnostics.config.tokenLast4}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Environment Info */}
          <div className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <div className="flex items-center mb-4">
              <Info className="w-5 h-5 text-cyan-400 mr-2" />
              <h4 className="font-medium text-white">Environment Information</h4>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Environment</span>
                <span className="text-sm font-mono text-white">{diagnostics.environment}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Provider</span>
                <span className="text-sm font-mono text-white">{diagnostics.config.provider}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Base URL</span>
                <span className="text-sm font-mono text-white">{diagnostics.config.baseUrl}</span>
              </div>
            </div>
          </div>

          {/* Troubleshooting Steps */}
          <div className="p-4 bg-amber-900/10 border border-amber-800/30 rounded-lg">
            <h4 className="font-medium text-amber-300 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Troubleshooting Steps
            </h4>
            
            <ol className="space-y-3 text-sm">
              <li className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 bg-amber-900/30 text-amber-300 rounded-full text-xs font-bold mr-3 flex-shrink-0">1</span>
                <div>
                  <span className="text-amber-200 font-medium">Get a CodeSandbox API Key</span>
                  <p className="text-amber-100/70 mt-1">
                    Visit{' '}
                    <a 
                      href="https://codesandbox.io/dashboard/settings/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-amber-300 hover:text-amber-200 underline inline-flex items-center"
                    >
                      CodeSandbox API Keys <ExternalLink className="w-3 h-3 ml-1" />
                    </a>{' '}
                    and create a new API key.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 bg-amber-900/30 text-amber-300 rounded-full text-xs font-bold mr-3 flex-shrink-0">2</span>
                <div>
                  <span className="text-amber-200 font-medium">Update Environment Variables</span>
                  <p className="text-amber-100/70 mt-1">
                    Add <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-xs">CSB_API_KEY=csb_v1_your_key_here</code> to your <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-xs">.env</code> file.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 bg-amber-900/30 text-amber-300 rounded-full text-xs font-bold mr-3 flex-shrink-0">3</span>
                <div>
                  <span className="text-amber-200 font-medium">Restart the Server</span>
                  <p className="text-amber-100/70 mt-1">
                    Restart your development server or redeploy on Vercel for the changes to take effect.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 bg-amber-900/30 text-amber-300 rounded-full text-xs font-bold mr-3 flex-shrink-0">4</span>
                <div>
                  <span className="text-amber-200 font-medium">Verify Configuration</span>
                  <p className="text-amber-100/70 mt-1">
                    Click the Refresh button above to verify your configuration is now working.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
};