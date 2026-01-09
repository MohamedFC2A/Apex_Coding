'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type TranslationKey = string;
type Translations = Record<TranslationKey, string>;

const translations: Record<Language, Translations> = {
  en: {
    // Hero Section
    'hero.title': 'Code at the Speed of Thought with Apex Coding.',
    'hero.subtitle': 'The first Graph-Based AI IDE that understands your project structure, not just your files.',
    'hero.cta.start': 'Start Coding Free',
    'hero.cta.demo': 'Watch Demo',
    'hero.badge': 'Built for Developers',
    'hero.powered': 'Powered by',
    'hero.loading': 'Starting…',
    
    // Typing Search Phrases
    'search.phrase1': 'Build a SaaS...',
    'search.phrase2': 'Design a Portfolio...',
    'search.phrase3': 'Create AI Chatbot...',
    'search.phrase4': 'Launch E-commerce...',
    'search.phrase5': 'Develop Mobile App...',
    
    // Feature Cards
    'feature.graph.title': 'Graph-Based Understanding',
    'feature.graph.body': 'Apex Coding maps your repo into a navigable graph so the AI reasons about structure, dependencies, and intent.',
    'feature.persistence.title': 'Keystroke Persistence',
    'feature.persistence.body': 'Every edit is captured in real time — refresh without fear. Convex-backed project state keeps you moving.',
    'feature.feedback.title': 'Instant Feedback',
    'feature.feedback.body': 'Skeleton loaders, streaming output, and a floating plan keep progress visible and perceived performance high.',
    
    // Value Prop
    'value.context.title': 'Graph context, not file guessing',
    'value.context.body': 'Understand structure, dependencies, and intent—so edits land in the right place.',
    'value.streaming.title': 'Streaming generation with recovery',
    'value.streaming.body': 'SSE streaming, stall detection, auto-retry, and resume keeps progress moving under real-world latency.',
    'value.persistence.title': 'Convex-backed persistence',
    'value.persistence.body': 'Project state syncs to the database so refreshes do not wipe your work.',
    
    // Lead Capture
    'lead.title': 'Get early access',
    'lead.subtitle': 'Join the waitlist for Apex Coding updates and launch access.',
    'lead.email.label': 'Email',
    'lead.email.placeholder': 'you@company.com',
    'lead.cta': 'Join waitlist',
    'lead.success': 'Saved. We will reach out soon.',
    
    // Demo Section
    'demo.title': 'Demo',
    'demo.subtitle': 'Add your demo video embed here.',
    
    // UI Helpers
    'ui.search.placeholder': '✨ Click the search bar or press Enter to start coding',
    'ui.viewPricing': 'View Pricing',
    'ui.techStack': '+ Next.js, Tailwind, Framer Motion',

    // Brand
    'brand.name': 'Apex Coding',
    'brand.tagline': 'Code at the Speed of Thought'
  },
  ar: {
    // Hero Section
    'hero.title': 'طور بسرعة التفكير مع نيكسس أبكس.',
    'hero.subtitle': 'أول بيئة تطوير ذكاء اصطناعي قائمة على الرسوم البيانية تفهم بنية مشروعك، وليس فقط ملفاتك.',
    'hero.cta.start': 'ابدأ البرمجة مجاناً',
    'hero.cta.demo': 'شاهد العرض التوضيحي',
    'hero.badge': 'مصمم للمطورين',
    'hero.powered': 'مدعوم بواسطة',
    'hero.loading': 'جاري التشغيل…',
    
    // Typing Search Phrases
    'search.phrase1': 'بناء منصة SaaS...',
    'search.phrase2': 'تصميم محفظة أعمال...',
    'search.phrase3': 'إنشاء روبوت محادثة ذكي...',
    'search.phrase4': 'إطلاق متجر إلكتروني...',
    'search.phrase5': 'تطوير تطبيق جوال...',
    
    // Feature Cards
    'feature.graph.title': 'فهم قائم على الرسوم البيانية',
    'feature.graph.body': 'يقوم نيكسس أبكس بتخطيط المستودع الخاص بك في رسم بياني قابل للتصفح حتى يتمكن الذكاء الاصطناعي من الاستدلال حول البنية والتبعيات والغرض.',
    'feature.persistence.title': 'استمرارية فورية',
    'feature.persistence.body': 'يتم التقاط كل تعديل في الوقت الفعلي - قم بالتحديث دون خوف. حالة المشروع المدعومة من Convex تبقيك في التقدم.',
    'feature.feedback.title': 'ردود فعل فورية',
    'feature.feedback.body': 'محملات الهيكل العظمي، والإخراج المتدفق، والخطة العائمة تحافظ على التقدم مرئياً والأداء المدرك عالياً.',
    
    // Value Prop
    'value.context.title': 'سياق الرسم البياني، وليس تخمين الملفات',
    'value.context.body': 'فهم البنية والتبعيات والغرض - حتى تصل التعديلات إلى المكان الصحيح.',
    'value.streaming.title': 'توليد متدفق مع الاسترداد',
    'value.streaming.body': 'تدفق SSE، اكتشاف التوقف، إعادة المحاولة التلقائية، والاستئناف يحافظ على التقدم يتحرك تحت زمن الاستجابة الحقيقي.',
    'value.persistence.title': 'استمرارية مدعومة من Convex',
    'value.persistence.body': 'يتم مزامنة حالة المشروع مع قاعدة البيانات حتى لا تمسح عمليات التحديث عملك.',
    
    // Lead Capture
    'lead.title': 'احصل على وصول مبكر',
    'lead.subtitle': 'انضم إلى قائمة الانتظار للحصول على تحديثات نيكسس أبكس والوصول عند الإطلاق.',
    'lead.email.label': 'البريد الإلكتروني',
    'lead.email.placeholder': 'you@company.com',
    'lead.cta': 'انضم لقائمة الانتظار',
    'lead.success': 'تم الحفظ. سنتواصل معك قريباً.',
    
    // Demo Section
    'demo.title': 'العرض التوضيحي',
    'demo.subtitle': 'أضف فيديو العرض التوضيحي الخاص بك هنا.',
    
    // UI Helpers
    'ui.search.placeholder': '✨ انقر على شريط البحث أو اضغط Enter لبدء البرمجة',
    'ui.viewPricing': 'عرض الأسعار',
    'ui.techStack': '+ Next.js, Tailwind, Framer Motion',

    // Brand
    'brand.name': 'نيكسس أبكس',
    'brand.tagline': 'طور بسرعة التفكير'
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('apex-coding-language') as Language | null;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLanguageState(saved);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('apex-coding-language', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }
  }, [language, mounted]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
