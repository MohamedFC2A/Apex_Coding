'use client';

import { Hero } from '@/components/marketing/Hero';
import { FeatureCards } from '@/components/marketing/FeatureCards';
import { ValueProp } from '@/components/marketing/ValueProp';
import { LeadCapture } from '@/components/marketing/LeadCapture';
import { DemoSection } from '@/components/marketing/DemoSection';

export default function HomePage() {
  return (
    <>
      <header className="relative min-h-[calc(100vh-56px)] overflow-hidden bg-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_20%_15%,rgba(255,255,255,0.05),transparent_55%),radial-gradient(1100px_740px_at_85%_80%,rgba(255,255,255,0.03),transparent_55%)]" />
          <div className="absolute -top-44 left-[-160px] h-[620px] w-[620px] rounded-full bg-white/5 blur-[120px]" />
          <div className="absolute -bottom-48 right-[-180px] h-[680px] w-[680px] rounded-full bg-white/5 blur-[120px]" />
        </div>
        <Hero />
      </header>

      <main className="relative bg-black">
        <section className="page-container pb-14 sm:pb-16">
          <FeatureCards />
        </section>
        <section className="page-container pb-12 sm:pb-14">
          <ValueProp />
        </section>
        <section className="page-container pb-16 sm:pb-20">
          <LeadCapture />
        </section>
        <section id="demo" className="page-container pb-16 sm:pb-20">
          <DemoSection />
        </section>
      </main>
    </>
  );
}
