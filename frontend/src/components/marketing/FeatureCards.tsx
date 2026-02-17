'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { GitBranch, Database, MessageSquare } from 'lucide-react';

export function FeatureCards() {
  const { t } = useLanguage();
  
  const cards = [
    {
      key: 'graph',
      icon: GitBranch,
      title: t('feature.graph.title') || "Graph-Based Logic",
      body: t('feature.graph.body') || "Visualize your code flow with our proprietary node graph engine."
    },
    {
      key: 'persistence',
      icon: Database,
      title: t('feature.persistence.title') || "Smart Persistence",
      body: t('feature.persistence.body') || "Never lose a thought. State is persisted automatically across sessions."
    },
    {
      key: 'feedback',
      icon: MessageSquare,
      title: t('feature.feedback.title') || "AI Pair Programming",
      body: t('feature.feedback.body') || "Get real-time feedback and suggestions as you type."
    }
  ];
  
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
      className="grid gap-8 md:grid-cols-3 relative z-10"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            variants={{
              hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)' }
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="group relative p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-all duration-300">
                <Icon className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl font-bold tracking-tight mb-3 text-white group-hover:text-blue-200 transition-colors">
                {card.title}
              </h3>
              
              <p className="text-base leading-relaxed text-white/50 font-light group-hover:text-white/70 transition-colors">
                {card.body}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
