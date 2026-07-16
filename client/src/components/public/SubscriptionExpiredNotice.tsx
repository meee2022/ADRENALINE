/**
 * @file client/src/components/public/SubscriptionExpiredNotice.tsx
 * @description إشعار انتهاء الاشتراك — يظهر في المنيو اليدوي والخطة الذكية.
 *
 *   مشترك انتهى اشتراكه كان النظام يعامله كساري ويبني له خطة لأيام لن
 *   تُوصَّل إليه. الآن يتوقّف البناء ويُوجَّه للتجديد عبر أخصائي التغذية.
 *
 *   مكوّن واحد للصفحتين: نصٌّ واحد ومسار تواصل واحد — لو تكرّر لاختلفا.
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { CalendarX2, MessageCircle, Phone } from "lucide-react";

type Props = {
  /** اسم المشترك — يُعرض إن توفّر ليعرف أن الرسالة تخصّه هو. */
  name?: string;
  /** تاريخ انتهاء الاشتراك (yyyy-MM-dd). */
  endDate: string;
  /** منذ كم يوم انتهى. */
  daysAgo: number;
  isRtl: boolean;
};

export function SubscriptionExpiredNotice({ name, endDate, daysAgo, isRtl }: Props) {
  const settings = useQuery(api.restaurantSettings.get) as any;
  const phone = String(settings?.phone || "97451144366").replace(/\D/g, "");
  const t = (ar: string, en: string) => (isRtl ? ar : en);

  const msg = t(
    `مرحباً، أرغب في تجديد اشتراكي${name ? ` (${name})` : ""}. انتهى اشتراكي بتاريخ ${endDate}.`,
    `Hello, I'd like to renew my subscription${name ? ` (${name})` : ""}. It ended on ${endDate}.`,
  );

  const sinceText =
    daysAgo === 0 ? t("ينتهي اليوم", "ends today")
      : daysAgo === 1 ? t("منذ يوم واحد", "1 day ago")
        : daysAgo === 2 ? t("منذ يومين", "2 days ago")
          : daysAgo <= 10 ? t(`منذ ${daysAgo} أيام`, `${daysAgo} days ago`)
            : t(`منذ ${daysAgo} يوماً`, `${daysAgo} days ago`);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        borderRadius: 14, border: "1px solid #FCD34D", background: "#FFFBEB",
        padding: "18px 20px", marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <CalendarX2 style={{ width: 22, height: 22, color: "#B45309", flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#92400E", marginBottom: 4 }}>
            {name
              ? t(`انتهى اشتراكك يا ${name}`, `${name}, your subscription has ended`)
              : t("انتهى اشتراكك", "Your subscription has ended")}
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#78350F", fontWeight: 600, lineHeight: 1.9 }}>
            {t(
              `انتهت مدة اشتراكك بتاريخ ${endDate} (${sinceText})، ولا يمكن إعداد خطة وجبات جديدة قبل التجديد. يُرجى التواصل مع أخصائي التغذية لتجديد اشتراكك واختيار الباقة المناسبة.`,
              `Your subscription ended on ${endDate} (${sinceText}), and no new meal plan can be prepared before renewal. Please contact the nutritionist to renew and choose a suitable package.`,
            )}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={buildWhatsAppLink(phone, msg)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
                background: "#16a34a", color: "#fff", borderRadius: 10,
                padding: "9px 16px", fontSize: 13, fontWeight: 900,
              }}
            >
              <MessageCircle style={{ width: 15, height: 15 }} />
              {t("تواصل عبر واتساب للتجديد", "Renew via WhatsApp")}
            </a>
            <a
              href={`tel:+${phone}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
                background: "#fff", color: "#92400E", border: "1px solid #FCD34D",
                borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 900,
              }}
            >
              <Phone style={{ width: 15, height: 15 }} />
              {t("اتصال", "Call")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
