/**
 * @file client/src/pages/Reports.tsx
 * @description مركز التقارير - تقارير قابلة للتصدير والطباعة
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  FileText,
  Download,
  Printer,
  DollarSign,
  ChefHat,
  Truck,
  Package,
  Users as UsersIcon,
} from "lucide-react";

type ReportType = "sales" | "kitchen" | "delivery" | "customers" | "inventory";

const REPORTS: Array<{ key: ReportType; titleAr: string; icon: any; color: string }> = [
  { key: "sales", titleAr: "تقرير المبيعات", icon: DollarSign, color: "#10b981" },
  { key: "kitchen", titleAr: "تقرير المطبخ", icon: ChefHat, color: "#f59e0b" },
  { key: "delivery", titleAr: "تقرير التوصيل", icon: Truck, color: "#8b5cf6" },
  { key: "customers", titleAr: "تقرير العملاء", icon: UsersIcon, color: "#3CC4F0" },
  { key: "inventory", titleAr: "تقرير المخزون", icon: Package, color: "#ef4444" },
];

function toCsv(rows: any[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const today = new Date().toISOString().split("T")[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(lastMonth);
  const [toDate, setToDate] = useState(today);

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<FileText className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="مركز التقارير" titleEn="Reports Center"
        subtitleAr="تقارير شاملة قابلة للتصدير والطباعة" subtitleEn="Comprehensive exportable & printable reports"
      />

      {/* Filter bar */}
      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const isActive = activeReport === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                isActive ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-gray-200 bg-white hover:bg-[#f7fbfe]"
              }`}
            >
              <Icon className="h-6 w-6" style={{ color: r.color }} />
              <span className="text-xs font-bold">{r.titleAr}</span>
            </button>
          );
        })}
      </div>

      {/* Selected report */}
      {activeReport === "sales" && <SalesReport from={fromDate} to={toDate} />}
      {activeReport === "kitchen" && <KitchenReport from={fromDate} to={toDate} />}
      {activeReport === "delivery" && <DeliveryReport from={fromDate} to={toDate} />}
      {activeReport === "customers" && <CustomersReport />}
      {activeReport === "inventory" && <InventoryReport />}
    </div>
  );
}

function ReportToolbar({ onExport, onPrint }: { onExport: () => void; onPrint: () => void }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
        <Download className="h-4 w-4" />
        تصدير CSV
      </Button>
      <Button onClick={onPrint} variant="outline" size="sm" className="gap-2">
        <Printer className="h-4 w-4" />
        طباعة
      </Button>
    </div>
  );
}

function SalesReport({ from, to }: { from: string; to: string }) {
  const orders = useQuery(api.customerOrders.list, { limit: 1000 }) || [];
  const filtered = orders.filter((o: any) => {
    const d = new Date(o.createdAt).toISOString().split("T")[0];
    return d >= from && d <= to && o.status !== "cancelled";
  });

  const total = filtered.reduce((s: number, o: any) => s + (o.totalPrice || 0), 0);
  const totalMeals = filtered.reduce((s: number, o: any) => s + (o.totalMeals || 0), 0);

  const handleExport = () => {
    const rows: any[][] = [["رقم الطلب", "العميل", "الجوال", "الحالة", "الوجبات", "السعرات", "السعر", "التاريخ"]];
    for (const o of filtered) {
      rows.push([
        o.orderNumber,
        o.customerName,
        o.customerPhone,
        o.status,
        o.totalMeals,
        o.totalCalories,
        o.totalPrice,
        new Date(o.createdAt).toLocaleDateString("en-GB"),
      ]);
    }
    downloadCsv(`sales-${from}-to-${to}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>تقرير المبيعات</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <StatBox label="عدد الطلبات" value={filtered.length} />
          <StatBox label="إجمالي الوجبات" value={totalMeals} />
          <StatBox label="إجمالي الإيرادات" value={`${total.toLocaleString()} ر.ق`} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطلب</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الوجبات</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>التاريخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((o: any) => (
              <TableRow key={o._id}>
                <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                <TableCell>{o.customerName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{o.status}</Badge>
                </TableCell>
                <TableCell>{o.totalMeals}</TableCell>
                <TableCell className="font-bold">{o.totalPrice} ر.ق</TableCell>
                <TableCell className="text-xs" dir="ltr">
                  {new Date(o.createdAt).toLocaleDateString("en-GB")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function KitchenReport({ from, to }: { from: string; to: string }) {
  const plans = useQuery(api.dailyPlans.list, {}) || [];
  const filtered = plans.filter((p: any) => p.date >= from && p.date <= to);

  const byStatus = filtered.reduce((acc: any, p: any) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const totalMeals = filtered.reduce(
    (s: number, p: any) => s + (Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0),
    0,
  );

  const handleExport = () => {
    const rows: any[][] = [["التاريخ", "العميل", "الحالة", "عدد الوجبات", "نوع التوصيل"]];
    for (const p of filtered) {
      rows.push([
        p.date,
        p.customerName || "—",
        p.status,
        Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0,
        p.deliveryTime,
      ]);
    }
    downloadCsv(`kitchen-${from}-to-${to}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>تقرير المطبخ</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatBox label="الخطط" value={filtered.length} />
          <StatBox label="الوجبات" value={totalMeals} />
          <StatBox label="جاهز" value={byStatus.PREPARED || 0} highlight />
          <StatBox label="تم التوصيل" value={byStatus.DELIVERED || 0} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الوجبات</TableHead>
              <TableHead>التوصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((p: any) => (
              <TableRow key={p._id}>
                <TableCell className="text-xs" dir="ltr">{p.date}</TableCell>
                <TableCell>{p.customerName || "—"}</TableCell>
                <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                <TableCell>
                  {Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0}
                </TableCell>
                <TableCell>{p.deliveryTime}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryReport({ from, to }: { from: string; to: string }) {
  const plans = useQuery(api.dailyPlans.list, {}) || [];
  const filtered = plans.filter(
    (p: any) => p.date >= from && p.date <= to && p.status === "DELIVERED",
  );

  return (
    <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardHeader>
        <CardTitle>تقرير التوصيل</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label="عدد التوصيلات" value={filtered.length} highlight />
          <StatBox
            label="إجمالي الوجبات"
            value={filtered.reduce(
              (s: number, p: any) => s + (Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0),
              0,
            )}
          />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>التوصيل</TableHead>
              <TableHead>الوجبات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((p: any) => (
              <TableRow key={p._id}>
                <TableCell className="text-xs" dir="ltr">{p.date}</TableCell>
                <TableCell>{p.customerName || "—"}</TableCell>
                <TableCell>{p.deliveryTime}</TableCell>
                <TableCell>
                  {Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomersReport() {
  const customers = useQuery(api.customers.list) || [];
  const active = customers.filter((c: any) => c.isActive).length;

  const handleExport = () => {
    const rows: any[][] = [["الاسم", "الجوال", "الباقة", "البداية", "النهاية", "الحالة"]];
    for (const c of customers) {
      rows.push([
        c.fullName,
        c.phone,
        c.packageLabel || c.program || "—",
        c.startDate,
        c.endDate,
        c.isActive ? "نشط" : "متوقف",
      ]);
    }
    downloadCsv(`customers-${new Date().toISOString().split("T")[0]}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>تقرير العملاء</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label="إجمالي العملاء" value={customers.length} />
          <StatBox label="العملاء النشطون" value={active} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الجوال</TableHead>
              <TableHead>الباقة</TableHead>
              <TableHead>البداية</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.slice(0, 100).map((c: any) => (
              <TableRow key={c._id}>
                <TableCell>{c.fullName}</TableCell>
                <TableCell dir="ltr">{c.phone}</TableCell>
                <TableCell>{c.packageLabel || c.program || "—"}</TableCell>
                <TableCell className="text-xs" dir="ltr">{c.startDate}</TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? "default" : "secondary"}>
                    {c.isActive ? "نشط" : "متوقف"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryReport() {
  const items = useQuery(api.inventory.listItems) || [];
  const lowStock = items.filter((i: any) => i.currentStock <= i.minStock).length;

  const handleExport = () => {
    const rows: any[][] = [["المنتج", "الفئة", "الوحدة", "المخزون", "الحد الأدنى", "حالة"]];
    for (const i of items) {
      rows.push([
        i.nameAr,
        i.category,
        i.unit,
        i.currentStock,
        i.minStock,
        i.currentStock <= i.minStock ? "منخفض" : "طبيعي",
      ]);
    }
    downloadCsv(`inventory-${new Date().toISOString().split("T")[0]}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>تقرير المخزون</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label="إجمالي المنتجات" value={items.length} />
          <StatBox label="مخزون منخفض" value={lowStock} highlight={lowStock > 0} />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>المخزون</TableHead>
              <TableHead>الحد الأدنى</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i: any) => (
              <TableRow key={i._id}>
                <TableCell>{i.nameAr}</TableCell>
                <TableCell>{i.category}</TableCell>
                <TableCell>{i.currentStock} {i.unit}</TableCell>
                <TableCell>{i.minStock}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      i.currentStock <= i.minStock
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }
                  >
                    {i.currentStock <= i.minStock ? "منخفض" : "طبيعي"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div
      className={`p-3 rounded-2xl border bg-white ${
        highlight ? "border-cyan-200" : "border-gray-200"
      }`}
    >
      <p className="text-xs text-gray-400 font-semibold">{label}</p>
      <p className={`text-xl font-black tabular-nums ${highlight ? "text-[#0E76AC]" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}
