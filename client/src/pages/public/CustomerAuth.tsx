/**
 * @file client/src/pages/public/CustomerAuth.tsx
 * @description صفحة إنشاء حساب جديد للعملاء فقط
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, User, Mail, Phone, Lock } from "lucide-react";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";

export default function CustomerAuth() {
  const { t, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [, setLocation] = useLocation();
  const { customerLogin } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    confirmPassword: "",
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(isRtl ? "كلمة المرور غير متطابقة" : "Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError(isRtl ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await convex.mutation(api.customerAuth.register, {
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        fullName: formData.fullName,
      });

      if (result.success && result.account) {
        customerLogin(result.account);
        setLocation("/");
      } else {
        setError(result.error || "فشل إنشاء الحساب");
      }
    } catch (err: any) {
      console.error("Register error:", err);
      setError(err.message || "حدث خطأ أثناء إنشاء الحساب");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-b from-white to-gray-50">
        <Card className="w-full max-w-md border-2 border-[#3CC4F0]/20 shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-[#3CC4F0] flex items-center justify-center shadow-lg">
              <User className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-[#0F1516]">
              {t("customer.register_title")}
            </CardTitle>
            <CardDescription className="text-[#47759C]">
              {isRtl ? "أنشئ حساباً جديداً للبدء" : "Create a new account to get started"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#3CC4F0]" />
                  {t("customer.fullname")}
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder={isRtl ? "أحمد محمد" : "John Doe"}
                  required
                  className="border-[#3CC4F0]/30 focus:border-[#3CC4F0]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#3CC4F0]" />
                  {t("customer.phone")}
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+974 1234 5678"
                  required
                  dir="ltr"
                  className="border-[#3CC4F0]/30 focus:border-[#3CC4F0] text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#3CC4F0]" />
                  {t("customer.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                  dir="ltr"
                  className="border-[#3CC4F0]/30 focus:border-[#3CC4F0] text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#3CC4F0]" />
                  {t("customer.password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="border-[#3CC4F0]/30 focus:border-[#3CC4F0]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#3CC4F0]" />
                  {t("customer.confirm_password")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="border-[#3CC4F0]/30 focus:border-[#3CC4F0]"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#3CC4F0] hover:bg-[#47759C] text-white font-bold text-base rounded-full shadow-lg"
              >
                {isLoading ? (isRtl ? "جارٍ التحميل..." : "Loading...") : t("customer.sign_up")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setLocation("/login")}
                className="text-sm text-[#47759C] hover:text-[#3CC4F0] transition-colors"
              >
                {t("customer.have_account")}{" "}
                <span className="font-bold text-[#3CC4F0]">{t("customer.sign_in")}</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
