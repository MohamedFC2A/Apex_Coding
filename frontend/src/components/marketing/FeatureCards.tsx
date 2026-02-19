'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { GitBranch, Database, MessageSquare, Brain, Shield, Gauge } from 'lucide-react';

const CARDS = [
  {
    key: 'graph',
    icon: GitBranch,
    number: '01',
    titleKey: 'feature.graph.title',
    titleFallback: 'Graph-Based Logic',
    bodyFallback: 'Visualize your entire codebase as a living graph. The AI navigates relationships, not just lines.',
    accent: 'from-blue-500/20 to-blue-600/5',
    iconBg: 'bg-blue-500/15 border-blue-500/20 text-blue-300',
    glow: 'group-hover:shadow-blue-500/10',
  },
  {
    key: 'persistence',
    icon: Database,
    number: '02',
    titleKey: 'feature.persistence.title',
    titleFallback: 'Smart Persistence',
    bodyFallback: 'Every keystroke and decision is saved. Resume any session exactly where you left off.',
    accent: 'from-purple-500/20 to-purple-600/5',
    iconBg: 'bg-purple-500/15 border-purple-500/20 text-purple-300',
    glow: 'group-hover:shadow-purple-500/10',
  },
  {
    key: 'feedback',
    icon: MessageSquare,
    number: '03',
    titleKey: 'feature.feedback.title',
    titleFallback: 'AI Pair Programming',
    bodyFallback: 'Real-time suggestions, refactors, and code reviews baked directly into your flow.',
    accent: 'from-cyan-500/20 to-cyan-600/5',
    iconBg: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300',
    glow: 'group-hover:shadow-cyan-500/10',
  },
  {
    key: 'context',
    icon: Brain,
    number: '04',
    titleKey: 'feature.context.title',
    titleFallback: 'Full Context Window',
    bodyFallback: 'The AI sees your entire project — imports, deps, file tree — not just the open tab.',
    accent: 'from-emerald-500/20 to-emerald-600/5',
    iconBg: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300',
    glow: 'group-hover:shadow-emerald-500/10',
  },
  {
    key: 'policy',
    icon: Shield,
    number: '05',
    titleKey: 'feature.policy.title',
    titleFallback: 'Policy-Guarded Edits',
    bodyFallback: 'Every AI write is validated against strict rules. No runaway rewrites, ever.',
    accent: 'from-amber-500/20 to-amber-600/5',
    iconBg: 'bg-amber-500/15 border-amber-500/20 text-amber-300',
    glow: 'group-hover:shadow-amber-500/10',
  },
  {
    key: 'speed',
    icon: Gauge,
    number: '06',
    titleKey: 'feature.speed.title',
    titleFallback: 'Real-Time Streaming',
    bodyFallback: 'Watch files appear file-by-file as the AI writes them. Zero wait for full responses.',
    accent: 'from-rose-500/20 to-rose-600/5',
    iconBg: 'bg-rose-500/15 border-rose-500/20 text-rose-300',
    glow: 'group-hover:shadow-rose-500/10',
  },
];

export function FeatureCards() {
  const { t } = useLanguage();

  return (
    <div className="relative">
      {/* Section heading */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/8 bg-white/3 text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
          Core Features
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
          Everything you need,<br />nothing you don&apos;t.
        </h2>
        <p className="mt-5 text-base text-white/40 font-light max-w-xl mx-auto leading-relaxed">
          A full IDE experience designed around AI-first development — fast, safe, and context-complete.
        </p>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.08 } }
        }}
        className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
      >
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              variants={{
                hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
                show: { opacity: 1, y: 0, filter: 'blur(0px)' }
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`group relative p-7 rounded-2xl border border-white/7 bg-white/2 backdrop-blur-sm hover:border-white/12 hover:-translate-y-1 hover:shadow-2xl ${card.glow} transition-all duration-300 overflow-hidden`}
            >
              {/* Subtle gradient overlay on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

              <div className="relative z-10 flex flex-col h-full">
                {/* Number + Icon row */}
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-white/15 tabular-nums">
                    {card.number}
                  </span>
                </div>

                <h3 className="text-lg font-bold tracking-tight text-white mb-2.5 group-hover:text-white transition-colors">
                  {t(card.titleKey) || card.titleFallback}
                </h3>

                <p className="text-sm leading-relaxed text-white/45 font-light group-hover:text-white/62 transition-colors">
                  {card.bodyFallback}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
