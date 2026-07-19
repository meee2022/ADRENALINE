/**
 * @file client/src/pages/pos/PosShell.tsx
 * @description شل POS مستقل — بدون sidebar الإدارة. full-screen touch-friendly.
 */
import { Suspense, useEffect, useState } from "react";
import { Switch, Route, Redirect, useLocation, Link } from "wouter";
import { usePosStore } from "@/lib/posStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import PosLogin from "./PosLogin";
import PosSales from "./PosSales";
import PosReceipts from "./PosReceipts";
import PosShift from "./PosShift";
import PosOpenTickets from "./PosOpenTickets";
import { Home, Receipt, ClipboardList, Clock, LogOut, Loader2, Languages, Menu, X } from "lucide-react";
import { PosManifest, InstallButton } from "@/components/pos/PwaInstall";
import { useLanguage } from "@/lib/i18n";

export default function PosShell() {
  const { token, cashier, clearSession } = usePosStore();
  const [location, setLocation] = useLocation();
  const { language, dir, setLanguage } = useLanguage();
  const [navOpen, setNavOpen] = useState(false);
  const isAr = language === "ar";
  const t = (a: string, e: string) => (isAr ? a : e);
  const me = useQuery(api.pos.me, token ? { token } : "skip");
  const logout = useMutation(api.pos.logout);

  // لو الجلسة انتهت أو غير صالحة — نظّف
  useEffect(() => {
    if (token && me === null) {
      clearSession();
      setLocation("/pos/login");
    }
  }, [token, me, clearSession, setLocation]);

  // مش مسجّل → login
  if (!token && location !== "/pos/login") {
    return <Redirect to="/pos/login" />;
  }

  // في تسجيل الدخول
  if (location === "/pos/login") {
    return (
      <div className="fixed inset-0 bg-[#eef7fb]">
        <PosManifest />
        <Suspense fallback={<PosLoading />}>
          <PosLogin />
        </Suspense>
      </div>
    );
  }

  // في انتظار التحقق من الجلسة
  if (token && me === undefined) {
    return <PosLoading />;
  }

  const doLogout = async () => {
    if (token) await logout({ token });
    clearSession();
    setLocation("/pos/login");
  };

  return (
    <div className="pos-shell fixed inset-0 flex flex-col bg-[#edf5f8] text-[#0F1516]" dir={dir}>
      <PosManifest />
      {/* Top bar */}
      <header className="pos-shell-header min-h-[62px] text-white flex items-center px-3 sm:px-4 gap-2 shrink-0 select-none shadow-[0_8px_30px_rgba(71,117,156,0.18)]">
        <div className="flex items-center gap-2.5 font-black">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/25 bg-white/15 text-sm shadow-inner">A</div>
          <div className="leading-tight">
            <span className="block text-[15px]">ADRENALINE</span>
            <span className="block text-[9px] font-bold text-white/70">HEALTHY FOOD · POS</span>
          </div>
        </div>

        <button onClick={() => setNavOpen((open) => !open)} className="lg:hidden h-10 w-10 grid place-items-center rounded-xl border border-white/20 bg-white/10 hover:bg-white/20" aria-label={t("القائمة", "Menu")}>
          {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <nav className={`${navOpen ? "flex" : "hidden"} absolute top-[66px] inset-x-2 z-50 flex-col rounded-2xl bg-[#173b55] p-2 shadow-xl lg:static lg:flex lg:flex-row lg:items-center lg:gap-1 lg:ms-4 lg:bg-white/10 lg:p-1 lg:shadow-none`}>
          <NavBtn href="/pos" active={location === "/pos"} icon={Home}>{t("مبيعات", "Sales")}</NavBtn>
          <NavBtn href="/pos/tickets" active={location === "/pos/tickets"} icon={ClipboardList}>{t("فواتير مفتوحة", "Open Tickets")}</NavBtn>
          <NavBtn href="/pos/receipts" active={location === "/pos/receipts"} icon={Receipt}>{t("الإيصالات", "Receipts")}</NavBtn>
          <NavBtn href="/pos/shift" active={location === "/pos/shift"} icon={Clock}>{t("الوردية", "Shift")}</NavBtn>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <InstallButton />
          <button
            onClick={() => setLanguage(isAr ? "en" : "ar")}
            className="h-10 px-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            title={t("English", "العربية")}
            aria-label={t("التبديل إلى الإنجليزية", "Switch to Arabic")}
          >
            <Languages className="h-4 w-4" /> {isAr ? "EN" : "عربي"}
          </button>
          <div className={`${isAr ? "text-left" : "text-right"} hidden sm:block leading-tight`}>
            <div className="text-[10px] text-white/60 font-bold">
              {t("الكاشير", "CASHIER")}{(me as any)?.branchName ? ` · ${(me as any).branchName}` : ""}
            </div>
            <div className="text-sm font-black">{cashier?.name || "—"}</div>
          </div>
          <button
            onClick={doLogout}
            className="h-10 px-3 rounded-xl border border-white/20 bg-white/10 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            title={t("خروج", "Logout")}
            aria-label={t("خروج", "Logout")}
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("خروج", "Logout")}</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<PosLoading />}>
          <Switch>
            <Route path="/pos" component={PosSales} />
            <Route path="/pos/tickets" component={PosOpenTickets} />
            <Route path="/pos/receipts" component={PosReceipts} />
            <Route path="/pos/shift" component={PosShift} />
            <Route><Redirect to="/pos" /></Route>
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

function NavBtn({ href, active, icon: Icon, children }: any) {
  return (
    <Link href={href} className={`h-9 px-3 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${active ? "bg-white text-[#17698f] shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
      <Icon className="h-4 w-4" /> {children}
    </Link>
  );
}

function PosLoading() {
  return (
    <div className="fixed inset-0 bg-[#edf5f8] grid place-items-center">
      <Loader2 className="h-12 w-12 text-[#3CC4F0] animate-spin" />
    </div>
  );
}
