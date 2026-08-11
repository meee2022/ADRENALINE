import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Printer, Share2, Store, Sparkles, UtensilsCrossed } from "lucide-react";
import { printMealPlanCards } from "@/lib/printMealPlan";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { slotToDate } from "@/lib/subscription";
import { localISO } from "@/lib/mealSchedule";
import type { Id } from "@/../../convex/_generated/dataModel";

const dayNameAr: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const categoryNameAr: Record<string, string> = {
  breakfast: "فطور",
  lunch: "غداء",
  dinner: "عشاء",
  snack: "سناك",
  salad: "سلطة",
};

const isSmartPlanOrder = (notes: unknown) =>
  /smart meal generator|smart plan|مول[ّ]?د الوجبات الذكي|الخطة الذكية/i.test(String(notes || ""));

const isSmartPlanSystemNote = (notes: unknown) =>
  /^(weekly plan from the smart meal generator|order from the smart meal generator)$/i.test(String(notes || "").trim());
const dayNameEn: Record<string, string> = {
  saturday: "Saturday", sunday: "Sunday", monday: "Monday", tuesday: "Tuesday",
  wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
};
const categoryNameEn: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", salad: "Salad",
};

export default function OrderReviewDetail() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const locale = isRtl ? ar : enUS;
  const dayName = (d: string) => (isRtl ? dayNameAr[d] : dayNameEn[d]) || d;
  const catName = (c: string) => (isRtl ? categoryNameAr[c] : categoryNameEn[c]) || c;
  const [, params] = useRoute("/orders/review/:orderId");
  const [, navigate] = useLocation();
  const orderId = params?.orderId as Id<"customerOrders"> | undefined;

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined); // ✅ تاريخ بداية التوصيل
  const [downloadingPlan, setDownloadingPlan] = useState(false);
  // ✅ تواريخ يدوية لـ (week, day) — اختيارية، تطغى على التاريخ المحسوب
  const [dateOverrides, setDateOverrides] = useState<Record<string, Date | undefined>>({});

  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const orderData = useQuery(
    api.customerOrders.getById,
    orderId ? { orderId, sessionToken } : "skip"
  );

  // ✅ جلب قائمة المشتركين للربط
  const customers = useQuery(api.customers.list, { sessionToken }) || [];

  // ✅ الأسبوع الذي يصادفه تاريخ البداية المختار في دورة المطبخ.
  //    يساعد الأخصائية: تحدد التاريخ فيعرف النظام هيصادف أي أسبوع دورة.
  const startISO = startDate ? localISO(startDate) : undefined;
  const rotationInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    startISO ? { targetDate: startISO } : "skip"
  ) as { rotationWeek: number; currentCookingWeek: number; fridaysAhead: number } | undefined;

  const approveMutation = useMutation(api.customerOrders.approve);
  const rejectMutation = useMutation(api.customerOrders.reject);
  const swapMealMutation = useMutation(api.customerOrders.updateOrderItemMeal);
  const removeItemMutation = useMutation(api.customerOrders.removeOrderItem);
  const noteItemMutation = useMutation(api.customerOrders.updateOrderItemNote);
  const getShareTokenMut = useMutation(api.customerOrders.getPlanShareToken);
  const [sharing, setSharing] = useState(false);

  // 🔗 مشاركة رابط جدول الوجبات — قائمة مشاركة الجهاز (واتساب…) أو واتساب مباشرة.
  const handleShare = async () => {
    if (sharing || !orderData) return;
    setSharing(true);
    try {
      const { token } = await getShareTokenMut({ orderId: orderData._id, sessionToken });
      const url = `${window.location.origin}/plan/${token}`;
      const name = orderData.customerName || "";
      const msg = t(`جدول وجباتك من Adrenaline 🥗\n${name}\n${url}`, `Your Adrenaline meal plan 🥗\n${name}\n${url}`);
      // قائمة المشاركة الأصلية (الأفضل على الجوال) — تختار واتساب فيتّرفق الرابط
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({ title: t("جدول وجباتك", "Your meal plan"), text: msg, url });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return; // المستخدم ألغى
        }
      }
      // fallback: افتح واتساب مباشرةً بالرقم + الرابط
      const phone = String(orderData.customerPhone || "").replace(/\D/g, "");
      const wa = phone
        ? `https://wa.me/${phone.length === 8 ? "974" + phone : phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.location.href = wa;
    } catch (e: any) {
      void alertDialog({ message: t("تعذّر إنشاء الرابط: ", "Couldn't create link: ") + String(e?.message || e) });
    } finally {
      setSharing(false);
    }
  };
  const deleteOrderMutation = useMutation(api.customerOrders.deleteOrder);

  // ✅ حذف الطلب نهائياً (أدمن فقط) — لتنظيف التجارب، غير الرفض.
  const handleDeleteOrder = async () => {
    if (!orderId) return;
    const ok = await confirmDialog({
      message: t("⚠️ حذف نهائي للخطة كلها (وأصنافها وأي خطط مطبخ منها). لا يمكن التراجع.\nمتأكد؟",
        "⚠️ Permanently delete the whole plan (its items and any kitchen plans). This can't be undone.\nSure?"),
      variant: "danger", confirmText: isRtl ? "حذف" : "Delete",
    });
    if (!ok) return;
    try {
      const r: any = await deleteOrderMutation({ orderId: orderId as any, sessionToken });
      if (r?.success) {
        navigate("/orders/pending");
      } else {
        void alertDialog({ message: r?.error || t("❌ تعذّر الحذف","❌ Delete failed") });
      }
    } catch (e: any) {
      void alertDialog({ message: String(e?.message || e) });
    }
  };

  // ✅ املأ تاريخ البداية تلقائياً بما اختاره العميل (الأخصائية تقدر تعدّله)
  useEffect(() => {
    const pref = (orderData as any)?.preferredStartDate;
    if (pref && !startDate) {
      const d = new Date(pref + "T00:00:00");
      if (!isNaN(d.getTime())) setStartDate(d);
    }
  }, [orderData]);

  // تبديل وجبة اقترحها الـAI قبل الاعتماد
  const queriedMeals = useQuery(api.publicMeals.listMeals, { sessionToken });
  const allMeals: any[] = useMemo(() => queriedMeals || [], [queriedMeals]);

  // 🖼️ خريطة الصورة الحيّة لكل وجبة (mealId → imageUrl).
  //    عناصر الطلب تخزّن imageUrl لقطةً وقت الإنشاء، وكان أغلبها فارغاً لأن الصور
  //    انتقلت إلى storageId لاحقاً. listMeals يحلّ storageId إلى رابط، فنقرأ الصورة
  //    الحيّة منه بدل اللقطة القديمة، وإلا اختفت صور المراجعة (179 وجبة).
  const liveImageByMeal = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of allMeals) {
      if (m?._id && m?.imageUrl) map.set(String(m._id), m.imageUrl);
    }
    return map;
  }, [allMeals]);
  const mealImage = (item: any): string | null => {
    const url = liveImageByMeal.get(String(item?.mealId ?? "")) || item?.imageUrl || "";
    return url && url.trim() ? url : null; // لا نُرجِع "" أبداً (يسبّب src="" وإعادة تحميل)
  };
  const [swapTarget, setSwapTarget] = useState<any>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapScope, setSwapScope] = useState<"day" | "all">("day");
  const [swapSearch, setSwapSearch] = useState("");
  const [swapCategory, setSwapCategory] = useState("all");
  useEffect(() => {
    if (!swapTarget) return;
    setSwapScope("day");
    setSwapSearch("");
    setSwapCategory("all");
  }, [swapTarget]);

  const activeMeals = useMemo(
    // Match the subscriber-facing menu exactly. Staff queries also return
    // outlet/gym and online-POS-only products, which must not leak into review.
    () => allMeals.filter((m: any) => m?.isActive !== false && !m?.isGymOnly && !m?.isOnlineOnly),
    [allMeals],
  );
  const swapCategories = useMemo(
    () => Array.from(new Set(activeMeals.map((m: any) => String(m.category || "")).filter(Boolean))),
    [activeMeals],
  );
  const isScheduledForTarget = useCallback((m: any) => {
    if (!swapTarget) return false;
    const wk = Number(swapTarget.week);
    const dy = String(swapTarget.day || "").toLowerCase();
    if (!wk || !dy) return true;
    if (Array.isArray(m.schedule) && m.schedule.length) {
      return m.schedule.some((s: any) => Number(s.week) === wk && String(s.day).toLowerCase() === dy);
    }
    const weeks = Array.isArray(m.weeks) ? m.weeks.map(Number) : [];
    const days = Array.isArray(m.days) ? m.days.map((x: any) => String(x).toLowerCase()) : [];
    return (weeks.length > 0 || days.length > 0) && weeks.includes(wk) && days.includes(dy);
  }, [swapTarget]);
  const swapCandidates = useMemo(() => {
    if (!swapTarget) return [];
    const needle = swapSearch.trim().toLowerCase();
    return activeMeals
      .filter((m: any) => String(m._id) !== String(swapTarget.mealId))
      .filter((m: any) => swapScope === "all" || isScheduledForTarget(m))
      .filter((m: any) => swapCategory === "all" || String(m.category) === swapCategory)
      .filter((m: any) => !needle || String(m.nameAr || "").toLowerCase().includes(needle) || String(m.nameEn || "").toLowerCase().includes(needle))
      .sort((a: any, b: any) => {
        const aToday = isScheduledForTarget(a) ? 1 : 0;
        const bToday = isScheduledForTarget(b) ? 1 : 0;
        if (aToday !== bToday) return bToday - aToday;
        const aSame = a.category === swapTarget.category ? 1 : 0;
        const bSame = b.category === swapTarget.category ? 1 : 0;
        return bSame - aSame;
      });
  }, [activeMeals, isScheduledForTarget, swapCategory, swapScope, swapSearch, swapTarget]);

  const doSwap = async (m: any) => {
    if (!swapTarget) return;
    setSwapping(true);
    try {
      await swapMealMutation({
        sessionToken,
        itemId: swapTarget._id,
        newMealId: m._id,
      });
      setSwapTarget(null);
    } catch (e: any) {
      console.error("swap failed", e);
      void alertDialog({ message: String(e?.message || e) });
    } finally { setSwapping(false); }
  };

  /* ⚠️ كل الـhooks لازم تسبق الـearly return أدناه. كانت targetDates (useMemo)
     و conflicts (useQuery) تحته، فيتغيّر عدد الـhooks بين لحظة التحميل ولحظة
     وصول الطلب → React #310 وانهيار الصفحة على الأخصائية أثناء المراجعة. */
  const startISOForSlots = startDate ? localISO(startDate) : undefined;
  const startRotForSlots = Number(rotationInfo?.rotationWeek) || 1;
  const dateForSlot = useCallback(
    (week: number, day: string): string | null =>
      startISOForSlots ? slotToDate(startISOForSlots, startRotForSlots, week, day) : null,
    [startISOForSlots, startRotForSlots],
  );

  // ✅ كل (week, day) من الطلب مرتبة كرونولوجياً (الأسبوع الأول السبت ← الأسبوع 4 الخميس)
  //    ⚠️ كان الخميس ناقصاً من الجدول (يأخذ 99 فيُرمى آخر الترتيب دائماً)
  const dayOrder: Record<string, number> = {
    saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5,
  };
  const allWeekDayKeys: string[] = useMemo(() => {
    const its = (orderData?.items || []) as any[];
    return Array.from(new Set(its.map((i: any) => `${i.week}-${i.day}`))).sort((a, b) => {
      const [wa, da] = a.split("-");
      const [wb, db] = b.split("-");
      const weekDiff = Number(wa) - Number(wb);
      if (weekDiff !== 0) return weekDiff;
      return (dayOrder[da] ?? 99) - (dayOrder[db] ?? 99);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData]);

  /**
   * ⚠️ الكتل تُبنى بالأسبوع **التقويمي الفعلي**، لا برقم دورة المطبخ.
   * الدورة تلفّ 1..4، فاشتراك يمتدّ على خمسة أسابيع تقويمية (بداية وسط الأسبوع)
   * يعود لنفس رقم الدورة في آخره — فكانت أيام 22-24 أغسطس تُحشر تحت عنوان
   * «دورة 3» مع أيام 28-30 يوليو، فينكسر الترتيب الزمني أمام الأخصائية.
   * التاريخ من dateForSlot(week, day) وهو دقيق لكل (دورة، يوم) على حدة.
   */
  const weekBlocks = useMemo(() => {
    type Block = { cycle: number; days: string[]; firstDate: string };
    const blocks: Block[] = [];
    const its = (orderData?.items || []) as any[];
    const daysOf: Record<number, string[]> = {};
    its.forEach((i: any) => {
      const w = Number(i.week);
      if (!daysOf[w]) daysOf[w] = [];
      if (!daysOf[w].includes(i.day)) daysOf[w].push(i.day);
    });
    Object.keys(daysOf).map(Number).forEach((cycle) => {
      const dated = daysOf[cycle]
        .map((d) => ({ d, iso: dateForSlot(cycle, d) }))
        .filter((x) => x.iso)
        .sort((a, b) => (a.iso! < b.iso! ? -1 : 1));

      // أيام بلا تاريخ (لا تاريخ بداية بعد) تبقى كتلة واحدة بترتيب الأسبوع الثابت
      const undated = daysOf[cycle].filter((d) => !dateForSlot(cycle, d));
      if (undated.length) {
        blocks.push({
          cycle,
          days: undated.sort((a, b) => (dayOrder[a] ?? 99) - (dayOrder[b] ?? 99)),
          firstDate: "9999",
        });
      }
      // نقطع كتلة جديدة كلما تجاوزت الفجوة بين يومين متتاليين أسبوعاً كاملاً
      let cur: Block | null = null;
      dated.forEach(({ d, iso }) => {
        const gapTooBig = cur
          ? (new Date(iso! + "T00:00:00Z").getTime()
             - new Date(cur.days.length ? dateForSlot(cycle, cur.days[cur.days.length - 1])! + "T00:00:00Z" : iso! + "T00:00:00Z").getTime())
            > 7 * 86400000
          : false;
        if (!cur || gapTooBig) {
          cur = { cycle, days: [d], firstDate: iso! };
          blocks.push(cur);
        } else {
          cur.days.push(d);
        }
      });
    });
    return blocks.sort((a, b) => (a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : a.cycle - b.cycle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData, dateForSlot]);


  // ⚠️ خطط قائمة للعميل في تواريخ هذا الطلب — الاعتماد سيستبدلها (لا يتعايش
  //    خطتان لنفس اليوم وإلا تضاعف الأكل). نعرضها للأخصائية قبل الضغط.
  const targetDates = useMemo(
    () => Array.from(new Set(allWeekDayKeys
      .map((k) => {
        const [w, d] = k.split("-");
        return dateOverrides[k] ? localISO(dateOverrides[k]!) : dateForSlot(Number(w), d);
      })
      .filter(Boolean) as string[])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allWeekDayKeys.join("|"), dateOverrides, dateForSlot],
  );
  const linkedCustomerId = (selectedCustomerId || (orderData as any)?.customerId) as Id<"customers"> | undefined;
  const conflicts = useQuery(
    api.customerOrders.plansToBeReplaced,
    linkedCustomerId && targetDates.length
      ? { customerId: linkedCustomerId, dates: targetDates, sessionToken }
      : "skip",
  ) as { total: number; manual: number; rows: any[] } | undefined;

  if (!orderData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const order = orderData;
  const items = orderData.items || [];

  // 🔗 المشترك المرتبط بالطلب (بالرقم) — لعرض اشتراكه أثناء المراجعة: كم وجبة
  //    وسناك في اليوم، ومن متى إلى متى. فتراجع الأخصائية أن المحدَّد يطابق اشتراكه.
  const digits = (s: any) => String(s || "").replace(/\D/g, "");
  const orderPhone8 = digits(order.customerPhone).slice(-8);
  const linkedSub: any = (customers as any[]).find(
    (c) => digits(c.phone || c.mobile || c.whatsapp).slice(-8) === orderPhone8,
  );
  const subMeals = linkedSub?.mealsPerDay ?? null;
  const subSnacks = linkedSub?.snacksPerDay ?? null;
  const subPerDay = (subMeals ?? 0) + (subSnacks ?? 0);

  // Group items by week and day
  const groupedByWeek: Record<number, Record<string, typeof items>> = {};
  items.forEach((item) => {
    if (!groupedByWeek[item.week]) {
      groupedByWeek[item.week] = {};
    }
    if (!groupedByWeek[item.week][item.day]) {
      groupedByWeek[item.week][item.day] = [];
    }
    groupedByWeek[item.week][item.day].push(item);
  });

  // 🔗 تاريخ كل صنف من **المصدر الوحيد** (lib/subscription.slotToDate) — نفس ما
  //    يراه العميل في المنيو وما ينفّذه الاعتماد. يبدأ من أول يوم توصيل فعلي
  //    (بكرة لو اليوم انقضى)، يتخطّى الجمعة، والاسم يطابق التاريخ.
  /** ترتيب أيام أسبوع واحد **بتاريخ التوصيل الفعلي** (fallback: ترتيب الأسبوع الثابت).
   *  Object.keys بلا ترتيب كان يعرضها بترتيب اختيار العميل — فطلب اختار 29 ثم 25
   *  يعرض الأربعاء قبل السبت واللخبطة اللي اشتكى منها المستخدم. */
  const sortDaysChrono = (weekNum: number, dayKeys: string[]): string[] =>
    [...dayKeys].sort((a, b) => {
      const da = dateForSlot(weekNum, a), db = dateForSlot(weekNum, b);
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (dayOrder[a] ?? 99) - (dayOrder[b] ?? 99);
    });
  const handleApprove = async () => {
    if (!orderId) return;

    // ✅ تحويل تواريخ الـ overrides لصيغة { "week-day": "YYYY-MM-DD" }
    const overridesPayload: Record<string, string> = {};
    Object.entries(dateOverrides).forEach(([key, d]) => {
      if (d) overridesPayload[key] = localISO(d);
    });

    // ✅ المنطق الجديد:
    //   - الأول يوم في الطلب (week 1, أول يوم) هو "نقطة البداية" (anchor)
    //   - لو الأخصائية حددت تاريخ للأول يوم → ده الـ startDate تلقائياً
    //   - لو startDate الـ explicit موجود → يستخدمه
    //   - لو ولا واحد → تنبيه
    const firstKey = allWeekDayKeys[0];
    const firstDayOverride = overridesPayload[firstKey];

    let effectiveStartDate: string | undefined;
    if (startDate) {
      effectiveStartDate = localISO(startDate);
    } else if (firstDayOverride) {
      effectiveStartDate = firstDayOverride;
    } else if (/smart meal generator/i.test(String((orderData as any)?.notes || ""))) {
      // Backward-compatible repair for smart-plan orders created before their
      // generated calendar anchor was stored. Rebuild the same anchor used by
      // SmartPlan: max(subscription start, day after order creation).
      const createdAt = Number((orderData as any)?.createdAt);
      if (Number.isFinite(createdAt) && createdAt > 0) {
        const nextDay = new Date(createdAt);
        nextDay.setHours(0, 0, 0, 0);
        nextDay.setDate(nextDay.getDate() + 1);
        const generatedStart = localISO(nextDay);
        const phoneDigits = String((orderData as any)?.customerPhone || "").replace(/\D/g, "").slice(-8);
        const matchingCustomer = (customers as any[]).find((c: any) =>
          String(c?.phone || c?.mobile || c?.whatsapp || "").replace(/\D/g, "").slice(-8) === phoneDigits
        );
        const subscriptionStart = String(matchingCustomer?.startDate || "").slice(0, 10);
        effectiveStartDate = /^\d{4}-\d{2}-\d{2}$/.test(subscriptionStart) && subscriptionStart > generatedStart
          ? subscriptionStart
          : generatedStart;
      }
    }

    if (!effectiveStartDate) {
      void alertDialog({
        message: (isRtl ? `⚠️ يرجى تحديد تاريخ ليوم البداية على الأقل (${firstKey}) أو تحديد تاريخ بداية التوصيل في الأعلى.` : `⚠️ Set a date for at least the first day (${firstKey}) or set the delivery start date above.`),
      });
      return;
    }

    // ⚠️ تأكيد صريح لو فيه خطط قائمة ستُستبدل (خصوصاً اليدوية من الأخصائية)
    if (conflicts && conflicts.total > 0) {
      const lines = conflicts.rows.slice(0, 8)
        .map((r) => `• ${r.date} — ${r.source === "manual" ? (isRtl ? "يدوية" : "manual") : (isRtl ? "من طلب" : "from order")} (${r.items} ${isRtl ? "صنف" : "items"})`)
        .join("\n");
      const more = conflicts.rows.length > 8 ? `\n… +${conflicts.rows.length - 8}` : "";
      const ok = await confirmDialog({
        title: isRtl ? "استبدال خطط قائمة" : "Replace existing plans",
        message: isRtl
          ? `هذا المشترك لديه ${conflicts.total} خطة في تواريخ هذا الطلب${conflicts.manual ? ` (منها ${conflicts.manual} يدوية من الأخصائية)` : ""}.\n\nسيتم **استبدالها** باختيار العميل — حتى لا يتضاعف الأكل.\n\n${lines}${more}\n\nمتابعة؟`
          : `This subscriber has ${conflicts.total} plan(s) on this order's dates${conflicts.manual ? ` (${conflicts.manual} manual)` : ""}.\n\nThey will be REPLACED by the customer's selection to avoid double food.\n\n${lines}${more}\n\nContinue?`,
        confirmText: isRtl ? "نعم، استبدل واعتمد" : "Yes, replace & approve",
        cancelText: isRtl ? "إلغاء" : "Cancel",
      });
      if (!ok) return;
    }

    try {
      await approveMutation({
        sessionToken,
        orderId,
        customerId: selectedCustomerId || undefined,
        startDate: effectiveStartDate,
        notes: approveNotes || undefined,
        dateOverrides: Object.keys(overridesPayload).length > 0 ? overridesPayload : undefined,
      });
      // ✅ إرسال رسالة واتساب تلقائية للعميل بعد الاعتماد
      try {
        const { openWhatsApp, WhatsAppTemplates } = await import("@/lib/whatsapp");
        if (order?.customerPhone) {
          const msg = WhatsAppTemplates.orderApproved(
            order.customerName || "عميلنا الكريم",
            order.orderNumber || "",
            effectiveStartDate,
          );
          if (await confirmDialog({ message: t("✅ تم الاعتماد! هل تريد إرسال رسالة واتساب للعميل بالتأكيد؟", "✅ Approved! Do you want to send a WhatsApp confirmation to the customer?") })) {
            openWhatsApp(order.customerPhone, msg);
          }
        }
      } catch {
        // ignore
      }
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      void alertDialog({ message: t("❌ حدث خطأ أثناء الاعتماد", "❌ An error occurred while approving") });
    }
  };

  const handleReject = async () => {
    if (!orderId || !rejectReason.trim()) {
      void alertDialog({ message: t("⚠️ يرجى كتابة سبب الرفض","⚠️ Please write a rejection reason") });
      return;
    }
    try {
      await rejectMutation({
        sessionToken,
        orderId,
        reason: rejectReason,
      });
      // ✅ إرسال رسالة اعتذار للعميل
      try {
        const { openWhatsApp, WhatsAppTemplates } = await import("@/lib/whatsapp");
        if (order?.customerPhone) {
          const msg = WhatsAppTemplates.orderRejected(
            order.customerName || "عميلنا الكريم",
            rejectReason,
          );
          if (await confirmDialog({ message: t("هل تريد إرسال رسالة الاعتذار للعميل عبر واتساب؟","Send the apology message to the customer via WhatsApp?") })) {
            openWhatsApp(order.customerPhone, msg);
          }
        }
      } catch {
        // ignore
      }
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      void alertDialog({ message: t("❌ حدث خطأ أثناء الرفض", "❌ An error occurred while rejecting") });
    }
  };

  const createdDate = (() => {
    const d = order.createdAt ? new Date(order.createdAt) : null;
    return d && !isNaN(d.getTime())
      ? format(d, "dd MMMM yyyy - hh:mm a", { locale })
      : t("غير محدد", "Not set");
  })();

  /** التقرير المرسل للعميل — التصميم الفخم بالصور (نفس شكل المنيو/الخطة الذكية). */
  const handlePrintPlan = async () => {
    if (downloadingPlan) return;
    const linked = customers.find((c: any) => String(c._id) === String(selectedCustomerId));
    const note = [
      linked?.allergies ? `${t("الحساسية", "Allergies")}: ${linked.allergies}` : "",
      linked?.avoid ? `${t("ممنوعات", "Avoid")}: ${linked.avoid}` : "",
      linked?.preferences ? `${t("تفضيلات", "Preferences")}: ${linked.preferences}` : "",
      linked?.portions ? `${t("كميات", "Portions")}: ${linked.portions}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");

    const groups = weekBlocks.map(({ cycle: w, days }) => {
      return {
        title: `${t("الأسبوع (دورة", "Week (cycle")} ${w})`,
        sections: days.map((d) => ({
          title: dayName(d),
          rows: groupedByWeek[w][d].map((it: any, i: number) => ({
            label: String(i + 1),
            category: catName(it.category),
            meal: (isRtl ? (it.mealNameAr || it.mealNameEn) : (it.mealNameEn || it.mealNameAr)) || "-",
            notes: [it.avoid, it.preferences, it.portions, it.specialNotes]
              .map((x) => String(x || "").trim()).filter(Boolean).join(" • "),
            calories: it.calories ?? "",
            protein: it.protein ?? "",
            imageUrl: it.imageUrl || undefined,
          })),
        })),
      };
    });

    // الإجمالي من الكتل نفسها — الكتلة الواحدة قد تحمل جزءاً من دورة متكرّرة
    const totalMeals = groups.reduce(
      (sum, g) => sum + g.sections.reduce((a, sec) => a + sec.rows.length, 0),
      0,
    );

    setDownloadingPlan(true);
    try {
      await printMealPlanCards({
        title: `${t("جدول وجبات", "Meal plan")} — ${order.customerName || "—"}`,
        subtitle: [order.customerPhone, note].filter(Boolean).join("  ·  ") || undefined,
        kpis: [
          { label: t("عدد الأسابيع", "Weeks"), value: weekBlocks.length },
          { label: t("إجمالي الوجبات", "Total meals"), value: totalMeals },
        ],
        groups,
      });
    } catch (e: any) {
      void alertDialog({ message: t("تعذّر التحميل: ","Download failed: ") + String(e?.message || e) });
    } finally {
      setDownloadingPlan(false);
    }
  };

  return (
    // overflow-x-clip: يمنع تمدّد أي عنصر داخلي عرضياً فلا تهتزّ الصفحة يميناً/يساراً على الجوال
    <div className="space-y-6 p-3 sm:p-6 max-w-7xl mx-auto overflow-x-clip">
      {/* Back + Print */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button variant="outline" onClick={() => navigate("/orders/pending")}>
          {t("← العودة للقائمة","← Back to list")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleShare}
            disabled={sharing}
            className="font-bold text-white"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
          >
            <Share2 className="h-4 w-4 ml-2" />
            {sharing ? t("جارٍ التجهيز…","Preparing…") : t("مشاركة الجدول","Share plan")}
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintPlan}
            disabled={downloadingPlan}
            className="font-bold border-[#3cc4f0] text-[#0E76AC]"
          >
            <Printer className="h-4 w-4 ml-2" />
            {downloadingPlan ? t("جاري تجهيز الملف…","Preparing file…") : t("تنزيل PDF","Download PDF")}
          </Button>
        </div>
      </div>

      <div className={cn(
        "flex min-h-20 items-center justify-between gap-4 rounded-2xl px-5 py-4 text-white shadow-sm",
        (order as any).restaurantKey === "NUTRI_RESET" ? "bg-[#079AA5]" : "bg-[#0E76AC]",
      )}>
        <div className="flex items-center gap-4">
          <span className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            (order as any).restaurantKey === "NUTRI_RESET" ? "bg-[#F47721]" : "bg-[#3AC7F4]",
          )}>
            <Store className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold text-white/80">{t("هذا الطلب تابع لمطعم", "This order belongs to")}</p>
            <p className="mt-1 text-xl font-black tracking-wide sm:text-2xl">
              {(order as any).restaurantKey === "NUTRI_RESET" ? "NUTRI RESET" : "ADRENALINE"}
            </p>
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black sm:text-sm",
          isSmartPlanOrder(order.notes) ? "border-violet-200 bg-violet-50 text-violet-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
        )}>
          {isSmartPlanOrder(order.notes) ? <Sparkles className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
          {isSmartPlanOrder(order.notes)
            ? t("خطة ذكية مولّدة تلقائيًا", "AI-generated smart plan")
            : t("خطة باختيار يدوي من المشترك", "Customer-selected manual plan")}
        </span>
      </div>

      {/* Subscriber Header Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-primary/20">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-bold text-2xl">
              {order.customerName?.[0]?.toUpperCase() || "؟"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {order.customerName}
              </h2>
              <p className="text-gray-600">{order.customerPhone}</p>
              {order.customerEmail && (
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
              )}
            </div>
          </div>

          <div className="bg-orange-100 text-orange-700 px-6 py-3 rounded-lg font-semibold">
            ⏳ {t("قيد المراجعة", "Under review")}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("رقم الطلب","Order No.")}</p>
            <p className="font-bold text-gray-900">{order.orderNumber}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("إجمالي الوجبات","Total meals")}</p>
            <p className="font-bold text-gray-900">{order.totalMeals} {t("وجبة","meals")}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("السعرات الكلية","Total calories")}</p>
            <p className="font-bold text-gray-900">
              {order.totalCalories.toLocaleString()} {t("سعرة","kcal")}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("تاريخ الإرسال","Submitted")}</p>
            <p className="font-bold text-gray-900 text-sm">{createdDate}</p>
          </div>
        </div>

        {/* 📋 اشتراك المشترك — للمراجعة: كم وجبة/سناك في اليوم، ومن متى إلى متى.
            نعرضه فقط لو وُجد المشترك المرتبط (بالرقم). */}
        {linkedSub && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border-2 border-primary/30">
              <p className="text-xs text-gray-500 mb-1">{t("وجبات الاشتراك / يوم","Subscription meals/day")}</p>
              <p className="font-bold text-primary text-lg">
                {subMeals ?? "؟"}{t(" وجبة"," meals")} + {subSnacks ?? "؟"}{t(" سناك"," snacks")} = {subPerDay}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-primary/30">
              <p className="text-xs text-gray-500 mb-1">{t("بداية الاشتراك","Subscription start")}</p>
              <p className="font-bold text-gray-900 text-sm">{linkedSub.startDate || t("غير محدد","Not set")}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-primary/30">
              <p className="text-xs text-gray-500 mb-1">{t("نهاية الاشتراك","Subscription end")}</p>
              <p className="font-bold text-gray-900 text-sm">{linkedSub.endDate || t("غير محدد","Not set")}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-primary/30">
              <p className="text-xs text-gray-500 mb-1">{t("البرنامج","Program")}</p>
              <p className="font-bold text-gray-900 text-sm">{linkedSub.program || linkedSub.goals || "—"}</p>
            </div>
          </div>
        )}

        {order.notes && !isSmartPlanSystemNote(order.notes) && (
          <div className="mt-4 p-4 bg-white rounded-lg">
            <p className="text-xs text-gray-500 mb-2">📝 {t("ملاحظات العميل:", "Customer notes:")}</p>
            <p className="text-gray-700">{order.notes}</p>
          </div>
        )}
      </Card>

      {/* Weekly Meals Grid */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">
          📅 {t("جدول الوجبات المختارة", "Selected meals plan")}
        </h3>

        {weekBlocks.map(({ cycle: weekNum, days, firstDate }) => {
          const weekData = groupedByWeek[weekNum];

          return (
            <Card key={`${weekNum}-${firstDate}`} className="p-6">
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#EAF3FB] border border-[#CFE4F3] text-[#0E2A4A] font-black text-lg">
                🗓️ {t("الأسبوع (دورة","Week (cycle")} {weekNum})
              </div>

              <div className="grid gap-5">
                {days.map((day) => {
                  const dayMeals = weekData[day];
                  const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
                  const overrideKey = `${weekNum}-${day}`;
                  const overrideDate = dateOverrides[overrideKey];

                  // احسب التاريخ التلقائي (لو كان فيه startDate).
                  //
                  // 🔗 التاريخ من المصدر الوحيد (slotToDate) — يطابق المنيو والاعتماد.
                  const autoISO = dateForSlot(weekNum, day);
                  const autoDate = autoISO ? new Date(`${autoISO}T00:00:00`) : null;
                  const effectiveDate = overrideDate || autoDate;

                  return (
                    <div
                      key={day}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2 bg-[#0E2A4A] text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-base font-bold">
                            {dayName(day)}
                          </h5>
                          {effectiveDate && (
                            <span className="text-sm font-semibold opacity-80">
                              · {format(effectiveDate, "d MMM yyyy", { locale })}
                            </span>
                          )}
                          <span className="text-xs bg-white/15 rounded-full px-2.5 py-0.5">
                            {dayMeals.length} {t("وجبة", "meals")} · {dayCalories} {t("سعرة", "kcal")}
                          </span>
                        </div>

                        {/* ✅ Date override picker for this specific day */}
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={overrideDate ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-8 text-xs gap-1.5",
                                  overrideDate
                                    ? "bg-[#3CC4F0] hover:bg-[#2bb0dc] text-white border-transparent"
                                    : "bg-white/10 border-dashed border-white/40 text-white hover:bg-white/20"
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {effectiveDate
                                  ? format(effectiveDate, "d MMM", { locale })
                                  : t("تحديد تاريخ","Set date")}
                                {overrideDate && (
                                  <span className="text-[9px] bg-white/25 px-1 rounded">{t("يدوي","manual")}</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <div className="p-3 border-b border-gray-100">
                                <p className="text-xs font-bold text-gray-700">
                                  {t("تاريخ هذا اليوم","Date for this day")}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {autoDate ? `${t("الافتراضي","Default")}: ${format(autoDate, "d MMM yyyy", { locale })}` : t("حدّد تاريخ البداية أولاً","Set the start date first")}
                                </p>
                              </div>
                              <Calendar
                                mode="single"
                                selected={overrideDate}
                                onSelect={(d) =>
                                  setDateOverrides((prev) => ({ ...prev, [overrideKey]: d }))
                                }
                                locale={ar}
                                initialFocus
                              />
                              {overrideDate && (
                                <div className="p-2 border-t border-gray-100">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setDateOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[overrideKey];
                                        return next;
                                      })
                                    }
                                    className="w-full h-7 text-[11px] text-gray-500 hover:text-red-600"
                                  >
                                    {t("مسح التاريخ اليدوي (استخدم التلقائي)","Clear manual date (use auto)")}
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div
                        className="grid gap-2.5 p-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
                      >
                        {dayMeals.map((meal) => (
                          <div
                            key={meal._id}
                            className="bg-[#F7FBFE] border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                          >
                            <div className="relative">
                              {mealImage(meal) && (
                                <img
                                  src={mealImage(meal)!}
                                  alt={meal.mealNameAr}
                                  className="w-full h-24 object-cover"
                                />
                              )}
                              <span className="absolute top-1.5 start-1.5 text-[10px] font-bold text-primary bg-white/90 px-1.5 py-0.5 rounded-md">
                                {catName(meal.category)}
                              </span>
                            </div>
                            <div className="p-2.5 flex flex-col flex-1">
                              <h6 className="font-bold text-gray-900 text-[12.5px] leading-snug mb-1 line-clamp-2">
                                {isRtl ? meal.mealNameAr : (meal.mealNameEn || meal.mealNameAr)}
                              </h6>
                              {meal.modifiedAt && (
                                <div className="mb-1.5 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] leading-snug text-sky-800">
                                  <p className="font-bold">
                                    ✏️ {meal.modifiedByRole === "ADMIN"
                                      ? t("تم التعديل بواسطة الإدارة", "Modified by administration")
                                      : t("تم التعديل بواسطة الأخصائية", "Modified by nutritionist")}
                                    {meal.modifiedByName ? ` — ${meal.modifiedByName}` : ""}
                                  </p>
                                  {(meal.originalMealNameAr || meal.originalMealNameEn) && (
                                    <p className="mt-0.5 text-sky-700">
                                      {t("الوجبة الأصلية:", "Original meal:")} {isRtl
                                        ? (meal.originalMealNameAr || meal.originalMealNameEn)
                                        : (meal.originalMealNameEn || meal.originalMealNameAr)}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-2">
                                <span>{meal.calories} {t("سعرة", "kcal")}</span>
                                {meal.protein ? <span>🥩 {meal.protein}g</span> : null}
                              </div>
                              {meal.specialNotes && (
                                <p className="text-[10.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-1 mb-1.5 leading-snug break-words">
                                  📝 {meal.specialNotes}
                                </p>
                              )}
                              <div className="flex items-center justify-end gap-3 mt-auto pt-1.5 border-t border-gray-100">
                                <button
                                  onClick={async () => {
                                    const txt = prompt(
                                      t("ملاحظة للمطبخ على هذه الوجبة (إضافة/تعديل):", "Kitchen note for this meal (addition/tweak):"),
                                      meal.specialNotes || "",
                                    );
                                    if (txt === null) return;
                                    try {
                                      await noteItemMutation({ itemId: meal._id, note: txt, sessionToken });
                                    } catch (e: any) {
                                      void alertDialog({ message: e?.message || t("تعذّر الحفظ", "Save failed") });
                                    }
                                  }}
                                  className="text-gray-400 hover:text-amber-600 transition-colors text-sm"
                                  title={t("ملاحظة للمطبخ", "Kitchen note")}
                                >
                                  📝
                                </button>
                                <button
                                  onClick={() => setSwapTarget(meal)}
                                  className="text-gray-400 hover:text-primary transition-colors text-sm"
                                  title={t("تبديل الوجبة", "Swap meal")}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!(await confirmDialog({ message: t(`حذف "${meal.mealNameAr}" من الطلب؟`, `Remove "${meal.mealNameAr}" from the order?`), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;
                                    try {
                                      await removeItemMutation({ itemId: meal._id, sessionToken });
                                    } catch (e: any) {
                                      void alertDialog({ message: e?.message || t("تعذّر الحذف", "Delete failed") });
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition-colors text-sm"
                                  title={t("حذف الوجبة من الطلب", "Remove meal from order")}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Admin Actions */}
      <Card className="p-6 bg-gray-50">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          🔧 {t("إجراءات المراجعة", "Review actions")}
        </h3>

        <div className="space-y-4">
          {/* ✅ ملء سريع — اختياري */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              📅 {t("ملء سريع: تاريخ بداية التوصيل", "Quick fill: delivery start date")}
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {t("اختياري","Optional")}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "EEEE، d MMMM yyyy", { locale })
                    ) : (
                      <span>{t("اختر تاريخ ابتدائي (يملأ الأيام الفارغة فقط)...","Pick a start date (fills empty days only)...")}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date < new Date()}
                    locale={ar}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {startDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStartDate(undefined)}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  {t("مسح","Clear")}
                </Button>
              )}
            </div>

            {/* ✅ الأسبوع الذي يصادفه هذا التاريخ في دورة المطبخ */}
            {startDate && rotationInfo && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
                <span className="text-lg">🗓️</span>
                <span>
                  {t("هذا التاريخ يصادف","This date falls on")} <b>{t("الأسبوع","week")} {rotationInfo.rotationWeek}</b> {t("من دورة المطبخ","of the kitchen cycle")}
                  {rotationInfo.fridaysAhead > 0 && (
                    <span className="text-amber-600">
                      {" "}({t("المطبخ الآن على الأسبوع", "kitchen is currently on week")} {rotationInfo.currentCookingWeek})
                    </span>
                  )}
                  {t(". سيتلقّى العميل وجبات هذا الأسبوع عند بدء توصيله.", ". The customer will receive this week's meals once delivery starts.")}
                </span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              💡 <b>{t("طريقة مبسّطة:","Easy way:")}</b> {t("اترك هذا الحقل فارغًا وحدّد تاريخ اليوم الأول أدناه، وستُرتّب بقية الأيام تلقائيًا.","Leave this empty and just set the first day's date below — it flows in order automatically.")}
              <br />
              💡 <b>{t("أو:","Or:")}</b> {t("حدد التاريخ هنا ليكون نقطة بداية للأيام بدون تاريخ يدوي.","Set the date here as the starting point for days without a manual date.")}
              <br />
              💡 {t("تظل الأيام التي تحدّد لها تاريخًا يدويًا أدناه","Days you set a manual date for below stay")} <b>{t("مستقلة تمامًا","fully independent")}</b>.
            </p>
          </div>

          {/* ✅ ربط الطلب بمشترك */}
          {(() => {
            // الربط الفعلي: إما من الطلب نفسه (auto-link) أو اختيار يدوي
            const linkedId = (order as any).customerId || selectedCustomerId;
            const linkedCustomer = linkedId
              ? customers.find((c) => c._id === linkedId)
              : null;

            // الحالة 1: الطلب مربوط تلقائياً بمشترك موجود
            if (linkedCustomer) {
              return (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🔗 {t("المشترك المربوط", "Linked subscriber")}
                  </label>
                  <div className="rounded-xl p-4 flex items-start gap-3"
                    style={{
                      background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                      border: "1.5px solid #a7f3d0",
                    }}>
                    <div className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                      {linkedCustomer.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black text-emerald-900 truncate">{linkedCustomer.fullName}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                          ✓ {t("مربوط تلقائياً", "Auto-linked")}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800" dir="ltr">📞 {linkedCustomer.phone}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        {linkedCustomer.program && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700">
                            {linkedCustomer.program}
                          </span>
                        )}
                        {linkedCustomer.mealsPerDay != null && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700">
                            {linkedCustomer.mealsPerDay} {t("وجبات/يوم", "meals/day")}
                          </span>
                        )}
                        {linkedCustomer.allergies && (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-bold">
                            ⚠ {t("حساسية", "Allergy")}: {linkedCustomer.allergies}
                          </span>
                        )}
                        {linkedCustomer.avoid && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                            ✕ {t("ممنوع", "Avoid")}: {linkedCustomer.avoid}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCustomerId(null)}
                      className="text-xs text-gray-500 hover:text-red-600 hover:underline whitespace-nowrap"
                      title={t("إلغاء الربط واختيار يدوي","Unlink and pick manually")}
                    >
                      {t("تغيير", "Change")}
                    </button>
                  </div>
                </div>
              );
            }

            // الحالة 2: الطلب غير مربوط — اعرض dropdown يدوي
            return (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔗 {t("ربط بمشترك (اختياري)","Link to subscriber (optional)")}
                </label>
                <select
                  value={selectedCustomerId || ""}
                  onChange={(e) => setSelectedCustomerId(e.target.value as Id<"customers"> | "" || null)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">{t("-- عميل جديد (بدون ربط) --","-- New customer (no link) --")}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.fullName} ({customer.phone})
                      {customer.allergies ? ` - ⚠️ ${customer.allergies}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  💡 {t("لم يتم العثور على مشترك مطابق برقم الهاتف. يمكنك اختياره يدوياً.","No subscriber matched this phone. You can pick one manually.")}
                </p>
              </div>
            );
          })()}

          {/* Approval Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("ملاحظات الاعتماد (اختياري)","Approval notes (optional)")}
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder={t("مثال: تم اعتماد الخطة بعد مراجعة دقيقة من أخصائي التغذية...","e.g. Plan approved after careful nutritionist review...")}
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
            />
          </div>

          {/* ⚠️ تنبيه: خطط قائمة ستُستبدل عند الاعتماد — تظهر قبل الضغط لا بعده */}
          {conflicts && conflicts.total > 0 && (
            <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-black text-amber-900">
                ⚠️ {isRtl
                  ? `لهذا المشترك ${conflicts.total} خطة في تواريخ هذا الطلب${conflicts.manual ? ` — منها ${conflicts.manual} يدوية من الأخصائية` : ""}`
                  : `This subscriber has ${conflicts.total} plan(s) on this order's dates${conflicts.manual ? ` — ${conflicts.manual} manual` : ""}`}
              </p>
              <p className="text-[12px] font-bold text-amber-800 mt-1">
                {isRtl
                  ? "سيتم استبدالها باختيار العميل عند الاعتماد (منعاً لمضاعفة الأكل والبوكسات)."
                  : "They will be replaced by the customer's selection on approval (prevents double food/boxes)."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {conflicts.rows.slice(0, 12).map((r: any, i: number) => (
                  <span key={i} className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-white border border-amber-200 text-amber-900">
                    {r.date} · {r.source === "manual" ? (isRtl ? "يدوية" : "manual") : (isRtl ? "طلب" : "order")} ({r.items})
                  </span>
                ))}
                {conflicts.rows.length > 12 && (
                  <span className="text-[11px] font-bold text-amber-700">+{conflicts.rows.length - 12}</span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleApprove}
              className="flex-1 bg-primary hover:bg-primary/90 text-white py-4 text-lg font-bold"
            >
              {t("✅ اعتماد الخطة","✅ Approve plan")}
            </Button>

            <Button
              onClick={() => setShowRejectDialog(true)}
              variant="outline"
              className="flex-1 border-red-500 text-red-600 hover:bg-red-50 py-4 text-lg font-bold"
            >
              {t("❌ رفض الخطة","❌ Reject plan")}
            </Button>

            {isAdmin && (
              <Button
                onClick={handleDeleteOrder}
                variant="outline"
                title={t("حذف نهائي للخطة (للتجربة) — غير الرفض", "Permanently delete the plan (for testing) — not a rejection")}
                className="px-6 py-4 text-lg font-bold gap-2 border-red-700 text-red-700 bg-red-50 hover:bg-red-100"
              >
                🗑️ {t("حذف نهائي", "Delete permanently")}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                // ✅ استخدم رقم العميل المربوط لو موجود، وإلا من بيانات الطلب
                const linkedCust = ((order as any).customerId || selectedCustomerId)
                  ? customers.find((c) => c._id === ((order as any).customerId || selectedCustomerId))
                  : null;
                const rawPhone = linkedCust?.phone || (order as any).customerPhone || "";
                const phone = String(rawPhone).replace(/\D/g, "");
                if (!phone) {
                  void alertDialog({ message: t("⚠️ رقم الهاتف غير متوفر لهذا العميل", "⚠️ Phone number not available for this customer") });
                  return;
                }
                // تأكد إن الرقم بصيغة دولية (لو رقم قطر بدون code، ضيف 974)
                const fullPhone = phone.startsWith("974") || phone.length > 8 ? phone : `974${phone}`;
                const customerName = linkedCust?.fullName || (order as any).customerName || "";
                const orderRestaurant = (order as any).restaurantKey === "NUTRI_RESET" ? "Nutri Reset" : "أدرينالين";
                const msg = `مرحباً ${customerName} 👋\n\nبخصوص طلبك رقم ${(order as any).orderNumber || ""} في ${orderRestaurant}، نود التواصل معك للمراجعة.`;
                const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
                window.open(url, "_blank");
              }}
              className="px-8 py-4 text-lg font-bold gap-2"
            >
              <span style={{ color: "#25D366" }}>●</span>
              {t("💬 تواصل مع العميل","💬 Contact customer")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t("⚠️ رفض الخطة","⚠️ Reject plan")}
            </h3>
            <p className="text-gray-600 mb-4">
              {t("يرجى كتابة سبب الرفض ليتم إرساله للعميل","Write a rejection reason to send to the customer")}
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              rows={4}
              placeholder={t("مثال: الوجبات المختارة تتجاوز السعرات المسموحة...","e.g. Selected meals exceed the allowed calories...")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {t("تأكيد الرفض","Confirm rejection")}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                }}
                variant="outline"
                className="flex-1"
              >
                {t("إلغاء","Cancel")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Meal Swap Dialog */}
      {swapTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSwapTarget(null)}>
          <Card className="p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">🔁 {t("تبديل", "Swap")}: <span className="text-primary">{isRtl ? swapTarget.mealNameAr : (swapTarget.mealNameEn || swapTarget.mealNameAr)}</span></h3>
              <button onClick={() => setSwapTarget(null)} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {t("اختر وجبة بديلة — ستُحدَّث السعرات والسعر تلقائياً.","Pick a replacement meal — calories and price update automatically.")}
              {swapTarget.day ? (
                <span className="block mt-1 text-xs font-bold text-[#0E76AC]">
                  📅 {t("وجبات","Meals of")} {dayName(swapTarget.day)} — {t("الأسبوع (دورة","week (cycle")} {swapTarget.week})
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setSwapScope("day")}
                className={cn("rounded-lg px-3 py-2 text-sm font-bold transition-colors", swapScope === "day" ? "bg-white text-primary shadow-sm" : "text-gray-600")}
              >
                {t("وجبات نفس اليوم", "Same-day meals")}
              </button>
              <button
                type="button"
                onClick={() => setSwapScope("all")}
                className={cn("rounded-lg px-3 py-2 text-sm font-bold transition-colors", swapScope === "all" ? "bg-white text-primary shadow-sm" : "text-gray-600")}
              >
                {t("المنيو الكامل", "Full menu")}
              </button>
            </div>
            {swapScope === "all" && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {t("اختيار استثنائي بواسطة الأخصائية — تأكدي من توفر الوجبة في المطبخ.", "Specialist override — confirm that the meal is available in the kitchen.")}
              </div>
            )}
            <div className="grid sm:grid-cols-[1fr_180px] gap-2 mb-4">
              <input
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
                placeholder={t("ابحثي عن وجبة...", "Search meals...")}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary"
              />
              <select
                value={swapCategory}
                onChange={(e) => setSwapCategory(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="all">{t("كل التصنيفات", "All categories")}</option>
                {swapCategories.map((category) => (
                  <option key={category} value={category}>{catName(category)}</option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {swapCandidates.map((m: any) => (
                  <button key={m._id} onClick={() => doSwap(m)} disabled={swapping}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary transition-colors text-right disabled:opacity-50">
                    {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr} className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">{isRtl ? m.nameAr : (m.nameEn || m.nameAr)}</p>
                      <p className="text-xs text-gray-500">{catName(m.category)} · {m.calories || 0} {t("سعرة","kcal")}{m.priceQAR ? ` · ${m.priceQAR} ${t("ر.ق","QAR")}` : ""}</p>
                      {isScheduledForTarget(m) && <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("متاحة اليوم", "Available today")}</span>}
                    </div>
                  </button>
                ))}
            </div>
            {swapCandidates.length === 0 && <p className="text-center text-gray-400 py-8">{t("لا توجد وجبات مطابقة للتبديل","No matching meals to swap")}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
