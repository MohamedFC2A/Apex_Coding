'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronRight, CheckCircle2, Circle, Sparkles, X, ListTodo } from 'lucide-react';

interface PlanStep {
  id: string;
  label: string;
  completed: boolean;
}

const demoSteps: PlanStep[] = [
  { id: '1', label: 'Graph Analysis', completed: true },
  { id: '2', label: 'Component Generation', completed: true },
  { id: '3', label: 'Styling & Layout', completed: false },
  { id: '4', label: 'Testing & Deploy', completed: false }
];

export function FloatingPlan() {
  const [isExpanded, setIsExpanded] = useState(false);

  // In a real app, these would come from your state management (e.g. Zustand)
  const steps = demoSteps; 
  const progress = Math.round((steps.filter(s => s.completed).length / steps.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-80 rounded-2xl border border-white/10 bg-[#0F172A]/95 p-0 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <ListTodo className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Mission Plan</h3>
                  <p className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
                    {steps.length} Steps
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    group flex items-start gap-3 rounded-xl border p-3 transition-all
                    ${step.completed 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }
                  `}
                >
                  <div className={`mt-0.5 ${step.completed ? 'text-emerald-400' : 'text-white/20 group-hover:text-white/40'}`}>
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${step.completed ? 'text-white/60 line-through' : 'text-white/90'}`}>
                      {step.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Footer / Progress */}
            <div className="p-4 bg-black/20 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-white/50 font-medium">Progress</span>
                <span className="text-cyan-400 font-bold">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex items-center gap-3 pr-5 pl-1.5 py-1.5 rounded-full bg-[#0F172A] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-cyan-500/30 transition-colors"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Circular Progress Indicator */}
            <div className="relative h-9 w-9 grid place-items-center">
               <svg className="absolute inset-0 h-full w-full -rotate-90 text-white/10" viewBox="0 0 36 36">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  <path 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke="url(#gradient)" 
                    strokeWidth="4" 
                    strokeDasharray={`${progress}, 100`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
               </svg>
               <span className="text-[10px] font-bold text-white">{progress}%</span>
            </div>

            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-white/90 group-hover:text-white transition-colors">Mission Plan</span>
              <span className="text-[10px] text-white/50">{steps.length} Steps</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
