'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { motion } from 'framer-motion';

import { ConvexReactClient } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' }
};

export function Hero() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexClient = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  const handleStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);
    let shouldNavigate = true;
    try {
      if (convexClient) {
        const withTimeout = async <T,>(p: Promise<T>, timeoutMs: number) => {
          let timer: any;
          const timeout = new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Upstream timed out')), timeoutMs);
          });
          try {
            return await Promise.race([p, timeout]);
          } finally {
            try {
              clearTimeout(timer);
            } catch {
              // ignore
            }
          }
        };

        const attempt = async () =>
          await withTimeout(convexClient.mutation((api as any).projects.ensureDefault, {} as any), 5_000);

        let lastErr: any = null;
        for (let i = 0; i < 3; i++) {
          try {
            await attempt();
            lastErr = null;
            break;
          } catch (e: any) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 450 * (i + 1)));
          }
        }

        if (lastErr) throw lastErr;
      }
    } catch (e: any) {
      if (convexClient) {
        setStartError(e?.message || 'Failed to initialize project. Please retry.');
        shouldNavigate = false;
      }
    } finally {
      if (shouldNavigate) startTransition(() => router.push('/app'));
      setIsStarting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-center px-6 pt-14 pb-12 md:pt-20">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300/90 via-fuchsia-300/90 to-cyan-300/90" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/85">Nexus Apex</span>
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-cyan-300/90" />
          Built for Developers
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
            Code at the Speed of Thought with Nexus Apex.
          </span>
        </h1>
        <h2 className="sr-only">Graph-Based AI IDE</h2>
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
        <button
          type="button"
          onClick={handleStart}
          className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15 disabled:opacity-60"
          disabled={isStarting || isPending}
        >
          {isStarting || isPending ? 'Starting…' : 'Start Coding Free'}
        </button>
        <Link
          href="#demo"
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white/85 backdrop-blur-md transition hover:bg-white/5"
        >
          Watch Demo
        </Link>
      </motion.div>

      {startError && (
        <div className="mt-4 max-w-2xl rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-white/80 backdrop-blur-md">
          <div className="font-semibold text-white/90">Initialization failed</div>
          <div className="mt-1 text-white/70">{startError}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-10"
      >
        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-md">
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
