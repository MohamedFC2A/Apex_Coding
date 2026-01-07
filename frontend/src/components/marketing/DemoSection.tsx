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
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 via-fuchsia-500/20 to-cyan-400/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
      <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="text-sm font-semibold tracking-wide text-white/85">{t('demo.title')}</div>
        <div className="mt-4">
          <div className="aspect-video rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30"
              />
              <div className="text-center">
                <div className="text-sm font-medium text-white/70">{t('demo.subtitle')}</div>
                <div className="mt-2 text-xs text-white/50">Coming soon: Interactive walkthrough</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
