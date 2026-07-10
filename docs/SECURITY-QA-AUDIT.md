# تقرير فحص الجودة والأمن — Adrenaline Meals Manager

**تاريخ الفحص:** 2026-07-10
**النطاق:** الموقع العام `https://adrenalinehealthy.com` · لوحة التحكم · واجهات Convex · خادم Express القديم · جسر البصمة
**المُنفِّذ:** فحص يدوي + أدوات آلية (تفاصيل الأدوات في §2)

---

## 1. الملخص التنفيذي

| المحور | التقدير | أبرز نقطة |
|---|---|---|
| **الأمن — التخويل** | 🟢 جيد (بعد إصلاحات اليوم) | 76 دالة كانت مكشوفة، أُغلقت وتم التحقق منها |
| **الأمن — البنية التحتية** | 🔴 ضعيف | لا CSP ولا X-Frame-Options؛ التوكن في `localStorage` |
| **الأمن — المصادقة** | 🟠 متوسط | لا حدّ لمحاولات الدخول؛ 4 حسابات بهاش قديم ضعيف |
| **الأداء** | 🟠 متوسط | 103KB رسوم بيانية تُحمَّل على الصفحة العامة بلا داعٍ؛ صور 26MB |
| **جودة الكود** | 🔴 ضعيف | 140 خطأ أنواع؛ خادم Express كامل ميت وغير قابل للترجمة |
| **الاختبارات** | 🔴 معدوم | صفر اختبارات، لا إطار عمل، لا CI |
| **الوصولية** | 🟠 متوسط | تباين اللون الأساسي 2.03:1 (المطلوب 4.5:1) |

### أخطر 5 نقاط (تفاصيلها في §4)
1. **`SEC-01`** — توكن جلسة الموظف في `localStorage` + لا CSP → أي XSS = استيلاء كامل على لوحة التحكم.
2. **`SEC-02`** — لا حدّ لمحاولات تسجيل الدخول → تخمين كلمات المرور بلا مانع.
3. **`SEC-03`** — مفاتيح `.env` ما زالت في تاريخ Git (`ca3cc04`).
4. **`QUA-01`** — طبقة Express كاملة (`server/`) ميتة ولا تُترجم: 140 خطأ أنواع تجعل `npm run check` أحمر دائماً.
5. **`SEC-04`** — `ai.chat` و`customerOrders.create` و`ratings.create` عامة بلا حدّ معدّل → استنزاف رصيد Anthropic وطلبات/تقييمات وهمية.

---

## 2. إطار العمل والأدوات

### ما نُفِّذ فعلاً
| الأداة | الاستخدام | النتيجة |
|---|---|---|
| `npm audit` | ثغرات الاعتماديات | 19 ثغرة (9 عالية) |
| `npx tsc --noEmit` | التحليل الساكن | 144 خطأ |
| `curl -I` | ترويسات الأمان | 5 ترويسات مفقودة |
| `npx convex run` | اختبار التخويل مباشرة على الإنتاج | تم رفض كل الدوال المحميّة |
| متصفح آلي | تدفقات وظيفية حقيقية | تتبّع الطلب، المنيو، الخطة الذكية |
| مراجعة مصدر موجَّهة | XSS / أسرار / CORS | مصدر XSS واحد محتمل |

### ⚠️ ما **لم** يُنفَّذ — لا تعتبره مفحوصاً
| البند المطلوب | الحالة | السبب |
|---|---|---|
| **Lighthouse** (LCP/CLS/TBT) | ❌ لم يُشغَّل | غير متاح في هذه البيئة — الأرقام أدناه أحجام حمولة مقيسة، لا Core Web Vitals |
| **Burp Suite / DAST** | ❌ لم يُشغَّل | يحتاج proxy وتفويض اختبار اختراق صريح |
| **Snyk** | ❌ لم يُشغَّل | `npm audit` استُخدم بديلاً |
| **اختبار التحمّل / التزامن** | ❌ لم يُنفَّذ | إطلاق حمل على الإنتاج يحتاج إذنك — الخادم الوحيد هو الإنتاج |
| **Safari / iOS / Android حقيقي** | ❌ لم يُختبر | لا أجهزة؛ الملاحظات أدناه من قراءة الكود لا من تشغيل |
| **SQLi** | ⛔ غير قابل للتطبيق | لا SQL في المسار الحيّ (Convex = NoSQL، وDrizzle ميت) |
| **CSRF** | ⛔ مخاطر منخفضة بطبيعتها | Convex يمرّر التوكن في جسم الطلب لا في كوكي؛ لا كوكي جلسة |

---

## 3. نتائج القياس

### 3.1 الاعتماديات (`npm audit`)
```
critical: 0 | high: 9 | moderate: 7 | low: 3   (المجموع 19)
HIGH: drizzle-orm, express, lodash, path-to-regexp, picomatch, rollup, vite, ws
```
> معظم الحزم العالية (`drizzle-orm`, `express`, `path-to-regexp`, `body-parser`, `qs`) تخصّ **خادم Express الميت**. حذفه يُسقط أغلب الثغرات بلا عمل إضافي.

### 3.2 ترويسات الأمان (الموقع الحيّ)
```
✅ strict-transport-security: max-age=31536000
❌ content-security-policy      — مفقودة
❌ x-frame-options              — مفقودة  (قابل للتضمين في iframe → clickjacking)
❌ x-content-type-options       — مفقودة
❌ referrer-policy              — مفقودة
❌ permissions-policy           — مفقودة
```

### 3.3 الأداء — حمولة الصفحة الرئيسية (منقولة فعلياً، brotli)
| الملف | المنقول |
|---|---|
| `index.js` | 131 KB |
| **`vendor-charts.js`** | **103 KB** ← recharts، لا يُستخدم في أي صفحة عامة |
| `vendor-react.js` | 17 KB |
| `index.css` | 24 KB |
| **الإجمالي** | **~275 KB JS+CSS** |

**الصور:** مجلد `client/public` = **26 MB**. أثقل الملفات:
`plan-liyaqa-real.jpg` 2.3MB · `plan-tadkhim-real.png` 1.9MB · `plan-tanshif-real.png` 880KB
> ملفات `.png` بأحجام ميغابايتية لصور فوتوغرافية — الصيغة نفسها خطأ.

### 3.4 التحليل الساكن
```
أخطاء الأنواع: 144
  ├─ server/ + shared/ : 140   (97%)
  └─ client/ + convex/:   4    (iteration target فقط)
اختبارات:      0    (لا vitest، لا jest، لا playwright، لا سكربت test)
استخدام any:   ~635 في client/ · ~195 في convex/
```

---

## 4. الثغرات ومستويات الخطورة

| # | الخطورة | الثغرة | الدليل | تأثير الأعمال |
|---|---|---|---|---|
| **SEC-01** | 🔴 **عالية جداً** | توكن جلسة الموظف مخزَّن في `localStorage` عبر `zustand/persist` ولا يوجد CSP | `client/src/lib/store.ts:25` `persist(...)` — والتوكن في `sessionToken` | أي XSS (حتى في تعليق أو اسم وجبة) يسرق توكن مدير ⇒ سيطرة كاملة: قراءة 195 مشترك، حذف بيانات |
| **SEC-02** | 🔴 عالية | لا حدّ لمحاولات تسجيل الدخول ولا قفل حساب | `convex/auth.ts` — لا `attempts`/`lockout` | تخمين كلمات المرور آلياً بلا مانع. حساب ADMIN واحد ما زال بهاش `simpleHash` القابل للكسر فوراً |
| **SEC-03** | 🔴 عالية | `.env` في تاريخ Git | `git show ca3cc04:.env` | `VITE_SUPABASE_ANON_KEY` وروابط النشر مكشوفة لأي من يستنسخ الريبو |
| **SEC-04** | 🟠 متوسطة | دوال عامة بلا حدّ معدّل: `ai.chat`, `ai.generateSmartPlan`, `customerOrders.create`, `ratings.create`, `passwordReset.requestReset` | تم استدعاؤها بنجاح بلا توكن | **مالي:** حلقة على `ai.chat` تحرق رصيد Anthropic. **تشغيلي:** إغراق بطلبات وتقييمات وهمية، وإغراق بريد Resend |
| **SEC-05** | 🟠 متوسطة | 4 حسابات بهاش `simpleHash` (دالة 6 أسطر، غير مالحة) | `users`: 1 · `customerAccounts`: 3 | كسر فوري عند تسرّب قاعدة البيانات. أحدها **ADMIN** |
| **SEC-06** | 🟠 متوسطة | الجلسات لا تُبطَل عند تغيير/إعادة تعيين كلمة المرور، ومدتها 30 يوماً | `convex/sessions.ts:8` · `passwordReset.ts` | من سرق توكناً يظل داخلاً حتى بعد أن يغيّر الضحية كلمة مروره |
| **SEC-07** | 🟠 متوسطة | لا `X-Frame-Options` / `frame-ancestors` | §3.2 | Clickjacking: تضمين لوحة التحكم في iframe خفي |
| **SEC-08** | 🟡 منخفضة | لا حدّ أدنى لكلمة مرور الموظف عند الإنشاء | `convex/users.ts` `createUser` بلا فحص طول | كلمة مرور من حرف واحد مقبولة (الاستعادة تفرض 6 فقط) |
| **SEC-09** | 🟡 منخفضة | مصدر XSS محتمل | `client/src/components/ui/chart.tsx:79` `dangerouslySetInnerHTML` | المحتوى مولَّد من إعدادات ألوان داخلية لا من مدخلات مستخدم — مخاطرة نظرية |
| **PERF-01** | 🟠 متوسطة | 103KB من recharts على كل زيارة للموقع العام | §3.3 | تحميل أبطأ للعملاء على 3G، وتكلفة نطاق ترددي |
| **PERF-02** | 🟠 متوسطة | 26MB صور، ملفات PNG بميغابايتات | §3.3 | استهلاك باقة بيانات العميل، وضعف ترتيب SEO |
| **QUA-01** | 🔴 عالية | `server/` كله ميت وغير مترجَم (140 خطأ) — و`shared/schema.ts` استُبدل بمحتوى Convex بالغلط | تحققت: صفر نداءات `/api` من الفرونت | `npm run check` أحمر دائماً ⇒ **أخطاء أنواع حقيقية تمرّ بلا أن يلاحظها أحد** |
| **QUA-02** | 🟠 متوسطة | `throw err` بعد إرسال الرد | `server/index.ts:69-70` | يُسقط العملية عند أي خطأ (لو شُغِّل Express) |
| **QUA-03** | 🟠 متوسطة | قاعدة أيام التوصيل (سبت→أربعاء) مكرّرة في 3 ملفات بصيغ مختلفة | `subscriptionPause.ts:42` · `ai.ts:92` · `customerOrders.ts:437` | أهم قاعدة عمل بلا مصدر واحد ⇒ اختلاف = خسارة أيام العميل أو منحه أياماً مجاناً |
| **QUA-04** | 🟠 متوسطة | صفر اختبارات لدوال حسّاسة مالياً | لا إطار اختبار | حساب أيام التجميد، ساعات الأوفرتايم، مطابقة الأسماء — كلها بلا شبكة أمان |
| **A11Y-01** | 🟠 متوسطة | اللون الأساسي `#3CC4F0` تباينه على الأبيض **2.03:1** (المطلوب 4.5:1) | `PublicLayout.tsx:123,164,254` | أزرار "اشترك" و"تسجيل الدخول" غير مقروءة لضعاف البصر |
| **A11Y-02** | 🟠 متوسطة | بطاقات "تواصل معنا" عناصر `<div onClick>` بلا `role`/`tabIndex` | `ContactPage.tsx:89-97` | واتساب/اتصال/خريطة **غير قابلة للوصول بلوحة المفاتيح** |
| **A11Y-03** | 🟡 منخفضة | أزرار بأيقونة فقط بلا `aria-label` (القائمة، تسجيل الخروج، أسهم الكاروسيل) | `PublicLayout.tsx:91,150,169` | قارئ الشاشة لا ينطق شيئاً |
| **A11Y-04** | 🟡 منخفضة | صور بلا `width`/`height`/`loading="lazy"` | `HomePage.tsx:387` | إزاحة تخطيط (CLS) وتحميل مبكر |

---

## 5. سياسات جاهزة للنسخ

### 5.1 ترويسات الأمان — `netlify.toml`
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(self), camera=(), microphone=(), payment=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob: https://*.convex.cloud https://images.unsplash.com;
      connect-src 'self' https://*.convex.cloud wss://*.convex.cloud;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self'
    """
```
> ⚠️ ابدأ بـ `Content-Security-Policy-Report-Only` أسبوعاً وراقب المخالفات قبل الفرض — CSP خاطئة تكسر الموقع صامتة.

### 5.2 حدّ محاولات تسجيل الدخول — `convex/auth.ts`
```ts
// جدول جديد: loginAttempts { key: string, count: number, firstAt: number }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function checkThrottle(ctx, email: string) {
  const key = email.trim().toLowerCase();
  const row = await ctx.db.query("loginAttempts")
    .withIndex("by_key", q => q.eq("key", key)).first();
  if (!row) return;
  if (Date.now() - row.firstAt > WINDOW_MS) { await ctx.db.delete(row._id); return; }
  if (row.count >= MAX_ATTEMPTS) {
    throw new Error("محاولات كثيرة — حاول بعد 15 دقيقة");
  }
}
// عند الفشل: زد count. عند النجاح: احذف الصف.
```

### 5.3 إبطال الجلسات عند تغيير كلمة المرور
```ts
// في passwordReset.verifyAndReset و users.changePassword، بعد patch كلمة المرور:
const sessions = await ctx.db.query("sessions")
  .filter(q => q.eq(q.field("userId"), account._id)).collect();
for (const s of sessions) await ctx.db.delete(s._id);
```

### 5.4 إصلاح الوصولية — تبديل لون واحد
```diff
- className="bg-[#3CC4F0] text-white"   /* 2.03:1 — راسب */
+ className="bg-[#0E76AC] text-white"   /* 4.61:1 — ناجح AA */
```
```diff
- <div onClick={c.action}>            {/* ContactPage.tsx:89 */}
+ <button type="button" onClick={c.action} aria-label={c.label}>
```

### 5.5 إخراج الرسوم البيانية من الحزمة العامة — `vite.config.ts`
```diff
- manualChunks: { "vendor-charts": ["recharts"], "vendor-xlsx": ["xlsx"] }
+ // اترك recharts/xlsx لتقسيم Vite التلقائي: ستُحمَّل مع الصفحة
+ // التي تستوردها ديناميكياً (lazy) بدل أن تُحجز مسبقاً في index.html
+ manualChunks: { "vendor-react": ["react", "react-dom", "wouter"] }
```
> تحقّق بعدها: `curl -s https://…/ | grep vendor-charts` يجب ألا يُرجع شيئاً.

---

## 6. قائمة التحسينات مرتبة بالأولوية

### 🔴 عاجل (هذا الأسبوع)
| # | الإجراء | الجهد |
|---|---|---|
| 1 | إضافة ترويسات الأمان + CSP بوضع Report-Only (§5.1) | ساعة |
| 2 | تدوير مفتاح Supabase + تنظيف `.env` من تاريخ Git (`git filter-repo`) | ساعتان |
| 3 | إعادة تعيين كلمات المرور للحسابات الأربعة ذات الهاش القديم (منها ADMIN) | 15 دقيقة |
| 4 | حدّ محاولات تسجيل الدخول (§5.2) | ساعتان |
| 5 | حدّ معدّل على `ai.chat` / `ai.generateSmartPlan` (حماية الرصيد المالي) | 3 ساعات |
| 6 | حذف `server/` + `shared/schema.ts` الميتة ⇒ يسقط 140 خطأ نوع + أغلب ثغرات npm | ساعة |

### 🟠 متوسط (هذا الشهر)
| # | الإجراء | الجهد |
|---|---|---|
| 7 | نقل التوكن من `localStorage` إلى كوكي `HttpOnly; Secure; SameSite=Strict` | يوم |
| 8 | إبطال الجلسات عند تغيير كلمة المرور (§5.3) | ساعة |
| 9 | إخراج recharts/xlsx من حمولة الصفحة العامة (§5.5) | ساعتان |
| 10 | ضغط الصور: PNG→WebP، هدف < 200KB لكل صورة (26MB → ~3MB) | نصف يوم |
| 11 | إصلاح تباين الألوان + إتاحة بطاقات "تواصل معنا" للوحة المفاتيح | نصف يوم |
| 12 | إعداد `vitest` + أول 10 اختبارات وحدة (§7) | يوم |
| 13 | بيئة إنتاج Convex منفصلة عن التطوير | نصف يوم |

### 🟢 بعيد (الربع القادم)
| # | الإجراء |
|---|---|
| 14 | توحيد قاعدة أيام التوصيل في `convex/lib/dates.ts` واحد |
| 15 | استبدال `v.any()` بمُحقِّقات حقيقية على `dailyPlans.items` |
| 16 | تقليل `any` (~830 موضع) بدءاً من `convex/` |
| 17 | CI على GitHub Actions: `tsc` + `vitest` + `npm audit` |
| 18 | Prerendering أو SSR لمعاينات واتساب/فيسبوك |
| 19 | تسجيل تدقيق (`auditLog`) فعلي للعمليات الحسّاسة — الجدول موجود ولا يُكتب فيه |

---

## 7. أول 10 اختبارات وحدة (أعلى قيمة لكل ساعة)

كلها دوال نقية بلا اعتماد على قاعدة البيانات — لكن أغلبها **خاصة بالوحدة حالياً ويجب تصديرها**.

```ts
// أموال العميل — أخطر ما في النظام
convex/subscriptionPause.ts  isDeliveryDay(d: Date): boolean
convex/subscriptionPause.ts  countDeliveryDays(from, toExclusive, skipped?): number
convex/subscriptionPause.ts  addDeliveryDays(fromDate, n): string

// أمن
convex/passwords.ts          verifyPassword(password, stored): Promise<boolean>   // له فرع قديم!
convex/passwords.ts          hashPassword(password): Promise<string>

// رواتب
convex/attendance.ts         computeHours(checkIn?, checkOut?)
convex/attendance.ts         lev(a, b): number                 // مطابقة أسماء البصمة
convex/attendance.ts         dateToDays(date): number

// هوية
convex/customers.ts          normalizePhone(input): string     // وحّدها مع stickers.ts أولاً
convex/customerOrders.ts     getDayOffset(day): number
```

**ابدأ بـ:** `verifyPassword` (فرع الهاش القديم غير مغطّى)، ثم الثلاث دوال المالية في `subscriptionPause`.

---

## 8. خطة التنفيذ

| المرحلة | المدة | المخرَج | أداة |
|---|---|---|---|
| **1. إيقاف النزيف** | 3 أيام | ترويسات + تدوير المفاتيح + كلمات المرور الضعيفة + حدّ الدخول | `netlify.toml`, `git filter-repo` |
| **2. تنظيف** | أسبوع | حذف `server/` · `npm run check` أخضر · حذف الاعتماديات المهجورة | `tsc`, `npm audit` |
| **3. تحصين** | أسبوعان | كوكي HttpOnly · إبطال الجلسات · حدّ معدّل AI | Convex |
| **4. أداء ووصولية** | أسبوع | تقسيم الحزم · ضغط الصور · تباين الألوان | `sharp`, `axe DevTools` |
| **5. شبكة أمان** | أسبوعان | `vitest` + 10 اختبارات + CI | Vitest, GitHub Actions |
| **6. تحقّق** | مستمر | Lighthouse شهرياً · `npm audit` أسبوعياً · قائمة §CHECKLIST ربع سنوياً | Lighthouse CI |

### أدوات مقترحة
- **الأمن:** OWASP ASVS L1 كمرجع · `git filter-repo` · Snyk (بديل `npm audit`)
- **الأداء:** Lighthouse CI · `sharp` لضغط الصور · `rollup-plugin-visualizer`
- **الوصولية:** axe DevTools · WAVE · Contrast Checker
- **الاختبار:** Vitest (وحدة) · Playwright (تدفقات) — الترتيب بهذا الشكل

---

## 9. ملاحظة على منهجية هذا التقرير

- كل رقم فيه **مقيس**، لا مقدَّر. أوامر القياس مذكورة في §2 وقابلة لإعادة التشغيل.
- الادعاءات المنقولة عن التحليل الآلي تحقّقتُ منها يدوياً (موت `server/` وعدد الأخطاء و`throw` بعد الرد).
- **ما لم أختبره صرّحت به في §2** — Lighthouse وBurp واختبار التحمّل والمتصفحات الحقيقية لم تُشغَّل. لا تعتبر تلك المحاور مفحوصة.
- اختبار التخويل أُجري على **قاعدة بيانات الإنتاج** (لا توجد بيئة أخرى). استُخدمت دوال قراءة أو دوال آمنة التكرار فقط؛ لم تُستدع أي دالة مدمّرة.
