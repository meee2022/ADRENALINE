import { PublicLayout } from "@/components/public/PublicLayout";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { MessageCircle, Phone, Mail, MapPin, Clock, Send } from "lucide-react";

export default function ContactPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const settings = useQuery(api.restaurantSettings.get);

  const getWhatsAppUrl = (message?: string) => {
    const phone = settings?.whatsappNumber || settings?.phone || "97455555555";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const text = message ? encodeURIComponent(message) : "";
    return `https://wa.me/${cleanPhone}${text ? `?text=${text}` : ""}`;
  };

  const contactCards = [
    {
      icon: <Phone className="h-7 w-7 text-white" />,
      iconBg: "from-[#d4f5e9] to-[#a8e6cf]",
      iconShadow: "shadow-[#a8e6cf]/30",
      title: isRtl ? "هاتف" : "Phone",
      value: settings?.phone || "+974 5555 5555",
      href: `tel:${(settings?.phone || "+97455555555").replace(/[^0-9+]/g, "")}`,
      external: false,
    },
    {
      icon: <MessageCircle className="h-7 w-7 text-white" />,
      iconBg: "from-[#bbf7d0] to-[#22c55e]",
      iconShadow: "shadow-[#22c55e]/30",
      title: "WhatsApp",
      value: settings?.whatsappNumber || settings?.phone || "+974 5555 5555",
      href: getWhatsAppUrl(isRtl ? "مرحباً، أريد الاستفسار عن خدماتكم" : "Hello, I'd like to inquire about your services"),
      external: true,
    },
    {
      icon: <Mail className="h-7 w-7 text-white" />,
      iconBg: "from-[#e8eaf6] to-[#b39ddb]",
      iconShadow: "shadow-[#b39ddb]/30",
      title: isRtl ? "البريد الإلكتروني" : "Email",
      value: settings?.email || "info@adrenaline.qa",
      href: `mailto:${settings?.email || "info@adrenaline.qa"}`,
      external: false,
    },
    {
      icon: <MapPin className="h-7 w-7 text-white" />,
      iconBg: "from-[#fce4ec] to-[#f8a4b8]",
      iconShadow: "shadow-[#f8a4b8]/30",
      title: isRtl ? "العنوان" : "Address",
      value: isRtl ? (settings?.addressAr || "الدوحة، قطر") : (settings?.addressEn || "Doha, Qatar"),
      href: undefined,
      external: false,
    },
    {
      icon: <Clock className="h-7 w-7 text-white" />,
      iconBg: "from-[#fff3e0] to-[#ffb74d]",
      iconShadow: "shadow-[#ffb74d]/30",
      title: isRtl ? "ساعات العمل" : "Working Hours",
      value: isRtl
        ? (settings?.workingHoursAr || "يومياً ٧ صباحاً - ١٠ مساءً")
        : (settings?.workingHoursEn || "Daily 7AM - 10PM"),
      href: undefined,
      external: false,
    },
  ];

  const socialLinks = [
    settings?.instagramUrl && { href: settings.instagramUrl, label: "Instagram", icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    )},
    settings?.twitterUrl && { href: settings.twitterUrl, label: "X (Twitter)", icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
      </svg>
    )},
    settings?.facebookUrl && { href: settings.facebookUrl, label: "Facebook", icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    )},
    settings?.tiktokUrl && { href: settings.tiktokUrl, label: "TikTok", icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    )},
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0F1516] via-[#47759C] to-[#3CC4F0] text-white overflow-hidden">

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-10 pb-16 md:pt-12 md:pb-20 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-4 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-sm font-medium text-white/90">
              {isRtl ? "متاحون على مدار الساعة" : "Available 24/7"}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black mb-1 tracking-tight leading-tight">
            {isRtl ? (
              <>
                تواصل{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">معنا</span>
                  <span className="absolute inset-x-0 bottom-1 h-3 bg-[#3CC4F0]/50 -rotate-1 rounded-sm" />
                </span>
              </>
            ) : (
              <>
                Get In{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">Touch</span>
                  <span className="absolute inset-x-0 bottom-1 h-3 bg-[#3CC4F0]/50 -rotate-1 rounded-sm" />
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-base text-white/70 max-w-md mx-auto mt-3 mb-6 leading-relaxed">
            {isRtl
              ? "سواء كان لديك سؤال عن الخطط أو تريد الاشتراك — نحن هنا لمساعدتك"
              : "Whether you have a question about our plans or want to subscribe — we're here to help"}
          </p>

          {/* Channel chips */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 backdrop-blur-sm">
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              <span className="text-sm font-semibold">WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 backdrop-blur-sm">
              <Phone className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold">{isRtl ? "هاتف" : "Phone"}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 backdrop-blur-sm">
              <Mail className="h-4 w-4 text-purple-300" />
              <span className="text-sm font-semibold">{isRtl ? "بريد إلكتروني" : "Email"}</span>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-12 md:h-20">
            <path
              fill="#ffffff"
              fillOpacity="1"
              d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-[#E8F7FC]/30 to-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[#3CC4F0] font-semibold text-sm uppercase tracking-wider mb-2">
              {isRtl ? "وسائل التواصل" : "Get In Touch"}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F1516]">
              {isRtl ? "كيف تصلنا؟" : "How to Reach Us"}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {contactCards.map((card, i) => {
              const inner = (
                <div className="group bg-white rounded-3xl p-6 text-center border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div
                    className={`mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br ${card.iconBg} flex items-center justify-center mb-4 shadow-lg ${card.iconShadow} group-hover:scale-110 transition-transform`}
                  >
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-[#0F1516] mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed break-all">{card.value}</p>
                  {card.href && (
                    <span className="inline-block mt-3 text-xs text-[#3CC4F0] font-semibold">
                      {isRtl ? "← اضغط للتواصل" : "Tap to connect →"}
                    </span>
                  )}
                </div>
              );

              return card.href ? (
                <a
                  key={i}
                  href={card.href}
                  target={card.external ? "_blank" : undefined}
                  rel={card.external ? "noopener noreferrer" : undefined}
                  className="block"
                >
                  {inner}
                </a>
              ) : (
                <div key={i}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WhatsApp CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-br from-[#0F1516] to-[#1a2526] rounded-3xl p-8 md:p-12 text-center text-white overflow-hidden relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3CC4F0]/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#3CC4F0]/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-[#25D366]/20 flex items-center justify-center mb-6">
                <MessageCircle className="h-8 w-8 text-[#25D366]" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                {isRtl ? "تحدث معنا مباشرة على واتساب" : "Chat with us directly on WhatsApp"}
              </h2>
              <p className="text-white/70 mb-8 max-w-md mx-auto">
                {isRtl
                  ? "فريقنا جاهز للإجابة على استفساراتك وتقديم استشارة مجانية"
                  : "Our team is ready to answer your inquiries and provide a free consultation"}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={getWhatsAppUrl(isRtl ? "مرحباً، أريد الاستفسار عن خدماتكم" : "Hello, I'd like to inquire about your services")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 h-14 px-8 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-lg rounded-2xl shadow-lg shadow-[#25D366]/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <MessageCircle className="h-6 w-6" />
                  {isRtl ? "ابدأ المحادثة" : "Start Chat"}
                </a>
                <a
                  href={`tel:${(settings?.phone || "97455555555").replace(/[^0-9]/g, "")}`}
                  className="flex items-center gap-3 h-14 px-8 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-2xl border border-white/20 transition-all duration-300"
                >
                  <Phone className="h-6 w-6" />
                  {isRtl ? "اتصل بنا" : "Call Us"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Media */}
      {socialLinks.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-[#3CC4F0] font-semibold text-sm uppercase tracking-wider mb-6">
              {isRtl ? "تابعنا على" : "Follow Us On"}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 h-12 px-5 rounded-2xl bg-white border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 hover:shadow-md text-[#0F1516] font-semibold transition-all duration-300 hover:scale-105"
                >
                  <span className="text-[#3CC4F0]">{social.icon}</span>
                  <span className="text-sm">{social.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-[#0F1516]">
              {isRtl ? "أسئلة شائعة" : "Common Questions"}
            </h3>
          </div>
          <div className="space-y-4">
            {(isRtl ? [
              { q: "كيف أشترك في الخطط؟", a: "تواصل معنا عبر واتساب أو اتصل بنا وسنساعدك في اختيار الخطة المناسبة لأهدافك." },
              { q: "هل يمكنني تغيير خطتي الغذائية؟", a: "نعم، يمكنك تعديل خطتك في أي وقت بالتواصل مع فريقنا." },
              { q: "ما هي مواعيد التوصيل؟", a: "نوفر توصيل صباحي ومسائي حسب تفضيلك عند التسجيل." },
            ] : [
              { q: "How do I subscribe to a plan?", a: "Contact us via WhatsApp or call us and we'll help you choose the right plan for your goals." },
              { q: "Can I change my meal plan?", a: "Yes, you can modify your plan at any time by contacting our team." },
              { q: "What are the delivery times?", a: "We offer morning and evening delivery based on your preference at registration." },
            ]).map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-lg bg-[#E8F7FC] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Send className="h-3.5 w-3.5 text-[#3CC4F0]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F1516] mb-1">{faq.q}</p>
                    <p className="text-sm text-gray-500">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
