/**
 * @file convex/nameStyle.ts
 * @description توحيد نمط أسماء الوجبات — معاينة ثم تطبيق.
 *
 *   ═══ الإنجليزي: Title Case ═══
 *   كان مخلوطاً: 157 وجبة Title Case · 22 مخلوط · 11 ALL CAPS.
 *   القرار: Title Case (النمط الغالب أصلاً والمعتاد في المنيوهات).
 *   الكلمات الوظيفية (with/and/in…) تبقى صغيرة — إلا في أول الاسم.
 *   الاختصارات المعروفة تبقى كما هي (BBQ, POS).
 *
 *   ═══ العربي: توحيد المصطلح ═══
 *   العربية بلا حالة أحرف؛ اللخبطة في المفردات: ساندويتش/شطيرة، راب/لفافة،
 *   سلمون/سالمون، روبيان/جمبري… نختار مصطلحاً واحداً لكل معنى.
 *
 *   ⚠️ الاسم الذي يراه المشترك — لا نغيّر معنى، فقط النمط والمفردة.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** كلمات تبقى صغيرة داخل الاسم (لا في أوله). */
const SMALL = new Set(["with", "and", "in", "on", "of", "the", "a", "an", "or"]);
/** أسماء تُكتب بحالتها كما هي — لا تُطبَّق عليها القاعدة. */
const KEEP: Record<string, string> = {
  bbq: "BBQ", periperi: "PeriPeri", no: "No",
};

/**
 * Title Case لكل كلمة.
 *
 * ⚠️ «w/» اختصار with — يُكتب صغيراً كبقية الكلمات الوظيفية، سواء جاء
 *    منفصلاً («W/ MASHED») أو ملزوقاً («W/RICE»). بلا هذه المعالجة يخرج
 *    «w/ Mashed» صغيراً و«W/Rice» كبيراً في نفس المنيو.
 */
function titleCase(s: string): string {
  return String(s || "").trim().split(/\s+/).filter(Boolean)
    .map((w, i) => {
      const low = w.toLowerCase();
      if (KEEP[low]) return KEEP[low];
      if (i > 0 && SMALL.has(low)) return low;
      if (low === "w/") return i === 0 ? "W/" : "w/";
      // «W/RICE» → «w/Rice» : الاختصار صغير والكلمة بعده Title
      if (low.startsWith("w/")) {
        const rest = low.slice(2);
        return (i === 0 ? "W/" : "w/") + (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "");
      }
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
}

/**
 * توحيد المفردات العربية — المصطلح المختار مقابل بدائله.
 *
 * ⚠️ لا نستخدم \b: في JavaScript حدّ الكلمة يعتمد على [A-Za-z0-9_] فلا
 *    يتعرّف على الحروف العربية إطلاقاً — القاعدة لن تُطابق شيئاً بصمت.
 *    لذلك نقسم الاسم إلى كلمات ونستبدل الكلمة كاملة.
 *
 * ⚠️ والكلمة قد تأتي معرّفة بـ«ال» («كاري الجمبري») — نجرّد الأداة قبل
 *    البحث ونعيدها بعده، وإلا فاتت الصيغة المعرّفة بصمت.
 */
const AR_TERMS: Record<string, string> = {
  "شطيرة": "ساندويتش", "سندويش": "ساندويتش", "ساندوتش": "ساندويتش",
  "لفافة": "راب", "لفافه": "راب", "لفائف": "راب",
  "مكرونة": "باستا", "معكرونة": "باستا",
  "سالمون": "سلمون",
  "جمبري": "روبيان", "شرمب": "روبيان",
  "سيزار": "سيزر",
  "حساء": "شوربة",
  "كروسان": "كرواسون",
  "بانكيك": "بان كيك",
};

function arWord(w: string): string {
  if (AR_TERMS[w]) return AR_TERMS[w];
  if (w.startsWith("ال")) {
    const bare = w.slice(2);
    const hit = AR_TERMS[bare];
    if (hit) return "ال" + hit;
  }
  return w;
}

function arNorm(s: string): string {
  return String(s || "").trim().split(/\s+/).filter(Boolean).map(arWord).join(" ");
}

async function plan(ctx: any) {
  const meals = await ctx.db.query("publicMeals").collect();
  const rows: any[] = [];
  for (const m of meals as any[]) {
    const en = titleCase(m.nameEn);
    const ar = arNorm(m.nameAr);
    if (en !== m.nameEn || ar !== m.nameAr) {
      rows.push({ id: String(m._id), fromEn: m.nameEn, toEn: en, fromAr: m.nameAr, toAr: ar });
    }
  }
  return rows;
}

/** 🔍 معاينة — لا تكتب شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    return {
      total: rows.length,
      enOnly: rows.filter((r) => r.fromEn !== r.toEn && r.fromAr === r.toAr).length,
      arOnly: rows.filter((r) => r.fromAr !== r.toAr && r.fromEn === r.toEn).length,
      both: rows.filter((r) => r.fromEn !== r.toEn && r.fromAr !== r.toAr).length,
      rows,
    };
  },
});

/** ✅ تطبيق — ADMIN فقط. الاسم فقط؛ لا جدولة ولا سعر ولا صورة. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    let updated = 0;
    for (const r of rows) {
      const cur: any = await ctx.db.get(r.id as any);
      // 🔒 نتخطّى لو الصف تغيّر بعد المعاينة
      if (!cur || cur.nameEn !== r.fromEn || cur.nameAr !== r.fromAr) continue;
      await ctx.db.patch(r.id as any, { nameEn: r.toEn, nameAr: r.toAr });
      updated++;
    }
    return { updated };
  },
});
