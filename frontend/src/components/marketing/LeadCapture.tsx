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
      className="relative p-8 rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl"
      aria-label="Lead capture"
    >
      <div className="text-xl font-bold tracking-tight text-white silver-text">{t('lead.title')}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/40 font-light">
        {t('lead.subtitle')}
      </div>

      <form
        className={`mt-6 flex flex-col gap-3 ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('lead.email.placeholder')}
          className="flex-1 h-12 rounded-xl border border-white/10 bg-black px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30 transition-all"
          inputMode="email"
          autoComplete="email"
        />
        <button
          type="submit"
          className="btn-silver h-12 px-8"
        >
          {t('lead.cta')}
        </button>
      </form>

      {submitted && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-sm text-white/60 flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {t('lead.success')}
        </motion.div>
      )}
    </motion.section>
  );
}
