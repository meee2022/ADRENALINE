/**
 * @file client/src/pages/pos/PosShell.tsx
 * @description شل POS مستقل — بدون sidebar الإدارة. full-screen touch-friendly.
 */
import { Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation, Link } from "wouter";
import { usePosStore } from "@/lib/posStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import PosLogin from "./PosLogin";
import PosSales from "./PosSales";
import PosReceipts from "./PosReceipts";
import PosShift from "./PosShift";
import PosOpenTickets from "./PosOpenTickets";
import { Home, Receipt, ClipboardList, Clock, LogOut, Loader2 } from "lucide-react";

export default function PosShell() {
  const { token, cashier, clearSession } = usePosStore();
  const [location, setLocation] = useLocation();
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
      <div className="fixed inset-0 bg-slate-900">
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
    <div className="fixed inset-0 bg-slate-100 flex flex-col" dir="ltr">
      {/* Top bar */}
      <header className="h-14 bg-slate-900 text-white flex items-center px-4 gap-3 shrink-0 select-none">
        <div className="font-black text-lg tracking-tight">
          <span className="text-cyan-400">ADRENALINE</span>
          <span className="text-slate-400 mx-2">·</span>
          <span className="text-white/90">POS</span>
        </div>

        <nav className="flex items-center gap-1 ms-6">
          <NavBtn href="/pos" active={location === "/pos"} icon={Home}>Sales</NavBtn>
          <NavBtn href="/pos/tickets" active={location === "/pos/tickets"} icon={ClipboardList}>Open Tickets</NavBtn>
          <NavBtn href="/pos/receipts" active={location === "/pos/receipts"} icon={Receipt}>Receipts</NavBtn>
          <NavBtn href="/pos/shift" active={location === "/pos/shift"} icon={Clock}>Shift</NavBtn>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[11px] text-slate-400 font-bold">CASHIER</div>
            <div className="text-sm font-black">{cashier?.name || "—"}</div>
          </div>
          <button
            onClick={doLogout}
            className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
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
    <Link href={href}>
      <a className={`h-9 px-4 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${active ? "bg-cyan-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
        <Icon className="h-4 w-4" /> {children}
      </a>
    </Link>
  );
}

function PosLoading() {
  return (
    <div className="fixed inset-0 bg-slate-900 grid place-items-center">
      <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
    </div>
  );
}
