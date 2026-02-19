'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Layers, Zap, Clock, ArrowRight } from 'lucide-react';

const ITEMS = [
  {
    key: 'context',
    icon: Layers,
    titleFallback: 'Full Project Context',
    bodyFallback: 'Most AI tools only see the file you have open. Apex Logic reads your entire project graph — imports, types, structure — to write code that actually fits.',
    highlight: 'Understands your whole codebase',
    colorClass: 'from-blue-500/25 to-transparent',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/12 border-blue-500/20',
    side: 'left',
  },
  {
    key: 'streaming',
    icon: Zap,
    titleFallback: 'Instant Live Streaming',
    bodyFallback: 'No waiting for a full answer. See every file materialize in real-time as the AI writes it. Your preview updates live as code flows in.',
    highlight: 'File-by-file generation, live',
    colorClass: 'from-cyan-500/25 to-transparent',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/12 border-cyan-500/20',
    side: 'right',
  },
  {
    key: 'history',
    icon: Clock,
    titleFallback: 'Deep Session Memory',
    bodyFallback: 'Every session is automatically persisted with full file snapshots and context history. Pick up exactly where you left off — even after closing the browser.',
    highlight: 'Never lose work again',
    colorClass: 'from-purple-500/25 to-transparent',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/12 border-purple-500/20',
    side: 'left',
  },
];

export function ValueProp() {
  const { t } = useLanguage();

  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.14 } }
      }}
      className="flex flex-col gap-24"
      aria-label="Value proposition"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isRight = item.side === 'right';
        return (
          <motion.div
            key={item.key}
            variants={{
              hidden: { opacity: 0, y: 32, filter: 'blur(10px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)' }
            }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col ${isRight ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center`}
          >
            {/* Visual block */}
            <div className="w-full md:w-1/2 flex-shrink-0">
              <div className={`relative rounded-3xl border border-white/7 bg-gradient-to-br ${item.colorClass} bg-[#050510] overflow-hidden aspect-[4/3] flex items-center justify-center`}>
                <div className="absolute inset-0 bg-[#050510]/60" />
                {/* Animated icon glow */}
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className={`w-20 h-20 rounded-2xl border flex items-center justify-center ${item.iconBg}`}
                  >
                    <Icon className={`w-9 h-9 ${item.iconColor}`} />
                  </motion.div>
                  <div className={`text-xs uppercase tracking-[0.18em] font-bold ${item.iconColor} opacity-70`}>
                    {item.highlight}
                  </div>
                </div>
                {/* Corner accent */}
                <div className={`absolute top-0 ${isRight ? 'left-0' : 'right-0'} w-32 h-32 bg-gradient-radial ${item.colorClass} blur-3xl opacity-40`} />
              </div>
            </div>

            {/* Text block */}
            <div className="w-full md:w-1/2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/8 bg-white/3 text-xs font-semibold uppercase tracking-widest ${item.iconColor} mb-5`}>
                <Icon className="w-3 h-3" />
                {item.highlight}
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-4">
                {t(`value.${item.key}.title`) || item.titleFallback}
              </h3>
              <p className="text-base leading-relaxed text-white/50 font-light mb-6">
                {t(`value.${item.key}.body`) || item.bodyFallback}
              </p>
              <a
                href="/app"
                className={`inline-flex items-center gap-2 text-sm font-semibold ${item.iconColor} hover:gap-3 transition-all duration-200`}
              >
                Try it now <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
