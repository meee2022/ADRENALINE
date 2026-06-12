/**
 * @file SmartPlan.tsx
 * @description مولّد الوجبات الذكي (المرحلة 1) — واجهة العميل
 *  مدخلان: مسجّل دخول (تلقائي) أو رقم تليفون (بدون تسجيل).
 */
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Sparkles } from "lucide-react";

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const WEEKDAYS_AR: Record<string,string> = {
  saturday:"السبت", sunday:"الأحد", monday:"الإثنين", tuesday:"الثلاثاء",
  wednesday:"الأربعاء", thursday:"الخميس", friday:"الجمعة",
};

const B = {
  brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A",
  ink2: "#2D4A67", line: "#D9E6F1", surf: "#F7FBFE", bg2: "#EAF3FB",
};

export default function SmartPlan() {
  const { currentCustomer } = useStore();
  const generate = useAction(api.ai.generateSmartPlan);
  const createOrder = useMutation(api.customerOrders.create);
  const bestSellers = useQuery((api.publicMeals as any).bestSellers, { limit: 4 }) || [];

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderNo, setOrderNo] = useState("");

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
        customerName: currentCustomer?.fullName || "عميل ذكاء اصطناعي",
        customerPhone: currentCustomer?.phone || phone.trim() || "—",
        customerId: (currentCustomer?.customerId as any) || undefined,
        totalMeals: items.length, totalPrice, totalCalories, items,
        notes: "طلب من مولّد الوجبات الذكي",
      });
      setOrderNo(res?.orderNumber || "تم");
    } catch (e) {
      setError("تعذّر إنشاء الطلب، حاول مرة أخرى.");
    } finally { setOrdering(false); }
  };

  const loggedInId = currentCustomer?.customerId;

  const run = async (useLogin: boolean) => {
    setError(""); setResult(null); setOrderNo(""); setLoading(true);
    try {
      const res: any = await generate(
        useLogin
          ? { customerId: loggedInId as any }
          : { phone: phone.trim() }
      );
      if (!res.ok) { setError(res.error || "تعذّر توليد الخطة"); }
      else setResult(res);
    } catch (e: any) {
      setError("حصل خطأ أثناء التوليد، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <PageHeader
        eyebrowAr="مدعوم بالذكاء الاصطناعي" eyebrowEn="AI-POWERED"
        icon={<Sparkles className="w-3.5 h-3.5" style={{ color: "#3AC7F4" }} />}
        titleAr="خطة وجباتك الذكية لليوم" titleEn="Your Smart Daily Plan"
        subtitleAr="نختار لك من وجبات اليوم المتاحة حسب هدفك وما تفضّله — في ثوانٍ."
        subtitleEn="We pick from today's available meals based on your goal and preferences — in seconds."
      />
      <div dir="rtl" style={{ maxWidth: 980, margin: "0 auto", padding: "32px 18px" }}>
        {/* Entry */}
        <div style={{
          background: "#fff", border: `1px solid ${B.line}`, borderRadius: 18,
          padding: 24, marginBottom: 26, boxShadow: "0 10px 30px -18px rgba(14,42,74,.25)",
        }}>
          {loggedInId ? (
            <button onClick={() => run(true)} disabled={loading}
              style={btnPrimary(loading)}>
              {loading ? "جاري التوليد…" : `توليد خطتي (${currentCustomer?.fullName || "حسابي"})`}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 14, color: B.ink2, margin: "0 0 12px", fontWeight: 700 }}>
أدخل رقم هاتفك لجلب بيانات اشتراكك (أو سجّل الدخول):
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="رقم الهاتف" inputMode="tel"
                  style={{
                    flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 12,
                    border: `1px solid ${B.line}`, fontSize: 15, fontFamily: "'Cairo',sans-serif",
                  }} />
                <button onClick={() => run(false)} disabled={loading || phone.trim().length < 6}
                  style={btnPrimary(loading || phone.trim().length < 6)}>
                  {loading ? "جاري التوليد…" : "ولّد خطتي"}
                </button>
              </div>
            </>
          )}
          {error && <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>{error}</p>}
        </div>

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
                  📅 منيو يوم {WEEKDAYS_AR[result.meta.day] || ""} — {result.meta.date}
                </span>
                <span style={{ background: "rgba(255,255,255,.18)", borderRadius: 50, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                  أسبوع الدورة {result.meta.rotationWeek}
                </span>
                {result.meta.started === false && (
                  <span style={{ fontSize: 12, color: "#FFD9A6" }}>
                    (اشتراكك لم يبدأ بعد — هذه خطة الأسبوع الأول)
                  </span>
                )}
              </div>
            )}

            {!result.profileFound && (
              <div style={{
                background: "#FFF7E6", border: "1px solid #F4D58A", color: "#8A6A1F",
                borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 14,
              }}>
                لم نجد اشتراكاً مرتبطاً — جهّزنا خطة عامة. اشترك أو سجّل الدخول لخطة مخصّصة بالكامل.
              </div>
            )}

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 14, flexWrap: "wrap", gap: 8,
            }}>
              <p style={{ fontSize: 15, color: B.ink, fontWeight: 800, margin: 0 }}>{result.summary}</p>
              <span style={{ fontSize: 11, color: B.ink2, background: B.bg2, borderRadius: 50, padding: "4px 12px" }}>
                {result.engine === "ai" ? "✨ ذكاء اصطناعي" : "⚙️ ترشيح ذكي"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16 }}>
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
                      {m.nameAr}
                    </h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={chip}>{m.calories} سعرة</span>
                      <span style={chip}>بروتين {m.protein}جم</span>
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
                  ✅ تم إرسال خطتك لمراجعة أخصائي التغذية! رقم الطلب: <b>{orderNo}</b><br />
                  <span style={{ fontWeight: 400, fontSize: 13 }}>
                    سيراجعها الأخصائي للتأكد من ملاءمتها ثم نتواصل معك للتأكيد.
                  </span>
                </div>
              ) : (
                <>
                  <button onClick={placeOrder} disabled={ordering} style={btnPrimary(ordering)}>
                    {ordering ? "جارٍ الإرسال…" : "📋 أرسل الخطة لمراجعة الأخصائي"}
                  </button>
                  <p style={{ fontSize: 12, color: B.ink2, marginTop: 10 }}>
                    لن يتم تأكيد الطلب مباشرة — يراجع أخصائي التغذية الخطة أولاً للتأكد من ملاءمتها لليوم.
                  </p>
                </>
              )}
            </div>

            {/* Upsell — best sellers to complete the order */}
            {bestSellers.length > 0 && (
              <div style={{ marginTop: 34 }}>
                <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 17, fontWeight: 800, color: B.ink, marginBottom: 14, textAlign: "center" }}>
                  قد يعجبك أيضًا — الأكثر طلبًا 🔥
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
                          {m.nameAr}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: B.ink2 }}>
                          <span>{m.calories} سعرة</span>
                          <span style={{ fontWeight: 700, color: B.accent }}>{m.priceQAR} ر.ق</span>
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
