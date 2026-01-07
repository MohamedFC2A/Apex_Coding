'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export function LeadCapture() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
      aria-label="Lead capture"
    >
      <div className="text-sm font-semibold tracking-wide text-white/90">{t('lead.title')}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/65">
        {t('lead.subtitle')}
      </div>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
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
          className="h-11 w-full flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 backdrop-blur-md outline-none focus:ring-2 focus:ring-cyan-400/30"
          inputMode="email"
          autoComplete="email"
        />
        <button
          type="submit"
          className="h-11 rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
        >
          {t('lead.cta')}
        </button>
      </form>

      {submitted && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-sm text-white/70"
        >
          {t('lead.success')}
        </motion.div>
      )}
    </motion.section>
  );
}
