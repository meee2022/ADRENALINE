/**
 * @file client/src/pages/InventoryReports.tsx
 * @description صفحة تقارير المخزون - تصميم محسّن
 */
import { useState, useMemo } from "react";
import {
  useInventoryItems,
  useInventoryBatches,
  useInventoryMovements,
  useSuppliers,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Package2,
  AlertCircle,
  FileBarChart,
  DollarSign,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { format, subDays, differenceInDays } from "date-fns";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function InventoryReportsPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();

  const { data: items = [] } = useInventoryItems({});
  const { data: batches = [] } = useInventoryBatches();
  const { data: movements = [] } = useInventoryMovements();
  const { data: suppliers = [] } = useSuppliers();

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalItems = items.length;
    const totalConsumption = movements
      .filter((m) => m.type === "consume")
      .reduce((sum, m) => sum + m.quantity, 0);
    
    const lowStockCount = items.filter(
      (item) => item.currentStock <= item.minStock
    ).length;
    
    const totalValue = batches.reduce(
      (sum, batch) => sum + batch.quantityRemaining * (batch.unitCost || 0),
      0
    );
    
    const lowStockPercentage = totalItems > 0 ? (lowStockCount / totalItems) * 100 : 0;

    // نسبة الدفعات القاربة على الانتهاء (خلال 7 أيام) من إجمالي الدفعات النشطة — حقيقية
    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const activeBatches = batches.filter((b) => (b.quantityRemaining || 0) > 0);
    const expiringBatches = activeBatches.filter(
      (b) => b.expiryDate && b.expiryDate >= todayStr && b.expiryDate <= in7
    );
    const expiryPercentage =
      activeBatches.length > 0 ? (expiringBatches.length / activeBatches.length) * 100 : 0;

    return {
      totalItems,
      totalConsumption,
      lowStockPercentage: lowStockPercentage.toFixed(0),
      expiryPercentage: expiryPercentage.toFixed(1),
      totalValue,
    };
  }, [items, movements, batches]);

  // Monthly consumption chart data — حقيقية من حركات الاستهلاك آخر 4 أسابيع
  const monthlyConsumptionData = useMemo(() => {
    const now = Date.now();
    const week = 7 * 86400000;
    // bucket[0] = أقدم أسبوع ... bucket[3] = الأسبوع الحالي
    const buckets = [0, 0, 0, 0];
    movements
      .filter((m) => m.type === "consume")
      .forEach((m) => {
        const ageWeeks = Math.floor((now - (m.createdAt || now)) / week);
        if (ageWeeks >= 0 && ageWeeks < 4) {
          buckets[3 - ageWeeks] += Math.abs(m.quantity || 0);
        }
      });
    return buckets.map((value, i) => ({
      name: isRtl ? `الأسبوع ${i + 1}` : `Week ${i + 1}`,
      value: Math.round(value),
    }));
  }, [movements, isRtl]);

  // Category distribution data
  const categoryDistributionData = useMemo(() => {
    const categories = {
      vegetables: { label: isRtl ? "خضروات" : "Vegetables", count: 0, color: "#22c55e" },
      proteins: { label: isRtl ? "بروتينات" : "Proteins", count: 0, color: "#3b82f6" },
      dairy: { label: isRtl ? "ألبان" : "Dairy", count: 0, color: "#eab308" },
      dry_goods: { label: isRtl ? "جافة" : "Dry Goods", count: 0, color: "#f97316" },
      other: { label: isRtl ? "أخرى" : "Other", count: 0, color: "#6366f1" },
    };

    items.forEach((item) => {
      if (categories[item.category as keyof typeof categories]) {
        categories[item.category as keyof typeof categories].count++;
      }
    });

    return Object.entries(categories)
      .filter(([_, data]) => data.count > 0)
      .map(([key, data]) => ({
        name: data.label,
        value: data.count,
        color: data.color,
        percentage: ((data.count / items.length) * 100).toFixed(0),
      }));
  }, [items, isRtl]);

  // Top consumed items
  const topConsumedItems = useMemo(() => {
    const itemConsumption = new Map<string, { item: any; total: number }>();

    movements
      .filter((m) => m.type === "consume")
      .forEach((m) => {
        const item = items.find((i) => i._id === m.itemId);
        if (item) {
          const existing = itemConsumption.get(m.itemId) || { item, total: 0 };
          existing.total += m.quantity;
          itemConsumption.set(m.itemId, existing);
        }
      });

    return Array.from(itemConsumption.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [items, movements]);

  const handleExportPDF = () => {
    // طباعة أصلية (عربي سليم) — كشف المخزون كاملاً؛ المستخدم يحفظ كـ PDF.
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const dir = isRtl ? "rtl" : "ltr";
    const tr = (a: string, e: string) => (isRtl ? a : e);
    const rows = [...items]
      .sort((a, b) => Number(a.currentStock <= a.minStock ? 0 : 1) - Number(b.currentStock <= b.minStock ? 0 : 1))
      .map((i: any) => {
        const low = i.currentStock <= i.minStock;
        return `<tr>
          <td>${esc(i.nameAr || i.nameEn || "—")}</td>
          <td class="c">${esc(i.category || "—")}</td>
          <td class="c">${esc(i.currentStock)} ${esc(i.unit || "")}</td>
          <td class="c">${esc(i.minStock)}</td>
          <td class="c ${low ? "low" : "ok"}">${low ? tr("منخفض", "Low") : tr("طبيعي", "Normal")}</td>
        </tr>`;
      }).join("");
    const html = `<!doctype html><html dir="${dir}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8">
      <meta name="viewport" content="width=800">
      <title>ADRENALINE-inventory</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#0E2A4A}
        .hero{background:linear-gradient(120deg,#0E2A4A,#0E76AC);color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end}
        .brand{font-size:19px;font-weight:900;letter-spacing:.12em}.brand small{display:block;font-size:8px;letter-spacing:.35em;opacity:.85}
        .wrap{padding:12px 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0E76AC;color:#fff;padding:7px 6px;font-weight:800;border:1px solid #0b5f8a}
        td{padding:6px;border:1px solid #cfd9e4}tr:nth-child(even) td{background:#f7fbfe}
        .c{text-align:center}.low{color:#b91c1c;font-weight:800}.ok{color:#15803d;font-weight:700}
        @page{size:A4;margin:8mm}
      </style></head><body>
      <div class="hero"><div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
        <div style="text-align:${isRtl ? "end" : "start"}"><div style="font-size:16px;font-weight:900">${tr("تقرير المخزون", "Inventory Report")}</div>
        <div style="font-size:11px;opacity:.9">${new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-GB")} · ${items.length} ${tr("مادة", "items")}</div></div></div>
      <div class="wrap"><table><thead><tr>
        <th>${tr("المنتج", "Product")}</th><th>${tr("الفئة", "Category")}</th><th>${tr("المخزون", "Stock")}</th><th>${tr("الحد الأدنى", "Min")}</th><th>${tr("الحالة", "Status")}</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
      <script>(function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},250);})();<\/script>
      </body></html>`;
    const w = window.open("", "_blank", "width=900,height=800");
    if (!w) { toast({ title: isRtl ? "اسمح بالنوافذ المنبثقة" : "Allow pop-ups" }); return; }
    w.document.write(html); w.document.close();
  };

  const handleShowDetails = () => {
    toast({
      title: isRtl ? "التفاصيل الكاملة" : "Full Details",
      description: isRtl ? "عرض جميع المواد والحركات" : "Showing all items and movements",
    });
  };

  const COLORS = ["#22c55e", "#3b82f6", "#eab308", "#f97316", "#6366f1"];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<FileBarChart className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="تقارير استهلاك المواد" titleEn="Consumption Reports"
          subtitleAr="تحليل تفصيلي لاستهلاك المواد والحركات المخزنية" subtitleEn="Detailed analysis of material consumption and inventory movements"
          kpis={[
            { value: summaryStats.totalConsumption.toLocaleString(), labelAr: "إجمالي الاستهلاك", labelEn: "Total Consumption" },
            { value: `${summaryStats.lowStockPercentage}%`, labelAr: "نسبة التوافر", labelEn: "Availability" },
            { value: `${summaryStats.expiryPercentage}%`, labelAr: "نسبة الانتهاء", labelEn: "Expiry Rate" },
            { value: summaryStats.totalItems, labelAr: "إجمالي الأصناف", labelEn: "Total Items" },
          ]}
          actions={
            <Button
              onClick={handleExportPDF}
              className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
            >
              <FileText className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "تصدير PDF" : "Export PDF"}
            </Button>
          }
        />
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Consumption Card */}
          <Card className="bg-white rounded-2xl hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <FileBarChart className="h-6 w-6 text-white" />
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-0">
                  {isRtl ? "إجمالي" : "Total"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {isRtl ? "إجمالي الاستهلاك" : "Total Consumption"}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {summaryStats.totalConsumption.toLocaleString()}
                <span className="text-base font-normal text-gray-500 mr-2">
                  {isRtl ? "قطعة" : "items"}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Chicken Card */}
          <Card className="bg-white rounded-2xl hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-2xl">
                  🍗
                </div>
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-0">
                  {isRtl ? "الأكثر" : "Top"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {isRtl ? "الصنف الأكثر استخداماً" : "Most Used Item"}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {isRtl ? "صدور دجاج" : "Chicken Breast"}
              </p>
            </CardContent>
          </Card>

          {/* Low Stock % Card */}
          <Card className="bg-white rounded-2xl hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <Package2 className="h-6 w-6 text-white" />
                </div>
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-0">
                  {isRtl ? "مؤشر" : "Index"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {isRtl ? "نسبة التوافر الإلكتروني" : "Availability Ratio"}
              </p>
              <p className="text-3xl font-bold text-green-600">
                {summaryStats.lowStockPercentage}%
                <span className="text-base font-normal text-gray-500 mr-2">
                  {isRtl ? "جيد" : "good"}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Expiry % Card */}
          <Card className="bg-white rounded-2xl hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <Badge variant="secondary" className="bg-red-50 text-red-700 border-0">
                  {isRtl ? "تنبيه" : "Alert"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {isRtl ? "نسبة منتهي الصلاحية" : "Expiry Rate"}
              </p>
              <p className="text-3xl font-bold text-red-600">
                {summaryStats.expiryPercentage}%
                <span className="text-base font-normal text-gray-500 mr-2">
                  {isRtl ? "قليل" : "low"}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Consumption Chart */}
        <Card className="bg-white rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-900">
                {isRtl ? "معدل الاستهلاك الشهري" : "Monthly Consumption Rate"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowDetails}
                className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50"
              >
                {isRtl ? "عرض أكثر" : "View More"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyConsumptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#e5e7eb" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution Pie Chart */}
        <Card className="bg-white rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-lg font-bold text-gray-900">
              {isRtl ? "توزيع الاستهلاك حسب التصنيف" : "Consumption by Category"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={categoryDistributionData}
                      cx={100}
                      cy={100}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-gray-900">100%</p>
                  <p className="text-xs text-gray-500">{isRtl ? "إجمالي" : "Total"}</p>
                </div>
              </div>

              <div className="space-y-3">
                {categoryDistributionData.map((category, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm text-gray-700 min-w-[100px]">{category.name}</span>
                    <span className="text-sm font-bold text-gray-900">{category.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Consumed Items Table */}
        <Card className="bg-white rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-900">
                {isRtl ? "تفاصيل استهلاك المواد" : "Material Consumption Details"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowDetails}
                className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50"
              >
                {isRtl ? "عرض الكل" : "View All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {topConsumedItems.slice(0, 5).map((data, index) => (
                <div
                  key={data.item._id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                    <span className="text-2xl">
                      {data.item.category === "proteins"
                        ? "🍗"
                        : data.item.category === "vegetables"
                        ? "🥗"
                        : data.item.category === "dairy"
                        ? "🥛"
                        : "📦"}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm mb-1">
                      {data.item.nameAr || data.item.nameEn}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs px-2 py-0.5 border-0",
                          data.item.category === "proteins"
                            ? "bg-blue-50 text-blue-700"
                            : data.item.category === "vegetables"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-700"
                        )}
                      >
                        {data.item.category === "proteins"
                          ? isRtl
                            ? "بروتينات"
                            : "Proteins"
                          : data.item.category === "vegetables"
                          ? isRtl
                            ? "خضروات"
                            : "Vegetables"
                          : isRtl
                          ? "أخرى"
                          : "Other"}
                      </Badge>
                      <span className="text-xs text-gray-500">ID: {data.item._id.slice(-4)}</span>
                    </div>
                  </div>

                  <div className="text-left flex-shrink-0">
                    <p className="text-sm text-gray-500 mb-1">
                      {isRtl ? "الكمية" : "Quantity"}
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {data.total}
                      <span className="text-sm font-normal text-gray-500 ml-1">
                        {data.item.unit === "kg"
                          ? isRtl
                            ? "كجم"
                            : "kg"
                          : data.item.unit === "piece"
                          ? isRtl
                            ? "قطعة"
                            : "pcs"
                          : data.item.unit}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
