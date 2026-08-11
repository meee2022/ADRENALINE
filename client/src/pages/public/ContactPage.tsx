/**
 * @file client/src/pages/public/ContactPage.tsx
 * @description Premium Contact page — bilingual, with form, info cards, map
 */
import * as React from "react";
import { motion } from "framer-motion";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { PremiumFooter } from "@/components/public/PremiumSections";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { useLocation } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import {
  MessageCircle, Phone, MapPin, Clock, Instagram, Send,
  ArrowLeft, ArrowRight, User, AtSign,
} from "lucide-react";

export default function ContactPage() {
  const { language, dir } = useLanguage();
  const [location] = useLocation();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const isSupportRoute = location === "/support";
  useSeo({
    title: isSupportRoute
      ? (isRtl ? "الدعم | أدرينالين للوجبات الصحية" : "Support | Adrenaline Healthy Meals")
      : (isRtl ? "تواصل معنا | أدرينالين للوجبات الصحية" : "Contact Us | Adrenaline Healthy Meals"),
    description: isRtl
      ? "تواصل مع أدرينالين للوجبات الصحية — استفسارات الاشتراك والتوصيل في قطر."
      : "Contact Adrenaline Healthy Meals — subscription and delivery inquiries in Qatar.",
    path: isSupportRoute ? "/support" : "/public/contact",
  });
  const settings = useQuery(api.restaurantSettings.get);
  const phoneClean = String(settings?.phone || "+97412345678").replace(/\D/g, "");

  const [form, setForm] = React.useState({ name: "", email: "", message: "" });

  const handleWhatsApp = () => {
    const msg = isRtl
      ? `مرحباً 👋\nالاسم: ${form.name || "—"}\nالإيميل: ${form.email || "—"}\n\n${form.message || "أرغب في التواصل."}`
      : `Hello 👋\nName: ${form.name || "—"}\nEmail: ${form.email || "—"}\n\n${form.message || "I'd like to get in touch."}`;
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleSubscribe = () => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطط أدرينالين الصحية.`
      : `Hello 👋\nI'd like to subscribe to Adrenaline plans.`;
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const cards = [
    {
      icon: MessageCircle, titleAr: "واتساب", titleEn: "WhatsApp",
      valueAr: "تواصل سريع 24/7", valueEn: "Quick chat 24/7",
      action: () => window.open(`https://wa.me/${phoneClean}`, "_blank"),
      ctaAr: "افتح المحادثة", ctaEn: "Open Chat",
      gradient: "linear-gradient(135deg, #25D366, #128C7E)",
    },
    {
      icon: Phone, titleAr: "اتصل بنا", titleEn: "Call Us",
      valueAr: settings?.phone || "+974 1234 5678",
      valueEn: settings?.phone || "+974 1234 5678",
      action: () => window.open(`tel:+${phoneClean}`),
      ctaAr: "اتصل الآن", ctaEn: "Call Now",
      gradient: "linear-gradient(135deg, #3CC4F0, #47759C)",
    },
    {
      icon: MapPin, titleAr: "موقعنا", titleEn: "Visit Us",
      valueAr: "الدوحة، قطر", valueEn: "Doha, Qatar",
      action: () => window.open("https://maps.google.com/?q=Doha+Qatar", "_blank"),
      ctaAr: "افتح الخريطة", ctaEn: "Open Map",
      gradient: "linear-gradient(135deg, #f59e0b, #ea580c)",
    },
    {
      icon: Clock, titleAr: "أوقات العمل", titleEn: "Working Hours",
      valueAr: "السبت — الأربعاء", valueEn: "Sat — Wed", sub: "9:00 AM — 9:00 PM",
      gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    },
  ];

  return (
    <PublicLayout>
      <PageHeader
        icon={<MessageCircle className="w-3.5 h-3.5" style={{ color: "#3AC7F4" }} />}
        eyebrowAr="تواصل معنا" eyebrowEn="GET IN TOUCH"
        titleAr="نحن هنا لخدمتك" titleEn="We're Here For You"
        subtitleAr="هل لديك سؤال أو تحتاج إلى مساعدة في اختيار خطتك؟ فريقنا مستعد للإجابة في أي وقت"
        subtitleEn="Have a question? Need help choosing a plan? Our team is ready to assist you anytime"
      />

      {/* Quick Contact Cards */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  whileHover={{ y: -6 }}
                  onClick={c.action}
                  // ♿ البطاقات القابلة للنقر (واتساب/اتصال/خريطة) كانت <div onClick>
                  //    بلا دور ولا tabIndex — غير قابلة للوصول بلوحة المفاتيح إطلاقاً.
                  {...(c.action
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        "aria-label": isRtl
                          ? `${c.titleAr}: ${c.ctaAr}`
                          : `${c.titleEn}: ${c.ctaEn}`,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            c.action?.();
                          }
                        },
                      }
                    : {})}
                  className={`group relative bg-white rounded-3xl p-5 md:p-6 ${c.action ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E76AC] focus-visible:ring-offset-2" : ""}`}
                  style={{
                    boxShadow: "0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div className="absolute top-0 inset-x-0 h-1 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: c.gradient }} />
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 6 }}
                    className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: c.gradient, boxShadow: "0 8px 20px rgba(0,0,0,0.12)" }}
                  >
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </motion.div>
                  <h3 className="text-base md:text-lg font-black text-[#0F1516] mb-1">
                    {isRtl ? c.titleAr : c.titleEn}
                  </h3>
                  <p className="text-sm md:text-base font-semibold mb-1" style={{ color: "#47759C" }}>
                    {isRtl ? c.valueAr : c.valueEn}
                  </p>
                  {c.sub && <p className="text-xs font-bold tabular-nums" style={{ color: "#3CC4F0" }}>{c.sub}</p>}
                  {c.ctaAr && (
                    <p className="text-xs font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                      style={{ color: "#3CC4F0" }}>
                      {isRtl ? c.ctaAr : c.ctaEn}
                      {isRtl ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form + Map */}
      <section className="py-16 md:py-20 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 items-stretch">

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="bg-white rounded-3xl p-6 md:p-8"
              style={{
                boxShadow: "0 20px 50px rgba(60,196,240,0.12), 0 4px 20px rgba(0,0,0,0.06)",
                border: "1px solid rgba(60,196,240,0.15)",
              }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}>
                <Send className="h-3.5 w-3.5" style={{ color: "#3CC4F0" }} />
                <span className="text-xs font-bold tracking-wider" style={{ color: "#47759C" }}>
                  {isRtl ? "أرسل رسالتك" : "SEND A MESSAGE"}
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-[#0F1516] mb-2 leading-tight">
                {isRtl ? "أخبرنا كيف يمكننا مساعدتك" : "Tell us how we can help"}
              </h2>
              <p className="text-sm md:text-base mb-6" style={{ color: "#47759C" }}>
                {isRtl ? "املأ النموذج وسنتواصل معك فورًا عبر واتساب" : "Fill the form and we'll reach you on WhatsApp instantly"}
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleWhatsApp(); }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#47759C" }}>
                    {isRtl ? "الاسم" : "Name"}
                  </label>
                  <div className="relative">
                    <User className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 ${isRtl ? "right-3" : "left-3"}`} style={{ color: "#94a3b8" }} />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={isRtl ? "اسمك الكامل" : "Your full name"}
                      className={`w-full h-12 rounded-xl text-sm font-medium outline-none transition-colors ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                      style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#0F1516" }}
                      onFocus={(e) => (e.target.style.borderColor = "#3CC4F0")}
                      onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#47759C" }}>
                    {isRtl ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}
                  </label>
                  <div className="relative">
                    <AtSign className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 ${isRtl ? "right-3" : "left-3"}`} style={{ color: "#94a3b8" }} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="example@email.com"
                      dir="ltr"
                      className={`w-full h-12 rounded-xl text-sm font-medium outline-none transition-colors ${isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4"}`}
                      style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#0F1516" }}
                      onFocus={(e) => (e.target.style.borderColor = "#3CC4F0")}
                      onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#47759C" }}>
                    {isRtl ? "رسالتك" : "Your Message"}
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={isRtl ? "اكتب استفسارك أو ملاحظتك..." : "Write your inquiry or feedback..."}
                    className="w-full p-4 rounded-xl text-sm font-medium outline-none resize-none transition-colors"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#0F1516" }}
                    onFocus={(e) => (e.target.style.borderColor = "#3CC4F0")}
                    onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2.5"
                  style={{
                    background: "linear-gradient(135deg, #25D366, #128C7E)",
                    boxShadow: "0 8px 24px rgba(37,211,102,0.4)",
                  }}
                >
                  <MessageCircle className="h-5 w-5" />
                  {isRtl ? "إرسال عبر واتساب" : "Send via WhatsApp"}
                </motion.button>

                {/* ♿ #94a3b8 على أبيض = 2.56:1 (راسب) · #47759C = 4.89:1
                       و #3CC4F0 = 2.03:1 (راسب) · #0E76AC = 4.99:1 */}
                <p className="text-xs text-center" style={{ color: "#47759C" }}>
                  {isRtl ? "أو اتصل بنا مباشرة على " : "Or call us directly at "}
                  <a href={`tel:+${phoneClean}`} className="font-bold" style={{ color: "#0E76AC" }} dir="ltr">
                    {settings?.phone || "+974 1234 5678"}
                  </a>
                </p>
              </form>
            </motion.div>

            {/* Map + Social */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="flex flex-col gap-5"
            >
              <div className="relative rounded-3xl overflow-hidden flex-1 min-h-[300px]"
                style={{
                  boxShadow: "0 20px 50px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(60,196,240,0.15)",
                }}>
                <iframe
                  title="Adrenaline Doha Map"
                  width="100%"
                  height="100%"
                  loading="lazy"
                  style={{ border: 0, minHeight: "300px" }}
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d115502.50820625307!2d51.4424!3d25.2854!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e45c534ffdce87f%3A0x1cfa88cf812b4032!2sDoha!5e0!3m2!1sen!2sqa!4v1700000000000"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="rounded-3xl p-6"
                style={{
                  background: "linear-gradient(135deg, #0F1516 0%, #1a2628 100%)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                }}>
                <div className="mb-4">
                  <h4 className="text-base font-black text-white">{isRtl ? "تابعنا" : "Follow Us"}</h4>
                  <p className="text-xs" style={{ color: "#BCBEBF" }}>
                    {isRtl ? "آخر العروض والوصفات" : "Latest offers and recipes"}
                  </p>
                </div>
                {(() => {
                  const socials = [
                    { url: settings?.instagramUrl, label: "Instagram", bg: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)",
                      svg: <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.9.07s-3.63 0-4.9-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.14 0-3.51.01-4.75.07-.9.04-1.38.19-1.7.32-.43.16-.73.36-1.05.68-.32.32-.52.62-.68 1.05-.13.32-.28.8-.32 1.7C3.21 8.49 3.2 8.86 3.2 12s.01 3.51.07 4.75c.04.9.19 1.38.32 1.7.16.43.36.73.68 1.05.32.32.62.52 1.05.68.32.13.8.28 1.7.32 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.9-.04 1.38-.19 1.7-.32.43-.16.73-.36 1.05-.68.32-.32.52-.62.68-1.05.13-.32.28-.8.32-1.7.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.04-.9-.19-1.38-.32-1.7a2.8 2.8 0 0 0-.68-1.05 2.8 2.8 0 0 0-1.05-.68c-.32-.13-.8-.28-1.7-.32C15.51 4.01 15.14 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 17a4.94 4.94 0 0 1 0-9.88Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.14-.94a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z"/> },
                    { url: (settings as any)?.tiktokUrl, label: "TikTok", bg: "#000",
                      svg: <path d="M16.5 3c.3 2 1.5 3.6 3.5 3.9v2.6c-1.3.1-2.5-.3-3.6-.9v5.6c0 3.2-2.4 5.4-5.3 5.4-2.7 0-4.9-2-4.9-4.7 0-2.9 2.4-4.9 5.4-4.5v2.7c-.3-.1-.7-.2-1-.2-1.2 0-2.1.9-2.1 2 0 1.2.9 2 2 2 1.2 0 2.2-.9 2.2-2.4V3h3.4Z"/> },
                    { url: (settings as any)?.snapchatUrl, label: "Snapchat", bg: "#FFFC00", fg: "#000",
                      svg: <path d="M12 2.3c2.6 0 4.4 1.9 4.5 4.5.02.5 0 1 0 1.4 0 .2.2.3.4.2.2 0 .5-.2.8-.2.4 0 .9.3.9.8 0 .6-.8.8-1.2 1-.2.1-.5.2-.5.5 0 .5 1.4 2.6 3.3 3 .3.05.5.3.5.5 0 .6-1 1-1.9 1.2-.2.03-.3.2-.35.4-.05.2-.1.5-.35.6-.3.1-.9-.1-1.6-.1-.6 0-1 .1-1.5.5-.6.5-1.3 1-2.6 1s-2-.5-2.6-1c-.5-.4-.9-.5-1.5-.5-.7 0-1.3.2-1.6.1-.25-.1-.3-.4-.35-.6-.05-.2-.15-.37-.35-.4-.9-.2-1.9-.6-1.9-1.2 0-.2.2-.45.5-.5 1.9-.4 3.3-2.5 3.3-3 0-.3-.3-.4-.5-.5-.4-.2-1.2-.4-1.2-1 0-.5.5-.8.9-.8.3 0 .6.2.8.2.2.1.4 0 .4-.2 0-.4-.02-.9 0-1.4C7.6 4.2 9.4 2.3 12 2.3Z"/> },
                    { url: settings?.twitterUrl, label: "X", bg: "#000",
                      svg: <path d="M17.5 3h3l-6.6 7.5L21.7 21h-5.9l-4.6-6-5.3 6H2.9l7-8L2.3 3h6l4.2 5.5L17.5 3Zm-1 16h1.6L7.6 4.6H5.9L16.5 19Z"/> },
                    { url: settings?.facebookUrl, label: "Facebook", bg: "#1877F2",
                      svg: <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.75-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/> },
                  ].filter(s => s.url && String(s.url).trim());

                  if (socials.length === 0) return (
                    <p className="text-sm" style={{ color: "#BCBEBF" }}>
                      {isRtl ? "أضف روابط التواصل من لوحة التحكم." : "Add social links from the dashboard."}
                    </p>
                  );
                  return (
                    <div className="flex flex-wrap gap-3">
                      {socials.map((s, i) => (
                        <motion.a key={i}
                          whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.95 }}
                          href={String(s.url).trim()} target="_blank" rel="noreferrer"
                          aria-label={s.label} title={s.label}
                          className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                          style={{ background: s.bg }}
                        >
                          <svg viewBox="0 0 24 24" width="22" height="22" fill={s.fg || "#fff"}>{s.svg}</svg>
                        </motion.a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
