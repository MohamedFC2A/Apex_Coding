'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export function DemoSection() {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative group"
    >
      <div className="absolute -inset-1 bg-white/5 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
      <div className="relative p-10 rounded-[32px] border border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="text-2xl font-bold tracking-tight gold-text mb-2">{t('demo.title')}</div>
            <div className="text-white/50 font-light">{t('demo.subtitle')}</div>
          </div>
          <a href="/demo" className="btn-gold px-8 py-3 text-sm self-start md:self-center">
            {t('hero.cta.demo')}
          </a>
        </div>
        
        <div className="mt-4">
          <div className="aspect-video rounded-3xl border border-white/5 bg-white/5 p-6 sm:p-8 relative overflow-hidden group/inner">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-amber-500/5 to-white/0 opacity-0 group-hover/inner:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="flex h-full flex-col items-center justify-center gap-6 relative z-10">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="h-24 w-24 rounded-full border border-amber-500/20 bg-amber-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.1)]"
              >
                <div className="h-12 w-12 rounded-full bg-amber-400/20 blur-md" />
              </motion.div>
              <div className="text-center">
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">{t('demo.status')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
