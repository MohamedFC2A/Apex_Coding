'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export function FeatureCards() {
  const { t } = useLanguage();
  
  const cards = [
    {
      key: 'graph',
      title: t('feature.graph.title'),
      body: t('feature.graph.body')
    },
    {
      key: 'persistence',
      title: t('feature.persistence.title'),
      body: t('feature.persistence.body')
    },
    {
      key: 'feedback',
      title: t('feature.feedback.title'),
      body: t('feature.feedback.body')
    }
  ];
  
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      className="grid gap-6 md:grid-cols-3"
    >
      {cards.map((card) => (
        <motion.div
          key={card.key}
          variants={{
            hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
            show: { opacity: 1, y: 0, filter: 'blur(0px)' }
          }}
          transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative group p-6 rounded-2xl border border-white/5 bg-[#050505] transition-all hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl" />
          <div className="relative z-10">
            <div className="text-lg font-bold tracking-tight text-white mb-3 silver-text">{card.title}</div>
            <div className="text-sm leading-relaxed text-white/40 font-light">{card.body}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
