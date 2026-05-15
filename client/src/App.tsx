// client/src/App.tsx
import React, { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";

// Admin Pages (Protected)
import Dashboard from "@/pages/DashboardNew1";
import Customers from "@/pages/Customers";
import Users from "@/pages/Users";
import Menu from "@/pages/Menu";
import MenuManagement from "@/pages/MenuManagement";
import PublicMealsManagement from "@/pages/PublicMealsManagement";
import BannersManagement from "@/pages/BannersManagement";
import PlansManagement from "@/pages/PlansManagement";
import Plans from "@/pages/Plans";
import PlansReview from "@/pages/PlansReview";
import Inventory from "@/pages/Inventory";
import InventoryItemDetails from "@/pages/InventoryItemDetails";
import InventoryReports from "@/pages/InventoryReports";
import Suppliers from "@/pages/Suppliers";
import Kitchen from "@/pages/Kitchen";
import Delivery from "@/pages/Delivery";
import Stickers from "@/pages/Stickers";
import OrdersPending from "@/pages/OrdersPending";
import OrderReviewDetail from "@/pages/OrderReviewDetail";
import RestaurantSettings from "@/pages/RestaurantSettings";

// Public Pages (No Auth)
import HomePage from "@/pages/public/HomePage";
import PublicPlans from "@/pages/public/PublicPlansNew";
import PublicMenu from "@/pages/public/PublicMenu";
import MealDetails from "@/pages/public/MealDetails";
import CustomerAuth from "@/pages/public/CustomerAuth";
import CustomerProfile from "@/pages/public/CustomerProfile";
import OrderReview from "@/pages/public/OrderReview";
import AboutPage from "@/pages/public/AboutPage";
import ContactPage from "@/pages/public/ContactPage";

import { AppLayout } from "@/components/layout/AppLayout";
import { useStore } from "@/lib/store";
import { LanguageProvider, useLanguage } from "@/lib/i18n";

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

import { canAccess, ROLE_HOME, type Role } from "@/lib/permissions";
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

  // Role-based access check
  const role = currentUser.role as Role | undefined;
  if (!role) {
    return <Redirect to="/login" />;
  }
  if (!canAccess(role, location)) {
    // Redirect to the role's default home
    const home = ROLE_HOME[role] || "/";
    return <Redirect to={home} />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* ===== Public Routes (No Auth Required) ===== */}
      <Route path="/" component={HomePage} />
      <Route path="/public/plans" component={PublicPlans} />
      <Route path="/public/menu" component={PublicMenu} />
      <Route path="/public/meal/:slug" component={MealDetails} />
      <Route path="/public/order-review" component={OrderReview} />
      <Route path="/public/about" component={AboutPage} />
      <Route path="/public/contact" component={ContactPage} />
      <Route path="/customer/auth" component={CustomerAuth} />
      <Route path="/customer/profile" component={CustomerProfile} />

      {/* ===== Admin Routes (Protected) ===== */}
      <Route path="/login" component={Login} />

      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
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
        <ProtectedRoute component={MenuManagement} />
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
      <Route path="/plans-review/:date">
        <ProtectedRoute component={PlansReview} />
      </Route>
      <Route path="/inventory">
        <ProtectedRoute component={Inventory} />
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
      <Route path="/delivery">
        <ProtectedRoute component={Delivery} />
      </Route>
      <Route path="/stickers">
        <ProtectedRoute component={Stickers} />
      </Route>
      <Route path="/orders/pending">
        <ProtectedRoute component={OrdersPending} />
      </Route>
      <Route path="/orders/review/:orderId">
        <ProtectedRoute component={OrderReviewDetail} />
      </Route>
      <Route path="/settings/restaurant">
        <ProtectedRoute component={RestaurantSettings} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppDirSync />
        <Router />
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
