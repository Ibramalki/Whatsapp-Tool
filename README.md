# WhatsApp CRM Tool

أداة داخلية لإدارة العملاء وإرسال رسائل WhatsApp عبر WaSenderAPI.

## المتطلبات

- Node.js 18+
- حساب Supabase
- مفتاح WaSenderAPI

## الإعداد

### 1. متغيرات البيئة

انسخ `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

ثم عبّئ القيم:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WASENDER_API_KEY=your-wasender-api-key
```

### 2. قاعدة البيانات (Supabase)

شغّل ملفات الـ migration بالترتيب في Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rpc_functions.sql
```

### 3. تشغيل محلياً

```bash
npm install
npm run dev
```

## الـ Deploy على Vercel

1. ارفع المشروع على GitHub
2. اربطه بـ Vercel
3. أضف متغيرات البيئة في Vercel Dashboard
4. `vercel deploy`

## بنية المشروع

```
├── src/                  # React frontend
│   ├── pages/           # صفحات التطبيق
│   ├── components/      # مكونات UI
│   ├── lib/             # Supabase + API utilities
│   └── types/           # TypeScript types
├── api/                  # Vercel API routes
│   ├── send.ts          # إرسال رسالة فردية
│   ├── queue/process.ts # معالجة قائمة الإرسال
│   └── campaigns/[id]/start.ts  # بدء حملة
└── supabase/migrations/ # SQL migrations
```

## صيغة ملف CSV

```csv
name,phone,grade
أحمد محمد,966501234567,الصف العاشر
سارة علي,966507654321,الصف التاسع
```

## متغيرات القوالب

- `{{name}}` — اسم العميل
- `{{phone}}` — رقم العميل
- `{{grade}}` — صف العميل
