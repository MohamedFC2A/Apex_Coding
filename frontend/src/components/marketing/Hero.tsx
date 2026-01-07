'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

export function Hero() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-2xl">
        <span className="h-2 w-2 rounded-full bg-cyan-300/90" />
        Built for Developers
      </div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-6"
      >
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Code at the Speed of Thought with Nexus Apex.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/70 md:text-lg">
          The first Graph-Based AI IDE that understands your project structure, not just your files.
        </p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.1, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-8 flex flex-wrap items-center gap-3"
      >
        <Link
          href="/app"
          className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-2xl transition hover:bg-white/15"
        >
          Start Coding Free
        </Link>
        <Link
          href="#demo"
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white/85 backdrop-blur-2xl transition hover:bg-white/5"
        >
          Watch Demo
        </Link>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10"
      >
        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-2xl">
          <span className="text-white/55">Powered by</span>
          <span className="rounded-full bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/20 px-3 py-1 ring-1 ring-white/10">
            DeepSeek
          </span>
          <span className="rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 px-3 py-1 ring-1 ring-white/10">
            Convex
          </span>
          <span className="text-white/55">+ Next.js, Tailwind, Framer Motion</span>
        </div>
      </motion.div>
    </div>
  );
}

