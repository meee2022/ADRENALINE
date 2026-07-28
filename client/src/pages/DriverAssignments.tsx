/**
 * @file client/src/pages/DriverAssignments.tsx
 * @description سواقين التوصيل — تبويبان:
 *   (١) لوحة اليوم: لكل سائق وصّل كام وفاضل كام + محطاته بحالتها، وزر يطبّق
 *       السائق الافتراضي لكل عميل على خطط اليوم ويرتّب المسارات.
 *   (٢) ربط العملاء: كل عميل نشط وسائقه الدائم (قائمة لكل عميل + عدّادات).
 * @convex convex/delivery.ts (customerAssignments / setCustomerDriver / driverBoard / applyDefaultDrivers)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { openPrintDoc } from "@/lib/printDoc";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useToast } from "@/hooks/use-toast";
import { Truck, Users, Search, CheckCircle2, Route, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DriverAssignments() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();

  const [tab, setTab] = useState<"BOARD" | "ASSIGN">("BOARD");
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState<"MORNING" | "EVENING" | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState(false);

  const drivers = (useQuery(api.delivery.listDrivers, { sessionToken }) as any[] | undefined) || [];
  const board = useQuery(api.delivery.driverBoard, { date, deliveryTime: shift, sessionToken }) as any;
  const assignments = (useQuery(api.delivery.customerAssignments, { sessionToken }) as any[] | undefined) || [];
  const setDriverM = useMutation(api.delivery.setCustomerDriver);
  const applyM = useMutation(api.delivery.applyDefaultDrivers);
  const setPhoneM = useMutation(api.delivery.setDriverPhone);

  const saveDriverPhone = async (driverId: string, phone: string) => {
    try {
      await setPhoneM({ driverId: driverId as any, phone, sessionToken });
      toast({ title: t("تم حفظ رقم السائق", "Driver phone saved") });
    } catch (e: any) {
      toast({ title: t("تعذّر الحفظ", "Save failed"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  const driverName = (id: string) => drivers.find((d) => String(d._id) === id)?.name || "";

  // عدّادات الربط لكل سائق + غير المربوطين
  /** كلمة بحث محجوزة: تعرض من ضاع ربطه بحذف حساب سائقه. */
  const STALE_FILTER = "@stale";

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    let none = 0;
    let stale = 0;
    for (const c of assignments) {
      if (c.driverId) m[c.driverId] = (m[c.driverId] || 0) + 1;
      else { none++; if ((c as any).staleDriver) stale++; }
    }
    return { m, none, stale };
  }, [assignments]);

  /* ورقة تحميل لكل سائق: رقم البوكس + الاسم + الهاتف + المنطقة. السائق
     يحمّل من رصّة فيها مئة بوكس مرقّم، فبالورقة يلتقط أرقامه بدل قراءة
     كل اسم. الرقم هو نفسه المطبوع على استيكر البوكس (stickerBoxNumbers). */
  const sheetFor = (rows: any[]) =>
    rows.slice().sort((a, b) => (a.boxNo || 9999) - (b.boxNo || 9999)).map((st, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="box">${st.boxNo || "—"}</td>
        <td class="nm">${String(st.customer || "").replace(/[<>&]/g, "")}</td>
        <td class="ph" dir="ltr">${String(st.phone || "")}</td>
        <td class="ar">${String(st.area || "").replace(/[<>&]/g, "")}</td>
        <td class="sig"></td>
      </tr>`).join("");

  const printDriverSheet = (list: Array<{ driver: string; stops: any[] }>) => {
    const shiftLbl = shift === "MORNING" ? t("صباحي", "Morning")
      : shift === "EVENING" ? t("مسائي", "Evening") : t("اليوم كامل", "All day");
    const pages = list.filter((d) => d.stops.length).map((d, idx) => `
      <section class="pg" ${idx ? 'style="page-break-before:always"' : ""}>
        <div class="hd">
          <div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
          <div class="meta">
            <b>${t("كشف تحميل السائق", "Driver loading sheet")}</b>
            <span>${date} · ${shiftLbl}</span>
          </div>
        </div>
        <div class="drv"><span>${t("السائق", "Driver")}</span><b>${String(d.driver || "").replace(/[<>&]/g, "")}</b>
          <span class="cnt">${d.stops.length} ${t("بوكس", "boxes")}</span></div>
        <table>
          <thead><tr>
            <th class="n">#</th><th class="box">${t("رقم البوكس", "Box No.")}</th>
            <th>${t("العميل", "Customer")}</th><th>${t("الهاتف", "Phone")}</th>
            <th>${t("المنطقة", "Area")}</th><th class="sig">${t("تسليم", "Signed")}</th>
          </tr></thead>
          <tbody>${sheetFor(d.stops)}</tbody>
        </table>
        <div class="ft">${t("استلمت البوكسات أعلاه", "Boxes above received")} — ${t("توقيع السائق", "Driver signature")}: ______________________</div>
      </section>`).join("");

    if (!pages) { toast({ title: t("لا محطات للطباعة", "Nothing to print") }); return; }

    openPrintDoc(`<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
      <title>driver-sheet-${date}</title><style>
      *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
      body{margin:0;background:#fff;color:#0E2A4A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pg{padding:10mm 8mm}
      .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #0E76AC;padding-bottom:6px}
      .brand{font-size:19px;font-weight:900;letter-spacing:.12em}
      .brand small{display:block;font-size:7.5px;letter-spacing:.35em;font-weight:700;opacity:.7}
      .meta{text-align:${isRtl ? "left" : "right"}}
      .meta b{display:block;font-size:14px}
      .meta span{font-size:11px;color:#47759c;font-weight:700}
      .drv{margin:9px 0;background:#eaf3fb;border:1px solid #cfe4f3;border-radius:7px;padding:7px 12px;
           display:flex;align-items:center;gap:10px;font-size:13px}
      .drv b{font-size:19px;font-weight:900}
      .drv span{font-size:11px;color:#47759c;font-weight:800}
      .drv .cnt{margin-inline-start:auto;background:#0E76AC;color:#fff;border-radius:99px;padding:3px 12px;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0E76AC;color:#fff;padding:6px 4px;font-size:10.5px;border:1px solid #0b5f8a}
      td{border:1px solid #cfd9e4;padding:6px 5px;vertical-align:middle}
      tr:nth-child(even) td{background:#f7fbfe}
      .n{width:9mm;text-align:center;color:#94a3b8;font-size:10px}
      .box{width:20mm;text-align:center;font-size:17px;font-weight:900;color:#0E76AC}
      .nm{font-weight:800}
      .ph{width:26mm;font-size:11px;color:#475569}
      .ar{width:32mm;font-size:11px;color:#475569}
      .sig{width:24mm}
      .ft{margin-top:10px;font-size:11px;color:#64748b;font-weight:700}
      @page{size:A4 portrait;margin:0}
      @media print{tr{break-inside:avoid}thead{display:table-header-group}}
      </style></head><body>${pages}</body></html>`,
      { fileName: `driver-sheets-${date}`, isRtl, width: 860, height: 980, pageNumbers: false });
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (s === STALE_FILTER) return assignments.filter((c: any) => c.staleDriver);
    if (!s) return assignments;
    return assignments.filter((c) =>
      c.name.toLowerCase().includes(s) || String(c.phone).includes(s) || (c.area || "").toLowerCase().includes(s) ||
      driverName(c.driverId).toLowerCase().includes(s));
  }, [assignments, search, drivers]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const r: any = await applyM({ date, deliveryTime: shift, sessionToken });
      toast({
        title: t("تم تطبيق سواقين العملاء", "Default drivers applied"),
        description: t(`${r.assigned} محطة على ${r.drivers} سائق`, `${r.assigned} stops across ${r.drivers} drivers`),
      });
    } catch (e: any) {
      toast({ title: t("تعذّر التطبيق", "Apply failed"), description: String(e?.message || e), variant: "destructive" });
    } finally { setApplying(false); }
  };

  const setDriver = async (customerId: string, driverId: string) => {
    try {
      await setDriverM({ customerId: customerId as any, driverId: (driverId || undefined) as any, sessionToken });
    } catch (e: any) {
      toast({ title: t("تعذّر الحفظ", "Save failed"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  const STATUS_UI: Record<string, { ar: string; en: string; cls: string }> = {
    DELIVERED: { ar: "وصلت", en: "Delivered", cls: "bg-emerald-100 text-emerald-700" },
    OUT_FOR_DELIVERY: { ar: "في الطريق", en: "On the way", cls: "bg-cyan-100 text-cyan-700" },
    PREPARED: { ar: "جاهزة", en: "Ready", cls: "bg-amber-100 text-amber-700" },
    CONFIRMED: { ar: "مؤكدة", en: "Confirmed", cls: "bg-slate-100 text-slate-600" },
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <DashboardHeader
        icon={<Truck />}
        titleAr="سواقين التوصيل" titleEn="Delivery Drivers"
        subtitleAr="كل سائق ومشتركينه — لوحة اليوم + الربط الدائم"
        subtitleEn="Each driver and their customers — today's board + permanent assignment"
      />

      {/* التبويبات */}
      <div className="flex gap-2 flex-wrap">
        {([["BOARD", t("لوحة اليوم", "Today's board"), Truck], ["ASSIGN", t("ربط العملاء بالسواقين", "Assign customers"), Users]] as any[]).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("px-4 py-2.5 rounded-xl text-sm font-black border flex items-center gap-2 transition-colors",
              tab === k ? "bg-[#0E2A4A] text-white border-[#0E2A4A]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0E2A4A]")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "BOARD" && (
        <>
          {/* أدوات اليوم */}
          <Card><CardContent className="p-3 flex items-center gap-2 flex-wrap">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-40" />
            <div className="flex gap-1">
              {(["ALL", "MORNING", "EVENING"] as const).map((s) => (
                <button key={s} onClick={() => setShift(s)}
                  className={cn("px-3 py-2 rounded-lg text-xs font-black border",
                    shift === s ? "bg-[#0E76AC] text-white border-[#0E76AC]" : "bg-white text-slate-600 border-slate-200")}>
                  {s === "ALL" ? t("الكل", "All") : s === "MORNING" ? t("صباحي ☀", "Morning ☀") : t("مسائي 🌙", "Evening 🌙")}
                </button>
              ))}
            </div>
            <button onClick={handleApply} disabled={applying}
              className="ms-auto h-10 px-4 rounded-xl text-white text-sm font-black disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg,#10b981,#0E766E)" }}>
              <Route className="h-4 w-4" /> {applying ? "…" : t("طبّق سواقين العملاء ورتّب المسارات", "Apply default drivers & route")}
            </button>
          </CardContent></Card>

          {/* كروت السواقين */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(board?.drivers || []).map((d: any) => {
              const pct = d.total ? Math.round((d.delivered / d.total) * 100) : 0;
              return (
                <Card key={d.driverId} className="rounded-2xl border border-slate-100 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 pb-3" style={{ background: "linear-gradient(135deg,#0E2A4A,#0E76AC)" }}>
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <span className="h-9 w-9 rounded-full bg-white/15 grid place-items-center font-black">{(d.driver || "?")[0]}</span>
                          <span className="font-black text-lg">{d.driver}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-black">
                          <button onClick={() => printDriverSheet([d])} title={t("اطبع كشف التحميل", "Print loading sheet")}
                            className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 grid place-items-center transition-colors">
                            <Printer className="h-4 w-4" />
                          </button>
                          <span className="text-emerald-300">✓ {d.delivered}</span>
                          <span className="text-cyan-200">🚚 {d.onTheWay}</span>
                          <span className="text-amber-200">⏳ {d.remaining}</span>
                          <span className="opacity-80">/ {d.total}</span>
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10.5px] text-cyan-100 font-bold mt-1">
                        {t(`وصّل ${d.delivered} · فاضل ${d.remaining}`, `Delivered ${d.delivered} · remaining ${d.remaining}`)} ({pct}%)
                      </p>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                      {d.stops.map((s: any) => {
                        const st = STATUS_UI[s.status] || STATUS_UI.CONFIRMED;
                        return (
                          <div key={s.planId} className="px-3.5 py-2 flex items-center gap-2 text-sm">
                            <span className={cn("text-[10px] font-black rounded-full px-2 py-0.5 shrink-0", st.cls)}>{isRtl ? st.ar : st.en}</span>
                            {s.boxNo ? <span className="text-[11px] font-black text-[#0E76AC] shrink-0 tabular-nums">#{s.boxNo}</span> : null}
                            <span className="font-bold text-slate-800 truncate">{s.customer}</span>
                            {s.area && <span className="text-[11px] text-slate-400 truncate hidden sm:block">· {s.area}</span>}
                            <span className="ms-auto text-[11px] text-slate-400 shrink-0" dir="ltr">{s.phone}</span>
                          </div>
                        );
                      })}
                      {d.stops.length === 0 && <p className="text-center text-slate-400 text-sm py-6">{t("لا محطات", "No stops")}</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {board && board.drivers.length > 0 && (
            <button onClick={() => printDriverSheet(board.drivers)}
              className="w-full h-11 rounded-xl bg-[#0E2A4A] text-white font-black text-sm flex items-center justify-center gap-2">
              <Printer className="h-4 w-4" />
              {t(`اطبع كشوف التحميل — كل السواقين (${board.drivers.length})`,
                 `Print loading sheets — all drivers (${board.drivers.length})`)}
            </button>
          )}

          {(!board || board.drivers.length === 0) && (
            <Card className="border-dashed"><CardContent className="py-10 text-center text-slate-400 font-bold">
              {t("لا توجد محطات مسندة لسواقين في هذا اليوم — اضغط «طبّق سواقين العملاء» بعد اعتماد الخطط.", "No stops assigned to drivers for this day — press “Apply default drivers” after plans are confirmed.")}
            </CardContent></Card>
          )}

          {board && board.unassigned > 0 && (
            <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-4">
              <p className="text-sm font-black text-amber-700 mb-2">⚠ {board.unassigned} {t("محطة بلا سائق", "stops without a driver")}</p>
              <div className="flex flex-wrap gap-1.5">
                {board.unassignedStops.map((s: any) => (
                  <span key={s.planId} className="text-[11px] font-bold bg-white border border-amber-200 rounded-full px-2 py-0.5">{s.customer}</span>
                ))}
              </div>
              <p className="text-[11px] text-amber-600 font-bold mt-2">{t("اربطهم من تبويب «ربط العملاء» ثم اضغط «طبّق».", "Assign them in the “Assign customers” tab, then press “Apply”.")}</p>
            </CardContent></Card>
          )}
        </>
      )}

      {tab === "ASSIGN" && (
        <>
          {/* عدّادات لكل سائق */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {drivers.map((d: any) => (
              <div key={d._id} className="rounded-xl border border-slate-100 bg-white p-3 text-center">
                <p className="text-2xl font-black text-[#0E76AC]">{counts.m[String(d._id)] || 0}</p>
                <p className="text-[11px] font-bold text-slate-500 truncate">{d.name}</p>
                <input
                  defaultValue={d.phone || ""}
                  onBlur={(e) => { if (e.target.value.trim() !== String(d.phone || "")) saveDriverPhone(String(d._id), e.target.value); }}
                  placeholder={t("رقم الهاتف…", "Phone…")}
                  dir="ltr"
                  className="mt-1.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-center"
                />
              </div>
            ))}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-black text-amber-600">{counts.none}</p>
              <p className="text-[11px] font-bold text-amber-600">{t("بلا سائق", "No driver")}</p>
            </div>
          </div>

          {/* من كان سائقه على حساب محذوف يبدو «بلا سائق» ولا شيء ينبّه أن ربطاً
              قديماً ضاع — نُبرزه ونعطي طريقاً مباشراً لتصفيته وإعادة ربطه. */}
          {counts.stale > 0 && (
            <button onClick={() => setSearch(STALE_FILTER)}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-start flex items-center gap-3 hover:bg-rose-100 transition-colors">
              <span className="text-2xl font-black text-rose-600">{counts.stale}</span>
              <span className="flex-1 text-[12px] font-black text-rose-700">
                {t("عميل سائقه القديم اتحذف — اضغط لعرضهم وإعادة ربطهم",
                   "customers whose old driver was deleted — tap to list and reassign")}
              </span>
            </button>
          )}

          {/* البحث */}
          <div className="relative">
            <Search className={cn("absolute top-3 h-4 w-4 text-slate-400", isRtl ? "right-3" : "left-3")} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ابحث بالاسم / الرقم / المنطقة / السائق", "Search name / phone / area / driver")}
              className={cn("h-11", isRtl ? "pr-9" : "pl-9")} />
          </div>

          {/* قائمة الربط */}
          <Card><CardContent className="p-0 divide-y divide-slate-50 max-h-[65vh] overflow-y-auto">
            {filtered.map((c: any) => (
              <div key={c.id} className="px-3.5 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">
                    {c.name}
                    <span className="ms-2 text-[10px] font-black rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">
                      {c.deliveryTime === "EVENING" ? t("مسائي", "Eve") : t("صباحي", "Morn")}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate"><span dir="ltr">{c.phone}</span>{c.area ? ` · ${c.area}` : ""}</p>
                  {c.staleDriver && (
                    <p className="text-[10px] font-black text-rose-600 mt-0.5">
                      ⚠ {t("سائقه القديم اتحذف — أعد ربطه", "Old driver deleted — reassign")}
                    </p>
                  )}
                </div>
                <select value={c.driverId} onChange={(e) => setDriver(c.id, e.target.value)}
                  className={cn("h-9 rounded-lg border px-2 text-xs font-bold bg-white shrink-0 w-36",
                    c.driverId ? "border-emerald-300 text-emerald-700"
                    : c.staleDriver ? "border-rose-400 text-rose-600 bg-rose-50"
                    : "border-amber-300 text-amber-600")}>
                  <option value="">{t("بلا سائق…", "No driver…")}</option>
                  {drivers.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
                {c.driverId && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 py-10">{t("لا نتائج", "No results")}</p>}
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
