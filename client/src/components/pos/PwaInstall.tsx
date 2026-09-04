/**
 * @file client/src/components/pos/PwaInstall.tsx
 * @description Wrapper يبدّل manifest.webmanifest إلى pos-manifest.webmanifest
 *   على راوتات /pos، ويعرض زرار "Install as app" ذكي:
 *   - Android/Chrome: يستخدم beforeinstallprompt event
 *   - iOS Safari: يعرض إرشادات "Share → Add to Home Screen"
 *   - لو التطبيق مثبَّت أصلاً (standalone) — الزر يختفي.
 */
import { useEffect, useState } from "react";
import { isNativeShell } from "@/lib/native";
import { Download, Share } from "lucide-react";

const MANIFEST_ID = "app-manifest";
const POS_MANIFEST = "/pos-manifest.webmanifest";
const APP_MANIFEST = "/manifest.webmanifest";

/** يبدّل manifest link + iOS title لما يكون الراوت /pos */
export function PosManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>(`link#${MANIFEST_ID}`)
      || document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    if (link) link.setAttribute("href", POS_MANIFEST);

    // iOS يستخدم meta apple-mobile-web-app-title لاسم الأيقونة على الشاشة الرئيسية
    const iosTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const prevIosTitle = iosTitle?.getAttribute("content");
    if (iosTitle) iosTitle.setAttribute("content", "Adrenaline POS");

    // Theme color داكن للـPOS (يظهر في الـstatus bar عند التثبيت)
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = themeColor?.getAttribute("content");
    if (themeColor) themeColor.setAttribute("content", "#0B1220");
    else {
      const m = document.createElement("meta");
      m.name = "theme-color";
      m.content = "#0B1220";
      document.head.appendChild(m);
    }

    return () => {
      if (link && prev) link.setAttribute("href", prev);
      else if (link) link.setAttribute("href", APP_MANIFEST);
      if (iosTitle && prevIosTitle) iosTitle.setAttribute("content", prevIosTitle);
      if (themeColor && prevTheme) themeColor.setAttribute("content", prevTheme);
    };
  }, []);
  return null;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** زر تثبيت PWA ذكي — يظهر بس لما فيه إمكانية تثبيت أو على iOS بدون تثبيت. */
export function InstallButton(props: { className?: string }) {
  // داخل تطبيق المتجر لا معنى لـ«ثبّت التطبيق» — التطبيق مثبّت أصلاً
  if (isNativeShell()) return null;
  return <InstallButtonInner {...props} />;
}

function InstallButtonInner({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [showIosHint, setShowIosHint] = useState<boolean>(false);
  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as any).standalone === true);

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  if (installed) return null;

  const doInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const c = await deferred.userChoice;
      if (c.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIos) setShowIosHint(true);
  };

  // مافيش إمكانية تثبيت وliمش iOS — نخفي الزر
  if (!deferred && !isIos) return null;

  return (
    <>
      <button
        onClick={doInstall}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black text-white shadow-md hover:shadow-lg transition-all active:scale-95 ${className}`}
        style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}
        title="ثبّت التطبيق على شاشتك الرئيسية"
      >
        <Download className="h-3.5 w-3.5" />
        ثبّت كتطبيق
      </button>

      {showIosHint && (
        <div className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center bg-black/60 p-4" onClick={() => setShowIosHint(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-2xl grid place-items-center bg-cyan-100">
                <img src="/heart-logo.png" alt="" className="h-8 w-8" />
              </div>
              <div>
                <p className="font-black text-lg text-slate-900">ثبّت Adrenaline POS</p>
                <p className="text-xs text-slate-500 font-bold">ليعمل كتطبيق كامل على شاشتك</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-cyan-100 text-[#0E76AC] font-black grid place-items-center text-xs">1</span>
                <span>
                  اضغط زرار <b>المشاركة</b> <Share className="inline h-4 w-4 text-[#0E76AC] mx-0.5" /> في شريط Safari تحت
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-cyan-100 text-[#0E76AC] font-black grid place-items-center text-xs">2</span>
                <span>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> (Add to Home Screen)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-cyan-100 text-[#0E76AC] font-black grid place-items-center text-xs">3</span>
                <span>اضغط <b>«إضافة»</b> — التطبيق يظهر كأيقونة زي أي app</span>
              </li>
            </ol>

            <button onClick={() => setShowIosHint(false)} className="mt-5 w-full h-11 rounded-xl bg-slate-100 text-slate-800 font-black">
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
