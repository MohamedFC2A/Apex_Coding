'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Mail, ArrowRight, CheckCircle2, Zap, Shield, Star } from 'lucide-react';

const PERKS = [
  { icon: Zap, text: 'Early access to new features' },
  { icon: Shield, text: 'Zero spam, ever' },
  { icon: Star, text: 'Exclusive tips & tutorials' },
];

export function LeadCapture() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl overflow-hidden"
      aria-label="Newsletter"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a20] via-[#080816] to-[#04040d]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(59,130,246,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(139,92,246,0.12),transparent_50%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
      <div className="absolute inset-0 border border-white/8 rounded-3xl pointer-events-none" />

      <div className="relative z-10 px-8 py-14 md:px-16 md:py-16">
        <div className="flex flex-col md:flex-row gap-12 items-center">

          {/* Left: copy */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold uppercase tracking-widest text-blue-300 mb-5">
              <Mail className="w-3 h-3" />
              Newsletter
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              {t('lead.title') || 'Join the Future of Coding'}
            </h2>
            <p className="text-base text-white/48 leading-relaxed font-light mb-8 max-w-md">
              {t('lead.subtitle') || 'Get exclusive early access to new features, AI tips, and developer resources — straight to your inbox.'}
            </p>
            <ul className="flex flex-col gap-3">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/55">
                  <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: form */}
          <div className="w-full max-w-md flex-shrink-0">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 p-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 text-center"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <div className="text-xl font-bold text-white">You&apos;re in!</div>
                <div className="text-sm text-white/50">
                  {t('lead.success') || "Thanks for subscribing. We'll be in touch soon."}
                </div>
              </motion.div>
            ) : (
              <form
                className="flex flex-col gap-3 p-7 rounded-2xl border border-white/8 bg-white/2 backdrop-blur-sm"
                onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
              >
                <div className="text-sm font-semibold text-white/80 mb-1">
                  Start with a free account →
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <input
                    id="cta-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('lead.email.placeholder') || 'you@company.com'}
                    className="w-full h-13 rounded-xl border border-white/10 bg-black/50 pl-11 pr-4 text-sm text-white placeholder:text-white/28 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    inputMode="email"
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  className="group h-12 px-6 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative">{t('lead.cta') || 'Subscribe Now'}</span>
                  <ArrowRight className="w-4 h-4 relative group-hover:translate-x-0.5 transition-transform" />
                </button>
                <p className="text-xs text-center text-white/28">
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
