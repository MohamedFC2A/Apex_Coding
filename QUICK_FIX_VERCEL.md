# حل سريع لخطأ 405 على Vercel

## الخطوات (5 دقائق فقط)

### 1️⃣ افتح Vercel Dashboard
اذهب إلى: https://vercel.com/dashboard

### 2️⃣ اختر المشروع
اضغط على مشروع **apex-coding**

### 3️⃣ افتح Environment Variables
Settings → Environment Variables

### 4️⃣ أضف هذه المتغيرات (انسخ والصق)

اضغط "Add New" لكل متغير:

**المتغير الأول:**
```
Name: DEEPSEEK_API_KEY
Value: sk-abdd5c2f95804095bf94338040ac74a8
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير الثاني:**
```
Name: DEEPSEEK_BASE_URL
Value: https://api.deepseek.com
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير الثالث:**
```
Name: DEEPSEEK_MODEL
Value: deepseek-chat
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير الرابع:**
```
Name: DEEPSEEK_THINKING_MODEL
Value: deepseek-reasoner
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير الخامس:**
```
Name: VITE_DEEPSEEK_API_KEY
Value: sk-abdd5c2f95804095bf94338040ac74a8
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير السادس:**
```
Name: VITE_DEEPSEEK_BASE_URL
Value: https://api.deepseek.com
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير السابع:**
```
Name: VITE_DEEPSEEK_MODEL
Value: deepseek-chat
Environments: ✅ Production ✅ Preview ✅ Development
```

**المتغير الثامن:**
```
Name: VITE_DEEPSEEK_THINKING_MODEL
Value: deepseek-reasoner
Environments: ✅ Production ✅ Preview ✅ Development
```

### 5️⃣ أعد النشر (Redeploy)
1. اذهب إلى تبويب **Deployments**
2. اضغط على النقاط الثلاث (⋮) بجانب آخر deployment
3. اختر **Redeploy**
4. انتظر دقيقة واحدة

### 6️⃣ اختبر الموقع
افتح: https://apex-coding.vercel.app
جرب Architect Mode - يجب أن يعمل الآن! ✅

---

## إذا استمر الخطأ

تحقق من Function Logs:
1. Deployments → اضغط على آخر deployment
2. افتح تبويب "Function Logs"
3. ابحث عن رسالة الخطأ

## ملاحظة مهمة
تأكد من تحديد **جميع البيئات** (Production, Preview, Development) لكل متغير!
