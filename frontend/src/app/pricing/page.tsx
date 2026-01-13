'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

export default function PricingPage() {
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const { tier, applyPromoCode } = useSubscriptionStore();
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState(false);

  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess(false);
    
    if (applyPromoCode(promoInput)) {
      setPromoSuccess(true);
      setTimeout(() => {
        router.push('/app');
      }, 1500);
    } else {
      setPromoError('Invalid promo code');
    }
  };

  const tiers = [
    {
      id: 'free',
      name: t('pricing.free.name'),
      price: '$0',
      period: '/month',
      description: t('pricing.free.desc'),
      features: [
        '10 AI Requests per day',
        'Graph-Based Understanding',
        'Basic Code Generation',
        'Web Preview',
        'Community Support'
      ],
      cta: t('pricing.cta.free'),
      current: tier === 'FREE',
      popular: false
    },
    {
      id: 'pro',
      name: t('pricing.pro.name'),
      price: '$10',
      period: '/month',
      description: t('pricing.pro.desc'),
      features: [
        '100 AI Requests per day',
        'Priority AI Processing',
        'Advanced Code Generation',
        'Real-time Collaboration',
        'Priority Support',
        'Export Projects',
        'Custom Templates'
      ],
      cta: t('pricing.cta.pro'),
      current: tier === 'PRO',
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="page-container py-4">
          <div
            className={`flex flex-col gap-4 sm:items-center sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
          >
            <Link href="/" className="inline-flex items-center gap-3 group">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black shadow-lg transition-transform group-hover:scale-105">
                <span className="h-5 w-5 rounded-full bg-gradient-to-br from-white via-gray-400 to-white shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
              </span>
              <span className="text-sm font-bold tracking-widest text-white uppercase">{t('brand.name')}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
              <Link
                href="/app"
                className="btn-silver px-6 py-2 text-sm"
              >
                {t('pricing.openIde')}
                {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 page-container py-16 sm:py-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold mb-4">
            <span className="gold-text">
              {t('pricing.title')}
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto mb-16">
          {tiers.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className={`relative p-8 rounded-3xl border transition-all duration-300 group hover:translate-y-[-4px] ${
                plan.popular
                  ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent shadow-[0_0_40px_rgba(245,158,11,0.1)]'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-1 text-xs font-bold text-black shadow-lg">
                    <Sparkles className="h-3 w-3" />
                    {t('pricing.popular')}
                  </span>
                </div>
              )}

              {plan.current && (
                <div className="absolute -top-4 right-8">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/80 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
                    <Check className="h-3 w-3" />
                    {t('pricing.current')}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'gold-text' : 'silver-text'}`}>{plan.name}</h3>
                <p className="text-sm text-white/50 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-white/40">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-amber-400' : 'text-white/40'}`} />
                    <span className="text-sm text-white/70">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/app"
                className={`w-full ${plan.popular ? 'btn-gold' : 'btn-silver'}`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Promo Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="h-6 w-6 text-amber-400" />
              <h3 className="text-xl font-bold">{t('pricing.promo.title')}</h3>
            </div>
            <form onSubmit={handlePromoSubmit} className="flex gap-3">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder={t('pricing.promo.placeholder')}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                type="submit"
                className="btn-gold px-8"
              >
                {t('pricing.promo.apply')}
              </button>
            </form>
            {promoError && (
              <p className="mt-3 text-red-400 text-sm flex items-center gap-2">
                {t('pricing.promo.error')}
              </p>
            )}
            {promoSuccess && (
              <p className="mt-3 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t('pricing.promo.success')}
              </p>
            )}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-20 text-center"
        >
          <h3 className="text-2xl font-bold mb-8">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-start">
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">What happens when I reach my daily limit?</h4>
              <p className="text-sm text-white/60">
                Your limit resets daily at midnight UTC. You can upgrade to PRO for 10x more requests.
              </p>
            </div>
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
              <p className="text-sm text-white/60">
                Yes! There are no contracts. Switch between plans or cancel anytime.
              </p>
            </div>
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">What&apos;s included in Priority Support?</h4>
              <p className="text-sm text-white/60">
                PRO users get 24-hour email response time and access to our dedicated support channel.
              </p>
            </div>
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">Is my code private?</h4>
              <p className="text-sm text-white/60">
                Absolutely. All projects are private and never used to train AI models.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
