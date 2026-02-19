'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Terminal, Code2, Zap, ArrowRight } from 'lucide-react';

// Simulated live code lines for the demo visual
const CODE_LINES = [
  { color: 'text-purple-400', text: 'function' },
  { color: 'text-blue-300', text: ' createDashboard' },
  { color: 'text-white/70', text: '() {' },
  { color: 'text-cyan-400', text: '\n  const' },
  { color: 'text-white/80', text: ' data = await ' },
  { color: 'text-green-400', text: 'fetchMetrics' },
  { color: 'text-white/70', text: '();' },
  { color: 'text-cyan-400', text: '\n  return' },
  { color: 'text-white/70', text: ' <Dashboard data={data} />;' },
  { color: 'text-white/70', text: '\n}' },
];

const FILE_TABS = ['index.html', 'style.css', 'app.js', 'api.ts'];

export function DemoSection() {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Section header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/8 bg-white/3 text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
          Live Preview
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
          {t('demo.title') || 'See it in action'}
        </h2>
        <p className="mt-4 text-base text-white/40 font-light max-w-lg mx-auto">
          {t('demo.subtitle') || 'Watch as Apex Logic builds a real project, file by file, in real-time.'}
        </p>
      </div>

      {/* App mockup */}
      <div className="relative">
        {/* Outer glow */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 blur-xl opacity-60" />

        <div className="relative rounded-3xl border border-white/10 bg-[#08080f] overflow-hidden shadow-2xl">
          {/* Titlebar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 bg-white/2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-amber-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <div className="flex-1 flex items-center gap-3 ml-2">
              {FILE_TABS.map((tab, i) => (
                <div
                  key={tab}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                    i === 0
                      ? 'bg-white/8 text-white/85 border border-white/10'
                      : 'text-white/30 hover:text-white/55'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              Generating…
            </div>
          </div>

          {/* IDE layout */}
          <div className="flex" style={{ minHeight: 340 }}>
            {/* Sidebar */}
            <div className="hidden md:flex flex-col gap-1 w-44 border-r border-white/5 bg-white/1 py-4 px-3">
              <div className="text-[10px] uppercase tracking-widest text-white/25 font-bold px-2 mb-2">Explorer</div>
              {['src/', '├ index.html', '├ style.css', '├ app.js', '└ api.ts'].map(item => (
                <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-mono ${item === '├ index.html' ? 'bg-blue-500/10 text-blue-300' : 'text-white/35 hover:text-white/55'}`}>
                  {item.startsWith('├') || item.startsWith('└') ? (
                    <Code2 className="w-3 h-3 opacity-50 flex-shrink-0" />
                  ) : (
                    <span className="w-3 h-3" />
                  )}
                  {item}
                </div>
              ))}
            </div>

            {/* Code area */}
            <div className="flex-1 p-6 font-mono text-sm leading-7 overflow-hidden relative">
              {/* Line numbers */}
              <div className="absolute left-3 top-6 bottom-6 flex flex-col gap-0 text-white/15 text-xs leading-7 select-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="text-right w-5">{i + 1}</div>
                ))}
              </div>

              <div className="ml-8">
                {CODE_LINES.map((line, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className={`${line.color} whitespace-pre`}
                  >
                    {line.text}
                  </motion.span>
                ))}
                {/* Blinking cursor */}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-0.5 h-5 bg-blue-400 align-middle ml-0.5"
                />
              </div>

              {/* AI thinking bubble */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2 }}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-500/8 text-xs text-blue-300 font-semibold"
              >
                <Terminal className="w-3.5 h-3.5" />
                AI writing index.html…
              </motion.div>
            </div>
          </div>

          {/* Bottom status bar */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 bg-white/1">
            <div className="flex items-center gap-4 text-[11px] text-white/30 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
              <span>TypeScript</span>
              <span>UTF-8</span>
            </div>
            <div className="text-[11px] text-white/25 font-mono">Apex Logic v2.0</div>
          </div>
        </div>
      </div>

      {/* CTA below demo */}
      <div className="mt-10 text-center">
        <a
          href="/app"
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.03] transition-transform duration-200"
        >
          <Zap className="w-4 h-4 fill-current" />
          Try Apex Logic Free
          <ArrowRight className="w-4 h-4" />
        </a>
        <p className="mt-4 text-xs text-white/28">No credit card required · Free to start</p>
      </div>
    </motion.div>
  );
}
