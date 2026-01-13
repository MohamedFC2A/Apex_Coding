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
      name: 'STARTER',
      icon: Sparkles,
      price: '$0',
      period: '/month',
      description: 'Perfect for trying out Nexus Apex',
      features: [
        '5 AI Requests per day',
        'Graph-Based Understanding',
        'Basic Code Generation',
        'Web Preview',
        'Community Support',
        'Single Project',
        '1 GB Storage'
      ],
      cta: 'Start Free',
      current: tier === 'FREE',
      popular: false,
      color: 'cyan'
    },
    {
      id: 'pro',
      name: 'PRO',
      icon: Crown,
      price: '$29',
      period: '/month',
      description: 'For serious developers building at scale',
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
      cta: 'Upgrade to Pro',
      current: tier === 'PRO',
      popular: true,
      color: 'purple'
    },
    {
      id: 'enterprise',
      name: 'ENTERPRISE',
      icon: Shield,
      price: 'Custom',
      period: '',
      description: 'For teams and organizations',
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
      cta: 'Contact Sales',
      current: false,
      popular: false,
      color: 'gold'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_20%,rgba(34,211,238,0.15),transparent_60%),radial-gradient(1000px_600px_at_50%_80%,rgba(168,85,247,0.15),transparent_60%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10">
        <div className="page-container py-4">
          <div
            className={`flex flex-col gap-4 sm:items-center sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
          >
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                <span className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300/90 via-fuchsia-300/90 to-cyan-300/90" />
              </span>
              <span className="text-sm font-semibold tracking-wide text-white/85">{t('brand.name')}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
              <Link
                href="/app"
                className="btn-outline px-4 py-2 text-sm"
              >
                Open IDE
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
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 mb-6"
          >
            <Rocket className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-300">Choose Your Path</span>
          </motion.div>
          
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
              Plans & Pricing
            </span>
          </h1>
          <p className="text-base sm:text-xl text-white/70 max-w-3xl mx-auto">
            Start building with our graph-based AI IDE. Scale as you grow with advanced features and unlimited possibilities.
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
                className={`relative glass-surface p-8 ${
                  plan.popular
                    ? 'border-purple-400/40 bg-gradient-to-b from-purple-400/15 to-fuchsia-500/15 shadow-[0_0_80px_rgba(168,85,247,0.3)]'
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500 px-4 py-1 text-xs font-bold text-white shadow-lg">
                      <Zap className="h-3 w-3" />
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {plan.current && (
                  <div className="absolute -top-4 right-8">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
                      <Check className="h-3 w-3" />
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${
                      plan.color === 'cyan' ? 'from-cyan-400/20 to-cyan-500/20' :
                      plan.color === 'purple' ? 'from-purple-400/20 to-fuchsia-500/20' :
                      'from-yellow-400/20 to-orange-500/20'
                    }`}>
                      <Icon className={`h-6 w-6 ${
                        plan.color === 'cyan' ? 'text-cyan-400' :
                        plan.color === 'purple' ? 'text-purple-400' :
                        'text-yellow-400'
                      }`} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-white/60 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-white/60">{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        plan.color === 'cyan' ? 'text-cyan-400' :
                        plan.color === 'purple' ? 'text-purple-400' :
                        'text-yellow-400'
                      }`} />
                      <span className="text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.id === 'enterprise' ? '#contact' : '/app'}
                  className={`${plan.popular ? 'btn-primary' : 'btn-outline'} w-full`}
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
          transition={{ delay: 0.6, duration: 0.6 }}
          className="max-w-md mx-auto mb-20"
        >
          <div className="glass-surface p-8">
            <h3 className="text-xl font-bold mb-4 text-center">Have a Promo Code?</h3>
            <form onSubmit={handlePromoSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Enter promo code"
                  className="glass-input h-12"
                />
                {promoError && (
                  <p className="mt-2 text-sm text-red-400">{promoError}</p>
                )}
                {promoSuccess && (
                  <p className="mt-2 text-sm text-green-400">✓ Promo code applied! Redirecting...</p>
                )}
              </div>
              <button
                type="submit"
                className="btn-primary w-full h-12 px-6"
              >
                Apply Code
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-white/50">
              Valid promo codes unlock PRO features instantly
            </p>
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
