/**
 * @file client/src/pages/PayLaterPayments.tsx
 * @description سجلّ مدفوعات PayLater — لم يكن في التطبيق ما يعرضها.
 */
import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { alertDialog } from "@/lib/dialogs";
import { CreditCard, MessageCircle, RefreshCw, Search } from "lucide-react";

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  success: { ar: "ناجحة", en: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { ar: "معلّقة", en: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { ar: "فاشلة", en: "Failed", cls: "bg-red-50 text-red-600 border-red-200" },
  created: { ar: "بدأت", en: "Created", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function PayLaterPayments() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);
  const sessionToken = useStore((s: any) => s.sessionToken) || undefined;

  const rows = (useQuery(api.payLater.listPayments, { sessionToken }) as any[] | undefined) || [];
  const refreshOne = useAction(api.payLater.refreshOne);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "success" | "pending" | "failed">("ALL");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (!s) return true;
      return [r.customerName, r.customerPhone, r.planName, r.orderId, r.couponCode]
        .some((x) => String(x || "").toLowerCase().includes(s));
    });
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "success");
    return {
      all: rows.length,
      paid: paid.length,
      pending: rows.filter((r) => r.status === "pending").length,
      revenue: paid.reduce((s, r) => s + Number(r.amount || 0), 0),
    };
  }, [rows]);

  const check = async (r: any) => {
    setBusy(r._id);
    try {
      const res: any = await refreshOne({ checkoutToken: r.checkoutToken, sessionToken });
      const label = STATUS[res.status]?.[isRtl ? "ar" : "en"] || res.status;
      void alertDialog({ message: t(`حالة الدفعة الآن: ${label}`, `Payment status: ${label}`) });
    } catch (e: any) {
      void alertDialog({ message: e?.message || t("تعذّر التحقق", "Unable to verify") });
    } finally {
      setBusy("");
    }
  };

  /** رسالة متابعة جاهزة — نصّها يتبع حالة الدفعة لا صيغةً واحدة للحالتين. */
  const wa = (r: any) => {
    const digits = String(r.customerPhone || "").replace(/\D/g, "");
    const phone = digits.length === 8 ? `974${digits}` : digits;
    const body = r.status === "success"
      ? "تم استلام الدفع. نحتاج عنوان التوصيل وتفاصيل خطتك لتفعيل الاشتراك."
      : "لاحظنا أن عملية الدفع لم تكتمل. هل نساعدك في إتمامها؟";
    const msg = `مرحباً ${r.customerName}\nبخصوص اشتراكك في *${r.planName}* بمبلغ ${r.amount} ر.ق.\n${body}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const when = (ms: number) => new Date(ms).toLocaleString(isRtl ? "ar-EG" : "en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<CreditCard className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="مدفوعات PayLater" titleEn="PayLater Payments"
        subtitleAr="كل محاولات الدفع وحالتها — والمعلّقة تُسأل عنها البوّابة مباشرةً"
        subtitleEn="Every checkout and its status — pending ones can be verified with the gateway"
        kpis={[
          { value: totals.all, labelAr: "إجمالي المحاولات", labelEn: "Attempts" },
          { value: totals.paid, labelAr: "مدفوعة", labelEn: "Paid" },
          { value: totals.pending, labelAr: "معلّقة", labelEn: "Pending" },
          { value: totals.revenue, labelAr: "المحصّل (ر.ق)", labelEn: "Collected (QAR)" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "success", "pending", "failed"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={cn("rounded-xl border px-3 py-2 text-xs font-black",
              filter === k ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
            {k === "ALL" ? t("الكل", "All") : STATUS[k][isRtl ? "ar" : "en"]}
          </button>
        ))}
        <div className="relative ms-auto min-w-[220px] flex-1">
          <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400", isRtl ? "right-3" : "left-3")} />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("ابحث بالاسم أو الرقم أو الكود", "Search name, phone or code")}
            className={isRtl ? "pr-9" : "pl-9"} />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
          {t("لا مدفوعات", "No payments")}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const st = STATUS[r.status] || STATUS.created;
            return (
              <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-lg border px-2 py-0.5 text-[11px] font-black", st.cls)}>
                    {st[isRtl ? "ar" : "en"]}
                  </span>
                  <span className="font-black text-[#0F1516]">{r.customerName}</span>
                  <span dir="ltr" className="text-xs font-bold text-slate-500">{r.customerPhone}</span>
                  {r.environment === "sandbox" && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">TEST</span>
                  )}
                  <span className="ms-auto text-[11px] font-bold text-slate-400">{when(r.createdAt)}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-slate-600">{r.planName}</span>
                  {r.couponDiscount ? (
                    <>
                      <span className="text-slate-400 line-through">{r.originalAmount}</span>
                      <span className="font-black text-[#0E76AC]">{r.amount} {t("ر.ق", "QAR")}</span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">
                        {r.couponCode} −{r.couponDiscount}
                      </span>
                    </>
                  ) : (
                    <span className="font-black text-[#0E76AC]">{r.amount} {t("ر.ق", "QAR")}</span>
                  )}
                </div>

                {/* رمزُ البوّابة يظهر حين لا يوافق الحالةَ المعروضة: الكود يعرف
                    ٢ و٣ فقط، وما عداهما يقع في «معلّقة» — فيُرى الأصل بدل الظنّ. */}
                {r.gatewayStatus && !["1", "2", "3"].includes(String(r.gatewayStatus)) && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                    <span className="text-[11px] font-black text-amber-800">
                      {t("ردّ البوّابة", "Gateway replied")}:{" "}
                      <span dir="ltr" className="font-mono">{r.gatewayStatus}</span>
                      {" — "}
                      {t("رمز غير معروف، أبلغ المطوّر ليُضاف", "unknown code — report it to be mapped")}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="truncate text-[11px] font-bold text-slate-400">{r.orderId}</span>
                  <div className="ms-auto flex gap-2">
                    <Button variant="outline" size="sm" disabled={busy === r._id}
                      onClick={() => void check(r)} className="h-9 text-xs font-black">
                      <RefreshCw className={cn("h-3.5 w-3.5", isRtl ? "ml-1.5" : "mr-1.5", busy === r._id && "animate-spin")} />
                      {t("تحقّق الآن", "Verify now")}
                    </Button>
                    <a href={wa(r)} target="_blank" rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-lg border-2 border-[#25D366] px-3 text-xs font-black text-[#128C4A] hover:bg-[#25D366]/10">
                      <MessageCircle className={cn("h-3.5 w-3.5", isRtl ? "ml-1.5" : "mr-1.5")} />
                      {t("واتساب", "WhatsApp")}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
