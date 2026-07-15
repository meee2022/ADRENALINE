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
  Pause,
  Play,
  Bell,
  CheckCheck,
  Gift,
  Copy,
  Award,
  Ban,
} from "lucide-react";
import { convex } from "@/lib/convex";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";

export default function CustomerProfile() {
  const { t, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [, setLocation] = useLocation();
  const { currentCustomer } = useStore();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // سجل طلبات العميل (حسب رقم الهاتف)
  const orders = useQuery(
    api.customerOrders.getByPhone,
    currentCustomer?.phone ? { phone: currentCustomer.phone } : "skip"
  ) || [];

  // إشعارات العميل (حالة الطلب) — تفاعلية. 🔒 لازم sessionToken
  const notifs = useQuery(
    api.notifications.listForCustomer,
    profile?.subscription?.id && sessionToken
      ? { customerId: profile.subscription.id, sessionToken }
      : "skip"
  ) || [];

  const setActive = useMutation(api.customers.setSubscriptionActive);
  const toggleSkipMut = useMutation(api.customers.toggleSkipDay);
  const markAllReadMut = useMutation(api.notifications.markAllAsReadForCustomer);
  const redeemMut = useMutation(api.loyalty.redeem);
  const loyaltyCfg = useQuery(api.loyalty.config, {}) as any;

  const loadProfile = async () => {
    if (!currentCustomer) return;
    try {
      const data = await convex.query(api.customerAuth.getProfile, {
        accountId: currentCustomer.id as any,
        sessionToken,
      });
      setProfile(data);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentCustomer) {
      setLocation("/customer/auth");
      return;
    }
    loadProfile();
  }, [currentCustomer]);

  const togglePause = async () => {
    if (!profile?.subscription?.id || busy) return;
    setBusy(true);
    try {
      await setActive({ id: profile.subscription.id, active: !profile.subscription.isActive, sessionToken });
      await loadProfile();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };
  const toggleSkip = async (date: string) => {
    if (!profile?.subscription?.id || busy) return;
    setBusy(true);
    try {
      await toggleSkipMut({ id: profile.subscription.id, date, sessionToken });
      await loadProfile();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };
  const redeemPoints = async () => {
    if (!profile?.subscription?.id || busy) return;
    setBusy(true);
    try {
      const r = await redeemMut({ customerId: profile.subscription.id, sessionToken });
      await loadProfile();
      alert(isRtl
        ? `تم استبدال ${r.redeemed} نقطة برصيد خصم ${r.credit} ر.ق ✅`
        : `Redeemed ${r.redeemed} points for ${r.credit} QAR credit ✅`);
    } catch (e: any) {
      alert(e?.message || (isRtl ? "تعذّر الاستبدال" : "Redeem failed"));
    } finally { setBusy(false); }
  };
  const markAllRead = async () => {
    if (!profile?.subscription?.id) return;
    try { await markAllReadMut({ customerId: profile.subscription.id, sessionToken }); } catch (e) { console.error(e); }
  };
  const upcomingDays: string[] = (() => {
    const sub = profile?.subscription;
    if (!sub?.startDate) return [];
    const out: string[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(sub.startDate);
    if (isNaN(start.getTime())) return [];
    const end = sub.endDate ? new Date(sub.endDate) : null;
    let d = new Date(Math.max(today.getTime(), start.getTime()));
    for (let i = 0; i < 10; i++) {
      if (end && d.getTime() > end.getTime()) break;
      out.push(d.toISOString().split("T")[0]);
      d = new Date(d.getTime() + 86400000);
    }
    return out;
  })();

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
    if (!isNaN(endDate.getTime())) {
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
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

          {/* Notifications — order status updates */}
          {notifs.length > 0 && (
            <Card className="border-2 border-cyan-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Bell className="h-5 w-5 text-cyan-600" />
                    {isRtl ? "تنبيهاتك" : "Your Notifications"}
                    {notifs.some((n: any) => !n.isRead) && (
                      <Badge className="bg-cyan-600 text-white">{notifs.filter((n: any) => !n.isRead).length}</Badge>
                    )}
                  </CardTitle>
                  {notifs.some((n: any) => !n.isRead) && (
                    <Button variant="outline" size="sm" onClick={markAllRead} className="border-slate-200 text-slate-500 hover:text-slate-900">
                      <CheckCheck className="h-4 w-4 mr-1" />{isRtl ? "تعليم الكل كمقروء" : "Mark all read"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifs.slice(0, 8).map((n: any) => {
                  const createdRaw = n.createdAt ? new Date(Number(n.createdAt)) : null;
                  const created = createdRaw && !isNaN(createdRaw.getTime()) ? createdRaw : null;
                  return (
                    <div key={n._id} className={`p-3 rounded-lg border ${n.isRead ? "bg-white border-slate-100" : "bg-cyan-50 border-cyan-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                        </div>
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-cyan-600 mt-1.5 shrink-0" />}
                      </div>
                      {created && <p className="text-[10px] text-slate-400 mt-1.5">{created.toLocaleDateString(isRtl ? "ar-EG" : "en-US")}</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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

          {/* Subscription Management — pause / skip days */}
          {hasSubscription && (
            <Card className="border-2 border-cyan-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Pause className="h-5 w-5 text-cyan-600" />
                  {isRtl ? "إدارة الاشتراك" : "Manage Subscription"}
                </CardTitle>
                <CardDescription>{isRtl ? "أوقِف اشتراكك مؤقتًا أو تخطَّ أيام التوصيل" : "Pause your subscription or skip delivery days"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{subscription.isActive ? (isRtl ? "الاشتراك نشط" : "Active") : (isRtl ? "الاشتراك متوقف" : "Paused")}</p>
                    <p className="text-xs text-slate-500">{subscription.isActive ? (isRtl ? "التوصيل يعمل بشكل طبيعي" : "Deliveries running") : (isRtl ? "لا توصيل حتى تستأنف" : "No deliveries until resume")}</p>
                  </div>
                  <Button onClick={togglePause} disabled={busy} className={subscription.isActive ? "bg-slate-200 hover:bg-slate-300 text-slate-800" : "bg-cyan-600 hover:bg-cyan-700 text-white"}>
                    {subscription.isActive ? (<><Pause className="h-4 w-4 mr-2" />{isRtl ? "إيقاف مؤقت" : "Pause"}</>) : (<><Play className="h-4 w-4 mr-2" />{isRtl ? "استئناف" : "Resume"}</>)}
                  </Button>
                </div>
                {subscription.isActive && upcomingDays.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-900 mb-3">{isRtl ? "تخطّي أيام التوصيل القادمة:" : "Skip upcoming delivery days:"}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {upcomingDays.map((date) => {
                        const skipped = (subscription.skippedDates || []).includes(date);
                        const dObj = new Date(date);
                        return (
                          <button key={date} onClick={() => toggleSkip(date)} disabled={busy}
                            className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors disabled:opacity-50 ${skipped ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-slate-200 text-slate-700 hover:border-cyan-300"}`}>
                            <span className="text-xs font-bold">{dObj.toLocaleDateString(isRtl ? "ar-EG" : "en-US", { weekday: "short" })}</span>
                            <span className="text-[11px] text-slate-400">{dObj.toLocaleDateString(isRtl ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}</span>
                            {skipped && <span className="flex items-center gap-0.5 text-[10px] font-bold mt-0.5"><Ban className="h-3 w-3" />{isRtl ? "متخطّى" : "skipped"}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(subscription.skippedDates || []).length > 0 && (
                      <p className="text-xs text-slate-500 mt-3">{isRtl ? `لديك ${subscription.skippedDates.length} يوم متخطّى` : `${subscription.skippedDates.length} day(s) skipped`}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Loyalty & Referral */}
          {hasSubscription && (
            <Card className="border-2 border-cyan-100 bg-gradient-to-br from-cyan-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900"><Gift className="h-5 w-5 text-cyan-600" />{isRtl ? "الولاء والإحالة" : "Loyalty & Referral"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md"><Award className="h-6 w-6 text-white" /></div>
                    <div>
                      <p className="text-xs text-slate-500">{isRtl ? "رصيد نقاطك" : "Your points"}</p>
                      <p className="text-2xl font-black text-slate-900">{subscription.loyaltyPoints || 0} <span className="text-sm font-bold text-slate-400">{isRtl ? "نقطة" : "pts"}</span></p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-[40%] text-left">
                    {isRtl
                      ? `تكسب ${loyaltyCfg?.pointsPerOrder ?? 10} نقاط مع كل طلب معتمد`
                      : `Earn ${loyaltyCfg?.pointsPerOrder ?? 10} points per approved order`}
                  </p>
                </div>

                {/* ✅ الاستبدال — نقاط → رصيد خصم */}
                {(() => {
                  const cfg = loyaltyCfg || { riyalPerPoint: 0.1, minRedeem: 100 };
                  const pts = Number(subscription.loyaltyPoints || 0);
                  const redeemable = Math.floor(pts / cfg.minRedeem) * cfg.minRedeem;
                  const wouldGet = Math.round(redeemable * cfg.riyalPerPoint * 100) / 100;
                  const credit = Number(subscription.loyaltyCredit || 0);
                  return (
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{isRtl ? "رصيد الخصم المتاح" : "Available discount credit"}</span>
                        <span className="text-lg font-black text-emerald-600">{credit.toFixed(2)} <span className="text-xs font-bold text-slate-400">{isRtl ? "ر.ق" : "QAR"}</span></span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {isRtl
                          ? `كل ${cfg.minRedeem} نقطة = ${Math.round(cfg.minRedeem * cfg.riyalPerPoint * 100) / 100} ر.ق خصم على تجديد اشتراكك.`
                          : `Every ${cfg.minRedeem} points = ${Math.round(cfg.minRedeem * cfg.riyalPerPoint * 100) / 100} QAR off your renewal.`}
                      </p>
                      <Button
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
                        disabled={busy || redeemable < cfg.minRedeem}
                        onClick={redeemPoints}
                      >
                        {redeemable >= cfg.minRedeem
                          ? (isRtl ? `استبدل ${redeemable} نقطة بـ ${wouldGet} ر.ق` : `Redeem ${redeemable} pts for ${wouldGet} QAR`)
                          : (isRtl ? `تحتاج ${cfg.minRedeem} نقطة للاستبدال` : `Need ${cfg.minRedeem} points to redeem`)}
                      </Button>
                    </div>
                  );
                })()}
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-2">{isRtl ? "كود الإحالة الخاص بك:" : "Your referral code:"}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-3 bg-slate-900 rounded-lg text-cyan-300 font-black tracking-widest text-center" dir="ltr">{subscription.referralCode || "—"}</code>
                    <Button variant="outline" className="h-12 border-slate-200" onClick={() => { if (subscription.referralCode) { navigator.clipboard?.writeText(subscription.referralCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
                      {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{isRtl ? "شارك الكود مع أصدقائك — يحصلون على خصم وتحصل أنت على نقاط إضافية." : "Share with friends — they get a discount and you earn bonus points."}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order History */}
          <Card className="border-2 border-[#3CC4F0]/20">
            <CardHeader>
              <CardTitle className="text-[#0F1516] flex items-center justify-between">
                <span>{isRtl ? "سجل الطلبات" : "Order History"}</span>
                <Badge variant="secondary" className="bg-[#3CC4F0]/10 text-[#0E76AC]">{orders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-[#47759C] text-center py-4">
                  {isRtl ? "لا توجد طلبات بعد." : "No orders yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 10).map((o: any) => {
                    const statusMap: Record<string, { ar: string; en: string; cls: string }> = {
                      pending: { ar: "قيد المراجعة", en: "Pending", cls: "bg-amber-100 text-amber-800" },
                      confirmed: { ar: "مؤكّد", en: "Confirmed", cls: "bg-blue-100 text-blue-800" },
                      active: { ar: "قيد التنفيذ", en: "Active", cls: "bg-cyan-100 text-cyan-800" },
                      completed: { ar: "مكتمل", en: "Completed", cls: "bg-green-100 text-green-800" },
                      cancelled: { ar: "ملغي", en: "Cancelled", cls: "bg-red-100 text-red-800" },
                    };
                    const st = statusMap[o.status] || statusMap.pending;
                    return (
                      <div key={o._id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                        <div>
                          <div className="text-sm font-bold text-[#0F1516]">#{o.orderNumber}</div>
                          <div className="text-xs text-[#47759C]">
                            {o.totalMeals} {isRtl ? "وجبة" : "meals"}
                            {o.totalPrice > 0 ? ` · ${o.totalPrice} ${isRtl ? "ر.ق" : "QAR"}` : ""}
                          </div>
                        </div>
                        <Badge className={`${st.cls} border-0`}>{isRtl ? st.ar : st.en}</Badge>
                      </div>
                    );
                  })}
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
