import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Loader2, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function PayLaterResult() {
  const { language } = useLanguage(); const ar = language === "ar";
  const token = new URLSearchParams(location.search).get("token") || "";
  const refresh = useAction(api.payLater.refreshStatus);
  const [data, setData] = useState<any>(null); const [error, setError] = useState("");
  useEffect(() => { if (token) refresh({ checkoutToken: token }).then(setData).catch(e=>setError(e.message)); }, [token]);
  const status = data?.status; const Icon = status === "success" ? CheckCircle2 : status === "failed" ? XCircle : status === "pending" ? Clock3 : Loader2;
  return <PublicLayout><main dir={ar?"rtl":"ltr"} className="mx-auto max-w-lg px-4 py-20"><div className="rounded-3xl bg-white p-9 text-center shadow-xl"><Icon className={`mx-auto mb-4 h-16 w-16 ${!data?"animate-spin text-slate-400":status==="success"?"text-green-500":status==="failed"?"text-red-500":"text-amber-500"}`} /><h1 className="text-2xl font-black">{error ? (ar?"تعذر التحقق":"Verification failed") : !data ? (ar?"جارٍ التحقق من الدفع":"Verifying payment") : status==="success" ? (ar?"تم الدفع بنجاح":"Payment successful") : status==="failed" ? (ar?"لم تكتمل عملية الدفع":"Payment was not completed") : (ar?"عملية الدفع قيد الانتظار":"Payment pending")}</h1>{data&&<p className="mt-3 text-slate-600">{data.planName} — {data.amount} QAR<br/><span className="text-xs">{data.orderId} · {data.environment}</span></p>}{error&&<p className="mt-3 text-red-600">{error}</p>}<a href="/public/plans" className="mt-7 inline-block rounded-full bg-[#0E76AC] px-6 py-3 font-bold text-white">{ar?"العودة للباقات":"Back to plans"}</a></div></main></PublicLayout>;
}
