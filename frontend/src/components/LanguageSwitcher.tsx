'use client';

import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <motion.button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/10"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Globe className="h-4 w-4" />
      <span>{language === 'en' ? 'AR' : 'EN'}</span>
    </motion.button>
  );
}
