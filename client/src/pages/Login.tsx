/**
 * @file client/src/pages/Login.tsx
 * @description صفحة تسجيل دخول موحدة - للأدمن والعملاء
 * @convex auth.ts
 */
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, customerLogin } = useStore();
  const [, setLocation] = useLocation();
  const { t, dir } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Call unified authentication
      console.log("Attempting login with:", email);
      const result = await convex.query(api.auth.authenticateUnified, { email, password });
      console.log("Login result:", result);

      if (result.success) {
        if (result.accountType === "staff" && result.user) {
          // Staff/Admin login
          console.log("Logging in as staff:", result.user);
          login(result.user.email, result.user.role, result.user.id, result.user.name);
          setLocation("/");
        } else if (result.accountType === "customer" && result.customer) {
          // Customer login - redirect to home page (not profile)
          console.log("Logging in as customer:", result.customer);
          customerLogin(result.customer);
          setLocation("/");
        }
      } else {
        console.error("Login failed:", result.error);
        setError(result.error || "فشل تسجيل الدخول");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
       <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcher />
       </div>

       {/* Background Effects */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
       
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto flex flex-col items-center gap-3">
            <img 
              src="/adrenaline-logo-full.png" 
              alt="Adrenaline Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-heading tracking-tight">{t('login.welcome')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.email_placeholder')}
                required
                className={dir === 'rtl' ? "bg-background/50 text-left" : "bg-background/50 text-left"}
                dir="ltr"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.password_placeholder')}
                  required
                  className="bg-background/50 pr-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
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
              className="w-full font-bold h-11 text-base shadow-[0_0_20px_-5px_hsl(var(--primary))] hover:shadow-[0_0_30px_-5px_hsl(var(--primary))] transition-all"
            >
              {isLoading ? t('login.loading') : t('login.submit')}
            </Button>
          </form>

          {/* Register Link for Customers */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('customer.no_account')}{" "}
              <button
                onClick={() => setLocation("/customer/auth")}
                className="text-primary font-bold hover:underline"
              >
                {t('customer.register')}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50">Login.tsx</div>
    </div>
  );
}
