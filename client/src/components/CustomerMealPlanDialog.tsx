/**
 * @file client/src/components/CustomerMealPlanDialog.tsx
 * @description تنزيل/طباعة جدول وجبات مشترك واحد عبر مدى تواريخ.
 * @convex convex/dailyPlans.ts (listByCustomer)
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useCategories, useMenuItems, useModifiers } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { printMealPlanCards } from "@/lib/printMealPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, CalendarRange } from "lucide-react";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function CustomerMealPlanDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dir } = useLanguage();
  const isRtl = dir === "rtl";
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  // افتراضياً: من بداية الاشتراك حتى نهايته
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const effFrom = from || customer?.startDate || iso(new Date());
  const effTo = to || customer?.endDate || iso(new Date());

  const plans = useQuery(
    api.dailyPlans.listByCustomer,
    customer ? { customerId: customer._id as any, from: effFrom, to: effTo, sessionToken } : "skip",
  ) as any[] | undefined;

  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useCategories();
  const { data: modifiers = [] } = useModifiers();

  const mealCount = useMemo(
    () =>
      (plans || []).reduce(
        (s, p: any) => s + (p.items || []).filter((i: any) => !i.isOff).length,
        0,
      ),
    [plans],
  );

  const [downloading, setDownloading] = useState(false);
  const handlePrint = async () => {
    if (!customer || !plans?.length || downloading) return;
    const menuMap = new Map((menuItems as any[]).map((m: any) => [String(m._id), m]));
    const catMap = new Map((categories as any[]).map((c: any) => [String(c._id), c.name]));
    const modMap = new Map((modifiers as any[]).map((m: any) => [String(m._id), m.name]));

    // اسم اليوم بالعربي من التاريخ — أوضح للعميل من رقم التاريخ وحده.
    const dayAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const dayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayLabel = (isoDate: string) => {
      const d = new Date(isoDate + "T00:00:00");
      const nm = isNaN(d.getTime()) ? "" : (isRtl ? dayAr : dayEn)[d.getDay()];
      return nm ? `${nm} · ${isoDate}` : isoDate;
    };

    const groups = plans.map((plan: any) => {
      const rows = (plan.items || [])
        .filter((it: any) => !it.isOff && (it.menuItemId || it.mealNameAr || it.mealNameEn))
        .map((it: any, i: number) => {
          const menu = it.menuItemId ? menuMap.get(String(it.menuItemId)) : null;
          const mods = (it.modifierIds || []).map((id: any) => modMap.get(String(id))).filter(Boolean);
          return {
            label: String(i + 1),
            category: menu ? catMap.get(String(menu.categoryId)) || "" : (it.category || ""),
            meal: menu?.name || it.mealNameAr || it.mealNameEn || (isRtl ? "غير محدد" : "Unspecified"),
            notes: [...mods, it.avoid, it.preferences, it.portions].filter(Boolean).join(" • "),
            imageUrl: it.imageUrl || menu?.imageUrl || undefined,
            calories: it.calories ?? menu?.calories ?? "",
            protein: it.protein ?? menu?.protein ?? "",
          };
        });
      return {
        title: dayLabel(String(plan.date).slice(0, 10)),
        subtitle: plan.deliveryTime === "MORNING" ? (isRtl ? "صباحي" : "Morning") : (isRtl ? "مسائي" : "Evening"),
        rows,
      };
    });

    setDownloading(true);
    try {
      await printMealPlanCards({
        title: `${isRtl ? "جدول وجبات" : "Meal Plan"} — ${customer.fullName}`,
        subtitle: [
          customer.phone,
          customer.program,
          isRtl ? `من ${effFrom} إلى ${effTo}` : `From ${effFrom} to ${effTo}`,
          customer.avoid ? (isRtl ? `ممنوعات: ${customer.avoid}` : `Avoid: ${customer.avoid}`) : "",
          customer.allergies ? (isRtl ? `حساسية: ${customer.allergies}` : `Allergies: ${customer.allergies}`) : "",
        ]
          .filter(Boolean)
          .join(" · "),
        kpis: [
          { label: isRtl ? "عدد الأيام" : "Days", value: plans.length },
          { label: isRtl ? "إجمالي الوجبات" : "Total Meals", value: mealCount },
        ],
        groups,
      });
    } catch (e: any) {
      alert((isRtl ? "تعذّر التحميل: " : "Download failed: ") + String(e?.message || e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            {isRtl ? "تنزيل جدول الوجبات" : "Download meal plan"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm font-bold">{customer?.fullName}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{isRtl ? "من" : "From"}</Label>
            <Input type="date" value={effFrom} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRtl ? "إلى" : "To"}</Label>
            <Input type="date" value={effTo} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border p-3 text-center">
          {plans === undefined ? (
            <span className="text-sm text-muted-foreground">{isRtl ? "جاري التحميل…" : "Loading…"}</span>
          ) : (
            <div className="flex justify-around">
              <div>
                <div className="text-2xl font-black">{plans.length}</div>
                <div className="text-[11px] text-muted-foreground">{isRtl ? "يوم" : "days"}</div>
              </div>
              <div>
                <div className="text-2xl font-black">{mealCount}</div>
                <div className="text-[11px] text-muted-foreground">{isRtl ? "وجبة" : "meals"}</div>
              </div>
            </div>
          )}
        </div>

        <Button
          className="w-full gap-2"
          disabled={!plans?.length || downloading}
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          {!plans?.length
            ? isRtl ? "لا توجد وجبات في هذه الفترة" : "No meals in this range"
            : downloading
              ? isRtl ? "جاري تجهيز الملف…" : "Preparing file…"
              : isRtl ? "تنزيل PDF" : "Download PDF"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
