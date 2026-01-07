'use client';

import { motion } from 'framer-motion';

const items = [
  {
    title: 'Graph context, not file guessing',
    body: 'Understand structure, dependencies, and intent—so edits land in the right place.'
  },
  {
    title: 'Streaming generation with recovery',
    body: 'SSE streaming, stall detection, auto-retry, and resume keeps progress moving under real-world latency.'
  },
  {
    title: 'Convex-backed persistence',
    body: 'Project state syncs to the database so refreshes don’t wipe your work.'
  }
];

export function ValueProp() {
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      className="grid gap-4 md:grid-cols-3"
      aria-label="Value proposition"
    >
      {items.map((item) => (
        <motion.div
          key={item.title}
          variants={{
            hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
            show: { opacity: 1, y: 0, filter: 'blur(0px)' }
          }}
          transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
        >
          <div className="text-sm font-semibold tracking-wide text-white/90">{item.title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/65">{item.body}</div>
        </motion.div>
      ))}
    </motion.section>
  );
}

