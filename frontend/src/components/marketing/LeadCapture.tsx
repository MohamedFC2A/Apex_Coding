'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Mail, ArrowRight } from 'lucide-react';

export function LeadCapture() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden max-w-5xl mx-auto"
      aria-label="Lead capture"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.05),transparent_50%)] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
        <div className="flex-1 text-center md:text-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-300 mb-4">
            <Mail className="w-3 h-3" />
            <span>Newsletter</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-3">
            {t('lead.title') || "Join the Future of Coding"}
          </h2>
          <p className="text-base leading-relaxed text-white/60 font-light max-w-md mx-auto md:mx-0">
            {t('lead.subtitle') || "Get exclusive access to early features and updates directly to your inbox."}
          </p>
        </div>

        <div className="w-full max-w-md">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="relative">
              <label className="sr-only" htmlFor="email">
                {t('lead.email.label')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('lead.email.placeholder') || "Enter your email"}
                className="w-full h-14 rounded-xl border border-white/10 bg-black/40 px-6 text-base text-white placeholder:text-white/30 outline-none focus:border-blue-500/50 focus:bg-black/60 transition-all focus:ring-1 focus:ring-blue-500/20"
                inputMode="email"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={submitted}
              className="group h-14 px-8 rounded-xl bg-white text-black font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>{submitted ? (t('lead.success') || "Subscribed!") : (t('lead.cta') || "Subscribe Now")}</span>
              {!submitted && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
          
          <p className="mt-4 text-xs text-center text-white/30">
            No spam. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
