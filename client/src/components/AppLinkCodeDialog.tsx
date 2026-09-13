/**
 * @file client/src/components/AppLinkCodeDialog.tsx
 * @description كود ربط تطبيق الجوال لمشترك — تصدره الأخصائية وترسله له على واتساب،
 *   فيكتبه في التطبيق ليُربط هاتفه باشتراكه ويستقبل إشعارات طلباته.
 *   الكود يظهر مرة واحدة (السيرفر يخزّن الهاش فقط)، صالح 72 ساعة، وكود جديد يلغي السابق.
 */
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/native";
import { getUserError } from "@/lib/userError";
import { useLanguage } from "@/lib/i18n";

type Props = { customer: any | null; onClose: () => void };

/** رقم قطري محلي (8 أرقام) → صيغة wa.me الدولية. */
function whatsappNumber(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 8 ? `974${digits}` : digits;
}

export function AppLinkCodeDialog({ customer, onClose }: Props) {
  const { dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const createCode = useMutation(api.mobileLink.createCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ code: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => { setIssued(null); setError(""); setCopied(false); onClose(); };

  const issue = async () => {
    if (!customer || busy) return;
    setBusy(true); setError(""); setCopied(false);
    try {
      const r: any = await createCode({ customerId: customer._id, sessionToken });
      setIssued({ code: r.code, expiresAt: r.expiresAt });
    } catch (e) {
      setError(getUserError(e));
    } finally {
      setBusy(false);
    }
  };

  const pretty = issued ? `${issued.code.slice(0, 4)}-${issued.code.slice(4)}` : "";
  const expiry = issued
    ? new Date(issued.expiresAt).toLocaleString(isRtl ? "ar-QA" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const message = issued
    ? `مرحباً ${customer?.fullName || ""} 👋\nكود ربط تطبيق أدرينالين: ${pretty}\nافتح التطبيق، ثم «حسابي»، ثم «استقبل إشعارات طلباتك»، واكتب الكود.\nالكود صالح 72 ساعة ولمرة واحدة.`
    : "";

  return (
    <Dialog open={!!customer} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle className={isRtl ? "text-right" : "text-left"}>
            {isRtl ? "كود ربط التطبيق" : "App link code"}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : "text-left"}>
            {isRtl
              ? `يربط هاتف ${customer?.fullName || "المشترك"} باشتراكه ليستقبل إشعارات الاعتماد والتوصيل. أرسله له على واتساب فقط.`
              : `Links ${customer?.fullName || "the subscriber"}'s phone to their subscription for approval and delivery notifications. Send it to them on WhatsApp only.`}
          </DialogDescription>
        </DialogHeader>

        {!issued ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isRtl ? "إصدار كود جديد يلغي أي كود سابق لم يُستخدم لهذا المشترك." : "Issuing a new code cancels any unused earlier code for this subscriber."}
            </p>
            {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
            <Button className="w-full min-h-11" disabled={busy} onClick={() => void issue()}>
              {busy ? (isRtl ? "جارٍ الإصدار…" : "Issuing…") : (isRtl ? "إصدار كود" : "Issue code")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-cyan-50 p-4 text-center">
              <div dir="ltr" className="font-mono text-3xl font-black tracking-widest text-[#0E2A4A]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pretty}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {isRtl ? `صالح حتى ${expiry} · لمرة واحدة · لن يظهر مرة أخرى` : `Valid until ${expiry} · single use · shown only once`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
                }}
              >
                {copied ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ الرسالة" : "Copy message")}
              </Button>
              <Button
                className="min-h-11 text-white"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                disabled={!customer?.phone}
                onClick={() => openExternal(`https://wa.me/${whatsappNumber(customer?.phone)}?text=${encodeURIComponent(message)}`)}
              >
                {isRtl ? "إرسال على واتساب" : "Send on WhatsApp"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
