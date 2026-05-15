/**
 * @file client/src/components/public/PublicLayout.tsx
 * @description Layout for public pages (no sidebar)
 */
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Home, UtensilsCrossed, CalendarDays, Globe, LayoutDashboard, User, LogOut, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";

interface PublicLayoutProps {
  children: ReactNode;
  isRtl?: boolean;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { language, setLanguage, dir, t } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, currentCustomer, customerLogout } = useStore();
  
  // Fetch restaurant settings from database
  const restaurantSettings = useQuery(api.restaurantSettings.get);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-white">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-cyan-50 to-blue-50 border-b-2 border-cyan-300 shadow-lg backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center">
              <img
                src="/adrenaline-logo.png"
                alt="Adrenaline"
                className="h-10"
              />
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a
                href="/"
                className="text-base font-medium text-[#0F1516] hover:text-[#3CC4F0] transition-colors"
              >
                {isRtl ? "الرئيسية" : "Home"}
              </a>
              <a
                href="/public/plans"
                className="text-base font-medium text-[#0F1516] hover:text-[#3CC4F0] transition-colors"
              >
                {isRtl ? "الخطط" : "Plans"}
              </a>
              <a
                href="/public/menu"
                className="text-base font-medium text-[#0F1516] hover:text-[#3CC4F0] transition-colors"
              >
                {isRtl ? "المنيو" : "Menu"}
              </a>
              <a
                href="/public/about"
                className="text-base font-medium text-[#0F1516] hover:text-[#3CC4F0] transition-colors"
              >
                {isRtl ? "من نحن" : "About"}
              </a>
              <a
                href="/public/contact"
                className="text-base font-medium text-[#0F1516] hover:text-[#3CC4F0] transition-colors"
              >
                {isRtl ? "تواصل معنا" : "Contact"}
              </a>
              <a
                href="/public/track"
                className="text-base font-medium text-[#3CC4F0] hover:text-[#47759C] transition-colors flex items-center gap-1"
              >
                📦 {isRtl ? "تتبع طلبي" : "Track Order"}
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Dashboard Button - Show only for logged in admin users */}
              {currentUser && (
                <>
                  <Button
                    onClick={() => window.location.href = "/dashboard"}
                    variant="outline"
                    className="hidden md:flex h-10 px-6 rounded-full border-2 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white font-bold items-center gap-2"
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
                    className="hidden md:flex h-10 px-4 rounded-full border-2 border-red-500 text-red-600 hover:bg-red-50"
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
                className="hidden md:flex items-center gap-2 h-10 px-4 rounded-full hover:bg-[#3CC4F0]/10"
              >
                <Globe className="h-4 w-4 text-[#3CC4F0]" />
                <span className="font-bold text-[#3CC4F0]">
                  {language === "ar" ? "EN" : "ع"}
                </span>
              </Button>

              {/* Login Button - Desktop - Show only if not logged in */}
              {!currentUser && !currentCustomer && (
                <Button
                  onClick={() => window.location.href = "/login"}
                  variant="outline"
                  className="hidden md:flex h-10 px-6 rounded-full border-2 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white font-bold"
                >
                  {isRtl ? "تسجيل دخول" : "Login"}
                </Button>
              )}

              {/* Customer Profile Button - Show only for logged in customers */}
              {currentCustomer && (
                <>
                  {/* Customer Name */}
                  <span className="hidden md:block text-sm font-medium text-[#0F1516]">
                    {isRtl ? "مرحباً، " : "Hi, "}
                    {currentCustomer.fullName.split(" ")[0]}
                  </span>
                  
                  <Button
                    onClick={() => window.location.href = "/customer/profile"}
                    variant="outline"
                    className="hidden md:flex h-10 px-6 rounded-full border-2 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white font-bold items-center gap-2"
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
                  className="hidden md:flex h-10 px-4 rounded-full hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}

              {/* Subscribe Button */}
              <Button className="hidden md:flex h-10 px-6 rounded-full bg-[#3CC4F0] hover:bg-[#47759C] text-white font-bold">
                {isRtl ? "اشترك الآن" : "Subscribe"}
              </Button>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-2">
              {/* Dashboard Link - Show only for logged in admin users */}
              {currentUser && (
                <>
                  <a
                    href="/dashboard"
                    className="block py-2 px-4 text-[#3CC4F0] font-bold hover:bg-[#3CC4F0]/10 rounded-lg flex items-center gap-2"
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
                {isRtl ? "المنيو" : "Menu"}
              </a>
              <button
                onClick={toggleLanguage}
                className="w-full text-left py-2 px-4 text-[#0F1516] hover:bg-[#3CC4F0]/10 rounded-lg font-medium flex items-center gap-2"
              >
                <Globe className="h-4 w-4 text-[#3CC4F0]" />
                {language === "ar" ? "English" : "العربية"}
              </button>
              
              {/* Customer Profile Link - Show only for logged in customers */}
              {currentCustomer && (
                <>
                  <div className="py-2 px-4 bg-[#3CC4F0]/10 rounded-lg">
                    <p className="text-sm font-medium text-[#0F1516]">
                      {isRtl ? "مرحباً، " : "Hi, "}
                      <span className="font-bold text-[#3CC4F0]">{currentCustomer.fullName}</span>
                    </p>
                  </div>
                  <a
                    href="/customer/profile"
                    className="block py-2 px-4 text-[#3CC4F0] font-bold hover:bg-[#3CC4F0]/10 rounded-lg flex items-center gap-2"
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
                  className="w-full justify-center h-10 rounded-full border-2 border-[#3CC4F0] text-[#3CC4F0] font-bold"
                >
                  {isRtl ? "تسجيل دخول" : "Login"}
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-0">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {/* Show Dashboard button for logged in users */}
          {currentUser ? (
            <>
              <a
                href="/"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <Home className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "الرئيسية" : "Home"}</span>
              </a>
              <a
                href="/public/plans"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "الخطط" : "Plans"}</span>
              </a>
              <a
                href="/public/menu"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <UtensilsCrossed className="h-5 w-5" />
                <span className="text-xs font-medium">{isRtl ? "المنيو" : "Menu"}</span>
              </a>
              <a
                href="/dashboard"
                className="flex flex-col items-center gap-1 py-2 px-3 text-[#3CC4F0] hover:text-[#47759C] transition-colors"
              >
                <LayoutDashboard className="h-6 w-6" />
                <span className="text-xs font-bold">{isRtl ? "لوحة التحكم" : "Dashboard"}</span>
              </a>
            </>
          ) : (
            <>
              <a
                href="/"
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <Home className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "الرئيسية" : "Home"}</span>
              </a>
              <a
                href="/public/plans"
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <CalendarDays className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "الخطط" : "Plans"}</span>
              </a>
              <a
                href="/public/menu"
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <UtensilsCrossed className="h-6 w-6" />
                <span className="text-xs font-medium">{isRtl ? "المنيو" : "Menu"}</span>
              </a>
              <button
                onClick={toggleLanguage}
                className="flex flex-col items-center gap-1 py-2 px-4 text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                <Globe className="h-6 w-6" />
                <span className="text-xs font-medium">{language === "ar" ? "EN" : "ع"}</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#0F4A5E] to-[#0a3847] text-white py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            {/* Logo & Description */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/heart-icon.png"
                  alt="Adrenaline Heart"
                  className="h-12 w-12"
                />
                <img
                  src="/adrenaline-logo-full.png"
                  alt="Adrenaline"
                  className="h-10"
                />
              </div>
              <p className="text-[#BCBEBF] text-sm leading-relaxed mb-6">
                {isRtl
                  ? (restaurantSettings?.descriptionAr || "أدرينالين - نقدم لكم وجبات صحية ولذيذة مصممة خصيصاً لتحقيق أهدافكم الغذائية.")
                  : (restaurantSettings?.descriptionEn || "Adrenaline - We offer healthy and delicious meals specially designed to achieve your nutritional goals.")}
              </p>
              
              {/* Social Media */}
              <div className="flex items-center gap-3">
                {restaurantSettings?.instagramUrl && (
                  <a
                    href={restaurantSettings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group"
                  >
                    <svg className="w-5 h-5 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                {restaurantSettings?.twitterUrl && (
                  <a
                    href={restaurantSettings.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group"
                  >
                    <svg className="w-5 h-5 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
                {restaurantSettings?.facebookUrl && (
                  <a
                    href={restaurantSettings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#3CC4F0]/10 hover:bg-[#3CC4F0] flex items-center justify-center transition-all group"
                  >
                    <svg className="w-5 h-5 text-[#3CC4F0] group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold mb-4 text-white">
                {isRtl ? "روابط سريعة" : "Quick Links"}
              </h3>
              <ul className="space-y-3">
                <li>
                  <a href="/" className="text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-[#3CC4F0] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {isRtl ? "الرئيسية" : "Home"}
                  </a>
                </li>
                <li>
                  <a href="/public/plans" className="text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-[#3CC4F0] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {isRtl ? "الخطط" : "Plans"}
                  </a>
                </li>
                <li>
                  <a href="/public/menu" className="text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-[#3CC4F0] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {isRtl ? "المنيو" : "Menu"}
                  </a>
                </li>
                <li>
                  <a href="/public/about" className="text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-[#3CC4F0] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {isRtl ? "من نحن" : "About"}
                  </a>
                </li>
                <li>
                  <a href="/public/contact" className="text-[#BCBEBF] hover:text-[#3CC4F0] transition-colors text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-[#3CC4F0] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {isRtl ? "تواصل معنا" : "Contact"}
                  </a>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold mb-4 text-white">
                {isRtl ? "خدماتنا" : "Our Services"}
              </h3>
              <ul className="space-y-3">
                <li>
                  <span className="text-[#BCBEBF] text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#3CC4F0]" />
                    {isRtl ? "توصيل مجاني" : "Free Delivery"}
                  </span>
                </li>
                <li>
                  <span className="text-[#BCBEBF] text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#3CC4F0]" />
                    {isRtl ? "استشارة غذائية" : "Nutrition Consultation"}
                  </span>
                </li>
                <li>
                  <span className="text-[#BCBEBF] text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#3CC4F0]" />
                    {isRtl ? "خطط مخصصة" : "Custom Plans"}
                  </span>
                </li>
                <li>
                  <span className="text-[#BCBEBF] text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#3CC4F0]" />
                    {isRtl ? "وجبات طازجة يومياً" : "Fresh Daily Meals"}
                  </span>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="md:col-span-3">
              <h3 className="text-lg font-bold mb-4 text-white">
                {isRtl ? "تواصل معنا" : "Contact Us"}
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-[#BCBEBF] text-sm">
                  <svg className="w-5 h-5 text-[#3CC4F0] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white mb-1">{isRtl ? "هاتف:" : "Phone:"}</p>
                    <a href={`tel:${restaurantSettings?.phone || "+97412345678"}`} className="hover:text-[#3CC4F0] transition-colors">
                      {restaurantSettings?.phone || "+974 1234 5678"}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-[#BCBEBF] text-sm">
                  <svg className="w-5 h-5 text-[#3CC4F0] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white mb-1">{isRtl ? "بريد:" : "Email:"}</p>
                    <a href={`mailto:${restaurantSettings?.email || "info@adrenaline.qa"}`} className="hover:text-[#3CC4F0] transition-colors">
                      {restaurantSettings?.email || "info@adrenaline.qa"}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-[#BCBEBF] text-sm">
                  <svg className="w-5 h-5 text-[#3CC4F0] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-white mb-1">{isRtl ? "العنوان:" : "Address:"}</p>
                    <p>
                      {isRtl 
                        ? (restaurantSettings?.addressAr || "الدوحة، قطر")
                        : (restaurantSettings?.addressEn || "Doha, Qatar")
                      }
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-[#3CC4F0]/20 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-[#BCBEBF] text-sm text-center md:text-left">
                {isRtl
                  ? `© ${new Date().getFullYear()} Adrenaline Healthy Food. جميع الحقوق محفوظة.`
                  : `© ${new Date().getFullYear()} Adrenaline Healthy Food. All rights reserved.`}
              </p>
              <div className="flex items-center gap-6">
                <a 
                  href={restaurantSettings?.privacyPolicyUrl || "#privacy"} 
                  className="text-[#BCBEBF] hover:text-[#3CC4F0] text-sm transition-colors"
                >
                  {isRtl ? "سياسة الخصوصية" : "Privacy Policy"}
                </a>
                <a 
                  href={restaurantSettings?.termsUrl || "#terms"} 
                  className="text-[#BCBEBF] hover:text-[#3CC4F0] text-sm transition-colors"
                >
                  {isRtl ? "الشروط والأحكام" : "Terms & Conditions"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
