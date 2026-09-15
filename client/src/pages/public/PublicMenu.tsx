/**
 * @file client/src/pages/public/PublicMenu.tsx
 * @description صفحة المنيو للموقع العام - مع نظام جدولة الأسابيع والأيام
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { usePublicMeals } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, X, Clock, Lock, ShoppingCart, Plus, Minus, Check, Phone, AlertTriangle, MessageCircle, User, Sparkles, UtensilsCrossed } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cartStore";
import { tagLabel } from "@/lib/tagLabels";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useAction } from "convex/react";
import { getSessionToken } from "@/lib/store";
import { api } from "@/../../convex/_generated/api";
/* ✅ القواعد كلها من المصدر الوحيد shared/rules — لا قاعدة تُكتب في هذه الشاشة. */
import {
  subscriptionState, orderedSubscriptionSlots, firstSubscriptionSlot, slotToDate,
  localISO, isMainCategory, isSnackCategory, isBreakfastCategory, BREAKFAST_MAX_PER_DAY, customerCategoryLabel,
  DELIVERY_DAYS as SHARED_DELIVERY_DAYS, type DeliveryDay, defaultDeliveryDay, nextDeliveryDateISO, mealAvailableOn,
  restrictionWords, avoidTokens as avoidTokensOf, restrictionHit,
  dailyLimits, countPicks, dayComplete, dayProgress as sharedDayProgress, slotFull, addMealVerdict, subscriptionSlotKeys,
  programCalFactor, customerProgram, scaledNutrition,
} from "@shared/rules";
import { confirmDialog, alertDialog } from "@/lib/dialogs";
import { SubscriptionExpiredNotice } from "@/components/public/SubscriptionExpiredNotice";
import { restaurantFromPath } from "@/lib/restaurantBrand";
import {
  getVerifiedPhone,
  getVerifiedCustomerId,
  isBrowseOnly,
  saveVerifiedPhone,
  saveVerifiedCustomerId,
  setBrowseOnly,
  clearIdentity,
} from "@/lib/customerIdentity";
import { openExternal } from "@/lib/native";
import { MenuSubscriberEntry } from '@/components/public/MenuSubscriberEntry';
import './menu-catalog.css';

const DAY_LABEL_AR: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الإثنين",
  tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس",
};

/** أسماء الشهور بالعربية لعرض تاريخ اليوم جنب اسمه في المنيو. */
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

type Category = "all" | "breakfast" | "lunch" | "dinner" | "salad" | "snack";
type DayOfWeek = DeliveryDay;

/** أيام التوصيل: السبت → الخميس (الجمعة فقط إجازة — 6 أيام). من shared/rules. */
const DELIVERY_DAYS: DayOfWeek[] = [...SHARED_DELIVERY_DAYS];

export default function PublicMenuPage() {
  const { language, dir } = useLanguage();
  const restaurant = restaurantFromPath();
  useSeo({ title: `قائمة الوجبات | ${restaurant.nameAr}`, description: `قائمة وجبات ${restaurant.nameAr} الصحية للمشتركين.`, path: restaurant.menuPath });
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const isNutriReset = restaurant.key === "NUTRI_RESET";
  const customerBrandName = restaurant.nameEn;
  const customerAccent = isNutriReset ? "#079AA5" : "#3CC4F0";
  const customerAccentDark = isNutriReset ? "#087E87" : "#47759C";
  const customerInk = isNutriReset ? "#354F51" : "#0E2A4A";
  const customerMuted = isNutriReset ? "#55565A" : "#47759C";
  const customerSoft = isNutriReset ? "#EDF9F8" : "#F2FBFF";
  const customerLine = isNutriReset ? "#C8E3E3" : "#D9E6F1";
  const customerGradient = `linear-gradient(135deg, ${customerAccent}, ${customerAccentDark})`;
  const [, setLocation] = useLocation();
  
  // Cart State
  const { items, addItem, removeItem, getTotalMeals, setPreferredStartDate, setRestaurantContext } = useCartStore();
  useEffect(() => { setRestaurantContext(restaurant.key); }, [restaurant.key, setRestaurantContext]);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [selectedMeal, setSelectedMeal] = useState<any>(null);

  // ─── Phone gate ───
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string>(() => {
    return getVerifiedPhone();
  });
  const [verifiedCustomerId, setVerifiedCustomerId] = useState<string>(() => {
    return getVerifiedCustomerId();
  });
  const [browseMode, setBrowseMode] = useState<boolean>(() => isBrowseOnly());
  const [phoneError, setPhoneError] = useState("");

  /**
   * ⚡ وصف الوجبة (aboutAr/aboutEn) لا يُرسل ضمن القائمة — 28KB عبر 192 وجبة —
   * بل يُجلب عند فتح نافذة الوجبة فقط. القائمة تحمل `hasAbout` فنعرف مسبقاً
   * هل سيأتي نصّ فنحجز مكانه، بدل أن يظهر فجأة ويقفز التخطيط.
   */
  const selectedMealFull = useQuery(
    api.publicMeals.getBySlug,
    selectedMeal?.slug ? { slug: selectedMeal.slug } : "skip",
  ) as any;

  const aboutText = selectedMealFull
    ? (isRtl
        ? selectedMealFull.aboutAr || selectedMealFull.aboutEn
        : selectedMealFull.aboutEn || selectedMealFull.aboutAr) || ""
    : "";
  const aboutLoading = Boolean(selectedMeal?.hasAbout) && !selectedMealFull;

  // ✅ البحث يجري على السيرفر ويُرجع حقولاً محدودة للرقم المطلوب وحده.
  //    سابقاً كانت الصفحة تنزّل قائمة المشتركين كاملة وتفلتر في المتصفح، فكان
  //    أي زائر يقرأ كل الأسماء والهواتف والعناوين والأسعار من DevTools.
  const matchingCustomers = useQuery(
    api.customers.findPublicByPhone,
    verifiedPhone ? { phone: verifiedPhone, restaurantKey: restaurant.key } : "skip"
  );

  const verifiedCustomer = useMemo(() => {
    if (!matchingCustomers || !verifiedCustomerId) return null;
    return matchingCustomers.find((c: any) => String(c._id) === verifiedCustomerId) || null;
  }, [matchingCustomers, verifiedCustomerId]);

  const isPhoneVerified = !!verifiedPhone && !!verifiedCustomer;

  /* الزائر غير المتحقَّق: داخل يشوف الأكل، مالوش اشتراك ولا تاريخ بداية ولا دورة.
     الأسبوع واليوم أدوات مشترك، وعرضها له تطلب منه قراراً بلا معنى — والأسوأ أنها
     تحصر ما يراه في وجبات يوم واحد فيظن أن هذه كل القائمة. فنُخفيها عنه ونعرض
     المنيو كاملاً. لا شيء من منطق المشترك يتغيّر: هذا الشرط لا يتحقق إلا وهو
     غير متحقَّق من رقمه. */
  const [visitorDayPicker, setVisitorDayPicker] = useState(false);
  // Adrenaline opens the existing visitor catalogue immediately; subscriber rules are unchanged.
  const isVisitor = (!isNutriReset || browseMode) && !isPhoneVerified;

  // Restaurant settings (for WhatsApp)
  const settings = useQuery(api.restaurantSettings.get);
  const phoneRaw = (isNutriReset ? restaurant.phone : (settings?.phone || "+97412345678")).replace(/\D/g, "");
  const whatsappLink = (msg: string) =>
    `https://wa.me/${phoneRaw}?text=${encodeURIComponent(msg)}`;

  const handleVerifyPhone = () => {
    setPhoneError("");
    const normalized = phoneInput.replace(/\D/g, "");
    if (normalized.length < 8) {
      setPhoneError(isRtl ? "رقم غير صحيح" : "Invalid phone number");
      return;
    }
    setVerifiedPhone(normalized);
    saveVerifiedPhone(normalized);
    // customer will be picked from results below
  };

  const handlePickCustomer = (customer: any) => {
    setVerifiedCustomerId(String(customer._id));
    saveVerifiedCustomerId(String(customer._id));
  };

  const handleResetPhone = () => {
    setVerifiedPhone("");
    setVerifiedCustomerId("");
    setPhoneInput("");
    setBrowseMode(false);
    clearIdentity();
  };

  const handleBrowseOnly = () => {
    setBrowseMode(true);
    setBrowseOnly();
  };

  const handleSignupViaWhatsApp = () => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطط ${restaurant.nameAr}.\nرقمي: ${phoneInput || verifiedPhone}`
      : `Hello 👋\nI'd like to subscribe to ${restaurant.nameEn} plans.\nMy phone: ${phoneInput || verifiedPhone}`;
    openExternal(whatsappLink(msg));
  };

  // ✅ تاريخ بداية التوصيل الذي يختاره العميل. منه يعرف النظام أسبوع الدورة —
  //    فالعميل يختار «متى يبدأ» لا «أي دورة». افتراضياً أقرب يوم توصيل (يتخطّى الجمعة).
  const [startDate, setStartDate] = useState<string>(() => nextDeliveryDateISO());
  const rotationInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    startDate ? { targetDate: startDate } : "skip",
  ) as any;

  // NEW: Week & Day selection
  // ✅ أسبوع الدورة يُشتق من تاريخ البداية (rotationWeekAt). يبقى قابلاً لتغيير يدوي.
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [weekTouched, setWeekTouched] = useState(false);
  // ✅ نبدأ بيوم اليوم (أو أقرب يوم توصيل) بدل إجبار العميل على اختيار يوم
  //    قبل أن يستطيع إضافة أي وجبة.
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(() => defaultDeliveryDay());
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // ─── Subscription limits + warnings ───
  // ⚠️ سجلّات قديمة قد تكون mealsPerDay = 0 (لم تُملأ عند الإدخال). كان الشرط
  //    `mainMealsToday >= 0` يتحقق فوراً فيُمنع المشترك من إضافة أي وجبة برسالة
  //    "وصلت للحد الأقصى (0)". صفر = لا يوجد حدّ مسجّل، لا "ممنوع".
  // ✅ سعرات حسب هدف العميل: مُعامل البرنامج (دايت/لياقة/تضخيم) من إعدادات المطعم.
  //    العرض فقط — بيانات الطلب تُحفظ بالسعرات الأساسية.
  // ✅ معامل البرنامج والتغذية الفعلية — من shared/rules/nutrition (نفس ما تطبّقه الاستيكرات)
  const calFactor = useMemo(
    () => programCalFactor(customerProgram(verifiedCustomer), (settings as any)?.programPortions),
    [verifiedCustomer, settings],
  );
  const nutritionFor = (meal: any) => scaledNutrition(meal, calFactor);

  // ✅ حدود الاشتراك اليومية من shared/rules/selection (صفر يعني صفر؛ غير المسجَّل بلا حد)
  const limits = useMemo(() => dailyLimits(verifiedCustomer), [verifiedCustomer]);
  const { mealsPerDay, snacksPerDay, hasMealLimit, hasSnackLimit, noMealPlan } = limits;

  // Count what's selected for current day
  const selectedToday = items.filter(
    (i: any) => i.week === selectedWeek && i.day === selectedDay
  );
  const todayCounts = countPicks(selectedToday);
  const mainMealsToday = todayCounts.meals;
  const snacksToday = todayCounts.snacks;

  /** كم وجبة/سناك اختار العميل ليوم معيّن في الأسبوع الحالي، وهل اكتمل؟ (shared/rules) */
  const dayProgress = (dayValue: string) =>
    sharedDayProgress(items.filter((i: any) => i.week === selectedWeek && i.day === dayValue), limits);

  const todayProgress = selectedDay ? dayProgress(selectedDay) : null;

  /**
   * ✅ حساب الأيام الفعلية للاشتراك من startDate إلى endDate.
   *   - نتخطّى الجمعة (يوم إجازة).
   *   - كل جمعة تعبر → أسبوع الدورة يتقدّم +1 (يلفّ على 1..4).
   *   - يبدأ من `rotationInfo.rotationWeek` (أسبوع دورة تاريخ البداية).
   * الناتج: Set من "week:day" لكل يوم توصيل فعلي داخل الاشتراك.
   *   نستخدمه لعرض الأسابيع/الأيام المتاحة فقط ولمنع التنقل بعد نهاية الاشتراك.
   */
  const subEndDate = (verifiedCustomer as any)?.endDate as string | undefined;
  /* ⛔ اشتراك منتهٍ: الصفحة كانت تعرض تاريخ الانتهاء بلا فحصه، فيقدر المشترك
        المنتهي يختار وجبات لأيام لن تُوصَّل إليه. نفس الحكم في الخطة الذكية
        (lib/subscription.ts) — مصدر واحد فلا يفترقان. */
  const subState = useMemo(() => subscriptionState(subEndDate), [subEndDate]);
  const subExpired = subState.status === "expired";

  /**
   * ✅ منطق الاختيار الصحيح:
   *   - النافذة تبدأ من **بكرة** (اليوم انقضى ميعاد تحضيره في المطبخ)،
   *     مش من تاريخ بداية الاشتراك لو ده مضى.
   *   - لو الاشتراك في المستقبل، تبدأ من تاريخ بدايته.
   *   - النافذة تنتهي عند تاريخ نهاية الاشتراك (inclusive).
   *   - نلفّ أسبوع الدورة بشكل صحيح بعد كل جمعة، بدءاً من رقم الدورة في
   *     تاريخ بداية الاشتراك (rotationInfo.rotationWeek).
   */
  const subscriptionSlots = useMemo(
    (): Set<string> | null => subscriptionSlotKeys(startDate, subEndDate, Number(rotationInfo?.rotationWeek) || 1),
    [startDate, subEndDate, rotationInfo],
  );

  /** الأسابيع اللي عندها يوم واحد على الأقل داخل الاشتراك. */
  const subscriptionWeeks = useMemo((): Set<number> | null => {
    if (!subscriptionSlots) return null;
    const s = new Set<number>();
    for (const key of Array.from(subscriptionSlots)) {
      const [w] = key.split(":");
      s.add(Number(w));
    }
    return s;
  }, [subscriptionSlots]);

  /**
   * ✅ أول يوم في اشتراك العميل — (أسبوع الدورة + اليوم) لتاريخ بدايته الفعلي.
   *    نمشي بنفس منطق subscriptionSlots (calendar-walk، يتخطّى الجمعة، دورة صحيحة)
   *    ونلتقط أول slot. عليه يفتح المينو، لا على «أسبوع 1/يوم اليوم».
   *
   *    ⚠️ اشتراك 4 أسابيع يلفّ فيغطي الدورات كلها [1..4]، فأسبوع 1 قد يكون **آخر**
   *       أسبوع للعميل لا أوله. الافتراض على أسبوع 1 كان يبدأ العميل من نهاية
   *       اشتراكه — لخبطة مسند. البداية الحقيقية تُنهي ذلك.
   */
  //   ✅ المصدر الوحيد: lib/subscription — نفس الحساب يستخدمه المنيو والذكية.
  const startRotForSub = Number(rotationInfo?.rotationWeek) || 1;
  const firstSubSlot = useMemo(
    () => firstSubscriptionSlot(startDate, subEndDate, startRotForSub),
    [startDate, subEndDate, startRotForSub],
  ) as { week: number; day: DayOfWeek } | null;

  const orderedSubSlots = useMemo(
    () => orderedSubscriptionSlots(startDate, subEndDate, startRotForSub),
    [startDate, subEndDate, startRotForSub],
  ) as { week: number; day: DayOfWeek }[];

  /** فهرس أول يوم لم يكتمل اختيار وجباته — حدّ التقدّم المسموح. */
  const firstIncompleteIdx = useMemo(() => {
    for (let i = 0; i < orderedSubSlots.length; i++) {
      const { week, day } = orderedSubSlots[i];
      const picked = items.filter((it: any) => it.week === week && it.day === day);
      if (!dayComplete(countPicks(picked), limits)) return i;
    }
    return orderedSubSlots.length; // الكل مكتمل
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSubSlots, items, mealsPerDay, snacksPerDay, hasMealLimit, hasSnackLimit]);

  /* 🧪 «مسار الأيام» — الواجهة الجديدة للمشترك المسجَّل (قرار المستخدم بعد الديمو).
   *  نفس المنطق والقيود والسلة والمعالجات حرفياً — تغيير عرض فقط. الكلاسيكية
   *  باقية كاملة كباك أب ويُرجَع لها بزر «الواجهة الكلاسيكية» (محفوظ محلياً). */
  const [uiClassic, setUiClassic] = useState<boolean>(() => {
    try { return localStorage.getItem("menuUiClassic") === "1"; } catch { return false; }
  });
  const setUiMode = (classic: boolean) => {
    setUiClassic(classic);
    try { localStorage.setItem("menuUiClassic", classic ? "1" : "0"); } catch { /* لا شيء */ }
  };
  const pathMode = !uiClassic && orderedSubSlots.length > 0;
  // نوع الخانة النشطة في المسار: رئيسية أولاً، وبعد اكتمالها سناك — مع تبديل يدوي
  const [pathKindSel, setPathKindSel] = useState<"main" | "snack" | null>(null);
  useEffect(() => { setPathKindSel(null); }, [selectedWeek, selectedDay]);
  const pathKind: "main" | "snack" = pathKindSel
    ?? ((hasMealLimit && mainMealsToday >= mealsPerDay && hasSnackLimit && snacksToday < snacksPerDay) ? "snack" : "main");

  /* ═══ إكمال باقي الوجبات بالخطة الذكية ═══
   *  144 وجبة يدوياً كثيرة. الزر يستدعي نفس محرّك الذكية (generateWeeklyPlan)
   *  الذي يطبّق كل القيود (حساسية/ممنوعات/تفضيلات) ويتقدّم بالدورة كل جمعة،
   *  ثم يملأ الخانات الفاضية فقط — لا يلمس ما اختاره العميل يدوياً. */
  const generateWeeklyPlan = useAction(api.ai.generateWeeklyPlan);
  const [autoFilling, setAutoFilling] = useState(false);

  /** عدد أيام الاشتراك التي لم تكتمل بعد (خانات ينفع الذكاء يملأها). */
  const remainingSlotsCount = useMemo(
    () => orderedSubSlots.filter(({ week, day }) => {
      const picked = items.filter((it: any) => it.week === week && it.day === day);
      return !dayComplete(countPicks(picked), limits);
    }).length,
    [orderedSubSlots, items, mealsPerDay, snacksPerDay, hasMealLimit, hasSnackLimit],
  );

  const handleAutoComplete = async () => {
    if (autoFilling) return;
    // 🔓 يعمل بالرقم المتحقق (بلا تسجيل دخول)؛ الجلسة إن وُجدت تعطي حدّاً أوسع.
    const token = getSessionToken() || undefined;
    if (!token && !verifiedPhone) {
      toast({
        title: isRtl ? "أدخل رقمك أولاً" : "Enter your phone first",
        variant: "destructive",
      });
      return;
    }
    if (!startDate || !subEndDate) {
      toast({ title: isRtl ? "لا يوجد اشتراك محدّد المدة" : "No dated subscription", variant: "destructive" });
      return;
    }
    setAutoFilling(true);
    // عدّادات محلية: items لا تتحدّث داخل الحلقة، فنتتبّع ما أضفناه يدوياً
    const localCounts: Record<string, { meals: number; snacks: number; breakfast: number }> = {};
    const addedKeys = new Set<string>();
    try {
      const res: any = await generateWeeklyPlan({
        phone: verifiedPhone || undefined,
        startDate,
        endDate: subEndDate,
        startRotationWeek: startRotForSub,
        sessionToken: token,
      });
      // خريطة سريعة لما هو موجود بالفعل لكل (أسبوع:يوم) — لا نكرّر ولا نتخطّى الحدود
      let added = 0;
      for (const wk of (res?.weeks || [])) {
        for (const d of (wk.days || [])) {
          const week = Number(d.rotationWeek);
          const day = d.day as DayOfWeek;
          if (!orderedSubSlots.some((s) => s.week === week && s.day === day)) continue; // خارج الاشتراك
          for (const pick of (d.picks || [])) {
            const isSnack = isSnackCategory(pick.category);
            const isBreakfast = isBreakfastCategory(pick.category);
            // عدّ ما في السلة لهذا اليوم بعد ما أضفنا
            const picked = items.concat([]).filter((it: any) => it.week === week && it.day === day);
            const curMeals = picked.filter((p: any) => isMainCategory(p.category)).length;
            const curSnacks = picked.filter((p: any) => isSnackCategory(p.category)).length;
            const curBreakfast = picked.filter((p: any) => isBreakfastCategory(p.category)).length;
            // ملاحظة: items لا تتحدّث فوراً داخل الحلقة، فنعتمد عدّاداً محلياً
            const key = `${week}:${day}`;
            localCounts[key] = localCounts[key] || { meals: curMeals, snacks: curSnacks, breakfast: curBreakfast };
            const c = localCounts[key];
            if (isSnack) { if (hasSnackLimit && c.snacks >= snacksPerDay) continue; }
            else {
              // ⭐ سقف الفطار داخل الملء التلقائي: فطار واحد/يوم كحد أقصى
              if (isBreakfast && c.breakfast >= BREAKFAST_MAX_PER_DAY) continue;
              if (hasMealLimit && c.meals >= mealsPerDay) continue;
            }
            // موجودة مسبقاً؟ لا نكرّر
            const already = items.some((it: any) => it._id === pick.id && it.week === week && it.day === day)
              || addedKeys.has(`${pick.id}:${key}`);
            if (already) continue;
            addItem({
              _id: pick.id, nameAr: pick.nameAr, nameEn: pick.nameEn || "",
              category: pick.category, calories: pick.calories, protein: pick.protein,
              carbs: pick.carbs, fats: pick.fats, imageUrl: pick.imageUrl || undefined,
              priceQAR: pick.priceQAR || 0, week, day,
            });
            addedKeys.add(`${pick.id}:${key}`);
            if (isSnack) c.snacks++; else { c.meals++; if (isBreakfast) c.breakfast++; }
            added++;
          }
        }
      }
      toast({
        title: isRtl ? "✨ اكتملت الخطة" : "✨ Plan completed",
        description: isRtl ? `أضاف الذكاء ${added} وجبة للخانات الفاضية` : `AI added ${added} meals to empty slots`,
      });
    } catch (e: any) {
      toast({ title: isRtl ? "تعذّر الإكمال" : "Auto-complete failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setAutoFilling(false);
    }
  };

  const slotChronoIdx = (week: number, day: string) =>
    orderedSubSlots.findIndex((s) => s.week === week && s.day === day);

  /** 🔒 هل يُسمح باختيار هذا اليوم؟ فقط حتى أول يوم ناقص (تسلسل إجباري). */
  const isSlotAllowed = (week: number, day: string) => {
    if (!orderedSubSlots.length) return true; // زائر بلا اشتراك → بلا قفل
    const idx = slotChronoIdx(week, day);
    return idx >= 0 && idx <= firstIncompleteIdx;
  };
  /** 🔒 هل يُسمح بفتح هذا الأسبوع؟ لو أول أيامه ضمن المسموح. */
  const isWeekAllowed = (week: number) => {
    if (!orderedSubSlots.length) return true;
    const firstIdx = orderedSubSlots.findIndex((s) => s.week === week);
    return firstIdx >= 0 && firstIdx <= firstIncompleteIdx;
  };

  /** هل هذا اليوم من هذا الأسبوع داخل مدة الاشتراك؟ */
  const isSlotInSub = (week: number, day: string) => {
    if (!subscriptionSlots) return true; // لا حد → مسموح
    return subscriptionSlots.has(`${week}:${day}`);
  };

  // ✅ لو الأسبوع/اليوم المختار خارج نافذة الاشتراك (مثلاً اليوم انقضى)،
  //   نلقائياً نقلب لأول slot صالح.
  useEffect(() => {
    if (!subscriptionSlots || subscriptionSlots.size === 0) return;
    const currentKey = `${selectedWeek}:${selectedDay}`;
    if (subscriptionSlots.has(currentKey)) return; // المختار صالح بالفعل
    // نبحث عن أول slot موجود بترتيب أسبوع/يوم طبيعي
    for (let w = 1; w <= 4; w++) {
      for (const d of DELIVERY_DAYS) {
        if (subscriptionSlots.has(`${w}:${d}`)) {
          if (w !== selectedWeek) { setSelectedWeek(w); setWeekTouched(true); }
          if (d !== selectedDay) setSelectedDay(d);
          return;
        }
      }
    }
  }, [subscriptionSlots, selectedWeek, selectedDay]);

  /**
   * "اليوم التالي" — يرجّع { day, week } للتنقل:
   *   1. أول يوم ناقص بعد اليوم المختار في نفس الأسبوع (الأربعاء → الخميس).
   *   2. لو خلصت أيام الأسبوع كلها، نتقدّم لأول يوم ناقص في الأسبوع اللي بعده
   *      (سبت الأسبوع الجاي، مش سبت الأسبوع اللي فات).
   *   3. أقصى أسبوع = min(4, durationWeeks) — الدورة 4 أسابيع كحد أقصى.
   *   4. لو كل شيء كامل، نلفّ للأسبوع الحالي لأول يوم ناقص (fallback نادر).
   *   5. null = خلصت الاشتراك كله ✓
   */
  // ✅ حد الأسابيع الأعلى — نعتمد على الأسابيع الفعلية اللي فيها يوم واحد على الأقل
  //    في الاشتراك (subscriptionWeeks) بدل durationWeeks — لأن الجمعة قد ترمي
  //    اليوم الأخير من الاشتراك في أسبوع دورة مختلف عن أسبوع البداية.
  const maxSubWeek = subscriptionWeeks && subscriptionWeeks.size > 0
    ? Math.max(...Array.from(subscriptionWeeks))
    : Math.max(1, Math.min(4, Number((verifiedCustomer as any)?.durationWeeks) || 4));
  /* حكم الاكتمال نفسه لكل الأسابيع (shared/rules dayComplete) — كانت للأسابيع الأخرى
     نسخة تختلف حين لا يكون للمشترك حدّ وجبات مسجَّل. */
  const dayCompleteInWeek = (wk: number, dy: DayOfWeek) =>
    dayComplete(countPicks(items.filter((i: any) => i.week === wk && i.day === dy)), limits);

  /** 🧭 كتل الاشتراك: مجموعات متتالية زمنياً من نفس أسبوع الدورة. تبويب الدورة
   *  الواحد قد يغطي فترتين (أيام يوليو + ذيل أغسطس بعد لفّة الدورة) — نعرض
   *  للعميل **كتلة واحدة فقط** كل مرة فلا تظهر أيام الذيل البعيدة وسط أيامه
   *  الحالية وتلخبطه (طلب المستخدم: «امشِ بالترتيب وشيل أيام أغسطس»). */
  const weekBlocks = useMemo(() => {
    const blocks: { week: number; slots: { week: number; day: DayOfWeek }[] }[] = [];
    for (const s of orderedSubSlots) {
      const last = blocks[blocks.length - 1];
      if (last && last.week === s.week) last.slots.push(s as any);
      else blocks.push({ week: s.week, slots: [s as any] });
    }
    return blocks;
  }, [orderedSubSlots]);

  /** الكتلة المعروضة لتبويب أسبوع: التي فيها أول يوم ناقص **مسموح** (دوره جاي)؛
   *  وإلا أقرب كتلة أيامها مسموحة (مكتملة — ليراجع اختياراته). فذيل أغسطس لا
   *  يظهر إلا لما يوصل له فعلاً بعد إكمال كل ما قبله. */
  const visibleBlockForWeek = (w: number) => {
    const mine = weekBlocks.filter((b) => b.week === w);
    if (!mine.length) return null;
    return (
      mine.find((b) => b.slots.some((s) => !dayCompleteInWeek(w, s.day) && isSlotAllowed(w, s.day)))
      || mine.find((b) => b.slots.some((s) => isSlotAllowed(w, s.day)))
      || mine[0]
    );
  };

  const nextIncompleteDay = (): { day: DayOfWeek; week: number } | null => {
    // 🔒 يعتبر السلوت "مقبول" فقط لو (أ) داخل الاشتراك، (ب) ناقص وجباته.
    const isCandidate = (wk: number, d: DayOfWeek) =>
      isSlotInSub(wk, d) && !dayCompleteInWeek(wk, d);

    // 1) نفس الأسبوع، بعد اليوم المختار
    if (selectedDay) {
      const idx = DELIVERY_DAYS.indexOf(selectedDay);
      for (let i = idx + 1; i < DELIVERY_DAYS.length; i++) {
        if (isCandidate(selectedWeek, DELIVERY_DAYS[i])) {
          return { day: DELIVERY_DAYS[i], week: selectedWeek };
        }
      }
    }
    // 2) الأسابيع اللاحقة (من السبت) — محدودة بأسابيع الاشتراك
    for (let w = selectedWeek + 1; w <= maxSubWeek; w++) {
      // تخطّى الأسابيع اللي مش في الاشتراك أصلاً
      if (subscriptionWeeks && !subscriptionWeeks.has(w)) continue;
      for (const d of DELIVERY_DAYS) {
        if (isCandidate(w, d)) return { day: d, week: w };
      }
    }
    // 3) لفّ داخل الأسبوع الحالي لأيام سابقة ناقصة
    if (selectedDay) {
      const idx = DELIVERY_DAYS.indexOf(selectedDay);
      for (let i = 0; i < idx; i++) {
        if (isCandidate(selectedWeek, DELIVERY_DAYS[i])) {
          return { day: DELIVERY_DAYS[i], week: selectedWeek };
        }
      }
    }
    // 4) لفّ لأسابيع سابقة
    for (let w = 1; w < selectedWeek; w++) {
      if (subscriptionWeeks && !subscriptionWeeks.has(w)) continue;
      for (const d of DELIVERY_DAYS) {
        if (isCandidate(w, d)) return { day: d, week: w };
      }
    }
    return null;
  };

  /**
   * ✅ هل العميل خلّص كل يوم توصيل داخل اشتراكه؟
   *   يستخدم subscriptionSlots (الأيام الفعلية بين البداية والنهاية) —
   *   لو مفيش اشتراك محدد نرجع false (يخلص لما كل الدورة تكمل).
   */
  const subscriptionComplete = useMemo(() => {
    if (!subscriptionSlots || subscriptionSlots.size === 0) return false;
    for (const key of Array.from(subscriptionSlots)) {
      const [wStr, day] = key.split(":");
      if (!dayCompleteInWeek(Number(wStr), day as DayOfWeek)) return false;
    }
    return true;
  }, [subscriptionSlots, items, mealsPerDay, snacksPerDay, hasSnackLimit]);

  // ✨ انتقال تلقائي واضح: أول ما يكتمل اليوم (وجباته + سناكاته) ننقل العميل
  //    لليوم التالي بعد لحظة قصيرة مع توست يشرح — زر «التالي» الصغير وحده كان
  //    ممكن ما يتشافش فيحس العميل إنه تاه (طلب المستخدم: سهّلها عليه).
  //    ننتقل فقط عند التحوّل ناقص→مكتمل على نفس اليوم — لا عند مجرد فتح يوم مكتمل.
  const prevCompleteRef = useRef<{ key: string; complete: boolean } | null>(null);
  useEffect(() => {
    if (!selectedDay) return;
    const key = `${selectedWeek}:${selectedDay}`;
    const complete = !!todayProgress?.complete;
    const prev = prevCompleteRef.current;
    prevCompleteRef.current = { key, complete };
    if (!prev || prev.key !== key) return;   // تنقّل بين الأيام — ليس اكتمالاً جديداً
    if (prev.complete || !complete) return;   // لم يتحوّل الآن من ناقص لمكتمل
    const nxt = nextIncompleteDay();
    if (!nxt) return;                         // خلّص اشتراكه كله — رسالة الاكتمال تظهر
    const lbl = isRtl ? (DAY_LABEL_AR[nxt.day] || nxt.day) : nxt.day;
    const tmr = setTimeout(() => {
      if (nxt.week !== selectedWeek) { setSelectedWeek(nxt.week); setWeekTouched(true); }
      setSelectedDay(nxt.day);
      toast({
        title: isRtl ? `✓ اكتملت اختيارات هذا اليوم — تم الانتقال إلى ${lbl}` : `✓ Day complete — moved you to ${lbl}`,
        description: isRtl ? "أكمل اختيار وجبات هذا اليوم بالطريقة نفسها." : "Pick this day's meals the same way.",
      });
    }, 900);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedDay, todayProgress?.complete]);

  // Avoid keywords from customer (lowercase tokens)
  const avoidTokens = useMemo(
    () => avoidTokensOf(verifiedCustomer?.allergies, verifiedCustomer?.avoid),
    [verifiedCustomer],
  );

  /** الكلمة المخالفة نفسها (TURKEY / AVOCADO) — تُسمّى للمشترك بدل تحذير مبهم.
   *  من المصدر الوحيد lib/mealRestrictions، نفس ما تستخدمه الأخصائية والمراجعة. */
  const restrictWords = useMemo(
    () => restrictionWords(verifiedCustomer?.avoid, verifiedCustomer?.allergies),
    [verifiedCustomer],
  );
  const avoidHitFor = (meal: any): string | null => restrictionHit(meal, restrictWords, avoidTokens);
  
  // Handle adding meal to cart
  const handleAddToCart = async (meal: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // ✅ الحكم من shared/rules — الشاشة تعرض الرسائل فقط
    const verdict = addMealVerdict(meal.category, todayCounts, limits);

    // ⛔ اشتراك بلا عدد وجبات محدّد — لا نسمح بالاختيار (النظام لا يعرف حصّته)
    if (verdict.block === "noMealPlan") {
      toast({
        title: isRtl ? "لم يتم تحديد عدد وجباتك" : "Your meal count isn't set",
        description: isRtl
          ? "اشتراكك لا يحدّد عدد الوجبات/السناكات اليومية بعد. تواصل مع الأخصائية لضبطه قبل الاختيار."
          : "Your subscription doesn't define a daily meal/snack count yet. Contact the specialist to set it first.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDay) {
      // لا يُفترض حدوثه (يوم مختار دائماً)، لكن نبقيه كشبكة أمان بلا alert مُعطِّل
      toast({
        title: isRtl ? "اختر اليوم أولاً" : "Pick a day first",
        description: isRtl ? "اختر يومًا من الشريط بالأعلى ثم أضف وجباتك" : "Choose a day above, then add your meals",
      });
      return;
    }

    // ✅ Check subscription limits — نُخبره بما يفعله بعدها، لا نكتفي بالرفض
    const dayLabelNow = isRtl ? DAY_LABEL_AR[selectedDay] || selectedDay : selectedDay;
    // ⛔ السقوف تُعرض كـpop-up لا كتنبيه أسفل الصفحة — التنبيه العابر يمرّ
    //    دون أن يراه المشترك، فيظنّ أن اختياره تمّ ثم يشتكي أن يومه ناقص.
    if (verdict.block === "snacksFull") {
      await alertDialog({
        title: isRtl ? `⛔ اكتملت سناكات ${dayLabelNow}` : `⛔ Snacks are full for ${dayLabelNow}`,
        message: isRtl
          ? (snacksPerDay === 0
            ? `اشتراكك لا يشمل أي سناك — ${mealsPerDay} وجبات يوميًا فقط.

لإضافة سناكات تواصل مع الأخصائية لتعديل اشتراكك.`
            : `اخترت بالفعل ${snacksToday} سناك ليوم ${dayLabelNow}، واشتراكك ${snacksPerDay} سناك يوميًا.

احذف واحداً من سناكات هذا اليوم، أو اختر يومًا آخر.`)
          : (snacksPerDay === 0
            ? `Your plan includes no snacks — ${mealsPerDay} meals/day only.`
            : `You already picked ${snacksToday} snack(s) for ${dayLabelNow}; your plan allows ${snacksPerDay}/day.

Remove one, or pick another day.`),
      });
      return;
    }
    // ☕ فطار ثانٍ في نفس اليوم: مسموح باختيار المشترك بعد تأكيد صريح.
    //    كان ممنوعاً منعاً باتاً، لكن من لا تعجبه وجبات الغداء/العشاء ليومه قد
    //    يفضّل فطارين — وهو حرّ ما دام العدد الكلي ضمن اشتراكه.
    //    ⚠️ السقف باقٍ في الاختيار التلقائي (الذكية والإكمال) فلا تُنتِج فطارين وحدها.
    if (verdict.secondBreakfast) {
      const okBf = await confirmDialog({
        title: isRtl ? "☕ فطار ثانٍ لنفس اليوم؟" : "☕ A second breakfast for this day?",
        confirmText: isRtl ? "نعم أريد فطارين" : "Yes, two breakfasts",
        cancelText: isRtl ? "إلغاء" : "Cancel",
        message: isRtl
          ? `اخترت بالفعل ${todayCounts.breakfasts} فطار ليوم ${dayLabelNow}، وهذه وجبة فطار أخرى.\n\nستُحسب ضمن وجباتك الرئيسية (${mainMealsToday + 1} من ${mealsPerDay})، أي ستستلم فطارين في نفس اليوم بدل غداء أو عشاء.\n\nهل تريد المتابعة؟`
          : `You already picked ${todayCounts.breakfasts} breakfast for ${dayLabelNow}, and this is another one.\n\nIt counts toward your main meals (${mainMealsToday + 1} of ${mealsPerDay}) — you would get two breakfasts that day instead of a lunch or dinner.\n\nContinue?`,
      });
      if (!okBf) return;
    }
    if (verdict.block === "mealsFull") {
      await alertDialog({
        title: isRtl ? `⛔ اكتملت وجبات ${dayLabelNow}` : `⛔ Meals are full for ${dayLabelNow}`,
        message: isRtl
          ? `اخترت بالفعل ${mainMealsToday} وجبات رئيسية ليوم ${dayLabelNow}، واشتراكك ${mealsPerDay} وجبات يوميًا.

احذف واحدة من وجبات هذا اليوم، أو اختر يومًا آخر.`
          : `You already picked ${mainMealsToday} main meal(s) for ${dayLabelNow}; your plan allows ${mealsPerDay}/day.

Remove one, or pick another day.`,
      });
      return;
    }

    // ⛔ ممنوع/حساسية — رسالة رسمية صريحة تُسمّي المخالفة، لا تنبيه عابر.
    //    لا نمنع نهائياً (قد يكون التطابق باسم متشابه)، لكن نُوثّق أنه أُبلغ صراحةً.
    const avoidHit = avoidHitFor(meal);
    if (avoidHit) {
      const mealNm = isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr);
      const registered = [verifiedCustomer?.allergies, verifiedCustomer?.avoid]
        .filter(Boolean).join(" · ");
      const ok = await confirmDialog({
        variant: "danger",
        title: isRtl ? "⛔ هذه الوجبة ضمن ممنوعاتك" : "⛔ This meal is on your restricted list",
        confirmText: isRtl ? "أفهم ذلك وأريدها" : "I understand, add it",
        cancelText: isRtl ? "إلغاء الاختيار" : "Cancel",
        message: isRtl
          ? `الوجبة: «${mealNm}»

المُسجَّل في ملفك كممنوع: ${avoidHit.toUpperCase()}
ممنوعاتك وحساسيتك المسجَّلة: ${registered || "—"}

‹!›اختيارك لهذه الوجبة مسؤوليتك، وسيظهر هذا التنبيه للأخصائية عند مراجعة طلبك.

هل تريد إضافتها رغم ذلك؟`
          : `Meal: "${mealNm}"

Restricted on your file: ${avoidHit.toUpperCase()}
Your registered allergies/avoid list: ${registered || "—"}

‹!›Choosing it is your responsibility, and this warning will be shown to the specialist when your order is reviewed.

Add it anyway?`,
      });
      if (!ok) return;
    }

    // 🔁 تكرار نفس الصنف في نفس اليوم — تأكيد صريح **قبل** الإضافة.
    //    كان تنبيهاً أسفل الشاشة بعد الإضافة، يختفي ولا يراه أحد، فيصل للمطبخ
    //    يومٌ فيه نفس الصنف مرتين دون أن يكون المشترك قاصداً.
    const beforeCount = itemCount(meal._id);
    if (beforeCount >= 1) {
      const mealNm2 = isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr);
      const dayLbl2 = isRtl ? (DAY_LABEL_AR[selectedDay] || selectedDay) : selectedDay;
      const okDup = await confirmDialog({
        title: isRtl ? "🔁 نفس الوجبة مرة أخرى؟" : "🔁 Same meal again?",
        confirmText: isRtl ? "نعم أريدها مكرّرة" : "Yes, add it again",
        cancelText: isRtl ? "إلغاء" : "Cancel",
        message: isRtl
          ? `«${mealNm2}» مختارة بالفعل ${beforeCount} ${beforeCount === 1 ? "مرة" : "مرات"} ليوم ${dayLbl2}.

بالإضافة ستصبح ${beforeCount + 1} مرات في نفس اليوم — أي أنك ستستلم نفس الصنف مكرّراً.

هل هذا ما تريده؟`
          : `"${mealNm2}" is already picked ${beforeCount} time(s) for ${dayLbl2}.

Adding it makes ${beforeCount + 1} of the same item on one day.

Is that what you want?`,
      });
      if (!okDup) return;
    }

    const nutrition = nutritionFor(meal);
    addItem({
      _id: meal._id,
      nameAr: meal.nameAr,
      nameEn: meal.nameEn || "",
      category: meal.category,
      // Cart/review show the same effective nutrition as the meal card. The
      // mutation still receives IDs only and rebuilds catalog snapshots safely.
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fats: nutrition.fats,
      imageUrl: meal.imageUrl,
      priceQAR: meal.priceQAR || 0,
      week: selectedWeek,
      day: selectedDay,
    });

    const dayLbl = isRtl ? (DAY_LABEL_AR[selectedDay] || selectedDay) : selectedDay;
    const mealLbl = isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr);
    // ✅ تأكيد فوري للإضافة (التكرار أُقرّ صراحةً قبلها بحوار)
    toast({
      title: isRtl ? "✓ أُضيفت للخطة" : "✓ Added to plan",
      description: `${mealLbl} — ${isRtl ? "أسبوع" : "Week"} ${selectedWeek} · ${dayLbl}`,
    });
  };
  
  // ✅ زر الوجبة toggle: لو مضافة يشيلها (عشان يختار غيرها)، لو لأ يضيفها
  const handleToggleCart = (meal: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedDay && isInCart(meal._id)) {
      removeItem(meal._id, selectedWeek, selectedDay);
      toast({
        title: isRtl ? "أُزيلت من الخطة" : "Removed from plan",
        description: isRtl ? `${meal.nameAr} — يمكنك اختيار وجبة أخرى` : `${meal.nameEn || meal.nameAr} — pick another`,
      });
      return;
    }
    handleAddToCart(meal, e);
  };

  // Check if meal is already in cart
  const isInCart = (mealId: string) => {
    if (!selectedDay) return false;
    return items.some(
      (item) => item._id === mealId && item.week === selectedWeek && item.day === selectedDay
    );
  };

  // كم مرة اختار العميل هذه الوجبة لليوم الحالي (يدعم التكرار).
  const itemCount = (mealId: string) => {
    if (!selectedDay) return 0;
    return items.filter(
      (item) => item._id === mealId && item.week === selectedWeek && item.day === selectedDay
    ).length;
  };

  // ⚠️ لا نمرّر التصنيف للخادم: كان category="snack" يرجّع السناكات فقط،
  //    فبعد دمج السلطة فيه كانت هتختفي من التبويب. نجلب ونفلتر محلياً
  //    بنفس مصنّف الخطة الذكية (isSnackCategory).
  const { data: allMeals = [] } = usePublicMeals({ search: searchQuery });

  const menuHeaderImage = (allMeals.find((m: any) => m.imageUrl)?.imageUrl) || undefined;

  // Filter meals by selected week and day using exact schedule pairs
  const filteredMeals = allMeals.filter((meal: any) => {
    // 🧪 مسار الأيام: نفلتر بنوع الخانة النشطة (رئيسية/سناك) بدل تبويبات التصنيف —
    //    نفس المصنّف (isSnackCategory) ونفس القيود، عرض فقط.
    if (pathMode) {
      const snack = isSnackCategory(meal.category);
      if (pathKind === "snack" ? !snack : snack) return false;
    } else if (activeCategory !== "all") {
      const ok = activeCategory === "snack"
        ? isSnackCategory(meal.category)
        : String(meal.category || "").toLowerCase() === activeCategory;
      if (!ok) return false;
    }
    // الزائر يرى القائمة كاملة: الجدولة تخصّ من له اشتراك وجدول توصيل، وتصفيتها
    // عليه كانت تُظهر 9 وجبات من 140. لا يمرّ هنا أي مشترك — الشرط يشمل
    // !isPhoneVerified، ومتى تحقّق العميل عاد الفلتر كما هو تماماً.
    if (isVisitor && !visitorDayPicker) return true;
    // ✅ نفس حكم الخطة الذكية (lib/mealSchedule.ts) — كانت المقارنة هنا بـ===
    //    بلا توحيد نوع، فأي جدولة تُكتب بأسبوع نصّي "2" أو يوم "Saturday"
    //    كانت تختفي من المنيو اليدوي وحده بينما تظهر في الذكية.
    return mealAvailableOn(meal, selectedWeek, selectedDay);
  });

  const meals = filteredMeals;

  // Countdown timer logic - DISABLED (always allow ordering)
  // ✅ افتح المينو على أول يوم في اشتراك العميل (أسبوع + يوم البداية الحقيقيين)،
  //    لا على «أسبوع 1/يوم اليوم». ما لم يتنقّل العميل يدوياً (weekTouched).
  //    firstSubSlot يمشي على التقويم ويتخطّى الجمعة، فيطابق ما يراه العميل فعلاً.
  useEffect(() => {
    if (weekTouched) return;
    if (firstSubSlot) {
      setSelectedWeek(firstSubSlot.week);
      setSelectedDay(firstSubSlot.day);
      return;
    }
    // لا اشتراك محدد (زائر) → نكتفي بمزامنة الأسبوع مع دورة تاريخ البداية.
    const w = Number(rotationInfo?.rotationWeek);
    if (w >= 1 && w <= 4) setSelectedWeek(w);
  }, [firstSubSlot, rotationInfo, weekTouched]);

  // ✅ املأ تاريخ البداية تلقائياً من اشتراك العميل المسجَّل (بعد تأكيد رقمه).
  //    الأخصائية سجّلت بدايته ونهايته، فلا يخمّن العميل — المينو يُبنى على اشتراكه.
  //    نتبنّاه مرة واحدة لكل مشترك، ولو كان في الماضي (بدأ فعلاً) نُبقي أقرب يوم توصيل.
  // ✅ نتبنّى تاريخ بداية الاشتراك دائماً — لا نسأل العميل. لو الاشتراك بدأ فعلاً
  //    نستخدم تاريخه (فيتوافق أسبوع الدورة مع دورة المطبخ الحقيقية للعميل). لو في
  //    المستقبل نُبقيه — النظام يعرف يحسب أسبوع الدورة الصحيح لكل تاريخ.
  const appliedSubRef = useRef<string | null>(null);
  useEffect(() => {
    const sub = verifiedCustomer as any;
    if (!sub?._id) return;
    if (appliedSubRef.current === String(sub._id)) return;
    appliedSubRef.current = String(sub._id);
    const subStart = sub.startDate;
    if (subStart && /^\d{4}-\d{2}-\d{2}$/.test(subStart)) {
      setStartDate(subStart);
      setWeekTouched(false);
    }
  }, [verifiedCustomer]);

  // ✅ احفظ تاريخ البداية في السلة ليصل مع الطلب للأخصائية
  useEffect(() => {
    if (startDate) setPreferredStartDate(startDate);
  }, [startDate, setPreferredStartDate]);

  useEffect(() => {
    // ✅ تعطيل نظام قفل الوقت بالكامل - الطلبات مفتوحة دائماً
    setIsLocked(false);
    setTimeRemaining("");
    
    // الكود القديم (معطل):
    // if (!selectedDay) {
    //   setIsLocked(false);
    //   setTimeRemaining("");
    //   return;
    // }
    // const cutoffTime = "18:00";
    // const updateCountdown = () => { ... }
  }, [selectedDay]);

  const categories = [
    { id: "all" as Category, labelAr: "الكل", labelEn: "All" },
    { id: "breakfast" as Category, labelAr: "الإفطار", labelEn: "Breakfast" },
    { id: "lunch" as Category, labelAr: "الغداء", labelEn: "Lunch" },
    { id: "dinner" as Category, labelAr: "العشاء", labelEn: "Dinner" },
    // ⚖️ لا تبويب "سلطات": السلطة سناك، وتبويب منفصل كان بيوهم المشترك
    //    إنها صنف ثالث بينما اشتراكه وجبات + سناكات فقط. تظهر تحت "سناكس".
    { id: "snack" as Category, labelAr: "سناكس", labelEn: "Snacks" },
  ];

  const weeks = [
    { value: 1, label: isRtl ? "الأسبوع 1" : "Week 1" },
    { value: 2, label: isRtl ? "الأسبوع 2" : "Week 2" },
    { value: 3, label: isRtl ? "الأسبوع 3" : "Week 3" },
    { value: 4, label: isRtl ? "الأسبوع 4" : "Week 4" },
  ];

  const days: { value: DayOfWeek; label: string }[] = [
    { value: "saturday", label: isRtl ? "السبت" : "Saturday" },
    { value: "sunday", label: isRtl ? "الأحد" : "Sunday" },
    { value: "monday", label: isRtl ? "الإثنين" : "Monday" },
    { value: "tuesday", label: isRtl ? "الثلاثاء" : "Tuesday" },
    { value: "wednesday", label: isRtl ? "الأربعاء" : "Wednesday" },
    { value: "thursday", label: isRtl ? "الخميس" : "Thursday" },
  ];

  // ─── Phone gate state determination ─── (isPhoneVerified مُعرّف أعلاه — يحتاجه فلتر الزائر)
  const canViewMenu = isPhoneVerified || isVisitor;
  const showPhonePrompt = !verifiedPhone;
  const showCustomerPicker = verifiedPhone && matchingCustomers && matchingCustomers.length > 1 && !verifiedCustomerId;
  const showNotRegistered = verifiedPhone && matchingCustomers !== undefined && matchingCustomers.length === 0;
  const showAutoSelect = verifiedPhone && matchingCustomers && matchingCustomers.length === 1 && !verifiedCustomerId;

  // Auto-select if only one match
  useEffect(() => {
    if (showAutoSelect && matchingCustomers && matchingCustomers[0]) {
      setVerifiedCustomerId(String(matchingCustomers[0]._id));
      saveVerifiedCustomerId(String(matchingCustomers[0]._id));
    }
  }, [showAutoSelect, matchingCustomers]);

  // ─── Phone Gate Screen (blocks menu) ───
  if (!canViewMenu) {
    return (
      <PublicLayout>
      {!isNutriReset && <div className="mx-auto max-w-7xl px-4 pt-4"><a href="/public/restaurant-menu" className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 font-semibold text-sky-900">{dir === 'rtl' ? 'منيو المطعم' : 'Restaurant menu'}</a></div>}
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12"
          style={{ background: "linear-gradient(135deg, #f8fafc, #ecfeff, #f0f9ff)" }}>
          <div className="w-full max-w-md">
            {/* Hero card */}
            <div className="bg-white rounded-3xl p-8 relative overflow-hidden"
              style={{
                boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.06)",
                border: "1px solid rgba(60,196,240,0.15)",
              }}>
              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-2xl"
                style={{ background: `radial-gradient(circle, ${customerAccent}, transparent)` }} />

              {/* Reset button — always visible, fixed top corner */}
              {verifiedPhone && (
                <button
                  onClick={handleResetPhone}
                  aria-label={isRtl ? "رجوع" : "Back"}
                  className="absolute top-4 left-4 z-20 h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}

              <div className="relative">
                {/* Restaurant identity */}
                {isNutriReset ? (
                  <div className="mx-auto mb-5 flex h-20 w-40 items-center justify-center rounded-2xl border border-[#079AA5]/20 bg-white px-4 shadow-[0_8px_24px_rgba(7,154,165,0.16)]">
                    <img src={restaurant.logo} alt={restaurant.nameEn} className="max-h-14 w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${customerAccent}, ${customerAccentDark})`,
                      boxShadow: "0 8px 24px rgba(60,196,240,0.4)",
                    }}>
                    <Phone className="h-7 w-7 text-white" />
                  </div>
                )}

                <h2 className="text-2xl font-black text-[#0F1516] text-center mb-2 tracking-tight">
                  {showPhonePrompt && (isRtl ? `أهلاً بك في ${customerBrandName}` : `Welcome to ${customerBrandName}`)}
                  {showNotRegistered && (isRtl ? "رقمك غير مسجل" : "Phone Not Registered")}
                  {showCustomerPicker && (isRtl ? "من المستلم؟" : "Who's the recipient?")}
                </h2>
                <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: customerAccentDark }}>
                  {showPhonePrompt && (isRtl ? "أدخل رقم هاتفك للوصول لخطتك واختيار وجباتك" : "Enter your phone to access your plan and pick meals")}
                  {showNotRegistered && (isRtl ? "هذا الرقم غير مسجل لدينا. تواصل عبر واتساب للاشتراك" : "This number isn't registered. Contact us via WhatsApp to subscribe")}
                  {showCustomerPicker && (isRtl ? "هذا الرقم مسجل لأكثر من مشترك. اختر اسمك للمتابعة" : "This number has multiple subscribers. Pick your name to continue")}
                </p>

                {/* Phone input */}
                {showPhonePrompt && (
                  <>
                    <div className="space-y-3">
                      <div
                        className="flex items-stretch rounded-xl overflow-hidden transition-all"
                        style={{
                          background: "#f8fafc",
                          border: `1.5px solid ${phoneError ? "#fca5a5" : "#e2e8f0"}`,
                        }}
                      >
                        {/* Country code prefix block */}
                        <div className="flex items-center justify-center px-4 gap-2 border-l"
                          style={{ background: `linear-gradient(135deg, ${customerAccent}, ${customerAccentDark})`, borderColor: "#e2e8f0", minWidth: "90px" }}>
                          <Phone className="h-5 w-5 text-white" />
                          <span className="text-base font-black text-white tabular-nums">+974</span>
                        </div>
                        {/* Input */}
                        <input
                          type="tel"
                          inputMode="numeric"
                          dir="ltr"
                          autoFocus
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyPhone()}
                          placeholder="74XXXXXX"
                          className="flex-1 h-12 px-4 text-center text-base font-bold tabular-nums tracking-widest bg-transparent outline-none"
                        />
                      </div>
                      {phoneError && (
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {phoneError}
                        </p>
                      )}
                      <button
                        onClick={handleVerifyPhone}
                        className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: `linear-gradient(135deg, ${customerAccent}, ${customerAccentDark})`,
                          boxShadow: "0 6px 20px rgba(60,196,240,0.4)",
                        }}
                      >
                        {isRtl ? "متابعة" : "Continue"}
                      </button>
                    </div>

                    {/* Browse without account */}
                    <button
                      onClick={handleBrowseOnly}
                      className="w-full mt-3 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-gray-50"
                      style={{ background: "transparent", border: "1.5px solid #e2e8f0", color: customerMuted }}
                    >
                      {isRtl ? "تصفّح قائمة الوجبات فقط" : "Just Browse Menu"}
                    </button>

                    <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-400 mb-2">
                        {isRtl ? "لست مشتركاً بعد؟" : "Not subscribed yet?"}
                      </p>
                      <button
                        onClick={handleSignupViaWhatsApp}
                        className="text-sm font-bold inline-flex items-center gap-1.5 hover:underline"
                        style={{ color: "#25D366" }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                      </button>
                    </div>
                  </>
                )}

                {/* Loading */}
                {verifiedPhone && matchingCustomers === undefined && (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="inline-block h-8 w-8 rounded-full border-2 border-gray-200 border-t-[#3CC4F0] animate-spin" />
                      <p className="text-xs text-gray-400 mt-3">{isRtl ? "جارٍ التحقق…" : "Verifying..."}</p>
                    </div>
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-10 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                      style={{ border: "1.5px solid #e2e8f0" }}
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>
                  </div>
                )}

                {/* Not registered */}
                {showNotRegistered && (
                  <div className="space-y-3">
                    <div className="rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-800">
                        {isRtl
                          ? `الرقم ${verifiedPhone} غير موجود في قاعدة بياناتنا.`
                          : `Number ${verifiedPhone} not found in our records.`}
                      </p>
                    </div>
                    <button
                      onClick={handleSignupViaWhatsApp}
                      className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #25D366, #128C7E)",
                        boxShadow: "0 6px 20px rgba(37,211,102,0.4)",
                      }}
                    >
                      <MessageCircle className="h-5 w-5" />
                      {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                    </button>
                    <button
                      onClick={handleBrowseOnly}
                      className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-gray-50"
                      style={{ background: "transparent", border: "1.5px solid #e2e8f0", color: customerMuted }}
                    >
                      {isRtl ? "تصفّح قائمة الوجبات فقط" : "Just Browse Menu"}
                    </button>
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{ background: "#f1f5f9", border: "1.5px solid #cbd5e1", color: "#475569" }}
                    >
                      ← {isRtl ? "أدخل رقم آخر" : "Use different number"}
                    </button>
                  </div>
                )}

                {/* Customer picker (multiple matches) */}
                {showCustomerPicker && (
                  <div className="space-y-2">
                    <div className="rounded-xl p-3 flex items-start gap-2.5 mb-3"
                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                      <User className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#0891b2" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "#155e75" }}>
                        {isRtl
                          ? `هذا الرقم مسجل لـ ${matchingCustomers.length} مشتركين. اختر المستلم الصحيح:`
                          : `This number has ${matchingCustomers.length} subscribers. Pick the right recipient:`}
                      </p>
                    </div>
                    {matchingCustomers.map((c: any) => (
                      <button
                        key={c._id}
                        onClick={() => handlePickCustomer(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-gray-50 hover:scale-[1.01] text-right"
                        style={{ border: "1.5px solid #e2e8f0" }}
                      >
                        <div className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-black text-white"
                          style={{ background: customerGradient }}>
                          {c.fullName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-bold text-[#0F1516] truncate">{c.fullName}</p>
                          <p className="text-[11px] text-[#47759C] mt-0.5">
                            {c.program || "—"} • {c.mealsPerDay ?? 0} {isRtl ? "وجبات" : "meals"}
                          </p>
                        </div>
                        <Check className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </button>
                    ))}
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-10 mt-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {isRtl ? "أدخل رقم آخر" : "Use different number"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // ─── Customer Info Banner data ───
  const cust: any = verifiedCustomer;
  const hasWarnings = cust?.allergies || cust?.avoid;

  return (
    <PublicLayout>
      {!isNutriReset && <div className="mx-auto max-w-7xl px-4 pt-4"><a href="/public/restaurant-menu" className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 font-semibold text-sky-900">{dir === 'rtl' ? 'منيو المطعم' : 'Restaurant menu'}</a></div>}
      <div className={isNutriReset ? undefined : 'adrenaline-menu'}>
      {/* ═══ Browse Mode Banner ═══ */}
      {isNutriReset && browseMode && !isPhoneVerified && (
        <div className="relative z-30 px-4 py-2.5" style={{ background: "#0B2138" }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#3CC4F0", boxShadow: "0 0 0 4px rgba(60,196,240,0.2)" }} />
              <p className="text-[13px] text-white leading-tight truncate">
                <span className="font-black">{isRtl ? "وضع التصفح" : "Preview mode"}</span>
                <span className="text-white/60 font-medium"> · {isRtl ? "اشترك للحجز والاستلام" : "Subscribe to order & get delivered"}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSignupViaWhatsApp}
                className="text-xs font-black px-4 h-8 rounded-full flex items-center gap-1.5 transition-transform hover:scale-[1.03]"
                style={{ background: "#fff", color: "#0B2138" }}
              >
                <MessageCircle className="h-3.5 w-3.5" style={{ color: "#25D366" }} />
                {isRtl ? "اشترك الآن" : "Subscribe now"}
              </button>
              <button
                onClick={handleResetPhone}
                className="text-xs font-bold text-white px-3 h-8 rounded-full hover:bg-white/10 transition-colors flex items-center"
                style={{ border: "1px solid rgba(255,255,255,0.35)" }}
              >
                {isRtl ? "تسجيل دخول" : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Customer Info Banner (Sticky top) ═══ */}
      {isPhoneVerified && (
        <div className="relative sm:sticky sm:top-[73px] z-30 border-b px-4 py-2.5"
          style={{
            background: isNutriReset
              ? "linear-gradient(110deg, #087E87 0%, #079AA5 58%, #066F77 100%)"
              : "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)",
            borderColor: isNutriReset ? "#F47721" : "transparent",
            boxShadow: isNutriReset
              ? "0 5px 18px rgba(18,138,152,0.22)"
              : "0 4px 14px rgba(60,196,240,0.3)",
          }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-black bg-white shadow-sm"
                style={{ color: isNutriReset ? "#E66C18" : "#3CC4F0" }}>
                {cust?.fullName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-black text-white leading-tight">
                  {isRtl ? "أهلاً" : "Hi"} {cust?.fullName?.split(" ")[0]}
                </p>
                <p className="text-[11px] text-white/80 leading-tight" dir="ltr">
                  {verifiedPhone}
                </p>
              </div>
            </div>

            {/* Plan info */}
            <div className="flex items-center gap-2 flex-wrap">
              {(hasMealLimit || hasSnackLimit) && (
                <span className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  {hasMealLimit ? mealsPerDay : "—"} {isRtl ? "وجبات" : "meals"} + {hasSnackLimit ? snacksPerDay : "—"} {isRtl ? "سناك" : "snacks"} {isRtl ? "يومياً" : "/day"}
                </span>
              )}
              {cust?.program && (
                <span className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  {cust.program}
                </span>
              )}
              <button
                onClick={handleResetPhone}
                className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                {isRtl ? "تغيير" : "Switch"}
              </button>
              {/* الرجوع للرئيسية */}
              <button
                onClick={() => setLocation(restaurant.menuPath)}
                className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                🏠 {isRtl ? "الرئيسية" : "Home"}
              </button>
            </div>

            {/* 🧭 مؤشّر «تختار الآن» — داخل الشريط اللاصق فيظل ظاهراً أثناء تصفّح الأكل،
                فلا يتوه العميل عن الخانة واليوم الحاليين (طلب المستخدم). */}
            {pathMode && selectedDay && !todayProgress?.complete && (() => {
              const num = pathKind === "snack" ? snacksToday + 1 : mainMealsToday + 1;
              const slotName = pathKind === "snack" ? `${isRtl ? "سناك" : "Snack"} ${num}` : `${isRtl ? "وجبة" : "Meal"} ${num}`;
              const dayLbl = isRtl ? (DAY_LABEL_AR[selectedDay] || selectedDay) : selectedDay;
              return (
                <div className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 mt-1"
                  style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)" }}>
                  <span className="font-black text-[13px] text-white flex items-center gap-1.5">
                    <span>{pathKind === "snack" ? "🍎" : "🍽️"}</span>
                    {isRtl ? `تختار الآن: ${slotName}` : `Picking: ${slotName}`}
                    <span className="opacity-85 font-bold">· {dayLbl}</span>
                  </span>
                  <span className="text-[11px] font-black text-white rounded-full px-2.5 py-0.5 whitespace-nowrap" style={{ background: "rgba(255,255,255,0.22)" }}>
                    {mainMealsToday}/{mealsPerDay} · {snacksToday}/{snacksPerDay}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ⛔ اشتراك بلا عدد وجبات محدّد — رسالة واضحة تمنع الاختيار */}
      {noMealPlan && (
        <div className="px-4 pt-3 -mt-1">
          <div className="max-w-7xl mx-auto rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "linear-gradient(135deg,#fff7ed,#fffbeb)", border: "1.5px solid #fdba74" }}>
            <div className="h-9 w-9 rounded-xl flex-shrink-0 grid place-items-center bg-orange-500">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-orange-900">
                {isRtl ? "لم يتم تحديد عدد وجباتك" : "Your meal count isn't set"}
              </p>
              <p className="text-xs text-orange-800 mt-0.5 leading-relaxed">
                {isRtl
                  ? "اشتراكك لا يحدّد عدد الوجبات والسناكات اليومية بعد، فلا يمكن الاختيار. تواصل مع الأخصائية لضبط اشتراكك أولاً."
                  : "Your subscription doesn't define a daily meal/snack count yet, so selection is disabled. Contact the specialist to set up your subscription first."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Allergies / Avoid warning banner (if any) ═══ */}
      {hasWarnings && isPhoneVerified && (
        <div className="px-4 pt-3 -mt-1">
          <div className="max-w-7xl mx-auto rounded-2xl p-3 flex items-start gap-3"
            style={{ background: "linear-gradient(135deg, #fef2f2, #fff5f5)", border: "1.5px solid #fecaca" }}>
            <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-red-500">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-red-600 uppercase tracking-wide mb-1">
                {isRtl ? "تنبيه: ممنوعات وحساسية" : "Allergies & Restrictions"}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {cust?.allergies && (
                  <span className="font-semibold text-red-800">
                    <span className="font-black">{isRtl ? "حساسية: " : "Allergy: "}</span>{cust.allergies}
                  </span>
                )}
                {cust?.avoid && (
                  <span className="font-semibold text-orange-800">
                    <span className="font-black">{isRtl ? "ممنوع: " : "Avoid: "}</span>{cust.avoid}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant-specific identity header */}
      {restaurant.key === "NUTRI_RESET" ? (
        <section className="relative overflow-hidden border-b border-[#079AA5]/25 bg-white" dir={isRtl ? "rtl" : "ltr"}>
          <div className="pointer-events-none absolute -start-20 -top-24 h-56 w-56 rounded-full border-[13px] border-[#079AA5] opacity-90" />
          <div className="pointer-events-none absolute -start-28 -top-32 h-52 w-52 rounded-full border-[10px] border-[#F47721]" />
          <div className="mx-auto grid min-h-[500px] max-w-7xl items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-12 lg:py-14">
            <div className="relative z-10 flex flex-col justify-center lg:px-5">
              <img src={restaurant.logo} alt="Nutri Reset" className="mb-7 h-auto w-full max-w-[390px] object-contain" />
              <p className="mb-2 text-sm font-black uppercase tracking-[.16em] text-[#55565a]">Reset your body. Rebalance your life.</p>
              <h1 className="max-w-xl text-4xl font-black leading-tight text-[#079AA5] sm:text-5xl">
                {isRtl ? "تغذية مخصصة، نتائج حقيقية" : "Personalized Nutrition. Real Results."}
              </h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-[#55565a]">
                {isRtl ? "نصمم خطة غذائية تناسب أهدافك وأسلوب حياتك وجسمك، بوجبات صحية ومكونات حقيقية تصل إلى بابك." : "We create nutrition plans that fit your goals, lifestyle, and body, with healthy meals and real ingredients delivered to your door."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#subscriber-menu" className="rounded-full bg-[#079AA5] px-6 py-3 text-sm font-black text-white shadow-[0_10px_24px_-14px_rgba(7,154,165,.9)]">{isRtl ? "اختر وجباتك" : "Choose your meals"}</a>
                <a href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`} className="rounded-full border-2 border-[#F47721] px-6 py-3 text-sm font-black text-[#E66C18]">{isRtl ? "تواصل معنا" : "Contact us"}</a>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[410px]">
              <div className="absolute -inset-3 translate-x-3 translate-y-3 rounded-[2rem] bg-[#F47721]/15" />
              <div className="absolute -inset-3 -translate-x-3 -translate-y-3 rounded-[2rem] border-2 border-[#079AA5]/35" />
              <div className="relative aspect-[502/625] overflow-hidden rounded-[1.7rem] bg-[#F8FBF8] shadow-[0_22px_55px_-28px_rgba(31,76,82,.42)]">
                <img
                  src="/nutri-reset-woman-meal.png"
                  alt={isRtl ? "وجبات صحية مخصصة من Nutri Reset" : "Nutri Reset personalized healthy meals"}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white" dir={isRtl ? "rtl" : "ltr"}>
          <div className="max-w-3xl mx-auto px-4 pt-7 pb-5 md:pt-9 text-center">
            <h1 className="font-black text-[#0E2A4A] tracking-tight" style={{ fontFamily: "'Cairo',sans-serif", fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.15 }}>
              {isRtl ? "قائمة الوجبات" : "Our menu"}
            </h1>
            <p className="mt-3 text-[15px] md:text-base font-black text-[#0E76AC]" aria-live="polite">
              {isRtl
                ? '200 وجبة وأكثر · تتنوّع حسب جدول المطبخ'
                : '200+ meals · rotating with the kitchen menu'}
            </p>
            <p className="mt-1.5 text-sm text-[#6B7C8C]">
              {isRtl
                ? "محسوبة السعرات بإشراف أخصائيي تغذية، وتُطبخ صباح كل يوم."
                : "Calorie-counted under nutritionist supervision, cooked every morning."}
            </p>
            {isVisitor && <MenuSubscriberEntry isRtl={isRtl} phone={phoneInput} verifiedPhone={verifiedPhone}
              error={phoneError} customers={matchingCustomers} onPhoneChange={setPhoneInput}
              onVerify={handleVerifyPhone} onPick={handlePickCustomer} onReset={handleResetPhone} />}
          </div>
        </section>
      )}

      {/* Choose: manual selection vs AI smart plan — أداة مشترك، تُخفى عن الزائر */}
      {!isVisitor && (
      <section id="subscriber-menu" className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-5" dir={isRtl ? "rtl" : "ltr"}>
          <p className="text-center text-sm font-bold mb-3" style={{ color: customerMuted }}>
            {isRtl ? "اختر طريقتك:" : "Choose how to order:"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manual */}
            <div className="rounded-2xl border-2 p-4 flex items-center gap-3" style={{ borderColor: customerAccent, background: customerSoft }}>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${customerAccent}20` }}>
                <UtensilsCrossed className="h-5 w-5" style={{ color: customerAccentDark }} />
              </div>
              <div className="min-w-0">
                <div className="font-black" style={{ color: customerInk }}>{isRtl ? "اختيار يدوي" : "Manual Pick"}</div>
                <div className="text-xs" style={{ color: customerMuted }}>{isRtl ? "تصفّح القائمة واختر وجباتك بنفسك (أنت هنا)" : "Browse and pick your meals (you're here)"}</div>
              </div>
            </div>
            {/* Smart */}
            <button
              onClick={() => setLocation(restaurant.key === "NUTRI_RESET" ? "/customer/smart-plan?restaurant=NUTRI_RESET" : "/customer/smart-plan")}
              className="rounded-2xl border hover:shadow-md transition-all p-4 flex items-center gap-3 text-start"
              style={{ borderColor: customerLine }}
            >
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: isNutriReset ? "#F47721" : customerGradient }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-black" style={{ color: customerInk }}>{isRtl ? "خطة ذكية ✨" : "Smart Plan ✨"}</div>
                <div className="text-xs" style={{ color: customerMuted }}>{isRtl ? "دع الاختيار لنا — تقترح الخطة الذكية وجبات يوم أو أسبوع" : "Let AI pick for you (day or week)"}</div>
              </div>
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Browse-mode notice: cart is saved locally but ordering needs a subscription */}
      {isNutriReset && browseMode && !isVisitor && (
        <div className="bg-amber-50 border-b border-amber-200" dir={isRtl ? "rtl" : "ltr"}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              {isRtl
                ? "أنت في وضع التصفّح — اختياراتك تُحفظ على جهازك، لكن لإتمام الطلب تحتاج اشتراكًا نشطًا. "
                : "You're browsing — your picks are saved on this device, but completing an order needs an active subscription. "}
              <button onClick={handleResetPhone} className="font-bold underline text-amber-900">
                {isRtl ? "أدخل رقمك للتحقق" : "Enter your phone to verify"}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* شريط الزائر — بديل هادئ عن أدوات الجدولة: يقول ما يراه ويعطيه طريق الاشتراك */}
      {isVisitor && (
        <div className="border-b border-[#3CC4F0]/25 bg-[#F2FBFF]" dir={isRtl ? "rtl" : "ltr"}>
          {/* على الجوال: النص سطر كامل والأزرار تحته — كان النص ينحشر في عمود ضيّق بين الزرّين */}
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3">
            <p className={cn('basis-full sm:basis-auto sm:flex-1 min-w-0 items-center gap-2 text-sm font-bold text-[#0E2A4A]', isNutriReset ? 'flex' : 'hidden')}>
              <UtensilsCrossed className="h-4.5 w-4.5 shrink-0 text-[#0E76AC]" />
              <span className="truncate">
                {isRtl ? "هذه قائمتنا الكاملة" : "This is our full menu"}
                <span className="ms-1.5 font-semibold text-[#47759C]">
                  {isRtl ? "· تتنوّع على مدار الشهر" : "· rotates through the month"}
                </span>
              </span>
            </p>
            <button
              onClick={() => setVisitorDayPicker((v) => !v)}
              className="rounded-full border border-[#3CC4F0]/50 bg-white px-3 min-h-11 text-xs font-black text-[#0E76AC] hover:bg-[#3CC4F0]/10"
            >
              {visitorDayPicker
                ? (isRtl ? "عرض القائمة كاملة" : "Show the full menu")
                : (isRtl ? "عرض وجبات يوم محدّد" : "View a specific day")}
            </button>
            <Button
              size="sm"
              onClick={() => {
                const msg = isRtl
                  ? `مرحباً 👋\nأرغب في الاشتراك في ${restaurant.nameAr}.`
                  : `Hello 👋\nI'd like to subscribe to ${restaurant.nameEn}.`;
                openExternal(whatsappLink(msg));
              }}
              className="min-h-11 rounded-full px-4 font-bold text-white"
              style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
            >
              <MessageCircle className={cn("h-3.5 w-3.5", isRtl ? "ml-1.5" : "mr-1.5")} />
              {isRtl ? "اشترك الآن" : "Subscribe"}
            </Button>
          </div>
        </div>
      )}

      {/* NEW: Week & Day Scheduling Section */}
      {(!isVisitor || visitorDayPicker) && (
      <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* ✅ شريط الخطوات — للواجهة الكلاسيكية فقط: مسار الأيام واضح بذاته
              (اليوم والتقدم في الهيرو) فالشريط تكرار محيّر يذكر «الأسبوع» (أُلغي بطلب المستخدم) */}
          {!pathMode && (
          <div className="mb-5 rounded-2xl border border-[#3CC4F0]/30 bg-[#F2FBFF] p-3 sm:p-4">
            <p className="text-xs font-black text-[#0E2A4A] mb-2.5">
              {isRtl ? "كيف تختار وجباتك؟" : "How to pick your meals"}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {[
                {
                  n: 1,
                  title: isRtl ? "اختر الأسبوع" : "Pick the week",
                  value: isRtl ? `الأسبوع ${selectedWeek}` : `Week ${selectedWeek}`,
                  done: true,
                },
                {
                  n: 2,
                  title: isRtl ? "اختر اليوم" : "Pick the day",
                  value: selectedDay
                    ? (isRtl ? DAY_LABEL_AR[selectedDay] || selectedDay : selectedDay)
                    : (isRtl ? "لم تختر بعد" : "not chosen"),
                  done: Boolean(selectedDay),
                },
                {
                  n: 3,
                  title: isRtl ? "أضف وجباتك" : "Add your meals",
                  value: todayProgress
                    ? hasMealLimit || hasSnackLimit
                      ? isRtl
                        ? `${todayProgress.meals}${hasMealLimit ? `/${mealsPerDay}` : ""} وجبة · ${todayProgress.snacks}${hasSnackLimit ? `/${snacksPerDay}` : ""} سناك`
                        : `${todayProgress.meals}${hasMealLimit ? `/${mealsPerDay}` : ""} meals · ${todayProgress.snacks}${hasSnackLimit ? `/${snacksPerDay}` : ""} snacks`
                      : isRtl ? `${todayProgress.count} مختارة` : `${todayProgress.count} picked`
                    : "—",
                  done: Boolean(todayProgress?.complete),
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className={cn(
                    "flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white border",
                    s.done ? "border-emerald-300" : "border-gray-200",
                  )}
                >
                  <span
                    className={cn(
                      "h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-black text-white",
                      s.done ? "bg-emerald-500" : "bg-[#3CC4F0]",
                    )}
                  >
                    {s.done ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#47759C] leading-none">{s.title}</p>
                    <p className="text-[12px] font-black text-[#0E2A4A] truncate mt-0.5">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 💡 تلميح بسيط: كيف تُبدّل أو تشيل وجبة */}
            <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-white/70 border border-[#3CC4F0]/20 px-3 py-2">
              <span className="text-sm leading-none mt-0.5">💡</span>
              <p className="text-[11.5px] font-bold text-[#47759C] leading-snug">
                {isRtl
                  ? "لتبديل وجبة، اضغط على الوجبة الخضراء المضافة لإزالتها، ثم اختر وجبة أخرى. يمكنك مراجعة جميع اختياراتك من زر «مراجعة الطلب» أدناه."
                  : "To swap a meal: tap the green (added) meal to remove it, then pick another. Review everything from the “Review Order” button below."}
              </p>
            </div>
          </div>
          )}

          {/* ⛔ اشتراك منتهٍ ⇒ إشعار التجديد فوق كل شيء */}
          {subExpired && subState.status === "expired" && (
            <SubscriptionExpiredNotice
              name={(verifiedCustomer as any)?.fullName || undefined}
              endDate={subState.endDate}
              daysAgo={subState.daysAgo}
              isRtl={isRtl}
            />
          )}

          {/* بانر الاكتمال في مسار الأيام (الصندوق التفصيلي مخفي هناك لتقليل الزحمة) */}
          {pathMode && subscriptionComplete && (
            <div className="mb-4 rounded-xl bg-emerald-500 text-white px-4 py-3 flex items-center gap-2 font-black text-sm">
              <Check className="h-4 w-4" />
              {isRtl ? "تم اختيار الوجبات حتى نهاية اشتراكك ✓" : "Meals selected through end of subscription ✓"}
            </div>
          )}

          {/* ✅ بطاقة اشتراكك — الواجهة الكلاسيكية فقط. مسار الأيام يعرض التقدم في الهيرو
              فالصندوق تكرار يزحم أعلى الصفحة (طلب المستخدم: «الكلام فوق كتير»). */}
          {(verifiedCustomer as any)?.startDate && !pathMode && (
            <div className="mb-4 rounded-2xl border border-[#3CC4F0]/30 bg-[#3CC4F0]/5 p-4">
              <h3 className="text-sm font-black text-[#0E2A4A] mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-[#3CC4F0]" />
                {isRtl ? "اشتراكك المسجَّل" : "Your registered subscription"}
              </h3>
              <div className="flex flex-wrap gap-2 text-[12px] font-bold">
                <span className="bg-white rounded-full px-3 py-1.5 text-[#47759C] border border-gray-100">
                  {isRtl ? "يبدأ" : "Starts"}: {(verifiedCustomer as any).startDate}
                </span>
                {(verifiedCustomer as any).endDate && (
                  <span className="bg-white rounded-full px-3 py-1.5 text-[#47759C] border border-gray-100">
                    {isRtl ? "ينتهي" : "Ends"}: {(verifiedCustomer as any).endDate}
                  </span>
                )}
                {(verifiedCustomer as any).durationWeeks && (
                  <span className="bg-white rounded-full px-3 py-1.5 text-[#47759C] border border-gray-100">
                    {isRtl
                      ? `المدة: ${(verifiedCustomer as any).durationWeeks} أسابيع`
                      : `${(verifiedCustomer as any).durationWeeks} weeks`}
                  </span>
                )}
                {rotationInfo?.rotationWeek && (
                  <span className="bg-emerald-500 text-white rounded-full px-3 py-1.5">
                    {isRtl
                      ? `الأسبوع ${rotationInfo.rotationWeek} من الدورة`
                      : `Cycle week ${rotationInfo.rotationWeek}`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#47759C] mt-2">
                {isRtl
                  ? "تُضبط قائمة الوجبات تلقائيًا وفق بداية اشتراكك، ولا تُعرض سوى الأيام والأسابيع الواقعة ضمن مدته."
                  : "The menu is auto-aligned to your subscription — only days/weeks inside your subscription window are shown."}
              </p>
              {/* ✅ بانر اكتمال — يظهر لو خلّص العميل كل يوم توصيل داخل اشتراكه */}
              {subscriptionComplete && (
                <div className="mt-3 rounded-xl bg-emerald-500 text-white px-4 py-3 flex items-center gap-2 font-black text-sm">
                  <Check className="h-4 w-4" />
                  {isRtl
                    ? "تم اختيار الوجبات حتى نهاية اشتراكك ✓"
                    : "Meals selected through end of subscription ✓"}
                </div>
              )}
            </div>
          )}

          {/* ✅ تاريخ بداية التوصيل — يظهر فقط للزائر بلا اشتراك. المشترك المسجّل
              يستخدم تاريخ اشتراكه تلقائياً (اللي تحدده الأخصائية) — بلا سؤال. */}
          {!(verifiedCustomer as any)?.startDate && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#47759C] mb-2">
              {isRtl ? "متى يبدأ توصيلك؟" : "When does delivery start?"}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={startDate}
                min={localISO(new Date())}
                onChange={(e) => { setStartDate(e.target.value); setWeekTouched(false); }}
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white"
              />
              {rotationInfo?.rotationWeek && (
                <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">
                  {isRtl
                    ? `المطبخ سيكون على الأسبوع ${rotationInfo.rotationWeek} حينها`
                    : `Kitchen will be on week ${rotationInfo.rotationWeek} then`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#47759C] mt-1.5">
              {isRtl
                ? "اختر يوم بدايتك، والنظام يختار لك وجبات الأسبوع الصحيح تلقائياً — حتى لو تبدأ الأسبوع القادم."
                : "Pick your start day; the system aligns the meals to the right week — even if you start next week."}
            </p>
          </div>
          )}

          {/* ✨ إكمال باقي الوجبات تلقائياً بالخطة الذكية — يملأ الخانات الفاضية فقط */}
          {startDate && subEndDate && remainingSlotsCount > 0 && (
            <button
              onClick={handleAutoComplete}
              disabled={autoFilling}
              className={cn(
                "w-full mb-4 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-black text-white transition-all",
                autoFilling ? "opacity-70 cursor-wait" : "hover:brightness-110 active:scale-[0.99]",
              )}
              style={{ background: customerGradient }}
            >
              <Sparkles className="h-5 w-5" />
              {autoFilling
                ? (isRtl ? "جارٍ إكمال الخطة…" : "Completing…")
                : (isRtl
                    ? `أكمل باقي الوجبات بالخطة الذكية (${remainingSlotsCount} يوم)`
                    : `Auto-complete remaining days with AI (${remainingSlotsCount})`)}
            </button>
          )}

          {/* 🧪 مسار الأيام (الواجهة الجديدة) — نفس المنطق والقيود، عرض مختلف فقط.
              الكلاسيكية كاملة في الفرع الثاني كباك أب. */}
          {pathMode ? (() => {
            const slots = orderedSubSlots;
            const total = slots.length;
            const doneCount = slots.filter((s) => dayCompleteInWeek(s.week, s.day)).length;
            const curIdx = slots.findIndex((s) => s.week === selectedWeek && s.day === selectedDay);
            const dateLblOf = (w: number, d: string) => {
              const iso = slotToDate(startDate, startRotForSub, w, d);
              if (!iso) return "";
              const dt = new Date(iso + "T00:00:00");
              return `${dt.getDate()} ${AR_MONTHS[dt.getMonth()]}`;
            };
            const dayItems = items.filter((it: any) => it.week === selectedWeek && it.day === selectedDay);
            const dayMains = dayItems.filter((it: any) => !isSnackCategory(it.category));
            const daySnacks = dayItems.filter((it: any) => isSnackCategory(it.category));
            const slotChips: { kind: "main" | "snack"; label: string; item: any | null }[] = [];
            if (hasMealLimit) for (let i = 0; i < mealsPerDay; i++) slotChips.push({ kind: "main", label: `${isRtl ? "وجبة" : "Meal"} ${i + 1}`, item: dayMains[i] || null });
            if (hasSnackLimit) for (let i = 0; i < snacksPerDay; i++) slotChips.push({ kind: "snack", label: `${isRtl ? "سناك" : "Snack"} ${i + 1}`, item: daySnacks[i] || null });
            const curLbl = selectedDay ? (isRtl ? DAY_LABEL_AR[selectedDay] || selectedDay : selectedDay) : "";
            return (
              <div className="space-y-4">
                {/* هيرو اليوم + التقدم الكلي */}
                <div className="rounded-2xl p-4 text-white" style={{ background: customerGradient }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-[11px] font-bold opacity-85">{isRtl ? "خطة وجباتك" : "Your meal plan"}</p>
                      <p className="text-xl font-black">
                        {isRtl ? `اليوم ${Math.max(1, curIdx + 1)} من ${total}` : `Day ${Math.max(1, curIdx + 1)} of ${total}`}
                        {selectedDay && ` — ${curLbl} ${dateLblOf(selectedWeek, selectedDay)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl px-3 py-1.5 text-sm font-black" style={{ background: "rgba(255,255,255,.2)" }}>
                        {doneCount}/{total} {isRtl ? "يوم مكتمل" : "days done"}
                      </span>
                      <button onClick={() => setUiMode(true)}
                        className="text-[10px] font-bold underline opacity-80 hover:opacity-100">
                        {isRtl ? "الواجهة الكلاسيكية" : "Classic view"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full" style={{ background: "rgba(255,255,255,.28)" }}>
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* خط الأيام — كل أيام الاشتراك بالترتيب الزمني */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slots.map((s, i) => {
                    const done = dayCompleteInWeek(s.week, s.day);
                    const cur = i === curIdx;
                    const allowed = isSlotAllowed(s.week, s.day);
                    const lbl = isRtl ? DAY_LABEL_AR[s.day] || s.day : s.day;
                    return (
                      <button key={`${s.week}:${s.day}:${i}`}
                        onClick={() => {
                          if (!allowed) {
                            toast({ title: isRtl ? "أكمل يومك الحالي أولاً" : "Complete your current day first", variant: "destructive" });
                            return;
                          }
                          if (s.week !== selectedWeek) { setSelectedWeek(s.week); setWeekTouched(true); }
                          setSelectedDay(s.day);
                        }}
                        className={cn(
                          "shrink-0 min-w-[84px] rounded-2xl px-3 py-2 text-center text-xs font-black transition-all border",
                          cur ? "text-white shadow-md"
                            : done ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : allowed ? "bg-white text-gray-700 border-gray-200 hover:border-[#3CC4F0]"
                            : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed",
                        )}
                        style={cur ? { background: customerAccentDark, borderColor: customerAccentDark } : undefined}>
                        <div>{lbl} {done ? "✓" : !allowed ? "🔒" : ""}</div>
                        <div className={cn("text-[10px] mt-0.5 font-semibold", cur ? "text-white/80" : "text-gray-400")}>{dateLblOf(s.week, s.day)}</div>
                      </button>
                    );
                  })}
                </div>

                {/* خانات اليوم — املأها بالترتيب؛ اضغط خانة مملوءة لإزالتها وتبديلها */}
                {selectedDay && (
                  <div className="flex gap-2 flex-wrap">
                    {slotChips.map((sc, i) => {
                      const active = !sc.item && sc.kind === pathKind && slotChips.findIndex((x) => !x.item && x.kind === sc.kind) === i;
                      return (
                        <button key={i}
                          onClick={() => {
                            if (sc.item) {
                              removeItem(sc.item._id, selectedWeek, selectedDay);
                              toast({ title: isRtl ? "أُزيلت — اختر بديلاً" : "Removed — pick another", description: isRtl ? sc.item.nameAr : (sc.item.nameEn || sc.item.nameAr) });
                              setPathKindSel(sc.kind);
                            } else setPathKindSel(sc.kind);
                          }}
                          className={cn(
                            "flex-1 min-w-[110px] rounded-2xl border-2 p-2.5 text-start transition-all",
                            active ? "shadow-sm"
                              : sc.item ? "border-emerald-200 bg-emerald-50/60"
                              : "border-gray-200 bg-white",
                          )}
                          style={active ? { borderColor: customerAccent, background: customerSoft } : undefined}>
                          <p className={cn("text-[10px] font-black", sc.item ? "text-emerald-600" : "text-gray-500")}>
                            {sc.kind === "main" ? "🍽️" : "🍎"} {sc.label} {sc.item && <Check className="inline h-3 w-3" />}
                          </p>
                          <p className={cn("text-[12px] font-black mt-0.5 leading-tight", !sc.item && "text-gray-300")} style={sc.item ? { color: customerInk } : undefined}>
                            {sc.item ? (isRtl ? sc.item.nameAr : (sc.item.nameEn || sc.item.nameAr)) : (isRtl ? "اضغط للاختيار" : "Tap to pick")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* حالة اليوم + إرشاد الاختيار */}
                {selectedDay && (
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[12px] font-bold" style={{ color: customerMuted }}>
                    <span>
                      {isRtl
                        ? `اختر ${pathKind === "snack" ? "سناك" : "وجبة"} ${curLbl} من القائمة بالأسفل — ${mainMealsToday}${hasMealLimit ? `/${mealsPerDay}` : ""} وجبة · ${snacksToday}${hasSnackLimit ? `/${snacksPerDay}` : ""} سناك`
                        : `Pick a ${pathKind === "snack" ? "snack" : "meal"} below — ${mainMealsToday}/${mealsPerDay} meals · ${snacksToday}/${snacksPerDay} snacks`}
                    </span>
                    {todayProgress?.complete && (
                      <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                        <Check className="h-3 w-3" /> {isRtl ? "اليوم مكتمل — ننقلك للتالي" : "Day complete"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })() : (<>
          {/* Week Tabs */}
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: customerMuted }}>{isRtl ? "اختر الأسبوع" : "Choose Week"}</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {weeks
                // ✅ لو للعميل اشتراك محدد، نعرض فقط الأسابيع الفعلية للاشتراك
                .filter((week) => !subscriptionWeeks || subscriptionWeeks.has(week.value))
                .map((week) => {
                // ✅ نعلّم الأسبوع المطابق لـ**دورة المطبخ الآن** (لا «أسبوع بدايتك» — كان
                //    يلخبط: الدورة تلفّ فيظهر رقم بداية أعلى من الأسبوع المفتوح فعلاً).
                const isCurrentCookWeek = Number(rotationInfo?.currentCookingWeek) === week.value;
                return (
                <button
                  key={week.value}
                  onClick={() => {
                    // 🔒 قفل تسلسلي: لا يقفز لأسبوع بعده قبل إكمال ما قبله
                    if (!isWeekAllowed(week.value)) {
                      toast({
                        title: isRtl ? "أكمل أيامك بالترتيب أولاً" : "Complete your days in order first",
                        description: isRtl ? "يجب إكمال الأسبوع السابق قبل فتح هذا الأسبوع." : "Finish the earlier week before opening this one.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSelectedWeek(week.value); setWeekTouched(true);
                    // ✅ عند فتح أسبوع: نضع العميل على **أول يوم ناقص فيه زمنياً** (بالتاريخ
                    //    الفعلي من orderedSubSlots، لا بترتيب أيام الأسبوع) — تبويب الدورة
                    //    الواحد قد يغطي فترتين في التقويم (أربعاء/خميس يوليو + سبت/أحد
                    //    أغسطس لما تلفّ الدورة)، فالترتيب بأيام الأسبوع كان يختار «السبت»
                    //    البعيد (15 أغسطس) بدل الأربعاء القريب (شكوى المستخدم).
                    //    🔒 ونحترم قفل الترتيب: لا نضعه أبداً على يوم لم يحن دوره بعد
                    //       (تبويب الدورة قد يضم أيام ذيل الاشتراك البعيدة — كانت
                    //       auto-select تتخطى القفل وتفتحها للإضافة، شكوى المستخدم).
                    //       لو كل أيامه المسموحة مكتملة → أول يوم مكتمل ليراجع اختياراته.
                    const blk = visibleBlockForWeek(week.value);
                    const nxtSlot = blk
                      ? (blk.slots.find((s) => !dayCompleteInWeek(week.value, s.day) && isSlotAllowed(week.value, s.day)) || blk.slots[0])
                      : null;
                    if (nxtSlot) setSelectedDay(nxtSlot.day);
                  }}
                  className={cn(
                    "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all flex items-center gap-1.5",
                    selectedWeek === week.value
                      ? "text-white shadow-md scale-105"
                      : isWeekAllowed(week.value)
                        ? "bg-white text-[#47759C] border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5"
                        : "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed" // 🔒 مقفول حتى يكمل ما قبله
                  )}
                  style={selectedWeek === week.value ? { background: customerAccent } : undefined}
                >
                  {week.label}
                  {!isWeekAllowed(week.value) && selectedWeek !== week.value && <span className="text-[11px]">🔒</span>}
                  {/* علامة الأسبوع المطابق لدورة المطبخ الحالية — يوضّح للعميل إن رقم
                      الأسبوع ده هو اللي المطبخ بيطبخه دلوقتي */}
                  {isCurrentCookWeek && (
                    <span className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                      selectedWeek === week.value ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700",
                    )}>
                      {isRtl ? "المطبخ الآن" : "cooking now"}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          </div>

          {/* Day Chips */}
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: customerMuted }}>{isRtl ? "اختر اليوم" : "Choose Day"}</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {days
                // ✅ نعرض أيام هذا الأسبوع الواقعة فعلاً داخل نافذة الاشتراك (من بكرة
                //    لنهايته). isSlotInSub مبنيّ على subscriptionSlots المضافة من ≥ بكرة
                //    فقط، فالأيام الماضية مستبعَدة تلقائياً — لا نحتاج فلتراً ثانياً.
                //    ⚠️ الفلتر القديم كان يستخدم slotBlockDate (أول ظهور للـ«أسبوع+يوم»)
                //       فلأسبوع دورة يتكرّر داخل الاشتراك يرجّع تاريخ البلوك الأول (ماضٍ)
                //       ويُخفي كل أيامه بالغلط — باگ اختفاء أيام الأسبوع 3 عند سلطان.
                // ✅ نعرض **كتلة الأسبوع الحالية فقط** (زمنية الترتيب) — لا أيام ذيل
                //    الاشتراك البعيدة (أغسطس) وسط أيامه الحالية. للزائر بلا اشتراك
                //    نرجع لكل أيام الأسبوع كما كانت.
                .filter((day) => {
                  const blk = visibleBlockForWeek(selectedWeek);
                  if (!blk) return isSlotInSub(selectedWeek, day.value);
                  return blk.slots.some((s) => s.day === day.value);
                })
                .sort((a, b) => {
                  const blk = visibleBlockForWeek(selectedWeek);
                  if (!blk) return 0;
                  const ia = blk.slots.findIndex((s) => s.day === a.value);
                  const ib = blk.slots.findIndex((s) => s.day === b.value);
                  return ia - ib;
                })
                .map((day) => {
                const prog = dayProgress(day.value);
                const isSel = selectedDay === day.value;
                // 📅 تاريخ التوصيل الفعلي لهذا اليوم = أقرب ظهور لـ(أسبوع+يوم) ≥ بكرة
                //    داخل الاشتراك (slotToDate) — لا أول ظهور مطلق (قد يكون ماضياً).
                const isoDate = slotToDate(startDate, startRotForSub, selectedWeek, day.value);
                const dateLbl = isoDate
                  ? (() => {
                      const dt = new Date(isoDate + "T00:00:00");
                      return `${dt.getDate()} ${AR_MONTHS[dt.getMonth()]}`;
                    })()
                  : null;
                return (
                  <button
                    key={day.value}
                    // يوم واحد مختار دائماً — إلغاء الاختيار كان يعيد العميل لرسالة "اختر اليوم أولاً"
                    onClick={() => {
                      // 🔒 قفل تسلسلي: يسمح بالأيام المكتملة + أول يوم ناقص، لا أبعد
                      if (!isSlotAllowed(selectedWeek, day.value)) {
                        toast({
                          title: isRtl ? "أكمل يومك الحالي أولاً" : "Complete your current day first",
                          description: isRtl ? "اختر وجبات الأيام بالترتيب قبل الانتقال إلى يوم لاحق." : "Fill your days in order before jumping ahead.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setSelectedDay(day.value);
                    }}
                    className={cn(
                      "px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all flex flex-col items-center leading-tight",
                      isSel
                        ? "text-white shadow-md"
                        : prog.complete
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : !isSlotAllowed(selectedWeek, day.value)
                            // 🔒 يوم لم يحن دوره بعد (ذيل الاشتراك) — باهت ومقفول بصرياً
                            ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5",
                    )}
                    style={isSel ? { background: customerAccent } : undefined}
                  >
                    <span className="flex items-center gap-1.5">
                      {day.label}
                      {!isSlotAllowed(selectedWeek, day.value) && !prog.complete && !isSel && <span className="text-[11px]">🔒</span>}
                      {/* ✓ لليوم المكتمل، أو عدّاد صغير لما اختار بعض الوجبات */}
                      {prog.complete ? (
                        <Check className={cn("h-3.5 w-3.5", isSel ? "text-white" : "text-emerald-600")} />
                      ) : prog.count > 0 ? (
                        <span
                          className={cn(
                            "text-[10px] font-black rounded-full px-1.5 leading-4",
                            isSel ? "bg-white/25 text-white" : "bg-[#3CC4F0]/15 text-[#0E76AC]",
                          )}
                        >
                          {prog.count}
                        </span>
                      ) : null}
                    </span>
                    {/* 📅 التاريخ الفعلي لليوم — يوم التوصيل */}
                    {dateLbl && (
                      <span className={cn(
                        "text-[10px] font-semibold mt-0.5",
                        isSel ? "text-white/80" : "text-gray-400",
                      )}>
                        {dateLbl}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Selection Counters */}
          {selectedDay && (
            <div className="rounded-2xl p-4"
              style={{
                background: customerSoft,
                border: `1.5px solid ${customerLine}`,
              }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: customerGradient }}>
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0891b2" }}>
                      {isRtl ? "اختياراتك لهذا اليوم" : "Today's Selection"}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: customerMuted }}>
                      {isRtl
                        ? `${days.find((d) => d.value === selectedDay)?.label} - الأسبوع ${selectedWeek}`
                        : `${days.find((d) => d.value === selectedDay)?.label} - Week ${selectedWeek}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Meals counter */}
                  <div className="rounded-xl px-3 py-2 bg-white"
                    style={{ border: `2px solid ${mainMealsToday >= mealsPerDay ? "#10b981" : customerAccent}` }}>
                    <p className="text-[10px] font-bold leading-none" style={{ color: customerMuted }}>{isRtl ? "الوجبات" : "Meals"}</p>
                    <p className="text-lg font-black tabular-nums leading-none mt-1"
                      style={{ color: mainMealsToday >= mealsPerDay ? "#10b981" : customerAccent }}>
                      {mainMealsToday}
                      {hasMealLimit && <span className="text-xs text-gray-400">/{mealsPerDay}</span>}
                    </p>
                  </div>
                  {/* Snacks counter */}
                  <div className="rounded-xl px-3 py-2 bg-white"
                    style={{ border: `2px solid ${snacksToday >= snacksPerDay ? "#10b981" : "#10b981"}` }}>
                    <p className="text-[10px] font-bold leading-none" style={{ color: customerMuted }}>{isRtl ? "السناك" : "Snacks"}</p>
                    <p className="text-lg font-black tabular-nums leading-none mt-1 text-emerald-600">
                      {snacksToday}
                      {hasSnackLimit && <span className="text-xs text-gray-400">/{snacksPerDay}</span>}
                    </p>
                  </div>
                  {/* Status pill + الخطوة التالية */}
                  {todayProgress?.complete && (
                    <>
                      <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {isRtl ? "مكتمل" : "Done"}
                      </span>
                      {/* لا نتركه في طريق مسدود — نوجّهه لليوم الناقص التالي */}
                      {(() => {
                        const nxt = nextIncompleteDay();
                        if (!nxt) return null;
                        const lbl = isRtl ? DAY_LABEL_AR[nxt.day] || nxt.day : nxt.day;
                        // ✅ لو الأسبوع مختلف نلحقه بالتسمية عشان العميل يعرف
                        const weekLbl = nxt.week !== selectedWeek
                          ? (isRtl ? ` (الأسبوع ${nxt.week})` : ` (Week ${nxt.week})`)
                          : "";
                        return (
                          <button
                            onClick={() => {
                              if (nxt.week !== selectedWeek) {
                                setSelectedWeek(nxt.week);
                                setWeekTouched(true);
                              }
                              setSelectedDay(nxt.day);
                            }}
                            className="text-[11px] font-black px-3 py-1.5 rounded-full bg-[#3CC4F0] text-white hover:brightness-95 transition"
                          >
                            {isRtl ? `التالي: ${lbl}${weekLbl} ←` : `Next: ${lbl}${weekLbl} →`}
                          </button>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          </>)}
        </div>
      </section>
      )}

      {/* Search & Filters */}
      <section className="bg-white border-b border-gray-100 sticky top-[73px] z-40 shadow-sm">
        <div className={cn("max-w-[1100px] mx-auto px-4", pathMode ? "py-3" : "py-4")}>
          {/* Search Bar */}
          <div className={cn("relative", pathMode ? "mb-0" : "mb-3 sm:mb-5")}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: customerMuted }} />
            <Input
              type="text"
              aria-label={isRtl ? 'البحث باسم الوجبة' : 'Search by meal name'}
              placeholder={isRtl ? "ابحث عن وجبة..." : "Search for a meal..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-12 pr-4 rounded-full border border-gray-200 focus:border-[#3CC4F0] text-base"
            />
          </div>

          {/* Category Filters — مخفية في مسار الأيام (الفلترة هناك بنوع الخانة النشطة) */}
          {!pathMode && (
          <div className="flex sm:flex-wrap sm:justify-center gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                aria-pressed={activeCategory === cat.id}
                className={cn(
                  "shrink-0 min-h-11 rounded-full border px-4 sm:px-5 py-1.5 text-[14px] sm:text-[15px] leading-5 transition-colors whitespace-nowrap",
                  activeCategory === cat.id
                    ? "font-black text-[#0E76AC] bg-[#EAF7FD]"
                    : "border-gray-200 font-medium text-[#6B7C8C] hover:border-[#3CC4F0]/60 bg-white"
                )}
                style={activeCategory === cat.id ? { borderColor: customerAccent } : undefined}
              >
                {isRtl ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>
          )}
          {/* زر العودة للواجهة الجديدة — يظهر في الكلاسيكية فقط ولمشترك له اشتراك مؤرَّخ */}
          {uiClassic && orderedSubSlots.length > 0 && (
            <div className="text-center mt-3">
              <button onClick={() => setUiMode(false)}
                className="text-xs font-black underline hover:opacity-80" style={{ color: customerAccentDark }}>
                ✨ {isRtl ? "جرّب الواجهة الجديدة (مسار الأيام)" : "Try the new day-path view"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Meals Grid */}
      <section className="py-5 md:py-8" style={{ background: "#EEF4F8" }}>
        <div className="menu-catalog-grid max-w-7xl mx-auto px-4">
          {meals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl" role="status" style={{ color: customerMuted }}>
                {searchQuery || activeCategory !== 'all'
                  ? (isRtl ? 'لا توجد وجبات مطابقة' : 'No matching meals')
                  : (isRtl ? "لا توجد وجبات متاحة" : "No meals available")}
              </p>
              {(searchQuery || activeCategory !== 'all') && <>
                <p className="mt-2 text-sm text-[#47759C]">{isRtl ? 'جرّب اسمًا آخر أو أزل فلتر البحث والتصنيف.' : 'Try another name or clear the search and category filter.'}</p>
                <Button variant="outline" className="mt-4 min-h-11 rounded-xl" onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}>{isRtl ? 'مسح البحث والتصنيف' : 'Clear search and category'}</Button>
              </>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {meals.map((meal: any) => {
                const hasConflict = !!avoidHitFor(meal);
                // السلطة سناك ⇒ تُقاس بحد السناكات. كانت تُقاس بحد الوجبات
                // الرئيسية (فرع else)، فتُقفل غلط أو تُفتح غلط.
                const atLimit = slotFull(meal.category, todayCounts, limits);
                return (
                <Card
                  key={meal._id}
                  className={cn(
                    "menu-meal-card group flex flex-col bg-white relative rounded-2xl p-2 shadow-none transition-colors duration-200 border",
                    hasConflict
                      ? "border-red-300 hover:border-red-400"
                      : "border-[#E4EEF6] hover:border-[#3CC4F0]/60"
                  )}
                >
                  <button type="button" className={isNutriReset ? 'absolute inset-0 z-10 rounded-2xl' : 'menu-card-details'}
                    onClick={() => setSelectedMeal(meal)} aria-label={`${isRtl ? 'تفاصيل' : 'Details:'} ${isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}`} />
                  {/* Meal Image — مربّعة بزوايا داخلية أصغر من زوايا البطاقة */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl" style={{ background: "#EAF3FB" }}>
                    {/* الشبكة قد تعرض عشرات الوجبات — لا تُحمَّل صورة قبل ظهورها */}
                    {meal.imageUrl ? <img
                      src={meal.imageUrl}
                      alt={isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[#47759C]"><UtensilsCrossed className="h-7 w-7" aria-hidden="true"/><span className="text-xs">{isRtl ? 'الصورة الجديدة قريبًا' : 'New photo coming soon'}</span></div>}

                    {/* Avoid conflict ribbon */}
                    {hasConflict && (
                      <div className="absolute top-0 inset-x-0 z-20 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-black text-white"
                        style={{ background: "linear-gradient(90deg, #ef4444, #f97316)" }}>
                        <AlertTriangle className="h-3 w-3" />
                        {isRtl ? "تحذير: قد تحتوي على ممنوعاتك" : "Warning: May contain restricted items"}
                      </div>
                    )}

                    {/* Calories Badge — كبسولة بيضاء في زاوية الصورة */}
                    <div className={cn("absolute top-2", isRtl ? "right-2" : "left-2", hasConflict && "top-9")}>
                      <span className="menu-calorie-badge inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11.5px] sm:text-[12px] font-black text-[#0E76AC]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {!isNutriReset && <Flame className="h-4 w-4" aria-hidden="true" />}
                        {nutritionFor(meal).calories}
                        <span className="font-semibold text-[#47759C]">{isRtl ? "سعرة" : "kcal"}</span>
                      </span>
                    </div>
                  </div>

                  <CardContent className="px-1.5 pt-2.5 pb-1.5 sm:px-3 sm:pt-3.5 sm:pb-2.5 flex flex-col flex-1 gap-2 sm:gap-3">
                    <div>
                      {/* Meal Name */}
                      <h3 className="text-[14px] sm:text-[16px] font-black text-[#0E2A4A] min-h-[3.25rem] leading-relaxed">
                        {isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                      </h3>
                      {/* التصنيف + الوسوم: سطر واحد هادئ بدل الشارات الملوّنة */}
                      <p className="mt-0.5 sm:mt-1 text-[10.5px] sm:text-[11px] font-bold text-[#0E76AC] line-clamp-1">
                        {customerCategoryLabel(meal.category, isRtl)}
                        {isNutriReset && meal.tags && meal.tags.length > 0 && (
                          <span className="hidden sm:inline"> · {meal.tags.slice(0, 2).map((tag: string) => tagLabel(tag, isRtl)).join(" · ")}</span>
                        )}
                      </p>
                    </div>

                    {/* Macros — ثلاثة أرقام نصية بلا صناديق ملوّنة */}
                    <div className="menu-macros grid grid-cols-3 gap-1 rounded-xl bg-[#EAF7FD] px-2 py-3">
                      {[
                        [nutritionFor(meal).protein, isRtl ? "بروتين" : "PROTEIN"],
                        [nutritionFor(meal).carbs, isRtl ? "كارب" : "CARBS"],
                        [nutritionFor(meal).fats, isRtl ? "دهون" : "FAT"],
                      ].map(([v, l], mi) => (
                        <div key={mi} className="flex flex-col gap-1 leading-none">
                          <span className="text-[14px] sm:text-base font-black text-[#0E76AC]" style={{ fontVariantNumeric: "tabular-nums" }}>{v as number}g</span>
                          <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.08em] text-[#47759C]">{l as string}</span>
                        </div>
                      ))}
                    </div>

                    {/* Footer — button (no price, included in subscription) */}
                    <div className="menu-card-actions relative z-20 flex items-center justify-between mt-auto pt-1">
                      {/* «ضمن اشتراكك» يُخفى على الموبايل لإفساح مكان للزر */}
                      <span className={cn('text-[11px] font-semibold text-[#47759C]', isVisitor ? 'hidden' : 'hidden sm:inline')}>
                        {isRtl ? "ضمن اشتراكك" : "In your plan"}
                      </span>
                      {isVisitor && !isNutriReset ? (
                        <Button variant="ghost" onClick={() => setSelectedMeal(meal)} className="w-full min-h-11 rounded-xl text-[#0E76AC] font-bold">{isRtl ? 'تفاصيل الوجبة' : 'Meal details'}</Button>
                      ) : isVisitor ? (
                        // Browse mode: replace add button with subscribe CTA
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e?.stopPropagation();
                            const msg = isRtl
                              ? `مرحباً 👋\nأرغب في الاشتراك في ${restaurant.nameAr}.\nأعجبتني وجبة: ${meal.nameAr}`
                              : `Hello 👋\nI'd like to subscribe to ${restaurant.nameEn}.\nI like this meal: ${meal.nameEn || meal.nameAr}`;
                            openExternal(whatsappLink(msg));
                          }}
                          className="min-h-11 px-3.5 sm:px-4 rounded-full font-bold text-white flex items-center gap-1.5 w-full sm:w-auto"
                          style={{ background: "#25D366" }}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {isRtl ? "اشترك" : "Subscribe"}
                        </Button>
                      ) : itemCount(meal._id) > 0 ? (
                        // ✅ عدّاد — يسمح باختيار نفس الوجبة أكثر من مرة (السقف زيّه)
                        <div className="flex items-center justify-between sm:justify-center gap-1.5 rounded-full bg-[#0E76AC] text-white px-1.5 min-h-11 w-full sm:w-auto">
                          <button
                            onClick={(e) => { e?.stopPropagation(); removeItem(meal._id, selectedWeek, selectedDay!); }}
                            title={isRtl ? "إنقاص" : "Remove one"}
                            className="h-11 w-11 grid place-items-center rounded-full hover:bg-white/25 transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-5 text-center text-sm font-black tabular-nums">{itemCount(meal._id)}</span>
                          <button
                            onClick={(e) => handleAddToCart(meal, e)}
                            disabled={atLimit}
                            title={atLimit ? (isRtl ? "اكتمل عدد اليوم" : "Day is full") : (isRtl ? "إضافة مرة أخرى" : "Add another")}
                            className="h-11 w-11 grid place-items-center rounded-full hover:bg-white/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => handleAddToCart(meal, e)}
                          disabled={!selectedDay || atLimit || noMealPlan}
                          className={cn(
                            "min-h-11 px-5 rounded-full font-bold transition-colors w-full sm:w-auto",
                            (atLimit || noMealPlan)
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : hasConflict
                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                : "bg-[#3CC4F0] hover:bg-[#0E76AC] text-white"
                          )}
                        >
                          {atLimit ? (
                            <>{isRtl ? "ممتلئ" : "Full"}</>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              {isRtl ? "أضف" : "Add"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
      </section>

      {/* Meal Details Modal */}
      <Dialog open={!!selectedMeal} onOpenChange={() => setSelectedMeal(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] sm:rounded-[28px] p-4 sm:p-6" dir={dir}>
          {selectedMeal && (
            <div className="space-y-5">
              {/* Image — أولاً كما في بطاقة الطبق، بزوايا داخلية وشارة سعرات سماوية */}
              <div className="relative w-full aspect-[16/10] rounded-[18px] sm:rounded-[20px] overflow-hidden" style={{ background: "#EAF3FB" }}>
                {selectedMeal.imageUrl ? <img
                  src={selectedMeal.imageUrl}
                  alt={isRtl ? selectedMeal.nameAr : selectedMeal.nameEn}
                  className="w-full h-full object-contain"
                /> : <div className="flex h-full items-center justify-center text-[#47759C]">{isRtl ? 'الصورة الجديدة قريبًا' : 'New photo coming soon'}</div>}
                {/* الشارة أسفل الصورة — زر الإغلاق × يسكن الزاوية العليا */}
                <span className={cn("absolute bottom-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-black text-[#0E76AC]", isRtl ? "right-3" : "left-3")}
                  style={{ fontVariantNumeric: "tabular-nums", boxShadow: "0 1px 3px rgba(14,42,74,0.12)" }}>
                  {nutritionFor(selectedMeal).calories}
                  <span className="font-semibold text-[#47759C]">{isRtl ? "سعرة" : "kcal"}</span>
                </span>
              </div>

              {/* Header */}
              <DialogHeader className="space-y-1 text-start">
                <p className="text-[12px] font-bold text-[#0E76AC]">
                  {customerCategoryLabel(selectedMeal.category, isRtl)}
                  {selectedMeal.tags?.length > 0 && (
                    <span className="font-semibold text-[#6B7C8C]"> · {selectedMeal.tags.map((tag: string) => tagLabel(tag, isRtl)).join(" · ")}</span>
                  )}
                </p>
                <DialogTitle className="text-[22px] sm:text-2xl font-black text-[#0E2A4A] leading-tight" style={{ fontFamily: "'Cairo',sans-serif" }}>
                  {isRtl ? selectedMeal.nameAr : selectedMeal.nameEn || selectedMeal.nameAr}
                </DialogTitle>
                {selectedMeal.nameEn && isRtl && (
                  <p className="text-sm text-[#6B7C8C]">{selectedMeal.nameEn}</p>
                )}
              </DialogHeader>

              {/* Description — يُجلب عند الفتح. نحجز المكان أثناء التحميل حتى لا يقفز التخطيط */}
              {(aboutLoading || aboutText) && (
                <div>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-[#47759C] mb-1.5">
                    {isRtl ? "الوصف" : "DESCRIPTION"}
                  </h3>
                  {aboutLoading ? (
                    <div className="space-y-2 animate-pulse" aria-hidden="true">
                      <div className="h-3.5 rounded bg-[#EAF3FB] w-full" />
                      <div className="h-3.5 rounded bg-[#EAF3FB] w-11/12" />
                      <div className="h-3.5 rounded bg-[#EAF3FB] w-2/3" />
                    </div>
                  ) : (
                    <p className="text-[15px] text-[#3D4F5C] leading-relaxed">{aboutText}</p>
                  )}
                </div>
              )}

              {/* Macros — أربع خانات بيضاء بحدّ رفيع، أرقام كبيرة كحلية بلا نقاط ملوّنة */}
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.08em] text-[#47759C] mb-2">
                  {isRtl ? "القيم الغذائية" : "NUTRITION"}
                </h3>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    [nutritionFor(selectedMeal).calories, "", isRtl ? "سعرة" : "kcal"],
                    [nutritionFor(selectedMeal).protein, "g", isRtl ? "بروتين" : "Protein"],
                    [nutritionFor(selectedMeal).carbs, "g", isRtl ? "كارب" : "Carbs"],
                    [nutritionFor(selectedMeal).fats, "g", isRtl ? "دهون" : "Fat"],
                  ].map(([v, u, l], mi) => (
                    <div key={mi} className="rounded-2xl bg-white px-2 py-3 sm:py-4 text-center" style={{ border: "1px solid #E4EEF6" }}>
                      <p className={cn("font-black text-[#0E2A4A] leading-none", mi === 0 ? "text-[20px] sm:text-2xl" : "text-[18px] sm:text-2xl")} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {v as number}<span className="text-[12px] sm:text-sm font-bold text-[#47759C]">{u as string}</span>
                      </p>
                      <p className="mt-1.5 text-[10.5px] sm:text-xs font-semibold text-[#47759C]">{l as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ingredients — كبسولات هادئة بدل قائمة نقاط */}
              {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-[#47759C] mb-2">
                    {isRtl ? "المكونات" : "INGREDIENTS"}
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedMeal.ingredients.map((ingredient: string, idx: number) => (
                      <li key={idx} className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-[#0E2A4A]" style={{ background: "#EEF4F8" }}>
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Info & CTA (no price — included in subscription) */}
              {isVisitor && !isNutriReset ? <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E4EEF6]">
                <p className="text-sm text-[#47759C]">{isRtl ? 'اختيار الوجبات متاح للمشتركين.' : 'Meal selection is available to subscribers.'}</p>
                <Button onClick={handleSignupViaWhatsApp} className="min-h-11 rounded-xl bg-[#0E76AC] text-white">{isRtl ? 'تواصل للاشتراك' : 'Enquire about subscriptions'}</Button>
              </div> : <div className="flex items-center justify-between gap-3 pt-4" style={{ borderTop: "1px solid #E4EEF6" }}>
                <span className="text-[12px] font-semibold text-[#6B7C8C]">
                  {isRtl ? "ضمن اشتراكك" : "Included in your plan"}
                </span>
                <Button
                  onClick={(e) => {
                    handleAddToCart(selectedMeal, e);
                    setSelectedMeal(null);
                  }}
                  disabled={isInCart(selectedMeal._id) || !selectedDay}
                  className={cn(
                    "h-11 sm:h-12 px-7 sm:px-8 rounded-full font-black shadow-none",
                    isInCart(selectedMeal._id)
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-[#3CC4F0] hover:bg-[#47759C] text-white"
                  )}
                >
                  {isInCart(selectedMeal._id) ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      {isRtl ? "تم الإضافة" : "Already Added"}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      {isRtl ? "إضافة للسلة" : "Add to Cart"}
                    </>
                  )}
                </Button>
              </div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Floating Cart Button */}
      {!isVisitor && getTotalMeals() > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <Button
            onClick={() => setLocation(restaurant.reviewPath)}
            className="h-14 px-8 rounded-full text-white font-bold shadow-2xl flex items-center gap-3"
            style={{ background: customerGradient }}
          >
            <ShoppingCart className="h-5 w-5" />
            <span>{isRtl ? "مراجعة الطلب" : "Review Order"}</span>
            <div className="bg-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold" style={{ color: customerAccent }}>
              {getTotalMeals()}
            </div>
          </Button>
        </div>
      )}
      </div>
    </PublicLayout>
  );
}
