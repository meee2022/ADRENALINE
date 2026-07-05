/**
 * @file client/src/pages/public/CustomerAuth.tsx
 * @description إنشاء حساب العميل + إعادة تعيين كلمة المرور — بنفس هوية صفحة الدخول.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Eye, EyeOff, Lock, Mail, Phone, User, KeyRound, CheckCircle2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";

type Mode = "register" | "reset";

export default function CustomerAuth() {
  const { dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [, setLocation] = useLocation();
  const { customerLogin } = useStore();

  const initialReset = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("reset") === "1";

  const [mode, setMode] = useState<Mode>(initialReset ? "reset" : "register");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phone: "", confirmPassword: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError(isRtl ? "كلمة المرور غير متطابقة" : "Passwords do not match"); return;
    }
    if (form.password.length < 6) {
      setError(isRtl ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return;
    }
    setIsLoading(true);
    try {
      const result = await convex.mutation(api.customerAuth.register, {
        email: form.email, password: form.password, phone: form.phone, fullName: form.fullName,
      });
      if (result.success && result.account) {
        customerLogin(result.account);
        setLocation("/");
      } else {
        setError(result.error || (isRtl ? "فشل إنشاء الحساب" : "Failed to create account"));
      }
    } catch (err: any) {
      setError(err.message || (isRtl ? "حدث خطأ أثناء إنشاء الحساب" : "An error occurred"));
    } finally { setIsLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError(isRtl ? "كلمة المرور غير متطابقة" : "Passwords do not match"); return;
    }
    if (form.password.length < 6) {
      setError(isRtl ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return;
    }
    setIsLoading(true);
    try {
      const res: any = await convex.mutation((api.customerAuth as any).resetPassword, {
        email: form.email, phone: form.phone, newPassword: form.password,
      });
      if (res.success) { setResetDone(true); }
      else setError(res.error || (isRtl ? "تعذّر إعادة التعيين" : "Reset failed"));
    } catch (err: any) {
      setError(err.message || (isRtl ? "حدث خطأ" : "An error occurred"));
    } finally { setIsLoading(false); }
  };

  const iconSide = { [isRtl ? "right" : "left"]: "12px" } as React.CSSProperties;
  const fieldStyle = {
    paddingLeft: isRtl ? "12px" : "38px",
    paddingRight: isRtl ? "38px" : "12px",
    borderColor: "#e2e8f0",
  } as React.CSSProperties;
  const inputCls = "h-12 rounded-xl border-2 transition-colors focus:border-[#3cc4f0] text-sm bg-white text-[#0f1516] placeholder-gray-400";

  return (
    <div
      dir={dir}
      className="min-h-screen flex items-center justify-center relative overflow-hidden py-10"
      style={{ background: "linear-gradient(135deg, #0f1516 0%, #1a2a35 50%, #47759c 100%)" }}
    >
      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Decorative circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "#3cc4f0" }} />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10" style={{ background: "#3cc4f0" }} />
      <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full opacity-5" style={{ background: "#ffffff" }} />

      {/* Card wrapper */}
      <div className="w-full max-w-sm mx-4 relative z-10">
        {/* Logo section */}
        <div className="text-center mb-6">
          <img src="/adrenaline-logo-full.png" alt="Adrenaline Healthy Food"
            className="h-20 w-auto mx-auto mb-3 drop-shadow-2xl" />
          <p className="text-sm font-medium" style={{ color: "#bcbebf" }}>
            {mode === "reset"
              ? (isRtl ? "أدخل بريدك ورقمك المسجّلين لتعيين كلمة مرور جديدة" : "Enter your registered email and phone to reset your password")
              : (isRtl ? "أنشئ حسابك للبدء في رحلتك الصحية" : "Create your account to start your healthy journey")}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-xl"
          style={{ background: "rgba(255, 255, 255, 0.96)", border: "1px solid rgba(60, 196, 240, 0.25)" }}>

          <div className="flex items-center justify-center mb-5">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(145deg,#3cc4f0,#47759c)" }}>
              {mode === "reset" ? <KeyRound className="h-7 w-7 text-white" /> : <User className="h-7 w-7 text-white" />}
            </div>
          </div>

          <h2 className="text-2xl font-black text-center mb-6" style={{ color: "#0f1516" }}>
            {mode === "reset"
              ? (isRtl ? "إعادة تعيين كلمة المرور" : "Reset Password")
              : (isRtl ? "إنشاء حسابك" : "Create Account")}
          </h2>

          {mode === "reset" && resetDone ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-14 w-14 mx-auto mb-3" style={{ color: "#1E7A45" }} />
              <h3 className="text-lg font-black text-[#0f1516] mb-2">
                {isRtl ? "تم تغيير كلمة المرور!" : "Password changed!"}
              </h3>
              <p className="text-sm mb-5" style={{ color: "#47759c" }}>
                {isRtl ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة." : "You can now sign in with your new password."}
              </p>
              <Button onClick={() => setLocation("/login")}
                className="w-full h-12 rounded-xl text-white font-bold"
                style={{ background: "linear-gradient(135deg,#3cc4f0,#47759c)" }}>
                {isRtl ? "تسجيل الدخول" : "Sign In"}
              </Button>
            </div>
          ) : (
            <form onSubmit={mode === "reset" ? handleReset : handleRegister} className="space-y-5">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold" style={{ color: "#47759c" }}>
                    {isRtl ? "الاسم الكامل" : "Full Name"}
                  </Label>
                  <div className="relative">
                    <User className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#bcbebf", ...iconSide }} />
                    <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)}
                      placeholder={isRtl ? "أحمد محمد" : "John Doe"} required className={inputCls} style={fieldStyle} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-bold" style={{ color: "#47759c" }}>
                  {isRtl ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <div className="relative">
                  <Phone className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#bcbebf", ...iconSide }} />
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                    placeholder="+974 1234 5678" required dir="ltr" className={inputCls} style={fieldStyle} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold" style={{ color: "#47759c" }}>
                  {isRtl ? "البريد الإلكتروني" : "Email"}
                </Label>
                <div className="relative">
                  <Mail className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#bcbebf", ...iconSide }} />
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                    placeholder="user@example.com" required dir="ltr" className={inputCls} style={fieldStyle} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold" style={{ color: "#47759c" }}>
                  {mode === "reset" ? (isRtl ? "كلمة المرور الجديدة" : "New Password") : (isRtl ? "كلمة المرور" : "Password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#bcbebf", ...iconSide }} />
                  <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)}
                    placeholder="••••••••" required dir="ltr" className={inputCls}
                    style={{ paddingLeft: isRtl ? "40px" : "38px", paddingRight: isRtl ? "38px" : "40px", borderColor: "#e2e8f0" }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 transition-colors"
                    style={{ [isRtl ? "left" : "right"]: "12px", color: "#bcbebf" }} tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold" style={{ color: "#47759c" }}>
                  {isRtl ? "تأكيد كلمة المرور" : "Confirm Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#bcbebf", ...iconSide }} />
                  <Input type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)}
                    placeholder="••••••••" required dir="ltr" className={inputCls} style={fieldStyle} />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={isLoading}
                className="w-full h-12 rounded-xl font-bold text-base text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  background: isLoading ? "#bcbebf" : "linear-gradient(135deg, #3cc4f0, #47759c)",
                  boxShadow: isLoading ? "none" : "0 4px 20px rgba(60, 196, 240, 0.35)",
                }}>
                {isLoading
                  ? (isRtl ? "جارٍ التحميل..." : "Loading...")
                  : mode === "reset"
                    ? (isRtl ? "تعيين كلمة المرور" : "Set New Password")
                    : (isRtl ? "إنشاء الحساب" : "Sign Up")}
              </Button>
            </form>
          )}

          {/* Footer links */}
          {!resetDone && (
            <div className="mt-5 text-center space-y-2">
              {mode === "register" ? (
                <>
                  <button onClick={() => { setMode("reset"); setError(""); }}
                    className="block w-full text-sm font-bold hover:underline" style={{ color: "#47759c" }}>
                    {isRtl ? "نسيت كلمة المرور؟" : "Forgot your password?"}
                  </button>
                  <p className="text-sm" style={{ color: "#bcbebf" }}>
                    {isRtl ? "لديك حساب بالفعل؟ " : "Already have an account? "}
                    <button onClick={() => setLocation("/login")} className="font-bold hover:underline" style={{ color: "#3cc4f0" }}>
                      {isRtl ? "تسجيل الدخول" : "Sign In"}
                    </button>
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: "#bcbebf" }}>
                  {isRtl ? "رجوع إلى " : "Back to "}
                  <button onClick={() => { setMode("register"); setError(""); }} className="font-bold hover:underline" style={{ color: "#3cc4f0" }}>
                    {isRtl ? "إنشاء حساب" : "Sign Up"}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 opacity-40" style={{ color: "#bcbebf" }}>
          © 2026 Adrenaline Healthy Food
        </p>
      </div>
    </div>
  );
}
