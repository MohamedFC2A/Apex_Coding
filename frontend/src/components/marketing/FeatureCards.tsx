'use client';

import { motion } from 'framer-motion';

const cards = [
  {
    title: 'Graph-Based Understanding',
    body: 'Nexus Apex maps your repo into a navigable graph so the AI reasons about structure, dependencies, and intent.'
  },
  {
    title: 'Keystroke Persistence',
    body: 'Every edit is captured in real time — refresh without fear. Convex-backed project state keeps you moving.'
  },
  {
    title: 'Instant Feedback',
    body: 'Skeleton loaders, streaming output, and a floating plan keep progress visible and perceived performance high.'
  }
];

export function FeatureCards() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      className="grid gap-6 md:grid-cols-3"
    >
      {cards.map((card) => (
        <motion.div
          key={card.title}
          variants={{
            hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
            show: { opacity: 1, y: 0, filter: 'blur(0px)' }
          }}
          transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
        >
          <div className="text-sm font-semibold tracking-wide text-white/90">{card.title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/65">{card.body}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}

