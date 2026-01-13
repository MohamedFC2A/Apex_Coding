'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, ArrowLeft, ArrowRight, Crown, Shield, Rocket } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

export default function PlansPage() {
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

  const plans = [
    {
      id: 'starter',
      name: t('pricing.free.name'),
      icon: Sparkles,
      price: '$0',
      period: '/month',
      description: t('pricing.free.desc'),
      features: [
        '5 AI Requests per day',
        'Graph-Based Understanding',
        'Basic Code Generation',
        'Web Preview',
        'Community Support',
        'Single Project',
        '1 GB Storage'
      ],
      cta: t('pricing.cta.free'),
      current: tier === 'FREE',
      popular: false,
      color: 'silver'
    },
    {
      id: 'pro',
      name: t('pricing.pro.name'),
      icon: Crown,
      price: '$29',
      period: '/month',
      description: t('pricing.pro.desc'),
      features: [
        '100 AI Requests per day',
        'Priority AI Processing',
        'Advanced Code Generation',
        'Real-time Collaboration',
        'Priority Support',
        'Unlimited Projects',
        '50 GB Storage',
        'Export Projects',
        'Custom Templates',
        'Advanced Analytics'
      ],
      cta: t('pricing.cta.pro'),
      current: tier === 'PRO',
      popular: true,
      color: 'gold'
    },
    {
      id: 'enterprise',
      name: t('pricing.enterprise.name'),
      icon: Shield,
      price: 'Custom',
      period: '',
      description: t('pricing.enterprise.desc'),
      features: [
        'Unlimited AI Requests',
        'Custom AI Models',
        'Dedicated Support',
        'SSO Integration',
        'Team Collaboration',
        'Unlimited Projects',
        'Unlimited Storage',
        'On-Premise Deployment',
        'Custom Integrations',
        'SLA Guarantee',
        'Training & Onboarding'
      ],
      cta: t('pricing.cta.enterprise'),
      current: false,
      popular: false,
      color: 'white'
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 mb-6"
          >
            <Rocket className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white/80 uppercase tracking-widest">Choose Your Path</span>
          </motion.div>
          
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            <span className="gold-text">
              {t('pricing.title')}
            </span>
          </h1>
          <p className="text-base sm:text-xl text-white/60 max-w-3xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid gap-6 lg:grid-cols-3 max-w-7xl mx-auto mb-20">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className={`relative p-8 rounded-3xl border transition-all duration-300 group hover:translate-y-[-4px] ${
                  plan.popular
                    ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent shadow-[0_0_80px_rgba(245,158,11,0.1)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-1 text-xs font-bold text-black shadow-lg">
                      <Zap className="h-3 w-3" />
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

                <div className="mb-8">
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform group-hover:scale-110 ${plan.color === 'gold' ? 'text-amber-400' : 'text-white'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className={`text-2xl font-bold mb-2 ${plan.color === 'gold' ? 'gold-text' : 'silver-text'}`}>{plan.name}</h3>
                  <p className="text-sm text-white/50 mb-6 min-h-[40px]">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-white/40 font-medium">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${plan.color === 'gold' ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/20 bg-white/5'}`}>
                        <Check className={`h-3 w-3 ${plan.color === 'gold' ? 'text-amber-400' : 'text-white'}`} />
                      </div>
                      <span className="text-sm text-white/70 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/app"
                  className={`w-full ${plan.color === 'gold' ? 'btn-gold' : 'btn-silver'}`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Promo Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-3xl mx-auto"
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="grid gap-6">
            {[
              {
                q: 'Can I upgrade or downgrade my plan?',
                a: 'Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades take effect at the end of your billing cycle.'
              },
              {
                q: 'What happens when I reach my AI request limit?',
                a: 'You\'ll receive a notification when approaching your limit. Free users can upgrade to PRO for more requests, or wait for the daily reset at midnight UTC.'
              },
              {
                q: 'Do you offer refunds?',
                a: 'Yes, we offer a 14-day money-back guarantee on all paid plans. No questions asked.'
              },
              {
                q: 'How does the promo code work?',
                a: 'Enter your promo code in the field above. Valid codes unlock PRO features instantly. Contact support if you have issues applying a code.'
              }
            ].map((faq, i) => (
              <div key={i} className="glass-card glass-card-hover p-6 text-start">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-white/70">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
