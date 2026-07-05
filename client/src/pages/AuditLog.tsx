/**
 * @file client/src/pages/AuditLog.tsx
 * @description عرض سجل النشاطات الحساسة - للأدمن فقط
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Shield, Activity, Clock, User as UserIcon } from "lucide-react";
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

function getActionColor(action: string) {
  for (const key of Object.keys(ACTION_COLOR)) {
    if (action.includes(key)) return ACTION_COLOR[key];
  }
  return "bg-slate-100 text-slate-800";
}

export default function AuditLog() {
  const logs = useQuery(api.auditLog.list, { limit: 200 }) || [];
  const stats = useQuery(api.auditLog.stats);

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
                <Activity className="h-4 w-4" /> الإجمالي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tabular-nums" style={{ color: "#0E76AC" }}>{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" /> آخر 24 ساعة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tabular-nums" style={{ color: "#3cc4f0" }}>{stats.last24h}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-400">أكثر الأحداث</CardTitle>
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

      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle>الأحداث الأخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    لا توجد سجلات
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
        </CardContent>
      </Card>
    </div>
  );
}
