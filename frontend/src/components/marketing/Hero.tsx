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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClick();
    }
  };

  return (
    <div className="mt-6 max-w-2xl">
      <div 
        className="relative group cursor-pointer"
        onClick={onClick}
        onKeyPress={handleKeyPress}
        role="button"
        tabIndex={0}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/20 blur-xl group-hover:blur-2xl transition-all duration-300" />
        <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/20 hover:shadow-[0_8px_40px_rgba(34,211,238,0.2)] transition-all">
          <div className="flex items-center gap-3 px-5 py-4">
            <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={text}
              readOnly
              placeholder=""
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none cursor-pointer"
            />
            <span className="h-4 w-0.5 bg-white/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { t } = useLanguage();

  // Navigate to IDE when search bar is clicked
  const handleStart = () => {
    window.location.href = '/app';
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-center px-6 pt-14 pb-12 md:pt-20">
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300/90 via-fuchsia-300/90 to-cyan-300/90" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/85">{t('brand.name')}</span>
        </a>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-300/90" />
            {t('hero.badge')}
          </div>
        </div>
      </div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10"
      >
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
            {t('hero.title')}
          </span>
        </h1>
        <h2 className="sr-only">Graph-Based AI IDE</h2>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/70 md:text-lg">
          {t('hero.subtitle')}
        </p>
        <TypingSearch onClick={handleStart} />
        <p className="mt-3 text-xs text-white/50 max-w-2xl">
          {t('ui.search.placeholder')}
        </p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.1, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-8 flex flex-wrap items-center gap-3"
      >
        <a
          href="/pricing"
          className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
        >
          {t('ui.viewPricing')}
        </a>
        <Link
          href="/demo"
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white/85 backdrop-blur-md transition hover:bg-white/5"
        >
          {t('hero.cta.demo')}
        </Link>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10"
      >
        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-md">
          <span className="text-white/55">{t('hero.powered')}</span>
          <span className="rounded-full bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/20 px-3 py-1 ring-1 ring-white/10">
            DeepSeek
          </span>
          <span className="rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 px-3 py-1 ring-1 ring-white/10">
            Convex
          </span>
          <span className="text-white/55">{t('ui.techStack')}</span>
        </div>
      </motion.div>
    </div>
  );
}
