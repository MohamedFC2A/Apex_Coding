import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface PlanProgressBarProps {
  completedTasks: number;
  totalTasks: number;
  currentTaskId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PlanProgressBar: React.FC<PlanProgressBarProps> = ({
  completedTasks,
  totalTasks,
  currentTaskId,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const percentage = useMemo(() => {
    return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  }, [completedTasks, totalTasks]);

  const statusColor = useMemo(() => {
    if (percentage === 100) return 'from-green-400 to-emerald-500';
    if (percentage >= 75) return 'from-cyan-400 to-blue-500';
    if (percentage >= 50) return 'from-cyan-300 to-cyan-500';
    return 'from-gray-300 to-gray-400';
  }, [percentage]);

  return (
    <div className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Progress info */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-200">
                {completedTasks}/{totalTasks} tasks
              </div>
              <div className="text-xs text-slate-400">
                {percentage}% complete
              </div>
            </div>
          </div>

          {/* Center: Progress bar */}
          <div className="flex-1 min-w-0">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${statusColor} transition-all duration-300 ease-out rounded-full`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Right side: Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
            aria-label={isCollapsed ? 'Expand plan' : 'Collapse plan'}
            title={isCollapsed ? 'Expand plan' : 'Collapse plan'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
