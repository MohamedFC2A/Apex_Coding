import { useLanguage } from '@/context/LanguageContext';

export function BrandFooter() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/5 bg-black/50 backdrop-blur-2xl">
      <div className="page-container flex items-center justify-center py-6 text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
        <span>{t('brand.footer')}</span>
      </div>
    </footer>
  );
}
