'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, Zap, Clock } from 'lucide-react';

export function ValueProp() {
  const { t } = useLanguage();
  
  const items = [
    {
      key: 'context',
      icon: Layers,
      title: t('value.context.title') || "Context-Aware",
      body: t('value.context.body') || "The IDE understands your entire project structure, not just the current file."
    },
    {
      key: 'streaming',
      icon: Zap,
      title: t('value.streaming.title') || "Instant Streaming",
      body: t('value.streaming.body') || "See code generation in real-time with zero latency."
    },
    {
      key: 'persistence',
      icon: Clock,
      title: t('value.persistence.title') || "Auto-Save & History",
      body: t('value.persistence.body') || "Travel back in time through your coding session with granular history."
    }
  ];
  
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
      className="grid gap-6 md:grid-cols-3"
      aria-label="Value proposition"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.key}
            variants={{
              hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)' }
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`relative group p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/10 hover:shadow-xl hover:-translate-y-1`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl" />
            
            <div className="relative z-10">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${index === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/70 group-hover:bg-white/20 group-hover:text-white'}`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className={`text-xl font-bold tracking-tight mb-3 ${item.key === 'context' ? 'text-amber-400' : 'text-white'}`}>
                {item.title}
              </div>
              
              <div className="text-sm leading-relaxed text-white/50 font-light group-hover:text-white/70 transition-colors">
                {item.body}
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
