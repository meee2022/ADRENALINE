import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { Loader2, ShieldCheck } from "lucide-react";

export default function PayLaterCheckout() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const params = new URLSearchParams(location.search);
  const planId = params.get("plan") as any;
  const optionIndex = Math.max(0, Number(params.get("option") || 0));
  const plan = useQuery(api.publicPlans.getById, planId ? { id: planId } : "skip");
  const payLaterEnvironment = useQuery(api.payLater.publicEnvironment);
  const createCheckout = useAction(api.payLater.createCheckout);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const option: any = plan?.options?.[optionIndex];

  /* الكود يصل مع الرابط من صفحة الباقات، ويبقى قابلاً للكتابة هنا لمن سمعه
     شفهياً. والحساب المعروض استرشادي — المعتمَد ما يحسبه الخادم عند الدفع. */
  const [code, setCode] = useState(params.get("promo")?.trim().toUpperCase() || "");
  const listPrice = Number(option?.priceQAR) || 0;
  const check = useQuery(
    api.coupons.validate,
    code.trim() && listPrice
      ? { code: code.trim().toUpperCase(), orderTotal: listPrice, restaurantKey: "ADRENALINE", duration: plan?.duration }
      : "skip",
  ) as any;
  const discount = check?.valid ? Number(check.discount) : 0;
  const finalPrice = Math.max(0, listPrice - discount);
  const belowFloor = discount > 0 && finalPrice < 300;
  const waPhone = "97451144366";
  const contactMsg = () => {
    const t = [
      "السلام عليكم",
      `أرغب في الاشتراك في *${plan?.nameAr || plan?.nameEn || ""}*`,
      option ? `الخيار: ${option.mealsCount} وجبات + ${option.snacksCount} سناك` : "",
      `السعر: ${listPrice} ر.ق`,
      discount > 0 ? `كود الخصم: *${code.trim().toUpperCase()}* — الإجمالي ${finalPrice} ر.ق` : "",
      "طريقة الدفع: نقداً",
      "أرجو التواصل معي لإتمام الاشتراك. وشكرًا.",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(t)}`;
  };

  async function pay() {
    setError("");
    if (!name.trim() || !/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) {
      setError(ar ? "أدخل الاسم ورقم هاتف صحيح" : "Enter your name and a valid phone number"); return;
    }
    try {
      setBusy(true);
      const result = await createCheckout({
        planId, optionIndex, customerName: name, customerPhone: phone,
        customerEmail: email || undefined, returnOrigin: window.location.origin,
        couponCode: code.trim() ? code.trim().toUpperCase() : undefined,
      });
      window.location.assign(result.paymentLinkUrl);
    } catch (e: any) { setError(e?.message || (ar ? "تعذر بدء الدفع" : "Unable to start payment")); setBusy(false); }
  }

  return <PublicLayout><main dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-xl px-4 py-16">
    <section className="rounded-3xl border border-[#D9E6F1] bg-white p-6 shadow-xl md:p-9">
      <div className="mb-6 flex items-center gap-3"><div className="rounded-2xl bg-[#4b3ca0] p-3 text-white"><ShieldCheck /></div><div><h1 className="text-2xl font-black text-[#0E2A4A]">{ar ? "الدفع بواسطة PayLater" : "Pay with PayLater"}</h1><p className="text-sm text-slate-500">{ar ? "قسّم قيمة الباقة من خلال صفحة PayLater الآمنة" : "Split your plan payment in PayLater's secure checkout"}</p></div></div>
      {!plan ? <Loader2 className="mx-auto animate-spin" /> : !option ? <p>{ar ? "الباقة غير متاحة" : "Plan unavailable"}</p> : <>
        <div className="mb-4 rounded-2xl bg-[#F3F1FF] p-4">
          <div className="font-bold">{ar ? plan.nameAr : (plan.nameEn || plan.nameAr)}</div>
          {discount > 0 ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-bold text-slate-400 line-through">{listPrice}</span>
              <span className="text-2xl font-black text-[#4b3ca0]">{finalPrice} QAR</span>
              <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">
                {ar ? `وفّرت ${discount} ر.ق` : `saved ${discount} QAR`}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-2xl font-black text-[#4b3ca0]">{listPrice} QAR</div>
          )}
          <div className="text-sm text-slate-600">{option.mealsCount} {ar ? "وجبات" : "meals"} + {option.snacksCount} {ar ? "سناك" : "snacks"}</div>
        </div>

        <div className="mb-6">
          <Label>{ar ? "كود الخصم (اختياري)" : "Discount code (optional)"}</Label>
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={ar ? "مثال: ABF91" : "e.g. ABF91"} className="tracking-widest font-black" />
          {code.trim() && check && (
            check.valid
              ? <p className="mt-1.5 text-sm font-bold text-emerald-700">
                  {ar ? `تم تطبيق الخصم — ${check.discountType === "PERCENT" ? `${check.discountValue}%` : `${check.discountValue} ر.ق`}` : "Discount applied"}
                </p>
              : <p className="mt-1.5 text-sm font-bold text-red-600">{check.error}</p>
          )}
        </div>

        {belowFloor && (
          /* الدفع الإلكتروني له حدٌّ أدنى؛ فبدل رسالة خطأ عند آخر ضغطة، يُعرض
             الطريق الآخر قبلها — الاشتراك نقداً عبر الأخصائية. */
          <a href={contactMsg()} target="_blank" rel="noreferrer"
            className="mb-4 block rounded-2xl border-2 border-[#25D366] bg-[#25D366]/10 p-4 text-center">
            <span className="block text-sm font-black text-[#0E2A4A]">
              {ar ? `المبلغ بعد الخصم (${finalPrice} ر.ق) أقل من حدّ الدفع الإلكتروني`
                  : `Amount after discount (${finalPrice} QAR) is below the online payment minimum`}
            </span>
            <span className="mt-1 block text-sm font-black text-[#128C4A]">
              {ar ? "اضغط هنا للاشتراك نقداً عبر أخصائية التغذية" : "Tap to subscribe by cash via our nutritionist"}
            </span>
          </a>
        )}
        <div className="space-y-4"><div><Label>{ar ? "الاسم الكامل" : "Full name"}</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div><div><Label>{ar ? "رقم الهاتف" : "Phone"}</Label><Input dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+974" /></div><div><Label>{ar ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}</Label><Input dir="ltr" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div></div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button disabled={busy} onClick={pay} className="mt-6 h-12 w-full rounded-full bg-[#4b3ca0] font-bold hover:bg-[#392d82]">{busy && <Loader2 className="me-2 animate-spin" />}{ar ? "المتابعة إلى PayLater" : "Continue to PayLater"}</Button>
        <a href={contactMsg()} target="_blank" rel="noreferrer"
          className="mt-3 block w-full rounded-full border-2 border-[#25D366] py-3 text-center text-sm font-black text-[#128C4A] hover:bg-[#25D366]/10">
          {ar ? "أو اشترك نقداً عبر أخصائية التغذية" : "Or subscribe by cash via our nutritionist"}
        </a>
        {payLaterEnvironment?.environment === "sandbox" && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {ar ? "بيئة اختبار حاليًا — لا تستخدم بطاقة حقيقية" : "Sandbox mode — do not use a real card"}
          </p>
        )}
      </>}
    </section>
  </main></PublicLayout>;
}
