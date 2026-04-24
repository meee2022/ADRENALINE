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
    const expiryPercentage = 2.4; // Mock data
    
    return {
      totalItems,
      totalConsumption,
      lowStockPercentage: lowStockPercentage.toFixed(0),
      expiryPercentage: expiryPercentage.toFixed(1),
      totalValue,
    };
  }, [items, movements, batches]);

  // Monthly consumption chart data
  const monthlyConsumptionData = useMemo(() => {
    const weeks = [
      { name: isRtl ? "الأسبوع 1" : "Week 1", value: 420 },
      { name: isRtl ? "الأسبوع 2" : "Week 2", value: 580 },
      { name: isRtl ? "الأسبوع 3" : "Week 3", value: 890 },
      { name: isRtl ? "الأسبوع 4" : "Week 4", value: 650 },
    ];
    return weeks;
  }, [isRtl]);

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
    toast({
      title: isRtl ? "قريباً" : "Coming Soon",
      description: isRtl ? "ميزة التصدير قيد التطوير" : "Export feature is under development",
    });
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
      <div className="bg-white border-b border-gray-100 px-4 py-6 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isRtl ? "تقارير استهلاك المواد" : "Consumption Reports"}
            </h1>
            <Button
              onClick={handleExportPDF}
              size="lg"
              className="h-12 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white shadow-lg shadow-cyan-200"
            >
              <FileText className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "تصدير PDF" : "Export PDF"}
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            {isRtl
              ? "تحليل تفصيلي لاستهلاك المواد والحركات المخزنية"
              : "Detailed analysis of material consumption and inventory movements"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Consumption Card */}
          <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
          <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
          <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
          <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
        <Card className="bg-white border border-gray-100 shadow-sm">
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
        <Card className="bg-white border border-gray-100 shadow-sm">
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
        <Card className="bg-white border border-gray-100 shadow-sm">
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
