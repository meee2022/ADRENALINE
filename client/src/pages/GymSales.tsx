/**
 * @file client/src/pages/GymSales.tsx
 * @description مبيعات الجم — POS مقسّم بالتبويبات: نقطة بيع + سجل + تقارير + إدارة الجمات + أسعار الجم.
 * @convex convex/gymSales.ts
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Dumbbell, Plus, Receipt, ClipboardList, BarChart3, Settings, Search, Printer, ChefHat, Coffee, Salad, Cookie, Utensils, Save, X, Building2, Check, ListChecks, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/dialogs";
import { useToast } from "@/hooks/use-toast";

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayStr().slice(0, 7);

type Tab = "pos" | "history" | "returns" | "reports" | "items" | "prices" | "gyms";
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
    <div dir={isRtl ? "rtl" : "ltr"} className="gym-sales-page min-h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="gym-sales-header max-w-7xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Dumbbell className="h-6 w-6" />}
          titleAr="مبيعات الجم"
          titleEn="Gym Sales"
          subtitleAr="نقطة بيع + تقارير"
          subtitleEn="POS + reports"
        />
      </div>

      <div className="gym-sales-content max-w-7xl mx-auto px-4 pb-10">
        {/* Tabs */}
        <div className="gym-sales-tabs mt-4 grid grid-cols-2 sm:grid-cols-7 gap-2">
          {([
            ["pos",     Receipt,       t("نقطة البيع",  "POS")],
            ["history", ClipboardList, t("السجل",       "History")],
            ["returns", PackageX,      t("المرتجعات",   "Returns")],
            ["reports", BarChart3,     t("التقارير",    "Reports")],
            ["items",   ListChecks,    t("أصناف الجم",  "Gym Items")],
            ["prices",  Settings,      t("أسعار الجم",  "Gym Prices")],
            ["gyms",    Building2,     t("الجمات",      "Gyms")],
          ] as [Tab, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all",
                tab === k ? "bg-[#0E76AC] text-white shadow-md" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
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
              <p className="text-amber-800 font-bold">{t("لسه ما ضفتش جم — ابدأ من تبويب «الجمات»", "No gym yet — start from the «Gyms» tab")}</p>
              <Button onClick={() => setTab("gyms")} style={{ background: "#0E76AC", color: "#fff" }}>
                <Plus className="h-4 w-4 mr-1" /> {t("أضف جم", "Add gym")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          {tab === "pos"     && <PosTab     isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
          {tab === "history" && <HistoryTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} />}
          {tab === "returns" && <ReturnsTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
          {tab === "reports" && <ReportsTab isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} />}
          {tab === "items"   && <ItemsTab   isRtl={isRtl} t={t} sessionToken={sessionToken} toast={toast} />}
          {tab === "prices"  && <PricesTab  isRtl={isRtl} t={t} sessionToken={sessionToken} gyms={gyms || []} selectedGymId={selectedGymId} setSelectedGymId={setSelectedGymId} toast={toast} />}
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
    if (!selectedGymId) return toast({ title: t("اختر الجم", "Select a gym") });
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
              <Label className="text-xs text-slate-500 font-bold">{t("الجم", "Gym")}</Label>
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
            <div className="relative">
              <Search className="absolute h-4 w-4 top-3 start-3 text-slate-400 pointer-events-none" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث عن وجبة…", "Search meals…")} className="h-10 ps-9" />
            </div>
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
              className="rounded-xl bg-white border border-slate-200 hover:border-[#0E76AC] hover:shadow-md active:scale-95 transition-all p-3 text-start"
            >
              <p className="font-bold text-sm text-slate-900 line-clamp-2 min-h-[2.5rem]">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: (CAT_META[m.category as CatKey] || CAT_META.all).color + "20", color: (CAT_META[m.category as CatKey] || CAT_META.all).color }}>
                  {isRtl ? (CAT_META[m.category as CatKey]?.ar || m.category) : (CAT_META[m.category as CatKey]?.en || m.category)}
                </span>
                <span className="text-sm font-black text-[#0E76AC]">{m.effectivePrice.toFixed(2)}</span>
              </div>
              {m.isCustom ? (
                <span className="mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">{t("سعر جم مؤقت", "gym price")}</span>
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

function HistoryTab({ isRtl, t, sessionToken, gyms }: any) {
  const [from, setFrom] = useState(thisMonth() + "-01");
  const [to, setTo] = useState(todayStr());
  const [gymId, setGymId] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery(api.gymSales.listOrders, { from, to, gymId: (gymId || undefined) as any, sessionToken }) as any;
  const openOrder = useQuery(api.gymSales.getOrder, openId ? { orderId: openId as any, sessionToken } : "skip") as any;
  const deleteOrder = useMutation(api.gymSales.deleteOrder);

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
            <Label className="text-xs font-bold text-slate-500">{t("الجم", "Gym")}</Label>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">{t("كل الجمات", "All gyms")}</option>
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
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-start p-3">{t("التاريخ", "Date")}</th>
                <th className="text-start p-3">{t("الجم", "Gym")}</th>
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
                  <td className="p-3 text-end font-black text-[#0E76AC]">{r.total.toFixed(2)}</td>
                  <td className="p-3 text-end">
                    <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="text-xs font-bold text-[#0E76AC] hover:underline">
                      {openId === r.id ? t("إغلاق", "Close") : t("تفاصيل", "Details")}
                    </button>
                    <button onClick={async () => { if (await confirmDialog({ title: t("تأكيد الحذف","Confirm Delete"), message: t("حذف الطلبية؟", "Delete order?"), variant: "danger", confirmText: t("حذف","Delete") })) { await deleteOrder({ orderId: r.id as any, sessionToken }); } }} className="ms-3 text-xs font-bold text-red-600 hover:underline">
                      {t("حذف", "Delete")}
                    </button>
                  </td>
                </tr>
              ))}
              {(!list || list.rows.length === 0) && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8">{t("لا توجد طلبيات", "No orders")}</td></tr>
              )}
            </tbody>
          </table>

          {openId && openOrder && (
            <div className="border-t-2 border-slate-100 bg-slate-50 p-4">
              <h4 className="font-black mb-2">{t("أسطر الطلبية", "Order lines")} — {openOrder.date} · {openOrder.gymName}</h4>
              <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr><th className="text-start p-2">{t("الوجبة", "Meal")}</th><th className="text-center p-2">{t("الكمية", "Qty")}</th><th className="text-end p-2">{t("سعر الوحدة", "Unit")}</th><th className="text-end p-2">{t("الإجمالي", "Total")}</th></tr>
                </thead>
                <tbody>
                  {openOrder.lines.map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="p-2 font-bold">{isRtl ? (l.mealNameAr || l.mealNameEn) : (l.mealNameEn || l.mealNameAr)}</td>
                      <td className="p-2 text-center">{l.qty}</td>
                      <td className="p-2 text-end">{l.unitPrice.toFixed(2)}</td>
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

  const maxDay = useMemo(() => {
    if (!report?.days?.length) return 0;
    return Math.max(...report.days.map((d: any) => d.total));
  }, [report]);
  const rangeLabel = selectedRange.from === selectedRange.to
    ? selectedRange.from
    : `${selectedRange.from} - ${selectedRange.to}`;

  const printInvoice = () => {
    if (!report) return;
    const gym = gyms.find((g: any) => g.id === gymId);
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${t("تقرير مبيعات الجيم", "Gym sales report")} — ${rangeLabel}</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:20px;color:#0f1516;font-size:12px}
        h1{font-size:20px;margin:0 0 6px;color:#0E2A4A}
        .head{border-bottom:2px solid #0E76AC;padding-bottom:10px;margin-bottom:15px}
        .info{color:#47759c;font-size:11px;line-height:1.6}
        table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
        th,td{border:1px solid #cdd9e4;padding:6px 8px}
        th{background:#0E76AC;color:#fff;text-align:${isRtl ? "right" : "left"}}
        td.n{text-align:${isRtl ? "left" : "right"};font-family:monospace;font-weight:700}
        tr.tot td{background:#dcebf5;color:#0E76AC;font-weight:900;font-size:13px}
        .box{border:1px solid #cdd9e4;border-radius:8px;padding:8px 12px;text-align:center}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 20px}
        .box .v{font-size:20px;font-weight:900;color:#0E76AC} .box .l{font-size:10px;color:#47759c}
        @page{size:A4;margin:12mm}
      </style></head><body>
      <div class="head">
        <h1>${t("تقرير مبيعات الجيم - Adrenaline", "Gym sales report - Adrenaline")}</h1>
        <div class="info">
          <div><b>${t("الجم", "Gym")}:</b> ${gym?.name || t("كل الجمات", "All gyms")}</div>
          <div><b>${t("الفترة", "Period")}:</b> ${rangeLabel}</div>
          <div><b>${t("عدد أيام التوريد", "Days")}:</b> ${report.daysCount}</div>
        </div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="box"><div class="v">${report.totalMeals}</div><div class="l">${t("إجمالي الوجبات", "Total meals")}</div></div>
        <div class="box"><div class="v">${report.daysCount}</div><div class="l">${t("أيام التوريد", "Days")}</div></div>
        <div class="box"><div class="v">${report.totalRevenue.toFixed(2)}</div><div class="l">${t("الإجمالي المستحق", "Total due")}</div></div>
      </div>
      <h3>${t("التفاصيل اليومية", "Daily breakdown")}</h3>
      <table><thead><tr><th>${t("التاريخ", "Date")}</th><th>${t("عدد الوجبات", "Meals")}</th><th>${t("الإجمالي (ر.ق)", "Total (QAR)")}</th></tr></thead>
      <tbody>${report.days.map((d: any) => `<tr><td>${d.date}</td><td class="n">${d.meals}</td><td class="n">${d.total.toFixed(2)}</td></tr>`).join("")}
      <tr class="tot"><td>${t("الإجمالي", "Grand total")}</td><td class="n">${report.totalMeals}</td><td class="n">${report.totalRevenue.toFixed(2)}</td></tr></tbody></table>
      <h3 style="margin-top:20px">${t("تفصيل حسب الوجبة", "Per-meal breakdown")}</h3>
      <table><thead><tr><th>${t("الوجبة", "Meal")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الإيراد (ر.ق)", "Revenue (QAR)")}</th></tr></thead>
      <tbody>${report.meals.map((m: any) => `<tr><td>${isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td><td class="n">${m.qty}</td><td class="n">${m.revenue.toFixed(2)}</td></tr>`).join("")}</tbody></table>
      <h3 style="margin-top:20px">${t("المرتجعات والهالك", "Returns and waste")}</h3>
      <table><thead><tr><th>${t("الوجبة", "Meal")}</th><th>${t("مرسل", "Sent")}</th><th>${t("مرتجع", "Returned")}</th><th>${t("قيمة الهالك (ر.ق)", "Waste (QAR)")}</th></tr></thead>
      <tbody>${(returnsRep?.meals || []).filter((m: any) => m.returned > 0).map((m: any) => `<tr><td>${isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td><td class="n">${m.sent}</td><td class="n">${m.returned}</td><td class="n">${m.wasteValue.toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="4">${t("لا توجد مرتجعات في هذه الفترة", "No returns in this period")}</td></tr>`}
      <tr class="tot"><td>${t("الإجمالي", "Total")}</td><td class="n">${returnsRep?.totals?.sent || 0}</td><td class="n">${returnsRep?.totals?.returned || 0}</td><td class="n">${Number(returnsRep?.totals?.wasteValue || 0).toFixed(2)}</td></tr></tbody></table>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gym-report-${selectedRange.from}-${selectedRange.to}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("نوع التقرير", "Report period")}</Label>
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
            <Label className="text-xs font-bold text-slate-500">{t("الجم", "Gym")}</Label>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">{t("كل الجمات", "All gyms")}</option>
              {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={printInvoice} className="w-full h-10 font-black text-white" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
              <Printer className="h-4 w-4 me-2" /> {t("استخراج التقرير", "Export report")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("إجمالي الوجبات", "Total meals")} value={report?.totalMeals ?? "—"} color="#0E76AC" />
        <Stat label={t("الصافي المستحق", "Total due (QAR)")} value={report?.totalRevenue?.toFixed(2) ?? "—"} color="#16a34a" />
        <Stat label={t("متوسط يومي", "Avg/day")} value={report?.avgPerDay?.toFixed(2) ?? "—"} color="#7c3aed" />
        <Stat label={t("أيام التوريد", "Days")} value={report?.daysCount ?? "—"} color="#f59e0b" />
      </div>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("المقارنة اليومية", "Daily comparison")}</h3>
          <div className="space-y-1.5">
            {(report?.days || []).map((d: any) => {
              const pct = maxDay ? (d.total / maxDay) * 100 : 0;
              const isBest = report?.bestDay?.date === d.date;
              const isWorst = report?.worstDay?.date === d.date;
              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-20 font-bold text-slate-600">{d.date}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden relative">
                    <div className="h-full" style={{ width: `${pct}%`, background: isBest ? "linear-gradient(90deg,#16a34a,#22c55e)" : isWorst ? "linear-gradient(90deg,#dc2626,#ef4444)" : "linear-gradient(90deg,#0E76AC,#3cc4f0)" }} />
                    <span className="absolute inset-y-0 start-2 flex items-center font-black text-white">{d.meals} {t("و", "m")}</span>
                  </div>
                  <span className="w-20 text-end font-black text-slate-800">{d.total.toFixed(2)}</span>
                </div>
              );
            })}
            {(!report || report.days.length === 0) && <p className="text-center text-slate-400 py-6 text-sm">{t("لا توجد بيانات", "No data")}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("تفصيل حسب الوجبة", "Per-meal breakdown")}</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr><th className="text-start p-2">{t("الوجبة", "Meal")}</th><th className="text-center p-2">{t("الكمية", "Qty")}</th><th className="text-end p-2">{t("الإيراد", "Revenue")}</th></tr>
            </thead>
            <tbody>
              {(report?.meals || []).map((m: any) => (
                <tr key={m.key} className="border-t border-slate-100">
                  <td className="p-2 font-bold">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td>
                  <td className="p-2 text-center font-black">{m.qty}</td>
                  <td className="p-2 text-end font-black text-[#0E76AC]">{m.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {(!report || report.meals.length === 0) && <tr><td colSpan={3} className="text-center text-slate-400 py-6">{t("لا توجد بيانات", "No data")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ✅ ملخص المرتجعات + قيمة الهالك للشهر */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("مرتجعات الفترة", "Returned in period")} value={returnsRep?.totals?.returned ?? "—"} color="#dc2626" />
        <Stat label={t("نسبة الإرجاع", "Return rate %")} value={returnsRep?.totals?.returnRate != null ? `${returnsRep.totals.returnRate}%` : "—"} color="#dc2626" />
        <Stat label={t("قيمة الهالك (ر.ق)", "Waste value (QAR)")} value={returnsRep?.totals?.wasteValue?.toFixed(2) ?? "—"} color="#dc2626" />
        <Stat label={t("صافي الإيراد بعد الهالك", "Net revenue after waste")} value={returnsRep?.totals?.netRevenue?.toFixed(2) ?? "—"} color="#16a34a" />
      </div>

      {/* ✅ أكتر الوجبات إرجاعًا — قرارات إيقاف/تقليل الإنتاج */}
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black">{t("أكثر الوجبات إرجاعًا (مرشحة للإيقاف/التقليل)", "Most returned meals (candidates to reduce/stop)")}</h3>
            <span className="text-[10px] text-slate-400 font-bold">
              {t("مرتّبة حسب نسبة الإرجاع", "Sorted by return rate")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                  <th className="text-center p-2">{t("مُرسل", "Sent")}</th>
                  <th className="text-center p-2">{t("مرتجع", "Returned")}</th>
                  <th className="text-center p-2">{t("صافي", "Net")}</th>
                  <th className="text-center p-2">{t("نسبة الإرجاع", "Return %")}</th>
                  <th className="text-end p-2">{t("قيمة الهالك", "Waste (QAR)")}</th>
                </tr>
              </thead>
              <tbody>
                {(returnsRep?.meals || []).filter((m: any) => m.returned > 0).map((m: any) => {
                  const bad = m.returnRate >= 20;
                  const meh = m.returnRate >= 10 && m.returnRate < 20;
                  return (
                    <tr key={m.key} className="border-t border-slate-100">
                      <td className="p-2 font-bold">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</td>
                      <td className="p-2 text-center font-black">{m.sent}</td>
                      <td className="p-2 text-center font-black" style={{ color: "#dc2626" }}>{m.returned}</td>
                      <td className="p-2 text-center font-black text-slate-700">{m.net}</td>
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
                    </tr>
                  );
                })}
                {(!returnsRep || returnsRep.meals.filter((m: any) => m.returned > 0).length === 0) && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-6">{t("لا توجد مرتجعات مسجلة في هذه الفترة", "No returns recorded in this period")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="text-xl font-black mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════ Returns Tab ═══════════════════════════════ */

function ReturnsTab({ isRtl, t, sessionToken, gyms, selectedGymId, setSelectedGymId, toast }: any) {
  // 🕐 نطاق التاريخ: افتراضي آخر 7 أيام. الجم بيرجع بعد يومين، فالموظف بيسجّل خلال أسبوع.
  //    لو نسي يفتح "أقدم" علشان يشوف طلبيات أقدم.
  const [days, setDays] = useState(7);
  const [returnsDate, setReturnsDate] = useState("");
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

  useEffect(() => {
    if (selectedReturnOrderId && orders && !orders.some((order) => order.id === selectedReturnOrderId)) {
      setSelectedReturnOrderId("");
    }
  }, [orders, selectedReturnOrderId]);

  const selectedReturnOrder = (orders || []).find((order: any) => order.id === selectedReturnOrderId);

  const setDraft = (orderId: string, lineId: string, val: string) => {
    setDrafts((d) => ({ ...d, [orderId]: { ...(d[orderId] || {}), [lineId]: val } }));
  };
  const saveOrder = async (order: any) => {
    const orderDrafts = drafts[order.id] || {};
    const returns = order.lines.map((l: any) => {
      const raw = orderDrafts[l.id];
      const qty = raw !== undefined ? Number(raw || 0) : Number(l.returnedQty || 0);
      return { lineId: l.id as any, qty };
    });
    setSaving(order.id);
    try {
      const r: any = await record({ orderId: order.id as any, returns, sessionToken });
      toast({
        title: t("تم الحفظ ✓", "Saved ✓"),
        description: t(
          `مرتجع ${r.returnedTotal} وجبة · هالك ${r.wasteValue} ر.ق · صافي ${r.netTotal} ر.ق`,
          `Returned ${r.returnedTotal} · waste ${r.wasteValue} QAR · net ${r.netTotal} QAR`
        ),
      });
      setDrafts((d) => { const cp = { ...d }; delete cp[order.id]; return cp; });
    } catch (e: any) {
      toast({ title: t("فشل", "Failed"), description: e?.message });
    } finally { setSaving(null); }
  };

  const totalWasteAll = (orders || []).reduce((s: number, o: any) => s + Number(o.wasteValue || 0), 0);
  const totalReturnedAll = (orders || []).reduce((s: number, o: any) => s + Number(o.returnedTotal || 0), 0);

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("الجم", "Gym")}</Label>
              <select value={selectedGymId || ""} onChange={(e) => setSelectedGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">{t("كل الجمات", "All gyms")}</option>
                {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("مرتجعات يوم محدد", "Returns for a date")}</Label>
              <div className="flex gap-1">
                <Input type="date" value={returnsDate} onChange={(e) => setReturnsDate(e.target.value)} className="h-10" />
                {returnsDate && <button type="button" onClick={() => setReturnsDate("")} className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 text-slate-600" title={t("إلغاء تحديد اليوم", "Clear date")}><X className="mx-auto h-4 w-4" /></button>}
              </div>
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
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold">
            💡 {t("المرتجع = هالك (مدة الوجبة يومين). سجّل الكميات ثم اضغط «حفظ» — يعيد حساب الفاتورة الفعلية.", "Returns = waste (2-day shelf life). Record qty then Save — it recomputes the actual bill.")}
          </div>
          {!orders && <div className="p-6 text-center text-slate-400">{t("جاري التحميل…", "Loading…")}</div>}
          {orders && orders.length === 0 && <div className="p-6 text-center text-slate-400">{t("لا توجد طلبيات في هذه المدة", "No orders in this window")}</div>}
          {orders && orders.length > 0 && !selectedReturnOrder && <div className="p-8 text-center text-slate-500"><Receipt className="mx-auto mb-2 h-7 w-7 text-[#0E76AC]" /><p className="font-bold">{t("اختر الفاتورة من القائمة بالأعلى لعرض أصنافها", "Choose an invoice above to view its items")}</p></div>}
          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {(selectedReturnOrder ? [selectedReturnOrder] : []).map((o: any) => {
              const isDirty = !!drafts[o.id] && Object.keys(drafts[o.id]).length > 0;
              return (
                <div key={o.id} className="p-3">
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div>
                      <div className="font-black text-sm">{o.gymName} · {o.date}</div>
                      <div className="text-[11px] text-slate-500 font-bold">
                        {t("مُرسل:", "Sent:")} {o.mealsCount} · {t("مرتجع:", "Returned:")} {o.returnedTotal} ·
                        <span className="ms-1" style={{ color: "#dc2626" }}>{t("هالك", "Waste")}: {o.wasteValue.toFixed(2)} ر.ق</span> ·
                        <span className="ms-1 font-black" style={{ color: "#0E76AC" }}>{t("صافي", "Net")}: {o.netTotal.toFixed(2)} ر.ق</span>
                      </div>
                    </div>
                    <button
                      onClick={() => saveOrder(o)}
                      disabled={!isDirty || saving === o.id}
                      className={cn("text-xs font-bold px-3 h-8 rounded-lg", isDirty && saving !== o.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")}
                    >
                      {saving === o.id ? t("جاري…", "…") : t("حفظ المرتجعات", "Save returns")}
                    </button>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                        <th className="text-end p-2">{t("مُرسل", "Sent")}</th>
                        <th className="text-end p-2">{t("مرتجع", "Returned")}</th>
                        <th className="text-end p-2">{t("سعر", "Price")}</th>
                        <th className="text-end p-2">{t("هالك", "Waste")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.lines.map((l: any) => {
                        const draftVal = drafts[o.id]?.[l.id];
                        const showVal = draftVal !== undefined ? draftVal : String(l.returnedQty || "");
                        const rq = Number(showVal || 0);
                        const waste = rq * l.unitPrice;
                        return (
                          <tr key={l.id} className="border-t border-slate-100">
                            <td className="p-2 font-bold">{isRtl ? (l.mealNameAr || l.mealNameEn) : (l.mealNameEn || l.mealNameAr)}</td>
                            <td className="p-2 text-end">{l.qty}</td>
                            <td className="p-2 text-end">
                              <input
                                type="number" min={0} max={l.qty} step="1"
                                value={showVal}
                                onChange={(e) => setDraft(o.id, l.id, e.target.value)}
                                placeholder="0"
                                className="w-16 h-7 text-center border border-slate-200 rounded font-bold"
                              />
                            </td>
                            <td className="p-2 text-end">{l.unitPrice.toFixed(2)}</td>
                            <td className="p-2 text-end font-bold" style={{ color: rq > 0 ? "#dc2626" : "#94a3b8" }}>
                              {waste.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="text-lg font-black mt-1" style={{ color: color || "#0E76AC" }}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════ Prices Tab ═══════════════════════════════ */

function PricesTab({ isRtl, t, sessionToken, gyms, selectedGymId, setSelectedGymId, toast }: any) {
  const meals = useQuery(
    api.gymSales.listMealsForGym,
    selectedGymId ? { gymId: selectedGymId as any, sessionToken } : "skip"
  ) as any[] | undefined;
  const setPrice = useMutation(api.gymSales.setMealGymPrice);
  const setNames = useMutation(api.gymSales.setMealGymNames);
  const applyBulk = useMutation((api.gymSales as any).applyGymPriceList);
  const applyByAr = useMutation((api.gymSales as any).applyGymPricesByArName);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, { nameAr: string; nameEn: string }>>({});
  const [importing, setImporting] = useState(false);

  // 🔒 استيراد قائمة أسعار الجم (42 وجبة من ملف PDF المعتمد).
  //    ADMIN فقط. fuzzy match بالاسم مع gymPrice + isGymItem=true.
  const GYM_PRICE_LIST = [
    { name: "TURKEY AND CHEESECLUB SANDWICH", price: 25 },
    { name: "CLASSIC FATTOUSH", price: 30 },
    { name: "AVACODO TURKEY SANDWICH", price: 25 },
    { name: "BEETROOT SALAD", price: 25 },
    { name: "CRISPY CHICKEN W/HONEY MUSTARD", price: 30 },
    { name: "TENDERLOIN W/RICE", price: 49 },
    { name: "PROTIEN LAZY CAKE", price: 18 },
    { name: "PROTIEN LAVA CAKE", price: 20 },
    { name: "TERIYAKI TOFU W/RICE", price: 37 },
    { name: "PISTACCHIO SALAD", price: 30 },
    { name: "MONGOLIAN BEEF", price: 49 },
    { name: "CRISPY CHICKEN WRAP", price: 35 },
    { name: "MEDITERRENEAN SALAD", price: 30 },
    { name: "CHICKEN CEASER SALAD", price: 30 },
    { name: "MONGOLIAN NOODLES", price: 52 },
    { name: "CRISPY CHICKEN", price: 45 },
    { name: "CHICKEN SHAWARMA", price: 35 },
    { name: "CHICKEN BURGER", price: 35 },
    { name: "SHISH TAWOOK W/RICE", price: 45 },
    { name: "BEEF SHAWARMA BEETROOT", price: 54 },
    { name: "CHICKEN MAJBOOS", price: 48 },
    { name: "SPAGHETTI MEAT BALLS", price: 45 },
    { name: "CHICKEN BREAST W/RICE", price: 42 },
    { name: "CRISPY CHICKEN W/RICE", price: 45 },
    { name: "IRANIAN KOFTA", price: 52 },
    { name: "POWER BALLS", price: 20 },
    { name: "VANILLA MUFFINS", price: 22 },
    { name: "COOKIES", price: 20 },
    { name: "PROTIEN BROWNIES", price: 22 },
    { name: "BEEF SHAWARMA", price: 42 },
    { name: "GREEK CHICKEN", price: 43 },
    { name: "BEEF KOFTA WITH MASHED POTATO", price: 50 },
    { name: "SHISH TAWOOK SANDWICH", price: 34 },
    { name: "CHICKEN FAJITA SANDWICH", price: 40 },
    { name: "STEAK SANDWICH", price: 42 },
    { name: "DYNAMITE SHRIMP W/RICE", price: 42 },
    { name: "BEEF FAJITA SANDWICH", price: 38 },
    { name: "CORDON BLEU", price: 42 },
    { name: "BEEF KOFTA WITH SAFFRON RICE", price: 50 },
    { name: "SWEET CHILLI CHICKEN", price: 45 },
    { name: "BEEF LASAGNA", price: 48 },
    { name: "BEEF FAJITA WRAP", price: 38 },
  ];

  // 🔧 تصحيحات يدوية للأسماء اللي fuzzy match ما لقاش لها مطابق
  const PENDING_MANUAL_MATCHES = [
    { arName: "مجبوس الدجاج", price: 48 },                          // CHICKEN MAJBOOS
    { arName: "كوردون بلو", price: 42 },                             // CORDON BLEU
    { arName: "فتوش كلاسيكي", price: 30 },                           // CLASSIC FATTOUSH
    { arName: "سلطة الجبن الفيتا المتوسطية", price: 30 },            // MEDITERRENEAN SALAD
  ];

  const importCorrections = async () => {
    setImporting(true);
    try {
      const r: any = await applyByAr({ rows: PENDING_MANUAL_MATCHES, sessionToken });
      toast({
        title: t("تم تطبيق التصحيحات ✓", "Corrections applied ✓"),
        description: t(
          `تم ${r.matched}/${r.total}. غير مطابق: ${r.unmatched.length ? r.unmatched.join("، ") : "لا شيء"}`,
          `Matched ${r.matched}/${r.total}. Unmatched: ${r.unmatched.length ? r.unmatched.join(", ") : "none"}`
        ),
      });
    } catch (e: any) {
      toast({ title: t("فشل", "Failed"), description: e?.message });
    } finally { setImporting(false); }
  };

  const importFromList = async () => {
    setImporting(true);
    try {
      const r: any = await applyBulk({ rows: GYM_PRICE_LIST, sessionToken });
      const msg = t(
        `تم ${r.matched}/${r.total}. غير مطابق: ${r.unmatched.length ? r.unmatched.join("، ") : "لا شيء"}`,
        `Matched ${r.matched}/${r.total}. Unmatched: ${r.unmatched.length ? r.unmatched.join(", ") : "none"}`
      );
      toast({ title: t("تم الاستيراد ✓", "Imported ✓"), description: msg });
    } catch (e: any) {
      toast({ title: t("فشل الاستيراد", "Import failed"), description: e?.message });
    } finally { setImporting(false); }
  };

  const filtered = useMemo(() => (meals || []).filter((m: any) => {
    const qq = q.trim().toLowerCase();
    return !qq || String(m.nameEn).toLowerCase().includes(qq) || String(m.nameAr).toLowerCase().includes(qq);
  }), [meals, q]);

  const save = async (mealId: string) => {
    const raw = drafts[mealId];
    const val = raw === "" || raw == null ? undefined : Number(raw);
    const names = nameDrafts[mealId];
    try {
      if (names) {
        await setNames({ mealId: mealId as any, nameAr: names.nameAr, nameEn: names.nameEn, sessionToken });
      }
      if (raw !== undefined) {
        await setPrice({ mealId: mealId as any, gymPrice: val, sessionToken });
      }
      toast({ title: t("تم الحفظ ✓", "Saved ✓") });
      setDrafts((d) => { const cp = { ...d }; delete cp[mealId]; return cp; });
      setNameDrafts((d) => { const cp = { ...d }; delete cp[mealId]; return cp; });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("الجم (لعرض الخصم)", "Gym (for discount preview)")}</Label>
            <select value={selectedGymId || ""} onChange={(e) => setSelectedGymId(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-bold text-slate-500">{t("بحث", "Search")}</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث…", "Search…")} className="h-10" />
          </div>
          <div className="sm:col-span-3 flex gap-2 flex-wrap">
            <button
              id="gym-import-btn"
              onClick={importFromList}
              disabled={importing}
              className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {importing ? t("جاري الاستيراد…", "Importing…") : t("استيراد قائمة أسعار الجم (42 وجبة)", "Import gym price list (42 meals)")}
            </button>
            <button
              id="gym-corrections-btn"
              onClick={importCorrections}
              disabled={importing}
              className="h-10 px-4 rounded-lg bg-amber-600 text-white text-sm font-bold disabled:opacity-50"
              title={t("تطبيق التصحيحات اليدوية للأسماء اللي ما اتطابقتش", "Apply manual name-corrections for previously unmatched items")}
            >
              {t("تطبيق التصحيحات (4)", "Apply corrections (4)")}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold">
            💡 {t("لو الوجبة عندها «سعر جم مؤقت» يُستخدم مباشرة. لو فارغة، النظام يحسب: سعر المنيو × (1 − الخصم).", "If a meal has a custom «gym price», it is used directly. If blank, the system uses menu price × (1 − discount).")}
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0">
              <tr>
                <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                <th className="text-end p-2">{t("سعر المنيو", "Menu price")}</th>
                <th className="text-end p-2">{t("سعر الجم النافذ", "Effective")}</th>
                <th className="text-end p-2">{t("سعر مؤقت", "Custom price")}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {(!meals) && <tr><td colSpan={5} className="text-center py-6 text-slate-400">{t("جاري التحميل…", "Loading…")}</td></tr>}
              {filtered.map((m: any) => {
                const draftVal = drafts[m.id];
                const displayVal = draftVal !== undefined ? draftVal : (m.gymPrice != null ? String(m.gymPrice) : "");
                const nameDraft = nameDrafts[m.id];
                const dirty = draftVal !== undefined || nameDraft !== undefined;
                return (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2">
                      <div className="grid min-w-[240px] grid-cols-1 gap-1 sm:grid-cols-2">
                        <Input
                          value={nameDraft?.nameAr ?? m.nameAr ?? ""}
                          onChange={(e) => setNameDrafts((d) => ({
                            ...d,
                            [m.id]: { nameAr: e.target.value, nameEn: d[m.id]?.nameEn ?? m.nameEn ?? "" },
                          }))}
                          aria-label={t("اسم الوجبة بالعربي", "Arabic meal name")}
                          placeholder={t("الاسم بالعربي", "Arabic name")}
                          className="h-8 text-xs font-bold"
                          dir="rtl"
                        />
                        <Input
                          value={nameDraft?.nameEn ?? m.nameEn ?? ""}
                          onChange={(e) => setNameDrafts((d) => ({
                            ...d,
                            [m.id]: { nameAr: d[m.id]?.nameAr ?? m.nameAr ?? "", nameEn: e.target.value },
                          }))}
                          aria-label={t("اسم الوجبة بالإنجليزي", "English meal name")}
                          placeholder={t("الاسم بالإنجليزي", "English name")}
                          className="h-8 text-xs font-bold"
                          dir="ltr"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">{m.category}</p>
                    </td>
                    <td className={cn("p-2 text-end font-bold", m.listPrice === 0 && "text-red-600")}>
                      {m.listPrice.toFixed(2)}
                      {m.listPrice === 0 && <span className="ms-1 text-[9px] px-1 py-0.5 bg-red-50 text-red-700 rounded font-bold">{t("ضروري", "needed")}</span>}
                    </td>
                    <td className="p-2 text-end font-black text-[#0E76AC]">{m.effectivePrice.toFixed(2)}</td>
                    <td className="p-2 text-end">
                      <input type="number" step="0.01" value={displayVal} onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))} placeholder="—" className="w-20 h-8 text-center border border-slate-200 rounded font-bold" />
                    </td>
                    <td className="p-2 text-end">
                      <button onClick={() => save(m.id)} disabled={!dirty} className={cn("text-xs font-bold px-3 h-8 rounded-lg transition-all", dirty ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                        {t("حفظ", "Save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Gyms Tab ═══════════════════════════════ */

function GymsTab({ isRtl, t, sessionToken, gyms, toast }: any) {
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const addGym = useMutation(api.gymSales.addGym);
  const updateGym = useMutation(api.gymSales.updateGym);
  const [form, setForm] = useState<any>({ name: "", address: "", contactName: "", contactPhone: "", discountPct: 20, notes: "" });

  const openNew = () => { setForm({ name: "", address: "", contactName: "", contactPhone: "", discountPct: 20, notes: "" }); setEditing(null); setShowForm(true); };
  const openEdit = (g: any) => { setForm({ ...g }); setEditing(g); setShowForm(true); };
  const submit = async () => {
    try {
      if (editing) {
        await updateGym({ id: editing.id as any, name: form.name, address: form.address, contactName: form.contactName, contactPhone: form.contactPhone, discountPct: Number(form.discountPct), notes: form.notes, sessionToken });
      } else {
        await addGym({ name: form.name, address: form.address, contactName: form.contactName, contactPhone: form.contactPhone, discountPct: Number(form.discountPct), notes: form.notes, sessionToken });
      }
      toast({ title: t("تم ✓", "Saved ✓") });
      setShowForm(false);
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };
  const toggleActive = async (g: any) => {
    await updateGym({ id: g.id as any, isActive: !g.isActive, sessionToken });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew} className="h-10 text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
          <Plus className="h-4 w-4 me-1" /> {t("جم جديد", "New gym")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-2 border-[#0E76AC]/30">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("الاسم", "Name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
                  <td className="p-3 text-slate-600">{g.address || "—"}</td>
                  <td className="p-3 text-center font-black text-emerald-700">{g.discountPct}%</td>
                  <td className="p-3 text-slate-600">{g.contactName || "—"}{g.contactPhone && <div className="text-[10px] text-slate-400">{g.contactPhone}</div>}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleActive(g)} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", g.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {g.isActive ? t("نشط", "Active") : t("موقوف", "Inactive")}
                    </button>
                  </td>
                  <td className="p-3 text-end">
                    <button onClick={() => openEdit(g)} className="text-xs font-bold text-[#0E76AC] hover:underline">{t("تعديل", "Edit")}</button>
                  </td>
                </tr>
              ))}
              {gyms.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("لم يتم إضافة جم بعد", "No gyms yet")}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Items Tab (اختيار أصناف الجم) ═══════════════════════════════ */

function ItemsTab({ isRtl, t, sessionToken, toast }: any) {
  const meals = useQuery(api.gymSales.listAllMealsForGymAdmin, { sessionToken }) as any[] | undefined;
  const setItem = useMutation(api.gymSales.setMealIsGymItem);
  const createGymMeal = useMutation(api.gymSales.createGymMeal);
  const bulkSet = useMutation(api.gymSales.bulkSetGymItems);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "gym" | "menu">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMeal, setNewMeal] = useState({ nameAr: "", nameEn: "", category: "lunch", gymPrice: "" });

  const createMeal = async () => {
    setCreating(true);
    try {
      await createGymMeal({
        nameAr: newMeal.nameAr,
        nameEn: newMeal.nameEn,
        category: newMeal.category as any,
        gymPrice: Number(newMeal.gymPrice),
        sessionToken,
      });
      toast({ title: t("تمت إضافة وجبة الجيم ✓", "Gym meal added ✓") });
      setNewMeal({ nameAr: "", nameEn: "", category: "lunch", gymPrice: "" });
      setShowCreate(false);
    } catch (e: any) {
      toast({ title: t("فشل", "Failed"), description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    if (!meals) return [];
    const qq = q.trim().toLowerCase();
    return meals.filter((m: any) => {
      if (filter === "gym"  && !m.isGymItem) return false;
      if (filter === "menu" &&  m.isGymItem) return false;
      if (!qq) return true;
      return String(m.nameEn).toLowerCase().includes(qq) || String(m.nameAr).toLowerCase().includes(qq);
    });
  }, [meals, q, filter]);

  const gymCount = meals?.filter((m: any) => m.isGymItem).length ?? 0;
  const total = meals?.length ?? 0;

  const toggle = async (m: any) => {
    setSavingId(m.id);
    try {
      await setItem({ mealId: m.id as any, isGymItem: !m.isGymItem, sessionToken });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
    finally { setSavingId(null); }
  };

  const clearAll = async () => {
    if (!(await confirmDialog({ title: t("تأكيد","Confirm"), message: t("هذا سيلغي إدراج كل الأصناف من الجم — متأكد؟", "This will unmark ALL gym items — confirm?"), variant: "danger" }))) return;
    const ids = (meals || []).filter((m: any) => m.isGymItem).map((m: any) => m.id);
    if (!ids.length) return;
    await bulkSet({ mealIds: ids as any, isGymItem: false, sessionToken });
    toast({ title: t("تم إلغاء الكل", "All cleared") });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((value) => !value)} className="h-10 font-bold text-white" style={{ background: "#0E76AC" }}>
          <Plus className="me-1 h-4 w-4" /> {t("وجبة جيم جديدة", "New gym meal")}
        </Button>
      </div>

      {showCreate && <Card className="rounded-lg border-2 border-[#0E76AC]/30">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>{t("الاسم بالعربي", "Arabic name")}</Label><Input value={newMeal.nameAr} onChange={(e) => setNewMeal((m) => ({ ...m, nameAr: e.target.value }))} dir="rtl" /></div>
          <div><Label>{t("الاسم بالإنجليزي", "English name")}</Label><Input value={newMeal.nameEn} onChange={(e) => setNewMeal((m) => ({ ...m, nameEn: e.target.value }))} dir="ltr" /></div>
          <div><Label>{t("التصنيف", "Category")}</Label><select value={newMeal.category} onChange={(e) => setNewMeal((m) => ({ ...m, category: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="breakfast">{t("فطور", "Breakfast")}</option><option value="lunch">{t("غداء", "Lunch")}</option><option value="dinner">{t("عشاء", "Dinner")}</option><option value="salad">{t("سلطة", "Salad")}</option><option value="snack">{t("سناك", "Snack")}</option></select></div>
          <div><Label>{t("سعر الجيم", "Gym price")}</Label><Input type="number" min="0" step="0.01" value={newMeal.gymPrice} onChange={(e) => setNewMeal((m) => ({ ...m, gymPrice: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button onClick={createMeal} disabled={creating || (!newMeal.nameAr.trim() && !newMeal.nameEn.trim()) || newMeal.gymPrice === ""} className="text-white" style={{ background: "#0E76AC" }}>{creating ? t("جاري الحفظ…", "Saving…") : t("إضافة الوجبة", "Add meal")}</Button>
          </div>
        </CardContent>
      </Card>}

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="absolute h-4 w-4 top-3 start-3 text-slate-400 pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث…", "Search…")} className="h-10 ps-9" />
          </div>
          <div>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">{t("كل الوجبات", "All meals")}</option>
              <option value="gym">{t("أصناف الجم فقط", "Gym items only")}</option>
              <option value="menu">{t("خارج الجم", "Not in gym")}</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3">
            <div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase">{t("مضاف للجم", "In gym")}</div>
              <div className="text-lg font-black text-emerald-800">{gymCount} / {total}</div>
            </div>
            {gymCount > 0 && (
              <button onClick={clearAll} className="text-[11px] font-bold text-red-600 hover:underline">{t("مسح الكل", "Clear all")}</button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <div className="p-3 bg-sky-50 border-b border-sky-200 text-sky-800 text-xs font-bold">
            💡 {t("اضغط على الوجبة لإضافتها/إزالتها من قائمة POS الجم. الأصناف المفعّلة فقط تظهر عند إنشاء طلبية للجم.",
                  "Click a meal to add/remove from Gym POS. Only enabled items appear when creating a gym order.")}
          </div>
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
            {(!meals) && <div className="p-8 text-center text-slate-400 text-sm">{t("جاري التحميل…", "Loading…")}</div>}
            {meals && filtered.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">{t("لا نتائج", "No results")}</div>}
            {filtered.map((m: any) => (
              <button
                key={m.id}
                onClick={() => toggle(m)}
                disabled={savingId === m.id}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-start transition-colors",
                  m.isGymItem ? "bg-emerald-50/40 hover:bg-emerald-50" : "hover:bg-slate-50",
                  savingId === m.id && "opacity-50 cursor-wait"
                )}
              >
                <div className={cn(
                  "shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all",
                  m.isGymItem ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300"
                )}>
                  {m.isGymItem && <Check className="h-4 w-4" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-bold text-sm truncate", m.isGymItem ? "text-emerald-900" : "text-slate-800")}>
                    {isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}
                  </p>
                  <p className="text-[10.5px] text-slate-400">{m.category} · {t("سعر المنيو", "menu")}: {m.listPrice.toFixed(2)} {m.gymPrice != null && <>· {t("سعر جم", "gym")}: {m.gymPrice.toFixed(2)}</>}</p>
                </div>
                <span className={cn("shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                  m.isGymItem ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {m.isGymItem ? t("مفعّل", "IN GYM") : t("غير مفعّل", "OFF")}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
