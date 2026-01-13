import React, { useEffect, useRef } from 'react';
import { GlassCard } from './GlassCard';
import { usePreviewStore } from '@/stores/previewStore';
import { Terminal, Trash2 } from 'lucide-react';
import { LogEntry } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

export const LogsPanel: React.FC = () => {
  const { t, isRTL } = useLanguage();
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
        return 'text-amber-400';
      case 'success':
        return 'text-emerald-400';
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
    <GlassCard className={`h-full flex flex-col overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className={`p-3 border-b border-white/10 glass-panel flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Terminal className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-white/90">{t('app.logs.title')}</h3>
          <span className="text-xs text-amber-500/50">({logs.length})</span>
        </div>
        
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="glass-input px-2 py-1 text-xs rounded border border-white/10 bg-black/40 text-white/70"
          >
            <option value="all">{t('app.logs.filter.all')}</option>
            <option value="info">{t('app.logs.filter.info')}</option>
            <option value="warning">{t('app.logs.filter.warning')}</option>
            <option value="error">{t('app.logs.filter.error')}</option>
          </select>
          
          <button
            onClick={clearLogs}
            className="glass-button p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title={t('app.logs.clear')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto scrollbar-thin p-3 font-mono text-xs bg-black/20 ${isRTL ? 'text-right' : 'text-left'}`}>
        {filteredLogs.length === 0 ? (
          <div className="text-white/20 text-center py-12 flex flex-col items-center gap-3">
            <Terminal className="w-10 h-10 opacity-10" />
            <p className="max-w-[180px] text-xs">
              {t('app.logs.empty')}
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`flex gap-2 py-1.5 border-b border-white/5 last:border-0 ${getLogColor(log.type)} ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <span className="opacity-40 text-[10px] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="shrink-0 font-bold">{getLogIcon(log.type)}</span>
              <span className="flex-1 break-all leading-relaxed">{log.message}</span>
              {log.source && (
                <span className="text-white/20 text-[10px] shrink-0">({log.source})</span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </GlassCard>
  );
};
