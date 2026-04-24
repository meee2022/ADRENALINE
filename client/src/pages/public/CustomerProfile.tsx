/**
 * @file client/src/pages/public/CustomerProfile.tsx
 * @description صفحة البروفايل والاشتراك للعميل
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Package,
  MapPin,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";

export default function CustomerProfile() {
  const { t, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [, setLocation] = useLocation();
  const { currentCustomer } = useStore();

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentCustomer) {
      setLocation("/customer/auth");
      return;
    }

    const fetchProfile = async () => {
      try {
        const data = await convex.query(api.customerAuth.getProfile, {
          accountId: currentCustomer.id,
        });
        setProfile(data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [currentCustomer]);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3CC4F0] mx-auto mb-4"></div>
            <p className="text-[#47759C]">{isRtl ? "جارٍ التحميل..." : "Loading..."}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const subscription = profile?.subscription;
  const hasSubscription = !!subscription;

  // Calculate remaining days
  let daysRemaining = 0;
  if (subscription?.endDate) {
    const endDate = new Date(subscription.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <PublicLayout>
      <div className="min-h-screen py-12 px-4 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#0F1516] mb-2">{t("customer.profile")}</h1>
            <p className="text-[#47759C]">
              {isRtl ? "مرحباً، " : "Welcome, "}
              {profile?.account?.fullName}
            </p>
          </div>

          {/* Account Info */}
          <Card className="border-2 border-[#3CC4F0]/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0F1516]">
                <User className="h-5 w-5 text-[#3CC4F0]" />
                {isRtl ? "معلومات الحساب" : "Account Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-[#47759C]" />
                <div>
                  <p className="text-xs text-[#47759C]">{t("customer.fullname")}</p>
                  <p className="font-medium text-[#0F1516]">{profile?.account?.fullName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-[#47759C]" />
                <div className="flex-1">
                  <p className="text-xs text-[#47759C]">{t("customer.email")}</p>
                  <p className="font-medium text-[#0F1516] text-left" dir="ltr">
                    {profile?.account?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-[#47759C]" />
                <div className="flex-1">
                  <p className="text-xs text-[#47759C]">{t("customer.phone")}</p>
                  <p className="font-medium text-[#0F1516] text-left" dir="ltr">
                    {profile?.account?.phone}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Status */}
          <Card className={`border-2 ${hasSubscription ? "border-green-200" : "border-gray-200"}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#0F1516]">
                  <Package className="h-5 w-5 text-[#3CC4F0]" />
                  {t("customer.my_subscription")}
                </CardTitle>
                {hasSubscription && subscription.isActive ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t("customer.subscription_active")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    {t("customer.subscription_inactive")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {hasSubscription && subscription.isActive ? (
                <div className="space-y-4">
                  {/* Days Remaining Alert */}
                  {daysRemaining > 0 && daysRemaining <= 7 && (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        {isRtl
                          ? `اشتراكك ينتهي خلال ${daysRemaining} يوم`
                          : `Your subscription ends in ${daysRemaining} days`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Subscription Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-blue-600 font-medium">
                          {t("customer.subscription_start")}
                        </p>
                        <p className="text-sm font-bold text-[#0F1516]">{subscription.startDate}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
                      <Calendar className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-red-600 font-medium">
                          {t("customer.subscription_end")}
                        </p>
                        <p className="text-sm font-bold text-[#0F1516]">{subscription.endDate}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                      <Clock className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-green-600 font-medium">
                          {t("customer.delivery_time")}
                        </p>
                        <p className="text-sm font-bold text-[#0F1516]">
                          {subscription.deliveryTime === "MORNING"
                            ? isRtl
                              ? "صباحي"
                              : "Morning"
                            : isRtl
                            ? "مسائي"
                            : "Evening"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <Package className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-600 font-medium">
                          {t("customer.package")}
                        </p>
                        <p className="text-sm font-bold text-[#0F1516]">
                          {subscription.packageLabel || subscription.program || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Meals Info */}
                  {(subscription.mealsPerDay || subscription.snacksPerDay) && (
                    <div className="p-4 bg-gradient-to-r from-[#3CC4F0]/10 to-[#47759C]/10 rounded-lg border border-[#3CC4F0]/20">
                      <p className="text-sm font-medium text-[#0F1516] mb-2">
                        {isRtl ? "تفاصيل الوجبات اليومية:" : "Daily Meals:"}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        {subscription.mealsPerDay && (
                          <span className="text-[#47759C]">
                            <strong className="text-[#3CC4F0]">{subscription.mealsPerDay}</strong>{" "}
                            {t("customer.meals_per_day")}
                          </span>
                        )}
                        {subscription.snacksPerDay && (
                          <span className="text-[#47759C]">
                            <strong className="text-[#3CC4F0]">{subscription.snacksPerDay}</strong>{" "}
                            {t("customer.snacks_per_day")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  {subscription.address && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <MapPin className="h-5 w-5 text-[#47759C] mt-0.5" />
                      <div>
                        <p className="text-xs text-[#47759C]">{t("customer.address")}</p>
                        <p className="text-sm text-[#0F1516]">{subscription.address}</p>
                      </div>
                    </div>
                  )}

                  {subscription.goals && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Target className="h-5 w-5 text-[#47759C] mt-0.5" />
                      <div>
                        <p className="text-xs text-[#47759C]">{t("customer.goals")}</p>
                        <p className="text-sm text-[#0F1516]">{subscription.goals}</p>
                      </div>
                    </div>
                  )}

                  {subscription.allergies && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-red-600 font-medium">{t("customer.allergies")}</p>
                        <p className="text-sm text-[#0F1516]">{subscription.allergies}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-[#47759C] mb-4">
                    {isRtl
                      ? "لا يوجد اشتراك نشط حالياً"
                      : "You don't have an active subscription"}
                  </p>
                  <Button
                    onClick={() => setLocation("/public/plans")}
                    className="bg-[#3CC4F0] hover:bg-[#47759C] text-white rounded-full px-8"
                  >
                    {t("customer.subscribe_now")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card className="border-2 border-[#3CC4F0]/20">
            <CardHeader>
              <CardTitle className="text-[#0F1516]">
                {isRtl ? "تحتاج مساعدة؟" : "Need Help?"}
              </CardTitle>
              <CardDescription>
                {isRtl
                  ? "تواصل معنا للاستفسارات أو للاشتراك في خطة جديدة"
                  : "Contact us for inquiries or to subscribe to a new plan"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0]/10"
                  onClick={() => (window.location.href = "tel:+97412345678")}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  +974 1234 5678
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0]/10"
                  onClick={() => (window.location.href = "mailto:info@adrenaline.qa")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  info@adrenaline.qa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
