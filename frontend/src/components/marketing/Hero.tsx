'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Sparkles, ArrowRight, Zap, Play, Code2, Terminal, Cpu } from 'lucide-react';

const PHRASES = [
  'Build a full-stack SaaS dashboard...',
  'Create a crypto trading bot...',
  'Design a 3D portfolio website...',
  'Develop an AI chat interface...',
  'Generate a REST API with auth...',
];

function TypingSearch({ onClick }: { onClick: () => void }) {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [speed, setSpeed] = useState(90);

  useEffect(() => {
    const phrase = PHRASES[loopNum % PHRASES.length];
    const handle = setTimeout(() => {
      if (!isDeleting) {
        setText(phrase.substring(0, text.length + 1));
        if (text.length + 1 === phrase.length) { setSpeed(2200); setIsDeleting(true); }
        else setSpeed(90);
      } else {
        setText(phrase.substring(0, text.length - 1));
        if (text.length - 1 === 0) { setIsDeleting(false); setLoopNum(l => l + 1); setSpeed(90); }
        else setSpeed(45);
      }
    }, speed);
    return () => clearTimeout(handle);
  }, [text, isDeleting, loopNum, speed]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full max-w-2xl mx-auto block relative group mt-10"
      aria-label="Start coding"
    >
      {/* Glow border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-cyan-500/60 opacity-70 blur-sm group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-2xl overflow-hidden">
        {/* Top shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/25 to-purple-500/25 border border-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-300" />
          </div>
          <span className="flex-1 text-left text-base md:text-lg text-white/85 font-mono tracking-tight truncate">
            {text}
            <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-blue-400 animate-pulse" />
          </span>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-semibold whitespace-nowrap">
            Generate <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </button>
  );
}

const STATS = [
  { value: '10×', label: 'Faster Development' },
  { value: '100%', label: 'Context-Aware AI' },
  { value: '0s', label: 'Setup Time' },
  { value: '∞', label: 'Project Scale' },
];

export function Hero() {
  const { t } = useLanguage();

  const handleStart = () => { window.location.href = '/app'; };

  return (
    <div className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-[#020208]">
      {/* Layered background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large ambient orbs */}
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[65%] bg-blue-700/15 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[55%] h-[65%] bg-purple-700/15 rounded-full blur-[160px]" />
        <div className="absolute top-[35%] left-[45%] w-[40%] h-[40%] bg-cyan-600/8 rounded-full blur-[120px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.12),transparent)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16 w-full">
        <div className="flex flex-col items-center text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 bg-white/4 backdrop-blur-md text-sm font-medium text-blue-200 mb-10 hover:border-blue-500/30 transition-colors">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Cpu className="w-3.5 h-3.5 text-blue-300" />
              Next-Gen AI Code Editor — Now Live
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-5xl sm:text-7xl lg:text-[90px] font-extrabold tracking-tight leading-[1.05] mb-0">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50">
                Build the Future
              </span>
              <span
                className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400"
                style={{ backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }}
              >
                With Apex Logic
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.65 }}
            className="mt-7 max-w-2xl text-lg md:text-xl text-white/48 leading-relaxed font-light"
          >
            The first AI IDE that understands your entire project, not just a single file.
            Describe your app, and watch it build itself — live, file by file.
          </motion.p>

          {/* Typing bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.65 }}
            className="w-full"
          >
            <TypingSearch onClick={handleStart} />
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={handleStart}
              className="group relative px-8 py-4 rounded-xl font-bold text-base overflow-hidden bg-white text-black hover:scale-[1.03] transition-transform duration-200"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/25 via-cyan-300/25 to-purple-400/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2.5">
                <Zap className="w-5 h-5 fill-current" />
                Start Coding Free
              </span>
            </button>

            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl border border-white/10 bg-white/4 text-white font-semibold hover:bg-white/8 hover:border-white/18 transition-all flex items-center gap-2.5 backdrop-blur-sm"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-20 w-full max-w-3xl"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/6 rounded-2xl overflow-hidden border border-white/6">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-[#020208] px-6 py-6 text-center">
                  <div className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-200">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-white/40 font-medium tracking-wide uppercase">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Tech stack */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="mt-12 flex flex-wrap justify-center items-center gap-6 md:gap-10"
          >
            <span className="text-xs uppercase tracking-widest text-white/25 font-semibold">Powered by</span>
            {[
              { dot: 'bg-blue-500', name: 'Next.js' },
              { dot: 'bg-cyan-400', name: 'React' },
              { dot: 'bg-purple-500', name: 'Tailwind' },
              { dot: 'bg-green-500', name: 'Node.js' },
              { dot: 'bg-orange-400', name: 'WebContainers' },
            ].map(item => (
              <span key={item.name} className="text-sm font-bold text-white/40 flex items-center gap-2 hover:text-white/70 transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                {item.name}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#020208] to-transparent pointer-events-none" />

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
