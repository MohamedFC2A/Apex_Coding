import React, { useEffect, useRef } from 'react';
import { GlassCard } from './GlassCard';
import { usePreviewStore } from '@/stores/previewStore';
import { Terminal, Trash2 } from 'lucide-react';
import { LogEntry } from '@/types';

export const LogsPanel: React.FC = () => {
  const { logs, clearLogs } = usePreviewStore();
  const [filter, setFilter] = React.useState<'all' | 'error' | 'warning' | 'info'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      default:
        return 'text-white/70';
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'success':
        return '✓';
      default:
        return '→';
    }
  };

  return (
    <GlassCard className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-white/10 glass-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-white/70" />
          <h3 className="text-sm font-semibold">Console</h3>
          <span className="text-xs text-gray-400">({logs.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="glass-input px-2 py-1 text-xs rounded"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warnings</option>
            <option value="error">Errors</option>
          </select>
          
          <button
            onClick={clearLogs}
            className="glass-button px-2 py-1 rounded flex items-center gap-1 text-xs"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 font-mono text-xs bg-black/20">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Run your code to see output here.
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`flex gap-2 py-1 ${getLogColor(log.type)}`}
            >
              <span className="opacity-70">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span>{getLogIcon(log.type)}</span>
              <span className="flex-1 break-all">{log.message}</span>
              {log.source && (
                <span className="text-gray-500 text-xs">({log.source})</span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </GlassCard>
  );
};
