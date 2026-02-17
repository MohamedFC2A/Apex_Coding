'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronRight, CheckCircle2, Circle, Sparkles, X, ListTodo } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';



import { useAIStore } from '@/stores/aiStore';

export function FloatingPlan() {
  const { t, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = useAIStore((state) => state.planSteps) || [];
  const progress = steps.length > 0 
    ? Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100) 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 flex flex-col items-end gap-3`}
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
            <div 
              className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <div 
                className="flex items-center gap-2.5"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ListTodo className="h-4 w-4 text-amber-500" />
                </div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <h3 className="text-sm font-bold text-white tracking-wide">{t('app.plan.title')}</h3>
                  <p className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
                    {steps.length} {t('app.plan.steps')}
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: isRTL ? 5 : -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    group flex items-start gap-3 rounded-xl border p-3 transition-all
                    ${step.status === 'completed' 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }
                  `}
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <div className={`mt-0.5 ${step.status === 'completed' ? 'text-emerald-400' : 'text-white/20 group-hover:text-white/40'}`}>
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <p className={`text-sm font-medium leading-tight ${step.status === 'completed' ? 'text-white/60 line-through' : 'text-white/90'}`}>
                      {step.title}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Footer / Progress */}
            <div className="p-4 bg-black/20 border-t border-white/5">
              <div 
                className="flex items-center justify-between text-xs mb-2"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <span className="text-white/50 font-medium">{t('app.plan.progress')}</span>
                <span className="text-amber-500 font-bold">{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                  style={{ transformOrigin: isRTL ? 'right' : 'left' }}
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
            className="group relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0F172A]/80 border border-white/10 backdrop-blur-xl shadow-xl hover:border-amber-500/50 transition-all duration-300"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            {/* Hover Glow */}
            <div className="absolute inset-0 rounded-2xl bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <ListTodo className="h-4 w-4 text-amber-500" />
                </div>
                {/* Status Dot */}
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-[#0F172A] animate-pulse" />
              </div>
              <div className="flex flex-col items-start" style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <span className="text-xs font-bold text-white tracking-wide">{t('app.plan.active')}</span>
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-tighter">
                  {progress}% {t('app.plan.complete')}
                </span>
              </div>
            </div>
            
            <div className={`relative h-5 w-px bg-white/10 ${isRTL ? 'mr-1' : 'ml-1'}`} />
            
            <ChevronRight className={`relative h-4 w-4 text-white/20 group-hover:text-amber-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
