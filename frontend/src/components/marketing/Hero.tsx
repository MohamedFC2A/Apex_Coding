import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Sparkles, ArrowRight, Zap, Play } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

function TypingSearch({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);
  
  useEffect(() => {
    const phrases = [
      t('search.phrase1') || "Create a full-stack dashboard...",
      t('search.phrase2') || "Build a crypto trading bot...",
      t('search.phrase3') || "Design a 3D portfolio...",
      t('search.phrase4') || "Develop an AI chat interface..."
    ];

    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];

      setText(fullText.substring(0, text.length + (isDeleting ? -1 : 1)));
      setTypingSpeed(isDeleting ? 40 : 100);

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
  }, [text, isDeleting, loopNum, typingSpeed, t]);

  return (
    <div className="mt-8 max-w-2xl w-full mx-auto relative z-20">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-2xl opacity-75 blur-lg animate-pulse-slow"></div>
      <button
        type="button"
        className="relative w-full text-start group"
        onClick={onClick}
        aria-label={t('hero.cta.start')}
      >
        <div className="relative rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden p-1">
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/5">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            
            <span className="flex-1 text-lg md:text-xl font-medium text-white/90 font-mono tracking-tight">
              {text}
              <span className="inline-block w-[2px] h-6 ml-1 align-middle bg-blue-400 animate-pulse"/>
            </span>
            
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-white/40 font-mono">
              <span>Generic AI</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export function Hero() {
  const { t } = useLanguage();

  const handleStart = () => {
    window.location.href = '/app';
  };

  return (
    <div className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[#000000]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[150px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="page-container relative z-10 pt-20 pb-12">
        <div className="flex flex-col items-center text-center">
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-lg shadow-blue-500/10 hover:border-blue-500/30 transition-colors">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium text-blue-200 tracking-wide">
                {t('hero.badge') || "Next-Gen AI Code Editor"}
              </span>
            </div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-5xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-[1.1]">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 pb-2">
                Build the Future
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-shimmer bg-[size:200%_auto]">
                With Apex Logic
              </span>
            </h1>
            
            <p className="mt-8 max-w-2xl mx-auto text-lg md:text-xl text-white/50 leading-relaxed font-light">
              {t('hero.subtitle') || "Experience a graphing-based IDE that thinks like you do. Generative AI, real-time collaboration, and instant deployment."}
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.2, duration: 0.7 }}
            className="w-full"
          >
            <TypingSearch onClick={handleStart} />
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={handleStart}
              className="group relative px-8 py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 fill-current" />
                <span>{t('hero.cta.start') || "Start Coding Free"}</span>
              </div>
            </button>
            
            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl border border-white/10 bg-white/5 text-white font-medium hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 backdrop-blur-sm"
            >
              <Play className="w-4 h-4 ml-1" />
              <span>{t('hero.cta.demo') || "Watch Demo"}</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-20 pt-10 border-t border-white/5"
          >
            <p className="text-sm text-white/30 uppercase tracking-widest mb-6">Trusted Technology Stack</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              {/* Simple text placeholders for logos to keep it clean, could be SVGs */}
              <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"/> Next.js</span>
              <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-2 h-2 bg-cyan-500 rounded-full"/> React</span>
              <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-2 h-2 bg-purple-500 rounded-full"/> Tailwind</span>
              <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"/> Node.js</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
