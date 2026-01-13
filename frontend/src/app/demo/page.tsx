'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PreviewRunnerPreview } from '@/components/Preview/PreviewRunnerPreview';
import { useLanguage } from '@/context/LanguageContext';

export default function DemoPage() {
  const { isRTL, t } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="silver-text text-xl font-medium animate-pulse">
          {t('demo.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-white selection:text-black">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
      </div>

      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-white/30 transition-all group"
            >
              {isRTL ? (
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              ) : (
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              )}
              <span className="text-sm font-medium">{t('demo.back')}</span>
            </Link>

            <div className="hidden md:flex flex-col items-center">
              <h1 className="text-lg font-bold silver-text tracking-tight uppercase">
                {t('demo.title')}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
                {t('demo.status')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative max-w-[1600px] mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-white/50 text-sm">{t('brand.name')}</p>
            <h2 className="text-2xl font-bold tracking-tight">{t('demo.subtitle')}</h2>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-[1px] shadow-2xl">
            <div className="w-full h-full bg-[#050505] rounded-2xl overflow-hidden relative group">
              {/* Silver shine effect on border */}
              <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
              
              <div className="w-full h-full">
                {typeof window !== 'undefined' && <PreviewRunnerPreview />}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 border-t border-white/5 bg-black/50 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-6 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.2em]">
          <span>© 2026 APEX CODING</span>
          <span className="hidden md:inline">DESIGNED FOR THE NEXT GENERATION OF DEVELOPERS</span>
        </div>
      </footer>
    </div>
  );
}
