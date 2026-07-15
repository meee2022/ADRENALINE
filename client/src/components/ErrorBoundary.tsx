/**
 * @file client/src/components/ErrorBoundary.tsx
 * @description React Error Boundary - يلتقط أخطاء العرض ويعرض fallback أنيق
 */
import { Component, type ReactNode } from "react";
import { logError } from "@/lib/logger";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isAuthError } from "@/lib/authError";
import { useStore } from "@/lib/store";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  refCode?: string; // ✅ رقم مرجعي يعرضه المستخدم لفريق الدعم بدل الرسالة الخام
}

/** رقم مرجعي عشوائي قصير (~8 حروف) — للربط بسجل التشخيص. */
function makeRefCode(): string {
  const a = new Uint8Array(4);
  (globalThis.crypto || (window as any).crypto).getRandomValues(a);
  return "ERR-" + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** يحاول إرسال الخطأ لـendpoint داخلي لو مضبوط (VITE_ERROR_LOG_ENDPOINT). */
async function shipToServer(payload: any) {
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

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, refCode: makeRefCode() };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // ✅ نسخة جديدة منشورة: أسماء chunks القديمة (بالـ hash) لم تعد موجودة،
    //    فيفشل الاستيراد الديناميكي. الحل: تحديث تلقائي مرة واحدة (يجلب
    //    index.html الجديد). حارس sessionStorage يمنع حلقة تحديث لانهائية.
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message || "")) {
      const KEY = "chunk-reload-at";
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
    void shipToServer({
      refCode: this.state.refCode,
      message: error.message,
      stack: error.stack || errorInfo.componentStack,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      at: Date.now(),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
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

      return (
        <div
          dir={isRtlLang() ? "rtl" : "ltr"}
          className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-red-50 via-white to-orange-50"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 mb-2">
              {tr("عذراً، حدث خطأ غير متوقع", "Sorry, an unexpected error occurred")}
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              {tr("تم تسجيل المشكلة. جرّب مجدداً أو حدّث الصفحة. لو استمر الخطأ، أرسل الرقم المرجعي لفريق الدعم.", "The issue has been logged. Try again or refresh the page. If it persists, send the reference code to support.")}
            </p>
            {/* 🔒 لا نعرض error.message للمستخدم النهائي (قد يحتوي أسماء دوال داخلية).
                نعرض رقماً مرجعياً مختصراً يقرأه الدعم لربطه بالسجل. */}
            {this.state.refCode && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-4 font-mono break-words select-all">
                {tr("الرقم المرجعي:", "Reference code:")} <span className="font-bold text-slate-700">{this.state.refCode}</span>
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {tr("المحاولة مجدداً", "Try again")}
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                {tr("تحديث الصفحة", "Refresh page")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
