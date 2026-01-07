'use client';

import { Hero } from '@/components/marketing/Hero';
import { FeatureCards } from '@/components/marketing/FeatureCards';
import { ValueProp } from '@/components/marketing/ValueProp';
import { LeadCapture } from '@/components/marketing/LeadCapture';
import { DemoSection } from '@/components/marketing/DemoSection';
import { FloatingPlan } from '@/components/FloatingPlan';

export default function HomePage() {
  return (
    <>
      <FloatingPlan />
      <header className="relative min-h-[calc(100vh-56px)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_20%_15%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(1100px_740px_at_85%_80%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(900px_520px_at_60%_35%,rgba(255,255,255,0.04),transparent_60%)]" />
          <div className="absolute -top-44 left-[-160px] h-[620px] w-[620px] rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -bottom-48 right-[-180px] h-[680px] w-[680px] rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <Hero />
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <FeatureCards />
        </section>
        <section className="mx-auto max-w-6xl px-6 pb-14">
          <ValueProp />
        </section>
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <LeadCapture />
        </section>
        <section id="demo" className="mx-auto max-w-6xl px-6 pb-20">
          <DemoSection />
        </section>
      </main>
    </>
  );
}
