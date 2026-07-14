/**
 * @file client/src/pages/pos/PosLogin.tsx
 * @description PIN login للكاشير — لوحة أرقام كبيرة تعمل باللمس.
 */
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { useLocation } from "wouter";
import { Delete, Lock } from "lucide-react";

export default function PosLogin() {
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
    if (pin.length < 4) { setErr("PIN لازم 4 أرقام على الأقل"); return; }
    setBusy(true);
    try {
      const r = await login({ pin });
      setSession(r.token, r.cashier);
      setLocation("/pos");
    } catch (e: any) {
      setErr(e?.message?.replace("[CONVEX M(pos:loginWithPin)] ", "") || "خطأ");
      setPin("");
    } finally { setBusy(false); }
  };

  const digits = ["1","2","3","4","5","6","7","8","9"];

  return (
    <div className="fixed inset-0 grid place-items-center p-4"
      style={{ background: "radial-gradient(circle at 30% 20%, #0e2a4a 0%, #050b18 60%, #000 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8 select-none">
          <div className="inline-flex items-center gap-2 text-cyan-400 font-black text-3xl tracking-tight">
            ADRENALINE
          </div>
          <div className="text-slate-400 font-bold mt-1 text-lg">Point of Sale</div>
        </div>

        {/* PIN indicator */}
        <div className="bg-slate-900/70 backdrop-blur rounded-2xl p-6 border border-slate-800 shadow-2xl">
          <div className="text-center text-slate-400 text-xs font-bold uppercase mb-4 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Enter your PIN
          </div>

          <div className="flex justify-center gap-3 mb-2">
            {[0,1,2,3,4,5].map((i) => {
              const filled = i < pin.length;
              return (
                <div key={i} className={`h-4 w-4 rounded-full transition-all ${filled ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]" : "bg-slate-700"}`} />
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
                className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 text-white text-3xl font-black transition-all shadow-md active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              onClick={clear}
              disabled={busy}
              className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => add("0")}
              disabled={busy}
              className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 text-white text-3xl font-black transition-all"
            >
              0
            </button>
            <button
              onClick={del}
              disabled={busy}
              className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 text-white grid place-items-center transition-all"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          <button
            onClick={submit}
            disabled={busy || pin.length < 4}
            className="w-full mt-4 h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 text-white text-lg font-black transition-all shadow-lg"
          >
            {busy ? "..." : "Sign In"}
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 select-none">
          Adrenaline Healthy Food · POS Terminal
        </p>
      </div>
    </div>
  );
}
