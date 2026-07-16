/**
 * @file SmartPlan.tsx
 * @description مولّد الوجبات الذكي (المرحلة 1) — واجهة العميل
 *  مدخلان: مسجّل دخول (تلقائي) أو رقم تليفون (بدون تسجيل).
 */
import { useState, useMemo } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Sparkles, AlertTriangle } from "lucide-react";
import { getVerifiedPhone, saveVerifiedPhone } from "@/lib/customerIdentity";
import { subscriptionState } from "@/lib/subscription";
import { mealScheduledFor, localISO } from "@/lib/mealSchedule";
import { SubscriptionExpiredNotice } from "@/components/public/SubscriptionExpiredNotice";

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const WEEKDAYS_AR: Record<string,string> = {
  saturday:"السبت", sunday:"الأحد", monday:"الإثنين", tuesday:"الثلاثاء",
  wednesday:"الأربعاء", thursday:"الخميس", friday:"الجمعة",
};
const WEEKDAYS_EN: Record<string,string> = {
  saturday:"Saturday", sunday:"Sunday", monday:"Monday", tuesday:"Tuesday",
  wednesday:"Wednesday", thursday:"Thursday", friday:"Friday",
};
const CAT_AR: Record<string,string> = {
  breakfast:"فطور", lunch:"غداء", dinner:"عشاء", snack:"سناك", salad:"سلطة",
};

const B = {
  brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A",
  ink2: "#2D4A67", line: "#D9E6F1", surf: "#F7FBFE", bg2: "#EAF3FB",
};

export default function SmartPlan() {
  const { language, dir } = useLanguage();
  useSeo({ title: "خطتي الذكية | أدرينالين للوجبات الصحية", description: "خطة وجبات تُبنى وفق هدفك وسعراتك المستهدفة، مع استبعاد ما لديك من حساسية وما لا تفضّله — ويراجعها أخصائي التغذية قبل اعتمادها.", path: "/customer/smart-plan" });
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);
  const dayName = (d: string) => isRtl ? (WEEKDAYS_AR[d] || d) : (WEEKDAYS_EN[d] || d);

  const { currentCustomer } = useStore();
  const generate = useAction(api.ai.generateSmartPlan);
  const generateWeekly = useAction((api.ai as any).generateWeeklyPlan);
  const createOrder = useMutation(api.customerOrders.create);
  const bestSellers = useQuery((api.publicMeals as any).bestSellers, { limit: 4 }) || [];

  const [mode, setMode] = useState<"day" | "week">("day");
  // ✅ الرقم اللي أدخله العميل في المنيو — لا نسأله عنه مرة ثانية
  const [phone, setPhone] = useState<string>(() => getVerifiedPhone());
  const [changingPhone, setChangingPhone] = useState(false);

  // ✅ توليد متعدد الأسابيع: عدد الأسابيع + أسبوع الدورة الذي يبدأ منه.
  //    0 = لم تلمسه الأخصائية بعد ⇒ نستخدم الاقتراح التلقائي.
  const [weeksSel, setWeeksSel] = useState(0);
  const [startRot, setStartRot] = useState(0);

  /**
   * ✅ نجلب المشترك بالرقم كما تفعل صفحة الطلب اليدوي.
   * بدونه كان الطلب يُسجَّل باسم "AI customer" حرفياً وبلا customerId،
   * فيصل للأخصائية مجهولاً وغير مرتبط باشتراك.
   */
  const matchesByPhone = useQuery(
    api.customers.findPublicByPhone,
    !currentCustomer && phone.trim().length >= 6 ? { phone: phone.trim() } : "skip",
  ) as any[] | undefined;
  const matchedCustomer = matchesByPhone?.[0] ?? null;

  // ✅ اقتراحات التوليد (عدد الأسابيع + دورة المطبخ الحالية) — بلا تكلفة AI.
  const suggestions = useQuery(
    (api.ai as any).getPlanSuggestions,
    currentCustomer?.customerId
      ? { customerId: currentCustomer.customerId as any }
      : phone.trim().length >= 6
        ? { phone: phone.trim() }
        : "skip",
  ) as any;

  // ✅ تاريخ بداية الاشتراك (من الحساب أو من الرقم) — منه نشتق دورة البداية
  //    بنفس منطق المنيو اليدوي (rotationWeekAt)، بدل «دورة المطبخ الآن».
  const subStartDate: string | null =
    (matchedCustomer as any)?.startDate || suggestions?.startDate || null;
  const subEndDate: string | null =
    (matchedCustomer as any)?.endDate || suggestions?.endDate || null;

  const startRotInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    subStartDate ? { targetDate: subStartDate } : "skip",
  ) as { rotationWeek: number; currentCookingWeek: number } | undefined;

  // ✅ حساب أسابيع الاشتراك المتبقية من تاريخ البداية حتى تاريخ النهاية.
  //    الجمعة إجازة، فنعدّ أيام التوصيل (السبت→الخميس) ونقسم على 6.
  //    نحدد بها effWeeks عشان ما نولّدش خطة بعد انتهاء الاشتراك.
  const subWeeksRemaining = useMemo(() => {
    if (!subStartDate || !subEndDate) return null;
    const start = new Date(subStartDate + "T00:00:00");
    const end = new Date(subEndDate + "T00:00:00");
    if (end.getTime() < start.getTime()) return 0;
    const cur = new Date(start);
    let delivDays = 0;
    for (let g = 0; g < 400 && cur.getTime() <= end.getTime(); g++) {
      if (cur.getDay() !== 5) delivDays++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, Math.min(4, Math.ceil(delivDays / 6)));
  }, [subStartDate, subEndDate]);

  // القيم الفعّالة: ما اختارته الأخصائية، وإلا المشتقّ من تاريخ الاشتراك،
  // وإلا اقتراح المطبخ، وإلا 1. ✅ نحدد الحد الأعلى بأسابيع الاشتراك المتبقية.
  const rawEffWeeks = weeksSel || suggestions?.suggestedWeeks || 1;
  const effWeeks = subWeeksRemaining ? Math.min(rawEffWeeks, subWeeksRemaining) : rawEffWeeks;
  const effStartRot =
    startRot || startRotInfo?.rotationWeek || suggestions?.currentRotationWeek || 1;

  /** اسم المشترك للعرض — من الحساب أو من مطابقة الرقم. فارغ = زائر لم يعرّف نفسه. */
  const whoName: string = currentCustomer?.fullName || matchedCustomer?.fullName || "";

  /** عدد وجبات/سناكات الاشتراك — نفس ما يعرضه المنيو اليدوي في ترويسته،
   *  وهما اللي الخادم يبني عليهما الخطة (profile.mealsPerDay/snacksPerDay). */
  const subMeals: number | null = (matchedCustomer as any)?.mealsPerDay ?? null;
  const subSnacks: number = Number((matchedCustomer as any)?.snacksPerDay || 0);
  /** الممنوعات والحساسية — نفس ما يعرضه المنيو اليدوي في شريطه البارز. */
  const subAllergies: string = String((matchedCustomer as any)?.allergies || "").trim();
  const subAvoid: string = String((matchedCustomer as any)?.avoid || "").trim();

  /* ⛔ اشتراك منتهٍ: كان النظام يعامله كسارٍ ويبني خطة لأيام لن تُوصَّل.
        (subWeeksRemaining كانت تقارن النهاية بالبداية لا باليوم، فلم تكشفه.)
        الآن نوقف البناء ونوجّهه للتجديد. */
  const subState = useMemo(() => subscriptionState(subEndDate), [subEndDate]);
  const subExpired = subState.status === "expired";

  /** الاسم والرقم والاشتراك المرسلة مع الطلب — من الحساب، أو من الرقم، وإلا مجهول. */
  const orderIdentity = () => ({
    customerName:
      currentCustomer?.fullName || matchedCustomer?.fullName || "عميل غير مسجّل",
    customerPhone: currentCustomer?.phone || phone.trim() || "—",
    customerId: ((currentCustomer?.customerId as any) || (matchedCustomer?._id as any)) || undefined,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);   // خطة اليوم
  const [weekly, setWeekly] = useState<any>(null);    // خطة الأسبوع
  const [error, setError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderNo, setOrderNo] = useState("");

  // 🔁 تبديل وجبة داخل الخطة قبل إرسالها للمراجعة.
  //    البدائل = وجبات نفس اليوم/دورة المطبخ فقط (لا كل وجبات المطعم).
  const allMeals: any[] = (useQuery(api.publicMeals.listMeals, {}) as any[]) || [];
  const [swap, setSwap] = useState<any>(null); // {src:"weekly"|"day", di?, i, week, day, meal}
  // الوجبة تظهر فقط لو **مجدولة صراحةً** لهذا (الأسبوع + اليوم) — نفس حكم
  //    المنيو اليدوي وai.matchesToday، من lib/mealSchedule.ts.
  const mealAvailable = mealScheduledFor;
  const toPick = (m: any) => ({
    id: m._id, nameAr: m.nameAr, nameEn: m.nameEn, calories: m.calories,
    protein: m.protein, carbs: m.carbs, fats: m.fats, category: m.category,
    imageUrl: m.imageUrl, priceQAR: m.priceQAR || 0,
  });
  const applySwap = (m: any) => {
    if (!swap) return;
    const pick = toPick(m);
    if (swap.src === "weekly") {
      setWeekly((w: any) => {
        const days = w.days.slice();
        const d = { ...days[swap.di] };
        const picks = d.picks.slice();
        picks[swap.i] = pick;
        d.picks = picks;
        days[swap.di] = d;
        return { ...w, days };
      });
    } else {
      setResult((r: any) => {
        const picks = r.picks.slice();
        picks[swap.i] = pick;
        return { ...r, picks };
      });
    }
    setSwap(null);
  };

  // إرسال خطة الأسبوع كاملة للمراجعة (كل الأيام في طلب واحد)
  const placeWeeklyOrder = async () => {
    if (!weekly?.days?.length || ordering) return;
    setOrdering(true); setError("");
    try {
      const items: any[] = [];
      for (const d of weekly.days) {
        for (const m of (d.picks || [])) {
          items.push({
            mealId: m.id, mealNameAr: m.nameAr, mealNameEn: m.nameEn || undefined,
            calories: m.calories, protein: m.protein, carbs: m.carbs, fats: m.fats,
            category: m.category, imageUrl: m.imageUrl || undefined,
            priceQAR: m.priceQAR || 0, week: d.rotationWeek || 1, day: d.day,
          });
        }
      }
      if (!items.length) { setError(t("لا توجد وجبات في الخطة.", "No meals in the plan.")); setOrdering(false); return; }
      // 🔒 نبعت IDs فقط — الأسعار والسعرات محسوبة على الخادم
      const idem = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res: any = await createOrder({
        ...orderIdentity(),
        items: items.map((i: any) => ({ mealId: i.mealId, week: i.week, day: i.day })),
        notes: "Weekly plan from the smart meal generator",
        idempotencyKey: idem,
      });
      setOrderNo(res?.orderNumber || t("تم", "Done"));
    } catch (e) {
      setError(t("تعذّر إنشاء الطلب، يُرجى المحاولة مرة أخرى.", "Could not create the order, please try again."));
    } finally { setOrdering(false); }
  };

  const placeOrder = async () => {
    if (!result?.picks?.length || ordering) return;
    setOrdering(true); setError("");
    try {
      const day = result?.meta?.day || WEEKDAYS[new Date().getDay()];
      const week = result?.meta?.rotationWeek || 1;
      // 🔒 نبعت IDs فقط
      const items = result.picks.map((m: any) => ({ mealId: m.id, week, day }));
      const idem = `sp_daily_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res: any = await createOrder({
        ...orderIdentity(),
        items,
        notes: "Order from the smart meal generator",
        idempotencyKey: idem,
      });
      setOrderNo(res?.orderNumber || t("تم", "Done"));
    } catch (e) {
      setError(t("تعذّر إنشاء الطلب، يُرجى المحاولة مرة أخرى.", "Could not create the order, please try again."));
    } finally { setOrdering(false); }
  };

  const loggedInId = currentCustomer?.customerId;

  const run = async (useLogin: boolean) => {
    setError(""); setResult(null); setWeekly(null); setOrderNo(""); setLoading(true);
    const source = useLogin ? { customerId: loggedInId as any } : { phone: phone.trim() };
    try {
      // 🔒 التوليد الأسبوعي يستلزم جلسة (منع استنزاف رصيد AI من الزوار)
      const sessionToken = useStore.getState().sessionToken || undefined;
      if (mode === "week") {
        if (!sessionToken) {
          setError(t("يُرجى تسجيل الدخول أولاً لإنشاء خطة أسبوعية.", "Please log in to generate a weekly plan."));
          return;
        }
        // ✅ نقطة البداية = ماكس(بداية الاشتراك، بكرة):
        //   - لو الاشتراك بيبدأ في المستقبل → من تاريخ بدايته.
        //   - لو الاشتراك بدأ فعلاً → من بكرة (اليوم انقضى ميعاد تحضيره).
        //   ⚠️ نستخدم تنسيق تاريخ محلي (مش toISOString) لأن UTC ممكن يرجّع
        //     تاريخ اليوم السابق في المناطق ذات UTC+ (قطر UTC+3).
        const _tom = new Date(); _tom.setHours(0, 0, 0, 0); _tom.setDate(_tom.getDate() + 1);
        const tomorrowISO = localISO(_tom);
        const effStartDate =
          subStartDate && subStartDate > tomorrowISO
            ? subStartDate
            : tomorrowISO;
        const res: any = await generateWeekly({
          ...source,
          weeks: effWeeks,
          startRotationWeek: effStartRot,
          startDate: effStartDate,
          endDate: subEndDate || undefined, // ✅ يقطع التوليد عند نهاية الاشتراك
          sessionToken,
        });
        if (!res.ok) { setError(t("لا توجد وجبات مجدولة لهذه الأسابيع.", "No meals scheduled for these weeks.")); }
        else setWeekly(res);
      } else {
        // ✅ نبعت targetDate = بكرة (بالتوقيت المحلي) — عشان النظام يقترح خطة
        //     ليوم غد اللي فعلاً هيوصله، مش يوم النهاردة (اللي انقضى ميعاده).
        const _tom = new Date(); _tom.setHours(0, 0, 0, 0); _tom.setDate(_tom.getDate() + 1);
        const targetDate = localISO(_tom);
        const res: any = await generate({ ...source, targetDate, sessionToken });
        if (!res.ok) { setError(res.error || t("تعذّر إنشاء الخطة", "Could not generate the plan")); }
        else setResult(res);
      }
    } catch (e: any) {
      setError(t("حدث خطأ أثناء الإنشاء، يُرجى المحاولة مرة أخرى.", "An error occurred while generating, please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <PageHeader
        eyebrowAr="مدعوم بالذكاء الاصطناعي" eyebrowEn="AI-POWERED"
        icon={<Sparkles className="w-3.5 h-3.5" style={{ color: "#3AC7F4" }} />}
        titleAr="خطة وجباتك الذكية" titleEn="Your Smart Meal Plan"
        subtitleAr="اختر خطة يوم أو أسبوع — تُختار وجباتك من المتاح وفق هدفك وتفضيلاتك، ويعتمدها أخصائي التغذية."
        subtitleEn="Pick a daily or weekly plan — we choose from available meals by your goal and preferences."
      />
      <div dir={isRtl ? "rtl" : "ltr"} style={{ maxWidth: 980, margin: "0 auto", padding: "32px 18px" }}>
        {/* Entry */}
        <div style={{
          background: "#fff", border: `1px solid ${B.line}`, borderRadius: 18,
          padding: 24, marginBottom: 26, boxShadow: "0 10px 30px -18px rgba(14,42,74,.25)",
        }}>
          {/* ✅ بطاقة «مَن أنت واشتراكك» — كانت داخل وضع الأسبوع فقط، والصفحة
              تفتح على وضع اليوم، فالداخل أول مرة ما كان يشوف اسمه ولا اشتراكه
              ولا يفهم على أي أساس تُبنى الخطة. الآن تظهر في الوضعين. */}
          {(whoName || subStartDate) && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
              padding: "12px 14px", borderRadius: 12, marginBottom: 14,
              background: "#F2FBFF", border: `1px solid ${B.line}`,
            }}>
              {whoName && (
                <span style={{ fontWeight: 900, color: B.ink, fontSize: 14 }}>👤 {whoName}</span>
              )}
              {/* ✅ عدد الوجبات والسناكات — المنيو اليدوي بيعرضهم في ترويسته
                  ("4 وجبات + 2 سناك يومياً")، وهما اللي الخطة تُبنى عليهم فعلاً،
                  فلازم يبانوا هنا كمان. */}
              {subMeals != null && (
                <span style={{ ...pill, background: "#0E2A4A", color: "#fff", border: "none" }}>
                  {t(
                    `${subMeals} ${subMeals === 2 ? "وجبتان" : subMeals === 1 ? "وجبة" : "وجبات"}${subSnacks ? ` + ${subSnacks} ${subSnacks === 2 ? "سناك" : "سناك"}` : ""} يومياً`,
                    `${subMeals} meal${subMeals === 1 ? "" : "s"}${subSnacks ? ` + ${subSnacks} snack${subSnacks === 1 ? "" : "s"}` : ""} daily`,
                  )}
                </span>
              )}
              {subStartDate && <span style={pill}>{t("يبدأ", "Starts")}: {subStartDate}</span>}
              {subEndDate && <span style={pill}>{t("ينتهي", "Ends")}: {subEndDate}</span>}
              {suggestions?.durationWeeks && (
                <span style={pill}>{t(`المدة: ${suggestions.durationWeeks} أسابيع`, `${suggestions.durationWeeks} weeks`)}</span>
              )}
              {startRotInfo?.rotationWeek && (
                <span style={{ ...pill, background: "#0E76AC", color: "#fff", border: "none" }}>
                  {t(`دورة المطبخ لاشتراكك: ${startRotInfo.rotationWeek}`, `Your rotation: ${startRotInfo.rotationWeek}`)}
                </span>
              )}
            </div>
          )}

          {/* ⚠️ الممنوعات والحساسية — الخطة تُبنى باستبعادها فعلاً (ai.isBlocked)،
              والمنيو اليدوي بيعرضها في شريط بارز. كانت الذكية تقول "نستبعد
              حساسيتك" في الشرح بلا ما تُظهرها، فما كانش المشترك يقدر يتأكد
              إن المسجّل عند الأخصائية صحيح. */}
          {(subAllergies || subAvoid) && !subExpired && (
            <div style={{
              display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14,
              padding: "11px 13px", borderRadius: 12,
              background: "linear-gradient(135deg,#fef2f2,#fff5f5)", border: "1.5px solid #fecaca",
            }}>
              <AlertTriangle style={{ width: 17, height: 17, color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, color: "#dc2626", marginBottom: 3, letterSpacing: ".02em" }}>
                  {t("تنبيه: ممنوعات وحساسية", "Allergies & Restrictions")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12 }}>
                  {subAllergies && (
                    <span style={{ fontWeight: 600, color: "#991b1b" }}>
                      <b style={{ fontWeight: 900 }}>{t("حساسية: ", "Allergy: ")}</b>{subAllergies}
                    </span>
                  )}
                  {subAvoid && (
                    <span style={{ fontWeight: 600, color: "#9a3412" }}>
                      <b style={{ fontWeight: 900 }}>{t("ممنوع: ", "Avoid: ")}</b>{subAvoid}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ⛔ اشتراك منتهٍ ⇒ إشعار التجديد بدل أدوات البناء — لا معنى لبناء
              خطة لأيام لن تُوصَّل. */}
          {subExpired && subState.status === "expired" && (
            <SubscriptionExpiredNotice
              name={whoName || undefined}
              endDate={subState.endDate}
              daysAgo={subState.daysAgo}
              isRtl={isRtl}
            />
          )}

          {!subExpired && <>
          {/* ✅ شرح آلية التوليد — الخطوات الفعلية اللي بيعملها النظام، بلا وعود
              زيادة: الملف الشخصي ← استبعاد الممنوعات ← وجبات دورتك ← مراجعة الأخصائي. */}
          <details style={{
            marginBottom: 16, borderRadius: 12, border: `1px solid ${B.line}`,
            background: "#fff", overflow: "hidden",
          }}>
            <summary style={{
              cursor: "pointer", padding: "11px 14px", fontWeight: 900, fontSize: 13,
              color: B.ink, listStyle: "none", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: B.accent }}>ℹ️</span>
              {t("كيف تُبنى خطتك؟", "How is your plan built?")}
            </summary>
            <ol style={{ margin: 0, padding: "0 34px 14px", fontSize: 12.5, color: B.ink2, lineHeight: 2, fontWeight: 600 }}>
              <li>{t("نطّلع على ملفك الغذائي: هدفك والسعرات المناسبة له.", "We read your profile: your goal and its calorie target.")}</li>
              <li>{t("نستبعد ما لديك من حساسية والأصناف التي لا تفضّلها.", "We exclude your allergies and the items you don't prefer.")}</li>
              <li>{t("نختار من وجبات المطبخ المقرّرة في دورة اشتراكك لذلك اليوم — لا من المنيو كاملاً.", "We select from the kitchen's scheduled meals for your rotation on that day — not from the entire menu.")}</li>
              <li>{t("يراجع أخصائي التغذية الخطة قبل اعتمادها.", "The nutritionist reviews the plan before approving it.")}</li>
            </ol>
          </details>

          {/* Day / Week toggle */}
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: B.ink2 }}>
            {t(
              "اختر المدى: خطة يوم واحد للاطّلاع السريع، أو خطة أسبوعية تغطّي مدة اشتراكك.",
              "Choose the range: a single-day plan for a quick look, or a weekly plan covering your subscription.",
            )}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([
              { k: "day", label: t("خطة اليوم", "Daily plan"), emoji: "📅 " },
              { k: "week", label: t("خطة الأسبوع", "Weekly plan"), emoji: "🗓️ " },
            ] as const).map((m) => (
              <button key={m.k} onClick={() => { setMode(m.k); setResult(null); setWeekly(null); setOrderNo(""); }}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  fontFamily: "'Cairo',sans-serif", fontSize: 14, fontWeight: 800,
                  border: `1.5px solid ${mode === m.k ? B.accent : B.line}`,
                  background: mode === m.k ? B.accent : "#fff",
                  color: mode === m.k ? "#fff" : B.ink2,
                }}>
                {m.emoji}{m.label}
              </button>
            ))}
          </div>

          {/* ✅ ضبط التوليد المتعدد — يظهر في وضع الأسبوع فقط */}
          {mode === "week" && (
            <div style={{
              display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16,
              padding: 14, borderRadius: 12, background: "#F2FBFF", border: `1px solid ${B.line}`,
            }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: B.ink2, display: "block", marginBottom: 6 }}>
                  {t("عدد الأسابيع", "Number of weeks")}
                  {suggestions?.durationWeeks ? (
                    <span style={{ fontWeight: 600, color: "#0E76AC" }}>
                      {" "}{t(`(اشتراكه ${suggestions.durationWeeks})`, `(sub: ${suggestions.durationWeeks})`)}
                    </span>
                  ) : null}
                </label>
                {/* ✅ الأسابيع فوق المتبقي من الاشتراك تُقصّ في effWeeks — كانت
                    الأزرار تسمح بالضغط ثم يضيء رقم آخر بلا تفسير. نعطّلها ونشرح. */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4].map((n) => {
                    const blocked = subWeeksRemaining != null && n > subWeeksRemaining;
                    return (
                      <button key={n} onClick={() => !blocked && setWeeksSel(n)} disabled={blocked}
                        title={blocked ? t("خارج مدة اشتراكك", "Beyond your subscription") : ""}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 9, fontWeight: 900, fontSize: 14,
                          fontFamily: "'Cairo',sans-serif",
                          cursor: blocked ? "not-allowed" : "pointer",
                          opacity: blocked ? 0.4 : 1,
                          border: `1.5px solid ${effWeeks === n ? "#0E76AC" : B.line}`,
                          background: effWeeks === n ? "#0E76AC" : "#fff",
                          color: effWeeks === n ? "#fff" : B.ink2,
                        }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
                {subWeeksRemaining != null && subWeeksRemaining < 4 && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 700, color: B.ink2 }}>
                    {t(
                      `يغطّي اشتراكك ${arWeeks(subWeeksRemaining)} — ولن يتم التوليد بعد تاريخ انتهائه.`,
                      `Your subscription covers ${subWeeksRemaining} week${subWeeksRemaining === 1 ? "" : "s"} — no plan is generated past its end date.`,
                    )}
                  </p>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: B.ink2, display: "block", marginBottom: 6 }}>
                  {t("يبدأ من دورة الأسبوع", "Start rotation week")}
                  {startRotInfo?.rotationWeek ? (
                    <span style={{ fontWeight: 600, color: "#0E76AC" }}>
                      {" "}{t(`(اشتراكك يبدأ من ${startRotInfo.rotationWeek})`, `(sub starts at ${startRotInfo.rotationWeek})`)}
                    </span>
                  ) : suggestions?.currentRotationWeek ? (
                    <span style={{ fontWeight: 600, color: "#0E76AC" }}>
                      {" "}{t(`(المطبخ الآن ${suggestions.currentRotationWeek})`, `(kitchen now ${suggestions.currentRotationWeek})`)}
                    </span>
                  ) : null}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setStartRot(n)}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontWeight: 900, fontSize: 14,
                        fontFamily: "'Cairo',sans-serif",
                        border: `1.5px solid ${effStartRot === n ? "#0E76AC" : B.line}`,
                        background: effStartRot === n ? "#0E76AC" : "#fff",
                        color: effStartRot === n ? "#fff" : B.ink2,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ width: "100%", margin: 0, fontSize: 11.5, color: B.ink2, fontWeight: 600 }}>
                {t(
                  `سيولّد ${effWeeks} أسبوع، يبدأ من دورة ${effStartRot} ثم يتقدّم.`,
                  `Will generate ${effWeeks} week(s), starting at rotation ${effStartRot}.`,
                )}
              </p>
            </div>
          )}

          {loggedInId ? (
            /* 1) مسجّل دخول — لا سؤال أصلاً */
            <button onClick={() => run(true)} disabled={loading}
              style={btnPrimary(loading)}>
              {loading ? t("جارٍ الإنشاء…", "Generating…") : t(`أنشئ خطتي (${currentCustomer?.fullName || "حسابي"})`, `Generate my plan (${currentCustomer?.fullName || "my account"})`)}
            </button>
          ) : phone.trim().length >= 6 && !changingPhone ? (
            /* 2) رقمه محفوظ من المنيو — نعرضه ونمضي، بلا إعادة إدخال */
            <>
              <p style={{ fontSize: 14, color: B.ink2, margin: "0 0 12px", fontWeight: 700 }}>
                {t("سنُنشئ الخطة للرقم:", "We'll build the plan for this number:")}{" "}
                <span dir="ltr" style={{ fontWeight: 900, color: B.accent }}>{phone}</span>
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => run(false)} disabled={loading} style={btnPrimary(loading)}>
                  {loading ? t("جارٍ الإنشاء…", "Generating…") : t("أنشئ خطتي", "Generate my plan")}
                </button>
                <button
                  onClick={() => setChangingPhone(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: B.ink2, fontWeight: 700, fontSize: 13,
                    textDecoration: "underline", fontFamily: "'Cairo',sans-serif",
                  }}>
                  {t("رقم مختلف؟", "Different number?")}
                </button>
              </div>
            </>
          ) : (
            /* 3) أول مرة — نسأل مرة واحدة ونحفظ الرقم للمنيو أيضاً */
            <>
              <p style={{ fontSize: 14, color: B.ink2, margin: "0 0 12px", fontWeight: 700 }}>
                {t("يُرجى إدخال رقم هاتفك لعرض بيانات اشتراكك، أو تسجيل الدخول:", "Enter your phone to fetch your subscription (or sign in):")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("رقم الهاتف", "Phone number")} inputMode="tel" dir="ltr"
                  style={{
                    flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 12,
                    border: `1px solid ${B.line}`, fontSize: 15, fontFamily: "'Cairo',sans-serif",
                  }} />
                <button onClick={() => { saveVerifiedPhone(phone); setChangingPhone(false); run(false); }}
                  disabled={loading || phone.trim().length < 6}
                  style={btnPrimary(loading || phone.trim().length < 6)}>
                  {loading ? t("جارٍ الإنشاء…", "Generating…") : t("أنشئ خطتي", "Generate my plan")}
                </button>
              </div>
            </>
          )}
          </>}
          {error && <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>{error}</p>}
        </div>

        {/* Weekly Result */}
        {weekly && (
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 14, flexWrap: "wrap", gap: 8,
            }}>
              <p style={{ fontSize: 16, color: B.ink, fontWeight: 800, margin: 0 }}>
                🗓️ {weekly.weeksCount > 1
                  ? t(`الخطة — ${weekly.weeksCount} أسابيع · ${weekly.totalMeals} وجبة`, `Plan — ${weekly.weeksCount} weeks · ${weekly.totalMeals} meals`)
                  : t(`خطة الأسبوع — ${weekly.totalMeals} وجبة عبر ${weekly.days.length} أيام`, `Weekly plan — ${weekly.totalMeals} meals across ${weekly.days.length} days`)}
              </p>
              {!weekly.profileFound && (
                <span style={{ fontSize: 12, color: "#8A6A1F", background: "#FFF7E6", border: "1px solid #F4D58A", borderRadius: 50, padding: "4px 12px" }}>
                  {t("خطة عامة — سجّل الدخول لتخصيص كامل", "General plan — sign in for full personalization")}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {weekly.days.map((d: any, di: number) => {
                // فاصل أسبوع: يظهر قبل أول يوم في كل أسبوع دورة جديد
                const prev = weekly.days[di - 1];
                const showWeekHeader = weekly.weeksCount > 1 && (!prev || prev.rotationWeek !== d.rotationWeek);
                return (
                <div key={di}>
                {showWeekHeader && (
                  <div style={{
                    margin: di === 0 ? "0 0 10px" : "18px 0 10px", padding: "8px 14px", borderRadius: 10,
                    background: "#EAF3FB", border: "1px solid #CFE4F3", color: "#0E2A4A",
                    fontWeight: 900, fontSize: 14,
                  }}>
                    {t(`الأسبوع (دورة ${d.rotationWeek})`, `Week (rotation ${d.rotationWeek})`)}
                  </div>
                )}
                <div style={{ background: "#fff", border: `1px solid ${B.line}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{
                    background: B.ink, color: "#fff", padding: "10px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6,
                  }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{dayName(d.day)} · {d.date}</span>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{d.picks.length} {t("وجبة", "meals")}</span>
                  </div>
                  {d.empty ? (
                    <p style={{ padding: "14px 16px", color: B.ink2, fontSize: 13, margin: 0 }}>
                      {t("لا توجد وجبات مجدولة لهذا اليوم.", "No meals scheduled for this day.")}
                    </p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, padding: 12 }}>
                      {d.picks.map((m: any, i: number) => (
                        <div key={i} style={{ border: `1px solid ${B.line}`, borderRadius: 12, overflow: "hidden", background: B.surf }}>
                          <div style={{ height: 84, background: B.bg2, overflow: "hidden" }}>
                            {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                          </div>
                          <div style={{ padding: "7px 9px" }}>
                            <div style={{ fontFamily: "'Cairo',sans-serif", fontSize: 12.5, fontWeight: 800, color: B.ink, lineHeight: 1.3 }}>{isRtl ? m.nameAr : (m.nameEn || m.nameAr)}</div>
                            <div style={{ fontSize: 11, color: B.ink2, marginTop: 2 }}>{m.calories} {t("سعرة", "kcal")}</div>
                            {!orderNo && (
                              <button
                                onClick={() => setSwap({ src: "weekly", di, i, week: d.rotationWeek || 1, day: d.day, meal: m })}
                                style={{
                                  marginTop: 6, width: "100%", padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                                  border: "1px solid #CFE4F3", background: "#F2FBFF", color: "#0E76AC",
                                  fontFamily: "'Cairo',sans-serif", fontSize: 11, fontWeight: 800,
                                }}
                              >
                                🔁 {t("تبديل", "Swap")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
                );
              })}
            </div>

            {/* Weekly order CTA */}
            <div style={{ textAlign: "center", marginTop: 24 }}>
              {orderNo ? (
                <div style={{
                  background: "#E8F8EF", border: "1px solid #9FDCB8", color: "#1E7A45",
                  borderRadius: 14, padding: "16px 20px", fontSize: 15, fontWeight: 700, display: "inline-block",
                }}>
                  <div style={{ fontSize: 16 }}>✅ {t("تم إرسال خطتك الأسبوعية للمراجعة!", "Your weekly plan was sent for review!")}</div>
                  <div style={{ fontWeight: 400, fontSize: 13.5, marginTop: 6, lineHeight: 1.8 }}>
                    📋 {t("رقم الطلب:", "Order number:")} <b>{orderNo}</b><br />
                    ⏱️ {t("يراجعها أخصائي التغذية عادةً خلال ساعات قليلة", "A nutritionist usually reviews it within a few hours")}<br />
                    📞 {t(`سنتواصل معك على ${currentCustomer?.phone || phone || "رقمك"} للتأكيد`, `We'll contact you on ${currentCustomer?.phone || phone || "your number"} to confirm`)}
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={placeWeeklyOrder} disabled={ordering} style={btnPrimary(ordering)}>
                    {ordering ? t("جارٍ الإرسال…", "Sending…") : t("📋 أرسل خطة الأسبوع لمراجعة الأخصائي", "📋 Send weekly plan for nutritionist review")}
                  </button>
                  <p style={{ fontSize: 12, color: B.ink2, marginTop: 10 }}>
                    {t("يراجع أخصائي التغذية خطة الأسبوع كاملة للتأكد من ملاءمتها قبل التأكيد.", "The nutritionist reviews the full weekly plan to ensure it fits before confirming.")}
                  </p>
                </>
              )}
              {error && <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>{error}</p>}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div>
            {/* Day / date / rotation-week banner */}
            {result.meta && (
              <div style={{
                display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
                background: B.ink, color: "#fff", borderRadius: 14,
                padding: "12px 18px", marginBottom: 16,
              }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>
                  📅 {t(`منيو يوم ${WEEKDAYS_AR[result.meta.day] || ""} — ${result.meta.date}`, `${WEEKDAYS_EN[result.meta.day] || ""} menu — ${result.meta.date}`)}
                </span>
                <span style={{ background: "rgba(255,255,255,.18)", borderRadius: 50, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                  {t(`أسبوع الدورة ${result.meta.rotationWeek}`, `Rotation week ${result.meta.rotationWeek}`)}
                </span>
                {result.meta.started === false && (
                  <span style={{ fontSize: 12, color: "#FFD9A6" }}>
                    {t("(اشتراكك لم يبدأ بعد — هذه خطة أول يوم في اشتراكك)", "(Your subscription hasn't started yet — this is your first subscription day's plan)")}
                  </span>
                )}
              </div>
            )}

            {!result.profileFound && (
              <div style={{
                background: "#FFF7E6", border: "1px solid #F4D58A", color: "#8A6A1F",
                borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 14,
              }}>
                {t("لم نجد اشتراكاً مرتبطاً — جهّزنا خطة عامة. اشترك أو سجّل الدخول لخطة مخصّصة بالكامل.", "No linked subscription found — we prepared a general plan. Subscribe or sign in for a fully personalized plan.")}
              </div>
            )}

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 14, flexWrap: "wrap", gap: 8,
            }}>
              <p style={{ fontSize: 15, color: B.ink, fontWeight: 800, margin: 0 }}>{result.summary}</p>
              <span style={{ fontSize: 11, color: B.ink2, background: B.bg2, borderRadius: 50, padding: "4px 12px" }}>
                {result.engine === "ai" ? t("✨ ذكاء اصطناعي", "✨ AI") : t("⚙️ ترشيح ذكي", "⚙️ Smart pick")}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,230px),1fr))", gap: 16 }}>
              {result.picks.map((m: any, i: number) => (
                <div key={i} style={{
                  background: "#fff", border: `1px solid ${B.line}`, borderRadius: 16,
                  overflow: "hidden", boxShadow: "0 6px 18px -10px rgba(14,42,74,.2)",
                }}>
                  <div style={{ height: 140, background: B.bg2, overflow: "hidden" }}>
                    {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 16, fontWeight: 800, color: B.ink, margin: "0 0 6px" }}>
                      {isRtl ? m.nameAr : (m.nameEn || m.nameAr)}
                    </h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={chip}>{m.calories} {t("سعرة", "kcal")}</span>
                      <span style={chip}>{t("بروتين", "Protein")} {m.protein}{t("جم", "g")}</span>
                    </div>
                    {m.reason && (
                      <p style={{ fontSize: 13, color: B.accent, margin: 0, lineHeight: 1.6 }}>
                        💡 {m.reason}
                      </p>
                    )}
                    {!orderNo && (
                      <button
                        onClick={() => setSwap({ src: "day", i, week: result.meta?.rotationWeek || 1, day: result.meta?.day || WEEKDAYS[new Date().getDay()], meal: m })}
                        style={{
                          marginTop: 10, width: "100%", padding: "6px 10px", borderRadius: 10, cursor: "pointer",
                          border: "1px solid #CFE4F3", background: "#F2FBFF", color: "#0E76AC",
                          fontFamily: "'Cairo',sans-serif", fontSize: 12.5, fontWeight: 800,
                        }}
                      >
                        🔁 {t("تبديل الوجبة", "Swap meal")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Order CTA */}
            <div style={{ textAlign: "center", marginTop: 24 }}>
              {orderNo ? (
                <div style={{
                  background: "#E8F8EF", border: "1px solid #9FDCB8", color: "#1E7A45",
                  borderRadius: 14, padding: "16px 20px", fontSize: 15, fontWeight: 700,
                  display: "inline-block",
                }}>
                  <div style={{ fontSize: 16 }}>✅ {t("تم إرسال خطتك للمراجعة!", "Your plan was sent for review!")}</div>
                  <span style={{ fontWeight: 400, fontSize: 13.5, display: "block", marginTop: 6, lineHeight: 1.8 }}>
                    📋 {t("رقم الطلب:", "Order number:")} <b>{orderNo}</b><br />
                    ⏱️ {t("يراجعها أخصائي التغذية عادةً خلال ساعات قليلة", "A nutritionist usually reviews it within a few hours")}<br />
                    📞 {t(`سنتواصل معك على ${currentCustomer?.phone || phone || "رقمك"} للتأكيد`, `We'll contact you on ${currentCustomer?.phone || phone || "your number"} to confirm`)}
                  </span>
                </div>
              ) : (
                <>
                  <button onClick={placeOrder} disabled={ordering} style={btnPrimary(ordering)}>
                    {ordering ? t("جارٍ الإرسال…", "Sending…") : t("📋 أرسل الخطة لمراجعة الأخصائي", "📋 Send plan for nutritionist review")}
                  </button>
                  <p style={{ fontSize: 12, color: B.ink2, marginTop: 10 }}>
                    {t("لن يتم تأكيد الطلب مباشرة — يراجع أخصائي التغذية الخطة أولاً للتأكد من ملاءمتها لليوم.", "The order won't be confirmed instantly — the nutritionist reviews the plan first to ensure it fits the day.")}
                  </p>
                </>
              )}
            </div>

            {/* Upsell — best sellers to complete the order */}
            {bestSellers.length > 0 && (
              <div style={{ marginTop: 34 }}>
                <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 17, fontWeight: 800, color: B.ink, marginBottom: 14, textAlign: "center" }}>
                  {t("قد يعجبك أيضًا — الأكثر طلبًا 🔥", "You might also like — best sellers 🔥")}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
                  {bestSellers.map((m: any) => (
                    <a key={m.id} href={m.slug ? `/public/meal/${m.slug}` : "/public/menu"}
                      style={{ background: "#fff", border: `1px solid ${B.line}`, borderRadius: 16,
                        overflow: "hidden", textDecoration: "none", display: "block" }}>
                      <div style={{ height: 100, background: B.bg2, overflow: "hidden" }}>
                        {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontFamily: "'Cairo',sans-serif", fontSize: 13, fontWeight: 800, color: B.ink, marginBottom: 3 }}>
                          {isRtl ? m.nameAr : (m.nameEn || m.nameAr)}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: B.ink2 }}>
                          <span>{m.calories} {t("سعرة", "kcal")}</span>
                          <span style={{ fontWeight: 700, color: B.accent }}>{m.priceQAR} {t("ر.ق", "QAR")}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔁 نافذة تبديل الوجبة — بدائل نفس اليوم/الدورة فقط */}
        {swap && (
          <div
            onClick={() => setSwap(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 680, maxHeight: "82vh", overflowY: "auto", padding: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 17, fontWeight: 800, color: B.ink, margin: 0 }}>
                  🔁 {t("تبديل:", "Swap:")} <span style={{ color: "#0E76AC" }}>{isRtl ? swap.meal?.nameAr : (swap.meal?.nameEn || swap.meal?.nameAr)}</span>
                </h3>
                <button onClick={() => setSwap(null)} style={{ border: "none", background: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>
              <p style={{ fontSize: 12.5, color: B.ink2, margin: "0 0 14px" }}>
                📅 {t(
                  `بدائل ${CAT_AR[swap.meal?.category] || ""} ${WEEKDAYS_AR[swap.day] || swap.day} — أسبوع الدورة ${swap.week}`,
                  `${WEEKDAYS_EN[swap.day] || swap.day} ${swap.meal?.category || ""} alternatives — rotation week ${swap.week}`,
                )}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 10 }}>
                {/* ✅ نفس اليوم + نفس التصنيف فقط: فطور يُستبدل بفطور اليوم نفسه —
                    المطبخ لا يطبخ خارج منيو اليوم، ولا يصح وضع غداء مكان فطور */}
                {allMeals
                  .filter((m: any) =>
                    mealAvailable(m, Number(swap.week), swap.day) &&
                    String(m._id) !== String(swap.meal?.id) &&
                    String(m.category) === String(swap.meal?.category))
                  .map((m: any) => (
                    <button
                      key={m._id}
                      onClick={() => applySwap(m)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: 10, cursor: "pointer",
                        background: B.surf, border: `1px solid ${B.line}`, borderRadius: 12, textAlign: "start",
                      }}
                    >
                      {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: "'Cairo',sans-serif", fontSize: 13, fontWeight: 800, color: B.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isRtl ? m.nameAr : (m.nameEn || m.nameAr)}
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: B.ink2, marginTop: 2 }}>
                          {m.calories} {t("سعرة", "kcal")}{m.priceQAR ? ` · ${m.priceQAR} ${t("ر.ق", "QAR")}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
              {allMeals.filter((m: any) =>
                mealAvailable(m, Number(swap.week), swap.day) &&
                String(m._id) !== String(swap.meal?.id) &&
                String(m.category) === String(swap.meal?.category)).length === 0 && (
                <p style={{ textAlign: "center", color: "#94a3b8", padding: "24px 0", fontSize: 13.5 }}>
                  {t("لا توجد بدائل من نفس التصنيف مجدولة لهذا اليوم.", "No same-category alternatives scheduled for this day.")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

const chip: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#0E2A4A",
  background: "#EAF3FB", borderRadius: 50, padding: "3px 10px",
};

/**
 * صيغة عدد الأسابيع بالعربية الفصحى — العربية فيها مفرد ومثنّى وجمع،
 * فـ"2 أسابيع" خطأ نحوي والصواب "أسبوعان". النطاق هنا 1..4 (دورة المطبخ).
 */
function arWeeks(n: number): string {
  if (n === 1) return "أسبوعاً واحداً";
  if (n === 2) return "أسبوعين";
  return `${n} أسابيع`;
}

const pill: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, color: "#2D4A67",
  background: "#F7FBFE", border: "1px solid #D9E6F1",
  borderRadius: 50, padding: "4px 12px",
};

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#9CC5DB" : "#0E76AC", color: "#fff",
    border: "none", borderRadius: 12, padding: "12px 26px",
    fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
  };
}
