# القواعد المشتركة (`shared/rules`)

المكان الوحيد لمنطق: تصنيفات الوجبات وسقف الفطار (`mealSchedule`)، الممنوعات والحساسية
(`mealRestrictions`)، حالة الاشتراك وخاناته وتواريخه ونقصه (`subscription`).

- **بلا React وبلا Convex**: دوال صافية تُستورد من الويب والخادم وتطبيق الجوال.
- الويب يستوردها عبر الممرّات القديمة `@/lib/subscription` وأخواتها (ملفات إعادة تصدير فقط)،
  فلا يتغيّر أي استيراد قائم.
- الخادم يستوردها بمسار نسبي `../shared/rules`.
- **قاعدة جديدة أو تعديل قاعدة = هنا فقط**، ثم راجع كل المستوردين:
  `grep -rn "shared/rules\|lib/subscription\|lib/mealSchedule\|lib/mealRestrictions" client convex`.
