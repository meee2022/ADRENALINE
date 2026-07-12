/**
 * @file client/src/pages/Reports.tsx
 * @description مركز التقارير - تقارير قابلة للتصدير والطباعة (ثنائي اللغة)
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
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

/** بطاقة موحّدة بظل فاخر — DNA نظام الهوية بألوان المشروع. */
const CARD_STYLE: React.CSSProperties = {
  border: "1px solid #e6edf3",
  boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 10px 24px -12px rgba(71,117,156,.18), 0 24px 48px -24px rgba(60,196,240,.12)",
};

/** ستايل مركزي للتقارير (رؤوس جداول متدرّجة، صفوف متبادلة، حركة دخول). */
function ReportsStyle() {
  return (
    <style>{`
      .rpt-scope table { border-collapse: separate; border-spacing: 0; }
      .rpt-scope table thead th {
        background: linear-gradient(135deg, #4a7aa3, #345a7d);
        color: #dbeafe !important;
        font-weight: 700; font-size: 12px; letter-spacing: .01em;
        border-bottom: 2px solid #3cc4f0; white-space: nowrap; height: 44px;
      }
      .rpt-scope table thead th:first-child { border-start-start-radius: 12px; }
      .rpt-scope table thead th:last-child  { border-start-end-radius: 12px; }
      .rpt-scope table tbody tr { transition: background .15s ease; }
      .rpt-scope table tbody tr:nth-child(even) { background: rgba(71,117,156,.045); }
      .rpt-scope table tbody tr:hover { background: rgba(60,196,240,.10); }
      .rpt-scope table tbody td { border-bottom: 1px solid #eef2f6; }
      @keyframes rptIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .rpt-anim { animation: rptIn .35s cubic-bezier(.16,1,.3,1) both; }
      @media (prefers-reduced-motion: reduce) { .rpt-anim { animation: none; } }
    `}</style>
  );
}

/** helper موحّد للترجمة داخل كل مكوّن (t غير متاح عبر النطاق فنبنيه محلياً). */
function useT() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  return { isRtl, t: (a: string, e: string) => (isRtl ? a : e) };
}

const REPORTS: Array<{ key: ReportType; titleAr: string; titleEn: string; icon: any; color: string }> = [
  { key: "sales", titleAr: "تقرير المبيعات", titleEn: "Sales Report", icon: DollarSign, color: "#10b981" },
  { key: "kitchen", titleAr: "تقرير المطبخ", titleEn: "Kitchen Report", icon: ChefHat, color: "#f59e0b" },
  { key: "delivery", titleAr: "تقرير التوصيل", titleEn: "Delivery Report", icon: Truck, color: "#8b5cf6" },
  { key: "customers", titleAr: "تقرير العملاء", titleEn: "Customers Report", icon: UsersIcon, color: "#3CC4F0" },
  { key: "inventory", titleAr: "تقرير المخزون", titleEn: "Inventory Report", icon: Package, color: "#ef4444" },
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
  const { isRtl, t } = useT();
  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const today = new Date().toISOString().split("T")[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(lastMonth);
  const [toDate, setToDate] = useState(today);

  const activeMeta = REPORTS.find((r) => r.key === activeReport)!;

  return (
    <div className="rpt-scope space-y-6">
      <ReportsStyle />
      <DashboardHeader
        icon={<FileText className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="مركز التقارير" titleEn="Reports Center"
        subtitleAr="تقارير شاملة قابلة للتصدير والطباعة" subtitleEn="Comprehensive exportable & printable reports"
      />

      {/* Report tabs — بطاقات بأيقونة-أورب */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const isActive = activeReport === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              className="group relative flex items-center gap-3 rounded-2xl border p-3 text-start transition-all duration-200"
              style={
                isActive
                  ? { borderColor: "transparent", background: "linear-gradient(135deg, #4a7aa3, #345a7d)", boxShadow: "0 8px 20px -8px rgba(52,90,125,.55)", transform: "translateY(-2px)" }
                  : { borderColor: "#e6edf3", background: "#fff" }
              }
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105"
                style={isActive ? { background: "rgba(255,255,255,.16)" } : { background: `${r.color}1a` }}
              >
                <Icon className="h-5 w-5" style={{ color: isActive ? "#fff" : r.color }} />
              </span>
              <span className={`text-sm font-bold leading-tight ${isActive ? "text-white" : "text-slate-700"}`}>
                {isRtl ? r.titleAr : r.titleEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="rounded-2xl border-0" style={CARD_STYLE}>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${activeMeta.color}1a` }}>
              <activeMeta.icon className="h-5 w-5" style={{ color: activeMeta.color }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-500">{t("من تاريخ", "From date")}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-500">{t("إلى تاريخ", "To date")}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10" />
            </div>
            <p className="ms-auto text-xs text-slate-400 self-center hidden sm:block">
              {t("اختر تقريرًا من الأعلى", "Pick a report above")}
            </p>
          </div>
        </CardContent>
      </Card>

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
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button onClick={onExport} size="sm" className="gap-2 bg-[#3cc4f0] text-[#0f1516] font-bold hover:bg-[#2bb0dc] shadow-sm">
        <Download className="h-4 w-4" />
        {t("تصدير CSV", "Export CSV")}
      </Button>
      <Button onClick={onPrint} variant="outline" size="sm" className="gap-2 border-[#cfe0ec] text-[#47759c] hover:bg-[#eef4f9]">
        <Printer className="h-4 w-4" />
        {t("طباعة", "Print")}
      </Button>
    </div>
  );
}

function SalesReport({ from, to }: { from: string; to: string }) {
  const { t } = useT();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const orders = useQuery(api.customerOrders.list, { limit: 1000, sessionToken }) || [];
  const filtered = orders.filter((o: any) => {
    const d = new Date(o.createdAt).toISOString().split("T")[0];
    return d >= from && d <= to && o.status !== "cancelled";
  });

  const total = filtered.reduce((s: number, o: any) => s + (o.totalPrice || 0), 0);
  const totalMeals = filtered.reduce((s: number, o: any) => s + (o.totalMeals || 0), 0);

  const handleExport = () => {
    const rows: any[][] = [
      t("رقم الطلب,العميل,الجوال,الحالة,الوجبات,السعرات,السعر,التاريخ", "Order No,Customer,Phone,Status,Meals,Calories,Price,Date").split(","),
    ];
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
    <Card className="rounded-2xl border-0 rpt-anim" style={CARD_STYLE}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("تقرير المبيعات", "Sales Report")}</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <StatBox label={t("عدد الطلبات", "Orders")} value={filtered.length} />
          <StatBox label={t("إجمالي الوجبات", "Total meals")} value={totalMeals} />
          <StatBox label={t("إجمالي الإيرادات", "Total revenue")} value={`${total.toLocaleString()} ${t("ر.ق", "QAR")}`} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("الطلب", "Order")}</TableHead>
              <TableHead>{t("العميل", "Customer")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("الوجبات", "Meals")}</TableHead>
              <TableHead>{t("السعر", "Price")}</TableHead>
              <TableHead>{t("التاريخ", "Date")}</TableHead>
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
                <TableCell className="font-bold">{o.totalPrice} {t("ر.ق", "QAR")}</TableCell>
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
  const { t } = useT();
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
    const rows: any[][] = [
      t("التاريخ,العميل,الحالة,عدد الوجبات,نوع التوصيل", "Date,Customer,Status,Meals,Delivery").split(","),
    ];
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
    <Card className="rounded-2xl border-0 rpt-anim" style={CARD_STYLE}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("تقرير المطبخ", "Kitchen Report")}</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatBox label={t("الخطط", "Plans")} value={filtered.length} />
          <StatBox label={t("الوجبات", "Meals")} value={totalMeals} />
          <StatBox label={t("جاهز", "Prepared")} value={byStatus.PREPARED || 0} highlight />
          <StatBox label={t("تم التوصيل", "Delivered")} value={byStatus.DELIVERED || 0} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("التاريخ", "Date")}</TableHead>
              <TableHead>{t("العميل", "Customer")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("الوجبات", "Meals")}</TableHead>
              <TableHead>{t("التوصيل", "Delivery")}</TableHead>
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
  const { t } = useT();
  const plans = useQuery(api.dailyPlans.list, {}) || [];
  const filtered = plans.filter(
    (p: any) => p.date >= from && p.date <= to && p.status === "DELIVERED",
  );

  return (
    <Card className="rounded-2xl border-0 rpt-anim" style={CARD_STYLE}>
      <CardHeader>
        <CardTitle>{t("تقرير التوصيل", "Delivery Report")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label={t("عدد التوصيلات", "Deliveries")} value={filtered.length} highlight />
          <StatBox
            label={t("إجمالي الوجبات", "Total meals")}
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
              <TableHead>{t("التاريخ", "Date")}</TableHead>
              <TableHead>{t("العميل", "Customer")}</TableHead>
              <TableHead>{t("التوصيل", "Delivery")}</TableHead>
              <TableHead>{t("الوجبات", "Meals")}</TableHead>
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
  const { t } = useT();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const customers = useQuery(api.customers.list, { sessionToken }) || [];
  const active = customers.filter((c: any) => c.isActive).length;

  const handleExport = () => {
    const rows: any[][] = [
      t("الاسم,الجوال,الباقة,البداية,النهاية,الحالة", "Name,Phone,Package,Start,End,Status").split(","),
    ];
    for (const c of customers) {
      rows.push([
        c.fullName,
        c.phone,
        c.packageLabel || c.program || "—",
        c.startDate,
        c.endDate,
        c.isActive ? t("نشط", "Active") : t("متوقف", "Inactive"),
      ]);
    }
    downloadCsv(`customers-${new Date().toISOString().split("T")[0]}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0 rpt-anim" style={CARD_STYLE}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("تقرير العملاء", "Customers Report")}</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label={t("إجمالي العملاء", "Total customers")} value={customers.length} />
          <StatBox label={t("العملاء النشطون", "Active customers")} value={active} highlight />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("الاسم", "Name")}</TableHead>
              <TableHead>{t("الجوال", "Phone")}</TableHead>
              <TableHead>{t("الباقة", "Package")}</TableHead>
              <TableHead>{t("البداية", "Start")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
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
                    {c.isActive ? t("نشط", "Active") : t("متوقف", "Inactive")}
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
  const { t } = useT();
  const items = useQuery(api.inventory.listItems, {}) || [];
  const lowStock = items.filter((i: any) => i.currentStock <= i.minStock).length;

  const handleExport = () => {
    const rows: any[][] = [
      t("المنتج,الفئة,الوحدة,المخزون,الحد الأدنى,حالة", "Product,Category,Unit,Stock,Min,Status").split(","),
    ];
    for (const i of items) {
      rows.push([
        i.nameAr,
        i.category,
        i.unit,
        i.currentStock,
        i.minStock,
        i.currentStock <= i.minStock ? t("منخفض", "Low") : t("طبيعي", "Normal"),
      ]);
    }
    downloadCsv(`inventory-${new Date().toISOString().split("T")[0]}.csv`, toCsv(rows));
  };

  return (
    <Card className="rounded-2xl border-0 rpt-anim" style={CARD_STYLE}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("تقرير المخزون", "Inventory Report")}</CardTitle>
        <ReportToolbar onExport={handleExport} onPrint={() => window.print()} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <StatBox label={t("إجمالي المنتجات", "Total products")} value={items.length} />
          <StatBox label={t("مخزون منخفض", "Low stock")} value={lowStock} highlight={lowStock > 0} />
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("المنتج", "Product")}</TableHead>
              <TableHead>{t("الفئة", "Category")}</TableHead>
              <TableHead>{t("المخزون", "Stock")}</TableHead>
              <TableHead>{t("الحد الأدنى", "Min")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
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
                    {i.currentStock <= i.minStock ? t("منخفض", "Low") : t("طبيعي", "Normal")}
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
      className="relative overflow-hidden rounded-2xl border p-4"
      style={
        highlight
          ? { borderColor: "transparent", background: "linear-gradient(135deg, #eaf7fd, #ffffff)", boxShadow: "0 8px 20px -12px rgba(60,196,240,.4)" }
          : { borderColor: "#e6edf3", background: "#fff" }
      }
    >
      {/* شريط لوني جانبي */}
      <span
        className="absolute inset-y-0 w-1"
        style={{ insetInlineStart: 0, background: highlight ? "linear-gradient(#3cc4f0,#0E76AC)" : "#dbe4ec" }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className="mt-1 text-2xl font-black tabular-nums leading-none"
        style={{ color: highlight ? "#0E76AC" : "#1e293b" }}
      >
        {value}
      </p>
    </div>
  );
}
