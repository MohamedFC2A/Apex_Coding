'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export function LeadCapture() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
      aria-label="Lead capture"
    >
      <div className="text-sm font-semibold tracking-wide text-white/90">Get early access</div>
      <div className="mt-2 text-sm leading-relaxed text-white/65">
        Join the waitlist for Nexus Apex updates and launch access.
      </div>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <label className="sr-only" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-11 w-full flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 backdrop-blur-md outline-none focus:ring-2 focus:ring-cyan-400/30"
          inputMode="email"
          autoComplete="email"
        />
        <button
          type="submit"
          className="h-11 rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
        >
          Join waitlist
        </button>
      </form>

      {submitted && (
        <div className="mt-3 text-sm text-white/70">
          Saved. We’ll reach out soon.
        </div>
      )}
    </motion.section>
  );
}

