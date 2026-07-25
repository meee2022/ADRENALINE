// convex/purchaseInvoices.ts
/**
 * استيراد فاتورة شراء: من سطر الفاتورة نبني المخزن نفسه.
 * لكل سطر: يُطابَق الصنف أو يُنشأ، ويُربَط بالمورّد بسعره، ويدخل الرصيد.
 * هكذا يمتلئ المخزن من الفواتير الفعلية بدل إدخال ألف صنف يدوياً.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireRole, requireStaff, requireAdmin } from "./sessions";

const INV_ROLES = ["INVENTORY_MANAGER"];

/** توحيد الاسم للمطابقة: حروف وأرقام فقط، بلا فواصل أو مسافات زائدة. */
function normKey(s: string): string {
  return String(s || "")
    .toUpperCase()
    .replace(/[‏‎]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * تصنيف الصنف من اسمه. قائمة كلمات صريحة — ولو لم يطابق شيئاً يرجع "other"
 * ولا يُخمَّن، فالتصنيف الخاطئ أسوأ من غير المصنَّف ويُصحَّح يدوياً بضغطة.
 */
const CATEGORY_RULES: Array<[string, string[]]> = [
  ["proteins", ["chicken", "beef", "tenderloin", "meat", "fish", "salmon", "shrimp", "tuna", "turkey", "lamb", "دجاج", "لحم", "سمك", "بقر", "روبيان"]],
  ["dairy", ["milk", "cheese", "yoghurt", "yogurt", "labneh", "cream", "butter", "laban", "حليب", "جبن", "زبادي", "لبنة", "قشطة", "زبدة"]],
  ["vegetables", ["potato", "onion", "tomato", "pepper", "lettuce", "spinach", "rocca", "cabbage", "broccoli", "brocoli", "mushroom", "zucchini", "leek", "asparagus", "corn", "garlic", "coriander", "بطاطس", "بصل", "طماطم", "فلفل", "خس", "سبانخ", "كرنب", "بروكلي", "فطر", "كوسة", "ثوم", "كزبرة"]],
  ["fruits", ["apple", "banana", "mango", "grape", "berry", "berries", "strawberry", "pomegranate", "lemon", "تفاح", "موز", "مانجو", "عنب", "توت", "فراولة", "رمان", "ليمون"]],
  ["dry_goods", ["rice", "pasta", "macarona", "flour", "sugar", "oats", "dal", "lentil", "starch", "أرز", "رز", "مكرونة", "دقيق", "سكر", "شوفان", "عدس", "نشا"]],
  ["oils", ["oil", "olive", "زيت"]],
  ["spices", ["seasoning", "cummin", "cumin", "coriander seed", "cardamom", "turmeric", "bouillon", "maggi", "spice", "بهار", "كمون", "هيل", "كركم", "مرقة"]],
  ["sauces", ["sauce", "ketchup", "mustard", "dressing", "paste", "mayonnaise", "vinegar", "صلصة", "كاتشب", "خردل", "معجون", "خل"]],
  ["bakery", ["chocolate", "cocoa", "icing", "honey", "peanut butter", "jam", "شوكولاتة", "عسل", "مربى"]],
  ["packaging", ["bowl", "lid", "cutlery", "gloves", "roll", "container", "bag", "foil", "cup", "box", "علبة", "غطاء", "قفاز", "كيس", "فويل"]],
];

export function guessCategory(name: string): string {
  const n = String(name || "").toLowerCase();
  for (const [cat, keys] of CATEGORY_RULES) {
    if (keys.some((k) => n.includes(k))) return cat;
  }
  return "other";
}

/** وحدة الفاتورة (CTN/PCS/BAG…) → وحدة تخزين معروفة. غير المعروف يبقى "piece". */
export function normalizeUnit(u: string): string {
  const x = String(u || "").trim().toUpperCase();
  if (["KG", "KGS", "كجم", "كيلو"].includes(x)) return "kg";
  if (["G", "GM", "GRAM", "جم"].includes(x)) return "g";
  if (["L", "LTR", "LITER", "LITRE", "لتر"].includes(x)) return "liter";
  if (["ML", "مل"].includes(x)) return "ml";
  if (["CTN", "CRT", "CX", "CARTON", "كرتون"].includes(x)) return "carton";
  if (["BAG", "كيس"].includes(x)) return "bag";
  if (["PKT", "PACK", "PKG", "باكيت"].includes(x)) return "pack";
  if (["TIN", "CAN", "علبة"].includes(x)) return "tin";
  if (["BTL", "BOTTLE", "زجاجة"].includes(x)) return "bottle";
  if (["BOX", "صندوق"].includes(x)) return "box";
  return "piece";
}

const lineValidator = v.object({
  name: v.string(),                      // اسم الصنف كما في الفاتورة
  nameAr: v.optional(v.string()),
  supplierSku: v.optional(v.string()),
  quantity: v.number(),
  unit: v.string(),                      // وحدة الفاتورة
  unitPrice: v.number(),                 // سعر وحدة الشراء
  lineTotal: v.optional(v.number()),
  packSize: v.optional(v.string()),
  category: v.optional(v.string()),      // لو حُدِّد صراحة لا نستنتج
  itemType: v.optional(v.string()),
});

/**
 * معاينة قبل الحفظ: أي سطر سينشئ صنفاً جديداً وأيه سيُطابق صنفاً قائماً.
 * تُعرض للمستخدم ليصحّح قبل أن يُكتب أي شيء.
 */
export const preview = query({
  args: { lines: v.array(lineValidator), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const items = await ctx.db.query("inventoryItems").collect();
    const byKey = new Map<string, any>();
    items.forEach((i: any) => {
      byKey.set(normKey(i.nameEn || i.nameAr), i);
      if (i.nameAr) byKey.set(normKey(i.nameAr), i);
      if (i.sku) byKey.set(normKey(i.sku), i);
    });
    return args.lines.map((l) => {
      const hit = byKey.get(normKey(l.name)) || (l.supplierSku ? byKey.get(normKey(l.supplierSku)) : null);
      return {
        name: l.name,
        matched: !!hit,
        matchedName: hit?.nameAr || hit?.nameEn || "",
        category: l.category || guessCategory(l.name),
        unit: normalizeUnit(l.unit),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      };
    });
  },
});

/**
 * استيراد الفاتورة فعلياً.
 * receiveStock=false يبني الكتالوج فقط (أصناف + موردين + أسعار) بلا تحريك رصيد،
 * وهو المطلوب عند رفع فواتير قديمة لبناء المخزن دون تزوير الأرصدة الحالية.
 */
export const importInvoice = mutation({
  args: {
    supplierName: v.string(),
    supplierPhone: v.optional(v.string()),
    // بيانات المورّد كما على وجه الفاتورة — تُحفظ على سجلّه وتُحدَّث لو تغيّرت
    supplierCr: v.optional(v.string()),
    supplierTaxNumber: v.optional(v.string()),
    supplierAddress: v.optional(v.string()),
    supplierEmail: v.optional(v.string()),
    supplierContact: v.optional(v.string()),
    invoiceNo: v.string(),
    invoiceDate: v.string(),               // yyyy-MM-dd
    lpoNo: v.optional(v.string()),
    deliveryNo: v.optional(v.string()),
    salesman: v.optional(v.string()),
    receivedBy: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    total: v.optional(v.number()),
    discount: v.optional(v.number()),
    vat: v.optional(v.number()),
    notes: v.optional(v.string()),
    receiveStock: v.optional(v.boolean()), // افتراضياً لا نحرّك الرصيد
    lines: v.array(lineValidator),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, INV_ROLES);

    // منع الاستيراد مرتين لنفس رقم الفاتورة
    const dup = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_invoiceNo", (q) => q.eq("invoiceNo", args.invoiceNo))
      .first();
    if (dup) {
      return { ok: false, reason: "DUPLICATE", invoiceNo: args.invoiceNo, message: "الفاتورة مستوردة من قبل" };
    }

    // 1) المورّد: يُطابَق بالاسم الموحّد أو يُنشأ
    const suppliers = await ctx.db.query("suppliers").collect();
    let supplier: any = suppliers.find((s: any) => normKey(s.name) === normKey(args.supplierName));
    let supplierCreated = false;
    if (!supplier) {
      const sid = await ctx.db.insert("suppliers", {
        name: args.supplierName,
        phone: args.supplierPhone,
        crNumber: args.supplierCr,
        taxNumber: args.supplierTaxNumber,
        address: args.supplierAddress,
        email: args.supplierEmail,
        contactName: args.supplierContact || args.salesman,
        paymentTerms: args.paymentTerms,
        isActive: true,
        createdAt: Date.now(),
      });
      supplier = await ctx.db.get(sid);
      supplierCreated = true;
    } else {
      // نملأ الفراغات فقط — لا نمسح بيانات مُدخلة يدوياً ببيانات فاتورة ناقصة
      const fill: any = {};
      if (!supplier.phone && args.supplierPhone) fill.phone = args.supplierPhone;
      if (!supplier.crNumber && args.supplierCr) fill.crNumber = args.supplierCr;
      if (!supplier.taxNumber && args.supplierTaxNumber) fill.taxNumber = args.supplierTaxNumber;
      if (!supplier.address && args.supplierAddress) fill.address = args.supplierAddress;
      if (!supplier.email && args.supplierEmail) fill.email = args.supplierEmail;
      if (!supplier.contactName && (args.supplierContact || args.salesman)) {
        fill.contactName = args.supplierContact || args.salesman;
      }
      if (!supplier.paymentTerms && args.paymentTerms) fill.paymentTerms = args.paymentTerms;
      if (Object.keys(fill).length) await ctx.db.patch(supplier._id, fill);
    }
    const supplierId = supplier._id as Id<"suppliers">;

    // 2) فهرس الأصناف الحالية للمطابقة
    const items = await ctx.db.query("inventoryItems").collect();
    const byKey = new Map<string, any>();
    items.forEach((i: any) => {
      byKey.set(normKey(i.nameEn || i.nameAr), i);
      if (i.nameAr) byKey.set(normKey(i.nameAr), i);
    });

    const now = Date.now();
    let itemsCreated = 0, itemsMatched = 0, linksCreated = 0, linksUpdated = 0, received = 0;
    const createdNames: string[] = [];

    for (const l of args.lines) {
      const unit = normalizeUnit(l.unit);
      const key = normKey(l.name);
      let item: any = byKey.get(key);

      if (!item) {
        const id = await ctx.db.insert("inventoryItems", {
          nameAr: l.nameAr || l.name,
          nameEn: l.name,
          category: l.category || guessCategory(l.name),
          unit,
          sku: l.supplierSku,
          itemType: l.itemType || (guessCategory(l.name) === "packaging" ? "packaging" : "ingredient"),
          purchaseUnit: unit,
          purchaseToBaseFactor: 1,
          notes: l.packSize ? `عبوة: ${l.packSize}` : undefined,
          supplierId,
          minStock: 0,
          targetStock: 0,
          currentStock: 0,
          avgWeeklyUsage: 0,
          createdAt: now,
          updatedAt: now,
        });
        item = await ctx.db.get(id);
        byKey.set(key, item);
        itemsCreated++;
        if (createdNames.length < 100) createdNames.push(l.name);
      } else {
        itemsMatched++;
      }

      // 3) ربط الصنف بهذا المورّد بسعره — الصنف الواحد يأتي من أكثر من مورّد
      const existingLink = await ctx.db
        .query("itemSuppliers")
        .withIndex("by_item_supplier", (q) => q.eq("itemId", item._id).eq("supplierId", supplierId))
        .first();
      if (existingLink) {
        await ctx.db.patch(existingLink._id, {
          lastUnitCost: l.unitPrice,
          lastPurchasedAt: args.invoiceDate,
          timesPurchased: Number(existingLink.timesPurchased || 0) + 1,
          supplierSku: l.supplierSku || existingLink.supplierSku,
          packSize: l.packSize || existingLink.packSize,
          purchaseUnit: l.unit || existingLink.purchaseUnit,
        });
        linksUpdated++;
      } else {
        await ctx.db.insert("itemSuppliers", {
          itemId: item._id,
          supplierId,
          supplierSku: l.supplierSku,
          supplierItemName: l.name,
          purchaseUnit: l.unit,
          packSize: l.packSize,
          lastUnitCost: l.unitPrice,
          lastPurchasedAt: args.invoiceDate,
          timesPurchased: 1,
          createdAt: now,
        });
        linksCreated++;
      }

      // 4) الرصيد — اختياري
      if (args.receiveStock && l.quantity > 0) {
        await ctx.db.insert("inventoryBatches", {
          itemId: item._id,
          quantityReceived: l.quantity,
          quantityRemaining: l.quantity,
          unitCost: l.unitPrice,
          supplierId,
          receivedAt: args.invoiceDate,
          notes: `فاتورة ${args.invoiceNo}`,
        });
        await ctx.db.insert("inventoryMovements", {
          itemId: item._id,
          type: "receive",
          quantity: l.quantity,
          unitCost: l.unitPrice,
          supplierId,
          referenceType: "purchaseInvoice",
          referenceId: args.invoiceNo,
          note: `فاتورة ${args.invoiceNo}`,
          createdAt: now,
        });
        const fresh: any = await ctx.db.get(item._id);
        await ctx.db.patch(item._id, {
          currentStock: Number(fresh.currentStock || 0) + l.quantity,
          updatedAt: now,
        });
        received++;
      }
    }

    // 5) رأس الفاتورة للمرجع والتدقيق
    const computedTotal = args.lines.reduce(
      (s, l) => s + (Number(l.lineTotal) || Number(l.quantity) * Number(l.unitPrice)), 0,
    );
    await ctx.db.insert("purchaseInvoices", {
      supplierId,
      supplierName: args.supplierName,
      invoiceNo: args.invoiceNo,
      invoiceDate: args.invoiceDate,
      lpoNo: args.lpoNo,
      deliveryNo: args.deliveryNo,
      salesman: args.salesman,
      receivedBy: args.receivedBy,
      dueDate: args.dueDate,
      paymentTerms: args.paymentTerms,
      currency: "QAR",
      subtotal: computedTotal,
      discount: args.discount,
      vat: args.vat,
      total: Number(args.total ?? computedTotal),
      lineCount: args.lines.length,
      notes: args.notes,
      createdAt: now,
    });

    return {
      ok: true, supplierCreated, supplierName: args.supplierName, invoiceNo: args.invoiceNo,
      lines: args.lines.length, itemsCreated, itemsMatched, linksCreated, linksUpdated, received,
      createdNames,
    };
  },
});

/** موردو صنف معيّن مرتّبين بالأرخص — للمقارنة عند الشراء. */
export const suppliersOfItem = query({
  args: { itemId: v.id("inventoryItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const links = await ctx.db
      .query("itemSuppliers")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    const out = [];
    for (const l of links) {
      const s: any = await ctx.db.get(l.supplierId);
      out.push({
        supplierId: String(l.supplierId),
        supplierName: s?.name || "",
        supplierSku: l.supplierSku,
        purchaseUnit: l.purchaseUnit,
        packSize: l.packSize,
        lastUnitCost: l.lastUnitCost,
        lastPurchasedAt: l.lastPurchasedAt,
        timesPurchased: l.timesPurchased,
        isPreferred: l.isPreferred,
      });
    }
    return out.sort((a, b) => Number(a.lastUnitCost ?? 1e9) - Number(b.lastUnitCost ?? 1e9));
  },
});

export const listInvoices = query({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_date")
      .order("desc")
      .take(Math.min(Number(args.limit) || 50, 200));
  },
});

/** حذف فاتورة مستوردة (لإعادة الاستيراد بعد تصحيح). لا يمسّ الأصناف. */
export const deleteInvoice = mutation({
  args: { id: v.id("purchaseInvoices"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return true;
  },
});
