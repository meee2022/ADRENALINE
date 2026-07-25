/**
 * @file client/src/pages/ClientErrors.tsx
 * @description سجل انهيارات الواجهة — الرسالة الحقيقية والصفحة والجهاز لكل انهيار،
 *              بدل الرقم المرجعي الذي كان بلا سجل يقابله.
 * @convex convex/clientErrors.ts
 *
 * ⚡ الأداء: الاستعلام لا يعمل إلا وهذه الصفحة مفتوحة (lazy route)، بحدّ 50 سجلاً
 *    وبلا polling — فلا يضيف أي حِمل على باقي التطبيق.
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Smartphone, Monitor } from "lucide-react";

/** "Mozilla/5.0 (iPhone; …) Safari/…" → "iPhone · Safari" */
function deviceOf(ua?: string) {
  const u = String(ua || "");
  const os = /iPhone/i.test(u) ? "iPhone"
    : /iPad/i.test(u) ? "iPad"
    : /Android/i.test(u) ? "Android"
    : /Macintosh/i.test(u) ? "Mac"
    : /Windows/i.test(u) ? "Windows"
    : "";
  const br = /Edg\//i.test(u) ? "Edge"
    : /Chrome\//i.test(u) ? "Chrome"
    : /Firefox\//i.test(u) ? "Firefox"
    : /Safari\//i.test(u) ? "Safari"
    : "";
  return [os, br].filter(Boolean).join(" · ") || (u ? u.slice(0, 40) : "—");
}

const isMobileUA = (ua?: string) => /iPhone|iPad|Android/i.test(String(ua || ""));

export default function ClientErrors() {
  const { language, dir } = useLanguage();
  const isRtl = dir === "rtl" || language === "ar";
  const sessionToken = useStore((s) => s.sessionToken);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useQuery(api.clientErrors.recent, { limit: 50, sessionToken: sessionToken || undefined }) as any[] | undefined;

  // تجميع بالرسالة: انهيار واحد متكرر 30 مرة سطر واحد بعدّاد، لا 30 سطراً
  const groups = useMemo(() => {
    const map = new Map<string, { message: string; count: number; last: number; paths: Set<string>; users: Set<string>; rows: any[] }>();
    (rows || []).forEach((r: any) => {
      const key = String(r.message || "").slice(0, 200);
      if (!map.has(key)) map.set(key, { message: r.message, count: 0, last: 0, paths: new Set(), users: new Set(), rows: [] });
      const g = map.get(key)!;
      g.count += 1;
      g.last = Math.max(g.last, Number(r.at) || 0);
      if (r.path) g.paths.add(String(r.path));
      if (r.userName) g.users.add(String(r.userName));
      g.rows.push(r);
    });
    return [...map.values()].sort((a, b) => b.last - a.last);
  }, [rows]);

  const when = (ms: number) =>
    new Date(ms).toLocaleString(isRtl ? "ar-QA" : "en-GB", {
      day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">
            {isRtl ? "سجل أخطاء الواجهة" : "Client Error Log"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isRtl
              ? "آخر 50 انهيار كما حدث فعلاً — الرسالة والصفحة والجهاز."
              : "The last 50 crashes as they actually happened — message, page and device."}
          </p>
        </div>
      </div>

      {rows === undefined && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {isRtl ? "جاري التحميل…" : "Loading…"}
        </div>
      )}

      {rows && groups.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-10 text-center">
          <p className="text-base font-black text-emerald-700">
            {isRtl ? "لا توجد أخطاء مسجّلة" : "No errors logged"}
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {isRtl ? "أي انهيار جديد سيظهر هنا تلقائياً." : "Any new crash will appear here automatically."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {groups.map((g, i) => {
          const id = `${i}`;
          const open = openId === id;
          const mobile = g.rows.some((r: any) => isMobileUA(r.userAgent));
          return (
            <div key={id} className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : id)}
                className={cn("w-full text-start p-3 sm:p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors",
                  isRtl ? "text-right" : "text-left")}
              >
                <div className="mt-0.5 shrink-0">
                  {mobile
                    ? <Smartphone className="h-4 w-4 text-slate-400" />
                    : <Monitor className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-800 break-words">{g.message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-mono">{[...g.paths].join(" · ") || "—"}</span>
                    {g.users.size > 0 && <span className="font-bold text-slate-600">{[...g.users].join("، ")}</span>}
                    <span>{when(g.last)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.count > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-black">
                      ×{g.count}
                    </span>
                  )}
                  <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
                </div>
              </button>

              {open && (
                <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                  {g.rows.slice(0, 5).map((r: any) => (
                    <div key={String(r._id)} className="rounded-lg bg-white border border-slate-200 p-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 mb-2">
                        <span className="font-mono font-bold text-slate-700">{r.refCode}</span>
                        <span>{when(Number(r.at))}</span>
                        <span>{deviceOf(r.userAgent)}</span>
                        {r.userName && <span className="font-bold">{r.userName}</span>}
                      </div>
                      {r.stack && (
                        <pre dir="ltr" className="text-[10px] leading-relaxed text-slate-600 bg-slate-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-56">
                          {r.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                  {g.rows.length > 5 && (
                    <p className="text-[11px] text-slate-500">
                      {isRtl
                        ? `و${g.rows.length - 5} تكرار آخر بنفس الرسالة`
                        : `and ${g.rows.length - 5} more with the same message`}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
