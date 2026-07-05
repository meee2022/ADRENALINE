/**
 * @file client/src/components/DashboardHeader.tsx
 * @description هيدر موحّد لصفحات لوحة التحكم — هوية أدرينالين (hero متدرّج + أيقونة + KPIs).
 * يُعيد استخدامه في كل صفحات لوحة التحكم لتوحيد الشكل.
 */
import React from "react";
import { useLanguage } from "@/lib/i18n";

export type DashboardKpi = {
  value: React.ReactNode;
  labelAr: string;
  labelEn: string;
  /** لون اختياري لقيمة الـKPI (افتراضي أبيض) */
  color?: string;
};

type Props = {
  icon?: React.ReactNode;
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  /** أزرار/إجراءات على يسار الهيدر */
  actions?: React.ReactNode;
  /** بطاقات أرقام زجاجية أسفل العنوان */
  kpis?: DashboardKpi[];
};

/**
 * هيدر hero موحّد. مثال:
 * <DashboardHeader icon={<Users/>} titleAr="المشتركين" titleEn="Subscribers"
 *   subtitleAr="إدارة العملاء" subtitleEn="Manage customers"
 *   actions={<Button>إضافة</Button>} kpis={[{value: 12, labelAr:"نشط", labelEn:"Active"}]} />
 */
export function DashboardHeader({ icon, titleAr, titleEn, subtitleAr, subtitleEn, actions, kpis }: Props) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="relative overflow-hidden rounded-3xl p-5 sm:p-7"
      style={{ background: "linear-gradient(135deg,#0E2A4A 0%,#0E76AC 55%,#3AC7F4 100%)" }}
    >
      {/* Corner glow */}
      <div
        className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle,#ffffff66,transparent 70%)" }}
      />

      <div className="relative flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {icon && (
            <div
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md shrink-0 text-white"
              style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)" }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white truncate">
              {isRtl ? titleAr : titleEn}
            </h2>
            {(subtitleAr || subtitleEn) && (
              <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                {isRtl ? subtitleAr : subtitleEn}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {kpis && kpis.length > 0 && (
        <div
          className="relative grid gap-3 mt-5"
          style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0, 1fr))`, maxWidth: kpis.length <= 2 ? 480 : undefined }}
        >
          {kpis.map((k, i) => (
            <div
              key={i}
              className="rounded-2xl px-4 py-3 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)" }}
            >
              <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none" style={{ color: k.color || "#fff" }}>
                {k.value}
              </div>
              <div className="text-[11px] sm:text-xs text-white/70 font-semibold mt-1 truncate">
                {isRtl ? k.labelAr : k.labelEn}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardHeader;
