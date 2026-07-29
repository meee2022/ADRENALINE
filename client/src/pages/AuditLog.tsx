/**
 * @file client/src/pages/AuditLog.tsx
 * @description عرض سجل النشاطات الحساسة - للأدمن فقط
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Shield, Activity, Clock, User as UserIcon, History, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-rose-100 text-rose-800",
  LOGIN: "bg-slate-100 text-slate-800",
};

/** الحقول المتتبَّعة في تعديلات المشتركين، بأسماء الطاقم. */
const FIELD_LABEL: Record<string, [string, string]> = {
  deliveryTime: ["وردية التوصيل", "Delivery shift"],
  startDate: ["تاريخ البداية", "Start date"],
  endDate: ["تاريخ النهاية", "End date"],
  mealsPerDay: ["عدد الوجبات/يوم", "Meals per day"],
  snacksPerDay: ["عدد السناك/يوم", "Snacks per day"],
  packageLabel: ["الباقة", "Package"],
  isActive: ["حالة الحساب", "Account active"],
  subscriptionRenewal: ["تجديد الاشتراك", "Renewal"],
};

/** القيمة الخام كما تُخزَّن → نصٌّ يقرؤه الطاقم (MORNING → صباحي). */
function prettyValue(field: string, v: string | null, isRtl: boolean): string {
  if (v === null || v === "") return isRtl ? "(فارغ)" : "(empty)";
  if (field === "deliveryTime") {
    if (v === "MORNING") return isRtl ? "صباحي" : "Morning";
    if (v === "EVENING") return isRtl ? "مسائي" : "Evening";
  }
  if (field === "isActive") return v === "true" ? (isRtl ? "نشط" : "Active") : (isRtl ? "موقوف" : "Stopped");
  return v;
}

function getActionColor(action: string) {
  for (const key of Object.keys(ACTION_COLOR)) {
    if (action.includes(key)) return ACTION_COLOR[key];
  }
  return "bg-slate-100 text-slate-800";
}

export default function AuditLog() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const logs = useQuery(api.auditLog.list, { limit: 200, sessionToken }) || [];
  const stats = useQuery(api.auditLog.stats, { sessionToken });
  /* تعديلات حقول المشتركين: سجلٌّ كان يُكتب ولا يُقرأ من أي شاشة. سؤاله الوحيد
     «من غيّر هذا ومتى؟» — وهو ما استغرق ساعةً من التحقيق حين حُوِّل خمسة
     مشتركين من صباحي لمسائي فتكرّرت خططهم. يعيش هنا مع بقية النشاط. */
  const changes = (useQuery(api.customers.fieldChanges, { limit: 300, sessionToken }) as any[] | undefined);
  const [tab, setTab] = useState<"EVENTS" | "FIELDS">("EVENTS");
  const [fieldFilter, setFieldFilter] = useState<string>("ALL");
  const fieldsPresent = useMemo(
    () => Array.from(new Set((changes || []).map((c: any) => c.field))),
    [changes],
  );
  const shownChanges = useMemo(
    () => (changes || []).filter((c: any) => fieldFilter === "ALL" || c.field === fieldFilter),
    [changes, fieldFilter],
  );

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<Shield className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="سجل النشاطات" titleEn="Audit Log"
        subtitleAr="تتبع كامل للأحداث الحساسة في النظام" subtitleEn="Full tracking of sensitive system events"
        kpis={stats ? [
          { value: stats.total, labelAr: "الإجمالي", labelEn: "Total" },
          { value: stats.last24h, labelAr: "آخر 24 ساعة", labelEn: "Last 24h" },
        ] : undefined}
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4" /> {t("الإجمالي", "Total")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tabular-nums" style={{ color: "#0E76AC" }}>{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" /> {t("آخر 24 ساعة", "Last 24h")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tabular-nums" style={{ color: "#3cc4f0" }}>{stats.last24h}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-400">{t("أكثر الأحداث", "Top events")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1">
                {Object.entries(stats.byAction || {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 3)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between">
                      <span className="text-muted-foreground">{action}</span>
                      <span className="font-bold">{String(count)}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        {([["EVENTS", t("الأحداث", "Events"), Activity], ["FIELDS", t("تعديلات المشتركين", "Subscriber edits"), History]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={cn("h-11 px-4 rounded-xl font-black text-sm flex items-center gap-2 transition-colors",
              tab === k ? "bg-[#0E76AC] text-white shadow-sm" : "bg-white border text-slate-600 hover:bg-slate-50")}>
            <Icon className="h-4 w-4" />{label}
            {k === "FIELDS" && (changes?.length ?? 0) > 0 && (
              <span className={cn("text-[10px] rounded-full px-1.5", tab === k ? "bg-white/20" : "bg-slate-100")}>
                {changes!.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "FIELDS" ? (
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle>{t("تعديلات حقول المشتركين", "Subscriber field edits")}</CardTitle>
            <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}
              className="h-10 rounded-lg border bg-white px-3 text-sm font-bold">
              <option value="ALL">{t("كل الحقول", "All fields")}</option>
              {fieldsPresent.map((f: string) => (
                <option key={f} value={f}>{FIELD_LABEL[f] ? (isRtl ? FIELD_LABEL[f][0] : FIELD_LABEL[f][1]) : f}</option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            {changes === undefined ? (
              <p className="text-center text-muted-foreground py-10">{t("جارٍ التحميل…", "Loading…")}</p>
            ) : shownChanges.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                {(changes.length === 0)
                  ? t("لا تعديلات مسجّلة بعد — السجل يبدأ من أول تغيير بعد تشغيل الميزة.",
                       "No edits recorded yet — the log starts at the first change after this went live.")
                  : t("لا نتائج", "No results")}
              </p>
            ) : (
              <div className="divide-y">
                {shownChanges.map((c: any) => {
                  const label = FIELD_LABEL[c.field] ? (isRtl ? FIELD_LABEL[c.field][0] : FIELD_LABEL[c.field][1]) : c.field;
                  return (
                    <div key={c.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-[#0E2A4A]">{c.customerName || "—"}</span>
                        <Badge className="bg-[#e8f8fd] text-[#0E76AC] text-[10px]">{label}</Badge>
                        <span className="ms-auto text-[11px] font-bold text-slate-400 tabular-nums shrink-0" dir="ltr">
                          {format(new Date(c.at), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] font-bold">
                        <span className="rounded-md px-2 py-0.5 bg-slate-100 text-slate-500 line-through">
                          {prettyValue(c.field, c.fromValue, isRtl)}
                        </span>
                        <ArrowRight className={cn("h-3.5 w-3.5 text-slate-400 shrink-0", isRtl && "rotate-180")} />
                        <span className="rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-700">
                          {prettyValue(c.field, c.toValue, isRtl)}
                        </span>
                        {c.byName && (
                          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 ms-1">
                            <UserIcon className="h-3 w-3" />{c.byName}
                          </span>
                        )}
                      </div>
                      {/* ما طبّقه النظام تلقائياً بسبب التعديل (مثل مزامنة خطط مستقبلية) */}
                      {c.effect && (
                        <p className="mt-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 inline-block">
                          ⚙ {c.effect}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle>{t("الأحداث الأخيرة", "Recent events")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("الوقت", "Time")}</TableHead>
                <TableHead>{t("المستخدم", "User")}</TableHead>
                <TableHead>{t("الدور", "Role")}</TableHead>
                <TableHead>{t("الإجراء", "Action")}</TableHead>
                <TableHead>{t("النوع", "Type")}</TableHead>
                <TableHead>{t("التفاصيل", "Details")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("لا توجد سجلات", "No records")}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-xs tabular-nums" dir="ltr">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-sm flex items-center gap-1">
                      <UserIcon className="h-3 w-3 text-slate-400" />
                      {log.actorName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.actorRole || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getActionColor(log.action)}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.entityType}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{log.details || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
