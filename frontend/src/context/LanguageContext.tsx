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
    'demo.title': 'Interactive Demo',
    'demo.subtitle': 'Experience the future of graph-based coding.',
    'demo.back': 'Back to Home',
    'demo.status': 'Interactive Preview Environment',
    'demo.loading': 'Initializing Demo Environment...',
    
    // UI Helpers
    'ui.search.placeholder': '✨ Click the search bar or press Enter to start coding',
    'ui.viewPricing': 'View Pricing',
    'ui.techStack': '+ Next.js, Tailwind, Framer Motion',

    // Brand
    'brand.name': 'Apex Coding',
    'brand.tagline': 'Code at the Speed of Thought',
    'brand.footer': '© 2026 Apex Coding | AI-Powered Developer Platform',

    // Pricing & Plans
    'pricing.title': 'Choose Your Plan',
    'pricing.subtitle': 'Start building with our graph-based AI IDE. Upgrade anytime for more power.',
    'pricing.free.name': 'FREE',
    'pricing.free.desc': 'Perfect for trying out Apex Coding',
    'pricing.pro.name': 'PRO',
    'pricing.pro.desc': 'For serious developers building at scale',
    'pricing.enterprise.name': 'ENTERPRISE',
    'pricing.enterprise.desc': 'For teams and organizations',
    'pricing.popular': 'MOST POPULAR',
    'pricing.current': 'Current Plan',
    'pricing.cta.free': 'Start Free',
    'pricing.cta.pro': 'Upgrade to Pro',
    'pricing.cta.enterprise': 'Contact Sales',
    'pricing.promo.title': 'Have a promo code?',
    'pricing.promo.placeholder': 'Enter code',
    'pricing.promo.apply': 'Apply',
    'pricing.promo.success': 'Promo code applied!',
    'pricing.promo.error': 'Invalid promo code',
    'pricing.openIde': 'Open IDE',

    // IDE Sidebar & Panels
    'app.sidebar.files': 'Files',
    'app.sidebar.history': 'History',
    'app.sidebar.settings': 'Settings',
    'app.chat.placeholder': 'Type a message...',
    'app.chat.send': 'Send',
    'app.plan.title': 'Implementation Plan',
    'app.plan.step': 'Step',
    'app.plan.working': 'Working on it...',
    'app.plan.done': 'Completed',
    'app.plan.pending': 'Pending',
    'app.terminal.title': 'Terminal',
    'app.editor.title': 'Editor',
    'app.editor.ready': 'Ready',
    'app.editor.loading': 'Loading editor...',
    'app.editor.welcome': 'Welcome to Apex Editor',
    'app.editor.welcomeDesc': 'Generate code with AI to see it here',
    'app.editor.run': 'Run',
    'app.editor.download': 'Download',
    'app.mode.fast': 'Fast Mode',
    'app.mode.thinking': 'Thinking Mode',
    'app.mode.architect': 'Architect Mode',

    // Workspace & Prompt Panel
    'app.workspace.title': 'AI Workspace',
    'app.workspace.promptLabel': 'Your Prompt',
    'app.workspace.promptPlaceholder': 'Describe your software idea in detail...\n\nExamples:\n• Create a todo app with React and TypeScript\n• Build a REST API with Node.js, Express, and MongoDB\n• Make a portfolio website with HTML, CSS, and JavaScript\n• Develop a chat application using Python Flask and WebSockets\n\nBe specific about features, design, and functionality.',
    'app.workspace.settings': 'Model Settings',
    'app.workspace.thinkingMode': 'Thinking Mode',
    'app.workspace.modeFast': 'Fast',
    'app.workspace.modeThinking': 'Thinking',
    'app.workspace.modeSuper': 'Super-Thinking (Beta)',
    'app.workspace.modeDescriptionFast': 'Uses configured DeepSeek model (fast response)',
    'app.workspace.modeDescriptionThinking': 'Uses DeepSeek Reasoner (slower but more detailed)',
    'app.workspace.modeDescriptionSuper': 'Hybrid engine: fast blueprint + deep reasoning',
    'app.workspace.provider': 'Provider',
    'app.workspace.generate': 'Generate Full Code',
    'app.workspace.resume': 'Resume Generation',
    'app.workspace.generating': 'Generating...',
    'app.workspace.trace': 'Decision Trace',
    'app.workspace.errorConfig': 'The browser never sees your key. Configure DEEPSEEK_API_KEY on the backend (Vercel env vars or backend/.env).',

    // Generation Statuses
    'app.plan.status.initializing': 'Initializing...',
    'app.plan.status.thinking': 'Thinking...',
    'app.plan.status.working': 'Generating code...',
    'app.plan.status.validating': 'Validating output...',
    'app.plan.status.complete': 'Generation Complete',
    'app.plan.status.deepThinking': 'Thinking deeply...',
    'app.plan.status.reasoning': 'Reasoning...'
  },
  ar: {
    // Hero Section
    'hero.title': 'طور بسرعة التفكير مع أبيكس كودينج.',
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
    'feature.graph.body': 'يقوم أبيكس كودينج بتخطيط المستودع الخاص بك في رسم بياني قابل للتصفح حتى يتمكن الذكاء الاصطناعي من الاستدلال حول البنية والتبعيات والغرض.',
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
    'lead.subtitle': 'انضم إلى قائمة الانتظار للحصول على تحديثات أبيكس كودينج والوصول عند الإطلاق.',
    'lead.email.label': 'البريد الإلكتروني',
    'lead.email.placeholder': 'you@company.com',
    'lead.cta': 'انضم لقائمة الانتظار',
    'lead.success': 'تم الحفظ. سنتواصل معك قريباً.',
    
    // Demo Section
    'demo.title': 'عرض توضيحي تفاعلي',
    'demo.subtitle': 'اختبر مستقبل البرمجة القائمة على الرسوم البيانية.',
    'demo.back': 'العودة للرئيسية',
    'demo.status': 'بيئة العرض التفاعلية',
    'demo.loading': 'جاري تهيئة بيئة العرض...',
    
    // UI Helpers
    'ui.search.placeholder': '✨ انقر على شريط البحث أو اضغط Enter لبدء البرمجة',
    'ui.viewPricing': 'عرض الأسعار',
    'ui.techStack': '+ Next.js, Tailwind, Framer Motion',

    // Brand
    'brand.name': 'أبيكس كودينج',
    'brand.tagline': 'طور بسرعة التفكير',
    'brand.footer': '© 2026 أبيكس كودينج | منصة تطوير مدعومة بالذكاء الاصطناعي',

    // Pricing & Plans
    'pricing.title': 'اختر خطتك',
    'pricing.subtitle': 'ابدأ البناء باستخدام بيئة التطوير القائمة على الرسوم البيانية. قم بالترقية في أي وقت لمزيد من القوة.',
    'pricing.free.name': 'مجاني',
    'pricing.free.desc': 'مثالي لتجربة أبيكس كودينج',
    'pricing.pro.name': 'برو',
    'pricing.pro.desc': 'للمطورين الجادين الذين يبنون بمقياس واسع',
    'pricing.enterprise.name': 'مؤسسات',
    'pricing.enterprise.desc': 'للفرق والمنظمات',
    'pricing.popular': 'الأكثر شيوعاً',
    'pricing.current': 'الخطة الحالية',
    'pricing.cta.free': 'ابدأ مجاناً',
    'pricing.cta.pro': 'ترقية إلى برو',
    'pricing.cta.enterprise': 'اتصل بالمبيعات',
    'pricing.promo.title': 'لديك كود خصم؟',
    'pricing.promo.placeholder': 'أدخل الكود',
    'pricing.promo.apply': 'تطبيق',
    'pricing.promo.success': 'تم تطبيق كود الخصم!',
    'pricing.promo.error': 'كود خصم غير صالح',
    'pricing.openIde': 'افتح بيئة التطوير',

    // IDE / App
    'app.header.status.working': 'جاري العمل…',
    'app.header.status.stopped': 'متوقف',
    'app.header.status.ready': 'جاهز',
    'app.header.untitled': 'مشروع بدون عنوان',
    'app.header.preview.open': 'فتح العرض',
    'app.header.preview.close': 'إغلاق العرض',

    // IDE Sidebar & Panels
    'app.sidebar.files': 'الملفات',
    'app.sidebar.history': 'السجل',
    'app.sidebar.settings': 'الإعدادات',
    'app.chat.placeholder': 'اكتب رسالة...',
    'app.chat.send': 'إرسال',
    'app.plan.title': 'خطة التنفيذ',
    'app.plan.step': 'خطوة',
    'app.plan.working': 'جاري العمل عليها...',
    'app.plan.done': 'مكتمل',
    'app.plan.pending': 'قيد الانتظار',
    'app.terminal.title': 'الطرفية',
    'app.editor.title': 'المحرر',
    'app.editor.ready': 'جاهز',
    'app.editor.loading': 'جاري تحميل المحرر...',
    'app.editor.welcome': 'مرحباً بك في محرر أبيكس',
    'app.editor.welcomeDesc': 'ولد الكود بالذكاء الاصطناعي لرؤيته هنا',
    'app.editor.run': 'تشغيل',
    'app.editor.download': 'تحميل',
    'app.mode.fast': 'الوضع السريع',
    'app.mode.thinking': 'وضع التفكير',
    'app.mode.architect': 'وضع المهندس',

    // Workspace & Prompt Panel
    'app.workspace.title': 'بيئة عمل الذكاء الاصطناعي',
    'app.workspace.promptLabel': 'طلبك',
    'app.workspace.promptPlaceholder': 'صف فكرة برنامجك بالتفصيل...\n\nأمثلة:\n• إنشاء تطبيق مهام باستخدام React و TypeScript\n• بناء واجهة برمجة تطبيقات REST باستخدام Node.js و Express و MongoDB\n• إنشاء موقع محفظة أعمال باستخدام HTML و CSS و JavaScript\n• تطوير تطبيق دردشة باستخدام Python Flask و WebSockets\n\nكن محددًا بشأن الميزات والتصميم والوظائف.',
    'app.workspace.settings': 'إعدادات النموذج',
    'app.workspace.thinkingMode': 'وضع التفكير',
    'app.workspace.modeFast': 'سريع',
    'app.workspace.modeThinking': 'تفكير',
    'app.workspace.modeSuper': 'تفكير فائق (بيتا)',
    'app.workspace.modeDescriptionFast': 'يستخدم نموذج DeepSeek المكون (استجابة سريعة)',
    'app.workspace.modeDescriptionThinking': 'يستخدم DeepSeek Reasoner (أبطأ ولكن أكثر تفصيلاً)',
    'app.workspace.modeDescriptionSuper': 'محرك هجين: مخطط سريع + تفكير عميق',
    'app.workspace.provider': 'المزود',
    'app.workspace.generate': 'إنشاء الكود بالكامل',
    'app.workspace.resume': 'استئناف الإنشاء',
    'app.workspace.generating': 'جاري الإنشاء...',
    'app.workspace.trace': 'تتبع القرار',
    'app.workspace.errorConfig': 'المتصفح لا يرى مفتاحك أبدًا. قم بتكوين DEEPSEEK_API_KEY في الخلفية (متغيرات بيئة Vercel أو backend/.env).',

    // Generation Statuses
    'app.plan.status.initializing': 'جاري التهيئة...',
    'app.plan.status.thinking': 'جاري التفكير...',
    'app.plan.status.working': 'جاري إنشاء الكود...',
    'app.plan.status.validating': 'جاري التحقق من المخرجات...',
    'app.plan.status.complete': 'اكتمل الإنشاء',
    'app.plan.status.deepThinking': 'جاري التفكير بعمق...',
    'app.plan.status.reasoning': 'جاري الاستنتاج...'
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
