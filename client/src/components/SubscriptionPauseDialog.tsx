/**
 * @file client/src/components/SubscriptionPauseDialog.tsx
 * @description تجميد / استئناف اشتراك مشترك (سفر). الأيام المجمّدة تُعوَّض في آخر الاشتراك.
 * @convex convex/subscriptionPause.ts
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PauseCircle, PlayCircle, CalendarClock } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

export function SubscriptionPauseDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
  initialSection = "pause",
}: {
  customerId: string | null;
  customerName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "skip" يفتح النافذة مباشرة على قسم تخطّي الأيام (زر الكارت السريع). */
  initialSection?: "pause" | "skip";
}) {
  const { dir } = useLanguage();
  const isRtl = dir === "rtl";
  const { toast } = useToast();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [from, setFrom] = useState(today());
  const [expectedResume, setExpectedResume] = useState("");
  const [resumeOn, setResumeOn] = useState(today());
  const [busy, setBusy] = useState(false);
  // ✅ أيام محددة يختارها الموظف لتخطّيها (سفر نصف أسبوع)
  const [skipPick, setSkipPick] = useState<Record<string, boolean>>({});

  // عند الفتح من زر "تخطّي أيام" على الكارت: مرّر تلقائياً لقسم التخطّي وأبرِزه.
  const skipSectionRef = useRef<HTMLDivElement | null>(null);
  const [highlightSkip, setHighlightSkip] = useState(false);
  useEffect(() => {
    if (open && initialSection === "skip") {
      const t = setTimeout(() => {
        skipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightSkip(true);
        setTimeout(() => setHighlightSkip(false), 1600);
      }, 120);
      return () => clearTimeout(t);
    }
    setHighlightSkip(false);
  }, [open, initialSection]);

  const status = useQuery(
    api.subscriptionPause.status,
    customerId ? { id: customerId as any, sessionToken } : "skip"
  ) as any;

  const pause = useMutation(api.subscriptionPause.pause);
  const resume = useMutation(api.subscriptionPause.resume);
  const setSkippedDays = useMutation(api.subscriptionPause.setSkippedDays);

  /** أيام التوصيل الـ12 القادمة (يتخطّى الجمعة) لعرضها كخيارات تخطّي. */
  const upcomingDeliveryDays = (() => {
    const out: { iso: string; label: string }[] = [];
    const AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date();
    for (let i = 0; out.length < 12 && i < 20; i++) {
      if (d.getDay() !== 5) { // الجمعة وحدها بلا توصيل
        const iso = d.toISOString().slice(0, 10);
        out.push({ iso, label: `${(isRtl ? AR : EN)[d.getDay()]} ${iso.slice(5)}` });
      }
      d.setDate(d.getDate() + 1);
    }
    return out;
  })();

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r?.success) {
        toast({ title: r?.error || (isRtl ? "فشل التنفيذ" : "Failed"), variant: "destructive" });
        return;
      }
      if (r.frozenDeliveryDays !== undefined) {
        toast({
          title: isRtl ? "تم استئناف الاشتراك" : "Subscription resumed",
          description: isRtl
            ? `عُوِّض ${r.frozenDeliveryDays} يوم توصيل — النهاية الجديدة ${r.newEndDate}`
            : `${r.frozenDeliveryDays} delivery day(s) credited — new end date ${r.newEndDate}`,
        });
      } else {
        toast({
          title: isRtl ? "تم تجميد الاشتراك" : "Subscription paused",
          description: isRtl
            ? `حُذفت ${r.removedPlans} خطة مطبخ مستقبلية`
            : `${r.removedPlans} future kitchen plan(s) removed`,
        });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const isPaused = Boolean(status?.isPaused);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {isRtl ? "تجميد الاشتراك" : "Pause Subscription"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm font-bold">{customerName}</p>

        {status === undefined ? (
          <p className="text-sm text-muted-foreground">{isRtl ? "جاري التحميل…" : "Loading…"}</p>
        ) : (
          <>
            {/* الحالة الحالية */}
            <div className="grid grid-cols-2 gap-2 text-center my-2">
              <div className="rounded-xl border p-3">
                <div className="text-2xl font-black">{status?.remainingDeliveryDays ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">
                  {isRtl ? "يوم توصيل متبقّي" : "delivery days left"}
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-sm font-bold">{status?.endDate}</div>
                <div className="text-[11px] text-muted-foreground">
                  {isRtl ? "نهاية الاشتراك" : "ends on"}
                </div>
              </div>
            </div>

            {status?.totalFrozenDays > 0 && (
              <p className="text-xs text-muted-foreground">
                {isRtl
                  ? `جُمّد سابقاً ${status.pauseCount} مرة — إجمالي ${status.totalFrozenDays} يوم توصيل عُوِّضت.`
                  : `Paused ${status.pauseCount} time(s) — ${status.totalFrozenDays} delivery day(s) credited.`}
              </p>
            )}

            {isPaused ? (
              <div className="space-y-3 mt-2">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  {isRtl
                    ? `الاشتراك مجمّد منذ ${status.pausedFrom}`
                    : `Paused since ${status.pausedFrom}`}
                  {status.pauseExpectedResume && (
                    <div className="text-xs mt-1 opacity-80">
                      {isRtl
                        ? `الرجوع المتوقّع: ${status.pauseExpectedResume}`
                        : `Expected back: ${status.pauseExpectedResume}`}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{isRtl ? "أول يوم يستلم فيه وجبات" : "First day back"}</Label>
                  <Input type="date" value={resumeOn} onChange={(e) => setResumeOn(e.target.value)} />
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      resume({ id: customerId as any, on: resumeOn, sessionToken })
                    )
                  }
                >
                  <PlayCircle className="h-4 w-4" />
                  {isRtl ? "استئناف الاشتراك" : "Resume subscription"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label>{isRtl ? "أول يوم تجميد" : "Pause from"}</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {isRtl ? "تاريخ الرجوع المتوقّع (اختياري)" : "Expected return (optional)"}
                  </Label>
                  <Input
                    type="date"
                    value={expectedResume}
                    onChange={(e) => setExpectedResume(e.target.value)}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? "أيام التوصيل (السبت→الخميس) المجمّدة تُضاف لآخر الاشتراك عند الاستئناف. الجمعة وحدها بلا توصيل ولا تُحتسب."
                    : "Frozen delivery days (Sat→Thu) are added to the end of the subscription on resume. Only Friday has no delivery and is not counted."}
                </p>

                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      pause({
                        id: customerId as any,
                        from,
                        expectedResume: expectedResume || undefined,
                        sessionToken,
                      })
                    )
                  }
                >
                  <PauseCircle className="h-4 w-4" />
                  {isRtl ? "تجميد الاشتراك" : "Pause subscription"}
                </Button>

                {/* ───── تخطّي أيام محددة (سفر نصف أسبوع) ───── */}
                <div
                  ref={skipSectionRef}
                  className={
                    "pt-3 mt-1 border-t transition-all rounded-lg " +
                    (highlightSkip ? "ring-2 ring-amber-400 bg-amber-50/60 -mx-1 px-1" : "")
                  }
                >
                  <p className="text-sm font-bold mb-1">
                    {isRtl ? "أو تخطّي أيام محددة فقط" : "Or skip specific days only"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {isRtl
                      ? "للحالات مثل: يستلم الأحد والاثنين ثم مسافر باقي الأسبوع. تُحذف وجبات الأيام المختارة من المطبخ."
                      : "e.g. receives Sun & Mon then travels the rest of the week. Selected days' meals are removed from the kitchen."}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {upcomingDeliveryDays.map((d) => {
                      const on = Boolean(skipPick[d.iso]);
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSkipPick((p) => ({ ...p, [d.iso]: !p[d.iso] }))}
                          className={
                            "px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all " +
                            (on
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white text-gray-700 border-gray-200 hover:border-amber-300")
                          }
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 mt-2 border-amber-400 text-amber-700"
                    disabled={busy || !Object.values(skipPick).some(Boolean)}
                    onClick={async () => {
                      const dates = Object.keys(skipPick).filter((k) => skipPick[k]);
                      setBusy(true);
                      try {
                        const r: any = await setSkippedDays({
                          id: customerId as any,
                          dates,
                          mode: "skip",
                          sessionToken,
                        });
                        if (r?.success) {
                          toast({
                            title: isRtl ? "تم تخطّي الأيام المحددة" : "Selected days skipped",
                            description: isRtl
                              ? `${dates.length} يوم — حُذفت ${r.removedPlans} خطة مطبخ · عُوّض العميل ${r.creditedDeliveryDays} يوم توصيل (النهاية: ${r.newEndDate})`
                              : `${dates.length} day(s) — ${r.removedPlans} kitchen plan(s) removed · credited ${r.creditedDeliveryDays} delivery day(s) (ends: ${r.newEndDate})`,
                          });
                          setSkipPick({});
                          onOpenChange(false);
                        } else {
                          toast({ title: r?.error || (isRtl ? "فشل" : "Failed"), variant: "destructive" });
                        }
                      } catch (e: any) {
                        toast({ title: String(e?.message || e), variant: "destructive" });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {isRtl
                      ? `تخطّي الأيام المختارة (${Object.values(skipPick).filter(Boolean).length})`
                      : `Skip selected days (${Object.values(skipPick).filter(Boolean).length})`}
                  </Button>

                  {/* ✅ الأيام المتخطّاة حالياً — مع زر إلغاء (لو العميل غيّر رأيه) */}
                  {Array.isArray(status?.skippedDates) && status.skippedDates.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-bold mb-1 text-amber-700">
                        {isRtl ? "أيام متخطّاة حالياً" : "Currently skipped days"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        {isRtl
                          ? "لو العميل غيّر رأيه، اضغط ✕ لإرجاع اليوم (يُسحب تعويضه من نهاية الاشتراك)."
                          : "If the customer changed their mind, tap ✕ to restore the day (its credit is withdrawn)."}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {status.skippedDates.map((iso: string) => (
                          <button
                            key={iso}
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const r: any = await setSkippedDays({
                                  id: customerId as any,
                                  dates: [iso],
                                  mode: "unskip",
                                  sessionToken,
                                });
                                if (r?.success) {
                                  toast({
                                    title: isRtl ? "تمّ إرجاع اليوم" : "Day restored",
                                    description: isRtl
                                      ? `سُحب ${r.withdrawnDeliveryDays} يوم توصيل (النهاية: ${r.newEndDate})`
                                      : `withdrew ${r.withdrawnDeliveryDays} delivery day(s) (ends: ${r.newEndDate})`,
                                  });
                                } else {
                                  toast({ title: r?.error || (isRtl ? "فشل" : "Failed"), variant: "destructive" });
                                }
                              } catch (e: any) {
                                toast({ title: String(e?.message || e), variant: "destructive" });
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                          >
                            {iso.slice(5)}
                            <span className="text-amber-600">✕</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
