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
          className="relative group p-6 rounded-2xl border border-white/5 bg-black/40 transition-all hover:border-white/20"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl" />
          <div className="relative z-10">
            <div className="text-lg font-bold tracking-tight text-white mb-3 silver-text">{item.title}</div>
            <div className="text-sm leading-relaxed text-white/40 font-light">{item.body}</div>
          </div>
        </motion.div>
      ))}
    </motion.section>
  );
}
