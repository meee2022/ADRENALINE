# قائمة تحقق دورية — Adrenaline

قائمة **قابلة لإعادة التشغيل**. كل بند له أمر تنفّذه ونتيجة متوقّعة.
الدورية المقترحة: **الأمن أسبوعياً · الباقي قبل كل نشر · الكامل ربع سنوياً.**

> ✅ = نجح · ❌ = يحتاج عملاً · ⏭ = غير منطبق

---

## أ. الأمن — التخويل (أسبوعياً)

**أخطر فحص في هذا الملف.** أي دالة Convex مُصدَّرة = نقطة نهاية عامة على الإنترنت.

- [ ] **أ-1. لا توجد دالة مدمّرة مكشوفة**
  ```bash
  for fn in customers:list users:listUsers analytics:overview auditLog:list \
            menuItems:list purchaseOrders:list customers:migrateDates seed:seedAll; do
    printf "%-28s " "$fn"
    npx convex run "$fn" '{}' 2>&1 | grep -q "غير مصرّح" && echo "🔒" || echo "❌ مكشوفة!"
  done
  ```
  **المتوقع:** 🔒 لكل السطور.

- [ ] **أ-2. الدوال العامة ما زالت تعمل** (لا تكسر الموقع بحماية زائدة)
  ```bash
  for fn in restaurantSettings:get banners:listActiveBanners publicPlans:list \
            publicMeals:bestSellers ratings:listAll; do
    printf "%-30s " "$fn"
    npx convex run "$fn" '{}' 2>&1 | grep -q "غير مصرّح" && echo "❌ اتكسرت" || echo "✅"
  done
  ```

- [ ] **أ-3. كل دالة محميّة تفحص الصلاحية كـ *أول سطر***
  (فحص بعد `ctx.db.delete` بلا قيمة)
  ```bash
  node scripts/check-guards.mjs   # انظر §ملحق
  ```

- [ ] **أ-4. كل نداء من الفرونت يمرّر `sessionToken`**
  ```bash
  node scripts/check-callers.mjs  # انظر §ملحق
  ```

- [ ] **أ-5. لا حسابات بهاش قديم ضعيف**
  ```bash
  for t in users customerAccounts; do
    npx convex data $t --limit 200 2>&1 |
      awk -F'|' 'NR>2{gsub(/ /,"",$7)} NR>2 && $7 !~ /^"pbkdf2/ && $7!="" {c++} END{print "'"$t"': " c+0}'
  done
  ```
  **المتوقع:** `0` للاثنين.

---

## ب. الأمن — البنية التحتية (قبل كل نشر)

- [ ] **ب-1. ترويسات الأمان موجودة**
  ```bash
  H=$(curl -sI https://adrenalinehealthy.com/ | tr -d '\r' | tr 'A-Z' 'a-z')
  for h in content-security-policy strict-transport-security x-frame-options \
           x-content-type-options referrer-policy permissions-policy; do
    echo "$H" | grep -q "^$h:" && echo "✅ $h" || echo "❌ $h"
  done
  ```

- [ ] **ب-2. لا أسرار في الشيفرة المتتبَّعة**
  ```bash
  git grep -nIE "re_[A-Za-z0-9_]{15,}|sk-[A-Za-z0-9]{20,}|eyJhbGciOi" -- . | grep -v _generated
  ```
  **المتوقع:** لا نتائج.

- [ ] **ب-3. لا ملفات بيانات شخصية في الـcommit**
  ```bash
  git diff --stat origin/main..HEAD --name-only |
    grep -iE "ADRENALINE.*\.xlsx|DATABASE.*\.xls|calculation.*\.xlsx|Attendance Details.*\.csv|config\.json|\.env"
  ```
  **المتوقع:** لا نتائج.

- [ ] **ب-4. ثغرات الاعتماديات**
  ```bash
  npm audit --omit=dev
  ```
  **المتوقع:** `0 high`, `0 critical`.

- [ ] **ب-5. حدّ محاولات تسجيل الدخول فعّال** *(بعد تنفيذ التوصية)*
  6 محاولات خاطئة متتالية ⇒ الرسالة "محاولات كثيرة".

---

## ج. سلامة الكود (قبل كل نشر)

- [ ] **ج-1. الأنواع نظيفة**
  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```
  **المتوقع الحالي:** 144 خطأ (140 منها من `server/` الميت).
  **الهدف:** `0`.

- [ ] **ج-2. البناء ينجح**
  ```bash
  npm run build && ls dist/public/index.html
  ```

- [ ] **ج-3. الاختبارات تمرّ** *(بعد إعداد vitest)*
  ```bash
  npm test
  ```

---

## د. تسلسل النشر الآمن ⚠️

> **درس من عطل 2026-07-10:** خلفية Convex تُنشر **فوراً على الإنتاج**،
> بينما الواجهة لا تُنشر إلا عند الدفع إلى GitHub. أي تغيير يمسّ الاثنين
> **يكسر الموقع في المسافة بينهما.**

عند إضافة فحص صلاحية جديد لدالة تستخدمها الواجهة، اتبع **ثلاث خطوات**:

- [ ] **د-1.** السيرفر **يقبل** `sessionToken` بلا فرضه → `npx convex dev --once`
      *(الواجهة القديمة لا تتأثر)*
- [ ] **د-2.** الواجهة تُرسل التوكن → `git push` → **انتظر وتحقّق أن Netlify نشر**:
  ```bash
  chunk=$(ls dist/public/assets/<الصفحة>-*.js | head -1 | xargs basename)
  curl -sI "https://adrenalinehealthy.com/assets/$chunk" | head -1   # يجب 200
  md5sum dist/public/assets/$chunk; curl -s "https://adrenalinehealthy.com/assets/$chunk" | md5sum
  ```
  **المتوقع:** نفس الـmd5.
- [ ] **د-3.** السيرفر **يفرض** التوكن → `npx convex dev --once`
- [ ] **د-4.** تحقّق نهائي: أ-1 و أ-2 أعلاه.

---

## هـ. نسخة احتياطية (شهرياً)

- [ ] **هـ-1. نسخة كاملة تشمل الملفات**
  ```bash
  npx convex export --include-file-storage --path "$HOME/Desktop/adrenaline-backups/adrenaline-FULL-$(date +%F).zip"
  ```
  ⚠️ **بدون `--include-file-storage` لن تُحفظ أي صورة.**

- [ ] **هـ-2. تحقّق من المحتوى** (لا تثق بحجم الملف وحده)
  ```bash
  python -c "
  import zipfile,sys
  z=zipfile.ZipFile(sys.argv[1])
  print('tables :', len({n.split('/')[0] for n in z.namelist() if n.endswith('documents.jsonl')}))
  print('files  :', len([n for n in z.namelist() if n.startswith('_storage/') and not n.endswith('.jsonl')]))
  print('customers:', sum(1 for _ in z.open('customers/documents.jsonl')))
  print('integrity:', 'OK' if z.testzip() is None else 'CORRUPT')
  " "$HOME/Desktop/adrenaline-backups/adrenaline-FULL-$(date +%F).zip"
  ```

- [ ] **هـ-3.** انسخها خارج الجهاز (هارد خارجي أو تخزين سحابي).

---

## و. التدفقات الوظيفية (قبل كل نشر)

اختبار يدوي، 10 دقائق:

**الموقع العام**
- [ ] و-1. الصفحة الرئيسية تُحمَّل، البانرات والباقات تظهر.
- [ ] و-2. `/public/menu` → إدخال رقم مشترك → يظهر اسمه وممنوعاته.
- [ ] و-3. المنيو: يوم مختار تلقائياً، أزرار "إضافة" **مفعّلة فوراً**.
- [ ] و-4. إضافة وجبات حتى اكتمال اليوم → تظهر "مكتمل" + "التالي: …".
- [ ] و-5. `/customer/smart-plan` → **لا يطلب الرقم مجدداً**.
- [ ] و-6. `/public/track` → تتبّع برقم الطلب وبرقم الجوال.
- [ ] و-7. الرد **لا يحتوي** `customerPhone` أو `customerEmail`:
  ```bash
  npx convex run customerOrders:getByOrderNumber '{"orderNumber":"ORD-…"}' | grep -iE "customerPhone|customerEmail" && echo "❌ تسريب" || echo "✅"
  ```

**لوحة التحكم**
- [ ] و-8. تسجيل دخول موظف → الصفحات المسموحة فقط تظهر في القائمة الجانبية.
- [ ] و-9. المشتركون: تعديل، تجميد/استئناف، طباعة جدول الوجبات.
- [ ] و-10. المطبخ: عرض اليوم + طباعة كشف الشيف.
- [ ] و-11. الحضور: استيراد + التقرير الشهري.
- [ ] و-12. الطلبات المعلّقة → اعتماد طلب → تُنشأ خطط يومية.

---

## ز. الأداء (شهرياً)

- [ ] **ز-1. حمولة الصفحة العامة**
  ```bash
  curl -s https://adrenalinehealthy.com/ | grep -oE '/assets/[A-Za-z0-9_.-]+\.(js|css)' |
  while read u; do
    s=$(curl -s -H "Accept-Encoding: br,gzip" -o /tmp/b -w "%{size_download}" "https://adrenalinehealthy.com$u")
    printf "  %7s  %s\n" "$s" "$(basename $u)"
  done
  ```
  **الهدف:** < 200KB إجمالي JS. **حالياً ~275KB.**

- [ ] **ز-2. لا رسوم بيانية في الصفحة العامة**
  ```bash
  curl -s https://adrenalinehealthy.com/ | grep -q vendor-charts && echo "❌ recharts محمّل" || echo "✅"
  ```

- [ ] **ز-3. لا صورة تتجاوز 200KB**
  ```bash
  find client/public -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.webp' \) -size +200k -exec ls -lh {} \; | awk '{print $5, $9}'
  ```

- [ ] **ز-4. Lighthouse** (يدوياً في Chrome DevTools → Lighthouse → Mobile)
  الهدف: Performance ≥ 80 · Accessibility ≥ 90 · Best Practices ≥ 90 · SEO ≥ 90.

---

## ح. الوصولية (ربع سنوياً)

- [ ] ح-1. axe DevTools على `/`، `/public/menu`، `/public/plans` — صفر انتهاكات حرجة.
- [ ] ح-2. تنقّل بلوحة المفاتيح فقط (Tab/Enter) عبر رحلة الاشتراك كاملة.
- [ ] ح-3. تباين كل نص ≥ 4.5:1 (Contrast Checker).
- [ ] ح-4. تبديل اللغة إلى EN — لا انكسار تخطيط (RTL/LTR).
- [ ] ح-5. تصغير النافذة إلى 375px — لا تمرير أفقي.

---

## ملحق — سكربتا الفحص

موجودان في المستودع وجاهزان للتشغيل من الجذر:

| السكربت | ماذا يفعل | التشغيل |
|---|---|---|
| `scripts/check-guards.mjs` | يتأكد أن `requireStaff`/`requireAdmin` هو **أول سطر** في كل دالة محميّة (55 دالة) | `node scripts/check-guards.mjs` |
| `scripts/check-callers.mjs` | يمسح `client/src` بحثاً عن نداء لدالة محميّة بلا `sessionToken` | `node scripts/check-callers.mjs` |

**النتيجة المتوقّعة:**
```
OK: all 55 functions have sessionToken + guard as FIRST statement
OK: every wave-2 call site passes sessionToken
```

> السكربت الأول هو ما كشف ثغرة `modifiers.remove` — كان قد أُضيف لها `sessionToken`
> بلا استدعاء `requireStaff`، فبدت محميّة وهي ليست كذلك. **افحص الترتيب لا الوجود:**
> فحص صلاحية يأتي بعد `ctx.db.delete()` لا قيمة له.

**اربطهما بـ CI:**
```yaml
# .github/workflows/security.yml
- run: node scripts/check-guards.mjs
- run: node scripts/check-callers.mjs
- run: npx tsc --noEmit
- run: npm audit --omit=dev --audit-level=high
```
