'use client';

import { Hero } from '@/components/marketing/Hero';
import { FeatureCards } from '@/components/marketing/FeatureCards';
import { ValueProp } from '@/components/marketing/ValueProp';
import { LeadCapture } from '@/components/marketing/LeadCapture';
import { DemoSection } from '@/components/marketing/DemoSection';

export default function HomePage() {
  return (
    <>
      {/* Hero — full-screen cinematic */}
      <header className="relative bg-[#020208]">
        <Hero />
      </header>

      <main className="relative bg-[#020208]">
        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        {/* Feature cards grid */}
        <section className="max-w-6xl mx-auto px-6 py-28">
          <FeatureCards />
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />

        {/* Value props — alternating rows */}
        <section className="max-w-6xl mx-auto px-6 py-28">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/8 bg-white/3 text-xs font-semibold uppercase tracking-widest text-white/38 mb-5">
              Why Apex Logic?
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
              Built different, from the ground up.
            </h2>
            <p className="mt-5 text-base text-white/40 font-light max-w-xl mx-auto">
              Every feature was designed around one question: what would make an AI IDE actually useful for real developers?
            </p>
          </div>
          <ValueProp />
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />

        {/* Newsletter CTA */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <LeadCapture />
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />

        {/* IDE Demo */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <DemoSection />
        </section>

        {/* Footer spacer */}
        <div className="h-16" />
      </main>
    </>
  );
}
