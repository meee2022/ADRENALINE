import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, ClipboardCheck, Database, MapPin, PackagePlus, Ruler, Settings2, Tags, Upload, Warehouse } from "lucide-react";

type Row = {
  nameAr: string; nameEn?: string; category: string; unit: string; quantity: number; unitCost?: number;
  purchaseUnit?: string; purchaseToBaseFactor?: number; locationCode?: string; supplierName?: string;
  expiryDate?: string; lotNumber?: string; barcode?: string; sku?: string; minStock?: number; targetStock?: number;
  itemType?: string; note?: string;
};

const COLUMNS = ["nameAr", "nameEn", "category", "unit", "quantity", "unitCost", "purchaseUnit", "purchaseToBaseFactor", "locationCode", "supplierName", "expiryDate", "lotNumber", "barcode", "sku", "minStock", "targetStock", "itemType", "note"] as const;
const SAMPLE = "صدور دجاج\tChicken breast\tproteins\tkg\t18.5\t24\tcarton\t10\tfreezer\tالمورد الرئيسي\t2026-09-30\tLOT-001\t\tCHK-001\t5\t25\tingredient\tوزن فعلي";
const num = (value: string) => value.trim() === "" ? undefined : Number(value);

function parseRows(raw: string): { rows: Row[]; errors: string[] } {
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const errors: string[] = []; const rows: Row[] = [];
  for (let i = 0; i < lines.length; i++) {
    const delimiter = lines[i].includes("\t") ? "\t" : lines[i].includes(";") ? ";" : ",";
    const values = lines[i].split(delimiter).map(s => s.trim());
    if (i === 0 && ["namear", "الاسم", "الصنف"].includes(values[0].toLowerCase())) continue;
    const data: any = {}; COLUMNS.forEach((key, index) => { if (values[index] !== undefined) data[key] = values[index]; });
    const quantity = num(data.quantity || "");
    if (!data.nameAr || quantity == null || !Number.isFinite(quantity) || quantity < 0) { errors.push(`السطر ${i + 1}: الاسم والكمية الصحيحة مطلوبان`); continue; }
    rows.push({
      nameAr: data.nameAr, nameEn: data.nameEn || undefined, category: data.category || "other", unit: data.unit || "piece", quantity,
      unitCost: num(data.unitCost || ""), purchaseUnit: data.purchaseUnit || undefined, purchaseToBaseFactor: num(data.purchaseToBaseFactor || ""),
      locationCode: data.locationCode || undefined, supplierName: data.supplierName || undefined, expiryDate: data.expiryDate || undefined,
      lotNumber: data.lotNumber || undefined, barcode: data.barcode || undefined, sku: data.sku || undefined,
      minStock: num(data.minStock || ""), targetStock: num(data.targetStock || ""), itemType: data.itemType || "ingredient", note: data.note || undefined,
    });
  }
  return { rows, errors };
}

export default function InventorySetup() {
  const { isRtl } = useLanguage(); const tr = (a: string, e: string) => isRtl ? a : e;
  const { toast } = useToast(); const [, setLocation] = useLocation();
  const sessionToken = useStore(s => s.sessionToken) || undefined;
  const setup: any = useQuery(api.inventorySetup.getSetupData, sessionToken ? { sessionToken } : "skip");
  const seed = useMutation(api.inventorySetup.seedDefaults);
  const upsertCategory = useMutation(api.inventorySetup.upsertCategory);
  const upsertLocation = useMutation(api.inventorySetup.upsertLocation);
  const upsertUnit = useMutation(api.inventorySetup.upsertUnit);
  const createOpening = useMutation(api.inventorySetup.createOpeningStocktake);
  const approve = useMutation(api.inventorySetup.approveStocktake);
  const setStatus = useMutation(api.inventorySetup.setStocktakeStatus);
  const [tab, setTab] = useState<"opening" | "settings" | "history">("opening");
  const [raw, setRaw] = useState(""); const parsed = useMemo(() => parseRows(raw), [raw]);
  const [title, setTitle] = useState("الجرد الافتتاحي"); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: any = useQuery(api.inventorySetup.getStocktake, selectedId && sessionToken ? { id: selectedId as any, sessionToken } : "skip");
  const [cat, setCat] = useState({ code: "", nameAr: "", nameEn: "", color: "#3CC4F0" });
  const [loc, setLoc] = useState({ code: "", nameAr: "", nameEn: "", locationType: "STORE" });
  const [unit, setUnit] = useState({ code: "", nameAr: "", nameEn: "", dimension: "count", baseFactor: 1 });

  const initialize = async () => {
    setBusy(true); try { const r = await seed({ sessionToken }); toast({ title: tr("تم تجهيز القوائم الأساسية", "Defaults prepared"), description: `${r.created} ${tr("إضافة جديدة", "new records")}` }); }
    catch (e: any) { toast({ title: tr("تعذر التجهيز", "Setup failed"), description: e?.message, variant: "destructive" }); } finally { setBusy(false); }
  };
  const saveDraft = async () => {
    if (!parsed.rows.length || parsed.errors.length) { toast({ title: tr("راجع بيانات الجرد", "Review stock data"), description: tr("صحح الأخطاء قبل الحفظ", "Fix errors before saving"), variant: "destructive" }); return; }
    setBusy(true); try {
      const id = await createOpening({ title, countedAt: date, rows: parsed.rows, sessionToken }); setSelectedId(String(id)); setTab("history"); setRaw("");
      toast({ title: tr("تم حفظ الجرد كمسودة", "Opening count saved as draft"), description: tr("راجع الفروقات ثم اعتمد الرصيد", "Review variances, then approve") });
    } catch (e: any) { toast({ title: tr("فشل حفظ الجرد", "Could not save count"), description: e?.message, variant: "destructive" }); } finally { setBusy(false); }
  };
  const approveSelected = async () => {
    if (!selectedId) return; setBusy(true); try { const r = await approve({ id: selectedId as any, sessionToken }); toast({ title: tr("تم اعتماد الرصيد", "Stock approved"), description: `${r.lines || 0} ${tr("صنف", "items")}` }); }
    catch (e: any) { toast({ title: tr("تعذر الاعتماد", "Approval failed"), description: e?.message, variant: "destructive" }); } finally { setBusy(false); }
  };

  const tabs = [
    { id: "opening", label: tr("الجرد الافتتاحي", "Opening stock"), icon: ClipboardCheck },
    { id: "settings", label: tr("التصنيفات والمواقع", "Categories & locations"), icon: Settings2 },
    { id: "history", label: tr("جلسات الجرد", "Stocktake sessions"), icon: Database },
  ] as const;

  return <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-[#edf5f8] pb-16">
    <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6">
      <DashboardHeader icon={<Warehouse className="h-7 w-7" />} titleAr="بدء وإعداد المخزون" titleEn="Inventory Setup"
        subtitleAr="حوّل الجرد الواقعي إلى رصيد افتتاحي مُراجع" subtitleEn="Turn your physical count into an approved opening balance"
        kpis={[{ value: setup?.itemCount || 0, labelAr: "صنف مسجل", labelEn: "Items" }, { value: setup?.locations?.length || 0, labelAr: "موقع تخزين", labelEn: "Locations" }, { value: setup?.categories?.length || 0, labelAr: "تصنيف", labelEn: "Categories" }]}
        actions={<Button onClick={() => setLocation("/inventory")} className="gap-2 bg-white text-[#0E2A4A] hover:bg-white/90"><ArrowRight className="h-4 w-4" />{tr("المخزون", "Inventory")}</Button>} />

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#c9dce6] bg-[#ddeaf0] p-1.5">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-xs font-black sm:text-sm", tab === t.id ? "bg-[#0E76AC] text-white shadow-md" : "text-[#496878] hover:bg-white/70")}><t.icon className="h-4 w-4" />{t.label}</button>)}
      </div>

      {tab === "opening" && <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-xl border border-[#cbdde6] bg-white shadow-[0_16px_45px_-28px_rgba(14,42,74,.35)]">
          <div className="border-b border-slate-200 bg-[#f7fbfd] p-4"><h2 className="font-black text-[#17324d]">{tr("الصق كشف الجرد من Excel", "Paste the physical count from Excel")}</h2><p className="mt-1 text-xs text-slate-500">{tr("كل صف يمثل صنفاً. افصل الأعمدة بـ Tab أو فاصلة.", "One item per row. Separate columns with Tab or comma.")}</p></div>
          <div className="p-4">
            <div className="mb-3 grid gap-3 sm:grid-cols-2"><div><Label>{tr("اسم جلسة الجرد", "Count title")}</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div><div><Label>{tr("تاريخ العد", "Count date")}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div></div>
            <textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder={SAMPLE} dir="auto" className="min-h-44 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-800 focus:border-[#3CC4F0] focus:outline-none focus:ring-2 focus:ring-[#3CC4F0]/20" />
            <details className="mt-2 rounded-lg bg-[#edf8fc] px-3 py-2 text-xs text-[#31586c]"><summary className="cursor-pointer font-black">{tr("ترتيب الأعمدة المطلوب", "Required column order")}</summary><p className="mt-2 break-words leading-6">{COLUMNS.join(" | ")}</p></details>
            {parsed.errors.length > 0 && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{parsed.errors.slice(0, 6).map(e => <p key={e}>{e}</p>)}</div>}
            {parsed.rows.length > 0 && <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[760px] w-full text-xs"><thead className="bg-[#eaf4f8] text-[#47759c]"><tr><th className="p-2 text-start">{tr("الصنف", "Item")}</th><th>{tr("التصنيف", "Category")}</th><th>{tr("الكمية", "Qty")}</th><th>{tr("الموقع", "Location")}</th><th>{tr("التكلفة", "Cost")}</th><th>{tr("الصلاحية", "Expiry")}</th></tr></thead><tbody>{parsed.rows.slice(0, 12).map((r, i) => <tr key={i} className="border-t"><td className="p-2 font-bold">{r.nameAr}</td><td className="text-center">{r.category}</td><td className="text-center">{r.quantity} {r.unit}</td><td className="text-center">{r.locationCode || "—"}</td><td className="text-center">{r.unitCost ?? "—"}</td><td className="text-center">{r.expiryDate || "—"}</td></tr>)}</tbody></table></div>}
          </div>
        </section>
        <aside className="space-y-3">
          <div className="rounded-xl bg-[#0E2A4A] p-5 text-white"><Upload className="mb-4 h-7 w-7 text-[#58d5f7]" /><p className="text-3xl font-black">{parsed.rows.length}</p><p className="text-xs text-white/65">{tr("صف صالح للاستيراد", "valid rows")}</p><Button onClick={saveDraft} disabled={busy || !parsed.rows.length || !!parsed.errors.length} className="mt-5 w-full bg-[#3CC4F0] font-black text-[#0E2A4A] hover:bg-[#58d5f7]">{tr("حفظ كمسودة للمراجعة", "Save draft for review")}</Button></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><strong>{tr("لا يتم تغيير الرصيد عند الحفظ.", "Saving does not change stock.")}</strong><br />{tr("الرصيد يتغير فقط بعد فتح الجلسة ومراجعتها والضغط على اعتماد.", "Stock changes only after reviewing the session and approving it.")}</div>
        </aside>
      </div>}

      {tab === "settings" && <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><div><p className="font-black text-[#17324d]">{tr("التجهيز السريع", "Quick setup")}</p><p className="text-xs text-slate-600">{tr("ينشئ التصنيفات والمواقع والوحدات المناسبة للمطعم.", "Creates restaurant-ready categories, locations and units.")}</p></div><Button onClick={initialize} disabled={busy} className="bg-[#0E76AC]"><PackagePlus className="me-2 h-4 w-4" />{tr("تجهيز القوائم الأساسية", "Create defaults")}</Button></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ConfigBox icon={Tags} title={tr("التصنيفات", "Categories")} rows={setup?.categories || []} isRtl={isRtl}>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="code" value={cat.code} onChange={e => setCat({...cat,code:e.target.value})} /><Input placeholder={tr("الاسم العربي", "Arabic name")} value={cat.nameAr} onChange={e => setCat({...cat,nameAr:e.target.value})} /><Input placeholder="English name" value={cat.nameEn} onChange={e => setCat({...cat,nameEn:e.target.value})} /><Input type="color" value={cat.color} onChange={e => setCat({...cat,color:e.target.value})} /></div><Button onClick={async()=>{await upsertCategory({...cat,sessionToken});setCat({code:"",nameAr:"",nameEn:"",color:"#3CC4F0"});}} className="mt-2 w-full bg-[#0E76AC]">{tr("إضافة تصنيف", "Add category")}</Button>
          </ConfigBox>
          <ConfigBox icon={MapPin} title={tr("مواقع التخزين", "Storage locations")} rows={setup?.locations || []} isRtl={isRtl}>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="code" value={loc.code} onChange={e => setLoc({...loc,code:e.target.value})} /><Input placeholder={tr("الاسم العربي", "Arabic name")} value={loc.nameAr} onChange={e => setLoc({...loc,nameAr:e.target.value})} /><Input placeholder="English name" value={loc.nameEn} onChange={e => setLoc({...loc,nameEn:e.target.value})} /><select value={loc.locationType} onChange={e => setLoc({...loc,locationType:e.target.value})} className="rounded-md border border-slate-300 bg-white px-2 text-sm"><option>STORE</option><option>CHILLER</option><option>FREEZER</option><option>KITCHEN</option><option>OUTLET</option></select></div><Button onClick={async()=>{await upsertLocation({...loc,sessionToken});setLoc({code:"",nameAr:"",nameEn:"",locationType:"STORE"});}} className="mt-2 w-full bg-[#0E76AC]">{tr("إضافة موقع", "Add location")}</Button>
          </ConfigBox>
          <ConfigBox icon={Ruler} title={tr("وحدات القياس", "Measurement units")} rows={setup?.units || []} isRtl={isRtl}>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="code" value={unit.code} onChange={e => setUnit({...unit,code:e.target.value})} /><Input placeholder={tr("الاسم العربي", "Arabic name")} value={unit.nameAr} onChange={e => setUnit({...unit,nameAr:e.target.value})} /><Input placeholder="English name" value={unit.nameEn} onChange={e => setUnit({...unit,nameEn:e.target.value})} /><select value={unit.dimension} onChange={e => setUnit({...unit,dimension:e.target.value})} className="rounded-md border border-slate-300 bg-white px-2 text-sm"><option value="count">count</option><option value="mass">mass</option><option value="volume">volume</option></select><Input type="number" min="0.0001" step="any" placeholder={tr("معامل الوحدة الأساسية", "Base factor")} value={unit.baseFactor} onChange={e => setUnit({...unit,baseFactor:Number(e.target.value)})} /></div><Button onClick={async()=>{await upsertUnit({...unit,sessionToken});setUnit({code:"",nameAr:"",nameEn:"",dimension:"count",baseFactor:1});}} className="mt-2 w-full bg-[#0E76AC]">{tr("إضافة وحدة", "Add unit")}</Button>
          </ConfigBox>
        </div>
      </div>}

      {tab === "history" && <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">{(setup?.sessions || []).map((s:any)=><button key={s._id} onClick={()=>setSelectedId(s._id)} className={cn("w-full rounded-xl border p-3 text-start",selectedId===s._id?"border-[#3CC4F0] bg-cyan-50":"border-slate-200 bg-white")}><div className="flex items-center justify-between"><span className="font-black text-[#17324d]">{s.title}</span><Status value={s.status}/></div><p className="mt-1 text-xs text-slate-500">{s.countedAt}</p></button>)}{!setup?.sessions?.length&&<div className="rounded-xl bg-white p-10 text-center text-sm text-slate-400">{tr("لا توجد جلسات بعد", "No sessions yet")}</div>}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">{selected ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#17324d]">{selected.title}</h2><p className="text-xs text-slate-500">{selected.lines.length} {tr("صنف", "items")}</p></div><div className="flex gap-2">{selected.status==="DRAFT"&&<Button variant="outline" onClick={()=>setStatus({id:selected._id,status:"REVIEW",sessionToken})}>{tr("إرسال للمراجعة", "Send to review")}</Button>}{selected.status!=="APPROVED"&&selected.status!=="CANCELLED"&&<Button onClick={approveSelected} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="me-2 h-4 w-4" />{tr("اعتماد الرصيد", "Approve stock")}</Button>}</div></div><div className="mt-4 overflow-x-auto"><table className="min-w-[650px] w-full text-sm"><thead className="bg-[#eaf4f8] text-[#47759c]"><tr><th className="p-2 text-start">{tr("الصنف", "Item")}</th><th>{tr("النظام", "System")}</th><th>{tr("المعدود", "Counted")}</th><th>{tr("الفرق", "Variance")}</th><th>{tr("التكلفة", "Cost")}</th><th>{tr("التشغيلة", "Lot")}</th></tr></thead><tbody>{selected.lines.map((l:any)=><tr key={l._id} className="border-t"><td className="p-2 font-bold">{isRtl?l.item?.nameAr:(l.item?.nameEn||l.item?.nameAr)}</td><td className="text-center">{l.systemQuantity}</td><td className="text-center font-black">{l.countedQuantity}</td><td className={cn("text-center font-black",l.variance===0?"text-slate-400":l.variance>0?"text-cyan-600":"text-red-600")}>{l.variance>0?"+":""}{l.variance}</td><td className="text-center">{l.unitCost??"—"}</td><td className="text-center">{l.lotNumber||"—"}</td></tr>)}</tbody></table></div></>:<div className="grid min-h-64 place-items-center text-sm text-slate-400">{tr("اختر جلسة لعرض تفاصيلها", "Select a session")}</div>}</div>
      </div>}
    </div>
  </div>;
}

function ConfigBox({ icon: Icon, title, rows, children, isRtl }: any) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center gap-2"><Icon className="h-5 w-5 text-[#0E76AC]"/><h2 className="font-black text-[#17324d]">{title}</h2><span className="ms-auto rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{rows.length}</span></div><div className="mb-4 flex max-h-48 flex-wrap gap-2 overflow-auto">{rows.map((r:any)=><span key={r._id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">{isRtl?r.nameAr:r.nameEn} <small className="text-slate-400">{r.code}</small></span>)}</div>{children}</section>;
}
function Status({ value }: {value:string}) { const cls=value==="APPROVED"?"bg-emerald-100 text-emerald-700":value==="REVIEW"?"bg-amber-100 text-amber-700":value==="CANCELLED"?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"; return <span className={cn("rounded-full px-2 py-1 text-[10px] font-black",cls)}>{value}</span>; }
