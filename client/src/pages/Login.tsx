/**
 * @file client/src/pages/Login.tsx
 * @description صفحة تسجيل دخول — Adrenaline brand identity
 */
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { convex } from "@/lib/convex";
import { ROLE_HOME, canAccessUser, type Role } from "@/lib/permissions";
import { api } from "@/../../convex/_generated/api";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, customerLogin } = useStore();
  const [, setLocation] = useLocation();
  const { t, dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await convex.mutation(api.auth.authenticateUnified, { email, password });
      if (result.success) {
        if (result.accountType === "staff" && result.user) {
          const perms = (result.user as any).permissions as string[] | undefined;
          login(result.user.email, result.user.role, result.user.id, result.user.name, (result as any).sessionToken, perms);
          // ✅ وجّه لصفحة يقدر الموظف يوصلها فعلاً حسب دوره/صلاحياته (السائق → تطبيق السائق)
          const su = { role: result.user.role as Role, permissions: perms };
          let home = ROLE_HOME[result.user.role as Role] || "/";
          if (!canAccessUser(su, home)) {
            home = (perms || []).find((p) => p !== "/" && !p.endsWith("/*")) || "/";
          }
          setLocation(home);
        } else if (result.accountType === "customer" && result.customer) {
          customerLogin(result.customer, (result as any).sessionToken);
          setLocation("/");
        }
      } else {
        setError(result.error || (isRtl ? "فشل تسجيل الدخول" : "Login failed"));
      }
    } catch {
      setError(isRtl ? "حدث خطأ أثناء تسجيل الدخول" : "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir={dir}
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f1516 0%, #1a2a35 50%, #47759c 100%)" }}
    >
      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Decorative circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
        style={{ background: "#3cc4f0" }} />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10"
        style={{ background: "#3cc4f0" }} />
      <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full opacity-5"
        style={{ background: "#ffffff" }} />

      {/* Card */}
      <div className="w-full max-w-sm mx-4 relative z-10">
        {/* Logo section */}
        <div className="text-center mb-8">
          <img src="/adrenaline-logo-full.png" alt="Adrenaline Healthy Food"
            className="h-24 w-auto mx-auto mb-3 drop-shadow-2xl" />
          <p className="text-sm font-medium" style={{ color: "#bcbebf" }}>
            {t("login.subtitle") || (isRtl ? "نظام إدارة الوجبات الصحية" : "Healthy Meals Management System")}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-xl"
          style={{ background: "rgba(255, 255, 255, 0.96)", border: "1px solid rgba(60, 196, 240, 0.25)" }}>

          <h2 className="text-2xl font-black text-center mb-6" style={{ color: "#0f1516" }}>
            {t("login.welcome") || (isRtl ? "مرحباً بك" : "Welcome")}
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold" style={{ color: "#47759c" }}>
                {t("login.email") || (isRtl ? "البريد الإلكتروني" : "Email")}
              </Label>
              <div className="relative">
                <Mail className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "#bcbebf", [dir === "rtl" ? "right" : "left"]: "12px" }} />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.email_placeholder") || "example@email.com"}
                  required
                  dir="ltr"
                  className="h-12 rounded-xl border-2 transition-colors focus:border-[#3cc4f0] text-sm bg-white text-[#0f1516] placeholder-gray-400"
                  style={{
                    paddingLeft: dir === "rtl" ? "12px" : "38px",
                    paddingRight: dir === "rtl" ? "38px" : "12px",
                    borderColor: "#e2e8f0",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-bold" style={{ color: "#47759c" }}>
                {t("login.password") || (isRtl ? "كلمة المرور" : "Password")}
              </Label>
              <div className="relative">
                <Lock className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "#bcbebf", [dir === "rtl" ? "right" : "left"]: "12px" }} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="h-12 rounded-xl border-2 transition-colors focus:border-[#3cc4f0] text-sm bg-white text-[#0f1516] placeholder-gray-400"
                  style={{
                    paddingLeft: dir === "rtl" ? "40px" : "38px",
                    paddingRight: dir === "rtl" ? "38px" : "40px",
                    borderColor: "#e2e8f0",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 transition-colors"
                  style={{
                    [dir === "rtl" ? "left" : "right"]: "12px",
                    color: "#bcbebf",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl font-bold text-base text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              style={{
                background: isLoading
                  ? "#bcbebf"
                  : "linear-gradient(135deg, #3cc4f0, #47759c)",
                boxShadow: isLoading ? "none" : "0 4px 20px rgba(60, 196, 240, 0.35)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {t("login.loading") || (isRtl ? "جاري التحقق..." : "Verifying...")}
                </span>
              ) : (
                t("login.submit") || (isRtl ? "تسجيل الدخول" : "Sign In")
              )}
            </Button>
          </form>

          {/* Forgot password */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setLocation("/customer/auth?reset=1")}
              className="text-sm font-bold hover:underline transition-colors"
              style={{ color: "#47759c" }}
            >
              {dir === "rtl" ? "نسيت كلمة المرور؟" : "Forgot your password?"}
            </button>
          </div>

          {/* Register link */}
          <div className="mt-3 text-center">
            <p className="text-sm" style={{ color: "#bcbebf" }}>
              {t("customer.no_account") || (isRtl ? "ليس لديك حساب؟" : "Don't have an account?")}{" "}
              <button
                onClick={() => setLocation("/customer/auth")}
                className="font-bold hover:underline transition-colors"
                style={{ color: "#3cc4f0" }}
              >
                {t("customer.register") || (isRtl ? "سجّل الآن" : "Register Now")}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 opacity-40" style={{ color: "#bcbebf" }}>
          © 2026 Adrenaline Healthy Food
        </p>
      </div>
    </div>
  );
}
