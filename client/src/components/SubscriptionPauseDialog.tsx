/**
 * @file client/src/components/SubscriptionPauseDialog.tsx
 * @description تجميد / استئناف اشتراك مشترك (سفر). الأيام المجمّدة تُعوَّض في آخر الاشتراك.
 * @convex convex/subscriptionPause.ts
 */
import { useState } from "react";
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
}: {
  customerId: string | null;
  customerName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dir } = useLanguage();
  const isRtl = dir === "rtl";
  const { toast } = useToast();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [from, setFrom] = useState(today());
  const [expectedResume, setExpectedResume] = useState("");
  const [resumeOn, setResumeOn] = useState(today());
  const [busy, setBusy] = useState(false);

  const status = useQuery(
    api.subscriptionPause.status,
    customerId ? { id: customerId as any, sessionToken } : "skip"
  ) as any;

  const pause = useMutation(api.subscriptionPause.pause);
  const resume = useMutation(api.subscriptionPause.resume);

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
                    ? "أيام التوصيل (السبت→الأربعاء) المجمّدة تُضاف لآخر الاشتراك عند الاستئناف. الخميس والجمعة إجازة ولا تُحتسب."
                    : "Frozen delivery days (Sat→Wed) are added to the end of the subscription on resume. Thu & Fri are off days and are not counted."}
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
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
