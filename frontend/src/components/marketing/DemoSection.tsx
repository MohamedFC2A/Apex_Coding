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
      <div className="relative p-8 rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="text-xl font-bold tracking-tight text-white mb-6 silver-text">{t('demo.title')}</div>
        <div className="mt-4">
          <div className="aspect-video rounded-2xl border border-white/5 bg-[#050505] p-6 sm:p-8 relative overflow-hidden group/inner">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover/inner:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="flex h-full flex-col items-center justify-center gap-6 relative z-10">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="h-20 w-20 rounded-full border border-white/20 bg-white/5 flex items-center justify-center"
              >
                <div className="h-10 w-10 rounded-full bg-white/10 blur-sm" />
              </motion.div>
              <div className="text-center">
                <div className="text-lg font-medium text-white/60">{t('demo.subtitle')}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/30">{t('demo.status')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
