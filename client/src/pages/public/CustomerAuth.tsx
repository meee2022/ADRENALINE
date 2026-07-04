/**
 * @file client/src/pages/public/CustomerAuth.tsx
 * @description إنشاء حساب العميل + إعادة تعيين كلمة المرور — بهوية أدرينالين.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, User, Mail, Phone, Lock, KeyRound, CheckCircle2, Sparkles } from "lucide-react";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";

const B = { brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A", line: "#D9E6F1" };

type Mode = "register" | "reset";

export default function CustomerAuth() {
  const { dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [, setLocation] = useLocation();
  const { customerLogin } = useStore();

  const [mode, setMode] = useState<Mode>("register");
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

  const inputCls = "border-[#D9E6F1] focus:border-[#3AC7F4] focus:ring-[#3AC7F4]/20";

  return (
    <PublicLayout>
      <PageHeader
        eyebrowAr={mode === "reset" ? "استعادة الحساب" : "انضم إلينا"}
        eyebrowEn={mode === "reset" ? "ACCOUNT RECOVERY" : "JOIN US"}
        icon={<Sparkles className="w-3.5 h-3.5" style={{ color: B.brand }} />}
        titleAr={mode === "reset" ? "إعادة تعيين كلمة المرور" : "إنشاء حسابك"}
        titleEn={mode === "reset" ? "Reset Your Password" : "Create Your Account"}
        subtitleAr={mode === "reset" ? "أدخل بريدك ورقمك المسجّلين لتعيين كلمة مرور جديدة" : "أنشئ حسابك للبدء في رحلتك الصحية"}
        subtitleEn={mode === "reset" ? "Enter your registered email and phone to set a new password" : "Create your account to start your healthy journey"}
      />

      <div dir={isRtl ? "rtl" : "ltr"} className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl p-6 md:p-8"
          style={{ border: `1px solid ${B.line}`, boxShadow: "0 20px 50px -24px rgba(14,42,74,.35)" }}>
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(145deg,${B.brand},${B.accent})` }}>
              {mode === "reset" ? <KeyRound className="h-8 w-8 text-white" /> : <User className="h-8 w-8 text-white" />}
            </div>
          </div>

          {mode === "reset" && resetDone ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-14 w-14 mx-auto mb-3" style={{ color: "#1E7A45" }} />
              <h3 className="text-lg font-black text-[#0E2A4A] mb-2">
                {isRtl ? "تم تغيير كلمة المرور!" : "Password changed!"}
              </h3>
              <p className="text-sm text-[#47759C] mb-5">
                {isRtl ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة." : "You can now sign in with your new password."}
              </p>
              <Button onClick={() => setLocation("/login")}
                className="w-full h-11 rounded-full text-white font-bold"
                style={{ background: `linear-gradient(135deg,${B.brand},${B.accent})` }}>
                {isRtl ? "تسجيل الدخول" : "Sign In"}
              </Button>
            </div>
          ) : (
            <form onSubmit={mode === "reset" ? handleReset : handleRegister} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-[#0E2A4A]">
                    <User className="h-4 w-4" style={{ color: B.brand }} />
                    {isRtl ? "الاسم الكامل" : "Full Name"}
                  </Label>
                  <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)}
                    placeholder={isRtl ? "أحمد محمد" : "John Doe"} required className={inputCls} />
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-[#0E2A4A]">
                  <Phone className="h-4 w-4" style={{ color: B.brand }} />
                  {isRtl ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                  placeholder="+974 1234 5678" required dir="ltr" className={`${inputCls} text-left`} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-[#0E2A4A]">
                  <Mail className="h-4 w-4" style={{ color: B.brand }} />
                  {isRtl ? "البريد الإلكتروني" : "Email"}
                </Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                  placeholder="user@example.com" required dir="ltr" className={`${inputCls} text-left`} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-[#0E2A4A]">
                  <Lock className="h-4 w-4" style={{ color: B.brand }} />
                  {mode === "reset" ? (isRtl ? "كلمة المرور الجديدة" : "New Password") : (isRtl ? "كلمة المرور" : "Password")}
                </Label>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••" required dir="ltr" className={inputCls} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-[#0E2A4A]">
                  <Lock className="h-4 w-4" style={{ color: B.brand }} />
                  {isRtl ? "تأكيد كلمة المرور" : "Confirm Password"}
                </Label>
                <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="••••••••" required dir="ltr" className={inputCls} />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isLoading}
                className="w-full h-11 rounded-full text-white font-bold text-base shadow-lg"
                style={{ background: `linear-gradient(135deg,${B.brand},${B.accent})` }}>
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
            <div className="mt-6 text-center space-y-2">
              {mode === "register" ? (
                <>
                  <button onClick={() => { setMode("reset"); setError(""); }}
                    className="block w-full text-sm font-bold text-[#0E76AC] hover:underline">
                    {isRtl ? "نسيت كلمة المرور؟" : "Forgot your password?"}
                  </button>
                  <button onClick={() => setLocation("/login")}
                    className="text-sm text-[#47759C] hover:text-[#3AC7F4]">
                    {isRtl ? "لديك حساب بالفعل؟ " : "Already have an account? "}
                    <span className="font-bold text-[#3AC7F4]">{isRtl ? "تسجيل الدخول" : "Sign In"}</span>
                  </button>
                </>
              ) : (
                <button onClick={() => { setMode("register"); setError(""); }}
                  className="text-sm text-[#47759C] hover:text-[#3AC7F4]">
                  {isRtl ? "رجوع إلى " : "Back to "}
                  <span className="font-bold text-[#3AC7F4]">{isRtl ? "إنشاء حساب" : "Sign Up"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
