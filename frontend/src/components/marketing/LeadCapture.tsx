'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export function LeadCapture() {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative p-10 rounded-3xl border border-white/20 bg-black/60 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
      aria-label="Lead capture"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.05),transparent_70%)] pointer-events-none" />
      
      <div className="relative z-10">
        <div className="text-2xl font-bold tracking-tight gold-text">{t('lead.title')}</div>
        <div className="mt-3 text-base leading-relaxed text-white/70 font-light max-w-xl">
          {t('lead.subtitle')}
        </div>

        <form
          className={`mt-8 flex flex-col gap-4 ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <label className="sr-only" htmlFor="email">
            {t('lead.email.label')}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('lead.email.placeholder')}
            className="flex-1 h-14 rounded-xl border border-white/20 bg-white/5 px-6 text-base text-white placeholder:text-white/30 outline-none focus:border-gold-primary/50 focus:bg-white/10 transition-all"
            inputMode="email"
            autoComplete="email"
          />
          <button
            type="submit"
            className="btn-gold h-14 px-10 text-base"
          >
            {t('lead.cta')}
          </button>
        </form>

        {submitted && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-sm text-gold-shiny flex items-center gap-2 font-medium"
          >
            <span className="h-2 w-2 rounded-full bg-gold-primary animate-pulse" />
            {t('lead.success')}
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
