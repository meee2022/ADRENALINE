import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import { Link } from "wouter";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Printer,
  RefreshCw,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";

const CODE_LABELS: Record<string, { ar: string; en: string }> = {
  DUPLICATE_PLAN: { ar: "خطة مكررة", en: "Duplicate plan" },
  MISSING_CUSTOMER: { ar: "مشترك غير موجود", en: "Missing customer" },
  INACTIVE_OR_OUTSIDE_SUBSCRIPTION: { ar: "اشتراك غير صالح", en: "Invalid subscription" },
  MEAL_COUNT_MISMATCH: { ar: "عدد الوجبات غير مطابق", en: "Meal count mismatch" },
  EMPTY_PLAN: { ar: "خطة فارغة", en: "Empty plan" },
  DUPLICATE_CUSTOM_TEMPLATE: { ar: "قالب مخصص مكرر", en: "Duplicate custom template" },
};

export default function DailyProductionAudit() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [date, setDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const sessionToken = useStore((state) => state.sessionToken) || undefined;
  const audit = useQuery(api.productionAudit.forDate, { date, sessionToken }) as any;
  const stickerData = useQuery(api.stickers.get, {
    date,
    deliveryTime: "ALL",
    lang: "en",
    sessionToken,
  }) as any;
  const stickerMismatch = stickerData?.audit as
    | { onlyStickers: string[]; onlyKitchen: string[] }
    | undefined;
  const mismatchCount =
    (stickerMismatch?.onlyKitchen?.length || 0) + (stickerMismatch?.onlyStickers?.length || 0);
  const loading = audit === undefined || stickerData === undefined;
  const canPrint = !loading && audit?.canPrint && mismatchCount === 0;
  const issues = audit?.issues || [];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-100">
      <DashboardHeader
        icon={<ClipboardCheck className="h-6 w-6" />}
        titleAr="تدقيق الإنتاج اليومي"
        titleEn="Daily Production Audit"
        subtitleAr="بوابة الأمان قبل طباعة كشف المطبخ والاستيكرات"
        subtitleEn="Safety gate before printing kitchen sheets and stickers"
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xs space-y-2">
            <label htmlFor="audit-date" className="text-sm font-bold text-slate-700">
              {isRtl ? "تاريخ الإنتاج" : "Production date"}
            </label>
            <Input
              id="audit-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 bg-white font-bold tabular-nums"
            />
          </div>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
            <RefreshCw className="h-4 w-4" />
            {isRtl ? "الفحص يتحدث تلقائيًا" : "Audit updates automatically"}
          </div>
        </section>

        <section
          className={`rounded-2xl border p-5 ${
            loading
              ? "border-slate-200 bg-slate-50"
              : canPrint
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
          }`}
          aria-live="polite"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  loading ? "bg-slate-200 text-slate-600" : canPrint ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : canPrint ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {loading
                    ? isRtl ? "جارٍ فحص اليوم…" : "Checking the day…"
                    : canPrint
                      ? isRtl ? "اليوم سليم وجاهز للطباعة" : "Day is clear and ready to print"
                      : isRtl ? "الطباعة متوقفة لحين المراجعة" : "Printing is blocked pending review"}
                </h2>
                {!loading && (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {isRtl
                      ? `${audit?.uniqueCustomers || 0} مشترك، ${audit?.operationalPlans || 0} خطة تشغيلية، ${audit?.blockerCount || 0} خطأ مانع`
                      : `${audit?.uniqueCustomers || 0} customers, ${audit?.operationalPlans || 0} operational plans, ${audit?.blockerCount || 0} blockers`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/kitchen?date=${date}`}>
                <Button variant="outline" className="h-10 gap-2 bg-white">
                  <UtensilsCrossed className="h-4 w-4" />
                  {isRtl ? "فتح المطبخ" : "Open kitchen"}
                </Button>
              </Link>
              <Link href={`/stickers?date=${date}`}>
                <Button disabled={!canPrint} className="h-10 gap-2">
                  <Printer className="h-4 w-4" />
                  {isRtl ? "فتح الطباعة" : "Open printing"}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {mismatchCount > 0 && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-black text-red-900">
              <AlertTriangle className="h-5 w-5" />
              {isRtl ? "عدم تطابق المطبخ والاستيكرات" : "Kitchen and sticker mismatch"}
            </h3>
            <div className="mt-3 space-y-2 text-sm font-semibold text-red-800">
              {!!stickerMismatch?.onlyKitchen?.length && (
                <p>
                  {isRtl ? "يُطبخ لهم بلا استيكر: " : "Cooked with no sticker: "}
                  <span className="font-black">{stickerMismatch.onlyKitchen.join(" · ")}</span>
                </p>
              )}
              {!!stickerMismatch?.onlyStickers?.length && (
                <p>
                  {isRtl ? "لهم استيكر بلا طبخ: " : "Sticker with no cooking: "}
                  <span className="font-black">{stickerMismatch.onlyStickers.join(" · ")}</span>
                </p>
              )}
            </div>
          </section>
        )}

        {!loading && issues.length === 0 && mismatchCount === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
            <p className="mt-3 font-bold text-slate-800">
              {isRtl ? "لا توجد أخطاء تشغيلية في هذا اليوم." : "No operational errors were found for this day."}
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-black text-slate-950">
                {isRtl ? "الأخطاء المطلوب تصحيحها" : "Issues to resolve"}
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {issues.map((issue: any, index: number) => {
                const label = CODE_LABELS[issue.code];
                return (
                  <div key={`${issue.code}-${issue.customerId || index}-${index}`} className="p-4 sm:px-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
                            {isRtl ? label?.ar || issue.code : label?.en || issue.code}
                          </span>
                          <span className="font-black text-slate-950">{issue.customerName}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {isRtl ? issue.messageAr : issue.messageEn}
                        </p>
                      </div>
                      {issue.expected !== undefined && (
                        <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700">
                            {isRtl ? "الباقة" : "Expected"}: {issue.expected}
                          </span>
                          <span className="rounded-lg bg-red-50 px-2.5 py-1.5 font-black text-red-700">
                            {isRtl ? "الخطة" : "Plan"}: {issue.actual}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
