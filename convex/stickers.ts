// convex/stickers.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

type PlanStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARED"
  | "DELIVERED"
  | "CANCELLED";

function isPrintableStatus(s: any) {
  const x = String(s || "").toUpperCase() as PlanStatus;
  return x !== "DRAFT" && x !== "CANCELLED";
}

function isoToDDMMYYYY(iso: string) {
  // iso = yyyy-MM-dd
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function normalizePhone(input: any) {
  const s = String(input ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return digits || "";
}

function buildModifierText(
  modifierIds: string[] | undefined,
  modifiers: any[],
) {
  const ids = modifierIds || [];
  if (!ids.length) return "";

  const picked = ids
    .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
    .filter(Boolean);

  if (!picked.length) return "";

  const groups: Array<"AVOID" | "PREF" | "PORTION"> = [
    "AVOID",
    "PREF",
    "PORTION",
  ];

  const lines = groups
    .map((g) => {
      const names = picked
        .filter((m: any) => m.group === g)
        .map((m: any) => m.name);

      if (!names.length) return null;
      return `${g}: ${names.join(", ")}`;
    })
    .filter(Boolean) as string[];

  return lines.join(" | ");
}

/**
 * ✅ IMPORTANT:
 * الواجهة بتنادي api.stickers.get
 * فهنا لازم يكون export const get = query(...)
 */
export const get = query({
  args: {
    date: v.string(), // yyyy-MM-dd
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
  },
  handler: async (ctx, args) => {
    // 1) Plans of date + deliveryTime (confirmed only)
    const plansAll = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    const plans = plansAll.filter(
      (p: any) =>
        String(p.deliveryTime || "") === args.deliveryTime &&
        isPrintableStatus(p.status),
    );

    if (!plans.length) {
      return { boxStickers: [], mealStickers: [] };
    }

    // 2) Load customers for this session's plans
    const customerIds = Array.from(
      new Set(plans.map((p: any) => String(p.customerId))),
    );

    const customers = await Promise.all(
      customerIds.map((id) => ctx.db.get(id as any)),
    );

    const customerMap = new Map<string, any>();
    customers
      .filter(Boolean)
      .forEach((c: any) => customerMap.set(String(c._id), c));

    // 0) الترقيم اليومي التسلسلي: فقط عملاء هذه الجلسة مرتبين أبجدياً
    // الشيف يرى أرقاماً من 1 لـ N كل يوم — بسيط ومنطقي للمطبخ
    const sessionCustomers = Array.from(customerMap.values())
      .sort((a, b) =>
        String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar")
      );

    const customerNoById = new Map<string, number>();
    sessionCustomers.forEach((c, idx) => {
      customerNoById.set(String(c._id), idx + 1);
    });

    // 3) Collect menuItemIds from plans
    const menuItemIds = new Set<string>();
    plans.forEach((p: any) => {
      (p.items || []).forEach((it: any) => {
        if (it?.isOff) return;
        if (it?.menuItemId) menuItemIds.add(String(it.menuItemId));
      });
    });

    const menuItems = await Promise.all(
      Array.from(menuItemIds).map((id) => ctx.db.get(id as any)),
    );

    const menuMap = new Map<string, any>();
    menuItems
      .filter(Boolean)
      .forEach((m: any) => menuMap.set(String(m._id), m));

    // 4) Modifiers
    const portion = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PORTION"))
      .collect();

    const avoid = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "AVOID"))
      .collect();

    const pref = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PREF"))
      .collect();

    const modifiers = [...portion, ...avoid, ...pref];

    const dateText = isoToDDMMYYYY(args.date);

    // ✅ تواريخ الإنتاج والصلاحية (يوم الإنتاج + يومين)
    const prodDate = dateText;
    const expDateObj = (() => {
      const d = new Date(args.date);
      d.setDate(d.getDate() + 2);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy}`;
    })();
    const expDate = expDateObj;

    // helper: استخراج تحذيرات نظيفة (avoid + allergies) كنص قصير
    const buildWarnings = (cust: any, modifierIds: string[] | undefined) => {
      const parts: string[] = [];
      // من العميل
      const allergies = String(cust?.allergies || "").trim();
      const custAvoid = String(cust?.avoid || "").trim();
      if (allergies) parts.push(allergies);
      if (custAvoid) parts.push(custAvoid);
      // من الـ modifiers (AVOID فقط)
      const ids = modifierIds || [];
      const avoidMods = ids
        .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
        .filter((m: any) => m && m.group === "AVOID")
        .map((m: any) => m.name);
      if (avoidMods.length) parts.push(avoidMods.join(", "));
      return parts.join(" • ");
    };

    // ---------- Build BOX stickers ----------
    const boxBase = plans
      .map((p: any) => {
        const c = customerMap.get(String(p.customerId));
        if (!c) return null;

        const planLabel =
          (c.packageLabel && String(c.packageLabel).trim()) ||
          (c.program && String(c.program).trim()) ||
          "DIET";

        const customerId = String(c._id);
        const customerNo = customerNoById.get(customerId) ?? 0;

        return {
          customerId,
          customerNo,
          customerName: c.fullName || "",
          customerNumber: normalizePhone(c.phone) || "",
          deliveryTime: args.deliveryTime,
          planLabel,
          dateText,
          prodDate,
          expDate,
        };
      })
      .filter(Boolean) as any[];

    // ترتيب البوكس حسب رقم العميل الحقيقي (مش الاسم)
    boxBase.sort((a, b) => (a.customerNo ?? 0) - (b.customerNo ?? 0));

    // وده الناتج النهائي (خليت slNo = customerNo علشان الواجهة القديمة لو بتستخدمه)
    const boxStickers = boxBase.map((b) => ({
      ...b,
      slNo: b.customerNo, // ✅ نفس رقم العميل
    }));

    // ---------- Build MEAL stickers ----------
    const mealStickers: any[] = [];

    for (const p of plans) {
      const c = customerMap.get(String(p.customerId));
      if (!c) continue;

      const customerId = String(c._id);
      const customerNo = customerNoById.get(customerId) ?? 0;

      const items = (p.items || [])
        .filter((it: any) => it && !it.isOff && it.menuItemId)
        .slice();

      // ترتيب حسب meta.index لو موجود
      items.sort(
        (a: any, b: any) => (a?.meta?.index ?? 0) - (b?.meta?.index ?? 0),
      );

      let mealIndex = 1;

      for (const it of items) {
        const menu = menuMap.get(String(it.menuItemId));
        const mealName = menu?.name || "UNKNOWN";
        const calories = Number(menu?.calories ?? 0) || undefined;

        // النص الكامل للملاحظات (للنسخة القديمة)
        const modText = buildModifierText(it.modifierIds, modifiers);
        const special = String(it.specialNotes || "")
          .replace(/\[(?:⚠|✕|⚖|★)[^\]]*\]/g, "")
          .trim();

        const extraParts = [special, modText].filter(Boolean);
        const mealTitle = extraParts.length
          ? `${mealName} — ${extraParts.join(" | ")}`
          : mealName;

        // تحذيرات نظيفة منفصلة (avoid + allergies)
        const warnings = buildWarnings(c, it.modifierIds);

        mealStickers.push({
          customerId,
          customerNo,
          customerName: c.fullName || "",
          mealName,           // ✅ اسم الوجبة فقط (نظيف)
          mealTitle,          // النسخة القديمة (للتوافق)
          warnings,           // ✅ تحذيرات منفصلة
          caloriesText: calories ? `${calories} CAL` : "",
          dateText,
          prodDate,           // ✅ تاريخ الإنتاج
          expDate,            // ✅ تاريخ الصلاحية (+2 أيام)
          mealIndexText: `MEAL ${mealIndex}`,
        });

        mealIndex++;
      }
    }

    // ترتيب الوجبات حسب رقم العميل ثم رقم الوجبة
    mealStickers.sort((a, b) => {
      const n = (a.customerNo ?? 0) - (b.customerNo ?? 0);
      if (n !== 0) return n;

      const ai = Number(String(a.mealIndexText).replace(/\D/g, "")) || 0;
      const bi = Number(String(b.mealIndexText).replace(/\D/g, "")) || 0;
      return ai - bi;
    });

    return { boxStickers, mealStickers };
  },
});
