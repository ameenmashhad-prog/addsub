# لعبة النقاط — خطوات النشر (مجاني بالكامل)

## الخطوة 1: إنشاء قاعدة بيانات Supabase مجانية

1. افتح https://supabase.com واعمل حساب (بريد إلكتروني أو GitHub).
2. اضغط **New Project**، اختر اسم (مثلاً `points-game`)، وكلمة مرور لقاعدة البيانات، والمنطقة الأقرب لك، ثم أنشئ المشروع.
3. انتظر حوالي دقيقتين حتى يجهز المشروع.
4. من القائمة الجانبية افتح **SQL Editor** → **New query**، الصق محتوى ملف `supabase_schema.sql` المرفق بالكامل، ثم اضغط **Run**.
5. من القائمة الجانبية افتح **Project Settings → API**. انسخ:
   - **Project URL**
   - **anon public key**

## الخطوة 2: تجهيز الكود محلياً (اختياري للتجربة قبل النشر)

```bash
npm install
cp .env.example .env
# افتح .env وضع فيه القيم اللي نسختها من Supabase
npm run dev
```

## الخطوة 3: رفع الكود على GitHub

1. أنشئ مستودع جديد فارغ على https://github.com (مثلاً باسم `points-game`).
2. من مجلد المشروع:

```bash
git init
git add .
git commit -m "لعبة النقاط - نسخة أولى"
git branch -M main
git remote add origin https://github.com/USERNAME/points-game.git
git push -u origin main
```

> ملاحظة: ملف `.env` لن يُرفع تلقائياً (موجود في `.gitignore`) لحمايته — وهذا مطلوب.

## الخطوة 4: النشر على Vercel (مجاني)

1. افتح https://vercel.com وسجّل دخول بحساب GitHub.
2. اضغط **Add New → Project**، واختر مستودع `points-game`.
3. Vercel سيكتشف تلقائياً أنه مشروع Vite (Framework Preset: Vite) — لا حاجة لتغيير شيء.
4. قبل الضغط على Deploy، افتح قسم **Environment Variables** وأضف:
   - `VITE_SUPABASE_URL` = رابط مشروعك في Supabase
   - `VITE_SUPABASE_ANON_KEY` = المفتاح العام (anon key)
5. اضغط **Deploy** وانتظر حوالي دقيقة.
6. بعد الانتهاء، Vercel يعطيك رابط مباشر مثل: `points-game.vercel.app` — هذا الرابط تشاركه مع الجميع.

## كيف يعمل بعد النشر

- كل من يفتح الرابط يختار: **مسؤول اللعبة** أو **مشاهدة فقط**.
- بيانات اللعبة محفوظة في Supabase، فالتحديثات تصل فوراً لكل من يفتح شاشة "مشاهدة" بفضل Realtime.
- لتحديث الفئات/الأسماء لاحقاً: عدّلها من داخل التطبيق نفسه (تبويب "الإدارة")، لا حاجة لإعادة نشر الكود.
- إذا حبيت تعمل تعديل على تصميم أو آلية اللعبة لاحقاً: عدّل الكود في GitHub، وVercel هينشر التحديث تلقائياً بمجرد ما تعمل push.
