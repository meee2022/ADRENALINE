/**
 * @file client/src/components/ErrorBoundary.tsx
 * @description React Error Boundary - يلتقط أخطاء العرض ويعرض fallback أنيق
 */
import { Component, type ReactNode } from "react";
import { logError } from "@/lib/logger";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isAuthError } from "@/lib/authError";
import { useStore } from "@/lib/store";
import { convex } from "@/lib/convex";
import { api } from "../../../convex/_generated/api";
import { recoverLatestApplication } from "@/lib/appVersion";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  recovering?: boolean;
  error?: Error;
  refCode?: string; // ✅ رقم مرجعي يعرضه المستخدم لفريق الدعم بدل الرسالة الخام
}

/** رقم مرجعي عشوائي قصير (~8 حروف) — للربط بسجل التشخيص. */
function makeRefCode(): string {
  const a = new Uint8Array(4);
  (globalThis.crypto || (window as any).crypto).getRandomValues(a);
  return "ERR-" + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * يسجّل الانهيار في Convex (clientErrors) — الرقم المرجعي وحده كان بلا سجل
 * يقابله، فكنا نخمّن. يُرسل أيضاً لـendpoint خارجي لو مضبوط.
 */
async function shipToServer(payload: any) {
  try {
    await convex.mutation(api.clientErrors.report, {
      refCode: String(payload.refCode || ""),
      message: String(payload.message || ""),
      stack: payload.stack ? String(payload.stack) : undefined,
      path: payload.path ? String(payload.path) : undefined,
      userAgent: payload.userAgent ? String(payload.userAgent) : undefined,
      userName: payload.userName ? String(payload.userName) : undefined,
    });
  } catch {
    // فشل التسجيل لا يمنع عرض الشاشة
  }
  try {
    const url = (import.meta as any).env?.VITE_ERROR_LOG_ENDPOINT;
    if (!url) return;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // لا نمنع UI بسبب فشل التقرير
  }
}

// class component لا يستطيع استخدام hook — نقرأ اللغة من نفس مفتاح التخزين
const isRtlLang = () => {
  try {
    return localStorage.getItem("app_language") !== "en";
  } catch {
    return true;
  }
};
const tr = (a: string, e: string) => (isRtlLang() ? a : e);

function isRecoverableRuntimeError(error?: Error): boolean {
  const message = error?.message || "";
  const staleChunk =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Load failed|Unable to load script|Failed to load module script|dynamically imported module/i.test(
      message,
    );
  const staleDevReact =
    import.meta.env.DEV &&
    (/Invalid hook call/i.test(message) ||
      /Cannot read properties of null \(reading '(useState|useEffect|useMemo|useContext)'\)/i.test(
        message,
      ));

  return staleChunk || staleDevReact;
}

function friendlyError(error?: Error) {
  const message = error?.message || "";
  if (/CONVEX|Server Error|Failed to fetch|NetworkError|network request/i.test(message)) {
    return {
      title: tr("تعذّر تحميل بيانات الصفحة", "Page data could not be loaded"),
      description: tr(
        "قد تكون الجلسة قديمة أو أن الاتصال بالخدمة انقطع مؤقتًا. بياناتك محفوظة، ويمكنك تحميل أحدث نسخة أو تسجيل الدخول من جديد.",
        "Your session may be stale or the service was temporarily unreachable. Your data is safe; load the latest version or sign in again.",
      ),
    };
  }
  return {
    title: tr("تعذّر إكمال تحميل الصفحة", "This page could not finish loading"),
    description: tr(
      "تم حفظ رقم مرجعي للمشكلة. سنحاول أولًا تشغيل أحدث نسخة بدون التأثير على بياناتك.",
      "A reference was saved for this issue. We will first try the latest version without affecting your data.",
    ),
  };
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, recovering: false, error, refCode: makeRefCode() };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // ✅ نسخة جديدة منشورة: أسماء chunks القديمة (بالـ hash) لم تعد موجودة،
    //    فيفشل الاستيراد الديناميكي. الحل: تحديث تلقائي مرة واحدة (يجلب
    //    index.html الجديد). حارس sessionStorage يمنع حلقة تحديث لانهائية.
    if (isRecoverableRuntimeError(error)) {
      const KEY = "runtime-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }
    // جلسة منتهية أو مُبطَلة (تغيير كلمة المرور يُبطل الجلسات): لا تُظهر
    // شاشة انهيار — نظّف الجلسة وأعد الموظف لصفحة الدخول.
    if (isAuthError(error)) {
      try {
        useStore.getState().logout();
      } catch {
        // لو انهار الـstore نفسه، لا نمنع إعادة التوجيه
      }
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
      return;
    }
    // ✅ سجل محلياً + أرسل لـendpoint داخلي (لو مضبوط) — لا نعد المستخدم بشيء لا يحدث
    logError(error.message, error.stack || errorInfo.componentStack);
    let userName = "";
    try {
      const st: any = useStore.getState();
      userName = st?.currentUser?.fullName || st?.currentUser?.username || "";
    } catch {
      // المستخدم غير معروف — لا يمنع التسجيل
    }
    void shipToServer({
      refCode: this.state.refCode,
      message: error.message,
      stack: error.stack || errorInfo.componentStack,
      path: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      userName,
      at: Date.now(),
    });

    // One automatic recovery for unexpected production failures. The guard is
    // stored per path so a real code defect cannot create an endless reload
    // loop. If it repeats, the user gets the clear fallback below.
    const recoveryKey = `unexpected-recovery:${window.location.pathname}`;
    let shouldRecover = true;
    try {
      const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
      shouldRecover = Date.now() - lastRecovery > 60_000;
      if (shouldRecover) sessionStorage.setItem(recoveryKey, String(Date.now()));
    } catch {
      // Private browsing can reject storage; allow one in-memory recovery.
    }
    if (shouldRecover) {
      this.setState({ recovering: true });
      window.setTimeout(() => void recoverLatestApplication(), 700);
    }
  }

  handleReload = () => {
    this.setState({ recovering: true });
    void recoverLatestApplication();
  };

  render() {
    if (this.state.hasError) {
      if (isRecoverableRuntimeError(this.state.error) || this.state.recovering) {
        return (
          <div
            dir={isRtlLang() ? "rtl" : "ltr"}
            className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
          >
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <RefreshCw className="h-5 w-5 animate-spin text-[#0E76AC]" />
              <div>
                <p className="text-sm font-extrabold text-slate-800">
                  {tr("جاري تشغيل أحدث نسخة", "Loading the latest version")}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {tr(
                    "لن تتأثر بياناتك، وسيتم فتح الصفحة تلقائيًا خلال لحظات.",
                    "Your data will not be affected. The page will reopen automatically.",
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      }

      // جلسة منتهية: componentDidCatch يعيد التوجيه — لا تومض شاشة الانهيار
      if (isAuthError(this.state.error)) {
        return (
          <div dir={isRtlLang() ? "rtl" : "ltr"} className="min-h-screen flex items-center justify-center">
            <p className="text-sm font-bold text-[#47759C]">
              {tr("انتهت الجلسة — جاري تحويلك لتسجيل الدخول…", "Session expired — redirecting you to sign in…")}
            </p>
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;

      const explanation = friendlyError(this.state.error);

      return (
        <div
          dir={isRtlLang() ? "rtl" : "ltr"}
          className="min-h-screen flex items-center justify-center bg-slate-100 p-5"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_16px_45px_-30px_rgba(15,21,22,.35)] sm:p-8">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <p className="mb-2 text-xs font-extrabold text-[#0E76AC]">
              {tr("الموقع يعمل، لكن هذه الصفحة تحتاج إعادة تحميل", "The site is online; this page needs to reload")}
            </p>
            <h1 className="mb-3 text-2xl font-black text-slate-900">
              {explanation.title}
            </h1>
            <p className="mx-auto mb-5 max-w-sm text-sm font-medium leading-7 text-slate-600">
              {explanation.description}
            </p>
            {/* 🔒 لا نعرض error.message للمستخدم النهائي (قد يحتوي أسماء دوال داخلية).
                نعرض رقماً مرجعياً مختصراً يقرأه الدعم لربطه بالسجل. */}
            {this.state.refCode && (
              <p className="mb-5 rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200/70 break-words select-all">
                {tr("مرجع الدعم:", "Support reference:")} <span className="font-bold text-slate-700">{this.state.refCode}</span>
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={this.handleReload}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0E76AC] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#095f89] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
              >
                <RefreshCw className="h-4 w-4" />
                {tr("تحميل أحدث نسخة", "Load latest version")}
              </button>
              <button
                onClick={() => window.location.assign("/login")}
                className="min-h-11 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                {tr("تسجيل الدخول من جديد", "Sign in again")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
