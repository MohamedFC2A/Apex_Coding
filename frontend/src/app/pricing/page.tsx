'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Sparkles, Zap, ArrowLeft, ArrowRight, Crown, Star, Shield, Rocket, Clock, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

// Feature comparison data
const features = [
  { name: 'AI Requests per Day', free: '10', pro: '100', icon: <Zap className="h-4 w-4" /> },
  { name: 'WebContainer Preview', free: true, pro: true, icon: <Rocket className="h-4 w-4" /> },
  { name: 'Code Generation', free: 'Basic', pro: 'Advanced', icon: <Star className="h-4 w-4" /> },
  { name: 'Priority Processing', free: false, pro: true, icon: <Clock className="h-4 w-4" /> },
  { name: 'Export Projects', free: false, pro: true, icon: <Shield className="h-4 w-4" /> },
  { name: 'Custom Templates', free: false, pro: true, icon: <Crown className="h-4 w-4" /> },
  { name: 'Real-time Collaboration', free: false, pro: true, icon: <Users className="h-4 w-4" /> },
  { name: 'Support', free: 'Community', pro: '24h Priority', icon: <Star className="h-4 w-4" /> },
];

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

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-500/30 selection:text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_20%,rgba(245,158,11,0.08),transparent_60%)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-radial from-amber-500/10 to-transparent rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-amber-400 rounded-full animate-ping opacity-40" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-amber-300 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping opacity-35" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="page-container py-4">
          <div className={`flex flex-col gap-4 sm:items-center sm:justify-between ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
            <Link href="/" className="inline-flex items-center gap-3 group">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black shadow-lg transition-transform group-hover:scale-105">
                <span className="h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
              </span>
              <span className="text-sm font-bold tracking-widest text-white uppercase">{t('brand.name')}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
              <Link href="/app" className="btn-silver px-6 py-2 text-sm">
                {t('pricing.openIde')}
                {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 page-container py-16 sm:py-20">
        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Choose Your Plan</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent animate-pulse">
              {t('pricing.title')}
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto mb-20">
          {/* Free Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className={`relative p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:-translate-y-1 ${tier === 'FREE' ? 'ring-2 ring-white/20' : ''}`}
          >
            {tier === 'FREE' && (
              <div className="absolute -top-3 right-8">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/80 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
                  <Check className="h-3 w-3" /> Current Plan
                </span>
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2 silver-text">{t('pricing.free.name')}</h3>
              <p className="text-sm text-white/50 mb-4">{t('pricing.free.desc')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-white/40">/month</span>
              </div>
            </div>
            <Link href="/app" className="w-full btn-silver mb-6 block text-center">
              {t('pricing.cta.free')}
            </Link>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-white/70">
                <Check className="h-5 w-5 text-white/40 flex-shrink-0" /> 10 AI Requests/day
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <Check className="h-5 w-5 text-white/40 flex-shrink-0" /> WebContainer Preview
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <Check className="h-5 w-5 text-white/40 flex-shrink-0" /> Basic Code Generation
              </li>
              <li className="flex items-center gap-3 text-sm text-white/50">
                <X className="h-5 w-5 text-white/20 flex-shrink-0" /> Priority Processing
              </li>
              <li className="flex items-center gap-3 text-sm text-white/50">
                <X className="h-5 w-5 text-white/20 flex-shrink-0" /> Export Projects
              </li>
            </ul>
          </motion.div>

          {/* Pro Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className={`relative p-8 rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent backdrop-blur-xl shadow-[0_0_60px_rgba(245,158,11,0.15)] transition-all duration-300 hover:-translate-y-2 ${tier === 'PRO' ? 'ring-2 ring-amber-400' : ''}`}
          >
            {/* Pro Badge */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 py-2 text-sm font-bold text-black shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse">
                <Crown className="h-4 w-4" />
                MOST POPULAR
              </span>
            </div>
            
            {tier === 'PRO' && (
              <div className="absolute -top-3 right-8">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black shadow-lg">
                  <Star className="h-3 w-3" /> Active
                </span>
              </div>
            )}

            <div className="mb-6 mt-4">
              <h3 className="text-2xl font-bold mb-2">
                <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  {t('pricing.pro.name')}
                </span>
                <Sparkles className="inline-block ml-2 h-5 w-5 text-amber-400 animate-pulse" />
              </h3>
              <p className="text-sm text-white/50 mb-4">{t('pricing.pro.desc')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">$10</span>
                <span className="text-amber-300/60">/month</span>
              </div>
            </div>
            <Link href="/app" className="w-full btn-gold mb-6 block text-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              {t('pricing.cta.pro')}
            </Link>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> 100 AI Requests/day
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> WebContainer Preview
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> Advanced Code Generation
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> Priority Processing
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> Export Projects
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> Custom Templates
              </li>
              <li className="flex items-center gap-3 text-sm text-white/80">
                <Check className="h-5 w-5 text-amber-400 flex-shrink-0" /> 24h Priority Support
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-sm font-semibold text-white/60">Feature</th>
                  <th className="p-4 text-sm font-semibold text-white/80 w-32">Free</th>
                  <th className="p-4 text-sm font-bold w-32">
                    <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">PRO</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-sm text-white/70 flex items-center gap-3">
                      <span className="text-white/40">{feature.icon}</span>
                      {feature.name}
                    </td>
                    <td className="p-4 text-center">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? <Check className="h-5 w-5 text-white/40 mx-auto" /> : <X className="h-5 w-5 text-white/20 mx-auto" />
                      ) : (
                        <span className="text-sm text-white/60">{feature.free}</span>
                      )}
                    </td>
                    <td className="p-4 text-center bg-amber-500/5">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? <Check className="h-5 w-5 text-amber-400 mx-auto" /> : <X className="h-5 w-5 text-white/20 mx-auto" />
                      ) : (
                        <span className="text-sm font-semibold text-amber-300">{feature.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Promo Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-16"
        >
          <div className="p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 backdrop-blur-xl">
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
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-black/50 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              <button type="submit" className="btn-gold px-8">
                {t('pricing.promo.apply')}
              </button>
            </form>
            {promoError && (
              <p className="mt-3 text-red-400 text-sm flex items-center gap-2">
                <X className="h-4 w-4" /> {t('pricing.promo.error')}
              </p>
            )}
            {promoSuccess && (
              <p className="mt-3 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="h-4 w-4" /> {t('pricing.promo.success')}
              </p>
            )}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold mb-8">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-start">
            <div className="glass-card p-6 hover:border-white/20 transition-colors">
              <h4 className="font-semibold mb-2">What happens when I reach my daily limit?</h4>
              <p className="text-sm text-white/60">
                Your limit resets daily at midnight UTC. Upgrade to PRO for 10x more requests.
              </p>
            </div>
            <div className="glass-card p-6 hover:border-white/20 transition-colors">
              <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
              <p className="text-sm text-white/60">
                Yes! There are no contracts. Switch between plans or cancel anytime.
              </p>
            </div>
            <div className="glass-card p-6 hover:border-white/20 transition-colors">
              <h4 className="font-semibold mb-2">What&apos;s included in Priority Support?</h4>
              <p className="text-sm text-white/60">
                PRO users get 24-hour response time and access to our dedicated support channel.
              </p>
            </div>
            <div className="glass-card p-6 hover:border-white/20 transition-colors">
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

