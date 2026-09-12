# نشر تطبيق الجوال (Expo) على TestFlight ثم App Store

**المسار:** الكود في `apps/mobile` → بناء سحابي على EAS (لا يحتاج Mac) → رفع تلقائي إلى App Store Connect → TestFlight → المتجر.
**المعرّف الثابت:** `com.adrenalinehealthy.app` (نفس تطبيق Capacitor القديم، فالنسخة الجديدة تحلّ محلّه في نفس صفحة المتجر).
**الإصدار الحالي في الكود:** 1.1.0 (iOS build 2 · Android versionCode 3). كل رفع جديد لنفس الإصدار يحتاج buildNumber أعلى.

## ما جُهّز في الكود (2026-09-12)
- `apps/mobile/eas.json`: ملفات تعريف `development` / `preview` (توزيع داخلي) / `production` (المتجر). رقم الإصدار من `app.json` (appVersionSource: local).
- زر «تفعيل إشعارات الطلبات» **مخفي** حتى يُضبط علم `subscriberPushEnabled` في `app.json` (ميزة غير عاملة = سبب رفض شائع في مراجعة Apple، Guideline 2.1).
- `expo-doctor` نظيف، وفحص الأنواع ناجح، والتطبيق يشير لإنتاج Convex والموقع الرسمي.
- الخادم على الإنتاج فيه كل دوال التطبيق (نُشر 2026-09-12).

## المسار المعتمد: Codemagic من GitHub (بلا كلمات مرور في الطرفية)
Codemagic مضبوط من قبل (مفتاح App Store Connect `adrenaline-asc`، الشهادة وملف التعريف، Apple ID للتطبيق في مجموعة
`adrenaline-ios`). أُضيف workflow **«iOS (Expo) → TestFlight»** في `codemagic.yaml` يبني `apps/mobile`:
تثبيت الاعتماديات → `expo prebuild` → رقم البناء التالي من App Store Connect تلقائياً → توقيع → IPA → رفع إلى TestFlight.

1. ارفع الكود إلى GitHub (main).
2. افتح [codemagic.io](https://codemagic.io) → التطبيق → **Start new build** → اختر workflow «iOS (Expo) → TestFlight» → Start.
   (الوسم `expo-ios-v*` مضبوط أيضاً لكنه لم يكن يطلق البناء تلقائياً من قبل.)
3. ٢٠–٣٥ دقيقة ثم تظهر النسخة في App Store Connect → TestFlight.
4. لو فشل: افتح سجل الخطوة الفاشلة وانسخ آخر ٣٠ سطراً للمساعد.

> ملاحظة: plugin الإشعارات أُزيل من `app.json` لأنه يضيف صلاحية Push لا يغطيها ملف التعريف الحالي (الميزة مخفية أصلاً).
> عند تفعيل الإشعارات لاحقاً: أضف قدرة Push Notifications للمعرّف في Apple Developer، أعد توليد ملف التعريف في Codemagic، ثم أعد plugin.

## المسار البديل: EAS من جهازك (يحتاج Apple ID في الطرفية)
الأوامر كلها من داخل مجلد `apps/mobile` (بلا تثبيت: `npx eas-cli` يشغّل الأداة مباشرة):

1. **الدخول إلى Expo** (حساب على expo.dev، أنشئه لو ما عندك):
   ```bash
   npx eas-cli login
   ```
2. **ربط المشروع بـEAS** — **تم 2026-09-13**: المشروع `@meee87/adrenaline-healthy-food` (projectId في app.json). لا يُعاد إلا على جهاز جديد:
   ```bash
   npx eas-cli init
   ```
3. **بناء iOS للإنتاج** (يسأل عن Apple ID وكلمة المرور/رمز التحقق ويولّد الشهادات تلقائياً — أجب بنفسك):
   ```bash
   npx eas-cli build --platform ios --profile production
   ```
   - لو سأل «Set up Push Notifications?» أجب **No** (الإشعارات مؤجّلة).
   - البناء يأخذ ١٠–٢٠ دقيقة على السحابة. رابط المتابعة يظهر في الطرفية.
4. **الرفع إلى TestFlight** (يسأل عن Apple ID أو مفتاح App Store Connect):
   ```bash
   npx eas-cli submit --platform ios --latest
   ```
   بعد دقائق تظهر النسخة في App Store Connect → TestFlight (معالجة Apple ١٠–٣٠ دقيقة).
5. **التجربة على iPhone:** ثبّت تطبيق TestFlight من المتجر، أضف المختبرين (Internal Testing) بإيميلاتهم، وافتح الدعوة.

## ما يُختبر على الجهاز قبل الإرسال للمراجعة (بالترتيب)
1. السبلاش الكحلي ثم الرئيسية؛ **الاتجاه من اليمين لليسار** في كل الشاشات (الاتجاه صار خاصية عرض لا إعداد جهاز — لم يُجرَّب على iPhone حقيقي بعد).
2. القائمة: الصور، الفلاتر، تفاصيل الطبق.
3. الخطط: الأسعار وزر واتساب.
4. حسابي: دخول مشترك حقيقي → أيام الاشتراك بتواريخها ودورة المطبخ **تطابق الموقع** لنفس المشترك → اختيار وجبات → إرسال → يظهر الطلب في «مراجعة الطلبات» على الموقع بنفس الأيام.
5. لوحة التحكم داخل التطبيق (WebView): دخول موظف يعمل.
6. تبديل اللغة إلى الإنجليزية ثم العودة.

## الإرسال للمراجعة (App Store Connect)
- صفحة المتجر: الاسم، الوصف بالعربية والإنجليزية، الكلمات المفتاحية، ٣–٥ لقطات شاشة iPhone 6.7" (من TestFlight نفسه).
- سياسة الخصوصية: `https://adrenalinehealthy.com/privacy` · الدعم: `https://adrenalinehealthy.com/support`.
- بيانات الخصوصية (App Privacy): يجمع الاسم/الهاتف/البريد للحساب فقط، لا تتبّع إعلاني.
- حساب مراجعة لـApple: أنشئ مشتركاً تجريبياً حقيقياً في لوحة التحكم (ببيانات وهمية) وأدخل بريده وكلمة مروره في «App Review Information».
- التشفير: مضبوط في app.json (`ITSAppUsesNonExemptEncryption: false`).

## للإصدار التالي
- ارفع `ios.buildNumber` (وversion لو تغيّرت الميزات) في `app.json`، ثم كرّر الخطوتين ٣ و٤.
- لتفعيل الإشعارات لاحقاً: مفتاح APNs في EAS (`npx eas-cli credentials`)، ضبط `MOBILE_PUSH_ENABLED=true` في Convex، ثم `subscriberPushEnabled: true` في `app.json`.

## مراجع
- [تطبيق الجوال (Expo)](تطبيق-الجوال-Expo.md) — بنية التطبيق وتشغيله.
- [قيود اختيار الوجبات](قيود-اختيار-الوجبات.md) — ما يجب أن يطابقه التطبيق.
