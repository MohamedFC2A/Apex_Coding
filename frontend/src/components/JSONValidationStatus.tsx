import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface JSONValidationStatusProps {
  valid: boolean;
  notes?: string;
}

export const JSONValidationStatus: React.FC<JSONValidationStatusProps> = ({ valid, notes }) => {
  return (
    <div className={`glass-panel p-3 rounded-lg border ${
      valid ? 'border-green-500/30' : 'border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {valid ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-400" />
        )}
        <span className={`text-xs font-semibold ${
          valid ? 'text-green-400' : 'text-red-400'
        }`}>
          JSON Validation {valid ? 'Passed' : 'Failed'}
        </span>
      </div>
      {notes && (
        <p className="text-xs text-white/60">{notes}</p>
      )}
    </div>
  );
};
