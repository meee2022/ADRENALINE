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
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
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
    logError(error.message, error.stack || errorInfo.componentStack);
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
          <div dir="rtl" className="min-h-screen flex items-center justify-center">
            <p className="text-sm font-bold text-[#47759C]">
              انتهت الجلسة — جاري تحويلك لتسجيل الدخول…
            </p>
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-red-50 via-white to-orange-50"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 mb-2">
              عذراً، حدث خطأ غير متوقع
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              تم تسجيل المشكلة تلقائياً. يمكنك المحاولة مرة أخرى أو تحديث الصفحة.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 mb-4 font-mono break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                المحاولة مجدداً
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                تحديث الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
