/**
 * @file client/src/pages/PosAdmin.tsx
 * @description إدارة POS (للأدمن): الكاشيرون، الفئات، ألوان الأصناف، التقارير، الورديات.
 * @convex convex/posAdmin.ts
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Store, Users, LayoutGrid, Palette, BarChart3, Clock, Plus, Save, Trash2, RefreshCw, Link as LinkIcon, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "cashiers" | "categories" | "items" | "reports" | "shifts";

export default function PosAdmin() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Store className="h-6 w-6" />}
          titleAr="إدارة نقطة البيع"
          titleEn="POS Admin"
          subtitleAr="الكاشيرون · الأصناف · التقارير · الورديات"
          subtitleEn="Cashiers · Items · Reports · Shifts"
          actions={
            <a href="/pos" target="_blank" rel="noreferrer">
              <Button className="text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
                <ExternalLink className="h-4 w-4 me-1" /> {t("افتح شل الكاشير", "Open Cashier Shell")}
              </Button>
            </a>
          }
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-10">
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {([
            ["overview",   BarChart3,   t("نظرة عامة", "Overview")],
            ["cashiers",   Users,       t("الكاشيرون",  "Cashiers")],
            ["categories", LayoutGrid,  t("الفئات",     "Categories")],
            ["items",      Palette,     t("الأصناف",    "Items")],
            ["reports",    BarChart3,   t("التقارير",   "Reports")],
            ["shifts",     Clock,       t("الورديات",   "Shifts")],
          ] as [Tab, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-2 h-11 rounded-xl text-xs sm:text-sm font-bold transition-all",
                tab === k ? "bg-[#0E76AC] text-white shadow-md" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "overview"   && <OverviewTab   t={t} sessionToken={sessionToken} />}
          {tab === "cashiers"   && <CashiersTab   t={t} sessionToken={sessionToken} toast={toast} isRtl={isRtl} />}
          {tab === "categories" && <CategoriesTab t={t} sessionToken={sessionToken} toast={toast} />}
          {tab === "items"      && <ItemsTab      t={t} sessionToken={sessionToken} toast={toast} isRtl={isRtl} />}
          {tab === "reports"    && <ReportsTab    t={t} sessionToken={sessionToken} />}
          {tab === "shifts"     && <ShiftsTab     t={t} sessionToken={sessionToken} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Overview ═══════════════════════════════ */

function OverviewTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const daily = useQuery(api.posAdmin.dailySummary, { date: today, sessionToken }) as any;
  const cashiers = useQuery(api.posAdmin.listCashiers, { sessionToken }) as any[] | undefined;
  const cats = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white border-0">
        <CardContent className="p-6">
          <p className="text-cyan-100 text-sm font-bold uppercase">{t("مبيعات اليوم", "Today's Sales")}</p>
          <p className="text-5xl font-black mt-1">{daily?.totalSales?.toFixed(2) ?? "—"}
            <span className="text-xl text-cyan-200 ms-2">QAR</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div><span className="text-cyan-200">{t("فواتير", "Tickets")}:</span> <b>{daily?.ticketsCount ?? 0}</b></div>
            <div><span className="text-cyan-200">{t("متوسط", "Avg")}:</span> <b>{daily?.avgTicket?.toFixed(2) ?? "—"}</b></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickCard title={t("الكاشيرون", "Cashiers")}  value={cashiers?.length ?? "—"} color="#0E76AC" icon={Users} />
        <QuickCard title={t("فئات POS", "Categories")} value={cats?.filter((c: any) => c.isActive).length ?? "—"} color="#f59e0b" icon={LayoutGrid} />
        <QuickCard title={t("طرق الدفع اليوم", "Methods today")} value={daily?.byMethod?.length ?? "—"} color="#16a34a" icon={BarChart3} />
      </div>

      {daily?.byMethod?.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h3 className="font-black mb-3">{t("حسب طريقة الدفع", "By payment method")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {daily.byMethod.map((m: any) => (
                <div key={m.method} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase font-bold text-slate-500">{m.method}</p>
                  <p className="text-xl font-black text-slate-900">{m.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">{m.count} {t("فاتورة", "tickets")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickCard({ title, value, color, icon: Icon }: any) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: color + "20", color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase">{title}</p>
          <p className="text-2xl font-black" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Cashiers ═══════════════════════════════ */

function CashiersTab({ t, sessionToken, toast, isRtl }: any) {
  const rows = useQuery(api.posAdmin.listCashiers, { sessionToken }) as any[] | undefined;
  const create = useMutation(api.posAdmin.createCashier);
  const update = useMutation(api.posAdmin.updateCashier);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", pin: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [newPin, setNewPin] = useState("");

  const submit = async () => {
    try {
      await create({ ...f, sessionToken });
      toast({ title: t("تم إنشاء الكاشير ✓", "Cashier created ✓") });
      setShowForm(false); setF({ name: "", email: "", phone: "", pin: "" });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message?.replace(/^\[.*?\]\s*/, "") }); }
  };
  const changePin = async (id: string) => {
    if (!/^\d{4,6}$/.test(newPin)) return toast({ title: t("PIN لازم 4-6 أرقام", "PIN must be 4-6 digits") });
    try {
      await update({ id: id as any, pin: newPin, sessionToken });
      toast({ title: t("تم تغيير الـPIN ✓", "PIN updated ✓") });
      setEditing(null); setNewPin("");
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-slate-600 text-sm font-bold">{rows?.length || 0} {t("كاشير", "cashier(s)")}</p>
        <Button onClick={() => setShowForm(true)} className="h-10 text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
          <Plus className="h-4 w-4 me-1" /> {t("كاشير جديد", "New cashier")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-2 border-[#0E76AC]/30">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("الاسم", "Name")}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>{t("الإيميل", "Email")}</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>{t("الهاتف", "Phone")}</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><Label>{t("PIN (4-6 أرقام)", "PIN (4-6 digits)")}</Label><Input value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="1234" /></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button onClick={submit} className="text-white" style={{ background: "#0E76AC" }}><Save className="h-4 w-4 me-1" />{t("حفظ", "Save")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-start p-3">{t("الاسم", "Name")}</th>
                <th className="text-start p-3">{t("الإيميل", "Email")}</th>
                <th className="text-center p-3">PIN</th>
                <th className="text-center p-3">{t("نشط", "Active")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{c.name}</td>
                  <td className="p-3 text-slate-600 text-xs">{c.email}</td>
                  <td className="p-3 text-center">
                    {editing?.id === c.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-20 h-8 text-center border border-slate-200 rounded font-bold" placeholder="Nrew PIN" />
                        <button onClick={() => changePin(c.id)} className="text-xs font-bold text-[#0E76AC] hover:underline">{t("حفظ", "Save")}</button>
                        <button onClick={() => { setEditing(null); setNewPin(""); }} className="text-xs font-bold text-slate-400 hover:underline">{t("إلغاء", "Cancel")}</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{c.hasPin ? "✓" : t("مطلوب", "needs PIN")}</span>
                        <button onClick={() => setEditing(c)} className="ms-2 text-xs font-bold text-[#0E76AC] hover:underline">{t("تغيير", "Change")}</button>
                      </>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => update({ id: c.id as any, isActive: !c.isActive, sessionToken })} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {c.isActive ? t("نشط", "Active") : t("موقوف", "Off")}
                    </button>
                  </td>
                  <td className="p-3 text-end" />
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">{t("لسه ما ضفتش كاشير", "No cashiers yet")}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ POS Categories ═══════════════════════════════ */

function CategoriesTab({ t, sessionToken, toast }: any) {
  const rows = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;
  const create = useMutation(api.posAdmin.createCategory);
  const update = useMutation(api.posAdmin.updateCategory);
  const del = useMutation(api.posAdmin.deleteCategory);
  const [f, setF] = useState({ name: "", color: "#0E76AC" });
  const colors = ["#dc2626","#ea580c","#f59e0b","#16a34a","#0891b2","#0E76AC","#7c3aed","#db2777","#475569"];

  const submit = async () => {
    if (!f.name.trim()) return;
    try {
      await create({ name: f.name, color: f.color, sessionToken });
      toast({ title: t("تم ✓", "Added ✓") });
      setF({ name: "", color: "#0E76AC" });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-2 border-dashed border-slate-200">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-slate-500 mb-2">{t("لو ما ضفتش فئات، النظام يستخدم تصنيفات المنيو تلقائياً", "If empty, POS falls back to menu categories")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label>{t("اسم الفئة", "Category name")}</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Beef / Chicken / Burgers / ..." />
            </div>
            <div>
              <Label>{t("اللون", "Color")}</Label>
              <div className="flex gap-1 flex-wrap mt-1">
                {colors.map((c) => (
                  <button key={c} onClick={() => setF({ ...f, color: c })}
                    className={cn("w-8 h-8 rounded-full", f.color === c && "ring-2 ring-offset-2 ring-slate-900")}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={submit} className="w-full text-white" style={{ background: "#0E76AC" }}>
                <Plus className="h-4 w-4 me-1" /> {t("أضف", "Add")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(rows || []).map((c: any) => (
            <div key={c.id} className="rounded-xl overflow-hidden shadow-md" style={{ background: c.color }}>
              <div className="p-4 text-white text-center font-black">{c.name}</div>
              <div className="bg-white p-2 flex gap-1">
                <button onClick={() => update({ id: c.id as any, isActive: !c.isActive, sessionToken })} className="flex-1 text-xs font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
                  {c.isActive ? t("موقوف", "Hide") : t("تفعيل", "Show")}
                </button>
                <button onClick={async () => { if (confirm(t("حذف؟", "Delete?"))) { await del({ id: c.id as any, sessionToken }); toast({ title: t("محذوف", "Deleted") }); } }} className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {rows && rows.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm font-bold">{t("مفيش فئات مضافة", "No categories yet")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ POS Items ═══════════════════════════════ */

function ItemsTab({ t, sessionToken, toast, isRtl }: any) {
  const items = useQuery(api.posAdmin.listItemsForAdmin, { sessionToken }) as any[] | undefined;
  const cats = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;
  const upsert = useMutation(api.posAdmin.upsertItemMeta);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const colors = ["#dc2626","#ea580c","#f59e0b","#16a34a","#0891b2","#0E76AC","#7c3aed","#db2777","#475569"];

  const filtered = useMemo(() => (items || []).filter((m: any) => {
    if (!q.trim()) return true;
    const qq = q.toLowerCase();
    return String(m.nameEn).toLowerCase().includes(qq) || String(m.nameAr).toLowerCase().includes(qq);
  }), [items, q]);

  const set = (id: string, patch: any) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const save = async (m: any) => {
    const d = drafts[m.id] || {};
    try {
      await upsert({
        mealId: m.id as any,
        displayName: d.displayName,
        color: d.color,
        posCategoryId: d.posCategoryId as any,
        isHidden: d.isHidden,
        posPrice: d.posPrice != null && d.posPrice !== "" ? Number(d.posPrice) : undefined,
        sessionToken,
      });
      toast({ title: t("تم ✓", "Saved ✓") });
      setDrafts((cp) => { const n = { ...cp }; delete n[m.id]; return n; });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث…", "Search…")} className="h-10" />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0">
                <tr>
                  <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                  <th className="text-start p-2">{t("سعر POS", "POS Price")}</th>
                  <th className="text-start p-2">{t("لون الزر", "Button color")}</th>
                  <th className="text-start p-2">{t("فئة POS", "POS Category")}</th>
                  <th className="text-center p-2">{t("مخفي", "Hidden")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => {
                  const d = drafts[m.id] || {};
                  const dirty = Object.keys(d).length > 0;
                  const currColor = d.color !== undefined ? d.color : m.color;
                  return (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-bold">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</div>
                        <div className="text-[10px] text-slate-400">{t("سعر المنيو", "Menu")}: {m.menuPrice}</div>
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.01"
                          defaultValue={m.posPrice ?? ""}
                          placeholder={String(m.menuPrice)}
                          onChange={(e) => set(m.id, { posPrice: e.target.value })}
                          className="w-20 h-8 text-center border border-slate-200 rounded font-bold" />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => set(m.id, { color: undefined })}
                            className={cn("w-6 h-6 rounded-full border border-slate-300 bg-white text-xs", !currColor && "ring-2 ring-slate-900")}>×</button>
                          {colors.map((c) => (
                            <button key={c} onClick={() => set(m.id, { color: c })}
                              className={cn("w-6 h-6 rounded-full", currColor === c && "ring-2 ring-offset-1 ring-slate-900")}
                              style={{ background: c }} />
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <select defaultValue={m.posCategoryId || ""} onChange={(e) => set(m.id, { posCategoryId: e.target.value || undefined })}
                          className="h-8 rounded border border-slate-200 bg-white text-xs px-2">
                          <option value="">— {t("افتراضي", "default")} —</option>
                          {(cats || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <input type="checkbox" defaultChecked={m.isHidden} onChange={(e) => set(m.id, { isHidden: e.target.checked })} className="w-4 h-4" />
                      </td>
                      <td className="p-2 text-end">
                        <button onClick={() => save(m)} disabled={!dirty}
                          className={cn("text-xs font-bold px-3 h-8 rounded-lg", dirty ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
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

/* ═══════════════════════════════ Reports ═══════════════════════════════ */

function ReportsTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const top = useQuery(api.posAdmin.topItems, { from, to, sessionToken }) as any[] | undefined;
  const receipts = useQuery(api.posAdmin.listReceipts, { from, to, sessionToken }) as any[] | undefined;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div><Label>{t("من", "From")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" /></div>
          <div><Label>{t("إلى", "To")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("أكثر الأصناف مبيعاً", "Top Items")}</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="text-start p-2">{t("الوجبة", "Item")}</th>
              <th className="text-center p-2">{t("الكمية", "Qty")}</th>
              <th className="text-end p-2">{t("الإيراد", "Revenue")}</th>
            </tr></thead>
            <tbody>
              {(top || []).map((r: any, i: number) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 font-bold">{r.name}</td>
                  <td className="p-2 text-center font-black">{r.qty}</td>
                  <td className="p-2 text-end font-black text-[#0E76AC]">{r.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {top && top.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">{t("مفيش مبيعات", "No sales")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("سجل الفواتير", "Receipts log")}</h3>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0"><tr>
                <th className="text-start p-2">#</th>
                <th className="text-start p-2">{t("الوقت", "Time")}</th>
                <th className="text-start p-2">{t("الكاشير", "Cashier")}</th>
                <th className="text-start p-2">{t("طريقة الدفع", "Method")}</th>
                <th className="text-end p-2">{t("الإجمالي", "Total")}</th>
              </tr></thead>
              <tbody>
                {(receipts || []).map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2 font-black">#{r.ticketNumber}</td>
                    <td className="p-2 text-xs">{r.paidAt ? new Date(r.paidAt).toLocaleString() : "—"}</td>
                    <td className="p-2">{r.cashierName}</td>
                    <td className="p-2 text-xs">{r.paymentMethod || "—"}</td>
                    <td className={cn("p-2 text-end font-black", r.status === "REFUNDED" ? "text-red-500 line-through" : "text-[#0E76AC]")}>{r.total.toFixed(2)}</td>
                  </tr>
                ))}
                {receipts && receipts.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">{t("مفيش فواتير", "No receipts")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Shifts ═══════════════════════════════ */

function ShiftsTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const rows = useQuery(api.posAdmin.listShifts, { from, to, sessionToken }) as any[] | undefined;
  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div><Label>{t("من", "From")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" /></div>
          <div><Label>{t("إلى", "To")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" /></div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="text-start p-3">{t("الكاشير", "Cashier")}</th>
              <th className="text-start p-3">{t("الحالة", "Status")}</th>
              <th className="text-start p-3">{t("فُتحت", "Opened")}</th>
              <th className="text-center p-3">{t("افتتاح", "Opening")}</th>
              <th className="text-center p-3">{t("مبيعات", "Sales")}</th>
              <th className="text-center p-3">{t("فرق الكاش", "Cash diff")}</th>
            </tr></thead>
            <tbody>
              {(rows || []).map((s: any) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{s.cashierName}</td>
                  <td className="p-3"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{s.status}</span></td>
                  <td className="p-3 text-xs">{new Date(s.openedAt).toLocaleString()}</td>
                  <td className="p-3 text-center font-bold">{s.openingCash.toFixed(2)}</td>
                  <td className="p-3 text-center font-black text-[#0E76AC]">{s.totalSales.toFixed(2)}</td>
                  <td className={cn("p-3 text-center font-black", s.cashDiff == null ? "text-slate-300" : s.cashDiff === 0 ? "text-emerald-700" : s.cashDiff > 0 ? "text-amber-700" : "text-red-700")}>
                    {s.cashDiff == null ? "—" : s.cashDiff.toFixed(2)}
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("مفيش ورديات", "No shifts")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
