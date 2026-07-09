/**
 * @file SmartPlan.tsx
 * @description مولّد الوجبات الذكي (المرحلة 1) — واجهة العميل
 *  مدخلان: مسجّل دخول (تلقائي) أو رقم تليفون (بدون تسجيل).
 */
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Sparkles } from "lucide-react";

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const WEEKDAYS_AR: Record<string,string> = {
  saturday:"السبت", sunday:"الأحد", monday:"الإثنين", tuesday:"الثلاثاء",
  wednesday:"الأربعاء", thursday:"الخميس", friday:"الجمعة",
};
const WEEKDAYS_EN: Record<string,string> = {
  saturday:"Saturday", sunday:"Sunday", monday:"Monday", tuesday:"Tuesday",
  wednesday:"Wednesday", thursday:"Thursday", friday:"Friday",
};

const B = {
  brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A",
  ink2: "#2D4A67", line: "#D9E6F1", surf: "#F7FBFE", bg2: "#EAF3FB",
};

export default function SmartPlan() {
  const { language, dir } = useLanguage();
  useSeo({ title: "خطتي الذكية | أدرينالين للوجبات الصحية", description: "دع الذكاء الاصطناعي يختار لك وجبات اليوم حسب هدفك وسعراتك وما لا تحبه — ثم يراجعها أخصائي التغذية.", path: "/customer/smart-plan" });
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);
  const dayName = (d: string) => isRtl ? (WEEKDAYS_AR[d] || d) : (WEEKDAYS_EN[d] || d);

  const { currentCustomer } = useStore();
  const generate = useAction(api.ai.generateSmartPlan);
  const generateWeekly = useAction((api.ai as any).generateWeeklyPlan);
  const createOrder = useMutation(api.customerOrders.create);
  const bestSellers = useQuery((api.publicMeals as any).bestSellers, { limit: 4 }) || [];

  const [mode, setMode] = useState<"day" | "week">("day");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);   // خطة اليوم
  const [weekly, setWeekly] = useState<any>(null);    // خطة الأسبوع
  const [error, setError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderNo, setOrderNo] = useState("");

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
      const totalPrice = items.reduce((s, i) => s + (i.priceQAR || 0), 0);
      const totalCalories = items.reduce((s, i) => s + (i.calories || 0), 0);
      const res: any = await createOrder({
        customerName: currentCustomer?.fullName || "AI customer",
        customerPhone: currentCustomer?.phone || phone.trim() || "—",
        customerId: (currentCustomer?.customerId as any) || undefined,
        totalMeals: items.length, totalPrice, totalCalories, items,
        notes: "Weekly plan from the smart meal generator",
      });
      setOrderNo(res?.orderNumber || t("تم", "Done"));
    } catch (e) {
      setError(t("تعذّر إنشاء الطلب، حاول مرة أخرى.", "Could not create the order, please try again."));
    } finally { setOrdering(false); }
  };

  const placeOrder = async () => {
    if (!result?.picks?.length || ordering) return;
    setOrdering(true); setError("");
    try {
      const day = result?.meta?.day || WEEKDAYS[new Date().getDay()];
      const week = result?.meta?.rotationWeek || 1;
      const items = result.picks.map((m: any) => ({
        mealId: m.id, mealNameAr: m.nameAr, mealNameEn: m.nameEn || undefined,
        calories: m.calories, protein: m.protein, carbs: m.carbs, fats: m.fats,
        category: m.category, imageUrl: m.imageUrl || undefined,
        priceQAR: m.priceQAR || 0, week, day,
      }));
      const totalPrice = items.reduce((s: number, i: any) => s + (i.priceQAR || 0), 0);
      const totalCalories = items.reduce((s: number, i: any) => s + (i.calories || 0), 0);
      const res: any = await createOrder({
        customerName: currentCustomer?.fullName || "AI customer",
        customerPhone: currentCustomer?.phone || phone.trim() || "—",
        customerId: (currentCustomer?.customerId as any) || undefined,
        totalMeals: items.length, totalPrice, totalCalories, items,
        notes: "Order from the smart meal generator",
      });
      setOrderNo(res?.orderNumber || t("تم", "Done"));
    } catch (e) {
      setError(t("تعذّر إنشاء الطلب، حاول مرة أخرى.", "Could not create the order, please try again."));
    } finally { setOrdering(false); }
  };

  const loggedInId = currentCustomer?.customerId;

  const run = async (useLogin: boolean) => {
    setError(""); setResult(null); setWeekly(null); setOrderNo(""); setLoading(true);
    const source = useLogin ? { customerId: loggedInId as any } : { phone: phone.trim() };
    try {
      if (mode === "week") {
        const res: any = await generateWeekly(source);
        if (!res.ok) { setError(t("لا توجد وجبات مجدولة لهذا الأسبوع.", "No meals scheduled for this week.")); }
        else setWeekly(res);
      } else {
        const res: any = await generate(source);
        if (!res.ok) { setError(res.error || t("تعذّر توليد الخطة", "Could not generate the plan")); }
        else setResult(res);
      }
    } catch (e: any) {
      setError(t("حصل خطأ أثناء التوليد، حاول مرة أخرى.", "An error occurred while generating, please try again."));
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
        subtitleAr="اختر خطة اليوم أو الأسبوع — نختار لك من الوجبات المتاحة حسب هدفك وما تفضّله."
        subtitleEn="Pick a daily or weekly plan — we choose from available meals by your goal and preferences."
      />
      <div dir={isRtl ? "rtl" : "ltr"} style={{ maxWidth: 980, margin: "0 auto", padding: "32px 18px" }}>
        {/* Entry */}
        <div style={{
          background: "#fff", border: `1px solid ${B.line}`, borderRadius: 18,
          padding: 24, marginBottom: 26, boxShadow: "0 10px 30px -18px rgba(14,42,74,.25)",
        }}>
          {/* Day / Week toggle */}
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

          {loggedInId ? (
            <button onClick={() => run(true)} disabled={loading}
              style={btnPrimary(loading)}>
              {loading ? t("جاري التوليد…", "Generating…") : t(`توليد خطتي (${currentCustomer?.fullName || "حسابي"})`, `Generate my plan (${currentCustomer?.fullName || "my account"})`)}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 14, color: B.ink2, margin: "0 0 12px", fontWeight: 700 }}>
                {t("أدخل رقم هاتفك لجلب بيانات اشتراكك (أو سجّل الدخول):", "Enter your phone to fetch your subscription (or sign in):")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("رقم الهاتف", "Phone number")} inputMode="tel" dir="ltr"
                  style={{
                    flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 12,
                    border: `1px solid ${B.line}`, fontSize: 15, fontFamily: "'Cairo',sans-serif",
                  }} />
                <button onClick={() => run(false)} disabled={loading || phone.trim().length < 6}
                  style={btnPrimary(loading || phone.trim().length < 6)}>
                  {loading ? t("جاري التوليد…", "Generating…") : t("ولّد خطتي", "Generate my plan")}
                </button>
              </div>
            </>
          )}
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
                🗓️ {t(`خطة الأسبوع — ${weekly.totalMeals} وجبة عبر ${weekly.days.length} أيام`, `Weekly plan — ${weekly.totalMeals} meals across ${weekly.days.length} days`)}
              </p>
              {!weekly.profileFound && (
                <span style={{ fontSize: 12, color: "#8A6A1F", background: "#FFF7E6", border: "1px solid #F4D58A", borderRadius: 50, padding: "4px 12px" }}>
                  {t("خطة عامة — سجّل الدخول لتخصيص كامل", "General plan — sign in for full personalization")}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {weekly.days.map((d: any, di: number) => (
                <div key={di} style={{ background: "#fff", border: `1px solid ${B.line}`, borderRadius: 16, overflow: "hidden" }}>
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
                    {t("(اشتراكك لم يبدأ بعد — هذه خطة الأسبوع الأول)", "(Your subscription hasn't started yet — this is the first week's plan)")}
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
      </div>
    </PublicLayout>
  );
}

const chip: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#0E2A4A",
  background: "#EAF3FB", borderRadius: 50, padding: "3px 10px",
};

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#9CC5DB" : "#0E76AC", color: "#fff",
    border: "none", borderRadius: 12, padding: "12px 26px",
    fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
  };
}
