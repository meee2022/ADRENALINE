import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { Link } from "wouter";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardHeader";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowUpLeft,
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
  DELIVERY_SHIFT_MISMATCH: { ar: "وردية غير مطابقة", en: "Shift mismatch" },
  DUPLICATE_MEAL_SLOT: { ar: "خانة وجبة مكررة", en: "Duplicate meal slot" },
  REPEATED_MAIN_MEAL: { ar: "وجبة رئيسية مكررة", en: "Repeated main meal" },
  DUPLICATE_ROSTER_NAME: { ar: "اسم مكرر في الكشف", en: "Duplicate roster name" },
  DUPLICATE_BOX_STICKER_NUMBER: { ar: "ترقيم بوكس مكرر للمشترك", en: "Duplicate customer box number" },
  DUPLICATE_BOX_NUMBER: { ar: "رقم بوكس مكرر", en: "Duplicate box number" },
  DUPLICATE_RENDERED_BOX_STICKER: { ar: "استيكر بوكس مكرر", en: "Duplicate box sticker" },
  DUPLICATE_RENDERED_MEAL_STICKER: { ar: "استيكر وجبة مكرر", en: "Duplicate meal sticker" },
  SHARED_PHONE_NUMBER: { ar: "رقم هاتف مشترك", en: "Shared phone number" },
};

export default function DailyProductionAudit() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [date, setDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [repairing, setRepairing] = useState(false);
  const sessionToken = useStore((state) => state.sessionToken) || undefined;
  const ensureBoxNumbers = useMutation(api.stickers.ensureBoxNumbers);
  const repairDate = useMutation(api.productionAudit.repairDate);
  useEffect(() => {
    if (!date || !sessionToken) return;
    ensureBoxNumbers({ date, sessionToken }).catch(() => undefined);
  }, [date, sessionToken, ensureBoxNumbers]);
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
  const stickerIssues = useMemo(() => {
    const issues: any[] = [];
    const boxes = stickerData?.boxStickers || [];
    const meals = stickerData?.mealStickers || [];
    const duplicateGroups = (rows: any[], keyOf: (row: any) => string) =>
      Array.from(rows.reduce((map: Map<string, any[]>, row: any) => {
        const key = keyOf(row);
        if (!key) return map;
        map.set(key, [...(map.get(key) || []), row]);
        return map;
      }, new Map<string, any[]>()).values()).filter((rows: any[]) => rows.length > 1);

    for (const rows of duplicateGroups(boxes, (row) => String(row.customerId || ""))) {
      issues.push({
        code: "DUPLICATE_RENDERED_BOX_STICKER",
        severity: "BLOCKER",
        customerId: rows[0].customerId,
        customerName: rows[0].customerName || "Unknown",
        messageAr: `${rows.length} استيكرات بوكس ستُطبع لنفس المشترك`,
        messageEn: `${rows.length} box stickers would print for the same customer`,
      });
    }
    for (const rows of duplicateGroups(meals, (row) => String(row.stickerKey || ""))) {
      issues.push({
        code: "DUPLICATE_RENDERED_MEAL_STICKER",
        severity: "BLOCKER",
        customerId: rows[0].customerId,
        customerName: rows[0].customerName || "Unknown",
        messageAr: "نفس استيكر الوجبة سيتكرر في رزمة الطباعة",
        messageEn: "The same meal sticker would be repeated in the print batch",
      });
    }
    return issues;
  }, [stickerData]);
  const loading = audit === undefined || stickerData === undefined;
  const issues = [...(audit?.issues || []), ...stickerIssues];
  const clientBlockers = stickerIssues.filter((issue) => issue.severity === "BLOCKER").length;
  const blockerCount = (audit?.blockerCount || 0) + clientBlockers + mismatchCount;
  const canPrint = !loading && audit?.canPrint && clientBlockers === 0 && mismatchCount === 0;
  const runSafeRepair = async () => {
    if (!sessionToken || repairing) return;
    const confirmed = await confirmDialog({
      message: isRtl
        ? "سيتم إلغاء نسخ الخطط المؤكدة الزائدة، إيقاف الخطط غير الصالحة، وإعادة الخطط ذات العدد الخاطئ إلى «مسودة» لتصحيحها. لن تُحذف خطة ولن تتغير خطة تم تحضيرها. هل تريد المتابعة؟"
        : "Confirmed duplicate plans will be cancelled, invalid plans paused, and count mismatches returned to Draft. No plan will be deleted and prepared plans will not be changed. Continue?",
    });
    if (!confirmed) return;
    setRepairing(true);
    try {
      const result: any = await repairDate({ date, sessionToken });
      await ensureBoxNumbers({ date, sessionToken });
      void alertDialog({
        message: isRtl
          ? `تم الإصلاح الآمن: ${result.duplicatesCancelled} خطة زائدة أُلغيت، ${result.plansPaused} خطة أُوقفت، ${result.plansRestored || 0} خطة نشطة أُعيدت، ${result.plansReturnedToDraft} خطة عادت للمراجعة، ${result.shiftsUpdated} وردية صُححت.`
          : `Safe repair complete: ${result.duplicatesCancelled} duplicates cancelled, ${result.plansPaused} plans paused, ${result.plansRestored || 0} active plans restored, ${result.plansReturnedToDraft} returned to review, ${result.shiftsUpdated} shifts corrected.`,
      });
    } catch (error: any) {
      void alertDialog({ message: String(error?.message || error) });
    } finally {
      setRepairing(false);
    }
  };

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
                      ? `${audit?.uniqueCustomers || 0} مشترك، ${audit?.operationalPlans || 0} خطة تشغيلية، ${blockerCount} خطأ مانع`
                      : `${audit?.uniqueCustomers || 0} customers, ${audit?.operationalPlans || 0} operational plans, ${blockerCount} blockers`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!canPrint && !loading && (
                <Button
                  variant="destructive"
                  className="h-10 gap-2"
                  onClick={runSafeRepair}
                  disabled={repairing}
                >
                  <RefreshCw className={`h-4 w-4 ${repairing ? "animate-spin" : ""}`} />
                  {repairing
                    ? isRtl ? "جارٍ الإصلاح…" : "Repairing…"
                    : isRtl ? "إصلاح الأخطاء الآمنة" : "Repair safe issues"}
                </Button>
              )}
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

        {!loading && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5 sm:divide-y-0">
              {[
                { value: audit?.uniqueCustomers || 0, ar: "مشتركو الخطط", en: "Plan customers" },
                { value: audit?.plannedMealItems || 0, ar: "وجبات الخطط", en: "Planned meals" },
                { value: stickerData?.boxStickers?.length || 0, ar: "استيكرات البوكس", en: "Box stickers" },
                { value: stickerData?.mealStickers?.length || 0, ar: "استيكرات الوجبات", en: "Meal stickers" },
                { value: audit?.statusCounts?.PREPARED || 0, ar: "تم تحضيرهم", en: "Prepared" },
              ].map((item) => (
                <div key={item.en} className="px-4 py-4 text-center">
                  <div className="text-2xl font-black tabular-nums text-slate-950">{item.value}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">{isRtl ? item.ar : item.en}</div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                const warning = issue.severity === "WARNING";
                const customerQuery = issue.customerId
                  ? `/plans?customer=${encodeURIComponent(issue.customerId)}&date=${encodeURIComponent(date)}`
                  : "";
                const customerFileQuery = `/customers?search=${encodeURIComponent(issue.customerName || "")}`;
                const stickerQuery = `/stickers?date=${encodeURIComponent(date)}&search=${encodeURIComponent(issue.customerName || "")}`;
                const href = issue.code === "INACTIVE_OR_OUTSIDE_SUBSCRIPTION"
                  || issue.code === "DUPLICATE_ROSTER_NAME"
                  || issue.code === "SHARED_PHONE_NUMBER"
                  ? customerFileQuery
                  : issue.code === "DUPLICATE_RENDERED_BOX_STICKER"
                    || issue.code === "DUPLICATE_RENDERED_MEAL_STICKER"
                    || issue.code === "DUPLICATE_BOX_STICKER_NUMBER"
                    || issue.code === "DUPLICATE_BOX_NUMBER"
                    ? stickerQuery
                    : customerQuery || customerFileQuery;
                const destination = issue.code === "INACTIVE_OR_OUTSIDE_SUBSCRIPTION"
                  || issue.code === "DUPLICATE_ROSTER_NAME"
                  || issue.code === "SHARED_PHONE_NUMBER"
                  ? isRtl ? "فتح ملف المشترك" : "Open customer"
                  : issue.code === "DUPLICATE_RENDERED_BOX_STICKER"
                    || issue.code === "DUPLICATE_RENDERED_MEAL_STICKER"
                    || issue.code === "DUPLICATE_BOX_STICKER_NUMBER"
                    || issue.code === "DUPLICATE_BOX_NUMBER"
                    ? isRtl ? "فتح الاستيكرات" : "Open stickers"
                    : isRtl ? "فتح الخطة وتصحيحها" : "Open and fix plan";
                return (
                  <Link
                    href={href}
                    key={`${issue.code}-${issue.customerId || index}-${index}`}
                    className="block p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset sm:px-5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                            warning
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}>
                            {isRtl ? label?.ar || issue.code : label?.en || issue.code}
                          </span>
                          <span className="font-black text-slate-950">{issue.customerName}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {isRtl ? issue.messageAr : issue.messageEn}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                        {issue.expected !== undefined && (
                          <>
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700">
                            {isRtl ? "الباقة" : "Expected"}: {issue.expected}
                          </span>
                          <span className="rounded-lg bg-red-50 px-2.5 py-1.5 font-black text-red-700">
                            {isRtl ? "الخطة" : "Plan"}: {issue.actual}
                          </span>
                          </>
                        )}
                        <span className="flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 font-black text-cyan-800">
                          <span>{destination}</span>
                          <ArrowUpLeft className={`h-4 w-4 ${isRtl ? "" : "rotate-90"}`} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
