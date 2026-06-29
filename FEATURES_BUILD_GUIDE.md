# Adrenaline — دليل بناء الميزات الجديدة (Convex)

> هذا الدليل يصف الميزات التي بُنيت في مشروع **المصك** (Supabase) ويعيد صياغتها لتُبنى هنا في **أدرينالين** بمنطق **Convex**. ابنِها واحدة واحدة.

## ⛔ قواعد صارمة (اقرأها أولاً)
1. **أدرينالين = Convex**، وليس Supabase. كل دالة تُكتب كـ `query`/`mutation` في `convex/*.ts` باستخدام `ctx.db` و`v` validators. **لا تنسخ أي ملف من مشروع المصك** — المصك يستخدم Supabase و`supabase.from(...)`؛ ذلك لن يعمل هنا.
2. **الهوية = cyan/فاتح** (مثل باقي صفحات أدرينالين): `bg-gray-50`, كروت `bg-white border-slate-200`, هيدر `bg-gradient-to-l from-cyan-500 to-blue-600`, نصوص `text-slate-900`/`text-slate-500`, أزرار `bg-cyan-600 hover:bg-cyan-700`. **لا تستخدم الأسود/الأحمر** (#0f0f0f/#e11d2a) الخاص بالمصك.
3. **لا خلط ولا دمج ملفات** بين المشروعين إطلاقًا. اعمل داخل `adrenaline-last/` فقط.
4. بعد أي تعديل على `convex/schema.ts` أو إضافة دالة Convex، شغّل `npx convex dev` لتوليد الأنواع ونشر الدوال.
5. أنماط Convex المهمة:
   - إدراج: `const id = await ctx.db.insert("table", {...})`
   - تعديل: `await ctx.db.patch(id, {...})` (ليس `.update()`)
   - حذف: `await ctx.db.delete(id)`
   - جلب واحد: `await ctx.db.get(id)`
   - استعلام: `await ctx.db.query("table").withIndex("by_x", q => q.eq("field", val)).collect()`
   - المستند يحتوي `_id` و`_creationTime` تلقائيًا — لا حاجة لتحويل id→_id.
   - الواجهة تستدعي `useQuery(api.module.fn, args)` / `useMutation(api.module.fn)` من `convex/react` (نفس ما هو مستخدم حاليًا).

## ✅ المُنجز سابقًا في أدرينالين (لا تكرره)
موجود في `convex/inventory.ts`: `getSummary`, `consumeStock`, `adjustStock`, `recordWaste`, `getConsumptionReport`, `receiveMany`, `seedWasteDemo`. وصفحات: `WasteReport.tsx`, `ReceiveGoods.tsx` (مع لصق Excel/CSV), `Suppliers.tsx`. وُجبات المخزون الأساسية والهالك والاستلام بالجملة جاهزة.

---

# 1) تنبيهات المخزون (Inventory Alerts) 🔥

**الهدف:** صفحة تجمع ما يحتاج تصرّفًا الآن: نواقص (مع كمية إعادة الطلب) + قرب انتهاء الصلاحية + منتهي.

### الباك إند — أضف في `convex/inventory.ts`
```ts
export const getAlerts = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 7;
    const today = new Date().toISOString().split("T")[0];
    const horizon = new Date(); horizon.setDate(horizon.getDate() + days);
    const horizonStr = horizon.toISOString().split("T")[0];

    const items = await ctx.db.query("inventoryItems").collect();
    const batches = await ctx.db.query("inventoryBatches").collect();
    const itemMap = new Map(items.map((i) => [i._id, i]));

    const lowStock = items
      .filter((it) => Number(it.currentStock) <= Number(it.minStock))
      .map((it) => {
        const target = Number(it.targetStock) || Number(it.minStock) || 0;
        return {
          itemId: it._id, nameAr: it.nameAr, unit: it.unit,
          currentStock: Number(it.currentStock || 0),
          minStock: Number(it.minStock || 0),
          reorderQty: Math.max(0, target - Number(it.currentStock || 0)),
          isOut: Number(it.currentStock || 0) <= 0,
          deficit: Number(it.minStock || 0) - Number(it.currentStock || 0),
        };
      })
      .sort((a, b) => b.deficit - a.deficit);

    const active = batches.filter((b) => b.expiryDate && Number(b.quantityRemaining) > 0);
    const mapBatch = (b: any) => {
      const inv = itemMap.get(b.itemId);
      const qty = Number(b.quantityRemaining || 0), unitCost = Number(b.unitCost || 0);
      const daysLeft = Math.round((new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86400000);
      return { batchId: b._id, nameAr: inv?.nameAr || "—", unit: inv?.unit || "",
        quantity: qty, value: Math.round(qty * unitCost * 100) / 100, expiryDate: b.expiryDate, daysLeft };
    };
    const expiring = active.filter((b) => b.expiryDate! > today && b.expiryDate! <= horizonStr).map(mapBatch).sort((a, z) => a.daysLeft - z.daysLeft);
    const expired  = active.filter((b) => b.expiryDate! <= today).map(mapBatch).sort((a, z) => a.daysLeft - z.daysLeft);
    const atRiskValue = [...expiring, ...expired].reduce((s, b) => s + b.value, 0);

    return { days, lowStock, expiring, expired,
      counts: { lowStock: lowStock.length, outOfStock: lowStock.filter((l) => l.isOut).length, expiring: expiring.length, expired: expired.length, total: lowStock.length + expiring.length + expired.length },
      atRiskValue: Math.round(atRiskValue * 100) / 100 };
  },
});
```

### الواجهة — `client/src/pages/InventoryAlerts.tsx` (هوية cyan)
- هيدر `bg-gradient-to-l from-cyan-500 to-blue-600`، عنوان "تنبيهات المخزون"، زر رجوع للمخزون + زر "استلام بضاعة".
- مُحدِّد أفق الصلاحية (7/14/30 يوم).
- 4 KPIs: نفد المخزون، مخزون منخفض، قرب الانتهاء، قيمة معرّضة للخطر.
- جدول "نواقص المخزون — أعد الطلب": الصنف/الرصيد/حد الطلب/اطلب(+reorderQty)/الحالة (نفد/منخفض). صف قابل للضغط → `/inventory/:itemId`.
- جدولان للصلاحية (منتهي أولًا ثم قرب الانتهاء): الصنف/الكمية/تاريخ الانتهاء/المتبقي(daysLeft)/القيمة.
- حالة "كل شيء على ما يرام ✅" عند `counts.total === 0`.
- يستدعي: `const data = useQuery(api.inventory.getAlerts, { days });`

### الراوت — `client/src/App.tsx`
`<Route path="/inventory/alerts"><ProtectedRoute component={InventoryAlerts} /></Route>` + زر سريع من صفحة المخزون.

---

# 2) أوامر الشراء (Purchase Orders) 🔥

**الهدف:** زر "اطلب من المورّد" يولّد أوامر شراء من النواقص مجمّعة حسب المورّد، مع متابعة الحالة.

### الـschema — أضف جدولًا في `convex/schema.ts`
```ts
purchaseOrders: defineTable({
  supplierId: v.optional(v.id("suppliers")),
  supplierName: v.optional(v.string()),
  status: v.union(v.literal("DRAFT"), v.literal("SENT"), v.literal("RECEIVED"), v.literal("CANCELLED")),
  items: v.array(v.object({
    itemId: v.id("inventoryItems"), nameAr: v.string(), unit: v.string(),
    quantity: v.number(), estUnitCost: v.number(), estLineCost: v.number(),
  })),
  totalEst: v.number(),
  note: v.optional(v.string()),
  createdAt: v.number(),
  sentAt: v.optional(v.number()),
  receivedAt: v.optional(v.number()),
})
  .index("by_supplier", ["supplierId"])
  .index("by_status", ["status"]),
```

### الباك إند — ملف جديد `convex/purchaseOrders.ts`
```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({ args: {}, handler: async (ctx) => {
  const rows = await ctx.db.query("purchaseOrders").collect();
  return rows.sort((a, z) => z.createdAt - a.createdAt);
}});

export const generateFromLowStock = mutation({ args: {}, handler: async (ctx) => {
  const items = await ctx.db.query("inventoryItems").collect();
  const low = items.filter((it) => Number(it.currentStock) <= Number(it.minStock));
  if (!low.length) return { count: 0, created: [] as string[] };

  const batches = await ctx.db.query("inventoryBatches").collect();
  const costMap = new Map<string, number>();
  for (const b of batches.sort((a, z) => String(a.receivedAt).localeCompare(String(z.receivedAt)))) costMap.set(b.itemId, Number(b.unitCost || 0));
  const suppliers = await ctx.db.query("suppliers").collect();
  const supName = new Map(suppliers.map((s) => [s._id, s.name]));

  const groups = new Map<string, any[]>();
  for (const it of low) {
    const sid = it.supplierId ?? "__none__";
    if (!groups.has(sid)) groups.set(sid, []);
    const target = Number(it.targetStock) || Number(it.minStock) || 0;
    const qty = Math.max(0, target - Number(it.currentStock || 0)) || Number(it.minStock) || 1;
    const cost = costMap.get(it._id) || 0;
    groups.get(sid)!.push({ itemId: it._id, nameAr: it.nameAr, unit: it.unit,
      quantity: Math.round(qty * 100) / 100, estUnitCost: cost, estLineCost: Math.round(qty * cost * 100) / 100 });
  }
  const now = Date.now(); const created: string[] = [];
  for (const [sid, poItems] of Array.from(groups.entries())) {
    const totalEst = poItems.reduce((s: number, i: any) => s + i.estLineCost, 0);
    const id = await ctx.db.insert("purchaseOrders", {
      supplierId: sid === "__none__" ? undefined : (sid as any),
      supplierName: sid === "__none__" ? undefined : (supName.get(sid as any) || undefined),
      status: "DRAFT", items: poItems, totalEst: Math.round(totalEst * 100) / 100, createdAt: now,
    });
    created.push(id);
  }
  return { count: created.length, created };
}});

export const updateStatus = mutation({
  args: { id: v.id("purchaseOrders"), status: v.union(v.literal("DRAFT"), v.literal("SENT"), v.literal("RECEIVED"), v.literal("CANCELLED")) },
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    if (args.status === "SENT") patch.sentAt = Date.now();
    if (args.status === "RECEIVED") patch.receivedAt = Date.now();
    await ctx.db.patch(args.id, patch); return args.id;
  },
});

export const remove = mutation({ args: { id: v.id("purchaseOrders") }, handler: async (ctx, args) => { await ctx.db.delete(args.id); return { success: true }; }});
```

### الواجهة — `client/src/pages/PurchaseOrders.tsx` (cyan)
- هيدر cyan، زر "توليد من النواقص" → `useMutation(api.purchaseOrders.generateFromLowStock)`.
- كروت لكل أمر: اسم المورّد، شارة الحالة (DRAFT رمادي / SENT كهرماني / RECEIVED أخضر / CANCELLED أحمر باهت)، جدول البنود (الصنف/الكمية/سعر تقديري/الإجمالي)، الإجمالي التقديري.
- أزرار حسب الحالة: إرسال للمورّد / استلام في المخزون (→ `/inventory/receive`) / إلغاء / حذف.
- الراوت `/inventory/purchase-orders` + زر "اطلب من المورّد" في صفحة التنبيهات يستدعي generateFromLowStock ثم ينقل لصفحة الأوامر.

---

# 3) الجرد الفعلي (Stock Take)

**الهدف:** عدّ الكميات الفعلية، حساب الفروقات، وتطبيق التسويات دفعة واحدة. (`adjustStock` موجود بالفعل.)

### الواجهة فقط — `client/src/pages/StockTake.tsx` (cyan)
- `const items = useQuery(api.inventory.listItems, {}) || [];` و`const adjustStock = useMutation(api.inventory.adjustStock);`
- جدول مجمّع بالفئة، لكل صنف: رصيد النظام + خانة إدخال "المعدود فعليًا" + عمود الفرق (actual − system).
- بحث + فوتر ثابت بالملخص (عدد المعدود / عدد الفروقات) + زر "تطبيق الجرد".
- التطبيق: لكل صنف أُدخلت قيمته وتختلف عن النظام: `await adjustStock({ itemId, newQuantity: actual, note: "جرد فعلي" });`
- الراوت `/inventory/stock-take` + زر سريع من صفحة المخزون.
- ملاحظة: تأكد أن `adjustStock` يقبل `{ itemId, newQuantity, note }` (راجع توقيعه في `convex/inventory.ts`).

---

# 4) تحويل الوحدات في الخصم التلقائي

**الهدف:** عند الخصم التلقائي من الرسيبي، حوّل وحدة الرسيبي إلى وحدة المخزون (جرام↔كيلو، مل↔لتر).

### helper جديد — `client/src/lib/units.ts`
```ts
const TO_BASE: Record<string, { base: string; factor: number }> = {
  mg: { base: "mass", factor: 0.001 }, g: { base: "mass", factor: 1 }, gram: { base: "mass", factor: 1 }, kg: { base: "mass", factor: 1000 },
  ml: { base: "vol", factor: 1 }, l: { base: "vol", factor: 1000 }, liter: { base: "vol", factor: 1000 },
};
export function convertUnit(qty: number, from?: string, to?: string): number {
  const q = Number(qty) || 0; if (!from || !to) return q;
  const f = TO_BASE[String(from).toLowerCase().trim()], t = TO_BASE[String(to).toLowerCase().trim()];
  if (!f || !t || f.base !== t.base) return q; // وحدات مجهولة/مختلفة الأبعاد → بلا تحويل
  return (q * f.factor) / t.factor;
}
```

### التطبيق — في `convex/dailyPlans.ts` (دالة تحديث الحالة عند الانتقال إلى PREPARED)
ابحث عن مكان الخصم التلقائي للمكوّنات. قبل الخصم:
```ts
import { convertUnit } from "../client/src/lib/units"; // أو انسخ الدالة داخل الملف لتجنّب مسارات الاستيراد
// ...
const deduct = convertUnit(Number(ing.quantityPerServing), ing.unit, invItem.unit);
const newStock = Math.max(0, (invItem.currentStock || 0) - deduct);
await ctx.db.patch(ing.inventoryItemId, { currentStock: newStock, updatedAt: Date.now() });
await ctx.db.insert("inventoryMovements", { itemId: ing.inventoryItemId, type: "consume", quantity: deduct, note: `استهلاك آلي: ...`, createdAt: Date.now() });
```
> ملاحظة: في Convex قد يصعب الاستيراد من `client/`. الأبسط: ضع `convertUnit` كدالة محلية صغيرة أعلى `convex/dailyPlans.ts`.

> تحقّق أولًا: هل الخصم التلقائي مربوط أصلًا في أدرينالين عند PREPARED؟ في المصك كان مربوطًا في `dailyPlans.update`. إن لم يكن مربوطًا هنا، اربطه أولًا (مرّ على `plan.items`، لكل `menuItemId` غير `isOff` اجلب `mealIngredients` بالـindex واخصم كل مكوّن).

---

# 5) تنبيهات مخزون منخفض تلقائية (ذكية)

**الهدف:** عند انخفاض أي صنف، أرسل إشعار `LOW_STOCK` **مرة واحدة** (بدون تكرار)، واقفله تلقائيًا عند الترصيع.

### في `convex/inventory.ts` — دالتان مساعدتان داخلية + استدعاؤها
```ts
async function maybeNotifyLowStock(ctx: any, item: any) {
  if (!item || Number(item.currentStock) > Number(item.minStock)) return;
  // dedup: لا تكرّر لو فيه إشعار LOW_STOCK غير مقروء لنفس الصنف
  const open = await ctx.db.query("notifications")
    .withIndex("by_targetRole", (q: any) => q.eq("targetRole", "INVENTORY_MANAGER").eq("isRead", false))
    .collect();
  if (open.some((n: any) => n.type === "LOW_STOCK" && n.relatedId === item._id)) return;
  const isOut = Number(item.currentStock) <= 0;
  await ctx.db.insert("notifications", {
    targetRole: "INVENTORY_MANAGER", type: "LOW_STOCK",
    title: isOut ? "نفد المخزون" : "مخزون منخفض",
    message: isOut ? `${item.nameAr} نفد تماماً — يجب إعادة الطلب` : `${item.nameAr} وصل للحد الأدنى (${item.currentStock} ${item.unit || ""})`,
    link: "/inventory/alerts", relatedId: item._id, isRead: false, createdAt: Date.now(),
  });
}
async function resolveLowStock(ctx: any, item: any) {
  if (!item || Number(item.currentStock) <= Number(item.minStock)) return;
  const open = await ctx.db.query("notifications")
    .withIndex("by_targetRole", (q: any) => q.eq("targetRole", "INVENTORY_MANAGER").eq("isRead", false))
    .collect();
  for (const n of open) if (n.type === "LOW_STOCK" && n.relatedId === item._id) await ctx.db.patch(n._id, { isRead: true, readAt: Date.now() });
}
```
- نادِ `maybeNotifyLowStock(ctx, updatedItem)` بعد `consumeStock` و`adjustStock` و`recordWaste`.
- نادِ `resolveLowStock(ctx, updatedItem)` بعد `receiveMany`/أي استلام و`adjustStock` (يرفع المخزون).

---

# 6) إصلاح الأرقام الوهمية في تقرير المخزون

في `client/src/pages/InventoryReports.tsx` ابحث عن أي قيمة ثابتة (مثل `expiryPercentage = 2.4` أو رسم استهلاك أسبوعي بأرقام ثابتة) واستبدلها بحساب فعلي:
- **نسبة الانتهاء** = (دفعات نشطة تنتهي خلال 7 أيام أو منتهية) ÷ (كل الدفعات النشطة) × 100.
- **الاستهلاك الأسبوعي** = جمّع حركات `type==="consume"` آخر 4 أسابيع في 4 خانات حسب `createdAt`.

---

# 7) صفحة الموردين — إحصائيات + تعديل

أضف في `convex/inventory.ts`:
```ts
export const updateSupplier = mutation({ args: { id: v.id("suppliers"), name: v.optional(v.string()), phone: v.optional(v.string()) },
  handler: async (ctx, args) => { const { id, ...rest } = args; await ctx.db.patch(id, rest); return id; }});

export const getSupplierStats = query({ args: {}, handler: async (ctx) => {
  const batches = await ctx.db.query("inventoryBatches").collect();
  const stats: Record<string, { purchases: number; totalValue: number; items: Set<string>; lastPurchase: string }> = {};
  for (const b of batches) {
    const sid = b.supplierId; if (!sid) continue;
    if (!stats[sid]) stats[sid] = { purchases: 0, totalValue: 0, items: new Set(), lastPurchase: "" };
    stats[sid].purchases += 1;
    stats[sid].totalValue += Number(b.quantityReceived || 0) * Number(b.unitCost || 0);
    stats[sid].items.add(b.itemId);
    if (String(b.receivedAt || "") > stats[sid].lastPurchase) stats[sid].lastPurchase = b.receivedAt || "";
  }
  return Object.entries(stats).map(([supplierId, s]) => ({ supplierId, purchases: s.purchases, totalValue: Math.round(s.totalValue * 100) / 100, itemCount: s.items.size, lastPurchase: s.lastPurchase || null }));
}});
```
الواجهة `Suppliers.tsx` (cyan): لكل مورّد اعرض (فواتير/قيمة الشراء/أصناف/آخر شراء) من `getSupplierStats` + زر تعديل (modal) يستدعي `updateSupplier`.

---

# 8) بوابة العميل (Customer Portal) 🔥🔥

عدّل `client/src/pages/public/CustomerProfile.tsx` لإضافة: سجل الطلبات، إيقاف/تخطّي الاشتراك، إشعارات حالة الطلب، نقاط الولاء.

### 8أ) الـschema — أضف حقولًا على `customers` في `convex/schema.ts`
```ts
// داخل customers: defineTable({ ... })
skippedDates: v.optional(v.array(v.string())),   // أيام التوصيل المتخطّاة yyyy-MM-dd
loyaltyPoints: v.optional(v.number()),           // نقاط الولاء
referredBy: v.optional(v.string()),              // كود من أحاله (اختياري)
```
وأضف على `notifications`: `targetCustomerId: v.optional(v.id("customers")),` وindex `.index("by_targetCustomer", ["targetCustomerId", "isRead"])`. وأضف للـtype enum `v.literal("ORDER_REJECTED")` إن رغبت (أو استخدم "SYSTEM").

### 8ب) الباك إند — `convex/customers.ts`
```ts
export const toggleSkipDay = mutation({ args: { id: v.id("customers"), date: v.string() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id); if (!c) return null;
    const cur: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    const exists = cur.includes(args.date);
    const next = exists ? cur.filter((d) => d !== args.date) : [...cur, args.date].sort();
    await ctx.db.patch(args.id, { skippedDates: next, updatedAt: Date.now() });
    return { skipped: !exists, skippedDates: next };
}});

export const setSubscriptionActive = mutation({ args: { id: v.id("customers"), active: v.boolean() },
  handler: async (ctx, args) => { await ctx.db.patch(args.id, { isActive: args.active, updatedAt: Date.now() }); return { isActive: args.active }; }});
```
- في `convex/customerAuth.ts` (دالة `getProfile`): أضف لكائن الاشتراك المُرجَع: `skippedDates`, `loyaltyPoints`, و`referralCode` (اشتقاق: `"ADR-" + customer._id.slice(-6).toUpperCase()`).
- في `convex/customerOrders.ts`: تأكد من وجود `getByPhone(phone)` لجلب الطلبات (موجود غالبًا). 

### 8ج) إشعارات العميل — `convex/notifications.ts`
```ts
export const listForCustomer = query({ args: { customerId: v.id("customers"), onlyUnread: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("notifications").withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId)).collect();
    rows = rows.sort((a, z) => z.createdAt - a.createdAt).slice(0, 50);
    return args.onlyUnread ? rows.filter((n) => !n.isRead) : rows;
}});
export const markAllAsReadForCustomer = mutation({ args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const open = await ctx.db.query("notifications").withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId).eq("isRead", false)).collect();
    for (const n of open) await ctx.db.patch(n._id, { isRead: true, readAt: Date.now() });
    return { success: true, count: open.length };
}});
```

### 8د) إنشاء إشعارات + نقاط عند تغيّر حالة الطلب
- في `customerOrders.approve` (بعد الاعتماد): أنشئ إشعارًا للعميل `targetCustomerId = effectiveCustomerId`, `type: "ORDER_APPROVED"`, `link: "/customer/profile"`. وامنح **+10 نقاط**: `await ctx.db.patch(customerId, { loyaltyPoints: (cur||0) + 10 })`.
- في `customerOrders.reject`: إن كان للطلب `customerId` أنشئ إشعارًا `type: "SYSTEM"` بسبب الرفض.
- في `dailyPlans` عند DELIVERED: إن كان للخطة `customerId` أنشئ إشعار `type: "MEAL_DELIVERED"` للعميل.

### 8هـ) الواجهة (CustomerProfile.tsx — هوية cyan الحالية)
أضف بطاقات (بنفس ستايل الكروت البيضاء الحالية):
- **تنبيهاتك**: قائمة من `useQuery(api.notifications.listForCustomer, { customerId })` مع تمييز غير المقروء + زر "تعليم الكل كمقروء".
- **إدارة الاشتراك**: زر إيقاف/استئناف (`setSubscriptionActive`) + شبكة أيام التوصيل القادمة (10 أيام) كل يوم قابل للتخطّي (`toggleSkipDay`).
- **الولاء والإحالة**: رصيد النقاط + كود الإحالة (نسخ) + شرح.
- **سجل الطلبات**: من `getByPhone` مع شارات الحالة.
> استخدم `convex.query/convex.mutation` أو `useQuery/useMutation` حسب نمط الصفحة الحالي.

---

# 9) شاشة الأخصائي — تبديل وجبات في مراجعة الطلب 🔥

في `client/src/pages/OrderReviewDetail.tsx` (شاشة مراجعة الطلب): زر التعديل ✏️ بجوار كل وجبة يفتح منتقي وجبات بديلة.
- استعلام الوجبات: `useQuery(api.publicMeals.listMeals, {})` (الوجبات بالصور).
- التبديل: `useMutation(api.customerOrders.updateOrderItemMeal)` (موجودة غالبًا؛ إن لم تكن، أضفها: تحدّث `customerOrderItems` بالحقول الجديدة وتعيد حساب إجماليات الطلب).
- عند اختيار وجبة: نادِ updateOrderItemMeal بـ `{ itemId, newMealId, newMealNameAr, newMealNameEn, newCalories, newProtein, newCarbs, newFats, newCategory, newImageUrl, newPriceQAR }` — ثم تتحدّث الشاشة تلقائيًا.
- اجعل صفحة الأخصائي الرئيسية قائمة المراجعة: في `client/src/lib/permissions.ts` غيّر `ROLE_HOME.NUTRITIONIST` إلى `/orders/pending`.

---

# 10) تحسين مسارات التوصيل

في `client/src/pages/Delivery.tsx`:
- استخرج "المنطقة" من العنوان: `addr.split(/[,،\-|]/)[0].trim()`.
- رتّب محطات اليوم حسب المنطقة، وأضف فواصل مناطق + رقم تسلسلي لكل محطة + ملخص (N محطة على M منطقة).
- فعّل زر الخريطة: `window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address))`.
- (أدرينالين cyan — أبقِ الألوان cyan/blue كما هي.)

---

# مرجع سريع: ما لا يُنقل
- **إصلاحات التباين (dark-on-dark)** الخاصة بالمصك **لا تنطبق** هنا — أدرينالين فاتح/cyan أصلًا.
- لا تنقل ملفات `convex/_generated/api.ts` أو `client/src/lib/backend/*` أو `lib/supabase.ts` من المصك — هذه خاصة بمحوّل Supabase ولا علاقة لها بأدرينالين.
- بعد كل إضافة دالة/جدول: `npx convex dev` ثم اختبر في المتصفح.

## ترتيب البناء المقترح
المخزون أولًا (1 تنبيهات → 2 أوامر شراء → 3 جرد → 4 وحدات → 5 تنبيهات تلقائية → 6 إصلاح الأرقام → 7 موردين)، ثم العميل (8)، ثم الأخصائي (9)، ثم التوصيل (10).
