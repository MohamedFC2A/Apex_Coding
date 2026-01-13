import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

function TypingSearch({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);
  
  const phrases = [
    t('search.phrase1'),
    t('search.phrase2'),
    t('search.phrase3'),
    t('search.phrase4'),
    t('search.phrase5')
  ];

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];

      setText(fullText.substring(0, text.length + (isDeleting ? -1 : 1)));
      setTypingSpeed(isDeleting ? 50 : 150);

      if (!isDeleting && text === fullText) {
        setTypingSpeed(2000);
        setIsDeleting(true);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
        setTypingSpeed(100);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed, phrases]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className="mt-6 max-w-2xl">
      <button
        type="button"
        className="relative group w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl"
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={t('hero.cta.start')}
      >
        <div className="absolute inset-0 bg-white/5 blur-xl group-hover:blur-2xl transition-all duration-300" />
        <div className="relative rounded-2xl border border-white/10 bg-black shadow-[0_8px_32px_rgba(0,0,0,0.8)] hover:border-white/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="flex items-center gap-3 px-5 py-4 relative z-10">
            <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="flex-1 bg-transparent text-white/90 outline-none font-medium">
              {text}
            </span>
            <span className="h-4 w-0.5 bg-white/40 animate-pulse" />
          </div>
        </div>
      </button>
    </div>
  );
}

export function Hero() {
  const { t, isRTL } = useLanguage();

  // Navigate to IDE when search bar is clicked
  const handleStart = () => {
    window.location.href = '/app';
  };

  return (
    <div className="page-container flex min-h-[calc(100vh-56px)] flex-col justify-center pt-14 pb-12 md:pt-20 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[50%] h-[50%] bg-white/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div
        className={`flex flex-col gap-4 sm:items-center sm:justify-between relative z-10 ${isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
      >
        <a href="/" className="inline-flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black shadow-lg">
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-white via-gray-400 to-white shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
          </span>
          <span className="text-sm font-bold tracking-widest text-white uppercase">{t('brand.name')}</span>
        </a>
        <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <LanguageSwitcher />
          <div className="badge border-white/20 bg-white/5">
            <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_5px_white]" />
            <span className="text-white/80">{t('hero.badge')}</span>
          </div>
        </div>
      </div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10 relative z-10"
      >
        <h1 className="text-balance text-4xl font-bold tracking-tighter md:text-7xl">
          <span className="silver-text">
            {t('hero.title').split(' ').slice(0, -2).join(' ')}{' '}
          </span>
          <span className="gold-text">
            {t('hero.title').split(' ').slice(-2).join(' ')}
          </span>
        </h1>
        <h2 className="sr-only">Graph-Based AI IDE</h2>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/60 md:text-xl font-light">
          {t('hero.subtitle')}
        </p>
        <TypingSearch onClick={handleStart} />
        <p className="mt-4 text-[10px] text-white/40 max-w-2xl uppercase tracking-[0.2em]">
          {t('ui.search.placeholder')}
        </p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.1, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center relative z-10"
      >
        <a href="/app" className="btn-gold px-10 py-4 text-base">
          {t('hero.cta.start')}
        </a>
        <a href="/pricing" className="btn-silver px-8 py-4 text-base">
          {t('ui.viewPricing')}
        </a>
        <Link href="/demo" className="btn-outline px-8 py-4 border-white/10 hover:border-white/40 text-white/80">
          {t('hero.cta.demo')}
        </Link>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-16 relative z-10"
      >
        <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-black/50 px-5 py-3 text-[10px] font-bold text-white/40 backdrop-blur-md uppercase tracking-widest">
          <span className="text-white/20">{t('hero.powered')}</span>
          <span className="px-3 py-1 border border-white/10 rounded-lg">
            DeepSeek
          </span>
          <span className="px-3 py-1 border border-white/10 rounded-lg">
            Convex
          </span>
          <span className="text-white/20">{t('ui.techStack')}</span>
        </div>
      </motion.div>
    </div>
  );
}
