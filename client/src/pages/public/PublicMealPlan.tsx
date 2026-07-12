/**
 * @file client/src/pages/public/PublicMealPlan.tsx
 * @description صفحة جدول وجبات العميل العامة (برابط سرّي planToken).
 *   تُرسَل للعميل بالواتساب فيفتحها على موبايله — عربي سليم، صور، متجاوبة.
 *   بديل الـ PDF الثقيل على الجوال.
 * @convex convex/customerOrders.ts (publicMealPlan)
 */
import { useRoute } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { Loader2, MapPin, UtensilsCrossed } from "lucide-react";

const DAY_AR: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الإثنين", tuesday: "الثلاثاء",
  wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة",
};
const DAY_EN: Record<string, string> = {
  saturday: "Saturday", sunday: "Sunday", monday: "Monday", tuesday: "Tuesday",
  wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
};
const CAT_AR: Record<string, string> = { breakfast: "فطور", lunch: "غداء", dinner: "عشاء", snack: "سناك", salad: "سلطة" };
const CAT_EN: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", salad: "Salad" };

export default function PublicMealPlan() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const [, params] = useRoute("/plan/:token");
  const token = params?.token || "";
  const data = useQuery(api.customerOrders.publicMealPlan, token ? { token } : "skip") as any;

  if (data === undefined) {
    return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>;
  }
  if (data === null) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center" style={{ fontFamily: "Cairo, sans-serif" }}>
        <div>
          <div className="h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3"><MapPin className="h-8 w-8 text-slate-300" /></div>
          <p className="font-black text-slate-700">{t("رابط غير صالح", "Invalid link")}</p>
          <p className="text-sm text-slate-400 mt-1">{t("تأكّد من الرابط المُرسل إليك", "Please check the link sent to you")}</p>
        </div>
      </div>
    );
  }

  const dayName = (d: string) => (isRtl ? DAY_AR[d] : DAY_EN[d]) || d;
  const catName = (c: string) => (isRtl ? CAT_AR[c] : CAT_EN[c]) || c;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50" style={{ fontFamily: "Cairo, sans-serif" }}>
      {/* Header */}
      <div className="text-white px-5 pb-6" style={{ background: "linear-gradient(135deg, #0E2A4A, #0E76AC)", paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black tracking-widest opacity-80">ADRENALINE · {t("جدول وجباتك", "Your meal plan")}</div>
            <h1 className="text-2xl font-black mt-1">{data.customerName} 👋</h1>
            <p className="text-sm text-cyan-100/90 font-bold mt-1">
              {data.totalMeals} {t("وجبة", "meals")} · {data.weeksCount} {t("أسبوع", "weeks")}
            </p>
          </div>
          <div className="text-end shrink-0">
            <div className="text-lg font-black leading-none">ADRENALINE</div>
            <div className="text-[8px] tracking-[0.3em] opacity-80 mt-1">HEALTHY FOOD</div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {data.weeks.map((wk: any) => (
          <div key={wk.week}>
            {data.weeksCount > 1 && (
              <div className="rounded-xl bg-[#eaf3fb] border border-[#cfe4f3] text-[#0E2A4A] font-black text-sm px-4 py-2 mb-3">
                🗓️ {t("الأسبوع", "Week")} {wk.week}
              </div>
            )}
            <div className="space-y-3">
              {wk.days.map((d: any) => (
                <div key={d.day} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                  <div className="bg-[#0E2A4A] text-white px-4 py-2 flex items-center justify-between">
                    <span className="font-black text-sm">{dayName(d.day)}</span>
                    <span className="text-[11px] bg-white/15 rounded-full px-2.5 py-0.5">{d.meals.length} {t("وجبة", "meals")}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5">
                    {d.meals.map((m: any, i: number) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-[#f7fbfe] overflow-hidden">
                        <div className="relative h-20 bg-[#eaf3fb]">
                          {m.imageUrl
                            ? <img src={m.imageUrl} alt={m.mealNameAr} className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full grid place-items-center text-slate-300"><UtensilsCrossed className="h-6 w-6" /></div>}
                          {m.category && (
                            <span className="absolute top-1.5 start-1.5 text-[9px] font-black text-[#0E76AC] bg-white/90 px-1.5 py-0.5 rounded-md">
                              {catName(m.category)}
                            </span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-black text-[12.5px] leading-tight text-[#0E2A4A] line-clamp-2">{isRtl ? m.mealNameAr : (m.mealNameEn || m.mealNameAr)}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10.5px] font-bold text-[#47759c]">
                            {m.calories ? <span>{m.calories} {t("سعرة", "kcal")}</span> : null}
                            {m.protein ? <span>🥩 {m.protein}g</span> : null}
                          </div>
                          {m.notes && (
                            <p className="mt-1 text-[9.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 leading-snug">📝 {m.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-[11px] text-slate-300 pt-2">Adrenaline Healthy Food · {t("جدول وجباتك", "Your meal plan")}</p>
      </div>
    </div>
  );
}
