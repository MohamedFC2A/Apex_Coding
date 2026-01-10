'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

export default function PricingPage() {
  const { t } = useLanguage();
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
      name: 'FREE',
      price: '$0',
      period: '/month',
      description: 'Perfect for trying out Nexus Apex',
      features: [
        '10 AI Requests per day',
        'Graph-Based Understanding',
        'Basic Code Generation',
        'Web Preview',
        'Community Support'
      ],
      cta: 'Start Free',
      current: tier === 'FREE',
      popular: false
    },
    {
      id: 'pro',
      name: 'PRO',
      price: '$10',
      period: '/month',
      description: 'For serious developers building at scale',
      features: [
        '100 AI Requests per day',
        'Priority AI Processing',
        'Advanced Code Generation',
        'Real-time Collaboration',
        'Priority Support',
        'Export Projects',
        'Custom Templates'
      ],
      cta: 'Upgrade to Pro',
      current: tier === 'PRO',
      popular: true
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
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                <span className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300/90 via-fuchsia-300/90 to-cyan-300/90" />
              </span>
              <span className="text-sm font-semibold tracking-wide text-white/85">{t('brand.name')}</span>
            </Link>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-md transition hover:bg-white/5"
              >
                Open IDE
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Start building with our graph-based AI IDE. Upgrade anytime for more power.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {tiers.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className={`relative rounded-3xl border p-8 backdrop-blur-md ${
                plan.popular
                  ? 'border-cyan-400/30 bg-gradient-to-b from-cyan-400/10 to-fuchsia-500/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-1 text-xs font-bold text-white">
                    <Sparkles className="h-3 w-3" />
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
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-white/60 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-white/60">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/app"
                className={`block w-full rounded-2xl px-6 py-3 text-center text-sm font-semibold transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-white shadow-[0_10px_40px_rgba(34,211,238,0.3)] hover:shadow-[0_10px_50px_rgba(34,211,238,0.4)]'
                    : 'border border-white/20 bg-white/5 text-white/90 hover:bg-white/10'
                }`}
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
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="h-6 w-6 text-fuchsia-400" />
              <h3 className="text-xl font-bold">Have a Promo Code?</h3>
            </div>
            <p className="text-sm text-white/60 mb-6">
              Enter your promo code to unlock PRO features instantly.
            </p>
            
            <form onSubmit={handlePromoSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Enter promo code (88776655443322)"
                className="flex-1 h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 backdrop-blur-md outline-none focus:ring-2 focus:ring-cyan-400/30"
              />
              <button
                type="submit"
                className="h-12 rounded-2xl bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
              >
                Apply Code
              </button>
            </form>

            {promoError && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-sm text-red-400"
              >
                {promoError}
              </motion.p>
            )}

            {promoSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4"
              >
                <p className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Promo code applied! Redirecting to IDE...
                </p>
              </motion.div>
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
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h4 className="font-semibold mb-2">What happens when I reach my daily limit?</h4>
              <p className="text-sm text-white/60">
                Your limit resets daily at midnight UTC. You can upgrade to PRO for 10x more requests.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
              <p className="text-sm text-white/60">
                Yes! There are no contracts. Switch between plans or cancel anytime.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h4 className="font-semibold mb-2">What&apos;s included in Priority Support?</h4>
              <p className="text-sm text-white/60">
                PRO users get 24-hour email response time and access to our dedicated support channel.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
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
