'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PreviewRunnerPreview } from '@/components/Preview/PreviewRunnerPreview';

export default function DemoPage() {
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
      <header className="border-b border-white/10 p-4 bg-[#0B0F14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Home</span>
          </Link>
          <div className="text-sm text-white/50">
            Interactive Preview
          </div>
        </div>
      </header>
      <main className="flex-1 relative p-4 md:p-8">
        <div className="w-full h-[80vh] border border-white/10 rounded-xl overflow-hidden bg-black/40 shadow-2xl">
          {typeof window !== 'undefined' && <PreviewRunnerPreview />}
        </div>
      </main>
    </div>
  );
}
