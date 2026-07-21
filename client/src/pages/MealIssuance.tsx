/**
 * @file client/src/pages/MealIssuance.tsx
 * @description حصر الوجبات الصادرة داخليًا (مدير/موظفين/تجربة/ضيافة/هدر) + تقرير يومي/شهري.
 * @convex convex/mealIssuances.ts
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { openPrintDoc } from "@/lib/printDoc";
import { useStore } from "@/lib/store";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ClipboardList, Search, Trash2, Printer, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);

const CATS = [
  { key: "MANAGER", ar: "مدير الفرع", en: "Manager", color: "#0E76AC", bg: "#e8f4fb" },
  { key: "STAFF", ar: "موظفين", en: "Staff", color: "#7c3aed", bg: "#f3e8ff" },
  { key: "TASTING", ar: "تجربة وتذوق", en: "Tasting", color: "#0891b2", bg: "#ecfeff" },
  { key: "GUEST", ar: "ضيافة", en: "Guest", color: "#16a34a", bg: "#dcfce7" },
  { key: "WASTE", ar: "هدر/تالف", en: "Waste", color: "#dc2626", bg: "#fef2f2" },
] as const;
const catInfo = (k: string) => CATS.find((c) => c.key === k) || { key: k, ar: k, en: k, color: "#64748b", bg: "#f1f5f9" };

const MENU_CATS = [
  { key: "all", ar: "الكل", en: "All" },
  { key: "breakfast", ar: "فطار", en: "Breakfast" },
  { key: "lunch", ar: "غدا", en: "Lunch" },
  { key: "dinner", ar: "عشا", en: "Dinner" },
  { key: "salad", ar: "سلطات", en: "Salads" },
  { key: "snack", ar: "سناك", en: "Snacks" },
];

export default function MealIssuance() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());
  const [q, setQ] = useState("");
  const [menuCat, setMenuCat] = useState("all");

  const meals = (useQuery(api.publicMeals.list, { sessionToken }) as any[] | undefined) || [];
  const rows = (useQuery(api.mealIssuances.listByDate, { date, sessionToken }) as any[] | undefined) || [];
  const summary = useQuery(api.mealIssuances.summary, { date, month, sessionToken }) as any;

  const logM = useMutation(api.mealIssuances.log);
  const removeM = useMutation(api.mealIssuances.remove);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return meals
      .filter((m: any) => m.isActive !== false)
      .filter((m: any) => menuCat === "all" || m.category === menuCat)
      .filter((m: any) => !s || (m.nameAr || "").toLowerCase().includes(s) || (m.nameEn || "").toLowerCase().includes(s))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [meals, q, menuCat]);

  // ---- dialog for logging an issuance ----
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [cat, setCat] = useState<string>("STAFF");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const openMeal = (m: any) => {
    setSel(m); setQty(1); setCat("STAFF"); setRecipient(""); setNote(""); setOpen(true);
  };

  const save = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await logM({
        date,
        mealName: isRtl ? (sel.nameAr || sel.nameEn) : (sel.nameEn || sel.nameAr),
        publicMealId: sel._id,
        quantity: qty,
        category: cat as any,
        recipient: recipient.trim() || undefined,
        note: note.trim() || undefined,
        sessionToken,
      });
      setOpen(false);
    } catch (e: any) {
      void alertDialog({ message: e?.message || t("فشل التسجيل", "Failed") });
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!(await confirmDialog({ message: t("هل تريد حذف هذا السجل؟", "Delete this entry?"), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;
    try { await removeM({ id: id as any, sessionToken }); } catch (e: any) { void alertDialog({ message: e?.message || "err" }); }
  };

  const dayTotal = summary?.day?.total ?? 0;
  const monthTotal = summary?.month?.total ?? 0;

  // ---- طباعة تقرير الحصر ----
  const handlePrint = () => {
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const mc = summary?.month?.byCategory || {};
    const catRows = CATS.map((c) => `<tr><td class="r">${isRtl ? c.ar : c.en}</td><td class="c b">${mc[c.key] || 0}</td></tr>`).join("");
    const mealRows = (summary?.month?.byMeal || []).map((m: any, i: number) => `<tr><td class="c">${i + 1}</td><td class="r">${esc(m.name)}</td><td class="c b">${m.qty}</td></tr>`).join("");
    const recRows = (summary?.month?.byRecipient || []).map((m: any) => `<tr><td class="r">${esc(m.name)}</td><td class="c b">${m.qty}</td></tr>`).join("");
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=800"><title>${isRtl ? "حصر الصادر" : "Issuance Report"} ${esc(month)}</title>
      <style>*{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}body{margin:0;padding:16px;color:#0f1516}
      h1{font-size:20px;margin:0} .sub{color:#47759c;font-weight:700;font-size:13px;margin:2px 0 12px}
      h2{font-size:15px;margin:16px 0 6px;border-top:2px solid #0E76AC;padding-top:8px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
      th{background:#0E76AC;color:#fff;padding:7px 6px;font-weight:800}td{padding:6px;border:1px solid #e3ebf2}
      .c{text-align:center}.r{text-align:right;font-weight:600}.b{font-weight:900;color:#0E76AC}
      .kpi{display:inline-block;border:1px solid #cdd9e4;border-radius:10px;padding:8px 16px;margin-inline-end:8px;text-align:center}
      .kpi .v{font-size:22px;font-weight:900;color:#0E76AC}.kpi .l{font-size:11px;color:#47759c}
      @page{size:A4;margin:12mm}</style></head><body>
      <h1>${isRtl ? "حصر الوجبات الصادرة" : "Meals Issued Report"} — ADRENALINE</h1><div class="sub">${isRtl ? "الشهر" : "Month"}: ${esc(month)}</div>
      <div class="kpi"><div class="v">${monthTotal}</div><div class="l">${isRtl ? "إجمالي الصادر بالشهر" : "Total issued this month"}</div></div>
      <h2>${isRtl ? "حسب السبب" : "By reason"}</h2><table><thead><tr><th>${isRtl ? "السبب" : "Reason"}</th><th>${isRtl ? "العدد" : "Count"}</th></tr></thead><tbody>${catRows}</tbody></table>
      <h2>${isRtl ? "حسب الوجبة" : "By meal"}</h2><table><thead><tr><th>#</th><th>${isRtl ? "الوجبة" : "Meal"}</th><th>${isRtl ? "العدد" : "Count"}</th></tr></thead><tbody>${mealRows || '<tr><td colspan=3 class=c>—</td></tr>'}</tbody></table>
      <h2>${isRtl ? "حسب المستلم" : "By recipient"}</h2><table><thead><tr><th>${isRtl ? "المستلم" : "Recipient"}</th><th>${isRtl ? "العدد" : "Count"}</th></tr></thead><tbody>${recRows || '<tr><td colspan=2 class=c>—</td></tr>'}</tbody></table>
      </body></html>`;
    openPrintDoc(html, {
      fileName: `${isRtl ? "حصر الصادر" : "Meal issuance report"} - ADRENALINE - ${month}`,
      isRtl,
      width: 900,
    });
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="حصر الصادر" titleEn="Meal Issuance"
        subtitleAr="حصر الوجبات الصادرة من المطبخ (إدارة، موظفون، تجربة، ضيافة، هدر)"
        subtitleEn="Track meals issued from the kitchen (manager/staff/tasting/guest/waste)"
        kpis={summary ? [
          { value: dayTotal, labelAr: "صادر اليوم", labelEn: "Today" },
          { value: monthTotal, labelAr: "صادر الشهر", labelEn: "This Month" },
        ] : undefined}
        actions={
          <Button onClick={handlePrint} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm">
            <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("تقرير شهري", "Monthly Report")}
          </Button>
        }
      />

      {/* controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("اليوم", "Day")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full sm:w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("شهر التقرير", "Report month")}</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-full sm:w-[150px]" />
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          <Label className="text-xs text-gray-500">{t("بحث عن وجبة", "Search meal")}</Label>
          <div className="relative">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400", isRtl ? "right-3" : "left-3")} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("اكتب اسم الوجبة...", "Type meal name...")} className={cn("h-10", isRtl ? "pr-9" : "pl-9")} />
          </div>
        </div>
      </div>

      {/* running totals by category (today) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CATS.map((c) => (
          <div key={c.key} className="rounded-xl px-3 py-2 text-center" style={{ background: c.bg, border: `1px solid ${c.color}30` }}>
            <div className="text-2xl font-black tabular-nums" style={{ color: c.color }}>{summary?.day?.byCategory?.[c.key] ?? 0}</div>
            <div className="text-[11px] font-bold" style={{ color: c.color }}>{isRtl ? c.ar : c.en}</div>
          </div>
        ))}
      </div>

      {/* menu category filter */}
      <div className="flex flex-wrap gap-2">
        {MENU_CATS.map((c) => (
          <button key={c.key} onClick={() => setMenuCat(c.key)}
            className={cn("px-3 h-9 rounded-lg text-sm font-bold border", menuCat === c.key ? "bg-[#0E76AC] text-white border-[#0E76AC]" : "bg-white text-gray-600 border-gray-200")}>
            {isRtl ? c.ar : c.en}
          </button>
        ))}
      </div>

      {/* menu grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((m: any) => (
          <button key={m._id} onClick={() => openMeal(m)}
            className="text-start bg-white rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04)" }}>
            <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
              {m.imageUrl ? <img src={m.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ClipboardList /></div>}
            </div>
            <div className="p-2.5">
              <div className="text-sm font-bold text-[#0f1516] line-clamp-1">{isRtl ? m.nameAr : (m.nameEn || m.nameAr)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{m.calories} {t("سعرة", "cal")}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center text-gray-400 py-8">{t("لا توجد وجبات", "No meals")}</div>}
      </div>

      {/* today's issuances */}
      <div>
        <h3 className="text-sm font-bold text-[#47759c] mb-2">{t(`صادر ${date}`, `Issued ${date}`)} ({rows.length})</h3>
        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400" style={{ border: "1px solid #e8eef4" }}>{t("لا توجد عمليات صرف مسجّلة اليوم حتى الآن", "Nothing issued today yet")}</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4" }}>
            {rows.map((r: any) => {
              const ci = catInfo(r.category);
              return (
                <div key={r._id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-gray-100">
                  <span className="text-lg font-black tabular-nums text-[#0E76AC] w-8 text-center">{r.quantity}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#0f1516] truncate">{r.mealName}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {r.recipient ? r.recipient + " · " : ""}{r.note || ""}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: ci.bg, color: ci.color }}>{isRtl ? ci.ar : ci.en}</span>
                  {isAdmin && <button onClick={() => del(r._id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* log dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader><DialogTitle>{sel ? (isRtl ? sel.nameAr : (sel.nameEn || sel.nameAr)) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* quantity */}
            <div>
              <Label className="text-xs text-gray-500">{t("الكمية", "Quantity")}</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus className="h-4 w-4" /></Button>
                <span className="text-2xl font-black w-12 text-center tabular-nums">{qty}</span>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setQty((n) => n + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {/* category */}
            <div>
              <Label className="text-xs text-gray-500">{t("لمين / السبب", "For / reason")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {CATS.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCat(c.key)}
                    className={cn("h-11 rounded-xl text-sm font-bold border transition-all", cat === c.key ? "text-white" : "bg-white")}
                    style={cat === c.key ? { background: c.color, borderColor: c.color } : { color: c.color, borderColor: c.color + "40" }}>
                    {isRtl ? c.ar : c.en}
                  </button>
                ))}
              </div>
            </div>
            {/* recipient */}
            <div>
              <Label className="text-xs text-gray-500">{t("اسم المستلم (اختياري)", "Recipient (optional)")}</Label>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t("مثلاً: أحمد / مدير الفرع", "e.g. Ahmed / Manager")} className="h-10 mt-1" />
            </div>
            {/* note */}
            <div>
              <Label className="text-xs text-gray-500">{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10 mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">{t("إلغاء", "Cancel")}</Button>
            <Button onClick={save} disabled={saving} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {saving ? "..." : t(`تسجيل ${qty}`, `Log ${qty}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
