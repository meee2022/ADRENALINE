/**
 * @file client/src/components/public/PublicLayout.tsx
 * @description Layout for public pages (no sidebar)
 */
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Home, UtensilsCrossed, CalendarDays, Globe, LayoutDashboard, User, LogOut, Check, Sparkles, Calculator, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import ChatBot from "@/components/public/ChatBot";
import { restaurantFromPath } from "@/lib/restaurantBrand";
import { setBrowseOnly } from "@/lib/customerIdentity";

interface PublicLayoutProps {
  children: ReactNode;
  isRtl?: boolean;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const restaurant = restaurantFromPath();
  const { language, setLanguage, dir, t } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, currentCustomer, customerLogout } = useStore();
  
  // Fetch restaurant settings from database
  const restaurantSettings = useQuery(api.restaurantSettings.get);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  if (restaurant.key === "NUTRI_RESET") {
    const smartPath = "/customer/smart-plan?restaurant=NUTRI_RESET";
    const openBrowseMenu = () => setBrowseOnly();
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="nutri-reset-theme min-h-screen bg-[#fbfdfd] text-[#55565a]">
        <header className="sticky top-0 z-50 border-b-[3px] border-[#079AA5] bg-[linear-gradient(115deg,#d85b0b_0%,#f47721_58%,#ff8c3d_100%)] shadow-[0_14px_35px_-22px_rgba(180,72,5,.85)]">
          <div className="mx-auto flex min-h-[84px] max-w-7xl items-center justify-between gap-3 px-3 sm:min-h-[96px] sm:px-6">
            <a href={restaurant.menuPath} onClick={openBrowseMenu} className="shrink-0 rounded-2xl border border-white/50 bg-white px-3 py-1.5 shadow-[0_10px_26px_-18px_rgba(0,0,0,.65)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white">
              <img src={restaurant.logo} alt="Nutri Reset" className="h-12 w-auto max-w-[190px] object-contain sm:h-16 sm:max-w-[260px] lg:h-[68px] lg:max-w-[300px]" />
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              <a href={restaurant.menuPath} onClick={openBrowseMenu} className="rounded-xl px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-white/15">{isRtl ? "تصفح قائمة الوجبات" : "Browse meals"}</a>
              <a href={smartPath} className="rounded-xl px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-white/15">{isRtl ? "الخطة الذكية" : "Smart plan"}</a>
            </nav>
            <div className="flex items-center gap-2">
              <a href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="hidden rounded-full border border-white/70 bg-white px-4 py-2.5 text-xs font-black text-[#D85B0B] shadow-[0_8px_20px_-12px_rgba(88,34,2,.75)] transition-colors hover:bg-[#fff7f1] sm:inline-flex sm:text-sm">
                {isRtl ? "تواصل معنا" : "Contact"}
              </a>
              <Button onClick={toggleLanguage} variant="ghost" size="icon" className="rounded-full border border-white/25 text-white hover:bg-white/15 hover:text-white">
                <Globe className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        <main className="public-safe-content pb-20 md:pb-0">{children}</main>
        <nav aria-label={isRtl ? "التنقل السريع" : "Quick navigation"} className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#079AA5]/20 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_-20px_rgba(7,154,165,.65)] backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
            <a href={restaurant.menuPath} onClick={openBrowseMenu} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black text-[#087E87] transition-colors hover:bg-[#edf9f8]">
              <UtensilsCrossed className="h-5 w-5" />
              <span>{isRtl ? "تصفح الوجبات" : "Browse meals"}</span>
            </a>
            <a href={smartPath} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-[#edf9f8] text-[11px] font-black text-[#087E87] transition-colors hover:bg-[#dff5f3]">
              <Sparkles className="h-5 w-5" />
              <span>{isRtl ? "الخطة الذكية" : "Smart plan"}</span>
            </a>
            <a href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black text-[#F47721] transition-colors hover:bg-[#fff4ec]">
              <MessageCircle className="h-5 w-5" />
              <span>{isRtl ? "تواصل معنا" : "Contact"}</span>
            </a>
          </div>
        </nav>
        <footer className="mt-16 border-t border-[#079AA5]/25 bg-[#079AA5] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 pb-28 md:grid-cols-[1.2fr_.8fr] md:items-end md:pb-10">
            <div>
              <img src={restaurant.logo} alt="Nutri Reset" className="mb-4 h-16 w-auto max-w-[260px] rounded-xl bg-white px-3 py-2 object-contain" />
              <p className="max-w-xl text-sm font-semibold leading-7 text-white/90">
                {isRtl ? "خطط غذائية تناسب أهدافك وأسلوب حياتك، بوجبات صحية ومكونات حقيقية تصل إلى بابك." : "Nutrition plans built around your goals and lifestyle, with healthy meals and real ingredients delivered to your door."}
              </p>
            </div>
            <div className="md:text-end">
              <p className="text-xs font-black uppercase tracking-[.18em] text-white/75">Reset your body. Rebalance your life.</p>
              <a href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`} className="mt-3 inline-flex rounded-full bg-[#F47721] px-5 py-2.5 text-sm font-black text-white">{restaurant.phone}</a>
              <p className="mt-4 text-xs text-white/70">© {new Date().getFullYear()} Nutri Reset</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="public-site-shell min-h-screen bg-white">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 border-b border-[#3CC4F0]/35 bg-white/95 shadow-[0_8px_28px_rgba(15,39,56,0.08)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1720px] px-4 sm:px-6 xl:px-8">
          <div className="flex min-h-[72px] items-center justify-between gap-5">
            {/* Logo */}
            <a href="/" className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#3CC4F0]">
              <img
                src="/adrenaline-logo.png"
                alt="Adrenaline"
                className="h-8 w-auto xl:h-9"
              />
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex">
              <a href="/" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "الرئيسية" : "Home"}
              </a>
              <a href="/public/plans" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "الخطط" : "Plans"}
              </a>
              <a href="/public/menu" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "قائمة الوجبات" : "Menu"}
              </a>
              <a href="/public/calorie-calculator" className="flex whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC] items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                {isRtl ? "حاسبة السعرات" : "Calorie Calculator"}
              </a>
              <a href="/customer/smart-plan"
                className="mx-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#3CC4F0]/45 bg-[#EAF8FD] px-3 py-2 text-[14px] font-bold text-[#0E76AC] transition-colors hover:border-[#0E76AC] hover:bg-[#0E76AC] hover:text-white">
                <Sparkles className="h-3.5 w-3.5" />
                {isRtl ? "خطتي الذكية" : "Smart Plan"}
              </a>
              <a href="/public/how-to-subscribe" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "كيف تشترك" : "Subscribe"}
              </a>
              <a href="/public/about" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "من نحن" : "About"}
              </a>
              <a href="/public/contact" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[14px] font-semibold text-[#20384A] transition-colors hover:bg-[#EAF8FD] hover:text-[#0E76AC]">
                {isRtl ? "تواصل" : "Contact"}
              </a>
            </nav>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5 xl:border-s xl:border-slate-200 xl:ps-4">
              {/* Dashboard Button - Show only for logged in admin users */}
              {currentUser && (
                <>
                  <Button
                    onClick={() => window.location.href = "/dashboard"}
                    variant="outline"
                    className="hidden h-10 items-center gap-2 rounded-xl border border-[#0E76AC]/45 bg-white px-4 font-bold text-[#0E76AC] shadow-sm hover:border-[#0E76AC] hover:bg-[#EAF8FD] xl:flex"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {isRtl ? "لوحة التحكم" : "Dashboard"}
                  </Button>
                  
                  {/* Logout Button for Admin */}
                  <Button
                    onClick={() => {
                      const { logout } = useStore.getState();
                      logout();
                      window.location.href = "/";
                    }}
                    variant="outline"
                    className="hidden size-10 rounded-xl border border-slate-200 bg-white p-0 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 xl:flex"
                    aria-label={isRtl ? "تسجيل الخروج" : "Logout"}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Language Switcher */}
              <Button
                onClick={toggleLanguage}
                variant="ghost"
                size="sm"
                className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-[#0E76AC] hover:bg-[#EAF8FD] xl:flex"
              >
                <Globe className="h-4 w-4 text-[#0E76AC]" />
                <span className="font-bold text-[#0E76AC]">
                  {language === "ar" ? "EN" : "ع"}
                </span>
              </Button>

              {/* Login Button - Desktop - Show only if not logged in */}
              {!currentUser && !currentCustomer && (
                <Button
                  onClick={() => window.location.href = "/login"}
                  variant="outline"
                  className="hidden h-10 rounded-xl border border-[#0E76AC]/45 bg-white px-4 font-bold text-[#0E76AC] hover:bg-[#EAF8FD] xl:flex"
                >
                  {isRtl ? "تسجيل دخول" : "Login"}
                </Button>
              )}

              {/* Customer Profile Button - Show only for logged in customers */}
              {currentCustomer && (
                <>
                  {/* Customer Name */}
                  <span className="hidden text-sm font-medium text-[#0F1516] xl:block">
                    {isRtl ? "مرحباً، " : "Hi, "}
                    {currentCustomer.fullName.split(" ")[0]}
                  </span>
                  
                  <Button
                    onClick={() => window.location.href = "/customer/profile"}
                    variant="outline"
                    className="hidden h-10 items-center gap-2 rounded-xl border border-[#0E76AC]/45 bg-white px-4 font-bold text-[#0E76AC] hover:bg-[#EAF8FD] xl:flex"
                  >
                    <User className="h-4 w-4" />
                    {isRtl ? "حسابي" : "My Profile"}
                  </Button>
                </>
              )}

              {/* Logout Button - Show only for logged in customers */}
              {currentCustomer && (
                <Button
                  onClick={() => {
                    customerLogout();
                    window.location.href = "/";
                  }}
                  variant="ghost"
                  className="hidden size-10 rounded-xl p-0 hover:bg-red-50 hover:text-red-600 xl:flex"
                  aria-label={isRtl ? "تسجيل الخروج" : "Logout"}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}

              {/* Subscribe Button — يفتح صفحة الخطط لاختيار باقة */}
              <a href="/public/plans" className="hidden xl:block">
                <Button className="h-10 rounded-xl bg-[#0E76AC] px-5 font-bold text-white shadow-[0_6px_16px_rgba(14,118,172,0.2)] hover:bg-[#095F8B]">
                  {isRtl ? "اشترك الآن" : "Subscribe"}
                </Button>
              </a>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                aria-label={isRtl ? "فتح القائمة" : "Open menu"}
                className="size-10 rounded-xl border border-slate-200 text-[#163A52] hover:bg-[#EAF8FD] xl:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mt-2 space-y-1 border-t border-slate-200 pb-4 pt-3 xl:hidden"
              onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMobileMenuOpen(false); }}>
              {/* Dashboard Link - Show only for logged in admin users */}
              {currentUser && (
                <>
                  <a
                    href="/dashboard"
                    className="block py-2 px-4 text-[#0E76AC] font-bold hover:bg-[#3CC4F0]/10 rounded-lg flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {isRtl ? "لوحة التحكم" : "Dashboard"}
                  </a>
                  
                  {/* Logout Button for Admin */}
                  <button
                    onClick={() => {
                      const { logout } = useStore.getState();
                      logout();
                      window.location.href = "/";
                    }}
                    className="w-full text-left py-2 px-4 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {isRtl ? "تسجيل الخروج" : "Logout"}
                  </button>
                </>
              )}
              
              <a
                href="/"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "الرئيسية" : "Home"}
              </a>
              <a
                href="/public/plans"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "الخطط" : "Plans"}
              </a>
              <a
                href="/public/menu"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "قائمة الوجبات" : "Menu"}
              </a>
              <a
                href="/customer/smart-plan"
                className="block py-2 px-4 rounded-lg font-bold text-[#0E76AC] bg-[#3AC7F4]/10 hover:bg-[#3AC7F4]/20 flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isRtl ? "خطتي الذكية" : "Smart Plan"}
              </a>
              <a
                href="/public/calorie-calculator"
                className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-[#0F1516] hover:bg-[#3CC4F0]/10"
              >
                <Calculator className="h-4 w-4 text-[#0E76AC]" />
                {isRtl ? "حاسبة السعرات" : "Calorie Calculator"}
              </a>
              <a
                href="/public/how-to-subscribe"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "كيف تشترك" : "How to Subscribe"}
              </a>
              <a
                href="/public/about"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "من نحن" : "About"}
              </a>
              <a
                href="/public/contact"
                className="block py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                {isRtl ? "تواصل معنا" : "Contact"}
              </a>
              <a
                href="/public/track"
                className="block py-2 px-4 text-[#0E76AC] hover:bg-[#3CC4F0]/10 rounded-lg font-medium"
              >
                📦 {isRtl ? "تتبع طلبي" : "Track Order"}
              </a>
              <button
                onClick={toggleLanguage}
                className="w-full text-left py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium flex items-center gap-2"
              >
                <Globe className="h-4 w-4 text-[#0E76AC]" />
                {language === "ar" ? "English" : "العربية"}
              </button>
              
              {/* Customer Profile Link - Show only for logged in customers */}
              {currentCustomer && (
                <>
                  <div className="py-2 px-4 bg-[#3CC4F0]/10 rounded-lg">
                    <p className="text-sm font-medium text-[#0F1516]">
                      {isRtl ? "مرحباً، " : "Hi, "}
                      <span className="font-bold text-[#0E76AC]">{currentCustomer.fullName}</span>
                    </p>
                  </div>
                  <a
                    href="/customer/profile"
                    className="block py-2 px-4 text-[#0E76AC] font-bold hover:bg-[#3CC4F0]/10 rounded-lg flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    {isRtl ? "حسابي" : "My Profile"}
                  </a>
                  <button
                    onClick={() => {
                      customerLogout();
                      window.location.href = "/";
                    }}
                    className="w-full text-left py-2 px-4 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {isRtl ? "تسجيل الخروج" : "Logout"}
                  </button>
                </>
              )}

              {/* Login Button - Show only if not logged in */}
              {!currentUser && !currentCustomer && (
                <Button
                  onClick={() => window.location.href = "/login"}
                  variant="outline"
                  className="w-full justify-center h-10 rounded-full border-2 border-[#0E76AC] text-[#0E76AC] font-bold"
                >
                  {isRtl ? "تسجيل دخول" : "Login"}
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="public-safe-content pb-20 md:pb-0">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="flex items-center justify-around py-2">
          {/* Show Dashboard button for logged in users */}
          {currentUser ? (
            <>
              <a
                href="/"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <Home className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "الرئيسية" : "Home"}</span>
              </a>
              <a
                href="/public/plans"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "الخطط" : "Plans"}</span>
              </a>
              <a
                href="/public/menu"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <UtensilsCrossed className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "قائمة الوجبات" : "Menu"}</span>
              </a>
              <a
                href="/dashboard"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#0E76AC] hover:text-[#47759C] transition-colors"
              >
                <LayoutDashboard className="h-6 w-6" />
                <span className="text-xs font-bold">{isRtl ? "لوحة التحكم" : "Dashboard"}</span>
              </a>
            </>
          ) : (
            <>
              <a
                href="/"
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <Home className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "الرئيسية" : "Home"}</span>
              </a>
              <a
                href="/public/plans"
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <CalendarDays className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "الخطط" : "Plans"}</span>
              </a>
              <a
                href="/public/menu"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <UtensilsCrossed className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "قائمة الوجبات" : "Menu"}</span>
              </a>
              <a
                href="/public/about"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="8" r="3"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/>
                </svg>
                <span className="text-xs font-medium">{isRtl ? "من نحن" : "About"}</span>
              </a>
              <button
                onClick={toggleLanguage}
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#0E76AC] transition-colors"
              >
                <Globe className="h-6 w-6" />
                <span className="text-xs font-medium">{language === "ar" ? "EN" : "ع"}</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Footer */}
      {/* الشريط السفلي الثابت (77px) وفقاعة المحادثة (تنتهي عند 148px) يعلوان
          الصفحة، و<main> وحده يحمل مسافةً لهما — والفوتر خارجه. فكان آخره
          مغطّى: سطر الحقوق ورابطا «سياسة الخصوصية» و«الشروط» لا تُضغط أصلاً.
          ورابط سياسة الخصوصية شرطٌ في متجر جوجل بلاي. */}
      <footer className="bg-gradient-to-b from-[#0F4A5E] to-[#0a3847] text-white py-8 md:py-14 mt-12 md:mt-20 pb-40 md:pb-14">
        <div className="max-w-7xl mx-auto px-4">

          {/* Logo row — always full width on mobile */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <img src="/heart-icon.png" alt="Adrenaline Heart" className="h-9 w-9" />
              <img src="/adrenaline-logo-full.png" alt="Adrenaline" className="h-8" />
            </div>
            <p className="text-[#BCBEBF] text-sm leading-relaxed mb-4 max-w-sm">
              {isRtl
                ? (restaurantSettings?.descriptionAr || "أدرينالين - نقدم لكم وجبات صحية ولذيذة مصممة خصيصاً لتحقيق أهدافكم الغذائية. نستخدم أفضل المكونات الطازجة ونعد كل وجبة بحب واهتمام.")
                : (restaurantSettings?.descriptionEn || "Adrenaline - We offer healthy and delicious meals specially designed to achieve your nutritional goals.")}
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {restaurantSettings?.instagramUrl && (
                <a href={restaurantSettings.instagramUrl} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group">
                  <svg className="w-4 h-4 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              )}
              {restaurantSettings?.twitterUrl && (
                <a href={restaurantSettings.twitterUrl} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group">
                  <svg className="w-4 h-4 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              )}
              {restaurantSettings?.facebookUrl && (
                <a href={restaurantSettings.facebookUrl} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group">
                  <svg className="w-4 h-4 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* 3 sections: 2-col grid on mobile, auto on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6 md:mb-10">

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-bold mb-3 text-white">
                {isRtl ? "روابط سريعة" : "Quick Links"}
              </h3>
              <ul className="space-y-2">
                {[
                  { href: "/", ar: "الرئيسية", en: "Home" },
                  { href: "/public/plans", ar: "الخطط", en: "Plans" },
                  { href: "/public/menu", ar: "قائمة الوجبات", en: "Menu" },
                  { href: "/public/about", ar: "من نحن", en: "About" },
                  { href: "/public/contact", ar: "تواصل معنا", en: "Contact" },
                ].map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="inline-flex min-h-[44px] items-center text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-xs md:min-h-0">
                      {isRtl ? link.ar : link.en}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-sm font-bold mb-3 text-white">
                {isRtl ? "خدماتنا" : "Our Services"}
              </h3>
              <ul className="space-y-2">
                {[
                  { ar: "توصيل مجاني", en: "Free Delivery" },
                  { ar: "استشارة غذائية", en: "Nutrition Consultation" },
                  { ar: "خطط مخصصة", en: "Custom Plans" },
                  { ar: "وجبات طازجة يومياً", en: "Fresh Daily Meals" },
                ].map((s) => (
                  <li key={s.ar}>
                    <span className="text-[#BCBEBF] text-xs flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#3CC4F0] flex-shrink-0" />
                      {isRtl ? s.ar : s.en}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info — spans full width on mobile (col-span-2), normal on md+ */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-sm font-bold mb-3 text-white">
                {isRtl ? "تواصل معنا" : "Contact Us"}
              </h3>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 md:flex-col md:space-y-2">
                <li className="flex items-center gap-2 text-[#BCBEBF] text-xs">
                  <svg className="w-4 h-4 text-[#3CC4F0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${restaurantSettings?.phone || "+97412345678"}`} className="hover:text-[#3CC4F0] transition-colors">
                    {restaurantSettings?.phone || "+974 1234 5678"}
                  </a>
                </li>
                <li className="flex items-center gap-2 text-[#BCBEBF] text-xs">
                  <svg className="w-4 h-4 text-[#3CC4F0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${restaurantSettings?.email || "info@adrenaline.qa"}`} className="hover:text-[#3CC4F0] transition-colors">
                    {restaurantSettings?.email || "info@adrenaline.qa"}
                  </a>
                </li>
                <li className="flex items-center gap-2 text-[#BCBEBF] text-xs">
                  <svg className="w-4 h-4 text-[#3CC4F0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{isRtl ? (restaurantSettings?.addressAr || "الدوحة، قطر") : (restaurantSettings?.addressEn || "Doha, Qatar")}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-[#3CC4F0]/20 pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
              <p className="text-[#BCBEBF] text-xs">
                {isRtl
                  ? `© ${new Date().getFullYear()} Adrenaline Healthy Food. جميع الحقوق محفوظة.`
                  : `© ${new Date().getFullYear()} Adrenaline Healthy Food. All rights reserved.`}
              </p>
              <div className="flex items-center gap-4">
                <a href={restaurantSettings?.privacyPolicyUrl || "/privacy"} className="inline-flex min-h-[44px] items-center px-2 text-[#BCBEBF] hover:text-[#3CC4F0] text-xs transition-colors">
                  {isRtl ? "سياسة الخصوصية" : "Privacy Policy"}
                </a>
                <a href={restaurantSettings?.termsUrl || "/terms"} className="inline-flex min-h-[44px] items-center px-2 text-[#BCBEBF] hover:text-[#3CC4F0] text-xs transition-colors">
                  {isRtl ? "الشروط والأحكام" : "Terms & Conditions"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* AI nutrition assistant — floating on all public pages */}
      <ChatBot />
    </div>
  );
}
