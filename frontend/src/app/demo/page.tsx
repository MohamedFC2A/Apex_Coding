'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PreviewRunnerPreview } from '@/components/Preview/PreviewRunnerPreview';
import { useLanguage } from '@/context/LanguageContext';

export default function DemoPage() {
  const { isRTL } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Initializing Demo Environment...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0B0F14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="page-container py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="btn-outline px-4 py-2 text-sm">
              {isRTL ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
              <span className="font-medium">Back to Home</span>
            </Link>
            <div className="text-sm text-white/50">Interactive Preview</div>
          </div>
        </div>
      </header>
      <main className="flex-1 relative page-container py-4 md:py-8">
        <div className="w-full h-[calc(100dvh-140px)] md:h-[calc(100dvh-170px)] border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-2xl">
          {typeof window !== 'undefined' && <PreviewRunnerPreview />}
        </div>
      </main>
    </div>
  );
}
