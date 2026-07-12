/**
 * @file client/src/pages/GymSales.tsx
 * @description مبيعات الجم بالجملة — تسجيل الوجبات المورَّدة يوميًا للجم (زي نقطة بيع)
 *   وحصرها أسبوعيًا/شهريًا: كم وجبة راحت وكم الإيراد.
 * @convex convex/gymSales.ts
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
import { Dumbbell, Trash2, Plus, TrendingUp, Utensils, Wallet } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);
/** بداية الأسبوع (السبت) بصيغة yyyy-MM-dd */
function weekStart(): string {
  const d = new Date();
  const back = (d.getDay() + 1) % 7; // السبت=6 → 0
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
}
function monthStart(): string {
  return todayStr().slice(0, 7) + "-01";
}

type Period = "today" | "week" | "month" | "custom";

export default function GymSales() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(monthStart());
  const [customTo, setCustomTo] = useState(todayStr());

  const { from, to } = useMemo(() => {
    if (period === "today") return { from: todayStr(), to: todayStr() };
    if (period === "week") return { from: weekStart(), to: todayStr() };
    if (period === "month") return { from: monthStart(), to: todayStr() };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const data = useQuery(api.gymSales.list, { from, to, sessionToken }) as any;
  const addM = useMutation(api.gymSales.add);
  const removeM = useMutation(api.gymSales.remove);

  // نموذج الإضافة
  const [date, setDate] = useState(todayStr());
  const [gymName, setGymName] = useState("");
  const [meals, setMeals] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const linePreview = (Number(meals) || 0) * (Number(unitPrice) || 0);

  const submit = async () => {
    const m = Number(meals) || 0;
    if (m <= 0) { alert(t("اكتب عدد وجبات صحيح", "Enter a valid meal count")); return; }
    setBusy(true);
    try {
      await addM({
        date,
        gymName: gymName.trim() || undefined,
        meals: m,
        unitPrice: Number(unitPrice) || 0,
        notes: notes.trim() || undefined,
        sessionToken,
      });
      setMeals(""); setNotes("");
      // نسيب اسم الجم والسعر عشان التوريد اليومي المتكرر
    } catch (e: any) {
      alert(e?.message || t("تعذّر الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm(t("حذف هذا السجل؟", "Delete this record?"))) return;
    try { await removeM({ id: id as any, sessionToken }); } catch (e) { console.error(e); }
  };

  const PERIODS: { key: Period; ar: string; en: string }[] = [
    { key: "today", ar: "اليوم", en: "Today" },
    { key: "week", ar: "هذا الأسبوع", en: "This week" },
    { key: "month", ar: "هذا الشهر", en: "This month" },
    { key: "custom", ar: "مخصّص", en: "Custom" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      <DashboardHeader
        icon={<Dumbbell />}
        titleAr="مبيعات الجم"
        titleEn="Gym Sales"
        subtitleAr="حصر الوجبات المورَّدة للجم أسبوعيًا وشهريًا"
        subtitleEn="Tally meals delivered to the gym weekly & monthly"
      />

      {/* نموذج التوريد */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="col-span-1">
              <Label className="text-xs text-slate-500">{t("التاريخ", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-slate-500">{t("اسم الجم", "Gym")}</Label>
              <Input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder={t("اختياري", "optional")} />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-slate-500">{t("عدد الوجبات", "Meals")}</Label>
              <Input type="number" inputMode="numeric" value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="0" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-slate-500">{t("سعر الوجبة", "Unit price")}</Label>
              <Input type="number" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder={t("ر.ق", "QAR")} />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-slate-500">{t("ملاحظات", "Notes")}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("اختياري", "optional")} />
            </div>
            <div className="col-span-1">
              <Button onClick={submit} disabled={busy} className="w-full h-10 bg-[#3cc4f0] hover:bg-[#2bb0dc] text-[#0f1516] font-bold">
                <Plus className="h-4 w-4 mr-1" />{t("إضافة", "Add")}
              </Button>
            </div>
          </div>
          {linePreview > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {t("الإجمالي", "Total")}: <span className="font-black text-[#47759c]">{linePreview.toLocaleString()} {t("ر.ق", "QAR")}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* اختيار الفترة */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${
              period === p.key ? "bg-[#47759c] text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isRtl ? p.ar : p.en}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-40" />
            <span className="text-slate-400">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-40" />
          </div>
        )}
      </div>

      {/* ملخّص الفترة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-2 border-[#3cc4f0]/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#e8f8fd] grid place-items-center"><Utensils className="h-6 w-6 text-[#3cc4f0]" /></div>
            <div>
              <p className="text-xs text-slate-500">{t("إجمالي الوجبات", "Total meals")}</p>
              <p className="text-2xl font-black text-slate-900">{data?.totalMeals ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 grid place-items-center"><Wallet className="h-6 w-6 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">{t("إجمالي الإيراد", "Total revenue")}</p>
              <p className="text-2xl font-black text-emerald-600">{(data?.totalRevenue ?? 0).toLocaleString()} <span className="text-sm text-slate-400">{t("ر.ق", "QAR")}</span></p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-[#47759c]/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#eaf1f7] grid place-items-center"><TrendingUp className="h-6 w-6 text-[#47759c]" /></div>
            <div>
              <p className="text-xs text-slate-500">{t("متوسط سعر الوجبة", "Avg meal price")}</p>
              <p className="text-2xl font-black text-[#47759c]">{(data?.avgPrice ?? 0).toLocaleString()} <span className="text-sm text-slate-400">{t("ر.ق", "QAR")}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* السجلات */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="text-start p-3 font-semibold">{t("التاريخ", "Date")}</th>
                  <th className="text-start p-3 font-semibold">{t("الجم", "Gym")}</th>
                  <th className="text-center p-3 font-semibold">{t("وجبات", "Meals")}</th>
                  <th className="text-center p-3 font-semibold">{t("السعر", "Price")}</th>
                  <th className="text-center p-3 font-semibold">{t("الإجمالي", "Total")}</th>
                  <th className="text-start p-3 font-semibold">{t("ملاحظات", "Notes")}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-10">{t("لا توجد سجلات في هذه الفترة", "No records in this period")}</td></tr>
                )}
                {(data?.rows || []).map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{r.date}</td>
                    <td className="p-3 text-slate-600">{r.gymName || "—"}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{r.meals}</td>
                    <td className="p-3 text-center text-slate-600">{r.unitPrice.toLocaleString()}</td>
                    <td className="p-3 text-center font-black text-emerald-600">{r.total.toLocaleString()}</td>
                    <td className="p-3 text-slate-500 text-xs">{r.notes || ""}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => del(r.id)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
