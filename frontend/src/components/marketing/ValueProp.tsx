'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export function ValueProp() {
  const { t } = useLanguage();
  
  const items = [
    {
      key: 'context',
      title: t('value.context.title'),
      body: t('value.context.body')
    },
    {
      key: 'streaming',
      title: t('value.streaming.title'),
      body: t('value.streaming.body')
    },
    {
      key: 'persistence',
      title: t('value.persistence.title'),
      body: t('value.persistence.body')
    }
  ];
  
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      className="grid gap-4 md:grid-cols-3"
      aria-label="Value proposition"
    >
      {items.map((item) => (
        <motion.div
          key={item.key}
          variants={{
            hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
            show: { opacity: 1, y: 0, filter: 'blur(0px)' }
          }}
          transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass-card glass-card-hover"
        >
          <div className="text-sm font-semibold tracking-wide text-white/90">{item.title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/65">{item.body}</div>
        </motion.div>
      ))}
    </motion.section>
  );
}
