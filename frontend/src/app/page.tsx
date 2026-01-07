import { Hero } from '@/components/marketing/Hero';

export default function HomePage() {
  return (
    <>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-[-120px] h-[520px] w-[520px] rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -bottom-28 right-[-120px] h-[560px] w-[560px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        </div>
        <Hero />
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
              <div className="text-sm font-semibold tracking-wide text-white/90">Graph-Based Understanding</div>
              <div className="mt-2 text-sm leading-relaxed text-white/65">
                Nexus Apex maps your repo into a navigable graph so the AI reasons about structure, dependencies, and intent.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
              <div className="text-sm font-semibold tracking-wide text-white/90">Keystroke Persistence</div>
              <div className="mt-2 text-sm leading-relaxed text-white/65">
                Every edit is captured in real time — refresh without fear. Convex-backed project state keeps you moving.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
              <div className="text-sm font-semibold tracking-wide text-white/90">Instant Feedback</div>
              <div className="mt-2 text-sm leading-relaxed text-white/65">
                Skeleton loaders, streaming output, and a floating plan keep progress visible and perceived performance high.
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

