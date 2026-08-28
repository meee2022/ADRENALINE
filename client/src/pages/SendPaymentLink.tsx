/**
 * @file client/src/pages/SendPaymentLink.tsx
 * @description إنشاء رابط دفع للمشترك وإرساله جاهزاً.
 *
 * لوحة PayLater تُنشئ روابط دفعٍ أيضاً، لكن ما يُدفع من هناك لا يعرفه هذا
 * التطبيق: لا يظهر في سجلّ المدفوعات، ولا يُشعر أحداً، ولا يُحتسب له كوبون.
 * فالرابط يُصنع من هنا ليبقى المال داخل النظام الذي يتابعه.
 */
import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { alertDialog } from "@/lib/dialogs";
import { Check, Copy, Link2, MessageCircle, Send } from "lucide-react";

/** الحدّان اللذان تفرضهما البوّابة على المبلغ — يُفحصان قبل الإنشاء لا بعده. */
const MIN_QAR = 300;
const MAX_QAR = 25000;

export default function SendPaymentLink() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);
  const sessionToken = useStore((s: any) => s.sessionToken) || undefined;

  const plans = (useQuery(api.publicPlans.list, {}) as any[] | undefined) || [];
  const coupons = (useQuery(api.coupons.list, { sessionToken }) as any[] | undefined) || [];
  const createLink = useAction(api.payLater.createStaffLink);

  const [planId, setPlanId] = useState("");
  const [optionIndex, setOptionIndex] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  /* السعر يبدأ من سعر الباقة ويقبل التعديل: المشتري قد يطلب إضافةً أو ترتيباً
     خاصاً، والباقةُ سعرٌ استرشادي لا حدّ. والنصّ فارغٌ يعني «اتبع الباقة». */
  const [priceInput, setPriceInput] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const sellable = useMemo(
    () => plans.filter((p) => p.isActive !== false && (p.options || []).length > 0),
    [plans],
  );
  const plan = sellable.find((p) => String(p._id) === planId);
  const option = plan?.options?.[optionIndex];
  const listPrice = Number(option?.priceQAR) || 0;
  const typed = Number(priceInput);
  const basePrice = priceInput.trim() && Number.isFinite(typed) && typed > 0 ? Math.round(typed) : listPrice;
  const edited = basePrice !== listPrice;

  const check = useQuery(
    api.coupons.validate,
    code.trim() && basePrice
      ? { code: code.trim().toUpperCase(), orderTotal: basePrice, restaurantKey: "ADRENALINE" }
      : "skip",
  ) as any;
  const discount = check?.valid ? Number(check.discount) : 0;
  const finalPrice = Math.max(0, basePrice - discount);
  const tooLow = basePrice > 0 && finalPrice < MIN_QAR;
  const tooHigh = finalPrice > MAX_QAR;

  const create = async () => {
    if (!plan || !option) return;
    if (!name.trim() || phone.replace(/\D/g, "").length < 6) {
      void alertDialog({ message: t("اكتب اسم المشترك ورقم هاتف صحيح", "Enter the customer name and a valid phone") });
      return;
    }
    setBusy(true);
    setLink("");
    try {
      const res: any = await createLink({
        planId: plan._id,
        optionIndex,
        amount: basePrice,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        couponCode: code.trim() ? code.trim().toUpperCase() : undefined,
        priceNote: note.trim() || undefined,
        sessionToken,
      });
      setLink(res.paymentLinkUrl);
    } catch (e: any) {
      void alertDialog({ message: e?.message || t("تعذّر إنشاء الرابط", "Unable to create the link") });
    } finally {
      setBusy(false);
    }
  };

  const waLink = () => {
    const digits = phone.replace(/\D/g, "");
    const to = digits.length === 8 ? `974${digits}` : digits;
    const lines = [
      `مرحباً ${name.trim()}`,
      `رابط دفع اشتراكك في *${plan ? (isRtl ? plan.nameAr : (plan.nameEn || plan.nameAr)) : ""}*`,
      option ? `الخيار: ${option.mealsCount} وجبات + ${option.snacksCount} سناك` : "",
      discount > 0 ? `السعر: ${basePrice} ر.ق — بعد الخصم *${finalPrice} ر.ق*` : `المبلغ: ${finalPrice} ر.ق`,
      "",
      link,
      "",
      "الرابط صالح لمدة 30 دقيقة.",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${to}?text=${encodeURIComponent(lines)}`;
  };

  const reset = () => { setLink(""); setCopied(false); };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<Link2 className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="إرسال رابط دفع" titleEn="Send Payment Link"
        subtitleAr="أنشئ رابط دفع للمشترك — يُسجَّل في التطبيق ويصلك إشعار عند الدفع"
        subtitleEn="Create a payment link — it is recorded here and notifies you when paid"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="space-y-2">
            <Label>{t("الباقة", "Plan")}</Label>
            <select
              value={planId}
              onChange={(e) => { setPlanId(e.target.value); setOptionIndex(0); setPriceInput(""); reset(); }}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"
            >
              <option value="">{t("اختر الباقة…", "Choose a plan…")}</option>
              {sellable.map((p) => (
                <option key={p._id} value={p._id}>
                  {isRtl ? p.nameAr : (p.nameEn || p.nameAr)}
                </option>
              ))}
            </select>
          </div>

          {plan && (
            <div className="space-y-2">
              <Label>{t("الخيار", "Option")}</Label>
              <div className="flex flex-wrap gap-2">
                {plan.options.map((o: any, i: number) => (
                  <button key={i} type="button"
                    onClick={() => { setOptionIndex(i); setPriceInput(""); reset(); }}
                    className={cn("rounded-xl border px-3 py-2 text-xs font-black",
                      optionIndex === i ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
                    {o.mealsCount} + {o.snacksCount}
                    <span className="block text-[11px] font-bold opacity-80">{o.priceQAR} {t("ر.ق", "QAR")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("اسم المشترك", "Customer name")}</Label>
              <Input value={name} onChange={(e) => { setName(e.target.value); reset(); }} />
            </div>
            <div className="space-y-2">
              <Label>{t("رقم الهاتف", "Phone")}</Label>
              <Input dir="ltr" value={phone} onChange={(e) => { setPhone(e.target.value); reset(); }} placeholder="33xxxxxx" />
            </div>
          </div>

          {plan && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("المبلغ (ر.ق)", "Amount (QAR)")}</Label>
                <Input dir="ltr" type="number" inputMode="numeric"
                  value={priceInput}
                  onChange={(e) => { setPriceInput(e.target.value); reset(); }}
                  placeholder={String(listPrice)}
                  className={cn("font-black", edited && "border-amber-400 bg-amber-50")} />
                <p className="text-[11px] font-bold text-slate-400">
                  {edited
                    ? t(`سعر الباقة ${listPrice} ر.ق — أنت غيّرته`, `Plan price is ${listPrice} — you changed it`)
                    : t("اتركه فارغاً ليتبع سعر الباقة", "Leave empty to use the plan price")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("سبب تغيير السعر", "Reason for the change")}</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder={t("مثال: إضافة وجبتين", "e.g. two extra meals")}
                  disabled={!edited} />
                {edited && !note.trim() && (
                  <p className="text-[11px] font-bold text-amber-600">
                    {t("يُستحسن كتابة السبب — يُحفظ مع الدفعة", "Worth noting — it is saved with the payment")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("كود خصم (اختياري)", "Discount code (optional)")}</Label>
            {coupons.filter((c) => c.isActive).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coupons.filter((c) => c.isActive).map((c) => (
                  <button key={c._id} type="button"
                    onClick={() => { setCode(String(c.code)); reset(); }}
                    className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-black",
                      code.toUpperCase() === String(c.code).toUpperCase()
                        ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
                    {c.code}
                  </button>
                ))}
              </div>
            )}
            <Input dir="ltr" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); reset(); }}
              placeholder="ABF91" className="font-black tracking-widest" />
            {code.trim() && check && !check.valid && (
              <p className="text-xs font-bold text-red-600">{check.error}</p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-black text-[#0F1516]">{t("الملخّص", "Summary")}</h3>

          {!plan ? (
            <p className="text-sm font-bold text-slate-400">{t("اختر باقة أولاً", "Choose a plan first")}</p>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-black text-[#0F1516]">{isRtl ? plan.nameAr : (plan.nameEn || plan.nameAr)}</p>
                <p className="text-xs font-bold text-slate-500">
                  {option?.mealsCount} {t("وجبات", "meals")} + {option?.snacksCount} {t("سناك", "snacks")}
                </p>
                {edited && (
                  <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-black text-amber-800">
                    {t(`سعر مخصّص — الباقة ${listPrice} ر.ق`, `Custom price — plan is ${listPrice}`)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  {discount > 0 && <span className="text-sm font-bold text-slate-400 line-through">{basePrice}</span>}
                  <span className="text-2xl font-black text-[#0E76AC]">{finalPrice}</span>
                  <span className="text-xs font-bold text-slate-500">{t("ر.ق", "QAR")}</span>
                  {discount > 0 && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">
                      {t("وفّر", "saves")} {discount}
                    </span>
                  )}
                </div>
              </div>

              {(tooLow || tooHigh) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-black leading-relaxed text-amber-800">
                  {tooLow
                    ? t(`المبلغ (${finalPrice} ر.ق) أقل من حدّ الدفع الإلكتروني (${MIN_QAR} ر.ق) — أتمّ الاشتراك نقداً.`,
                        `Amount (${finalPrice}) is below the gateway minimum (${MIN_QAR}) — complete it in cash.`)
                    : t(`المبلغ أعلى من حدّ البوّابة (${MAX_QAR} ر.ق).`, `Amount exceeds the gateway maximum (${MAX_QAR}).`)}
                </p>
              )}

              {!link ? (
                <Button onClick={() => void create()} disabled={busy || tooLow || tooHigh || !option || basePrice <= 0}
                  className="h-12 w-full rounded-xl bg-[#0E76AC] font-black hover:bg-[#0a668f]">
                  <Send className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                  {busy ? t("جارٍ الإنشاء…", "Creating…") : t("أنشئ رابط الدفع", "Create payment link")}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="mb-1 text-[11px] font-black text-emerald-800">{t("الرابط جاهز", "Link ready")}</p>
                    <p dir="ltr" className="break-all text-[11px] font-bold text-slate-600">{link}</p>
                  </div>
                  <a href={waLink()} target="_blank" rel="noreferrer"
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-[#25D366] font-black text-white hover:bg-[#1eb757]">
                    <MessageCircle className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                    {t("أرسل على واتساب", "Send on WhatsApp")}
                  </a>
                  <Button variant="outline" className="h-10 w-full font-black"
                    onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                    {copied ? <Check className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> : <Copy className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />}
                    {copied ? t("تم النسخ", "Copied") : t("انسخ الرابط", "Copy link")}
                  </Button>
                  <p className="text-[11px] font-bold leading-relaxed text-slate-400">
                    {t("الرابط صالح 30 دقيقة. والدفعة مسجّلة الآن في صفحة المدفوعات، ويصلك إشعار عند الدفع.",
                       "The link lasts 30 minutes. The attempt is already recorded and you will be notified when paid.")}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
