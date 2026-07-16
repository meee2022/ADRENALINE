/**
 * @file client/src/pages/pos/PosLogin.tsx
 * @description PIN login للكاشير — لوحة أرقام كبيرة تعمل باللمس.
 */
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { useLocation } from "wouter";
import { Delete, Lock, Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function PosLogin() {
  const { language, dir, setLanguage } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => isAr ? ar : en;
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useMutation(api.pos.loginWithPin);
  const setSession = usePosStore((s) => s.setSession);
  const [, setLocation] = useLocation();

  const add = (d: string) => {
    if (pin.length >= 6) return;
    setErr("");
    setPin((p) => p + d);
  };
  const del = () => { setErr(""); setPin((p) => p.slice(0, -1)); };
  const clear = () => { setErr(""); setPin(""); };

  const submit = async () => {
    if (pin.length < 4) { setErr(t("يجب أن يتكون PIN من 4 أرقام على الأقل", "PIN must be at least 4 digits")); return; }
    setBusy(true);
    try {
      const r = await login({ pin });
      setSession(r.token, r.cashier);
      setLocation("/pos");
    } catch (e: any) {
      setErr(e?.message?.replace("[CONVEX M(pos:loginWithPin)] ", "") || t("حدث خطأ", "Something went wrong"));
      setPin("");
    } finally { setBusy(false); }
  };

  const digits = ["1","2","3","4","5","6","7","8","9"];

  return (
    <div dir={dir} className="fixed inset-0 grid place-items-center bg-[linear-gradient(145deg,#edf7fa,#dff3f8_52%,#edf3f6)] p-4">
      <button onClick={() => setLanguage(isAr ? "en" : "ar")} className="absolute top-4 end-4 h-10 rounded-xl border border-[#bcdce7] bg-white px-3 text-xs font-black text-[#315d76] shadow-sm hover:bg-[#eaf8fc]">
        <Languages className="me-2 inline h-4 w-4" />{isAr ? "English" : "العربية"}
      </button>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6 select-none">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#3CC4F0,#47759C)] text-2xl font-black text-white shadow-[0_12px_30px_rgba(60,196,240,0.28)]">A</div>
          <div className="inline-flex items-center gap-2 text-[#173b55] font-black text-3xl">
            ADRENALINE
          </div>
          <div className="text-[#698392] font-bold mt-1 text-sm">HEALTHY FOOD · POINT OF SALE</div>
        </div>

        {/* PIN indicator */}
        <div className="rounded-3xl border border-white bg-white/95 p-6 shadow-[0_24px_60px_rgba(71,117,156,0.16)]">
          <div className="text-center text-[#698392] text-xs font-bold uppercase mb-4 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" /> {t("أدخل الرقم السري", "Enter your PIN")}
          </div>

          <div className="flex justify-center gap-3 mb-2">
            {[0,1,2,3,4,5].map((i) => {
              const filled = i < pin.length;
              return (
                <div key={i} className={`h-3.5 w-3.5 rounded-full transition-all ${filled ? "bg-[#3CC4F0] shadow-[0_0_0_5px_rgba(60,196,240,0.12)]" : "bg-[#d9e6eb]"}`} />
              );
            })}
          </div>

          <div className="min-h-[24px] text-center text-sm text-red-400 font-bold mt-1">{err}</div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {digits.map((d) => (
              <button
                key={d}
                onClick={() => add(d)}
                disabled={busy}
                className="h-16 rounded-2xl border border-[#d8e6ec] bg-[#f7fafb] hover:border-[#9ddcf0] hover:bg-[#eaf8fc] active:bg-[#3CC4F0] active:text-white text-[#17324d] text-3xl font-black transition-all shadow-sm active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              onClick={clear}
              disabled={busy}
              className="h-16 rounded-2xl border border-[#d8e6ec] bg-[#f7fafb] hover:bg-red-50 text-[#698392] text-xs font-black uppercase transition-all"
            >
              {t("مسح", "Clear")}
            </button>
            <button
              onClick={() => add("0")}
              disabled={busy}
              className="h-16 rounded-2xl border border-[#d8e6ec] bg-[#f7fafb] hover:bg-[#eaf8fc] active:bg-[#3CC4F0] active:text-white text-[#17324d] text-3xl font-black transition-all"
            >
              0
            </button>
            <button
              onClick={del}
              disabled={busy}
              className="h-16 rounded-2xl border border-[#d8e6ec] bg-[#f7fafb] hover:bg-red-50 text-[#607987] grid place-items-center transition-all"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          <button
            onClick={submit}
            disabled={busy || pin.length < 4}
            className="w-full mt-4 h-14 rounded-2xl bg-[linear-gradient(135deg,#3CC4F0,#2BB0DC,#47759C)] disabled:bg-[#dbe5e9] disabled:text-[#94a3b8] text-white text-lg font-black transition-all shadow-[0_10px_24px_rgba(60,196,240,0.28)]"
          >
            {busy ? "..." : t("تسجيل الدخول", "Sign In")}
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 select-none">
          Adrenaline Healthy Food · POS Terminal
        </p>
      </div>
    </div>
  );
}
