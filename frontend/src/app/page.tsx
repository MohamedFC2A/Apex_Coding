'use client';

import { Hero } from '@/components/marketing/Hero';
import { FeatureCards } from '@/components/marketing/FeatureCards';
import { ValueProp } from '@/components/marketing/ValueProp';
import { LeadCapture } from '@/components/marketing/LeadCapture';
// import { DemoSection } from '@/components/marketing/DemoSection'; // Keeping it if it was there, but it wasn't in list_dir output earlier? Wait, it was in the file: import { DemoSection } from '@/components/marketing/DemoSection';
// I'll keep it imports if I can confirm it exists. view_file 16 showed it.
import { DemoSection } from '@/components/marketing/DemoSection';

const SectionSeparator = () => (
  <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-12" />
);

export default function HomePage() {
  return (
    <>
      <header className="relative bg-black selection:bg-blue-500/30">
        <Hero />
      </header>

      <main className="relative bg-[#050505] selection:bg-purple-500/30">
        
        <section className="page-container py-24 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm" />
          <FeatureCards />
        </section>

        <SectionSeparator />

        <section className="page-container py-24">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              Why Apex Logic?
            </h2>
            <p className="text-lg text-white/50">
              Built for the next generation of software engineers.
            </p>
          </div>
          <ValueProp />
        </section>

        <SectionSeparator />

        <section className="page-container py-24">
          <LeadCapture />
        </section>

        <section id="demo" className="page-container pb-24">
          <div className="mt-24">
             <DemoSection />
          </div>
        </section>
      </main>
    </>
  );
}
