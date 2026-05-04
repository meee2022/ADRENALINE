/**
 * @file client/src/pages/public/AboutPage.tsx
 * @description صفحة من نحن - About Us
 */
import { PublicLayout } from "@/components/public/PublicLayout";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { MessageCircle, Phone, MapPin, Clock, Heart, Award, Users, Utensils } from "lucide-react";

export default function AboutPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const settings = useQuery(api.restaurantSettings.get);

  const getWhatsAppUrl = () => {
    const phone = settings?.whatsappNumber || settings?.phone || "97455555555";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleanPhone}`;
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0F1516] via-[#47759C] to-[#3CC4F0] text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-10 pb-16 md:pt-12 md:pb-20 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="/adrenaline-logo-full.png"
              alt="Adrenaline Healthy Food"
              className="h-10 md:h-12 w-auto drop-shadow-xl"
            />
          </div>
          <h1 className="text-2xl md:text-4xl font-black mb-1 tracking-tight">
            {isRtl ? "من نحن" : "About Us"}
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-lg mx-auto mt-3">
            {isRtl
              ? "نؤمن أن الأكل الصحي مش لازم يكون ممل — اعرف أكثر عنّا"
              : "We believe healthy eating shouldn't be boring — learn more about us"}
          </p>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-12 md:h-20">
            <path
              fill="#F9FAFB"
              fillOpacity="1"
              d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-10 md:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
            {/* Text */}
            <div>
              <p className="text-[#3CC4F0] font-semibold text-sm uppercase tracking-wider mb-2">
                {isRtl ? "قصتنا" : "Our Story"}
              </p>
              <h2 className="text-2xl md:text-4xl font-bold text-[#0F1516] mb-4 md:mb-6">
                {isRtl ? (
                  <>أكل صحي بنكهة <span className="text-[#3CC4F0]">مختلفة</span></>
                ) : (
                  <>Healthy food with a <span className="text-[#3CC4F0]">different</span> flavor</>
                )}
              </h2>
              <div className="space-y-3 md:space-y-4 text-sm md:text-base text-gray-600 leading-relaxed">
                <p>
                  {isRtl
                    ? "في Adrenaline، بدأنا برؤية واضحة: نوفّر وجبات صحية لذيذة ومتوازنة يتم تحضيرها يومياً من مكونات طازجة 100%، بدون تجميد وبدون مواد حافظة."
                    : "At Adrenaline, we started with a clear vision: to provide delicious, balanced healthy meals prepared daily from 100% fresh ingredients, without freezing and without preservatives."}
                </p>
                <p>
                  {isRtl
                    ? "فريقنا من أخصائيي التغذية والطهاة المحترفين يعملون جنباً إلى جنب لتصميم خطط غذائية تناسب كل الأهداف — سواء كنت تبحث عن تنحيف، بناء عضلات، أو مجرد أسلوب حياة صحي."
                    : "Our team of nutritionists and professional chefs work side by side to design meal plans that suit all goals — whether you're looking to lose weight, build muscle, or simply live a healthier lifestyle."}
                </p>
                <p>
                  {isRtl
                    ? "نوصل وجباتك لباب بيتك في الوقت المحدد — صباحاً أو مساءً — عشان تركز على أهدافك وتترك التفاصيل علينا."
                    : "We deliver your meals to your doorstep on time — morning or evening — so you can focus on your goals and leave the details to us."}
                </p>
              </div>
            </div>

            {/* Stats Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-[#E8F7FC] to-[#d0f0fa] rounded-3xl p-5 md:p-12">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-white rounded-2xl p-3 md:p-5 text-center shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-2xl md:text-4xl mb-1 md:mb-2">🥗</div>
                    <div className="text-xl md:text-2xl font-black text-[#3CC4F0]">500+</div>
                    <div className="text-xs text-gray-500">{isRtl ? "وجبة يومياً" : "Daily Meals"}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 md:p-5 text-center shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-2xl md:text-4xl mb-1 md:mb-2">👨‍🍳</div>
                    <div className="text-xl md:text-2xl font-black text-[#3CC4F0]">15+</div>
                    <div className="text-xs text-gray-500">{isRtl ? "طاهٍ محترف" : "Pro Chefs"}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 md:p-5 text-center shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-2xl md:text-4xl mb-1 md:mb-2">🏆</div>
                    <div className="text-xl md:text-2xl font-black text-[#3CC4F0]">3+</div>
                    <div className="text-xs text-gray-500">{isRtl ? "سنوات خبرة" : "Years Experience"}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 md:p-5 text-center shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-2xl md:text-4xl mb-1 md:mb-2">❤️</div>
                    <div className="text-xl md:text-2xl font-black text-[#3CC4F0]">2000+</div>
                    <div className="text-xs text-gray-500">{isRtl ? "عميل سعيد" : "Happy Clients"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-10 md:py-20 bg-gradient-to-b from-[#E8F7FC]/30 to-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6 md:mb-12">
            <p className="text-[#3CC4F0] font-semibold text-sm uppercase tracking-wider mb-2">
              {isRtl ? "قيمنا" : "Our Values"}
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-[#0F1516]">
              {isRtl ? "ما الذي يميّزنا" : "What Makes Us Different"}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <div className="group bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 text-center border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mx-auto h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#fce4ec] to-[#f8a4b8] flex items-center justify-center mb-3 md:mb-4 shadow-lg shadow-[#f8a4b8]/30 group-hover:scale-110 transition-transform">
                <Heart className="h-5 w-5 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "شغف حقيقي" : "True Passion"}</h3>
              <p className="text-xs md:text-sm text-gray-500 hidden sm:block">{isRtl ? "نحب اللي نسويه وهذا ينعكس على جودة وجباتنا" : "We love what we do and it reflects in our meal quality"}</p>
            </div>

            <div className="group bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 text-center border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mx-auto h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#d4f5e9] to-[#a8e6cf] flex items-center justify-center mb-3 md:mb-4 shadow-lg shadow-[#a8e6cf]/30 group-hover:scale-110 transition-transform">
                <Utensils className="h-5 w-5 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "جودة بلا تنازل" : "Uncompromised Quality"}</h3>
              <p className="text-xs md:text-sm text-gray-500 hidden sm:block">{isRtl ? "أفضل المكونات الطازجة كل يوم بدون استثناء" : "The finest fresh ingredients every day, no exceptions"}</p>
            </div>

            <div className="group bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 text-center border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mx-auto h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#e8eaf6] to-[#b39ddb] flex items-center justify-center mb-3 md:mb-4 shadow-lg shadow-[#b39ddb]/30 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "فريق متخصص" : "Expert Team"}</h3>
              <p className="text-xs md:text-sm text-gray-500 hidden sm:block">{isRtl ? "أخصائيو تغذية وطهاة يعملون لأجل صحتك" : "Nutritionists & chefs working for your health"}</p>
            </div>

            <div className="group bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 text-center border-2 border-[#E8F7FC] hover:border-[#3CC4F0]/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mx-auto h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#fff3e0] to-[#ffb74d] flex items-center justify-center mb-3 md:mb-4 shadow-lg shadow-[#ffb74d]/30 group-hover:scale-110 transition-transform">
                <Award className="h-5 w-5 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "ثقة عملائنا" : "Client Trust"}</h3>
              <p className="text-xs md:text-sm text-gray-500 hidden sm:block">{isRtl ? "آلاف العملاء يثقون بنا لتحقيق أهدافهم الصحية" : "Thousands of clients trust us for their health goals"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / CTA Section */}
      <section className="py-10 md:py-20 bg-gradient-to-b from-[#E8F7FC]/40 to-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-br from-[#E8F7FC] to-[#d0f0fa] border-2 border-[#3CC4F0]/20 rounded-3xl p-5 md:p-12 text-center overflow-hidden relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3CC4F0]/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#3CC4F0]/15 rounded-full blur-2xl" />

            <div className="relative">
              <h2 className="text-xl md:text-3xl font-bold mb-2 md:mb-3 text-[#0F1516]">
                {isRtl ? "جاهز تبدأ رحلتك الصحية؟" : "Ready to start your health journey?"}
              </h2>
              <p className="text-sm md:text-base text-[#47759C] mb-5 md:mb-8 max-w-md mx-auto">
                {isRtl
                  ? "تواصل معنا الآن واحصل على استشارة مجانية من أخصائية التغذية"
                  : "Contact us now and get a free consultation from our nutritionist"}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 h-11 md:h-14 px-6 md:px-8 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-sm md:text-lg rounded-2xl shadow-lg shadow-[#25D366]/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
                  {isRtl ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
                </a>
                <a
                  href={`tel:+${(settings?.phone || "97455555555").replace(/[^0-9]/g, "")}`}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 h-11 md:h-14 px-6 md:px-8 bg-white hover:bg-[#3CC4F0] text-[#0F1516] hover:text-white font-bold text-sm md:text-lg rounded-2xl border-2 border-[#3CC4F0]/30 hover:border-[#3CC4F0] shadow-sm transition-all duration-300"
                >
                  <Phone className="h-5 w-5 md:h-6 md:w-6" />
                  {isRtl ? "اتصل بنا" : "Call Us"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-8 md:py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
            <div className="bg-white rounded-2xl p-4 md:p-6 text-center shadow-sm border border-gray-100">
              <div className="mx-auto h-9 w-9 md:h-12 md:w-12 rounded-xl bg-[#E8F7FC] flex items-center justify-center mb-3">
                <Phone className="h-4 w-4 md:h-6 md:w-6 text-[#3CC4F0]" />
              </div>
              <h4 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "الهاتف" : "Phone"}</h4>
              <p className="text-xs md:text-sm text-gray-500 direction-ltr">{settings?.phone || "+974 5555 5555"}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 md:p-6 text-center shadow-sm border border-gray-100">
              <div className="mx-auto h-9 w-9 md:h-12 md:w-12 rounded-xl bg-[#E8F7FC] flex items-center justify-center mb-3">
                <MapPin className="h-4 w-4 md:h-6 md:w-6 text-[#3CC4F0]" />
              </div>
              <h4 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "العنوان" : "Address"}</h4>
              <p className="text-xs md:text-sm text-gray-500">{isRtl ? settings?.addressAr : settings?.addressEn || "Qatar"}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 md:p-6 text-center shadow-sm border border-gray-100">
              <div className="mx-auto h-9 w-9 md:h-12 md:w-12 rounded-xl bg-[#E8F7FC] flex items-center justify-center mb-3">
                <Clock className="h-4 w-4 md:h-6 md:w-6 text-[#3CC4F0]" />
              </div>
              <h4 className="text-sm md:text-base font-bold text-[#0F1516] mb-1">{isRtl ? "ساعات العمل" : "Working Hours"}</h4>
              <p className="text-xs md:text-sm text-gray-500">{isRtl ? settings?.workingHoursAr || "يومياً ٧ صباحاً - ١٠ مساءً" : settings?.workingHoursEn || "Daily 7AM - 10PM"}</p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
