'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="fixed bottom-8 right-8 z-50 hidden lg:block"
    >
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className="w-72 rounded-2xl border border-white/10 bg-[#0B0F14]/95 p-4 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white/90">AI Plan</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {demoSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-white/30 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${step.completed ? 'text-white/70 line-through' : 'text-white/90'}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Progress</span>
                <span className="text-white/70 font-medium">50%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '50%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/20 blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative flex items-center gap-2 rounded-full border border-white/10 bg-[#0B0F14]/95 px-4 py-3 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white/90">View Plan</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
