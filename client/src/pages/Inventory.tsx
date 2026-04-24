/**
 * @file client/src/pages/Inventory.tsx
 * @description إدارة المخزون والمواد
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useInventoryItems,
  useInventorySummary,
  useInventoryByBarcode,
  useSeedInventory,
  type InventoryItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ItemFormModal from "@/components/inventory/ItemFormModal";
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  DollarSign,
  Calendar,
  TrendingDown,
  Barcode,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

const CATEGORY_LABELS = {
  all: { ar: "الكل", en: "All" },
  vegetables: { ar: "خضروات", en: "Vegetables" },
  proteins: { ar: "بروتينات", en: "Proteins" },
  dairy: { ar: "ألبان", en: "Dairy" },
  dry_goods: { ar: "مواد جافة", en: "Dry Goods" },
  other: { ar: "أخرى", en: "Other" },
};

const UNIT_LABELS = {
  kg: { ar: "كجم", en: "kg" },
  piece: { ar: "قطعة", en: "piece" },
  liter: { ar: "لتر", en: "liter" },
  pack: { ar: "عبوة", en: "pack" },
  box: { ar: "صندوق", en: "box" },
};

export default function InventoryPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcodeToAdd, setBarcodeToAdd] = useState<string | undefined>();

  const { data: summary } = useInventorySummary();
  const { data: items, isLoading } = useInventoryItems({
    search,
    category: category === "all" ? undefined : category,
  });
  const seedMutation = useSeedInventory();
  const { data: barcodeResult } = useInventoryByBarcode(search && search.length > 3 ? search : undefined);

  const handleSeedData = async () => {
    try {
      await seedMutation.mutateAsync();
      toast({
        title: isRtl ? "تم!" : "Success",
        description: isRtl ? "تم إضافة البيانات التجريبية" : "Seed data added successfully",
      });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشل الإضافة" : "Failed to add data"),
        variant: "destructive",
      });
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "vegetables":
        return "bg-green-100 text-green-700 border-green-200";
      case "proteins":
        return "bg-red-100 text-red-700 border-red-200";
      case "dairy":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "dry_goods":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.targetStock) * 100;
    if (item.currentStock <= item.minStock) {
      return { label: isRtl ? "نقص في المخزون" : "Low Stock", color: "text-red-600", badge: "bg-red-100 text-red-700" };
    } else if (item.currentStock === 0) {
      return { label: isRtl ? "نفذ المخزون" : "Out of Stock", color: "text-red-700", badge: "bg-red-500 text-white" };
    } else if (percentage >= 85) {
      return { label: isRtl ? "متوفر" : "Available", color: "text-green-600", badge: "bg-green-100 text-green-700" };
    } else {
      return { label: isRtl ? "متوسط" : "Medium", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" };
    }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-md">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isRtl ? "إدارة المخزون والمواد" : "Inventory Management"}
                </h1>
                <p className="text-sm text-gray-500">
                  {isRtl ? "إدارة المواد والمخزون" : "Manage items and stock"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setLocation("/inventory-reports")}
                variant="outline"
                className="h-11 rounded-xl border-cyan-500 text-cyan-600 hover:bg-cyan-50 shadow-sm"
              >
                <FileText className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                {isRtl ? "التقارير" : "Reports"}
              </Button>
              <Button
                onClick={() => {
                  setBarcodeToAdd(undefined);
                  setShowAddModal(true);
                }}
                className="h-11 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white shadow-md"
              >
                <Plus className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                {isRtl ? "إضافة مادة" : "Add Item"}
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400", isRtl ? "right-3" : "left-3")} />
              <Input
                placeholder={isRtl ? "البحث عن صنف أو مادة..." : "Search for item..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn("h-11 rounded-xl border-gray-300", isRtl ? "pr-10 text-right" : "pl-10")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">{isRtl ? "إجمالي المواد" : "Total Items"}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {summary?.totalItems || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isRtl ? "96% من السير الماضي" : "96% of last period"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">{isRtl ? "نقص في المخزون" : "Low Stock"}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {summary?.lowStockCount || 0}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              {isRtl ? "يتطلب إعادة طلب" : "Requires reorder"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-sm text-gray-600">{isRtl ? "تنتهي قريباً" : "Expiring Soon"}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {summary?.expiringSoonCount || 0}
            </p>
            <p className="text-xs text-red-600 mt-1">
              {isRtl ? "خلال 3 أيام أو أقل" : "Within 3 days"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">{isRtl ? "قيمة المخزون" : "Stock Value"}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {summary?.stockValue?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isRtl ? "ريال تحديث الحلقة" : "QAR current"}
            </p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  category === key
                    ? "bg-cyan-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {isRtl ? label.ar : label.en}
              </button>
            ))}
          </div>
        </div>

        {/* Items List Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isRtl ? "قائمة المواد" : "Items List"}
          </h2>
          <button
            onClick={handleSeedData}
            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            {isRtl ? "إضافة بيانات تجريبية" : "Add Sample Data"}
          </button>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">{isRtl ? "جاري التحميل..." : "Loading..."}</p>
            </div>
          ) : !items || items.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {isRtl ? "لا توجد مواد في المخزون" : "No items in inventory"}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const status = getStockStatus(item);
              const stockPercentage = Math.min(
                (item.currentStock / item.targetStock) * 100,
                100
              );

              return (
                <div
                  key={item._id}
                  onClick={() => setLocation(`/inventory/${item._id}`)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Item Image/Icon */}
                    <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-base mb-1">
                            {item.nameAr}
                          </h3>
                          {item.nameEn && (
                            <p className="text-xs text-gray-500">{item.nameEn}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={cn("text-xs px-2 py-0.5", getCategoryColor(item.category))}>
                              {isRtl ? CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS].ar : CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS].en}
                            </Badge>
                            {item.barcode && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Barcode className="h-3 w-3" />
                                {item.barcode}
                              </div>
                            )}
                          </div>
                        </div>

                        <Badge className={cn("text-xs px-2.5 py-1", status.badge)}>
                          {status.label}
                        </Badge>
                      </div>

                      {/* Stock Info */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {isRtl ? "الكمية المتوفرة:" : "Available:"}
                          </span>
                          <span className="font-bold text-gray-900">
                            {item.currentStock} {isRtl ? UNIT_LABELS[item.unit].ar : UNIT_LABELS[item.unit].en}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {isRtl ? "الهدف:" : "Target:"}
                          </span>
                          <span className="text-gray-700">
                            {item.targetStock} {isRtl ? UNIT_LABELS[item.unit].ar : UNIT_LABELS[item.unit].en}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.currentStock <= item.minStock
                                ? "bg-red-500"
                                : stockPercentage >= 85
                                ? "bg-green-500"
                                : "bg-amber-500"
                            )}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>

                        {item.currentStock <= item.minStock && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                              <p className="text-xs text-red-700">
                                {isRtl
                                  ? `تنبيه خلال ${item.avgWeeklyUsage > 0 ? Math.ceil((item.targetStock - item.currentStock) / (item.avgWeeklyUsage / 7)) : "؟"} يوم`
                                  : `Alert: ${item.avgWeeklyUsage > 0 ? Math.ceil((item.targetStock - item.currentStock) / (item.avgWeeklyUsage / 7)) : "?"} days supply`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      <ItemFormModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setBarcodeToAdd(undefined);
        }}
        initialBarcode={barcodeToAdd}
      />
    </div>
  );
}
