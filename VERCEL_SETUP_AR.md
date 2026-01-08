# دليل نشر المشروع على Vercel

## المشكلة الحالية
خطأ 405 يعني أن الـ API غير مُعد بشكل صحيح على Vercel.

## الحل: إعداد المتغيرات البيئية على Vercel

### الخطوة 1: افتح إعدادات المشروع على Vercel
1. اذهب إلى https://vercel.com/dashboard
2. اختر مشروعك: **apex-coding**
3. اضغط على **Settings** (الإعدادات)
4. اختر **Environment Variables** من القائمة الجانبية

### الخطوة 2: أضف المتغيرات التالية

أضف كل متغير من المتغيرات التالية واحداً تلو الآخر:

#### متغيرات الـ Backend (مطلوبة)
```
DEEPSEEK_API_KEY
القيمة: sk-abdd5c2f95804095bf94338040ac74a8

DEEPSEEK_BASE_URL
القيمة: https://api.deepseek.com

DEEPSEEK_MODEL
القيمة: deepseek-chat

DEEPSEEK_THINKING_MODEL
القيمة: deepseek-reasoner
```

#### متغيرات الـ Frontend (مطلوبة)
```
NEXT_PUBLIC_BACKEND_URL
القيمة: /api

VITE_DEEPSEEK_API_KEY
القيمة: sk-abdd5c2f95804095bf94338040ac74a8

VITE_DEEPSEEK_BASE_URL
القيمة: https://api.deepseek.com

VITE_DEEPSEEK_MODEL
القيمة: deepseek-chat

VITE_DEEPSEEK_THINKING_MODEL
القيمة: deepseek-reasoner
```

### الخطوة 3: اختر البيئات (Environments)
عند إضافة كل متغير، تأكد من تحديد:
- ✅ Production
- ✅ Preview
- ✅ Development

### الخطوة 4: أعد النشر (Redeploy)
بعد إضافة جميع المتغيرات:

1. اذهب إلى تبويب **Deployments**
2. اضغط على النقاط الثلاث (⋮) بجانب آخر نشر
3. اختر **Redeploy**
4. انتظر حتى ينتهي النشر (عادة 1-2 دقيقة)

### الخطوة 5: اختبر الموقع
1. افتح https://apex-coding.vercel.app
2. جرب استخدام **Architect Mode**
3. يجب أن يعمل الآن بدون خطأ 405

## ملاحظات مهمة

### الفرق بين التطوير المحلي والإنتاج
- **محلياً**: يستخدم `http://localhost:3001/api`
- **على Vercel**: يستخدم `/api` (مسار نسبي)

### إذا استمرت المشكلة
1. تحقق من سجلات النشر (Deployment Logs):
   - اذهب إلى Deployments → اضغط على آخر نشر
   - افتح تبويب **Function Logs**
   - ابحث عن أي أخطاء

2. تأكد من أن مفتاح الـ API صحيح وغير منتهي الصلاحية

3. تأكد من أن ملف `vercel.json` موجود في الجذر

## الملفات المُحدثة
تم تحديث الملفات التالية لإصلاح المشكلة:
- ✅ `vercel.json` - إعدادات التوجيه للـ API
- ✅ `frontend/.env.production` - إعدادات الإنتاج
- ✅ `.env` - المتغيرات البيئية المحلية

## الخطوة التالية
ارفع التغييرات إلى GitHub:
```bash
git add .
git commit -m "Fix Vercel API routing and environment variables"
git push origin main
```

سيتم النشر تلقائياً على Vercel بعد الـ push.
