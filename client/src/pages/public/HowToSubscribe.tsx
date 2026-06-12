/**
 * @file HowToSubscribe.tsx
 * @description صفحة "كيف تشترك" — خطوات واضحة + أسئلة شائعة + CTA.
 *  المسار: /public/how-to-subscribe
 */
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import {
  ListChecks, MessageCircle, ClipboardCheck, Truck, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";

const B = { brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A", ink2: "#2D4A67", line: "#D9E6F1", bg2: "#EAF3FB" };

export default function HowToSubscribe() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [, setLocation] = useLocation();
  const settings = useQuery(api.restaurantSettings.get);
  const phoneRaw = (settings?.phone || "+97451144366").replace(/\D/g, "");
  const wa = (m: string) => `https://wa.me/${phoneRaw}?text=${encodeURIComponent(m)}`;

  const t = (ar: string, en: string) => (isRtl ? ar : en);

  const steps = [
    { icon: ListChecks, color: "#0E76AC",
      ar: "اختر باقتك", en: "Choose Your Plan",
      dAr: "تصفّح الباقات الأسبوعية أو الشهرية واختر ما يناسب هدفك (تنشيف · تضخيم · توازن) وعدد الوجبات.",
      dEn: "Browse weekly or monthly plans and pick what fits your goal (cut · bulk · balance) and meal count." },
    { icon: MessageCircle, color: "#3AC7F4",
      ar: "تواصل معنا", en: "Get in Touch",
      dAr: "اضغط زر واتساب وأرسل بياناتك (الهدف، الحساسية، التفضيلات) ووقت التوصيل المناسب لك.",
      dEn: "Tap WhatsApp and send your details (goal, allergies, preferences) and preferred delivery time." },
    { icon: ClipboardCheck, color: "#5BC4A0",
      ar: "مراجعة الأخصائي", en: "Nutritionist Review",
      dAr: "يراجع أخصائي التغذية خطتك ويضبط الوجبات لتناسب احتياجك اليومي قبل التأكيد.",
      dEn: "Our nutritionist reviews and tunes your meals to fit your daily needs before confirming." },
    { icon: Truck, color: "#F4A93A",
      ar: "توصيل يومي", en: "Daily Delivery",
      dAr: "تستلم وجباتك الطازجة يومياً لباب بيتك في الموعد، أو اطلب عبر تطبيقات التوصيل.",
      dEn: "Receive fresh meals daily at your door on time, or order via delivery apps." },
  ];

  const faqs = [
    { qAr: "هل أقدر أغيّر وجباتي؟", qEn: "Can I change my meals?",
      aAr: "نعم، أبلغنا بتفضيلاتك والممنوعات وسنراعيها في خطتك.", aEn: "Yes — tell us your preferences and exclusions and we'll honor them." },
    { qAr: "ما مدة الاشتراك؟", qEn: "What are the durations?",
      aAr: "أسبوعي، أسبوعين، أو شهري — تختار ما يناسبك.", aEn: "Weekly, two weeks, or monthly — your choice." },
    { qAr: "هل التوصيل مجاني؟", qEn: "Is delivery free?",
      aAr: "نعم، نوفّر توصيلاً يومياً داخل قطر، إضافةً للطلب عبر 5 تطبيقات توصيل.", aEn: "Yes — daily delivery across Qatar, plus ordering via 5 delivery apps." },
    { qAr: "كيف تساعدني الخطة الذكية؟", qEn: "How does the Smart Plan help?",
      aAr: "تقترح لك وجبات اليوم تلقائياً حسب هدفك وما تفضّله، ثم يراجعها الأخصائي.", aEn: "It auto-suggests today's meals by your goal and preferences, then the nutritionist reviews." },
  ];

  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <PublicLayout>
      <PageHeader
        eyebrowAr="ابدأ رحلتك" eyebrowEn="GET STARTED"
        titleAr="كيف تشترك؟" titleEn="How to Subscribe"
        subtitleAr="أربع خطوات بسيطة تفصلك عن وجبات صحية محسوبة توصل لباب بيتك يومياً."
        subtitleEn="Just four simple steps to healthy, calorie-counted meals delivered to your door daily."
      />

      <div dir={isRtl ? "rtl" : "ltr"} style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 18px" }}>
        {/* Steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{ background: "#fff", border: `1px solid ${B.line}`, borderRadius: 18,
                  padding: "26px 22px", position: "relative", boxShadow: "0 8px 24px -14px rgba(14,42,74,.25)" }}>
                <div style={{ position: "absolute", top: 16, insetInlineEnd: 18,
                  fontFamily: "'Cairo',sans-serif", fontSize: 34, fontWeight: 900, color: s.color, opacity: 0.18 }}>
                  {i + 1}
                </div>
                <div style={{ width: 56, height: 56, borderRadius: 16, marginBottom: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(145deg,${s.color}28,${s.color}10)`, border: `1.5px solid ${s.color}25` }}>
                  <Icon size={26} color={s.color} />
                </div>
                <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 18, fontWeight: 800, color: B.ink, margin: "0 0 8px" }}>
                  {t(s.ar, s.en)}
                </h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: B.ink2, margin: 0 }}>{t(s.dAr, s.dEn)}</p>
              </motion.div>
            );
          })}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", margin: "36px 0 8px" }}>
          <button onClick={() => setLocation("/public/plans")}
            style={{ background: `linear-gradient(135deg,${B.brand},${B.accent})`, color: "#fff", border: "none",
              borderRadius: 50, padding: "13px 28px", fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t("تصفّح الباقات", "Browse Plans")} <Arrow size={18} />
          </button>
          <button onClick={() => setLocation("/customer/smart-plan")}
            style={{ background: "#fff", color: B.accent, border: `1.5px solid ${B.line}`,
              borderRadius: 50, padding: "13px 28px", fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={B.brand} /> {t("جرّب خطتي الذكية", "Try Smart Plan")}
          </button>
          <a href={wa(t("مرحباً 👋 أرغب في الاشتراك في أدرينالين", "Hello 👋 I'd like to subscribe to Adrenaline"))}
            target="_blank" rel="noopener noreferrer"
            style={{ background: "#25D366", color: "#fff", textDecoration: "none",
              borderRadius: 50, padding: "13px 28px", fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800,
              display: "inline-flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} /> {t("اشترك عبر واتساب", "Subscribe via WhatsApp")}
          </a>
        </div>

        {/* FAQ */}
        <h2 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 24, fontWeight: 800, color: B.ink,
          textAlign: "center", margin: "44px 0 20px" }}>
          {t("أسئلة شائعة", "Frequently Asked")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: B.bg2, border: `1px solid ${B.line}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontFamily: "'Cairo',sans-serif", fontSize: 15, fontWeight: 800, color: B.ink, marginBottom: 6 }}>
                {t(f.qAr, f.qEn)}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: B.ink2, margin: 0 }}>{t(f.aAr, f.aEn)}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
