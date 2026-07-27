/**
 * @file client/src/pages/GymSales.tsx
 * @description مبيعات الجم — POS مقسّم بالتبويبات: نقطة بيع + سجل + تقارير + إدارة الجمات + أسعار الجم.
 * @convex convex/gymSales.ts
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Dumbbell, Plus, Receipt, ClipboardList, BarChart3, Settings, Search, Printer, ChefHat, Coffee, Salad, Cookie, Utensils, Save, X, Building2, Check, ListChecks, PackageX, Pencil, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmDialog, promptDialog } from "@/lib/dialogs";
import { useToast } from "@/hooks/use-toast";

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayStr().slice(0, 7);

type Tab = "pos" | "history" | "returns" | "reports" | "items" | "gyms";
type CatKey = "breakfast" | "lunch" | "dinner" | "salad" | "snack" | "all";

const CAT_META: Record<CatKey, { ar: string; en: string; icon: any; color: string }> = {
  all:       { ar: "الكل",   en: "All",       icon: Utensils, color: "#0E76AC" },
  breakfast: { ar: "فطور",  en: "Breakfast", icon: Coffee,   color: "#f59e0b" },
  lunch:     { ar: "غداء",  en: "Lunch",     icon: ChefHat,  color: "#16a34a" },
  dinner:    { ar: "عشاء",  en: "Dinner",    icon: Utensils, color: "#7c3aed" },
  salad:     { ar: "سلطة",  en: "Salad",     icon: Salad,    color: "#0891b2" },
  snack:     { ar: "سناك",  en: "Snack",     icon: Cookie,   color: "#dc2626" },
};

type CartLine = {
  mealId: string | null;
  nameEn: string;
  nameAr: string;
  qty: number;
  listPrice: number;
  unitPrice: number;
};

export default function GymSales() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("pos");
  const gyms = useQuery(api.gymSales.listGyms, { sessionToken }) as any[] | undefined;
  const [selectedGymId, setSelectedGymId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedGymId && gyms && gyms.length > 0) setSelectedGymId(gyms[0].id);
  }, [gyms, selectedGymId]);

  const noGyms = gyms && gyms.length === 0;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="gym-sales-page min-h-full">
      <div className="gym-sales-header max-w-7xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Dumbbell className="h-6 w-6" />}
          titleAr="مبيعات المنافذ"
          titleEn="Outlet Sales"
          subtitleAr="نقطة بيع + تقارير"
          subtitleEn="POS + reports"
        />
      </div>

      <div className="gym-sales-content max-w-7xl mx-auto px-4 pb-10">
        {/* Tabs */}
        <div className="gym-sales-tabs mt-4 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-300/80 bg-slate-200/70 p-1.5 shadow-inner sm:grid-cols-7">
          {([
            ["pos",     Receipt,       t("نقطة البيع",  "POS")],
            ["history", ClipboardList, t("السجل",       "History")],
            ["returns", PackageX,      t("المرتجعات",   "Returns")],
            ["reports", BarChart3,     t("التقارير",    "Reports")],
            ["items",   ListChecks,    t("أصناف المنافذ",  "Outlet Items")],
            ["gyms",    Building2,     t("المنافذ",      "Outlets")],
          ] as [Tab, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-bold transition-all",
                tab === k ? "bg-[#0E76AC] text-white shadow-[0_4px_12px_rgba(14,118,172,.28)]" : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* No gyms yet */}
        {noGyms && tab !== "gyms" && (
          <Card className="rounded-2xl mt-4 border-amber-200 bg-amber-50">
            <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-amber-800 font-bold">{t("لم تتم إضافة منفذ بعد، ابدأ من تبويب «المنافذ»", "No outlet yet. Start from the Outlets tab.")}</p>
              <Button onClick={() => setTab("gyms")} style={{ background: "#0E76AC", color: "#fff" }}>
                <Plus className="h-4 w-4 mr-1" /> {t("أضف منفذاً", "Add outlet")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="gym-tab-body mt-4">
          {tab === "pos"     && <PosTab     isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
          {tab === "history" && <HistoryTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} toast={toast} />}
          {tab === "returns" && <ReturnsTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
          {tab === "reports" && <ReportsTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} />}
          {tab === "items"   && <OutletItemsTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
          {tab === "gyms"    && <GymsTab    isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} toast={toast} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ POS Tab ═══════════════════════════════ */

function PosTab({ isRtl, t, sessionToken, gyms, selectedGymId, setSelectedGymId, toast }: any) {
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatKey>("all");
  const [saving, setSaving] = useState(false);
  const [scanOn, setScanOn] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const meals = useQuery(
    api.gymSales.listMealsForGym,
    selectedGymId ? { gymId: selectedGymId as any, sessionToken } : "skip"
  ) as any[] | undefined;
  const createOrder = useMutation(api.gymSales.createOrder);

  const currentGym = gyms.find((g: any) => g.id === selectedGymId);

  const filtered = useMemo(() => {
    if (!meals) return [];
    const qq = q.trim().toLowerCase();
    return meals.filter((m: any) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (!qq) return true;
      return String(m.nameEn).toLowerCase().includes(qq) || String(m.nameAr).toLowerCase().includes(qq);
    });
  }, [meals, cat, q]);

  const addToCart = (m: any) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.mealId === m.id);
      if (idx >= 0) {
        const cp = [...prev]; cp[idx] = { ...cp[idx], qty: cp[idx].qty + 1 }; return cp;
      }
      return [...prev, { mealId: m.id, nameEn: m.nameEn, nameAr: m.nameAr, qty: 1, listPrice: m.listPrice, unitPrice: m.effectivePrice }];
    });
  };

  /* ── الإدخال بالماسح ──
     الماسح يعمل كلوحة مفاتيح: يكتب الرقم ثم Enter. المطابقة تتم على الجهاز من
     قائمة أصناف المنفذ المحمّلة أصلاً — الماسح أسرع من استعلام لكل مسحة. */
  const mealByBarcode = useMemo(() => {
    const m = new Map<string, any>();
    // الصنف قد يحمل أكثر من استيكر — كلها تفتح على نفس الوجبة
    (meals || []).forEach((x: any) => (x.barcodes || []).forEach((b: string) => m.set(String(b), x)));
    return m;
  }, [meals]);

  useEffect(() => { if (scanOn) scanRef.current?.focus(); }, [scanOn]);

  const onScan = (raw: string) => {
    const code = String(raw || "").replace(/\s+/g, "").trim();
    if (!code) return;
    const meal = mealByBarcode.get(code);
    if (!meal) {
      setScanMsg(t(`⚠ ${code} — باركود غير معروف في هذا المنفذ`, `⚠ ${code} — unknown barcode for this outlet`));
      return;
    }
    addToCart(meal);
    setScanMsg(`✓ ${isRtl ? (meal.nameAr || meal.nameEn) : (meal.nameEn || meal.nameAr)}`);
  };

  const setLineQty = (i: number, qty: number) => setCart((p) => {
    const cp = [...p]; cp[i] = { ...cp[i], qty: Math.max(0, qty) }; return cp.filter((l) => l.qty > 0);
  });
  const setLinePrice = (i: number, price: number) => setCart((p) => {
    const cp = [...p]; cp[i] = { ...cp[i], unitPrice: Math.max(0, price) }; return cp;
  });
  const removeLine = (i: number) => setCart((p) => p.filter((_, k) => k !== i));

  const totals = useMemo(() => {
    let subtotal = 0, total = 0, mealsCount = 0;
    for (const l of cart) {
      subtotal += l.listPrice * l.qty;
      total += l.unitPrice * l.qty;
      mealsCount += l.qty;
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      discount: Math.round((subtotal - total) * 100) / 100,
      mealsCount,
    };
  }, [cart]);

  const save = async () => {
    if (!selectedGymId) return toast({ title: t("اختر المنفذ", "Select an outlet") });
    if (cart.length === 0) return toast({ title: t("أضف وجبة على الأقل", "Add at least one item") });
    setSaving(true);
    try {
      await createOrder({
        date,
        gymId: selectedGymId as any,
        lines: cart.map((l) => ({
          mealId: l.mealId as any,
          mealNameEn: l.nameEn,
          mealNameAr: l.nameAr,
          qty: l.qty,
          listPrice: l.listPrice,
          unitPrice: l.unitPrice,
        })),
        notes: notes || undefined,
        sessionToken,
      });
      toast({ title: t("تم حفظ الطلبية ✓", "Order saved ✓") });
      setCart([]); setNotes("");
    } catch (e: any) {
      toast({ title: t("فشل الحفظ", "Save failed"), description: e?.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="gym-pos-layout grid grid-cols-1 min-[850px]:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-4">
      {/* Left: meal grid */}
      <div className="min-w-0 space-y-3">
        {/* Header controls */}
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-500 font-bold">{t("التاريخ", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-bold">{t("المنفذ", "Outlet")}</Label>
              <select value={selectedGymId || ""} onChange={(e) => setSelectedGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-bold">{t("الخصم المطبَّق", "Applied discount")}</Label>
              <div className="h-10 flex items-center px-3 rounded-lg bg-emerald-50 border border-emerald-200 font-black text-emerald-700 text-sm">
                {currentGym ? `${currentGym.discountPct}%` : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search + categories */}
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute h-4 w-4 top-3 start-3 text-slate-400 pointer-events-none" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث عن وجبة…", "Search meals…")} className="h-10 ps-9" />
              </div>
              <button
                type="button"
                onClick={() => { setScanOn((v) => !v); setScanMsg(""); }}
                className={cn("flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition-colors",
                  scanOn ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
              >
                <ScanLine className="h-4 w-4" />{t("ماسح", "Scan")}
              </button>
            </div>

            {/* حقل المسح — يبقى مركَّزاً حتى لا تضيع مسحة */}
            {scanOn && (
              <div className="rounded-xl border-2 border-[#0E76AC]/30 bg-[#0E76AC]/[0.04] p-3">
                <Input
                  ref={scanRef}
                  dir="ltr"
                  className="h-12 text-center text-base font-black tracking-widest"
                  placeholder={t("وجّه الماسح على الباركود…", "Point the scanner…")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    onScan((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onBlur={(e) => setTimeout(() => e.target.focus(), 0)}
                />
                {scanMsg && (
                  <p className={cn("mt-2 text-center text-sm font-black",
                    scanMsg.startsWith("⚠") ? "text-rose-600" : "text-emerald-600")}>{scanMsg}</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CAT_META) as CatKey[]).map((k) => {
                const M = CAT_META[k]; const Icon = M.icon; const active = cat === k;
                return (
                  <button
                    key={k}
                    onClick={() => setCat(k)}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold border transition-all",
                      active ? "text-white shadow-md" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                    style={active ? { background: M.color, borderColor: M.color } : {}}
                  >
                    <Icon className="h-3.5 w-3.5" /> {isRtl ? M.ar : M.en}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="gym-pos-meals grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {(!meals) && <p className="col-span-full text-center text-sm text-slate-500 py-8">{t("جاري التحميل…", "Loading…")}</p>}
          {meals && filtered.length === 0 && <p className="col-span-full text-center text-sm text-slate-500 py-8">{t("لا توجد وجبات مطابقة", "No matching meals")}</p>}
          {filtered.map((m: any) => (
            <button
              key={m.id}
              onClick={() => addToCart(m)}
              className="gym-meal-tile rounded-lg bg-white border border-slate-200 hover:border-[#0E76AC] hover:shadow-md active:scale-95 transition-all p-3 text-start"
            >
              <p className="font-bold text-sm text-slate-900 line-clamp-2 min-h-[2.5rem]">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: (CAT_META[m.category as CatKey] || CAT_META.all).color + "20", color: (CAT_META[m.category as CatKey] || CAT_META.all).color }}>
                  {isRtl ? (CAT_META[m.category as CatKey]?.ar || m.category) : (CAT_META[m.category as CatKey]?.en || m.category)}
                </span>
                <span className="text-sm font-black text-[#0E76AC]">{m.effectivePrice.toFixed(2)}</span>
              </div>
              {m.isCustom ? (
                <span className="mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">{t("سعر المنفذ", "outlet price")}</span>
              ) : m.listPrice === 0 ? (
                <span className="mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">{t("لا يوجد سعر", "no price")}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Right: cart */}
      <div className="min-w-0">
        <Card className="gym-pos-cart rounded-2xl border-slate-200 min-[850px]:sticky min-[850px]:top-3">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-black text-slate-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#0E76AC]" /> {t("الفاتورة", "Invoice")}
              <span className="ms-auto text-xs font-bold text-slate-500">{cart.length} {t("صنف", "items")} · {totals.mealsCount} {t("وجبة", "meals")}</span>
            </h3>

            <div className="gym-pos-cart-lines max-h-[420px] overflow-y-auto -mx-2 px-2 divide-y divide-slate-100">
              {cart.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">{t("اضغط على وجبة لإضافتها", "Click a meal to add it")}</p>
              )}
              {cart.map((l, i) => (
                <div key={i} className="py-2 flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 min-w-0 font-bold text-sm text-slate-900 truncate">{isRtl ? (l.nameAr || l.nameEn) : (l.nameEn || l.nameAr)}</p>
                    <button onClick={() => removeLine(i)} className="text-red-500 hover:bg-red-50 rounded p-0.5"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg">
                      <button onClick={() => setLineQty(i, l.qty - 1)} className="w-7 h-7 text-slate-600 hover:bg-slate-100 rounded-s-lg">−</button>
                      <input type="number" value={l.qty} onChange={(e) => setLineQty(i, Number(e.target.value) || 0)} className="w-10 h-7 text-center bg-transparent font-black text-sm" />
                      <button onClick={() => setLineQty(i, l.qty + 1)} className="w-7 h-7 text-slate-600 hover:bg-slate-100 rounded-e-lg">+</button>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      × <input type="number" step="0.01" value={l.unitPrice} onChange={(e) => setLinePrice(i, Number(e.target.value) || 0)} className="w-14 h-7 text-center border border-slate-200 rounded font-bold" />
                    </div>
                    <span className="ms-auto font-black text-[#0E76AC] text-sm">{(l.qty * l.unitPrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 text-sm">
              {/* أسعار المنيو الرسمية لم تُضبط بعد — نستخدم أسعار الجم مباشرة
                  بدون عرض "خصم" لتفادي أي لخبطة. */}
              <div className="flex justify-between items-baseline text-lg font-black text-[#0E76AC]">
                <span>{t("الإجمالي المستحق", "Total due")}</span>
                <span>{totals.total.toFixed(2)} {t("ر.ق", "QAR")}</span>
              </div>
            </div>

            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ملاحظات (اختياري)", "Notes (optional)")} className="text-sm" />

            <div className="flex gap-2">
              <Button disabled={saving || cart.length === 0} onClick={save} className="flex-1 h-11 text-white font-black" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
                <Save className="h-4 w-4 me-2" />{saving ? t("جاري الحفظ…", "Saving…") : t("احفظ الطلبية", "Save order")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || cart.length === 0}
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: t("إلغاء الفاتورة", "Cancel invoice"),
                    message: t("مسح كل الأصناف؟", "Clear all items?"),
                    variant: "danger",
                    confirmText: t("إلغاء الفاتورة", "Clear"),
                    cancelText: t("رجوع", "Back"),
                  });
                  if (ok) { setCart([]); setNotes(""); }
                }}
                className="h-11 px-4 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                title={t("إلغاء الفاتورة كلها", "Cancel whole invoice")}
                aria-label={t("إلغاء الفاتورة كلها", "Cancel whole invoice")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ History Tab ═══════════════════════════════ */

function HistoryTab({ isRtl, t, sessionToken, gyms, toast }: any) {
  const [from, setFrom] = useState(thisMonth() + "-01");
  const [to, setTo] = useState(todayStr());
  const [gymId, setGymId] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(todayStr());
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<any[]>([]);
  const [newEditMealId, setNewEditMealId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const list = useQuery(api.gymSales.listOrders, { from, to, gymId: (gymId || undefined) as any, sessionToken }) as any;
  const openOrder = useQuery(api.gymSales.getOrder, openId ? { orderId: openId as any, sessionToken } : "skip") as any;
  const editOrder = useQuery(api.gymSales.getOrder, editId ? { orderId: editId as any, sessionToken } : "skip") as any;
  const editMeals = useQuery(api.gymSales.listMealsForGym, editOrder?.gymId ? { gymId: editOrder.gymId as any, sessionToken } : "skip") as any[] | undefined;
  const deleteOrder = useMutation(api.gymSales.deleteOrder);
  const updateOrder = useMutation(api.gymSales.updateOrder);

  useEffect(() => {
    if (!editOrder) return;
    setEditDate(editOrder.date);
    setEditNotes(editOrder.notes || "");
    setEditLines(editOrder.lines.filter((line: any) => line.mealId).map((line: any) => ({ ...line })));
    setNewEditMealId("");
  }, [editOrder?.id]);

  const changeEditQty = (mealId: string, qty: number) => {
    setEditLines((lines) => lines
      .map((line) => line.mealId === mealId ? { ...line, qty: Math.max(0, Math.round(qty || 0)) } : line)
      .filter((line) => line.qty > 0));
  };

  const addEditMeal = () => {
    if (!newEditMealId) return;
    const meal = editMeals?.find((item: any) => item.id === newEditMealId);
    if (!meal) return;
    setEditLines((lines) => {
      const existing = lines.find((line) => line.mealId === meal.id);
      if (existing) return lines.map((line) => line.mealId === meal.id ? { ...line, qty: line.qty + 1 } : line);
      return [...lines, { mealId: meal.id, mealNameAr: meal.nameAr, mealNameEn: meal.nameEn, qty: 1 }];
    });
    setNewEditMealId("");
  };

  const saveEditedOrder = async () => {
    if (!editOrder || editLines.length === 0) return;
    setEditSaving(true);
    try {
      const result = await updateOrder({
        orderId: editOrder.id as any,
        date: editDate,
        gymId: editOrder.gymId as any,
        lines: editLines.map((line) => ({ mealId: line.mealId as any, qty: line.qty })),
        notes: editNotes || undefined,
        sessionToken,
      });
      toast({ title: t("تم تعديل الفاتورة ✓", "Invoice updated ✓"), description: `${result.mealsCount} ${t("وجبة", "meals")} · ${result.total.toFixed(2)} ${t("ر.ق", "QAR")}` });
      setEditId(null);
    } catch (e: any) {
      toast({ title: t("فشل تعديل الفاتورة", "Update failed"), description: e?.message });
    } finally {
      setEditSaving(false);
    }
  };

  const voidOrder = async (order: any) => {
    const reason = await promptDialog({
      title: t("إلغاء الفاتورة التجريبية", "Void invoice"),
      message: t(`سيتم إلغاء فاتورة ${order.gymName} بتاريخ ${order.date} مع الاحتفاظ بها في سجل التدقيق. اكتب سبب الإلغاء.`, `The ${order.gymName} invoice dated ${order.date} will be voided and retained in the audit trail. Enter a reason.`),
      placeholder: t("مثال: فاتورة تجريبية", "Example: Test invoice"),
      minLength: 3,
      confirmText: t("إلغاء الفاتورة", "Void invoice"),
      cancelText: t("رجوع", "Back"),
      variant: "danger",
    });
    if (!reason) return;
    try {
      await deleteOrder({ orderId: order.id as any, reason, sessionToken });
      toast({ title: t("تم إلغاء الفاتورة ✓", "Invoice voided ✓") });
      if (openId === order.id) setOpenId(null);
      if (editId === order.id) setEditId(null);
    } catch (e: any) {
      toast({ title: t("فشل إلغاء الفاتورة", "Failed to void invoice"), description: e?.message });
    }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("من", "From")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("إلى", "To")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("المنفذ", "Outlet")}</Label>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">{t("كل المنافذ", "All outlets")}</option>
              {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-sky-50 border border-sky-200 px-2 py-1.5 text-center">
                <p className="text-[10px] font-bold text-sky-700">{t("وجبات", "meals")}</p>
                <p className="font-black text-sky-900">{list?.totalMeals ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-center">
                <p className="text-[10px] font-bold text-emerald-700">{t("إيراد", "revenue")}</p>
                <p className="font-black text-emerald-900">{list?.totalRevenue?.toFixed(2) ?? "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-start p-3">{t("التاريخ", "Date")}</th>
                <th className="text-start p-3">{t("المنفذ", "Outlet")}</th>
                <th className="text-center p-3">{t("وجبات", "Meals")}</th>
                <th className="text-end p-3">{t("الإجمالي", "Total")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(list?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold">{r.date}</td>
                  <td className="p-3">{r.gymName}</td>
                  <td className="p-3 text-center font-black">{r.mealsCount}</td>
                  <td className="p-3 text-end">
                    <div className="font-black text-[#0E76AC]">{Number(r.netTotal ?? r.total).toFixed(2)}</div>
                    {r.returnedTotal > 0 && <div className="mt-0.5 text-[10px] font-bold text-red-600">{t("هالك", "Waste")}: {r.wasteValue.toFixed(2)} · {r.returnedTotal} {t("مرتجع", "returned")}</div>}
                  </td>
                  <td className="p-3 text-end whitespace-nowrap">
                    <button onClick={() => { setEditId(editId === r.id ? null : r.id); setOpenId(null); }} className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      <Pencil className="h-3.5 w-3.5" />
                      {editId === r.id ? t("إغلاق التعديل", "Close edit") : t("تعديل", "Edit")}
                    </button>
                    <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="ms-3 text-xs font-bold text-[#0E76AC] hover:underline">
                      {openId === r.id ? t("إغلاق", "Close") : t("تفاصيل", "Details")}
                    </button>
                    <button onClick={() => voidOrder(r)} className="ms-3 text-xs font-bold text-red-600 hover:underline">
                      {t("إلغاء", "Void")}
                    </button>
                  </td>
                </tr>
              ))}
              {(!list || list.rows.length === 0) && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8">{t("لا توجد طلبيات", "No orders")}</td></tr>
              )}
            </tbody>
          </table>
          </div>

          {editId && editOrder && (
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h4 className="font-black text-slate-900">{t("تعديل الفاتورة", "Edit invoice")} · {editOrder.gymName}</h4>
                  <p className="text-xs font-bold text-slate-500">#{String(editOrder.id).slice(-6).toUpperCase()}</p>
                </div>
                <div className="w-full sm:w-44"><Label className="text-xs font-bold text-slate-500">{t("التاريخ", "Date")}</Label><Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-10" /></div>
              </div>

              <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                <select value={newEditMealId} onChange={(e) => setNewEditMealId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
                  <option value="">{t("اختر صنفًا لإضافته…", "Choose an item to add…")}</option>
                  {(editMeals || []).map((meal: any) => <option key={meal.id} value={meal.id}>{isRtl ? (meal.nameAr || meal.nameEn) : (meal.nameEn || meal.nameAr)} · {meal.effectivePrice.toFixed(2)}</option>)}
                </select>
                <Button type="button" variant="outline" onClick={addEditMeal} disabled={!newEditMealId}><Plus className="me-1 h-4 w-4" />{t("إضافة صنف", "Add item")}</Button>
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {editLines.map((line) => (
                  <div key={line.mealId} className="flex flex-wrap items-center gap-3 p-3">
                    <p className="min-w-0 flex-1 font-bold text-slate-900">{isRtl ? (line.mealNameAr || line.mealNameEn) : (line.mealNameEn || line.mealNameAr)}</p>
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
                      <button type="button" onClick={() => changeEditQty(line.mealId, line.qty - 1)} className="h-9 w-9 hover:bg-slate-100">−</button>
                      <input type="number" min="1" value={line.qty} onChange={(e) => changeEditQty(line.mealId, Number(e.target.value))} className="h-9 w-14 bg-transparent text-center font-black" />
                      <button type="button" onClick={() => changeEditQty(line.mealId, line.qty + 1)} className="h-9 w-9 hover:bg-slate-100">+</button>
                    </div>
                    <button type="button" onClick={() => setEditLines((lines) => lines.filter((item) => item.mealId !== line.mealId))} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={t("حذف الصنف", "Remove item")}><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {editLines.length === 0 && <p className="p-6 text-center text-sm font-bold text-red-600">{t("يجب أن تحتوي الفاتورة على صنف واحد على الأقل", "Invoice must contain at least one item")}</p>}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder={t("ملاحظات الفاتورة", "Invoice notes")} />
                <div className="flex gap-2"><Button variant="outline" onClick={() => setEditId(null)}>{t("إلغاء", "Cancel")}</Button><Button onClick={saveEditedOrder} disabled={editSaving || editLines.length === 0} className="text-white" style={{ background: "#0E76AC" }}><Save className="me-1 h-4 w-4" />{editSaving ? t("جاري الحفظ…", "Saving…") : t("حفظ التعديلات", "Save changes")}</Button></div>
              </div>
            </div>
          )}

          {openId && openOrder && (
            <div className="border-t-2 border-slate-100 bg-slate-50 p-4">
              <h4 className="font-black mb-2">{t("أسطر الطلبية", "Order lines")} — {openOrder.date} · {openOrder.gymName}</h4>
              {openOrder.returnedTotal > 0 && <div className="mb-3 grid grid-cols-3 gap-2">
                <StatMini label={t("المرتجع", "Returned")} value={openOrder.returnedTotal} color="#dc2626" />
                <StatMini label={t("قيمة الهالك", "Waste value")} value={openOrder.wasteValue.toFixed(2)} color="#dc2626" />
                <StatMini label={t("صافي الفاتورة", "Net invoice")} value={openOrder.netTotal.toFixed(2)} color="#0E76AC" />
              </div>}
              <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr><th className="text-start p-2">{t("الوجبة", "Meal")}</th><th className="text-center p-2">{t("الكمية", "Qty")}</th><th className="text-center p-2">{t("المرتجع", "Returned")}</th><th className="text-end p-2">{t("سعر الوحدة", "Unit")}</th><th className="text-end p-2">{t("الهالك", "Waste")}</th><th className="text-end p-2">{t("الإجمالي", "Total")}</th></tr>
                </thead>
                <tbody>
                  {openOrder.lines.map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="p-2 font-bold">{isRtl ? (l.mealNameAr || l.mealNameEn) : (l.mealNameEn || l.mealNameAr)}</td>
                      <td className="p-2 text-center">{l.qty}</td>
                      <td className="p-2 text-center font-black text-red-600">{l.returnedQty || 0}</td>
                      <td className="p-2 text-end">{l.unitPrice.toFixed(2)}</td>
                      <td className="p-2 text-end font-bold text-red-600">{Number(l.wasteValue || 0).toFixed(2)}</td>
                      <td className="p-2 text-end font-black text-[#0E76AC]">{l.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Reports Tab ═══════════════════════════════ */

function ReportsTab({ isRtl, t, sessionToken, gyms }: any) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "custom">("month");
  const [month, setMonth] = useState(thisMonth());
  const [anchorDate, setAnchorDate] = useState(todayStr());
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [gymId, setGymId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  /** محتوى المستند. الفترة والمنفذ فلاتر مستقلة — أي مزيج شغّال
   *  (مثلاً: مرتجعات أسبوعية لمنفذ واحد، أو أعلى مبيعاً شهري لكل المنافذ). */
  const [scope, setScope] = useState<"full" | "returns" | "top" | "statement">("full");
  const selectedRange = useMemo(() => {
    if (period === "month") return { from: `${month}-01`, to: `${month}-31` };
    if (period === "custom") return { from: customFrom, to: customTo };
    if (period === "day") return { from: anchorDate, to: anchorDate };
    const date = new Date(`${anchorDate}T12:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const from = date.toISOString().slice(0, 10);
    date.setDate(date.getDate() + 6);
    return { from, to: date.toISOString().slice(0, 10) };
  }, [period, month, anchorDate, customFrom, customTo]);
  const reportArgs = period === "month"
    ? { month, gymId: (gymId || undefined) as any, sessionToken }
    : { from: selectedRange.from, to: selectedRange.to, gymId: (gymId || undefined) as any, sessionToken };
  const report = useQuery(api.gymSales.monthlyReport, reportArgs) as any;
  const returnsRep = useQuery(
    (api.gymSales as any).returnsReport,
    { from: selectedRange.from, to: selectedRange.to, gymId: (gymId || undefined) as any, sessionToken }
  ) as any;
  // تقرير القرار: الأفضل مبيعاً + الأصناف اللي بتسبب هدر + الربح (لو التكلفة معبّاة)
  const decision = useQuery(
    (api.gymSales as any).decisionReport,
    { from: selectedRange.from, to: selectedRange.to, gymId: (gymId || undefined) as any, sessionToken }
  ) as any;

  const maxDay = useMemo(() => {
    if (!report?.days?.length) return 0;
    return Math.max(...report.days.map((d: any) => d.total));
  }, [report]);
  const maxMealRevenue = useMemo(() => {
    if (!report?.meals?.length) return 0;
    return Math.max(...report.meals.map((meal: any) => meal.revenue));
  }, [report]);
  /** أعلى 6 أصناف خسارة — للشارت. الأصناف بلا هدر لا تُعرض (شريط صفر بلا معنى). */
  const wasteChart = useMemo(() => {
    const rows = (decision?.meals || []).filter((m: any) => m.wasteValue > 0);
    return [...rows].sort((a: any, b: any) => b.wasteValue - a.wasteValue).slice(0, 6);
  }, [decision]);
  const maxWaste = useMemo(
    () => (wasteChart.length ? Math.max(...wasteChart.map((m: any) => m.wasteValue)) : 0),
    [wasteChart],
  );
  /** أعلى 8 أصناف مبيعاً — decision.topSellers مرتّبة أصلاً بالاستهلاك الفعلي. */
  const topSellers = useMemo(() => (decision?.topSellers || []).slice(0, 8), [decision]);
  const maxSold = useMemo(
    () => (topSellers.length ? Math.max(...topSellers.map((m: any) => m.soldQty)) : 0),
    [topSellers],
  );
  const rangeLabel = selectedRange.from === selectedRange.to
    ? selectedRange.from
    : `${selectedRange.from} - ${selectedRange.to}`;

  /**
   * يبني مستند التقرير. نفس النص بالضبط يُعرض في المعاينة ويُطبع —
   * فاللي المدير بيشوفه هو اللي بيطلع، مفيش نسختين تفترقا.
   */
  const buildReportHtml = (): string | null => {
    if (!report) return null;
    const gym = gyms.find((g: any) => g.id === gymId);

    // 💰 الأرقام المالية من الخادم (monthlyReport) — هو المرجع، لا نحسبها هنا.
    //    ?? للطلبيات القديمة قبل ميزة المرتجعات (لا مرتجع ⇒ الصافي = الإجمالي).
    const wasteValue = Number(report.totalWasteValue || 0);
    const netRevenue = Number(report.netRevenue ?? report.totalRevenue);
    const returnedQty = Number(report.totalReturned || 0);
    const delivered = Number(report.deliveredMeals ?? report.totalMeals);
    // 📅 تاريخ محلي (قطر UTC+3) — toISOString بترجع UTC فبتدي تاريخ غلط.
    const n = new Date();
    const issuedAt = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;

    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const nameOf = (m: any) => esc(isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr));

    /* ── البطاقات حسب محتوى المستند: تقرير المرتجعات يبرز الهدر، وتقرير
          الأعلى مبيعاً يبرز الاستهلاك والإيراد — لا نحشر أرقاماً بلا صلة. ── */
    const box = (v: string, l: string, color?: string) =>
      `<div class="box"><div class="v"${color ? ` style="color:${color}"` : ""}>${v}</div><div class="l">${l}</div></div>`;
    const kpiBoxes =
      scope === "returns"
        ? [
            box(String(report.totalMeals), t("الكمية المورّدة", "Supplied")),
            box(String(returnedQty), t("المرتجع (هالك)", "Returned (waste)"), "#b91c1c"),
            box(`${decision?.totals?.wastePct ?? 0}%`, t("نسبة الارتجاع", "Return rate"), "#b91c1c"),
            box(wasteValue.toFixed(2), t("قيمة الهالك (ر.ق)", "Waste value (QAR)"), "#b91c1c"),
          ]
        : scope === "top"
          ? [
              box(String(report.totalMeals), t("الكمية المورّدة", "Supplied")),
              box(String(delivered), t("الكمية المستهلكة", "Consumed")),
              box(String((decision?.topSellers || []).length), t("عدد الأصناف المُباعة", "Items sold")),
              box(netRevenue.toFixed(2), t("صافي الإيراد (ر.ق)", "Net revenue (QAR)")),
            ]
          : [
              box(String(report.totalMeals), t("الكمية المورّدة", "Supplied")),
              box(String(delivered), t("الكمية المستهلكة", "Consumed")),
              box(String(returnedQty), t("المرتجع (هالك)", "Returned (waste)"), "#b91c1c"),
              box(wasteValue.toFixed(2), t("قيمة الهالك (ر.ق)", "Waste value (QAR)"), "#b91c1c"),
              box(netRevenue.toFixed(2), t("الصافي المستحق (ر.ق)", "Net due (QAR)")),
            ];
    /* ── تكلفة التحضير: تظهر فقط لو كل الأصناف لها تكلفة مسجّلة. القراءة
          الأساسية للتقرير على مستوى الوجبة (راح/رجع/خسر)، والتكلفة طبقة
          إضافية اختيارية — فلا نزعج المدير بتحذير عن بيانات لم يطلبها. ── */
    const cov = decision?.costCoverage;
    const profitHtml = cov?.profitAvailable
      ? `<tr class="minus"><td class="lbl">${t("يُخصم — تكلفة التحضير", "Less — preparation cost")}</td>
             <td class="val">− ${Number(decision.totals.totalCost).toFixed(2)}</td></tr>
         <tr class="profit"><td class="lbl">${t("صافي الربح", "Net profit")}</td>
             <td class="val">${Number(decision.totals.totalProfit).toFixed(2)} ${t("ر.ق", "QAR")}</td></tr>`
      : "";

    /* ── الأقسام حسب المحتوى المطلوب ──
          كامل      : كل شيء
          المرتجعات : الهدر فقط + التوصيات + الخلاصة المالية (المستحق بعد الخصم)
          أعلى مبيعاً: الأصناف المُباعة فقط — بلا جداول هدر ولا توصيات إيقاف */
    const showStatement = scope === "statement"; // كشف حساب المنفذ — مستقل، لا يخلط بباقي الأقسام
    const showFin = !showStatement && scope !== "top";
    const showDaily = scope === "full";
    const showLedger = scope === "full";
    const showReturns = scope === "full" || scope === "returns";
    const showTop = scope === "full" || scope === "top";
    const showActions = scope === "full" || scope === "returns";

    // 💵 كشف الحساب: كمية/قيمة الإنتاج، كمية/قيمة المرتجع، ثم المبيعات − العمولة = المستحق.
    //    نسبة العمولة = خصم المنفذ (discountPct، افتراضي 20). كل المنافذ ⇒ 20 افتراضياً.
    const commissionRate = Number((gym as any)?.discountPct ?? 20);
    const salesAmt = netRevenue; // = إجمالي الإنتاج − قيمة المرتجع
    const commissionAmt = Math.round(salesAmt * commissionRate) / 100;
    const receivable = Math.round((salesAmt - commissionAmt) * 100) / 100;
    const statementHtml = !showStatement ? "" : `
      <p class="stmt-intro">${t(`الأصناف الغذائية المورّدة خلال (${rangeLabel}):`, `Food items supplied during (${rangeLabel}):`)}</p>
      <table><thead>
        <tr>
          <th>${t("التاريخ", "Date")}</th>
          <th>${t("كمية الإنتاج", "Production Qty")}</th>
          <th>${t("قيمة الإنتاج", "Production Amount")}</th>
          <th>${t("كمية المرتجع", "Return Qty")}</th>
          <th>${t("قيمة المرتجع", "Return Amount")}</th>
        </tr></thead>
        <tbody>
          ${report.days.map((d: any) => `<tr><td>${d.date}</td><td class="n">${d.meals}</td><td class="n">${d.total.toFixed(2)}</td><td class="n">${d.returned || 0}</td><td class="n" style="color:${Number(d.waste) > 0 ? "#b91c1c" : "#94a3b8"}">${Number(d.waste || 0).toFixed(2)}</td></tr>`).join("")}
          <tr class="tot"><td>${t("الإجمالي", "Total")}</td><td class="n">${report.totalMeals}</td><td class="n">${report.totalRevenue.toFixed(2)}</td><td class="n">${returnedQty}</td><td class="n">${wasteValue.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <div class="fin">
        <div class="fin-h">${t("الخلاصة المالية", "Financial summary")}</div>
        <table>
          <tr><td class="lbl">${t("المبيعات (الإنتاج − المرتجع)", "Sales (production − returns)")}</td><td class="val">${salesAmt.toFixed(2)}</td></tr>
          <tr class="minus"><td class="lbl">${t("العمولة", "Commission")} (${commissionRate}%)</td><td class="val">− ${commissionAmt.toFixed(2)}</td></tr>
          <tr class="net"><td class="lbl">${t("المستحق (Receivable)", "Receivable")}</td><td class="val">${receivable.toFixed(2)} ${t("ر.ق", "QAR")}</td></tr>
        </table>
      </div>
`;

    const finHtml = !showFin ? "" : `
      <div class="fin">
        <div class="fin-h">${t("الخلاصة المالية", "Financial summary")}</div>
        <table>
          <tr><td class="lbl">${t("إجمالي التوريد", "Gross supplied")} (${report.totalMeals} ${t("وجبة", "meals")})</td>
              <td class="val">${report.totalRevenue.toFixed(2)}</td></tr>
          <tr class="minus"><td class="lbl">${t("يُخصم — قيمة المرتجع الهالك", "Less — returned (waste) value")} (${returnedQty} ${t("وجبة", "meals")})</td>
              <td class="val">− ${wasteValue.toFixed(2)}</td></tr>
          <tr class="net"><td class="lbl">${t("الصافي المستحق على المنفذ", "Net due from outlet")}</td>
              <td class="val">${netRevenue.toFixed(2)} ${t("ر.ق", "QAR")}</td></tr>
          ${profitHtml}
        </table>
      </div>
`;
    const dailyHtml = !showDaily ? "" : `
      <table><thead>
      <tr class="cap"><td colspan="5">${t("التفاصيل اليومية", "Daily breakdown")}</td></tr>
      <tr><th>${t("التاريخ", "Date")}</th><th>${t("الكمية المورّدة", "Supplied")}</th><th>${t("الإجمالي (ر.ق)", "Total (QAR)")}</th><th>${t("قيمة الهالك (ر.ق)", "Waste value (QAR)")}</th><th>${t("الصافي (ر.ق)", "Net (QAR)")}</th></tr></thead>
      <tbody>${report.days.map((d: any) => `<tr><td>${d.date}</td><td class="n">${d.meals}</td><td class="n">${d.total.toFixed(2)}</td><td class="n" style="color:${Number(d.waste) > 0 ? "#b91c1c" : "#94a3b8"}">${Number(d.waste || 0).toFixed(2)}</td><td class="n">${Number(d.net ?? d.total).toFixed(2)}</td></tr>`).join("")}
      <tr class="tot"><td>${t("الإجمالي", "Grand total")}</td><td class="n">${report.totalMeals}</td><td class="n">${report.totalRevenue.toFixed(2)}</td><td class="n">${wasteValue.toFixed(2)}</td><td class="n">${netRevenue.toFixed(2)}</td></tr></tbody></table>
      
`;
    const returnsHtml = !showReturns ? "" : `
      <table style="margin-top:20px"><thead>
      <tr class="cap"><td colspan="4">${t("المرتجعات والهالك", "Returns and waste")}</td></tr>
      <tr><th>${t("الوجبة", "Meal")}</th><th>${t("المورّد", "Supplied")}</th><th>${t("المرتجع", "Returned")}</th><th>${t("قيمة الهالك (ر.ق)", "Waste (QAR)")}</th></tr></thead>
      <tbody>${(returnsRep?.meals || []).filter((m: any) => m.returned > 0).map((m: any) => `<tr><td>${isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td><td class="n">${m.sent}</td><td class="n">${m.returned}</td><td class="n">${m.wasteValue.toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="4">${t("لا توجد مرتجعات مسجّلة خلال هذه الفترة.", "No returns recorded during this period.")}</td></tr>`}
      <tr class="tot"><td>${t("الإجمالي", "Total")}</td><td class="n">${returnsRep?.totals?.sent || 0}</td><td class="n">${returnsRep?.totals?.returned || 0}</td><td class="n">${Number(returnsRep?.totals?.wasteValue || 0).toFixed(2)}</td></tr></tbody></table>
`;

    const kpiHtml = `<div class="grid" style="grid-template-columns:repeat(${kpiBoxes.length},1fr)">${kpiBoxes.join("")}</div>`;

    /* ── قرارات مطلوبة: الأصناف اللي بتسبب هدر. أول قسم بعد الخلاصة لأنه
          السبب اللي المدير بيطلب التقرير عشانه. ── */
    const actions: any[] = decision?.actions || [];
    const actionsHtml = !showActions ? "" : actions.length
      ? `<div class="act">
          <div class="act-h">${t("التوصيات — الأصناف المسبّبة للهدر", "Recommendations — items causing waste")}</div>
          <table>
            <thead><tr><th>${t("الصنف", "Item")}</th><th>${t("المورّد", "Supplied")}</th><th>${t("المرتجع", "Returned")}</th><th>${t("نسبة الارتجاع", "Return rate")}</th><th>${t("قيمة الهالك (ر.ق)", "Waste value (QAR)")}</th><th>${t("التوصية", "Recommendation")}</th></tr></thead>
            <tbody>${actions.map((a: any) => `<tr>
              <td><b>${nameOf(a)}</b><div class="why">${esc(a.reason)}</div></td>
              <td class="n">${a.sent}</td><td class="n">${a.returned}</td>
              <td class="n" style="color:#b91c1c;font-weight:900">${a.returnRate}%</td>
              <td class="n" style="color:#b91c1c">${Number(a.wasteValue).toFixed(2)}</td>
              <td class="c"><span class="tag ${a.verdict === "STOP" ? "stop" : "red"}">${a.verdict === "STOP" ? t("إيقاف التوريد", "Discontinue") : t("تخفيض الكمية", "Reduce quantity")}</span></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>`
      : `<div class="act ok"><div class="act-h">${t("التوصيات", "Recommendations")}</div>
          <div class="none">${t("لا توجد أصناف مسبّبة للهدر خلال هذه الفترة.", "No waste-causing items during this period.")}</div></div>`;

    /* ── أفضل الوجبات مبيعاً — بالمُستهلك فعلاً (بعد خصم المرتجع)، مش المُرسل. ── */
    const top: any[] = (decision?.topSellers || []).slice(0, 8);
    const topSellersHtml = !showTop ? "" : top.length
      ? `<table style="margin-top:18px"><thead>
          <tr class="cap"><td colspan="5">${t("الأصناف الأعلى مبيعاً — حسب الاستهلاك الفعلي", "Top selling items — by actual consumption")}</td></tr>
          <tr><th>#</th><th>${t("الصنف", "Item")}</th><th>${t("المستهلك", "Consumed")}</th><th>${t("صافي الإيراد (ر.ق)", "Net revenue (QAR)")}</th><th>${t("نسبة الارتجاع", "Return rate")}</th></tr></thead>
          <tbody>${top.map((m: any, i: number) => `<tr>
            <td class="c">${i + 1}</td><td>${nameOf(m)}</td>
            <td class="n">${m.soldQty}</td><td class="n">${Number(m.netRevenue).toFixed(2)}</td>
            <td class="n" style="color:${m.returnRate >= 15 ? "#b91c1c" : "#15803d"}">${m.returnRate}%</td>
          </tr>`).join("")}</tbody></table>`
      : "";

    /* ── سجل الأصناف الكامل — القراءة الأساسية: كل صنف راح كام، رجع كام،
          خسّر كام، وصافي إيراده. مرتّب بالخسارة الأعلى أولاً عشان اللي
          بيوجع يبان فوق. (لو التقرير لسه بيحمّل نرجع للجدول القديم.) ── */
    const ledger: any[] = decision?.meals || [];
    const ledgerHtml = !showLedger ? "" : ledger.length
      ? `<table style="margin-top:20px"><thead>
          <tr class="cap"><td colspan="6">${t("بيان الأصناف — الكميات المورّدة والمرتجعة", "Item statement — supplied and returned")}</td></tr>
          <tr><th>${t("الصنف", "Item")}</th><th>${t("المورّد", "Supplied")}</th><th>${t("المرتجع", "Returned")}</th><th>${t("نسبة الارتجاع", "Return rate")}</th><th>${t("قيمة الهالك (ر.ق)", "Waste value (QAR)")}</th><th>${t("صافي الإيراد (ر.ق)", "Net revenue (QAR)")}</th></tr></thead>
          <tbody>${[...ledger].sort((a: any, b: any) => b.wasteValue - a.wasteValue || b.sent - a.sent).map((m: any) => `<tr>
            <td>${nameOf(m)}</td>
            <td class="n">${m.sent}</td>
            <td class="n" style="color:${m.returned > 0 ? "#b91c1c" : "#94a3b8"}">${m.returned}</td>
            <td class="n" style="color:${m.returnRate >= 15 ? "#b91c1c" : m.returnRate > 0 ? "#c2410c" : "#15803d"}">${m.returnRate}%</td>
            <td class="n" style="color:${m.wasteValue > 0 ? "#b91c1c" : "#94a3b8"}">${Number(m.wasteValue).toFixed(2)}</td>
            <td class="n">${Number(m.netRevenue).toFixed(2)}</td></tr>`).join("")}
          <tr class="tot"><td>${t("الإجمالي", "Total")}</td>
            <td class="n">${decision.totals.totalSent}</td>
            <td class="n">${decision.totals.totalReturned}</td>
            <td class="n">${decision.totals.wastePct}%</td>
            <td class="n">${Number(decision.totals.totalWaste).toFixed(2)}</td>
            <td class="n">${Number(decision.totals.netRevenue).toFixed(2)}</td></tr></tbody></table>`
      : `<table style="margin-top:20px"><thead>
          <tr class="cap"><td colspan="3">${t("تفصيل حسب الوجبة", "Per-meal breakdown")}</td></tr>
          <tr><th>${t("الوجبة", "Meal")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الإيراد (ر.ق)", "Revenue (QAR)")}</th></tr></thead>
          <tbody>${report.meals.map((m: any) => `<tr><td>${nameOf(m)}</td><td class="n">${m.qty}</td><td class="n">${m.revenue.toFixed(2)}</td></tr>`).join("")}</tbody></table>`;

    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(scopeTitle())} — ${rangeLabel}</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:0;color:#0f1516;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}

        /* ── ترويسة رسمية (ورق المطعم): الشعار سماوي + "HEALTHY FOOD" أسود،
              فلازم خلفية بيضا — على خلفية كحلي الكلمة السودا بتختفي. ── */
        .lh{display:flex;justify-content:space-between;align-items:flex-start;
            padding:14px 20px 12px;border-bottom:3px solid #0E76AC}
        /* الشعار في جهة النهاية والبيانات في جهة البداية — ترتيب DOM (meta ثم img)
           بيعكس نفسه تلقائياً مع dir، فعربي: بيانات يمين وشعار شمال، وإنجليزي العكس. */
        .lh img{height:38px;width:auto;display:block;flex-shrink:0}
        .lh .meta{text-align:start;font-size:10px;color:#47759c;line-height:1.7}
        .lh .meta b{color:#0E2A4A}
        .doc-t{background:#0E2A4A;color:#fff;padding:8px 20px;font-size:15px;font-weight:900;
               display:flex;justify-content:space-between;align-items:center}
        .doc-t .rng{font-size:11px;font-weight:700;opacity:.85}
        .wrap{padding:14px 20px 20px}

        table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
        th,td{border:1px solid #cdd9e4;padding:6px 8px}
        th{background:#0E76AC;color:#fff;text-align:${isRtl ? "right" : "left"}}
        td.n{text-align:${isRtl ? "left" : "right"};font-variant-numeric:tabular-nums;font-weight:700}
        tr.tot td{background:#dcebf5;color:#0E76AC;font-weight:900;font-size:13px}
        .box{border:1px solid #cdd9e4;border-radius:8px;padding:8px 12px;text-align:center}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 20px}
        .box .v{font-size:20px;font-weight:900;color:#0E76AC} .box .l{font-size:10px;color:#47759c}
        .stmt-intro{font-size:12px;font-weight:700;color:#0E2A4A;margin:8px 0 2px}
        /* عنوان الجدول جوه thead — عشان يتكرر مع سطر العناوين لما الجدول
           يتقسم على صفحتين، فما يبقاش في جدول بلا هوية في الصفحة التانية. */
        tr.cap td{background:#0E2A4A;color:#fff;font-weight:900;font-size:13px;
                  padding:7px 9px;text-align:${isRtl ? "right" : "left"};border:1px solid #0E2A4A}

        /* ── الخلاصة المالية: الإجمالي − الهالك = المستحق ── */
        .fin{margin-top:18px;border:1px solid #cdd9e4;border-radius:10px;overflow:hidden;break-inside:avoid}
        .fin-h{background:#0E2A4A;color:#fff;font-weight:900;font-size:13px;padding:7px 10px}
        .fin table{margin:0;font-size:12px}
        .fin td{border:none;border-bottom:1px solid #e8eef4;padding:8px 12px}
        .fin tr:last-child td{border-bottom:none}
        .fin .lbl{color:#47759c;font-weight:700}
        .fin .val{text-align:${isRtl ? "left" : "right"};font-weight:900;font-variant-numeric:tabular-nums;width:150px}
        .fin .minus .val{color:#b91c1c}
        .fin .net td{background:#0E76AC;color:#fff;font-size:14px}
        .fin .net .lbl{color:#fff}

        .fin .profit td{background:#15803d;color:#fff;font-size:14px}
        .fin .profit .lbl{color:#fff}

        /* ── قرارات مطلوبة: أبرز قسم في التقرير — إطار أحمر يلفت النظر ── */
        .act{margin-top:18px;border:2px solid #b91c1c;border-radius:10px;overflow:hidden;break-inside:avoid}
        .act-h{background:#b91c1c;color:#fff;font-weight:900;font-size:13px;padding:7px 10px}
        .act table{margin:0}
        .act .why{font-size:9.5px;color:#b91c1c;font-weight:700;margin-top:2px}
        .act .none{padding:12px;text-align:center;color:#15803d;font-weight:800;font-size:12px}
        /* لا هدر ⇒ لا داعي للإطار الأحمر التحذيري */
        .act.ok{border-color:#15803d} .act.ok .act-h{background:#15803d}
        .tag{display:inline-block;border-radius:50px;padding:2px 9px;font-size:10px;font-weight:900;color:#fff}
        .tag.stop{background:#b91c1c} .tag.red{background:#c2410c}
        td.c{text-align:center}

        .sign{margin-top:26px;display:flex;justify-content:space-between;gap:40px;break-inside:avoid}
        .sign div{flex:1;border-top:1px solid #94a3b8;padding-top:5px;font-size:10px;
                  color:#47759c;font-weight:700;text-align:center}
        .foot{margin-top:14px;font-size:9px;color:#94a3b8;text-align:center}
        @page{size:A4;margin:12mm}
        /* thead بيتكرر تلقائياً في كل صفحة — نأكّدها صراحةً */
        @media print{thead{display:table-header-group}tr{break-inside:avoid}}
      </style></head><body>
      <div class="lh">
        <div class="meta">
          <div><b>${t("المنفذ", "Outlet")}:</b> ${gym?.name || t("كل المنافذ", "All outlets")}</div>
          <div><b>${t("أيام التوريد", "Supply days")}:</b> ${report.daysCount}</div>
          <div><b>${t("تاريخ الإصدار", "Issued")}:</b> ${issuedAt}</div>
        </div>
        <img src="${window.location.origin}/adrenaline-logo-full.png" alt="ADRENALINE">
      </div>
      <div class="doc-t">
        <span>${esc(scopeTitle())}</span>
        <span class="rng">${rangeLabel}</span>
      </div>
      <div class="wrap">
      ${showStatement ? "" : kpiHtml}
      ${statementHtml}
      ${finHtml}

      ${dailyHtml}
      ${ledgerHtml}
      ${returnsHtml}
      ${topSellersHtml}
      ${actionsHtml}

      <div class="sign">
        <div>${t("مسؤول المنافذ", "Outlet supervisor")}</div>
        <div>${t("مدير المطعم", "Restaurant manager")}</div>
        <div>${t("ممثل المنفذ", "Outlet representative")}</div>
      </div>
      <div class="foot">ADRENALINE Healthy Food — ${t("تقرير مبيعات المنافذ", "Outlet sales report")} · ${rangeLabel}</div>
      </div>
      </body></html>`;
    return html;
  };

  /* ── المحتوى المختار يفلتر الصفحة والمستند معاً ──
        المحدّد واقف جنب فلتري الفترة والمنفذ اللي بيغيّروا الصفحة، فلازم
        يتصرّف زيهم — وإلا المعاينة ما تبقاش "نفس اللي شايفه". */
  const showDailyChart = scope === "full";
  const showPerMeal = scope === "full";
  const showReturnsBlocks = scope === "full" || scope === "returns";
  const showTopBlock = scope === "full" || scope === "top";

  /** عنوان المستند حسب محتواه — يظهر في شريط العنوان وفي اسم ملف الـPDF. */
  const scopeTitle = () =>
    scope === "statement" ? t("كشف حساب المنفذ", "Outlet statement")
      : scope === "returns" ? t("تقرير المرتجعات والهالك", "Returns and waste report")
        : scope === "top" ? t("تقرير الأصناف الأعلى مبيعاً", "Top selling items report")
          : t("تقرير مبيعات المنافذ", "Outlet sales report");

  const reportFileName = () => {
    const gym = gyms.find((g: any) => g.id === gymId);
    return `${scopeTitle()} - ${gym?.name || t("كل المنافذ", "All outlets")} - ${rangeLabel}`;
  };

  /** يفتح المعاينة — لا يطبع. المدير يشوف الورقة الأول ويقرر. */
  const previewReport = () => {
    const html = buildReportHtml();
    if (html) setPreviewHtml(html);
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("محتوى التقرير", "Report content")}</Label>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="statement">{t("كشف حساب المنفذ (مبيعات · مرتجع · عمولة)", "Outlet statement (sales · returns · commission)")}</option>
              <option value="full">{t("تقرير كامل", "Full report")}</option>
              <option value="returns">{t("المرتجعات والهالك فقط", "Returns and waste only")}</option>
              <option value="top">{t("الأصناف الأعلى مبيعاً فقط", "Top selling items only")}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("الفترة", "Period")}</Label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="day">{t("يومي", "Daily")}</option>
              <option value="week">{t("أسبوعي", "Weekly")}</option>
              <option value="month">{t("شهري", "Monthly")}</option>
              <option value="custom">{t("نطاق مخصص", "Custom range")}</option>
            </select>
          </div>
          {period === "month" && <div>
            <Label className="text-xs font-bold text-slate-500">{t("الشهر", "Month")}</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10" />
          </div>}
          {(period === "day" || period === "week") && <div>
            <Label className="text-xs font-bold text-slate-500">{period === "week" ? t("اختر يومًا من الأسبوع", "A day in the week") : t("اليوم", "Date")}</Label>
            <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className="h-10" />
          </div>}
          {period === "custom" && <>
            <div><Label className="text-xs font-bold text-slate-500">{t("من", "From")}</Label><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10" /></div>
            <div><Label className="text-xs font-bold text-slate-500">{t("إلى", "To")}</Label><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10" /></div>
          </>}
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("المنفذ", "Outlet")}</Label>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">{t("كل المنافذ", "All outlets")}</option>
              {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={previewReport} disabled={!report} className="w-full h-10 font-black text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
              <Printer className="h-4 w-4 me-2" /> {t("طباعة المعروض PDF", "Print this view as PDF")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ⚠️ "الصافي المستحق" كان بيعرض totalRevenue (الإجمالي قبل خصم المرتجعات)
          فكان بيقول 8985 بينما بطاقة "صافي الإيراد بعد الهالك" تحت بتقول 8552 —
          رقمان متناقضان لنفس الشيء. الصافي = الإجمالي − الهالك. */}
      {/* البطاقات تتبع المحتوى المختار — نفس منطق بطاقات المستند.
          في الوضع الكامل الصف يُقرأ كمعادلة: التوريد − الهالك = الصافي. */}
      <div className={cn("grid gap-3 grid-cols-2", scope === "full" ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4")}>
        {scope === "returns" ? (
          <>
            <Stat label={t("الكمية المورّدة", "Supplied")} value={report?.totalMeals ?? "—"} color="#0E76AC" />
            <Stat label={t("المرتجع (هالك)", "Returned (waste)")} value={report?.totalReturned ?? "—"} color="#dc2626" />
            <Stat label={t("نسبة الارتجاع", "Return rate")} value={decision?.totals?.wastePct != null ? `${decision.totals.wastePct}%` : "—"} color="#dc2626" />
            <Stat label={t("قيمة الهالك (ر.ق)", "Waste value (QAR)")} value={report?.totalWasteValue?.toFixed(2) ?? "—"} color="#dc2626" />
          </>
        ) : scope === "top" ? (
          <>
            <Stat label={t("الكمية المورّدة", "Supplied")} value={report?.totalMeals ?? "—"} color="#0E76AC" />
            <Stat label={t("الكمية المستهلكة", "Consumed")} value={report?.deliveredMeals ?? "—"} color="#0E76AC" />
            <Stat label={t("عدد الأصناف المُباعة", "Items sold")} value={decision?.topSellers?.length ?? "—"} color="#7c3aed" />
            <Stat label={t("صافي الإيراد (ر.ق)", "Net revenue (QAR)")} value={(report?.netRevenue ?? report?.totalRevenue)?.toFixed(2) ?? "—"} color="#16a34a" />
          </>
        ) : (
          <>
            <Stat label={t("إجمالي الوجبات", "Total meals")} value={report?.totalMeals ?? "—"} color="#0E76AC" />
            <Stat label={t("إجمالي التوريد (ر.ق)", "Gross supplied (QAR)")} value={report?.totalRevenue?.toFixed(2) ?? "—"} color="#47759c" />
            <Stat label={t("قيمة الهالك (ر.ق)", "Waste value (QAR)")} value={report?.totalWasteValue?.toFixed(2) ?? "—"} color="#dc2626" />
            <Stat label={t("الصافي المستحق (ر.ق)", "Net due (QAR)")} value={(report?.netRevenue ?? report?.totalRevenue)?.toFixed(2) ?? "—"} color="#16a34a" />
            <Stat label={t("متوسط يومي (صافي)", "Avg/day (net)")} value={report?.avgPerDay?.toFixed(2) ?? "—"} color="#7c3aed" />
            <Stat label={t("أيام التوريد", "Days")} value={report?.daysCount ?? "—"} color="#f59e0b" />
          </>
        )}
      </div>

      {/* 💵 كشف الحساب على الشاشة — نفس جدول الطباعة (كان يظهر في الـPDF فقط) */}
      {scope === "statement" && report && (() => {
        const commissionRate = Number((gyms.find((g: any) => g.id === gymId) as any)?.discountPct ?? 20);
        const sales = Number(report.netRevenue ?? report.totalRevenue);
        const commission = Math.round(sales * commissionRate) / 100;
        const receivable = Math.round((sales - commission) * 100) / 100;
        return (
          <div className="space-y-3">
            <section className="gym-report-panel overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[#0E76AC] text-white text-[12px]">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{t("التاريخ", "Date")}</th>
                    <th className="px-3 py-2.5 text-end">{t("كمية الإنتاج", "Production Qty")}</th>
                    <th className="px-3 py-2.5 text-end">{t("قيمة الإنتاج", "Production Amount")}</th>
                    <th className="px-3 py-2.5 text-end">{t("كمية المرتجع", "Return Qty")}</th>
                    <th className="px-3 py-2.5 text-end">{t("قيمة المرتجع", "Return Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.days || []).map((d: any) => (
                    <tr key={d.date}>
                      <td className="px-3 py-2.5 font-bold tabular-nums text-slate-700" dir="ltr">{d.date}</td>
                      <td className="px-3 py-2.5 text-end font-black tabular-nums">{d.meals}</td>
                      <td className="px-3 py-2.5 text-end font-black tabular-nums">{d.total.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-end font-black tabular-nums">{d.returned || 0}</td>
                      <td className={cn("px-3 py-2.5 text-end font-black tabular-nums", Number(d.waste) > 0 ? "text-red-600" : "text-slate-400")}>{Number(d.waste || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-cyan-50 text-[#0E76AC]">
                    <td className="px-3 py-2.5 font-black">{t("الإجمالي", "Total")}</td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums">{report.totalMeals}</td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums">{report.totalRevenue.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums">{report.totalReturned}</td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums">{Number(report.totalWasteValue || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#0E2A4A] px-4 py-2.5 text-sm font-black text-white">{t("الخلاصة المالية", "Financial summary")}</div>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="flex items-center justify-between px-4 py-3"><span className="font-bold text-slate-500">{t("المبيعات (الإنتاج − المرتجع)", "Sales (production − returns)")}</span><span className="font-black tabular-nums">{sales.toFixed(2)}</span></div>
                <div className="flex items-center justify-between px-4 py-3"><span className="font-bold text-slate-500">{t("العمولة", "Commission")} ({commissionRate}%)</span><span className="font-black tabular-nums text-red-600">− {commission.toFixed(2)}</span></div>
                <div className="flex items-center justify-between bg-[#0E76AC] px-4 py-3 text-white"><span className="font-black">{t("المستحق (Receivable)", "Receivable")}</span><span className="font-black tabular-nums">{receivable.toFixed(2)} {t("ر.ق", "QAR")}</span></div>
              </div>
            </section>
          </div>
        );
      })()}

      {showDailyChart && (
      <section className="gym-report-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-black text-slate-900">{t("المقارنة اليومية", "Daily comparison")}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t("الأعلى", "Highest")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{t("الأقل", "Lowest")}</span>
          </div>
        </div>
        <div className="space-y-2 p-4 sm:p-5">
            {(report?.days || []).map((d: any) => {
              const pct = maxDay ? (d.total / maxDay) * 100 : 0;
              const isBest = report?.bestDay?.date === d.date;
              const isWorst = report?.worstDay?.date === d.date;
              return (
                <div key={d.date} className="grid grid-cols-[86px_minmax(0,1fr)_80px] items-center gap-3 text-xs sm:grid-cols-[100px_minmax(0,1fr)_96px]">
                  <span className="font-bold tabular-nums text-slate-600" dir="ltr">{d.date}</span>
                  <div className="relative h-8 overflow-hidden rounded-md bg-slate-100">
                    <div className="h-full rounded-md transition-[width] duration-300" style={{ width: `${Math.max(pct, 5)}%`, background: isBest ? "#10b981" : isWorst ? "#ef4444" : "#3cc4f0" }} />
                    <span className={cn("absolute inset-y-0 start-2 flex items-center font-black tabular-nums", pct > 24 ? "text-white" : "text-slate-700")}>{d.meals} {t("وجبة", "meals")}</span>
                  </div>
                  <span className="text-end font-black tabular-nums text-slate-900">{d.total.toFixed(2)} <span className="text-[9px] text-slate-400">{t("ر.ق", "QAR")}</span></span>
                </div>
              );
            })}
            {(!report || report.days.length === 0) && <p className="text-center text-slate-400 py-6 text-sm">{t("لا توجد بيانات", "No data")}</p>}
        </div>
      </section>
      )}

      {showPerMeal && (
      <section className="gym-report-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-black text-slate-900">{t("تفصيل حسب الوجبة", "Per-meal breakdown")}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{report?.meals?.length || 0} {t("صنفاً مبيعاً", "items sold")}</p>
          </div>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{report?.totalMeals || 0} {t("وجبة", "meals")}</span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-[680px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase text-slate-500 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="w-12 px-4 py-3 text-center">#</th>
                <th className="px-3 py-3 text-start">{t("الوجبة", "Meal")}</th>
                <th className="w-28 px-3 py-3 text-center">{t("الكمية", "Qty")}</th>
                <th className="w-44 px-3 py-3 text-start">{t("نسبة الإيراد", "Revenue share")}</th>
                <th className="w-36 px-4 py-3 text-end">{t("الإيراد", "Revenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(report?.meals || []).map((m: any, index: number) => {
                const share = report?.totalRevenue ? (m.revenue / report.totalRevenue) * 100 : 0;
                const relative = maxMealRevenue ? (m.revenue / maxMealRevenue) * 100 : 0;
                return <tr key={m.key} className="group hover:bg-cyan-50/40">
                  <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-slate-400">{index + 1}</td>
                  <td className="px-3 py-3 font-bold text-slate-900">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td>
                  <td className="px-3 py-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-md bg-slate-100 px-2 py-1 font-black tabular-nums text-slate-800 group-hover:bg-white">{m.qty}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${relative}%` }} /></div>
                      <span className="w-12 text-end text-[11px] font-bold tabular-nums text-slate-500">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end font-black tabular-nums text-[#0E76AC]">{m.revenue.toFixed(2)} <span className="text-[9px] text-slate-400">{t("ر.ق", "QAR")}</span></td>
                </tr>
              })}
              {(!report || report.meals.length === 0) && <tr><td colSpan={5} className="py-12 text-center text-slate-400">{t("لا توجد بيانات", "No data")}</td></tr>}
            </tbody>
            {!!report?.meals?.length && <tfoot className="sticky bottom-0 bg-slate-900 text-white shadow-[0_-1px_0_#cbd5e1]">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-black">{t("الإجمالي", "Total")}</td>
                <td className="px-3 py-3 text-center font-black tabular-nums">{report.totalMeals}</td>
                <td className="px-3 py-3 text-end text-xs font-bold text-slate-300">100%</td>
                <td className="px-4 py-3 text-end font-black tabular-nums">{report.totalRevenue.toFixed(2)} <span className="text-[9px] text-slate-300">{t("ر.ق", "QAR")}</span></td>
              </tr>
            </tfoot>}
          </table>
        </div>
      </section>
      )}

      {/* ✅ ملخص المرتجعات + قيمة الهالك للشهر */}
      {showReturnsBlocks && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("مرتجعات الفترة", "Returned in period")} value={returnsRep?.totals?.returned ?? "—"} color="#dc2626" />
        <Stat label={t("نسبة الإرجاع", "Return rate %")} value={returnsRep?.totals?.returnRate != null ? `${returnsRep.totals.returnRate}%` : "—"} color="#dc2626" />
        <Stat label={t("قيمة الهالك (ر.ق)", "Waste value (QAR)")} value={returnsRep?.totals?.wasteValue?.toFixed(2) ?? "—"} color="#dc2626" />
        <Stat label={t("صافي الإيراد بعد الهالك", "Net revenue after waste")} value={returnsRep?.totals?.netRevenue?.toFixed(2) ?? "—"} color="#16a34a" />
      </div>
      )}

      {/* ✅ أكتر الوجبات إرجاعًا — قرارات إيقاف/تقليل الإنتاج */}
      {showReturnsBlocks && (
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black">{t("التوصيات — الأصناف المسبّبة للهدر", "Recommendations — items causing waste")}</h3>
            <span className="text-[10px] text-slate-400 font-bold">
              {t("مرتّبة حسب نسبة الإرجاع", "Sorted by return rate")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="text-start p-2">{t("الصنف", "Item")}</th>
                  <th className="text-center p-2">{t("المورّد", "Supplied")}</th>
                  <th className="text-center p-2">{t("المرتجع", "Returned")}</th>
                  <th className="text-center p-2">{t("المستهلك", "Consumed")}</th>
                  <th className="text-center p-2">{t("نسبة الارتجاع", "Return rate")}</th>
                  <th className="text-end p-2">{t("قيمة الهالك (ر.ق)", "Waste value (QAR)")}</th>
                  <th className="text-center p-2">{t("التوصية", "Recommendation")}</th>
                </tr>
              </thead>
              <tbody>
                {/* ⚠️ الحكم من decisionReport (الخادم) — كانت الصفحة بتحكم بعتبات
                    خاصة بيها (20%/10%) تخالف عتبات التقرير المطبوع (40%/15%)،
                    فنفس الصنف يطلع "راجع للإيقاف" على الشاشة و"قلّل الكمية" في
                    الـPDF. مصدر واحد = حكم واحد. */}
                {(decision?.meals || []).filter((m: any) => m.returned > 0)
                  .sort((a: any, b: any) => b.returnRate - a.returnRate).map((m: any) => {
                  const bad = m.verdict === "STOP";
                  const meh = m.verdict === "REDUCE";
                  const recommendation = bad
                    ? t("إيقاف التوريد", "Discontinue")
                    : meh
                      ? t("تخفيض الكمية", "Reduce quantity")
                      : t("استمرار ومتابعة", "Continue and monitor");
                  return (
                    <tr key={m.key} className="border-t border-slate-100">
                      <td className="p-2 font-bold">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td>
                      <td className="p-2 text-center font-black">{m.sent}</td>
                      <td className="p-2 text-center font-black" style={{ color: "#dc2626" }}>{m.returned}</td>
                      <td className="p-2 text-center font-black text-slate-700">{m.soldQty}</td>
                      <td className="p-2 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-black text-xs"
                          style={{
                            background: bad ? "#fee2e2" : meh ? "#fef3c7" : "#dcfce7",
                            color: bad ? "#991b1b" : meh ? "#92400e" : "#166534",
                          }}>
                          {m.returnRate}%
                        </span>
                      </td>
                      <td className="p-2 text-end font-black" style={{ color: "#dc2626" }}>{m.wasteValue.toFixed(2)}</td>
                      <td className="p-2 text-center"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-black", bad ? "bg-red-100 text-red-800" : meh ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>{recommendation}</span></td>
                    </tr>
                  );
                })}
                {(!decision || decision.meals.filter((m: any) => m.returned > 0).length === 0) && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-6">{t("لا توجد مرتجعات مسجلة في هذه الفترة", "No returns recorded in this period")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 📊 أعلى الأصناف خسارة — قراءة بصرية سريعة: طول الشريط = قيمة الهالك.
          CSS خالص (لا مكتبة شارت) عشان يطبع صح ويفضل خفيف. */}
      {showReturnsBlocks && wasteChart.length > 0 && (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black">{t("أعلى الأصناف خسارة", "Biggest losses by item")}</h3>
              <span className="text-[10px] text-slate-400 font-bold">{t("قيمة الهالك (ر.ق)", "Waste value (QAR)")}</span>
            </div>
            <div className="space-y-2.5">
              {wasteChart.map((m: any) => {
                const pct = maxWaste > 0 ? Math.round((m.wasteValue / maxWaste) * 100) : 0;
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 truncate text-xs font-bold text-slate-700" title={isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}>
                      {isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}
                    </div>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                      <div className="h-full rounded-md transition-[width] duration-500"
                        style={{ width: `${Math.max(pct, 3)}%`, background: m.verdict === "STOP" ? "linear-gradient(90deg,#b91c1c,#ef4444)" : "linear-gradient(90deg,#c2410c,#f97316)" }} />
                      <span className="absolute inset-y-0 flex items-center px-2 text-[10px] font-black text-white"
                        style={{ [isRtl ? "right" : "left"]: 0 } as any}>
                        {m.returnRate}%
                      </span>
                    </div>
                    <div className="w-20 shrink-0 text-end text-xs font-black text-red-600 tabular-nums">
                      {m.wasteValue.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] font-bold text-slate-500">
              {t(
                `إجمالي الخسارة في الفترة: ${Number(decision?.totals?.totalWaste || 0).toFixed(2)} ر.ق — ${decision?.totals?.wastePct ?? 0}% من الكمية الموردة`,
                `Total loss this period: ${Number(decision?.totals?.totalWaste || 0).toFixed(2)} QAR — ${decision?.totals?.wastePct ?? 0}% of supplied quantity`,
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🏆 الأصناف الأعلى مبيعاً — بالاستهلاك الفعلي (المورّد − المرتجع)،
          مش بالمورّد: الصنف اللي بيترجع نصه مش أعلى مبيعاً. */}
      {showTopBlock && topSellers.length > 0 && (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black">{t("الأصناف الأعلى مبيعاً", "Top selling items")}</h3>
              <span className="text-[10px] font-bold text-slate-400">
                {t("حسب الاستهلاك الفعلي", "By actual consumption")}
              </span>
            </div>
            <div className="space-y-2.5">
              {topSellers.map((m: any, i: number) => {
                const pct = maxSold > 0 ? Math.round((m.soldQty / maxSold) * 100) : 0;
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#0E2A4A] text-[10px] font-black text-white">
                      {i + 1}
                    </span>
                    <div className="w-40 shrink-0 truncate text-xs font-bold text-slate-700" title={isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}>
                      {isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}
                    </div>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                      <div className="h-full rounded-md transition-[width] duration-500"
                        style={{ width: `${Math.max(pct, 3)}%`, background: "linear-gradient(90deg,#0E2A4A,#3cc4f0)" }} />
                      <span className="absolute inset-y-0 flex items-center px-2 text-[10px] font-black text-white"
                        style={{ [isRtl ? "right" : "left"]: 0 } as any}>
                        {m.soldQty}
                      </span>
                    </div>
                    <div className="w-20 shrink-0 text-end text-xs font-black tabular-nums text-emerald-700">
                      {Number(m.netRevenue).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] font-bold text-slate-500">
              {t("الأرقام: الكمية المستهلكة · صافي الإيراد (ر.ق)", "Figures: consumed quantity · net revenue (QAR)")}
            </div>
          </CardContent>
        </Card>
      )}

      {previewHtml && (
        <ReportPreview
          html={previewHtml}
          fileName={reportFileName()}
          isRtl={isRtl}
          t={t}
          onClose={() => setPreviewHtml(null)}
        />
      )}
    </div>
  );
}

/**
 * معاينة التقرير قبل الطباعة — WYSIWYG حقيقي.
 *
 *   الـiframe بيعرض نفس نص الـHTML اللي بيتطبع، والطباعة بتنادي print()
 *   على نفس الـiframe ده — مش على نسخة تانية. فمستحيل المعاينة تفترق
 *   عن الورقة. (ده اللي كان بيحصل قبل كده: الشاشة كود والـPDF كود تاني،
 *   فاتفرقوا في الأرقام والأحكام.)
 *
 *   اسم ملف الـPDF بياخده المتصفح من <title> المستند — والبنّاء بيحقنه.
 */
function ReportPreview({ html, fileName, isRtl, t, onClose }: any) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [scale, setScale] = useState(1);
  const [docH, setDocH] = useState(1123); // A4 واحدة مبدئياً، ثم على ارتفاع المحتوى
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const A4_W = 794; // بكسل عند 96dpi

  // نصغّر الورقة لتملأ عرض النافذة — العرض بصري فقط، الطباعة بتفضل A4 كامل.
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth || A4_W;
      setScale(Math.min(1, (w - 24) / A4_W));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // نحقن العنوان في المستند عشان يبقى اسم ملف الـPDF مفهوم
  const docHtml = useMemo(() => {
    const safe = String(fileName || "report").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
    const esc = safe.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    return /<title>[\s\S]*?<\/title>/i.test(html)
      ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc}</title>`)
      : html.replace(/<head>/i, `<head><title>${esc}</title>`);
  }, [html, fileName]);

  /** يضبط طول الـiframe على طول المستند — ورقم ثابت يقصّ التقارير الطويلة. */
  const onFrameLoad = () => {
    const d = frameRef.current?.contentDocument;
    if (d?.body) setDocH(Math.max(1123, d.body.scrollHeight + 24));
  };

  const doPrint = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print(); // نفس المستند المعروض — لا إعادة بناء
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-[#0E2A4A] px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-black">{t("معاينة التقرير", "Report preview")}</div>
          <div className="truncate text-[11px] font-bold text-white/60">
            {t("هذا هو المحتوى الذي سيظهر في ملف PDF", "This is exactly what the PDF will contain")}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={doPrint}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3cc4f0] px-4 text-xs font-black text-[#0E2A4A] hover:bg-[#5ad0f5]">
            <Printer className="h-4 w-4" /> {t("طباعة / حفظ PDF", "Print / Save PDF")}
          </button>
          <button onClick={onClose} aria-label={t("إغلاق", "Close")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="flex-1 overflow-auto p-3">
        <div className="mx-auto shadow-2xl" style={{ width: A4_W * scale, height: docH * scale }}>
          <iframe
            ref={frameRef}
            srcDoc={docHtml}
            onLoad={onFrameLoad}
            title={fileName}
            className="block border-0 bg-white"
            style={{
              width: A4_W,
              height: docH,
              transform: `scale(${scale})`,
              transformOrigin: isRtl ? "top right" : "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div
      className="gym-stat relative overflow-hidden rounded-lg border p-4 shadow-sm"
      style={{ borderColor: `${color}35`, background: `linear-gradient(145deg, ${color}12, #f8fbfd 68%)` }}
    >
      <div className="mb-3 h-1 w-9 rounded-full" style={{ background: color }} />
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════ Returns Tab ═══════════════════════════════ */

function ReturnsTab({ isRtl, t, sessionToken, gyms, selectedGymId, setSelectedGymId, toast }: any) {
  // 🕐 نطاق التاريخ: افتراضي آخر 7 أيام. الجم بيرجع بعد يومين، فالموظف بيسجّل خلال أسبوع.
  //    لو نسي يفتح "أقدم" علشان يشوف طلبيات أقدم.
  const [days, setDays] = useState(7);
  const [returnsDate, setReturnsDate] = useState("");
  const [batchReturnDate, setBatchReturnDate] = useState(todayStr());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const orders = useQuery(
    (api.gymSales as any).listOrdersForReturns,
    { days, date: returnsDate || undefined, gymId: (selectedGymId || undefined) as any, sessionToken }
  ) as any[] | undefined;
  const record = useMutation((api.gymSales as any).recordOrderReturns);

  // per-order per-line draft returnedQty
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedReturnOrderId, setSelectedReturnOrderId] = useState("");
  // 🔎 بحث داخل أصناف الفاتورة — الفواتير الكبيرة يصعب التمرير فيها للوصول لوجبة.
  const [lineSearch, setLineSearch] = useState("");

  useEffect(() => {
    if (selectedReturnOrderId && orders && !orders.some((order) => order.id === selectedReturnOrderId)) {
      setSelectedReturnOrderId("");
    }
  }, [orders, selectedReturnOrderId]);

  // نمسح البحث عند تغيير الفاتورة المختارة حتى لا يبقى فلترٌ من فاتورة سابقة.
  useEffect(() => { setLineSearch(""); }, [selectedReturnOrderId]);

  const selectedReturnOrder = (orders || []).find((order: any) => order.id === selectedReturnOrderId);

  const setDraft = (orderId: string, lineId: string, val: string) => {
    setDrafts((current) => {
      const orderDrafts = { ...(current[orderId] || {}) };
      if (val === "" || Number(val) <= 0) delete orderDrafts[lineId];
      else orderDrafts[lineId] = val;
      const next = { ...current };
      if (Object.keys(orderDrafts).length === 0) delete next[orderId];
      else next[orderId] = orderDrafts;
      return next;
    });
  };
  const saveOrder = async (order: any) => {
    const orderDrafts = drafts[order.id] || {};
    const returns = order.lines.map((l: any) => {
      const raw = orderDrafts[l.id];
      const qty = raw !== undefined ? Number(raw || 0) : 0;
      return { lineId: l.id as any, qty };
    }).filter((item: any) => item.qty > 0);
    if (returns.length === 0) {
      toast({ title: t("لا توجد كمية مرتجع للحفظ", "No return quantity to save") });
      return;
    }
    setSaving(order.id);
    try {
      const r: any = await record({ orderId: order.id as any, returns, returnDate: batchReturnDate, sessionToken });
      toast({
        title: t("تم الحفظ ✓", "Saved ✓"),
        description: t(
          `تم تسجيل دفعة ${r.batchQty} وجبة · هالك الدفعة ${r.batchWaste} ر.ق`,
          `Batch recorded: ${r.batchQty} · batch waste ${r.batchWaste} QAR`
        ),
      });
      setDrafts((d) => { const cp = { ...d }; delete cp[order.id]; return cp; });
    } catch (e: any) {
      const rawMessage = String(e?.message || "");
      const needsSync = rawMessage.includes("Object contains extra field `returnDate`");
      toast({
        title: t("تعذر حفظ المرتجع", "Could not save return"),
        description: needsSync
          ? t("تحديث نظام المرتجعات لم يُفعّل على الخادم بعد. يلزم مزامنة Convex.", "The returns update is not active on the server yet. Convex must be synced.")
          : rawMessage.replace(/^.*?Server Error\s*/s, "").slice(0, 240),
      });
    } finally { setSaving(null); }
  };

  const totalWasteAll = (orders || []).reduce((s: number, o: any) => s + Number(o.wasteValue || 0), 0);
  const totalReturnedAll = (orders || []).reduce((s: number, o: any) => s + Number(o.returnedTotal || 0), 0);

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("المنفذ", "Outlet")}</Label>
              <select value={selectedGymId || ""} onChange={(e) => setSelectedGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">{t("كل المنافذ", "All outlets")}</option>
                {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("تصفية بتاريخ الفاتورة", "Filter by invoice date")}</Label>
              <div className="flex gap-1">
                <Input type="date" value={returnsDate} onChange={(e) => setReturnsDate(e.target.value)} className="h-10" />
                {returnsDate && <button type="button" onClick={() => setReturnsDate("")} className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 text-slate-600" title={t("إلغاء تحديد اليوم", "Clear date")}><X className="mx-auto h-4 w-4" /></button>}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("تاريخ استلام المرتجع", "Return received date")}</Label>
              <Input type="date" value={batchReturnDate} onChange={(e) => setBatchReturnDate(e.target.value)} className="h-10" />
            </div>
            <StatMini label={t("إجمالي المرتجعات", "Total returned")} value={totalReturnedAll} color="#dc2626" />
            <StatMini label={t("قيمة الهالك", "Waste value")} value={`${totalWasteAll.toFixed(2)} ر.ق`} color="#dc2626" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("اختر الفاتورة المطلوب تسجيل مرتجع لها", "Choose the invoice for this return")}</Label>
            <select
              value={selectedReturnOrderId}
              onChange={(e) => setSelectedReturnOrderId(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold focus:border-[#0E76AC] focus:outline-none"
            >
              <option value="">{t("اختر فاتورة…", "Select an invoice…")}</option>
              {(orders || []).map((order: any) => (
                <option key={order.id} value={order.id}>
                  {order.date} · {order.gymName} · {order.mealsCount} {t("وجبة", "meals")} · {Number(order.netTotal ?? order.total).toFixed(2)} {t("ر.ق", "QAR")} · #{String(order.id).slice(-6).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          {/* 🕐 اختيار نطاق التاريخ — أقل بروزًا، مخفي خلف زر */}
          {!returnsDate && <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold">
              {t(`عرض طلبيات آخر ${days} يوم`, `Showing last ${days} days`)}
            </span>
            {!showAdvanced ? (
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="text-[#0E76AC] font-bold hover:underline"
              >
                {t("عرض أقدم", "Show older")}
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "h-7 px-2 rounded font-bold",
                      days === d ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >{d}</button>
                ))}
                <button type="button" onClick={() => { setDays(7); setShowAdvanced(false); }} className="text-slate-400 hover:text-slate-600 ms-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <div className="border-b border-cyan-200 bg-cyan-50 p-3 text-xs font-bold text-cyan-900">
            {t("كل دفعة مرتجع ترتبط بالفاتورة الأصلية وتاريخ استلامها. العادي متوقع بعد يومين، والسويت بعد 4 أيام. غير مرتجع يعني مباعاً أو مستهلكاً، وليس مخزوناً موجوداً عند المنفذ.", "Every return batch is tied to its original invoice and received date. Regular items are due after 2 days and sweets after 4. Not returned means sold or consumed, not stock currently held by the outlet.")}
          </div>
          {!orders && <div className="p-6 text-center text-slate-400">{t("جاري التحميل…", "Loading…")}</div>}
          {orders && orders.length === 0 && <div className="p-6 text-center text-slate-400">{t("لا توجد طلبيات في هذه المدة", "No orders in this window")}</div>}
          {orders && orders.length > 0 && !selectedReturnOrder && <div className="p-8 text-center text-slate-500"><Receipt className="mx-auto mb-2 h-7 w-7 text-[#0E76AC]" /><p className="font-bold">{t("اختر الفاتورة من القائمة بالأعلى لعرض أصنافها", "Choose an invoice above to view its items")}</p></div>}
          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {(selectedReturnOrder ? [selectedReturnOrder] : []).map((o: any) => {
              const isDirty = Object.values(drafts[o.id] || {}).some((value) => Number(value) > 0);
              // ✅ عدد الأصناف اللي بيتم إرجاعها بعد النافذة المتوقعة (للتنبيه فقط)
              const overdueCount = o.lines.reduce((acc: number, l: any) => {
                const rq = Number(drafts[o.id]?.[l.id] || 0);
                const isOver = !!l.expectedReturnDate && batchReturnDate > l.expectedReturnDate;
                return isOver && rq > 0 ? acc + 1 : acc;
              }, 0);
              return (
                <div key={o.id} className="p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div>
                      <div className="font-black text-slate-900">{o.gymName} · <span dir="ltr">{o.date}</span> · #{String(o.id).slice(-6).toUpperCase()}</div>
                      <div className="text-[11px] text-slate-500 font-bold">
                        {t("مُرسل:", "Sent:")} {o.mealsCount} · {t("مرتجع:", "Returned:")} {o.returnedTotal} ·
                        <span className="ms-1" style={{ color: "#dc2626" }}>{t("هالك", "Waste")}: {o.wasteValue.toFixed(2)} ر.ق</span> ·
                        <span className="ms-1 font-black" style={{ color: "#0E76AC" }}>{t("صافي", "Net")}: {o.netTotal.toFixed(2)} ر.ق</span>
                      </div>
                    </div>
                    <button
                      onClick={() => saveOrder(o)}
                      disabled={!isDirty || saving === o.id}
                      className={cn("h-10 rounded-lg px-4 text-xs font-bold", isDirty && saving !== o.id ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-200 text-slate-400 cursor-not-allowed")}
                    >
                      {saving === o.id ? t("جاري…", "…") : t("حفظ المرتجعات", "Save returns")}
                    </button>
                  </div>
                  {/* ✅ بانر تحذير بسيط لو فيه أصناف بعد نافذة الإرجاع المتوقعة */}
                  {overdueCount > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                      <span aria-hidden="true">⚠</span>
                      <span>
                        {isRtl
                          ? `${overdueCount} صنف بيتم إرجاعه بعد نافذة الإرجاع الرسمية. مسموح لكن تأكّد من صلاحية الوجبة قبل التسجيل.`
                          : `${overdueCount} item(s) being returned after the expected window. Allowed, but verify meal condition before recording.`}
                      </span>
                    </div>
                  )}
                  {/* 🔎 بحث داخل أصناف الفاتورة — يفلتر السطور بالاسم بدل التمرير */}
                  {(() => {
                    const qn = lineSearch.trim().toLowerCase();
                    const visibleLines = qn
                      ? o.lines.filter((l: any) =>
                          String(l.mealNameAr || "").toLowerCase().includes(qn) ||
                          String(l.mealNameEn || "").toLowerCase().includes(qn))
                      : o.lines;
                    return (
                  <>
                  <div className="relative mb-3">
                    <Search className="absolute h-4 w-4 top-3 start-3 text-slate-400 pointer-events-none" />
                    <Input
                      value={lineSearch}
                      onChange={(e) => setLineSearch(e.target.value)}
                      placeholder={t("ابحث باسم الوجبة داخل الفاتورة…", "Search meal name in invoice…")}
                      className="h-10 ps-9"
                    />
                    {lineSearch && (
                      <button type="button" onClick={() => setLineSearch("")} className="absolute end-2 top-2 h-6 w-6 rounded-md bg-slate-100 text-slate-500" title={t("مسح", "Clear")}>
                        <X className="mx-auto h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {qn && <div className="mb-2 text-xs font-bold text-slate-500">{t(`${visibleLines.length} صنف مطابق`, `${visibleLines.length} matching item(s)`)}</div>}
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-[860px] w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                        <th className="text-center p-2">{t("موعد المرتجع", "Expected return")}</th>
                        <th className="text-end p-2">{t("مُرسل", "Sent")}</th>
                        <th className="text-end p-2">{t("مرتجع سابق", "Previously returned")}</th>
                        <th className="text-end p-2">{t("هالك سابق", "Previous waste")}</th>
                        <th className="text-center p-2">{t("الدفعة الحالية", "Current batch")}</th>
                        <th className="text-end p-2">{t("غير مرتجع", "Not returned")}</th>
                        <th className="text-end p-2">{t("هالك الدفعة", "Batch waste")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.length === 0 && (
                        <tr><td colSpan={8} className="p-6 text-center text-slate-400 font-bold">{t("لا يوجد صنف بهذا الاسم في الفاتورة", "No item by that name in the invoice")}</td></tr>
                      )}
                      {visibleLines.map((l: any) => {
                        const draftVal = drafts[o.id]?.[l.id];
                        const showVal = draftVal !== undefined ? draftVal : "";
                        const rq = Number(showVal || 0);
                        const waste = rq * l.unitPrice;
                        const previousWaste = Number(l.returnedQty || 0) * Number(l.unitPrice || 0);
                        const remainingQty = Number(l.remainingQty ?? (l.qty - l.returnedQty));
                        const afterBatch = Math.max(0, remainingQty - rq);
                        const isSweet = l.returnAfterDays === 4;
                        // ✅ تحذير: لو تاريخ الدفعة الحالية بعد النافذة المتوقعة، وفيه كمية للإرجاع
                        //   نعرض badge أصفر جنب التاريخ — العميل يقدر يكمّل (نافذ ماديًا)
                        //   بس يعرف إن الوجبة خرجت من نافذة الصلاحية الرسمية.
                        const overdue = !!l.expectedReturnDate && batchReturnDate > l.expectedReturnDate;
                        return (
                          <tr key={l.id} className="border-t border-slate-100">
                            <td className="p-3 font-bold text-slate-900">{isRtl ? (l.mealNameAr || l.mealNameEn) : (l.mealNameEn || l.mealNameAr)}{isSweet && <span className="ms-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black text-violet-700">{t("سويت · 4 أيام", "Sweet · 4 days")}</span>}</td>
                            <td className="p-3 text-center">
                              <span className={cn("rounded-md px-2 py-1 font-bold tabular-nums", overdue ? "bg-amber-100 text-amber-800" : "bg-cyan-50 text-cyan-800")} dir="ltr">{l.expectedReturnDate || "—"}</span>
                              {overdue && rq > 0 && (
                                <span className="ms-1 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white" title={t("مرتجع بعد النافذة المتوقعة", "Return after expected window")}>
                                  ⚠ {t("متأخر", "Overdue")}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-end font-black tabular-nums">{l.qty}</td>
                            <td className="p-3 text-end font-black tabular-nums text-red-600">{l.returnedQty}</td>
                            <td className="p-3 text-end font-black tabular-nums text-red-600">{previousWaste.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <input
                                type="number" min={0} max={remainingQty} step="1"
                                value={showVal}
                                onChange={(e) => setDraft(o.id, l.id, e.target.value)}
                                placeholder="0"
                                disabled={remainingQty === 0}
                                className="h-9 w-20 rounded-md border border-slate-300 text-center font-black disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                            <td className="p-3 text-end font-black tabular-nums text-slate-700">{afterBatch}</td>
                            <td className="p-3 text-end font-black tabular-nums" style={{ color: rq > 0 ? "#dc2626" : "#94a3b8" }}>
                              {waste.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                  </>
                    );
                  })()}
                  {!!o.batches?.length && <div className="mt-4">
                    <h4 className="mb-2 text-xs font-black uppercase text-slate-500">{t("دفعات المرتجع السابقة", "Previous return batches")}</h4>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {o.batches.map((batch: any) => <div key={batch.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span className="font-bold tabular-nums" dir="ltr">{batch.returnDate}</span><span className="font-black text-red-600">{batch.totalQty} {t("وجبة", "meals")}</span><span className="font-bold text-slate-500">{batch.wasteValue.toFixed(2)} {t("ر.ق", "QAR")}</span></div>)}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: any; color?: string }) {
  const accent = color || "#0E76AC";
  return (
    <div className="rounded-lg border p-3 shadow-sm" style={{ borderColor: `${accent}30`, background: `linear-gradient(145deg, ${accent}10, #f5f9fc)` }}>
      <div className="mb-2 h-1 w-7 rounded-full" style={{ background: accent }} />
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="text-lg font-black mt-1 tabular-nums" style={{ color: accent }}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════ Gyms Tab ═══════════════════════════════ */

function GymsTab({ isRtl, t, sessionToken, gyms, toast }: any) {
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const addGym = useMutation(api.gymSales.addGym);
  const updateGym = useMutation(api.gymSales.updateGym);
  const copyOnlineCatalog = useMutation(api.gymSales.copyOnlineCatalogToOutlet);
  const [copyingOutletId, setCopyingOutletId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name: "", outletType: "GYM", address: "", contactName: "", contactPhone: "", discountPct: 20, notes: "" });

  const openNew = () => { setForm({ name: "", outletType: "GYM", address: "", contactName: "", contactPhone: "", discountPct: 20, notes: "" }); setEditing(null); setShowForm(true); };
  const openEdit = (g: any) => { setForm({ ...g }); setEditing(g); setShowForm(true); };
  const submit = async () => {
    try {
      if (editing) {
        await updateGym({ id: editing.id as any, name: form.name, outletType: form.outletType, address: form.address, contactName: form.contactName, contactPhone: form.contactPhone, discountPct: Number(form.discountPct), notes: form.notes, sessionToken });
      } else {
        await addGym({ name: form.name, outletType: form.outletType, address: form.address, contactName: form.contactName, contactPhone: form.contactPhone, discountPct: Number(form.discountPct), notes: form.notes, sessionToken });
      }
      toast({ title: t("تم ✓", "Saved ✓") });
      setShowForm(false);
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };
  const toggleActive = async (g: any) => {
    await updateGym({ id: g.id as any, isActive: !g.isActive, sessionToken });
  };
  const copyCatalog = async (g: any) => {
    setCopyingOutletId(g.id);
    try {
      const result: any = await copyOnlineCatalog({ outletId: g.id as any, sessionToken });
      toast({ title: t("تم ربط قائمة الأونلاين بالمنفذ", "Online catalogue copied to outlet"), description: `${result.total} ${t("صنفًا بنفس أسعار الأونلاين", "items with online prices")}` });
    } catch (e: any) {
      toast({ title: t("فشل نسخ القائمة", "Catalogue copy failed"), description: e?.message });
    } finally {
      setCopyingOutletId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew} className="h-10 text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
          <Plus className="h-4 w-4 me-1" /> {t("منفذ جديد", "New outlet")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-2 border-[#0E76AC]/30">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("الاسم", "Name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("نوع المنفذ", "Outlet type")}</Label><select value={form.outletType || "GYM"} onChange={(e) => setForm({ ...form, outletType: e.target.value })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="GYM">{t("جيم", "Gym")}</option><option value="STORE">{t("محل", "Store")}</option><option value="KIOSK">{t("كشك", "Kiosk")}</option><option value="OTHER">{t("جهة أخرى", "Other")}</option></select></div>
            <div><Label>{t("الخصم %", "Discount %")}</Label><Input type="number" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} /></div>
            <div><Label>{t("العنوان", "Address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>{t("مسؤول التواصل", "Contact name")}</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><Label>{t("هاتف", "Phone")}</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button onClick={submit} className="text-white" style={{ background: "#0E76AC" }}>{t("حفظ", "Save")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="text-start p-3">{t("الاسم", "Name")}</th>
              <th className="text-start p-3">{t("النوع", "Type")}</th>
              <th className="text-start p-3">{t("العنوان", "Address")}</th>
              <th className="text-center p-3">{t("الخصم %", "Discount %")}</th>
              <th className="text-start p-3">{t("مسؤول", "Contact")}</th>
              <th className="text-center p-3">{t("نشط", "Active")}</th>
              <th className="p-3" />
            </tr></thead>
            <tbody>
              {gyms.map((g: any) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{g.name}</td>
                  <td className="p-3 text-slate-600">{({ GYM: t("جيم", "Gym"), STORE: t("محل", "Store"), KIOSK: t("كشك", "Kiosk"), OTHER: t("أخرى", "Other") } as Record<string, string>)[g.outletType || "GYM"]}</td>
                  <td className="p-3 text-slate-600">{g.address || "—"}</td>
                  <td className="p-3 text-center font-black text-emerald-700">{g.discountPct}%</td>
                  <td className="p-3 text-slate-600">{g.contactName || "—"}{g.contactPhone && <div className="text-[10px] text-slate-400">{g.contactPhone}</div>}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleActive(g)} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", g.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {g.isActive ? t("نشط", "Active") : t("موقوف", "Inactive")}
                    </button>
                  </td>
                  <td className="p-3 text-end">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button disabled={copyingOutletId === g.id} onClick={() => copyCatalog(g)} className="text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50">{copyingOutletId === g.id ? t("جاري النسخ…", "Copying…") : t("نسخ قائمة الأونلاين", "Copy online catalogue")}</button>
                      <button onClick={() => openEdit(g)} className="text-xs font-bold text-[#0E76AC] hover:underline">{t("تعديل", "Edit")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {gyms.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-400 py-8">{t("لم تتم إضافة منافذ بعد", "No outlets yet")}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Per-outlet catalogue editor ═══════════════════════════════ */

function OutletItemsTab({ isRtl, t, sessionToken, gyms, selectedGymId, setSelectedGymId, toast }: any) {
  const meals = useQuery(api.gymSales.listOutletCatalogAdmin, selectedGymId ? { outletId: selectedGymId as any, sessionToken } : "skip") as any[] | undefined;
  const setItem = useMutation(api.gymSales.setOutletCatalogItem);
  const createMealMutation = useMutation(api.gymSales.createOutletMeal);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMeal, setNewMeal] = useState({ nameAr: "", nameEn: "", category: "lunch", price: "" });
  // ✏️ تعديل سعر صنف لهذا المنفذ فقط (لا يؤثّر على المنافذ الأخرى ولا المنيو العام)
  /* كل ما يخصّ المنفذ يُحرَّر هنا: سعره وباركوده وسعراته وماكروزه. هذه هي
     الشاشة الوحيدة التي تُعدّل بيانات المنفذ — لا تمسّ الوجبة ولا المشترك. */
  type OutletDraft = { id: string; price: string; barcode: string; calories: string; protein: string; carbs: string; fats: string };
  const [editPrice, setEditPrice] = useState<OutletDraft | null>(null);

  const selectedOutlet = gyms.find((g: any) => g.id === selectedGymId);
  const filtered = useMemo(() => (meals || []).filter((m: any) => {
    if (filter === "enabled" && !m.isEnabled) return false;
    if (filter === "disabled" && m.isEnabled) return false;
    const qq = q.trim().toLowerCase();
    return !qq || String(m.nameAr || "").toLowerCase().includes(qq) || String(m.nameEn || "").toLowerCase().includes(qq);
  }), [meals, q, filter]);

  const toggle = async (m: any) => {
    if (!selectedGymId) return;
    setSavingId(m.id);
    try {
      await setItem({ outletId: selectedGymId as any, mealId: m.id as any, isEnabled: !m.isEnabled, sessionToken });
      toast({ title: !m.isEnabled ? t("تم تفعيل الصنف بنفس سعره", "Item enabled with its saved price") : t("تم إيقاف الصنف لهذا المنفذ فقط", "Item disabled for this outlet only") });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
    finally { setSavingId(null); }
  };

  // ✏️ حفظ سعر جديد لصنف في هذا المنفذ فقط — يستدعي نفس setOutletCatalogItem بحقل price.
  const savePrice = async (m: any) => {
    if (!selectedGymId || !editPrice) return;
    const p = Number(editPrice.price);
    if (!Number.isFinite(p) || p < 0) { toast({ title: t("سعر غير صالح", "Invalid price"), variant: "destructive" }); return; }
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    setSavingId(m.id);
    try {
      await setItem({
        outletId: selectedGymId as any, mealId: m.id as any, price: p,
        barcode: editPrice.barcode.trim() || undefined,
        calories: num(editPrice.calories), protein: num(editPrice.protein),
        carbs: num(editPrice.carbs), fats: num(editPrice.fats),
        sessionToken,
      });
      toast({ title: t("تم الحفظ لهذا المنفذ فقط ✓", "Saved for this outlet only ✓") });
      setEditPrice(null);
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
    finally { setSavingId(null); }
  };

  const createMeal = async () => {
    if (!selectedGymId) return toast({ title: t("اختر المنفذ أولًا", "Select an outlet first") });
    setCreating(true);
    try {
      await createMealMutation({ outletId: selectedGymId as any, nameAr: newMeal.nameAr, nameEn: newMeal.nameEn, category: newMeal.category as any, price: Number(newMeal.price), sessionToken });
      toast({ title: t(`تمت إضافة الصنف إلى ${selectedOutlet?.name || "المنفذ"}`, `Item added to ${selectedOutlet?.name || "outlet"}`) });
      setNewMeal({ nameAr: "", nameEn: "", category: "lunch", price: "" });
      setShowCreate(false);
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
    finally { setCreating(false); }
  };

  const enabledCount = meals?.filter((m: any) => m.isEnabled).length || 0;

  // وحدة السعر: أصناف الكافيه bulk بالجرام (3 خانات عشرية) وأصناف بالقطعة (خانتان).
  const unitLabel = (u: string | null) => u === "gram" ? t("/جم", "/g") : u === "piece" ? t("/قطعة", "/pc") : "";
  const fmtPrice = (m: any) => `${Number(m.outletPrice).toFixed(m.priceUnit === "gram" ? 3 : 2)} ${t("ر.ق", "QAR")}${unitLabel(m.priceUnit)}`;
  // تجميع بالتصنيف الحقيقي للمنفذ (PROTEIN/SIDES…) بترتيب أول ظهور — عرض مرتّب.
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of filtered) {
      const k = m.outletCategory || (m.category ? String(m.category).toUpperCase() : "—");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-3">
      <Card className="rounded-lg border-slate-200"><CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,1.5fr)_auto]">
        <div><Label>{t("المنفذ المطلوب إدارته", "Outlet to manage")}</Label><select value={selectedGymId || ""} onChange={(e) => setSelectedGymId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-bold">{gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="relative self-end"><Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث في كل الأصناف، المفعلة والموقوفة…", "Search enabled and disabled items…")} className="h-10 ps-9" /></div>
        <Button onClick={() => setShowCreate((v) => !v)} className="h-10 self-end bg-[#0E76AC] font-bold text-white"><Plus className="me-1 h-4 w-4" />{t("صنف جديد لهذا المنفذ", "New item for this outlet")}</Button>
      </CardContent></Card>

      {showCreate && <Card className="rounded-lg border-[#3CC4F0]/40"><CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><Label>{t("المنفذ", "Outlet")}</Label><Input value={selectedOutlet?.name || ""} disabled className="font-bold" /></div>
        <div><Label>{t("الاسم بالعربي", "Arabic name")}</Label><Input value={newMeal.nameAr} onChange={(e) => setNewMeal((m) => ({...m,nameAr:e.target.value}))} /></div>
        <div><Label>{t("الاسم بالإنجليزي", "English name")}</Label><Input value={newMeal.nameEn} onChange={(e) => setNewMeal((m) => ({...m,nameEn:e.target.value}))} /></div>
        <div><Label>{t("التصنيف", "Category")}</Label><select value={newMeal.category} onChange={(e) => setNewMeal((m) => ({...m,category:e.target.value}))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="breakfast">{t("فطور","Breakfast")}</option><option value="lunch">{t("غداء","Lunch")}</option><option value="dinner">{t("عشاء","Dinner")}</option><option value="salad">{t("سلطة","Salad")}</option><option value="snack">{t("سناك","Snack")}</option></select></div>
        <div><Label>{t("سعر هذا المنفذ", "This outlet price")}</Label><Input type="number" min="0" step="0.01" value={newMeal.price} onChange={(e) => setNewMeal((m) => ({...m,price:e.target.value}))} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-5"><Button variant="outline" onClick={() => setShowCreate(false)}>{t("إلغاء","Cancel")}</Button><Button onClick={createMeal} disabled={creating || (!newMeal.nameAr.trim() && !newMeal.nameEn.trim()) || newMeal.price === ""} className="bg-[#0E76AC] text-white">{t("إضافة للمنفذ المحدد","Add to selected outlet")}</Button></div>
      </CardContent></Card>}

      <Card className="rounded-lg border-slate-200"><CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
          {([['all',t('الكل','All')],['enabled',t('مفعّل','Enabled')],['disabled',t('موقوف','Disabled')]] as const).map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={cn("h-9 rounded-lg px-4 text-xs font-bold", filter === key ? "bg-[#0E76AC] text-white" : "border border-slate-200 bg-white text-slate-600")}>{label}</button>)}
          {/* نسبة الخصم تُضبط مرة واحدة في شاشة «المنافذ»، وتُطبَّق على السعر
              المكتوب هنا. نقولها هنا فقط لئلا يظنّ من يكتب السعر أنه النهائي. */}
          {Number(selectedOutlet?.discountPct || 0) > 0 && (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800">
              {t(`خصم هذا المنفذ ${selectedOutlet.discountPct}% يُطبَّق على الأسعار أدناه`,
                 `This outlet's ${selectedOutlet.discountPct}% discount applies to the prices below`)}
            </span>
          )}
          <span className="ms-auto text-xs font-bold text-slate-500">{selectedOutlet?.name}: <b className="text-emerald-700">{enabledCount}</b> / {meals?.length || 0}</span>
        </div>
        <div className="max-h-[62vh] divide-y divide-slate-100 overflow-y-auto">
          {!meals && <div className="p-8 text-center text-slate-400">{t("جاري التحميل…","Loading…")}</div>}
          {meals && filtered.length === 0 && <div className="p-8 text-center text-slate-400">{t("لا أصناف مطابقة","No matching items")}</div>}
          {grouped.map(([catName, items]) => (
            <div key={catName}>
              <div className="sticky top-0 z-[1] flex items-center justify-between bg-[#0E2A4A] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white">
                <span>{catName}</span><span className="opacity-70">{items.length}</span>
              </div>
              {items.map((m: any) => <div key={m.id} className={cn("flex items-center gap-3 p-3", m.isEnabled ? "bg-emerald-50/30" : "bg-white")}>
                <button onClick={() => toggle(m)} disabled={savingId === m.id} className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2", m.isEnabled ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent")}><Check className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{isRtl ? m.nameAr || m.nameEn : m.nameEn || m.nameAr}</p><p className="text-[10px] text-slate-400">{m.outletCategory || m.category}{m.priceUnit === "gram" ? ` · ${t("بالوزن (جرام)","by weight (grams)")}` : m.priceUnit === "piece" ? ` · ${t("بالقطعة","per piece")}` : ""}</p></div>
                {editPrice?.id === m.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    {([
                      ["price", t("السعر", "Price"), "w-20"],
                      ["barcode", t("الباركود", "Barcode"), "w-24"],
                      ["calories", t("سعرات", "Cal"), "w-16"],
                      ["protein", t("بروتين", "P"), "w-14"],
                      ["carbs", t("كارب", "C"), "w-14"],
                      ["fats", t("دهون", "F"), "w-14"],
                    ] as const).map(([key, label, width]) => (
                      <label key={key} className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-400">{label}</span>
                        <Input
                          type={key === "barcode" ? "text" : "number"}
                          min="0" step={key === "price" && m.priceUnit === "gram" ? "0.001" : "0.01"}
                          autoFocus={key === "price"}
                          value={(editPrice as any)[key] ?? ""}
                          onChange={(e) => setEditPrice({ ...editPrice, [key]: e.target.value } as any)}
                          onKeyDown={(e) => { if (e.key === "Enter") savePrice(m); if (e.key === "Escape") setEditPrice(null); }}
                          className={cn("h-8 text-center font-black", width)} />
                      </label>
                    ))}
                    <button onClick={() => savePrice(m)} disabled={savingId === m.id} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white">{t("حفظ","Save")}</button>
                    <button onClick={() => setEditPrice(null)} className="h-8 rounded-lg bg-slate-100 px-2 text-xs font-bold text-slate-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => setEditPrice({
                      id: m.id, price: String(m.outletPrice ?? ""), barcode: String(m.outletBarcode ?? ""),
                      calories: m.outletCalories != null ? String(m.outletCalories) : "",
                      protein: m.outletProtein != null ? String(m.outletProtein) : "",
                      carbs: m.outletCarbs != null ? String(m.outletCarbs) : "",
                      fats: m.outletFats != null ? String(m.outletFats) : "",
                    })}
                    title={t("اضغط لتعديل بيانات هذا المنفذ","Tap to edit this outlet's data")}
                    className="text-end group">
                    <p className="text-sm font-black text-[#0E76AC] group-hover:underline">{fmtPrice(m)} <Pencil className="inline h-3 w-3 opacity-40" /></p>
                    <p className="text-[10px] text-slate-400">
                      {m.outletCalories != null ? `${m.outletCalories} kcal · ` : ""}
                      {m.outletBarcode ? `${m.outletBarcode} · ` : ""}
                      {t("بيانات هذا المنفذ — اضغط للتعديل","This outlet's data — tap to edit")}
                    </p>
                  </button>
                )}
                <button onClick={() => toggle(m)} disabled={savingId === m.id} className={cn("h-8 min-w-[92px] rounded-lg px-3 text-xs font-bold", m.isEnabled ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700")}>{m.isEnabled ? t("إيقاف هنا","Disable here") : t("إعادة التفعيل","Re-enable")}</button>
              </div>)}
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}
