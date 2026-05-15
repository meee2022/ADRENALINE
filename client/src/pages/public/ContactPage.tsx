/**
 * @file client/src/pages/public/ContactPage.tsx
 * @description Premium Contact page — bilingual, with form, info cards, map
 */
import * as React from "react";
import { motion } from "framer-motion";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PremiumPageHero } from "@/components/public/PremiumPageHero";
import { PremiumFooter } from "@/components/public/PremiumSections";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import {
  MessageCircle, Phone, MapPin, Clock, Instagram, Send,
  ArrowLeft, ArrowRight, User, AtSign,
} from "lucide-react";

export default function ContactPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
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
      <PremiumPageHero
        badgeIcon={<MessageCircle className="h-4 w-4" />}
        badgeAr="تواصل معنا" badgeEn="GET IN TOUCH"
        titleAr={<>نحن <span style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>هنا لخدمتك</span></>}
        titleEn={<>We're <span style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Here For You</span></>}
        subtitleAr="عندك سؤال؟ تحتاج مساعدة في اختيار خطتك؟ فريقنا جاهز للرد عليك في أي وقت"
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
                  className={`group relative bg-white rounded-3xl p-5 md:p-6 ${c.action ? "cursor-pointer" : ""}`}
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
                {isRtl ? "خبرنا كيف نقدر نساعدك" : "Tell us how we can help"}
              </h2>
              <p className="text-sm md:text-base mb-6" style={{ color: "#47759C" }}>
                {isRtl ? "املأ النموذج وراح نتواصل معاك على واتساب فوراً" : "Fill the form and we'll reach you on WhatsApp instantly"}
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

                <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
                  {isRtl ? "أو اتصل بنا مباشرة على " : "Or call us directly at "}
                  <a href={`tel:+${phoneClean}`} className="font-bold" style={{ color: "#3CC4F0" }} dir="ltr">
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
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                    <Instagram className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">{isRtl ? "تابعنا" : "Follow Us"}</h4>
                    <p className="text-xs" style={{ color: "#BCBEBF" }}>
                      {isRtl ? "آخر العروض والوصفات" : "Latest offers and recipes"}
                    </p>
                  </div>
                </div>
                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full h-11 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 text-white"
                  style={{ background: "linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)" }}
                >
                  <Instagram className="h-4 w-4" />
                  @adrenaline_qa
                </motion.a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
