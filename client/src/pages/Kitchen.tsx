/**
 * @file client/src/pages/Kitchen.tsx
 * @description نظام عرض المطبخ (KDS) - تصميم احترافي للشيف
 * @convex convex/dailyPlans.ts, convex/customers.ts, convex/menuItems.ts, convex/mealCategories.ts, convex/modifiers.ts
 */
import { useMemo, useState } from "react";
import {
  useDailyPlans,
  useUpdateDailyPlan,
  usePrepareAndConsume,
  useCustomers,
  useMenuItems,
  useCategories,
  useModifiers,
} from "@/lib/api";

import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Calendar as CalendarIcon,
  Printer,
  Truck,
  AlertTriangle,
  ChefHat,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/DashboardHeader";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ModifierGroup = "AVOID" | "PREF" | "PORTION";

export default function Kitchen() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  const [date, setDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING" | "SUMMARY">("MORNING");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // ✅ Dialog state for meal details
  const [openMealDialog, setOpenMealDialog] = useState(false);
  const [selectedMealName, setSelectedMealName] = useState("");
  const [selectedMealDetails, setSelectedMealDetails] = useState<any[]>([]);

  const formattedDate = format(date, "yyyy-MM-dd");

  const { data: dailyPlans = [] } = useDailyPlans();
  const { data: customers = [] } = useCustomers();
  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useCategories();
  const { data: modifiers = [] } = useModifiers();
  const updatePlanMutation = useUpdateDailyPlan();
  const prepareAndConsume = usePrepareAndConsume();

  const plans = useMemo(() => {
    return dailyPlans
      .filter(
        (p: any) =>
          p.date === formattedDate &&
          p.deliveryTime === activeTab &&
          (p.status === "CONFIRMED" || p.status === "PREPARED")
      )
      .sort((a: any, b: any) => {
        if (a.status === "CONFIRMED" && b.status === "PREPARED") return -1;
        if (a.status === "PREPARED" && b.status === "CONFIRMED") return 1;
        return 0;
      });
  }, [dailyPlans, formattedDate, activeTab]);

  const stats = useMemo(() => {
    const today = plans.filter((p: any) => p.status === "CONFIRMED").length;
    const prepared = plans.filter((p: any) => p.status === "PREPARED").length;
    return { today, prepared };
  }, [plans]);

  const getCustomer = (id: string) => customers.find((c: any) => c._id === id);
  const getMenuItem = (id: string) => menuItems.find((m: any) => m._id === id);
  const getCategory = (id: string) => categories.find((c: any) => c._id === id);

  // ✅ حساب إجمالي الوجبات لليوم (كل فترات التوصيل)
  const mealSummary = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );

    const summary: Record<string, {
      count: number;
      plainCount: number;     // ✅ عادي بدون تعديلات
      modifiedCount: number;  // ✅ معدّل (فيه ممنوعات أو تفضيلات)
      dietCount: number;
      fitnessCount: number;
      bulkCount: number;
      customizedCount: number;
      standardCount: number;
      category: string;
      details: Array<{
        customerName: string;
        deliveryTime: string;
        categoryName: string;
        program: string;       // ✅ البرنامج
        allergies?: string;    // ✅ حساسية العميل
        avoid?: string;
        preferences?: string;
        portions?: string;
        specialNotes?: string;
        isPlain: boolean;     // ✅ هل عادية؟
      }>
    }> = {};

    // helper: يحوّل modifierIds المختارة إلى أسماء مجمّعة حسب المجموعة
    const resolveMods = (ids: string[] = []) => {
      const av: string[] = [], pr: string[] = [], po: string[] = [];
      ids.forEach((id) => {
        const mod: any = modifiers.find((m: any) => m._id === id);
        if (!mod) return;
        const nm = isRtl ? (mod.nameAr || mod.name) : mod.name;
        if (mod.group === "AVOID") av.push(nm);
        else if (mod.group === "PREF") pr.push(nm);
        else if (mod.group === "PORTION") po.push(nm);
      });
      return { av, pr, po };
    };

    // helper: يحدد لو الوجبة عادية (مفيش أي تعديلات)
    const isPlainMeal = (item: any, customer: any): boolean => {
      // فحص بيانات الـ item نفسها
      if (String(item.avoid || "").trim()) return false;
      if (String(item.preferences || "").trim()) return false;
      if (String(item.portions || "").trim()) return false;
      if (String(item.specialNotes || "").trim()) return false;
      if ((item.modifierIds || []).length > 0) return false;
      // فحص بيانات العميل (الحساسية والممنوعات تطبق على كل وجباته)
      if (String(customer?.allergies || "").trim()) return false;
      if (String(customer?.avoid || "").trim()) return false;
      if (String(customer?.preferences || "").trim()) return false;
      if (String(customer?.portions || "").trim()) return false;
      return true;
    };

    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New Customer");
      const program = (customer?.program || plan.program || "STANDARD").toUpperCase();

      (plan.items || [])
        .filter((item: any) => !item.isOff)
        .forEach((item: any) => {
          const mealId = item.menuItemId || item.mealId;
          const meal: any = getMenuItem(mealId);
          const rawMealName = String(
            meal
              ? (isRtl ? meal.nameAr || meal.name : meal.name)
              : (item.mealNameAr || item.mealNameEn || (isRtl ? "وجبة غير محددة" : "Unknown Meal")),
          ).trim();

          // ✅ توحيد الاسم الأساسي (زي كشف الإكسيل): "LEMON CHICKEN + RICE /NO TOMATO"
          //    → الطبق: LEMON CHICKEN، و"+ RICE" و"NO TOMATO" تعديلات تحته بعدّاد
          const slashParts = rawMealName.split("/");
          let mealName = slashParts[0];
          const nameMods = slashParts.slice(1).map((s: string) => s.trim()).filter(Boolean);
          let sideNote = "";
          const plusIdx = mealName.indexOf("+");
          if (plusIdx > -1) { sideNote = mealName.slice(plusIdx).replace(/\s+/g, " ").trim(); mealName = mealName.slice(0, plusIdx); }
          mealName = mealName.replace(/\s+/g, " ").trim() || rawMealName;

          // ✅ كمية/عدد في أول الاسم ("150 G LEMON CHICKEN"، "3 EGG WHITES") → الطبق بدون الكمية،
          //    والكمية تظهر كتعديل تحته عشان الشيف يشوفها
          let qtyNote = "";
          const qm = mealName.match(/^\d+\s*(?:G\b)?\s+(.+)$/i);
          if (qm) { qtyNote = mealName; mealName = qm[1].trim(); }
          // "EGGS (NEW EGG SHAKSHOUKA)" → الطبق الحقيقي هو اللي جوّه الأقواس
          const pm = mealName.match(/^(.*?)\(([^)]+)\)$/);
          if (pm && pm[2].trim().length > 3) {
            if (!qtyNote) qtyNote = pm[1].trim();
            mealName = pm[2].trim();
          }
          qtyNote = qtyNote.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
          mealName = mealName.replace(/IRANAIN/gi, "IRANIAN"); // تصحيح إملائي شائع من الشيتات

          const category = getCategory(item.categoryId);
          const categoryName = category?.name || item.category || (isRtl ? "غير محدد" : "Unknown");

          if (!summary[mealName]) {
            summary[mealName] = {
              count: 0,
              plainCount: 0,
              modifiedCount: 0,
              dietCount: 0,
              fitnessCount: 0,
              bulkCount: 0,
              customizedCount: 0,
              standardCount: 0,
              category: categoryName,
              details: []
            };
          }

          const plain = isPlainMeal(item, customer) && nameMods.length === 0 && !sideNote && !qtyNote;
          summary[mealName].count += 1;
          if (plain) summary[mealName].plainCount += 1;
          else summary[mealName].modifiedCount += 1;

          if (program.includes("DIET")) summary[mealName].dietCount += 1;
          else if (program.includes("FITNESS")) summary[mealName].fitnessCount += 1;
          else if (program.includes("BULK")) summary[mealName].bulkCount += 1;
          else if (program.includes("CUSTOMIZED")) summary[mealName].customizedCount += 1;
          else summary[mealName].standardCount += 1;

          // ✅ اجمع كل مصادر التعديل: item + بيانات العميل + المُعدِّلات المختارة (بالاسم)
          const { av, pr, po } = resolveMods(item.modifierIds);
          // ✅ دمج بدون تكرار على مستوى العنصر: "MUSHROOM ,BROCOLI" + "MUSHROOM، BROCOLI" = مرة واحدة
          const joinUniq = (arr: (string | undefined)[]) => {
            const seen = new Set<string>();
            const out: string[] = [];
            arr.flatMap((x) => String(x || "").split(/[,،]/)).forEach((tok) => {
              const t = tok.replace(/\s+/g, " ").trim();
              const k = t.toUpperCase();
              if (t && !seen.has(k)) { seen.add(k); out.push(t); }
            });
            return out.join(isRtl ? "، " : ", ") || undefined;
          };

          summary[mealName].details.push({
            customerName,
            deliveryTime: plan.deliveryTime,
            categoryName,
            program: customer?.program || "Standard",
            allergies: joinUniq([customer?.allergies]),
            avoid: joinUniq([item.avoid, customer?.avoid, ...av, ...nameMods.map((m: string) => m.replace(/^NO\s+/i, ""))]),
            preferences: joinUniq([item.preferences, customer?.preferences, ...pr]),
            portions: joinUniq([item.portions, customer?.portions, ...po, qtyNote || undefined, sideNote || undefined]),
            specialNotes: joinUniq([item.specialNotes]),
            isPlain: plain,
          });
        });
    });

    // ✅ ترتيب الطبخ حسب نوع الوجبة (فطور → غدا → عشا → سلطة → سناك) زي كشف الأخصائية
    const catRank = (c: string): number => {
      const s = String(c || "").toLowerCase();
      if (/break|فطور|فطار/.test(s)) return 1;
      if (/lunch|غدا|غداء/.test(s)) return 2;
      if (/dinner|عشا|عشاء/.test(s)) return 3;
      if (/salad|سلط/.test(s)) return 4;
      if (/snack|سناك|وجبة خفيفة/.test(s)) return 5;
      return 6;
    };

    // ✅ يجمّع التعديلات المتشابهة في سطر واحد بعدّاد ("بدون فطر ×3") بدل سطر لكل عميل
    const buildModGroups = (details: any[]) => {
      const groups: Record<string, any> = {};
      details.filter((d) => !d.isPlain).forEach((d) => {
        const parts = [
          d.avoid && `${isRtl ? "بدون" : "No"}: ${d.avoid}`,
          d.preferences && `${isRtl ? "تفضيل" : "Pref"}: ${d.preferences}`,
          d.portions && `${isRtl ? "كمية" : "Portion"}: ${d.portions}`,
          d.allergies && `${isRtl ? "حساسية" : "Allergy"}: ${d.allergies}`,
          d.specialNotes && `${isRtl ? "ملاحظة" : "Note"}: ${d.specialNotes}`,
        ].filter(Boolean);
        const label = parts.join(isRtl ? " • " : " • ");
        const key = label.toLowerCase();
        if (!groups[key]) groups[key] = { label, count: 0, customers: [] };
        groups[key].count += 1;
        groups[key].customers.push({ name: d.customerName, program: d.program, deliveryTime: d.deliveryTime });
      });
      return Object.values(groups).sort((a: any, b: any) => b.count - a.count);
    };

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data, catRank: catRank(data.category), modGroups: buildModGroups(data.details) }))
      .sort((a, b) => (a.catRank - b.catRank) || (b.count - a.count));
  }, [dailyPlans, formattedDate, customers, menuItems, categories, modifiers, isRtl]);

  // ✅ المشتركون المخصّصون مجمّعون باسم كل عميل (بوكس كامل للشخص) — زي كشف الأخصائية
  const customizedByPerson = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );
    const byPerson: Record<string, { name: string; deliveryTime: string; items: Array<{ meal: string; note: string }> }> = {};
    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const program = (customer?.program || plan.program || "").toUpperCase();
      if (!program.includes("CUSTOM")) return;
      const name = customer?.fullName || plan.customerName || (isRtl ? "عميل" : "Customer");
      (plan.items || []).filter((it: any) => !it.isOff).forEach((item: any) => {
        const meal: any = getMenuItem(item.menuItemId || item.mealId);
        const mealName = meal ? (isRtl ? meal.nameAr || meal.name : meal.name) : (item.mealNameAr || item.mealNameEn || "—");
        const note = [item.avoid, item.preferences, item.portions, item.specialNotes, customer?.avoid, customer?.allergies]
          .map((x) => String(x || "").trim()).filter(Boolean).join(isRtl ? "، " : ", ");
        const key = name + "|" + plan.deliveryTime;
        if (!byPerson[key]) byPerson[key] = { name, deliveryTime: plan.deliveryTime, items: [] };
        byPerson[key].items.push({ meal: mealName, note });
      });
    });
    return Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyPlans, formattedDate, customers, menuItems, isRtl]);

  // ✅ طباعة كشف الشيف — نافذة نظيفة A4 (إجمالي + أطباق مرتّبة + تعديلات مجمّعة + مخصّصين)
  const handlePrintChefSheet = () => {
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const tMeals = mealSummary.reduce((s, m) => s + m.count, 0);
    const tPlain = mealSummary.reduce((s, m) => s + m.plainCount, 0);
    const tMod = mealSummary.reduce((s, m) => s + m.modifiedCount, 0);
    // ✅ كشف زي الإكسيل بالظبط: جدول بحدود لكل طبق — صف العنوان، صف "عادي"، صف لكل تعديل، وصف Total Portions
    const dishHtml = mealSummary.map((m: any) => `
      <table class="dish">
        <tr class="dh"><td class="dn">${esc(m.name)}</td><td class="dc">${m.count}</td></tr>
        <tr class="plain"><td class="lb">عادي — بدون تعديلات</td><td class="ct">${m.plainCount}</td></tr>
        ${m.modGroups.map((g: any) => `
        <tr><td class="lb">${esc(g.label || "تعديل — راجع الطلب")}<div class="cst">${esc(g.customers.map((c: any) => c.name).join("، "))}</div></td><td class="ct">${g.count}</td></tr>`).join("")}
        <tr class="tp"><td class="lb">Total Portions</td><td class="ct">${m.count}</td></tr>
      </table>`).join("");
    const custHtml = customizedByPerson.length ? `
      <h2 class="sec">الوجبات المخصّصة — بوكس لكل عميل (${customizedByPerson.length})</h2>
      <div class="pwrap">${customizedByPerson.map((p: any) => `
        <div class="person"><div class="ph"><b>${esc(p.name)}</b><span>${p.deliveryTime === "MORNING" ? "صباحي ☀" : "مسائي 🌙"}</span></div>
        <ul>${p.items.map((it: any) => `<li>${esc(it.meal)}${it.note ? ` — <b class="nt">${esc(it.note)}</b>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>` : "";
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف المطبخ ${esc(formattedDate)}</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:10px;color:#0f1516;font-size:11px}
        h1{font-size:16px;margin:0 0 1px} .date{color:#47759c;font-weight:700;margin-bottom:8px;font-size:11px}
        .kpis{display:flex;gap:6px;margin-bottom:10px}
        .kpi{flex:1;border:1px solid #cdd9e4;border-radius:8px;padding:5px;text-align:center}
        .kpi .v{font-size:18px;font-weight:900} .kpi .l{font-size:9px;color:#47759c;font-weight:700}
        .wrap{column-count:2;column-gap:10px}
        table.dish{width:100%;border-collapse:collapse;margin-bottom:8px;break-inside:avoid;font-size:10.5px}
        table.dish td{border:1px solid #6d8aa3;padding:2.5px 6px;vertical-align:top}
        tr.dh td{background:#0E76AC;color:#fff;border-color:#0E76AC}
        .dn{font-size:12.5px;font-weight:900}
        .dc{font-size:13px;font-weight:900;text-align:center;width:44px}
        .lb{font-weight:700;line-height:1.35}
        .ct{font-weight:900;text-align:center;width:44px;font-size:11.5px}
        tr.plain td{background:#e8f4fb}
        tr:nth-child(even):not(.dh):not(.tp):not(.plain) td{background:#f6fafd}
        .cst{color:#7d90a2;font-size:8.5px;font-weight:400;line-height:1.3;margin-top:1px}
        tr.tp td{background:#dcebf5;color:#0E76AC;font-weight:900;border-top:1.5px solid #0E76AC}
        .sec{font-size:13px;margin:12px 0 6px;border-top:2px solid #0E76AC;padding-top:6px;break-before:page}
        .pwrap{column-count:3;column-gap:8px}
        .person{border:1px solid #cdd9e4;border-radius:8px;padding:5px 7px;margin-bottom:6px;break-inside:avoid}
        .ph{display:flex;justify-content:space-between;border-bottom:1px solid #e3ebf2;padding-bottom:2px;margin-bottom:2px;font-size:10.5px}
        .person ul{margin:0;padding-inline-start:12px} .person li{font-size:9.5px;margin:1px 0;line-height:1.35}
        .nt{color:#c2410c}
        @page{size:A4;margin:8mm}
      </style></head><body>
      <h1>كشف المطبخ — ADRENALINE</h1><div class="date">تاريخ: ${esc(formattedDate)} · الأرقام تشمل المشتركين المخصّصين</div>
      <div class="kpis">
        <div class="kpi"><div class="v" style="color:#0E76AC">${tMeals}</div><div class="l">إجمالي الوجبات</div></div>
        <div class="kpi"><div class="v" style="color:#3cc4f0">${tPlain}</div><div class="l">عادي</div></div>
        <div class="kpi"><div class="v" style="color:#c2410c">${tMod}</div><div class="l">معدّل</div></div>
        <div class="kpi"><div class="v" style="color:#47759c">${mealSummary.length}</div><div class="l">أنواع الأطباق</div></div>
      </div>
      <div class="wrap">${dishHtml}</div>
      ${custHtml}
      </body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { alert(isRtl ? "اسمح بالنوافذ المنبثقة للطباعة" : "Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const handleMarkPrepared = async (planId: string) => {
    try {
      // يعلّم الخطة كمحضّرة + يخصم مكوّنات الرسيبي من المخزون تلقائياً (idempotent)
      await prepareAndConsume.mutateAsync(planId);
    } catch (error) {
      console.error("Failed to mark as prepared:", error);
      // fallback: على الأقل حدّث الحالة لو فشل خصم المخزون
      try {
        await updatePlanMutation.mutateAsync({ id: planId, data: { status: "PREPARED" } });
      } catch {
        alert("❌ فشل تحديث الحالة. حاول مرة أخرى.");
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return isRtl ? "فطور" : "BREAKFAST";
    if (n.includes("LUNCH") || n.includes("غداء")) return isRtl ? "غداء" : "LUNCH";
    if (n.includes("DINNER") || n.includes("عشاء")) return isRtl ? "عشاء" : "DINNER";
    if (n.includes("SNACK") || n.includes("سناك")) return isRtl ? "سناك" : "SNACKS";
    return categoryName.toUpperCase();
  };

  const getModifiersByGroup = (modifierIds: string[] = []) => {
    const avoid: string[] = [];
    const pref: string[] = [];
    const portion: string[] = [];

    modifierIds.forEach((id) => {
      const mod: any = modifiers.find((m: any) => m._id === id);
      if (!mod) return;
      const name = isRtl ? mod.nameAr || mod.name : mod.name;
      if (mod.group === "AVOID") avoid.push(name);
      else if (mod.group === "PREF") pref.push(name);
      else if (mod.group === "PORTION") portion.push(name);
    });

    return { avoid, pref, portion };
  };

  const openMealDetailsDialog = (mealName: string, details: any[]) => {
    setSelectedMealName(mealName);
    setSelectedMealDetails(details);
    setOpenMealDialog(true);
  };

  return (
    <>
      {/* Screen Version */}
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24 print:hidden">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <DashboardHeader
            icon={<ChefHat className="h-6 w-6 sm:h-7 sm:w-7" />}
            titleAr="عرض المطبخ" titleEn="Kitchen Display"
            subtitleAr={format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
            subtitleEn={format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
            kpis={[
              { value: stats.today, labelAr: "قيد التحضير", labelEn: "To Prepare" },
              { value: stats.prepared, labelAr: "جاهز", labelEn: "Prepared" },
            ]}
            actions={
              <>
                <Button
                  onClick={handlePrint}
                  className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
                >
                  <Printer className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                  {isRtl ? "طباعة" : "Print"}
                </Button>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                      <CalendarIcon className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                      {format(date, "EEEE, d MMMM", { locale: dateLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d);
                          setIsCalendarOpen(false);
                        }
                      }}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </>
            }
          />
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm mt-4">
          <div className="max-w-6xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("MORNING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "MORNING"
                    ? "bg-cyan-500 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل صباحي" : "Morning Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("EVENING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "EVENING"
                    ? "bg-gray-700 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل مسائي" : "Evening Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("SUMMARY")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "SUMMARY"
                    ? "bg-[#47759c] text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "إجمالي الوجبات" : "Meal Summary"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {activeTab === "SUMMARY" ? (
            /* ✅ تاب إجمالي الوجبات - تصميم مبسط للشيف */
            <>
              {mealSummary.length === 0 ? (
                <Card className="rounded-2xl border-dashed" style={{ border: "1.5px dashed #e8eef4" }}>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-lg text-gray-500">
                      {isRtl ? "لا توجد وجبات" : "No meals"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="hidden sm:block sm:w-[110px]" />
                    <h2 className="text-2xl font-bold text-gray-900 text-center flex-1">
                      {isRtl ? "تفاصيل وجبات اليوم المحدد" : "Today's Meal Details"}
                    </h2>
                    <button
                      onClick={handlePrintChefSheet}
                      className="h-11 px-5 rounded-xl font-bold text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all shrink-0"
                      style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
                    >
                      <Printer className="h-4 w-4" />
                      {isRtl ? "طباعة كشف الشيف" : "Print Chef Sheet"}
                    </button>
                  </div>

                  {/* ✅ ملخّص إجمالي اليوم للشيف (كل الوجبات · عادي · معدّل) */}
                  {(() => {
                    const tMeals = mealSummary.reduce((s, m) => s + m.count, 0);
                    const tPlain = mealSummary.reduce((s, m) => s + m.plainCount, 0);
                    const tMod = mealSummary.reduce((s, m) => s + m.modifiedCount, 0);
                    const cards = [
                      { label: isRtl ? "إجمالي الوجبات" : "Total Meals", value: tMeals, bg: "linear-gradient(135deg,#3cc4f0,#0E76AC)", text: "#fff" },
                      { label: isRtl ? "عادي" : "Plain", value: tPlain, bg: "#e8f8fd", text: "#0E76AC" },
                      { label: isRtl ? "معدّل" : "Modified", value: tMod, bg: "#fff7ed", text: "#c2410c" },
                      { label: isRtl ? "أنواع الأطباق" : "Dishes", value: mealSummary.length, bg: "#eaf1f7", text: "#47759c" },
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {cards.map((c, i) => (
                          <div key={i} className="rounded-2xl px-4 py-3 text-center" style={{ background: c.bg, border: "1px solid #e8eef4" }}>
                            <div className="text-3xl font-black tabular-nums" style={{ color: c.text }}>{c.value}</div>
                            <div className="text-[11px] font-bold mt-0.5" style={{ color: c.text, opacity: 0.85 }}>{c.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {mealSummary.map((meal, index) => {
                    const colors = [
                      "bg-[#3cc4f0]",
                      "bg-[#47759c]",
                      "bg-[#0f1516]",
                      "bg-[#5a8aad]",
                      "bg-[#7ba8c4]",
                      "bg-[#2d5c82]",
                      "bg-[#3cc4f0]/70",
                      "bg-[#47759c]/70",
                      "bg-[#0f1516]/70",
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={index}
                        className="bg-white rounded-2xl p-5 hover:-translate-y-0.5 transition-all"
                        style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={cn("w-3 h-3 rounded-full", color)} />
                            <span className="text-xl font-bold text-gray-900">
                              {meal.name}
                            </span>
                          </div>

                          <button
                            onClick={() => openMealDetailsDialog(meal.name, meal.details)}
                            className={cn(
                              "text-3xl font-bold text-white px-8 py-3 rounded-xl shadow-md hover:shadow-xl transition-all active:scale-95",
                              color
                            )}
                          >
                            {meal.count}
                          </button>
                        </div>

                        {/* ✅ Breakdown: عادي vs معدّل */}
                        {meal.count > 0 && (
                          <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{ background: "#e8f8fd", border: "1px solid #3cc4f040" }}>
                                <div>
                                  <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                    {isRtl ? "عادي" : "Plain"}
                                  </p>
                                  <p className="text-[10px] text-[#3cc4f0] mt-0.5">
                                    {isRtl ? "بدون تعديلات" : "No modifications"}
                                  </p>
                                </div>
                                <span className="text-2xl font-black tabular-nums text-[#3cc4f0]">
                                  {meal.plainCount}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                                <div>
                                  <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                    {isRtl ? "معدّل" : "Modified"}
                                  </p>
                                  <p className="text-[10px] text-[#47759c]/70 mt-0.5">
                                    {isRtl ? "ممنوعات/تفضيلات" : "Avoid/Prefs"}
                                  </p>
                                </div>
                                <span className="text-2xl font-black tabular-nums text-[#47759c]">
                                  {meal.modifiedCount}
                                </span>
                              </div>
                            </div>

                            {/* Program Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {meal.dietCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-sky-50/50 border border-sky-100 text-center">
                                  <span className="text-[9px] font-bold text-sky-600 block">DIET</span>
                                  <span className="text-lg font-black text-sky-700">{meal.dietCount}</span>
                                </div>
                              )}
                              {meal.fitnessCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-cyan-50/50 border border-cyan-100 text-center">
                                  <span className="text-[9px] font-bold text-cyan-600 block">FITNESS</span>
                                  <span className="text-lg font-black text-cyan-700">{meal.fitnessCount}</span>
                                </div>
                              )}
                              {meal.bulkCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100 text-center">
                                  <span className="text-[9px] font-bold text-amber-600 block">BULK</span>
                                  <span className="text-lg font-black text-amber-700">{meal.bulkCount}</span>
                                </div>
                              )}
                              {meal.customizedCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-purple-50/50 border border-purple-100 text-center">
                                  <span className="text-[9px] font-bold text-purple-600 block">CUSTOMIZED</span>
                                  <span className="text-lg font-black text-purple-700">{meal.customizedCount}</span>
                                </div>
                              )}
                            </div>

                            {/* ✅ تعديلات مجمّعة بعدّاد (chef-friendly): "بدون فطر ×3" + أسماء العملاء */}
                            {meal.modGroups.length > 0 && (
                              <div className="mt-3 pt-3 border-t-2 border-dashed border-amber-200/60 bg-amber-50/20 rounded-xl p-3">
                                <h4 className="text-xs font-black text-amber-700 flex items-center gap-1.5 mb-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  {isRtl ? `التعديلات المطلوبة (${meal.modGroups.length} نوع · ${meal.modifiedCount} وجبة)` : `Required Modifications (${meal.modGroups.length} types · ${meal.modifiedCount} meals)`}
                                </h4>
                                <div className="flex flex-col gap-1.5">
                                  {meal.modGroups.map((g: any, gi: number) => (
                                    <div key={gi} className="bg-white rounded-lg px-3 py-2 border border-amber-200/50 shadow-sm">
                                      <div className="flex items-start gap-2">
                                        <span className="shrink-0 text-sm font-black text-white bg-amber-500 rounded-md px-2 py-0.5 tabular-nums">
                                          ×{g.count}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[13px] font-bold text-gray-900 leading-snug break-words">
                                            {g.label || (isRtl ? "تعديل مطلوب — راجع الطلب" : "Modification — check order")}
                                          </p>
                                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {g.customers.map((c: any) => `${c.name}${c.deliveryTime === "MORNING" ? " ☀" : " 🌙"}`).join(isRtl ? "، " : ", ")}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ✅ قسم المشتركين المخصّصين — بوكس كامل لكل عميل باسمه (زي كشف الأخصائية) */}
                  {customizedByPerson.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">CUSTOMIZED</span>
                        <h3 className="text-lg font-bold text-gray-900">
                          {isRtl ? `الوجبات المخصّصة (${customizedByPerson.length} عميل)` : `Customized Orders (${customizedByPerson.length})`}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customizedByPerson.map((p, i) => (
                          <div key={i} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 10px 24px -14px rgba(14,42,74,.16)" }}>
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                              <span className="font-black text-gray-900">{p.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: p.deliveryTime === "MORNING" ? "#fffbeb" : "#eff6ff", color: p.deliveryTime === "MORNING" ? "#92400e" : "#1e40af" }}>
                                {p.deliveryTime === "MORNING" ? (isRtl ? "☀ صباحي" : "☀ Morning") : (isRtl ? "🌙 مسائي" : "🌙 Evening")}
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {p.items.map((it, j) => (
                                <li key={j} className="text-sm">
                                  <span className="font-bold text-[#0f1516]">• {it.meal}</span>
                                  {it.note && <span className="text-[12px] text-red-600 font-semibold"> — {it.note}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* ✅ تابات التوصيل (MORNING / EVENING) */
            <>
              {plans.length === 0 ? (
              <Card className="rounded-2xl border-dashed" style={{ border: "1.5px dashed #e8eef4" }}>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-lg text-gray-500">
                    {isRtl ? "لا توجد طلبات" : "No orders"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              plans.map((plan: any) => {
              const customer: any = getCustomer(plan.customerId);
              // ✅ إذا لم يوجد customer مربوط، نعرض الطلب بدون بيانات العميل المفصلة
              
              const hasAllergy = customer?.allergies && customer.allergies.trim().length > 0;
              const isPrepared = plan.status === "PREPARED";
              
              // ✅ استخدام اسم احتياطي إذا لم يوجد customer
              const customerName = customer?.fullName || plan.customerName || "عميل جديد";
              const customerProgram = customer?.program || (isRtl ? "طلب من الموقع" : "Website Order");

              return (
                <Card
                  key={plan._id}
                  className={cn(
                    "overflow-hidden rounded-2xl transition-all",
                    isPrepared ? "bg-[#f4f8fb] opacity-80" : "bg-white hover:-translate-y-0.5"
                  )}
                  style={{
                    border: isPrepared ? "1px solid #cbe8f5" : "1px solid #e8eef4",
                    boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)",
                  }}
                >
                  {/* Allergy Warning Banner */}
                  {hasAllergy && !isPrepared && (
                    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 font-bold">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="uppercase tracking-wide">
                        {isRtl ? "⚠️ تنبيه: حساسية مفرطة (ALLERGY)" : "⚠️ ALLERGY WARNING"}
                      </span>
                    </div>
                  )}

                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">
                          {customerName}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>ID: #{plan._id.slice(-4)}</span>
                          <span>•</span>
                          <span>{customerProgram}</span>
                        </div>
                      </div>

                      {isPrepared ? (
                        <Badge className="bg-[#e8f8fd] text-[#0E76AC] border-0 text-sm px-4 py-1.5 rounded-full font-semibold">
                          {isRtl ? "جاهز للتوصيل" : "Ready to Deliver"}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-0 text-sm px-4 py-1.5 rounded-full font-semibold">
                          {isRtl ? "جاهز للتحضير" : "Ready to Prepare"}
                        </Badge>
                      )}
                    </div>

                    {/* Meals — مرتّبة حسب ترتيب الوجبة (فطور ← غداء ← عشاء ← سناك) لسهولة التحضير */}
                    <div className="space-y-4 mb-4">
                      {(() => {
                        const courseRank = (item: any) => {
                          const c = String(getCategory(item.categoryId)?.name || item.category || "").toUpperCase();
                          if (c.includes("BREAKFAST") || c.includes("فطور")) return 0;
                          if (c.includes("LUNCH") || c.includes("غداء")) return 1;
                          if (c.includes("DINNER") || c.includes("عشاء")) return 2;
                          if (c.includes("SNACK") || c.includes("سناك")) return 3;
                          return 4;
                        };
                        return [...(plan.items || [])].filter((item: any) => !item.isOff).sort((a: any, b: any) => courseRank(a) - courseRank(b));
                      })()
                        .map((item: any, idx: number) => {
                          // ✅ دعم كلا النوعين: menuItemId (خطط يدوية) و mealId (طلبات عملاء)
                          const mealId = item.menuItemId || item.mealId;
                          const meal: any = getMenuItem(mealId);
                          const category = getCategory(item.categoryId);
                          
                          // ✅ إذا لم يوجد meal في menuItems، استخدم البيانات من item نفسه
                          const mealName = meal ? (isRtl ? meal.nameAr || meal.name : meal.name) 
                                                : (item.mealNameAr || item.mealNameEn || "وجبة غير محددة");
                          
                          const { avoid, pref, portion } = getModifiersByGroup(item.modifierIds);

                          // ✅ دمج modifiers من 3 مصادر:
                          // 1) modifierIds (المختارة من الـ picker)
                          // 2) item نفسه (بيانات مضمنة من الطلب الإلكتروني)
                          // 3) customer (الحساسية والممنوعات والتفضيلات والكميات من بيانات الاشتراك)
                          const allAvoid = [...avoid];
                          const allPref = [...pref];
                          const allPortions = [...portion];

                          if (item.avoid) allAvoid.push(item.avoid);
                          if (item.preferences) allPref.push(item.preferences);
                          if (item.portions) allPortions.push(item.portions);

                          // من بيانات العميل (تنطبق على كل وجباته)
                          if (customer?.avoid && String(customer.avoid).trim()) allAvoid.push(String(customer.avoid).trim());
                          if (customer?.preferences && String(customer.preferences).trim()) allPref.push(String(customer.preferences).trim());
                          if (customer?.portions && String(customer.portions).trim()) allPortions.push(String(customer.portions).trim());

                          // ملاحظة خاصة بالوجبة (من Plans.tsx)
                          const itemNote = String(item.specialNotes || "").trim();
                          // الحساسية على مستوى العميل
                          const custAllergy = String(customer?.allergies || "").trim();

                          return (
                            <div
                              key={idx}
                              className="bg-[#f7fbfe] rounded-xl p-4"
                              style={{ border: "1px solid #e8eef4" }}
                            >
                              {/* Meal Category Badge */}
                              <div className="flex items-start justify-between mb-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-bold px-3 py-1 border-0",
                                    // ✅ استخدام category من item أو من lookup
                                    getCategoryLabel(category?.name || item.category || "").includes("BREAKFAST") &&
                                      "bg-[#e8f8fd] text-[#3cc4f0]",
                                    getCategoryLabel(category?.name || item.category || "").includes("LUNCH") &&
                                      "bg-cyan-100 text-cyan-700",
                                    getCategoryLabel(category?.name || item.category || "").includes("DINNER") &&
                                      "bg-[#eaf1f7] text-[#47759c]",
                                    getCategoryLabel(category?.name || item.category || "").includes("SNACK") &&
                                      "bg-[#e8f8fd] text-[#3cc4f0]"
                                  )}
                                >
                                  {getCategoryLabel(category?.name || item.category || "")}
                                </Badge>

                                {item.specialInstructions && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                                    {item.specialInstructions}
                                  </span>
                                )}
                              </div>

                              {/* Meal Name */}
                              <h3 className="text-xl font-bold text-gray-900 mb-3">
                                {mealName}
                              </h3>

                              {/* Allergy banner — per meal (chef sees it inline) */}
                              {custAllergy && (
                                <div className="mb-2 rounded-lg overflow-hidden flex items-stretch"
                                  style={{ background: "#fef2f2", border: "1.5px solid #ef4444" }}>
                                  <div className="px-3 flex items-center justify-center text-white font-black text-base"
                                    style={{ background: "#ef4444", minWidth: "40px" }}>⚠</div>
                                  <div className="flex-1 px-3 py-2 min-w-0">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-wider leading-none">
                                      {isRtl ? "حساسية" : "ALLERGY"}
                                    </p>
                                    <p className="text-sm font-bold text-red-800 mt-0.5 leading-tight">{custAllergy}</p>
                                  </div>
                                </div>
                              )}

                              {/* Modifiers + customer dietary data */}
                              {(allAvoid.length > 0 || allPref.length > 0 || allPortions.length > 0) && (
                                <div className="space-y-1.5">
                                  {/* AVOID - Red boxes */}
                                  {allAvoid.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                                      <span className="text-red-500 font-black text-sm flex-shrink-0">✕</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-wide">{isRtl ? "ممنوع" : "Avoid"}</p>
                                        <p className="text-sm font-bold text-red-800 leading-tight mt-0.5">{allAvoid.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PREF - Cyan */}
                                  {allPref.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                                      <span className="font-black text-sm flex-shrink-0" style={{ color: "#0891b2" }}>★</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>{isRtl ? "تفضيلات" : "Prefs"}</p>
                                        <p className="text-sm font-semibold leading-tight mt-0.5" style={{ color: "#155e75" }}>{allPref.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PORTION - Yellow */}
                                  {allPortions.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                                      <span className="text-[#47759c] font-black text-sm flex-shrink-0">⚖</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "الكمية" : "Portion"}</p>
                                        <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{allPortions.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Special note for this specific meal */}
                              {itemNote && (
                                <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                                  style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                                  <span className="font-black text-sm flex-shrink-0 text-[#47759c]">📝</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "ملاحظة الوجبة" : "Note"}</p>
                                    <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{itemNote}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Special Notes */}
                    {plan.notes && plan.notes.trim().length > 0 && (
                      <div className="bg-[#eaf1f7] rounded-xl p-4 border-2 border-[#47759c]/30 mb-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">💬</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-[#0f1516] mb-1 uppercase">
                              {isRtl ? "ملاحظة الطلب" : "Order Note"}
                            </p>
                            <p className="text-sm text-[#47759c] font-medium italic">
                              {plan.notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Allergies */}
                    {hasAllergy && customer && (
                      <div className="bg-red-50 rounded-xl p-4 border-2 border-red-300 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-red-900 mb-1 uppercase">
                              {isRtl ? "⚠️ حساسية مفرطة" : "⚠️ Allergy Warning"}
                            </p>
                            <p className="text-sm font-bold text-red-900">{customer.allergies}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    {!isPrepared && (
                      <Button
                        onClick={() => handleMarkPrepared(plan._id)}
                        className="w-full h-14 rounded-xl text-white font-bold text-lg shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#0E76AC)"}}
                      >
                        {isRtl ? 'تحديد ك "تم التحضير"' : 'Mark as "Prepared"'}
                      </Button>
                    )}

                    {isPrepared && (
                      <div className="flex items-center justify-center gap-2 text-cyan-700 font-bold">
                        <Truck className="h-5 w-5" />
                        {isRtl ? "بانتظار التوصيل" : "Awaiting Delivery"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
            )}
          </>
          )}
        </div>
      </div>

      {/* Print Version */}
      <div className="hidden print:block bg-white text-slate-900" dir={isRtl ? "rtl" : "ltr"}>
        {(() => {
          // ✅ في الطباعة: استخدم كل خطط اليوم
          const allPlansToday = dailyPlans.filter(
            (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
          );
          const totalMeals = allPlansToday.reduce(
            (sum: number, p: any) => sum + (p.items || []).filter((i: any) => !i.isOff).length,
            0
          );
          return (
            <div className="p-6 space-y-6">
              {/* Print Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-800">
                    {isRtl ? "عرض تحضير المطبخ الكلي" : "Kitchen Display Summary"}
                  </h1>
                  <p className="text-base text-slate-500 mt-1 font-bold">
                    {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-cyan-600">
                    {totalMeals} {isRtl ? "وجبة" : "meals"}
                  </p>
                  <p className="text-sm font-bold text-slate-500 mt-1">
                    {allPlansToday.length} {isRtl ? "عميل مشترك" : "customers"}
                  </p>
                </div>
              </div>

              {/* ✅ Unified Meal-First Print Section */}
              <div className="space-y-6">
                {mealSummary.map((m: any, mIdx: number) => {
                  const modifiedDetails = m.details.filter((d: any) => !d.isPlain);
                  
                  // ✅ ترتيب التعديلات حسب نوع البرنامج: DIET ثم FITNESS ثم BULK ثم CUSTOMIZED لسهولة التحضير
                  const programOrder = ["DIET", "FITNESS", "BULK", "CUSTOMIZED"];
                  const sortedDetails = [...modifiedDetails].sort((a: any, b: any) => {
                    const progA = (a.program || "").toUpperCase();
                    const progB = (b.program || "").toUpperCase();
                    const indexA = programOrder.findIndex(p => progA.includes(p));
                    const indexB = programOrder.findIndex(p => progB.includes(p));
                    const valA = indexA === -1 ? 999 : indexA;
                    const valB = indexB === -1 ? 999 : indexB;
                    return valA - valB;
                  });

                  return (
                    <div key={mIdx} className="border border-slate-300 rounded-xl overflow-hidden page-break-inside-avoid shadow-sm">
                      {/* Meal Header Panel */}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-100/80 border-b border-slate-300">
                        <div>
                          <h3 className="text-lg font-black text-slate-800">{m.name}</h3>
                          {/* Program breakdown badges in header */}
                          <div className="flex gap-2.5 mt-1.5 flex-wrap">
                            {m.dietCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800">DIET ×{m.dietCount}</span>
                            )}
                            {m.fitnessCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-800">FITNESS ×{m.fitnessCount}</span>
                            )}
                            {m.bulkCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">BULK ×{m.bulkCount}</span>
                            )}
                            {m.customizedCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800">CUSTOM ×{m.customizedCount}</span>
                            )}
                          </div>
                        </div>

                        {/* Counts badges */}
                        <div className="flex items-center gap-2">
                          <div className="text-center bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm">
                            <span className="text-xl font-black text-slate-800 leading-none block">{m.count}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{isRtl ? "إجمالي" : "Total"}</span>
                          </div>
                          <div className="text-center bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                            <span className="text-base font-black text-emerald-700 leading-none block">{m.plainCount}</span>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">{isRtl ? "عادي" : "Plain"}</span>
                          </div>
                           <div className="text-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                            <span className="text-base font-black text-amber-700 leading-none block">{m.modifiedCount}</span>
                            <span className="text-[9px] font-bold text-amber-600 uppercase">{isRtl ? "معدّل" : "Mod"}</span>
                          </div>
                        </div>
                      </div>

                      {/* ✅ Chef Portion & Program Breakdown Grid */}
                      <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-center">
                        <div className="px-2 py-1.5 rounded bg-sky-50/70 border border-sky-200">
                          <span className="text-[9px] font-black text-sky-600 block">DIET (تنشيف)</span>
                          <span className="text-sm font-black text-sky-800">{m.dietCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-cyan-50/70 border border-cyan-200">
                          <span className="text-[9px] font-black text-cyan-600 block">FITNESS (لياقة)</span>
                          <span className="text-sm font-black text-cyan-800">{m.fitnessCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200">
                          <span className="text-[9px] font-black text-amber-600 block">BULK (تضخيم)</span>
                          <span className="text-sm font-black text-amber-800">{m.bulkCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-purple-50/70 border border-purple-200">
                          <span className="text-[9px] font-black text-purple-600 block">CUSTOMIZED (مخصص)</span>
                          <span className="text-sm font-black text-purple-800">{m.customizedCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-slate-100 border border-slate-300">
                          <span className="text-[9px] font-black text-slate-600 block">STANDARD (قياسي)</span>
                          <span className="text-sm font-black text-slate-800">{m.standardCount || 0}</span>
                        </div>
                      </div>

                      {/* Details of modified meals */}
                      {modifiedDetails.length > 0 ? (
                        <div className="p-3 bg-white">
                          <p className="text-xs font-black text-amber-700 mb-2 flex items-center gap-1">
                            ⚠️ {isRtl ? "تنبيهات وتعديلات تحضير المشتركين:" : "Special Customer Modifications:"}
                          </p>
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700">
                                <th className="border border-slate-200 px-3 py-2 text-right font-bold w-1/4">{isRtl ? "اسم المشترك" : "Customer"}</th>
                                <th className="border border-slate-200 px-2 py-2 text-center font-bold w-20">{isRtl ? "البرنامج" : "Program"}</th>
                                <th className="border border-slate-200 px-2 py-2 text-center font-bold w-16">{isRtl ? "التوصيل" : "Delivery"}</th>
                                <th className="border border-slate-200 px-3 py-2 text-right font-bold text-amber-800 bg-amber-50/50">{isRtl ? "🚫 الممنوع / التعديل المطلوب" : "🚫 Modifications Required"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedDetails.map((d: any, dIdx: number) => {
                                const progLower = (d.program || "").toLowerCase();
                                let progColor = "bg-white";
                                if (dIdx % 2 === 1) progColor = "bg-slate-50/50";

                                const modifications = [
                                  d.allergies ? `${isRtl ? "⚠ حساسية: " : "⚠ Allergy: "}${d.allergies}` : null,
                                  d.avoid ? `${isRtl ? "ممنوع: " : "Avoid: "}${d.avoid}` : null,
                                  d.preferences ? `${isRtl ? "تفضيل: " : "Pref: "}${d.preferences}` : null,
                                  d.portions ? `${isRtl ? "الكمية: " : "Portion: "}${d.portions}` : null,
                                  d.specialNotes ? `${isRtl ? "ملاحظة: " : "Note: "}${d.specialNotes}` : null,
                                ].filter(Boolean).join(" | ") || (isRtl ? "تعديل مطلوب — راجع الطلب" : "Modification required");

                                return (
                                  <tr key={dIdx} className={progColor}>
                                    <td className="border border-slate-200 px-3 py-2.5 font-bold text-slate-800">{d.customerName}</td>
                                    <td className="border border-slate-200 px-2 py-2.5 text-center font-semibold text-slate-600 uppercase text-[10px]">
                                      {d.program || "—"}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-slate-700 text-[10px]">
                                      {d.deliveryTime === "MORNING" ? (isRtl ? "صباحي ☀" : "Morning ☀") : (isRtl ? "مسائي 🌙" : "Evening 🌙")}
                                    </td>
                                    <td className="border border-slate-200 px-3 py-2.5 font-bold text-amber-800 bg-amber-50/20 text-sm">
                                      {modifications || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-emerald-50/30 border-t border-slate-200">
                          <p className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                            ✓ {isRtl ? `جميع الـ ${m.count} وجبات عادية تماماً — تُحضّر بالوصفة القياسية بدون أي تعديلات.` : `All ${m.count} meals are standard — prepare following standard recipe.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Print Footer */}
              <div className="border-t border-slate-300 mt-8 pt-4 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Adrenaline Healthy Food Kitchen Management System — {format(new Date(), "yyyy/MM/dd HH:mm")}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ✅ Meal Details Dialog — Premium Light Theme */}
      <Dialog open={openMealDialog} onOpenChange={setOpenMealDialog}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] overflow-hidden p-0 bg-white"
          dir={isRtl ? "rtl" : "ltr"}
          style={{
            border: "1px solid rgba(60,196,240,0.15)",
            boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header — Brand gradient */}
          <div className="relative px-6 py-5 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #3CC4F0 0%, #2bb0dc 50%, #47759C 100%)" }}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #ffffff60, transparent 70%)" }} />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">
                  {isRtl ? "تفاصيل الوجبة" : "Meal Details"}
                </p>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">
                  {selectedMealName}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl backdrop-blur-md px-5 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {selectedMealDetails.length}
                  </p>
                  <p className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
                    {isRtl ? "عميل" : "Orders"}
                  </p>
                </div>
              </div>
            </div>

            {/* Plain vs Modified split */}
            {selectedMealDetails.length > 0 && (() => {
              const plainCount = selectedMealDetails.filter((d) => d.isPlain).length;
              const modifiedCount = selectedMealDetails.length - plainCount;
              return (
                <div className="relative grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white/90 uppercase tracking-wide">
                        {isRtl ? "عادي" : "Plain"}
                      </p>
                      <p className="text-[10px] text-white/70 mt-0.5">{isRtl ? "بدون تعديلات" : "No mods"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{plainCount}</span>
                  </div>
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(252,165,15,0.25)", border: "1px solid rgba(252,165,15,0.4)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase tracking-wide">
                        {isRtl ? "معدّل" : "Modified"}
                      </p>
                      <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "احذر التحضير" : "Special prep"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{modifiedCount}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Visually hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedMealName}</DialogTitle>
          </DialogHeader>

          {/* Customer list — sorted: Modified first, then Plain */}
          <div className="overflow-auto px-5 py-5 max-h-[60vh]"
            style={{ background: "#f8fafc" }}>
          {(() => {
            // Sort: المعدّل أولاً (isPlain=false) ثم العادي (isPlain=true)
            const sorted = [...selectedMealDetails].sort((a, b) => {
              const aPlain = a.isPlain ? 1 : 0;
              const bPlain = b.isPlain ? 1 : 0;
              if (aPlain !== bPlain) return aPlain - bPlain; // معدّل قبل عادي
              // ثم ترتيب بالوقت: صباحي قبل مسائي
              const aTime = a.deliveryTime === "MORNING" ? 0 : 1;
              const bTime = b.deliveryTime === "MORNING" ? 0 : 1;
              return aTime - bTime;
            });

            // Group with visual section dividers
            const modifiedMeals = sorted.filter((d) => !d.isPlain);
            const plainMeals = sorted.filter((d) => d.isPlain);

            const renderItem = (detail: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  boxShadow: detail.isPlain
                    ? "0 2px 12px rgba(0,0,0,0.05)"
                    : "0 2px 12px rgba(245,158,11,0.12), 0 0 0 1.5px #fde68a inset",
                  border: detail.isPlain ? "1px solid rgba(0,0,0,0.05)" : "1px solid #fde68a",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Right: Customer + Category */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
                      style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                      {(detail.customerName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-black text-[#0F1516] truncate">
                        {detail.customerName}
                      </p>
                      <p className="text-[11px] text-[#47759C] font-semibold mt-0.5">
                        {detail.categoryName || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Left: Delivery time + Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.isPlain ? (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? "عادي" : "Plain"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? "معدّل" : "Modified"}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{
                        background: detail.deliveryTime === "MORNING" ? "#fffbeb" : "#eff6ff",
                        color: detail.deliveryTime === "MORNING" ? "#92400e" : "#1e40af",
                        border: `1px solid ${detail.deliveryTime === "MORNING" ? "#fde68a" : "#bfdbfe"}`,
                      }}>
                      {detail.deliveryTime === "MORNING" ? "☀ " : "🌙 "}
                      {isRtl ? (detail.deliveryTime === "MORNING" ? "صباحي" : "مسائي") : detail.deliveryTime}
                    </span>
                  </div>
                </div>

                {/* Allergy — prominent full-width bar */}
                {detail.allergies && (
                  <div className="mt-3 rounded-lg overflow-hidden flex items-stretch"
                    style={{ background: "#fef2f2", border: "1.5px solid #ef4444" }}>
                    <div className="px-3 flex items-center justify-center text-white font-black"
                      style={{ background: "#ef4444", minWidth: "38px" }}>⚠</div>
                    <div className="flex-1 px-3 py-2 min-w-0">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-wider leading-none">
                        {isRtl ? "حساسية" : "Allergy"}
                      </p>
                      <p className="text-sm font-bold text-red-800 mt-0.5 leading-tight">{detail.allergies}</p>
                    </div>
                  </div>
                )}

                {/* Fallback when modified but no textual detail */}
                {!detail.isPlain && !detail.allergies && !detail.avoid && !detail.preferences && !detail.portions && !detail.specialNotes && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-amber-800"
                    style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    {isRtl ? "⚠ تعديل مطلوب — راجع تفاصيل الطلب" : "⚠ Modification required — check order"}
                  </div>
                )}

                {/* Modifications */}
                {!detail.isPlain && (detail.avoid || detail.preferences || detail.portions) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {detail.avoid && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-wide">
                          ✕ {isRtl ? "ممنوع" : "Avoid"}
                        </p>
                        <p className="text-xs font-bold text-orange-800 mt-0.5 leading-tight">
                          {detail.avoid}
                        </p>
                      </div>
                    )}
                    {detail.preferences && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>
                          ★ {isRtl ? "تفضيلات" : "Prefs"}
                        </p>
                        <p className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: "#155e75" }}>
                          {detail.preferences}
                        </p>
                      </div>
                    )}
                    {detail.portions && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">
                          ⚖ {isRtl ? "الكمية" : "Portion"}
                        </p>
                        <p className="text-xs font-semibold text-yellow-900 mt-0.5 leading-tight">
                          {detail.portions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Special notes */}
                {detail.specialNotes && (
                  <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                    style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                    <span className="text-blue-500 flex-shrink-0">📝</span>
                    <p className="text-xs font-semibold text-blue-900 leading-tight">
                      {detail.specialNotes}
                    </p>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* قسم المعدّل */}
                {modifiedMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? `معدّل (${modifiedMeals.length})` : `Modified (${modifiedMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                    </div>
                    <div className="space-y-2.5 mb-5">
                      {modifiedMeals.map((d, i) => renderItem(d, i))}
                    </div>
                  </>
                )}

                {/* قسم العادي */}
                {plainMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? `عادي (${plainMeals.length})` : `Plain (${plainMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                    </div>
                    <div className="space-y-2.5">
                      {plainMeals.map((d, i) => renderItem(d, i + modifiedMeals.length))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
