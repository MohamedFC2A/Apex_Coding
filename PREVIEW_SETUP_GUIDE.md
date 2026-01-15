# دليل إعداد Live Preview

## المشكلة الشائعة
الـ Live Preview لا يعمل بسبب عدم تكوين مفتاح CodeSandbox API بشكل صحيح.

## الحل النهائي

### الخطوة 1: الحصول على مفتاح CodeSandbox API
1. انتقل إلى: [https://codesandbox.io/dashboard/settings/api-keys](https://codesandbox.io/dashboard/settings/api-keys)
2. سجل الدخول بحساب CodeSandbox (يمكنك إنشاء حساب مجاني)
3. انقر على "Create API Key"
4. أدخل اسمًا للمفتاح (مثل "Apex Coding Preview")
5. انسخ المفتاح (يبدأ بـ `csb_v1_...`)

### الخطوة 2: تحديث ملف البيئة
1. افتح ملف `.env` في مجلد المشروع الرئيسي
2. ابحث عن السطر: `CSB_API_KEY="csb_v1_REPLACE_ME"`
3. استبدل `csb_v1_REPLACE_ME` بالمفتاح الذي نسخته (بدون علامات الاقتباس)
4. احفظ الملف

مثال:
```env
CSB_API_KEY=csb_v1_abcdefghijklmnopqrstuvwxyz123456
```

### الخطوة 3: إعادة تشغيل الخادم
1. أوقف خادم التطوير (إذا كان يعمل)
2. أعد تشغيل الخادم:
   ```bash
   npm run dev
   ```
   أو
   ```bash
   npm start
   ```

### الخطوة 4: التحقق من التكوين
1. افتح تطبيق Apex Coding
2. انقر على "Check Configuration" في نافذة Preview
3. تأكد من ظهور "All systems operational"

## ميزات النظام المحسّن

### 1. رسائل خطأ واضحة
- الآن تظهر رسائل خطأ مفصلة تساعدك على فهم المشكلة
- إرشادات خطوة بخطوة لإصلاح المشكلة
- روابط مباشرة لصفحة API Keys

### 2. صفحة تشخيص متكاملة
- فحص حالة اتصال CodeSandbox API
- عرض معلومات المفتاح (آخر 4 أحرف)
- فحص حالة الخادم والبيئة
- إرشادات استكشاف الأخطاء وإصلاحها

### 3. Simple Preview (بديل احتياطي)
- يعمل بدون CodeSandbox API
- يدعم HTML/CSS/JS الأساسي
- تحديث مباشر عند تغيير الملفات
- مناسب للمشاريع البسيطة

### 4. تحسينات الأداء
- تقليل وقت الانتظار من 3 دقائق إلى 90 ثانية
- تقدم مرئي أثناء التحميل
- فحص التكوين قبل بدء الجلسة

## استكشاف الأخطاء الشائعة

### الخطأ: "CodeSandbox API key is not configured"
**الحل:** تأكد من إضافة `CSB_API_KEY` إلى ملف `.env`

### الخطأ: "Invalid CodeSandbox API key"
**الحل:** 
1. تأكد من نسخ المفتاح كاملًا
2. تأكد من عدم وجود مسافات في بداية أو نهاية المفتاح
3. جدد المفتاح من CodeSandbox إذا انتهت صلاحيته

### الخطأ: "Preview timeout after 90 seconds"
**الحل:**
1. تحقق من اتصال الإنترنت
2. حاول مرة أخرى بعد بضع دقائق
3. تأكد من أن مشروعك يحتوي على `package.json` مع scripts صحيحة

### الخطأ: "Failed to start development server"
**الحل:**
1. تأكد من وجود `package.json` في مشروعك
2. تأكد من وجود script `dev` أو `start` في `package.json`
3. تأكد من أن الكود لا يحتوي على أخطاء تمنع تشغيل الخادم

## نصائح إضافية

### للمشاريع البسيطة (HTML/CSS/JS فقط)
- يمكنك استخدام Simple Preview بدون تكوين CodeSandbox
- أضف ملف `index.html` كمحتوى رئيسي
- النظام سيقوم بحقن CSS وJS تلقائيًا

### للمشاريع المعقدة (React/Vue/إلخ)
- تحتاج إلى تكوين CodeSandbox API
- تأكد من وجود `package.json` مع dependencies صحيحة
- تأكد من أن script `dev` يعمل بشكل صحيح

### للاستخدام في Production
- أضف `CSB_API_KEY` إلى متغيرات البيئة في Vercel/Railway/إلخ
- استخدم مفتاح API منفصل للبيئة Production
- قم بتحديث `VITE_BACKEND_URL` ليشير إلى backend الخاص بك

## دعم إضافي
إذا استمرت المشكلة:
1. افتح صفحة التشخيص (Check Configuration)
2. افحص رسائل الخطأ بالتفصيل
3. تأكد من اتباع جميع الخطوات أعلاه
4. إذا لزم الأمر، أعد إنشاء مفتاح API جديد من CodeSandbox

## ملاحظات
- CodeSandbox يوفر 50 ساعة مجانية شهريًا
- المفاتيح صالحة لمدة سنة واحدة
- يمكنك إنشاء مفاتيح متعددة لمشاريع مختلفة
- Simple Preview مناسب للعرض السريع ولكن CodeSandbox يوفر بيئة كاملة مع npm install وتشغيل الخادم