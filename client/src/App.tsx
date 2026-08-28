// client/src/App.tsx
import React, { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";

// ✅ كل الصفحات تُحمّل عند الطلب (code-splitting) — يقلّل حجم أول تحميل بشكل كبير
//    (المكتبات التقيلة مثل recharts/xlsx تخرج من الحزمة الأولى).
// Admin Pages (Protected)
const Dashboard = lazy(() => import("@/pages/DashboardNew1"));
const Customers = lazy(() => import("@/pages/Customers"));
const Users = lazy(() => import("@/pages/Users"));
const Menu = lazy(() => import("@/pages/Menu"));
const PublicMealsManagement = lazy(() => import("@/pages/PublicMealsManagement"));
const BannersManagement = lazy(() => import("@/pages/BannersManagement"));
const PlansManagement = lazy(() => import("@/pages/PlansManagement"));
const Plans = lazy(() => import("@/pages/Plans"));
const Customized = lazy(() => import("@/pages/Customized"));
const PlansReview = lazy(() => import("@/pages/PlansReview"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const InventoryItemDetails = lazy(() => import("@/pages/InventoryItemDetails"));
const InventoryReports = lazy(() => import("@/pages/InventoryReports"));
const WasteReport = lazy(() => import("@/pages/WasteReport"));
const ReceiveGoods = lazy(() => import("@/pages/ReceiveGoods"));
const InvoiceImport = lazy(() => import("@/pages/InvoiceImport"));
const InventoryAlerts = lazy(() => import("@/pages/InventoryAlerts"));
const PurchaseOrders = lazy(() => import("@/pages/PurchaseOrders"));
const StockTake = lazy(() => import("@/pages/StockTake"));
const InventorySetup = lazy(() => import("@/pages/InventorySetup"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Kitchen = lazy(() => import("@/pages/Kitchen"));
const DailyProductionAudit = lazy(() => import("@/pages/DailyProductionAudit"));
const Delivery = lazy(() => import("@/pages/Delivery"));
const DriverApp = lazy(() => import("@/pages/DriverApp"));
const TrackOrder = lazy(() => import("@/pages/public/TrackOrder"));
const PublicMealPlan = lazy(() => import("@/pages/public/PublicMealPlan"));
const Stickers = lazy(() => import("@/pages/Stickers"));
const OutletLabels = lazy(() => import("@/pages/OutletLabels"));
const PantryLabels = lazy(() => import("@/pages/PantryLabels"));
const OutletScan = lazy(() => import("@/pages/OutletScan"));
const Payroll = lazy(() => import("@/pages/Payroll"));
const Leaves = lazy(() => import("@/pages/Leaves"));
const Attendance = lazy(() => import("@/pages/Attendance"));
const MealIssuance = lazy(() => import("@/pages/MealIssuance"));
const GymSales = lazy(() => import("@/pages/GymSales"));
const PosAdmin = lazy(() => import("@/pages/PosAdmin"));
const ManagerLive = lazy(() => import("@/pages/ManagerLive"));
const PosShell = lazy(() => import("@/pages/pos/PosShell"));
const DriverAssignments = lazy(() => import("@/pages/DriverAssignments"));
// ⛔ «طلبات أونلاين» معطّلة (2026-07-26): مبيعات المنافذ صارت تغطّيها، والجدول لم
//    يستقبل طلباً واحداً قط. الصفحة ودوالّها والويبهوك باقية كما هي — تعطيل لا حذف،
//    فإعادتها = سطر lazy + سطر Route + بند القائمة.
// const OnlineOrders = lazy(() => import("@/pages/OnlineOrders"));
const OrdersPending = lazy(() => import("@/pages/OrdersPending"));
const OrderReviewDetail = lazy(() => import("@/pages/OrderReviewDetail"));
const RestaurantSettings = lazy(() => import("@/pages/RestaurantSettings"));
const AuditLog = lazy(() => import("@/pages/AuditLog"));
const ClientErrors = lazy(() => import("@/pages/ClientErrors"));
const Reports = lazy(() => import("@/pages/Reports"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));
const OrderTracking = lazy(() => import("@/pages/public/OrderTracking"));
const Coupons = lazy(() => import("@/pages/Coupons"));
const PromoStudio = lazy(() => import("@/pages/PromoStudio"));
const PayLaterPayments = lazy(() => import("@/pages/PayLaterPayments"));
const SendPaymentLink = lazy(() => import("@/pages/SendPaymentLink"));
const Finance = lazy(() => import("@/pages/Finance"));
const AdminActionCenter = lazy(() => import("@/pages/AdminActionCenter"));
const LoyaltyRatings = lazy(() => import("@/pages/LoyaltyRatings"));
const CustomerCrm = lazy(() => import("@/pages/CustomerCrm"));

// Public Pages (No Auth)
const HomePage = lazy(() => import("@/pages/public/HomePage"));
const PublicPlans = lazy(() => import("@/pages/public/PublicPlansNew"));
const PublicMenu = lazy(() => import("@/pages/public/PublicMenu"));
// 🧪 نموذج تجريبي غير مربوط — يُحذف لو لم يُعتمد
const MenuV2Demo = lazy(() => import("@/pages/public/MenuV2Demo"));
const MealDetails = lazy(() => import("@/pages/public/MealDetails"));
const CustomerAuth = lazy(() => import("@/pages/public/CustomerAuth"));
const CustomerProfile = lazy(() => import("@/pages/public/CustomerProfile"));
const OrderReview = lazy(() => import("@/pages/public/OrderReview"));
const AboutPage = lazy(() => import("@/pages/public/AboutPage"));
const SmartPlan = lazy(() => import("@/pages/public/SmartPlan"));
const HowToSubscribe = lazy(() => import("@/pages/public/HowToSubscribe"));
const PayLaterCheckout = lazy(() => import("@/pages/public/PayLaterCheckout"));
const PayLaterResult = lazy(() => import("@/pages/public/PayLaterResult"));
const ContactPage = lazy(() => import("@/pages/public/ContactPage"));
const CalorieCalculator = lazy(() => import("@/pages/public/CalorieCalculator"));
const PrivacyPolicy = lazy(() => import("@/pages/public/LegalPages").then((m) => ({ default: m.PrivacyPolicy })));
const TermsAndConditions = lazy(() => import("@/pages/public/LegalPages").then((m) => ({ default: m.TermsAndConditions })));

import { AppLayout } from "@/components/layout/AppLayout";
import { useStore } from "@/lib/store";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installGlobalErrorHandlers } from "@/lib/logger";
import { isNutriResetHost } from "@/lib/restaurantBrand";

if (typeof window !== "undefined") {
  installGlobalErrorHandlers();
}

function AppDirSync() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  useEffect(() => {
    document.documentElement.lang = language === "ar" ? "ar" : "en";
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.body.dir = isRtl ? "rtl" : "ltr";

    document.documentElement.classList.toggle("rtl", isRtl);
    document.documentElement.classList.toggle("ltr", !isRtl);
  }, [language, dir, isRtl]);

  return null;
}

import { canAccessUser, ROLE_HOME, type Role } from "@/lib/permissions";
import { useLocation as useWouterLocation } from "wouter";

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { currentUser } = useStore();
  const [location] = useWouterLocation();

  if (!currentUser) {
    return <Redirect to="/login" />;
  }

  // Role + per-user permission check
  const role = currentUser.role as Role | undefined;
  if (!role) {
    return <Redirect to="/login" />;
  }
  if (!canAccessUser(currentUser, location)) {
    // ✅ نحوّل لصفحة يقدر المستخدم يوصلها فعلاً — نتجنّب حلقة التحويل اللا نهائية
    //    (مثلاً سائق صلاحيته /driver فقط، لكن ROLE_HOME لدوره /delivery غير مسموحة له → بياض).
    let home = ROLE_HOME[role] || "/";
    if (!canAccessUser(currentUser, home)) {
      const firstPerm = (currentUser.permissions || []).find((p) => p !== "/" && !p.endsWith("/*"));
      home = firstPerm || "/";
    }
    if (home === location) home = "/"; // حماية إضافية من الحلقة
    return <Redirect to={home} />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="جاري التحميل"
      className="flex items-center justify-center min-h-[60vh] w-full"
    >
      <div className="h-10 w-10 rounded-full border-4 border-[#3cc4f0]/30 border-t-[#0E76AC] animate-spin" />
      <span className="sr-only">جاري التحميل…</span>
    </div>
  );
}

function DomainHome() {
  return isNutriResetHost() ? <PublicMenu /> : <HomePage />;
}

function Router() {
  return (
    <Switch>
      {/* ===== Public Routes (No Auth Required) ===== */}
      <Route path="/" component={DomainHome} />
      <Route path="/public/plans" component={PublicPlans} />
      <Route path="/public/menu" component={PublicMenu} />
      <Route path="/nutri-reset/menu" component={PublicMenu} />
      <Route path="/public/menu-v2" component={MenuV2Demo} />
      <Route path="/public/meal/:slug" component={MealDetails} />
      <Route path="/public/order-review" component={OrderReview} />
      <Route path="/nutri-reset/order-review" component={OrderReview} />
      <Route path="/public/about" component={AboutPage} />
      <Route path="/public/contact" component={ContactPage} />
      <Route path="/public/calorie-calculator" component={CalorieCalculator} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsAndConditions} />
      <Route path="/support" component={ContactPage} />
      <Route path="/customer/auth" component={CustomerAuth} />
      <Route path="/customer/profile" component={CustomerProfile} />
      <Route path="/customer/smart-plan" component={SmartPlan} />
      <Route path="/public/how-to-subscribe" component={HowToSubscribe} />
      <Route path="/public/paylater" component={PayLaterCheckout} />
      <Route path="/public/paylater/result" component={PayLaterResult} />
      {/* تتبّع الطلب — عام برابط سرّي */}
      <Route path="/track/:token" component={TrackOrder} />
      <Route path="/plan/:token" component={PublicMealPlan} />

      {/* ===== POS Shell (شل مستقل — بيتحقّق بـPIN داخلياً، مفيش ProtectedRoute) ===== */}
      <Route path="/pos" component={PosShell} />
      <Route path="/pos/:sub*" component={PosShell} />

      {/* ===== Admin Routes (Protected) ===== */}
      <Route path="/login" component={Login} />

      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/admin-center">
        <ProtectedRoute component={AdminActionCenter} />
      </Route>
      <Route path="/loyalty-ratings">
        <ProtectedRoute component={LoyaltyRatings} />
      </Route>
      <Route path="/crm">
        <ProtectedRoute component={CustomerCrm} />
      </Route>
      <Route path="/customers">
        <ProtectedRoute component={Customers} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/menu">
        <ProtectedRoute component={Menu} />
      </Route>
      <Route path="/menu-management">
        <ProtectedRoute component={PublicMealsManagement} />
      </Route>
      <Route path="/public-meals-management">
        <ProtectedRoute component={PublicMealsManagement} />
      </Route>
      <Route path="/banners">
        <ProtectedRoute component={BannersManagement} />
      </Route>
      <Route path="/plans-management">
        <ProtectedRoute component={PlansManagement} />
      </Route>
      <Route path="/plans">
        <ProtectedRoute component={Plans} />
      </Route>
      <Route path="/customized">
        <ProtectedRoute component={Customized} />
      </Route>
      <Route path="/plans-review/:date">
        <ProtectedRoute component={PlansReview} />
      </Route>
      <Route path="/inventory">
        <ProtectedRoute component={Inventory} />
      </Route>
      <Route path="/inventory/waste">
        <ProtectedRoute component={WasteReport} />
      </Route>
      <Route path="/invoice-import">
        <ProtectedRoute component={InvoiceImport} />
      </Route>
      <Route path="/inventory/receive">
        <ProtectedRoute component={ReceiveGoods} />
      </Route>
      <Route path="/inventory/alerts">
        <ProtectedRoute component={InventoryAlerts} />
      </Route>
      <Route path="/inventory/purchase-orders">
        <ProtectedRoute component={PurchaseOrders} />
      </Route>
      <Route path="/inventory/stock-take">
        <ProtectedRoute component={StockTake} />
      </Route>
      <Route path="/inventory/setup">
        <ProtectedRoute component={InventorySetup} />
      </Route>
      <Route path="/inventory/:id">
        <ProtectedRoute component={InventoryItemDetails} />
      </Route>
      <Route path="/inventory-reports">
        <ProtectedRoute component={InventoryReports} />
      </Route>
      <Route path="/suppliers">
        <ProtectedRoute component={Suppliers} />
      </Route>
      <Route path="/kitchen">
        <ProtectedRoute component={Kitchen} />
      </Route>
      <Route path="/production-audit">
        <ProtectedRoute component={DailyProductionAudit} />
      </Route>
      <Route path="/meal-issuance">
        <ProtectedRoute component={MealIssuance} />
      </Route>
      <Route path="/gym-sales">
        <ProtectedRoute component={GymSales} />
      </Route>
      <Route path="/finance">
        <ProtectedRoute component={Finance} />
      </Route>
      <Route path="/pos-admin">
        <ProtectedRoute component={PosAdmin} />
      </Route>
      <Route path="/manager">
        <ProtectedRoute component={ManagerLive} />
      </Route>
      <Route path="/drivers">
        <ProtectedRoute component={DriverAssignments} />
      </Route>
      <Route path="/delivery">
        <ProtectedRoute component={Delivery} />
      </Route>
      <Route path="/driver">
        <ProtectedRoute component={DriverApp} />
      </Route>
      <Route path="/stickers">
        <ProtectedRoute component={Stickers} />
      </Route>
      <Route path="/outlet-labels">
        <ProtectedRoute component={OutletLabels} />
      </Route>
      <Route path="/pantry-labels">
        <ProtectedRoute component={PantryLabels} />
      </Route>
      <Route path="/outlet-scan">
        <ProtectedRoute component={OutletScan} />
      </Route>
      <Route path="/payroll">
        <ProtectedRoute component={Payroll} />
      </Route>
      <Route path="/leaves">
        <ProtectedRoute component={Leaves} />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={Attendance} />
      </Route>
      <Route path="/orders/pending">
        <ProtectedRoute component={OrdersPending} />
      </Route>
      <Route path="/orders/review/:orderId">
        <ProtectedRoute component={OrderReviewDetail} />
      </Route>
      {/* توافق مع روابط إشعارات الطلبات القديمة */}
      <Route path="/orders/:orderId">
        {(params) => <Redirect to={`/orders/review/${params.orderId}`} />}
      </Route>
      <Route path="/settings/restaurant">
        <ProtectedRoute component={RestaurantSettings} />
      </Route>
      <Route path="/audit-log">
        <ProtectedRoute component={AuditLog} />
      </Route>
      <Route path="/client-errors">
        <ProtectedRoute component={ClientErrors} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsDashboard} />
      </Route>
      <Route path="/public/track" component={OrderTracking} />
      <Route path="/coupons">
        <ProtectedRoute component={Coupons} />
      </Route>
      <Route path="/promo-studio">
        <ProtectedRoute component={PromoStudio} />
      </Route>
      <Route path="/paylater-payments">
        <ProtectedRoute component={PayLaterPayments} />
      </Route>
      <Route path="/send-payment-link">
        <ProtectedRoute component={SendPaymentLink} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AppDirSync />
          <Suspense fallback={<PageLoader />}>
            <Router />
          </Suspense>
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
