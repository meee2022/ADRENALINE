import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, Loader2, MessageCircle, RefreshCw, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const WHATSAPP_PHONE = "97451144366";

export default function PayLaterResult() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const token = new URLSearchParams(location.search).get("token") || "";
  const refresh = useAction(api.payLater.refreshStatus);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  const verify = useCallback(async () => {
    if (!token) {
      setError(ar ? "رابط التحقق غير مكتمل" : "The verification link is incomplete");
      setChecking(false);
      return;
    }
    setChecking(true);
    setError("");
    try {
      setData(await refresh({ checkoutToken: token }));
    } catch (e: any) {
      setError(e?.message || (ar ? "تعذر التحقق من الدفع" : "Unable to verify the payment"));
    } finally {
      setChecking(false);
    }
  }, [ar, refresh, token]);

  useEffect(() => { void verify(); }, [verify]);

  const status = data?.status;
  const success = status === "success";
  const failed = status === "failed";
  const pending = status === "pending";
  const Icon = success ? CheckCircle2 : failed ? XCircle : pending ? Clock3 : Loader2;
  const whatsappText = [
    ar ? "السلام عليكم، أتممت دفع اشتراكي عبر PayLater." : "Hello, I completed my subscription payment through PayLater.",
    `${ar ? "الباقة" : "Plan"}: ${data?.planName || ""}`,
    `${ar ? "المبلغ" : "Amount"}: ${data?.amount || ""} QAR`,
    `${ar ? "رقم العملية" : "Order reference"}: ${data?.orderId || ""}`,
    ar ? "أرغب في إكمال بيانات الاشتراك والتوصيل." : "I would like to complete my subscription and delivery details.",
  ].join("\n");
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(whatsappText)}`;

  return <PublicLayout><main dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-lg px-4 py-14 sm:py-20">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-9">
      <div className={`mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl ${success ? "bg-emerald-50" : failed || error ? "bg-red-50" : "bg-amber-50"}`}>
        <Icon className={`h-11 w-11 ${checking ? "animate-spin text-slate-400" : success ? "text-emerald-600" : failed || error ? "text-red-600" : "text-amber-600"}`} />
      </div>
      <h1 className="text-2xl font-black text-slate-950">
        {error ? (ar ? "تعذر التحقق من العملية" : "Verification failed")
          : checking ? (ar ? "جارٍ التحقق من الدفع" : "Verifying payment")
          : success ? (ar ? "تم الدفع بنجاح" : "Payment successful")
          : failed ? (ar ? "لم تكتمل عملية الدفع" : "Payment was not completed")
          : (ar ? "عملية الدفع قيد المراجعة" : "Payment is being reviewed")}
      </h1>

      {success && <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
        {ar ? "تم استلام دفعتك. أكمل بيانات العنوان والتوصيل مع أخصائية التغذية لتفعيل الاشتراك." : "Your payment was received. Complete your address and delivery details with our nutritionist to activate the subscription."}
      </p>}
      {(pending || failed) && !checking && <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
        {pending ? (ar ? "قد يستغرق تأكيد PayLater لحظات. اضغط إعادة التحقق بعد قليل." : "PayLater confirmation may take a moment. Check again shortly.")
          : (ar ? "لم يتم خصم أو تأكيد المبلغ. يمكنك العودة واختيار الباقة من جديد." : "The amount was not confirmed. You can return and select the plan again.")}
      </p>}
      {data && <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-start">
        <p className="font-black text-slate-900">{data.planName}</p>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span dir="ltr" className="font-black text-slate-900">{data.amount} QAR</span>
          <span dir="ltr" className="truncate text-xs">{data.orderId}</span>
        </div>
      </div>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-7 space-y-3">
        {success && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#128C4A] px-6 py-3 font-bold text-white hover:bg-[#0f783f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
          <MessageCircle className="h-5 w-5" />
          {ar ? "إكمال بيانات الاشتراك الآن" : "Complete subscription details"}
        </a>}
        {(pending || error) && <Button type="button" variant="outline" onClick={() => void verify()} disabled={checking} className="min-h-12 w-full rounded-full">
          {checking ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
          {ar ? "إعادة التحقق من الدفع" : "Check payment again"}
        </Button>}
        {!success && <a href="/public/plans" className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#0E76AC] px-6 py-3 font-bold text-white hover:bg-[#0b638f]">
          {ar ? "العودة إلى الباقات" : "Back to plans"}
        </a>}
      </div>
      <p className="mt-5 text-xs leading-5 text-slate-400">
        {ar ? "احتفظ برقم العملية حتى اكتمال تفعيل الاشتراك." : "Keep the order reference until your subscription is activated."}
      </p>
    </section>
  </main></PublicLayout>;
}
