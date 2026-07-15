/**
 * @file client/src/pages/pos/PosOpenTickets.tsx
 * @description الفواتير المفتوحة (parked) — لسه ما اتدفعتش. للنسخة الأولى بسيط.
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { ClipboardList } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function PosOpenTickets() {
  const token = usePosStore((s) => s.token) as string;
  const rows = useQuery(api.pos.listOpenTickets, { token }) as any[] | undefined;
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (a: string, e: string) => (isAr ? a : e);

  return (
    <div className="h-full overflow-y-auto p-4 bg-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white grid place-items-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{t("فواتير مفتوحة", "Open Tickets")}</h1>
            <p className="text-slate-500 text-sm font-bold">{t("فواتير معلّقة لسه ما اتدفعتش", "Parked tickets — not yet paid")}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {!rows && <div role="status" aria-live="polite" className="p-8 text-center text-slate-500">{t("جاري التحميل…", "Loading…")}</div>}
          {rows && rows.length === 0 && (
            <div className="p-12 text-center">
              <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 font-bold">{t("مفيش فواتير معلّقة", "No parked tickets")}</p>
              <p className="text-slate-400 text-sm mt-1">{t("الميزة هتبقى متاحة كاملة قريباً", "Full feature coming soon")}</p>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {rows?.map((r: any) => (
              <div key={r.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-900">#{r.ticketNumber}
                    {r.customerName && <span className="text-slate-500 font-bold ms-2">· {r.customerName}</span>}
                  </div>
                  <div className="text-xs text-slate-500 font-bold">{new Date(r.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="text-xl font-black text-cyan-600">{r.total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
