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
          whileHover={{ scale: 1.02, y: -4 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md hover:bg-white/8 transition-colors cursor-pointer"
        >
          <div className="text-sm font-semibold tracking-wide text-white/90">{card.title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/65">{card.body}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}

