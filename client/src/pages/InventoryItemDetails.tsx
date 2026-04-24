/**
 * @file client/src/pages/InventoryItemDetails.tsx
 * @description صفحة تفاصيل مادة واحدة في المخزون
 */
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useInventoryItem,
  useInventoryBatches,
  useInventoryMovements,
  useSuppliers,
  useReceiveStock,
  useConsumeStock,
  useAdjustStock,
  type InventoryBatch,
  type InventoryMovement,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  Edit,
  Calendar,
  Barcode,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { format } from "date-fns";
import ItemFormModal from "@/components/inventory/ItemFormModal";

export default function InventoryItemDetailsPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/inventory/:id");
  const itemId = params?.id;

  const { data: item, isLoading } = useInventoryItem(itemId);
  const { data: batches = [] } = useInventoryBatches(itemId);
  const { data: movements = [] } = useInventoryMovements(itemId, 20);
  const { data: suppliers = [] } = useSuppliers();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const receiveMutation = useReceiveStock();
  const consumeMutation = useConsumeStock();
  const adjustMutation = useAdjustStock();

  // Receive Stock Modal
  const [receiveForm, setReceiveForm] = useState({
    quantity: 0,
    unitCost: 0,
    supplierId: "",
    expiryDate: "",
    receivedAt: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const handleReceive = async () => {
    if (receiveForm.quantity <= 0) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الكمية يجب أن تكون أكبر من صفر" : "Quantity must be positive",
        variant: "destructive",
      });
      return;
    }

    try {
      await receiveMutation.mutateAsync({
        itemId: itemId!,
        quantity: receiveForm.quantity,
        unitCost: receiveForm.unitCost,
        supplierId: receiveForm.supplierId || undefined,
        expiryDate: receiveForm.expiryDate || undefined,
        receivedAt: receiveForm.receivedAt,
        notes: receiveForm.notes || undefined,
      });

      toast({
        title: isRtl ? "تم الاستلام" : "Received",
        description: isRtl ? "تم إضافة الشحنة بنجاح" : "Batch added successfully",
      });

      setShowReceiveModal(false);
      setReceiveForm({
        quantity: 0,
        unitCost: 0,
        supplierId: "",
        expiryDate: "",
        receivedAt: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"),
        variant: "destructive",
      });
    }
  };

  // Consume Stock Modal
  const [consumeForm, setConsumeForm] = useState({
    quantity: 0,
    note: "",
  });

  const handleConsume = async () => {
    if (consumeForm.quantity <= 0) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الكمية يجب أن تكون أكبر من صفر" : "Quantity must be positive",
        variant: "destructive",
      });
      return;
    }

    if (item && consumeForm.quantity > item.currentStock) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الكمية أكبر من المخزون المتوفر" : "Quantity exceeds available stock",
        variant: "destructive",
      });
      return;
    }

    try {
      await consumeMutation.mutateAsync({
        itemId: itemId!,
        quantity: consumeForm.quantity,
        note: consumeForm.note || undefined,
      });

      toast({
        title: isRtl ? "تم الاستهلاك" : "Consumed",
        description: isRtl ? "تم استهلاك الكمية بنجاح" : "Stock consumed successfully",
      });

      setShowConsumeModal(false);
      setConsumeForm({ quantity: 0, note: "" });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"),
        variant: "destructive",
      });
    }
  };

  // Adjust Stock Modal
  const [adjustForm, setAdjustForm] = useState({
    newQuantity: 0,
    note: "",
  });

  const handleAdjust = async () => {
    if (adjustForm.newQuantity < 0) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الكمية لا يمكن أن تكون سالبة" : "Quantity cannot be negative",
        variant: "destructive",
      });
      return;
    }

    try {
      await adjustMutation.mutateAsync({
        itemId: itemId!,
        newQuantity: adjustForm.newQuantity,
        note: adjustForm.note || undefined,
      });

      toast({
        title: isRtl ? "تم التعديل" : "Adjusted",
        description: isRtl ? "تم تعديل المخزون بنجاح" : "Stock adjusted successfully",
      });

      setShowAdjustModal(false);
      setAdjustForm({ newQuantity: 0, note: "" });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"),
        variant: "destructive",
      });
    }
  };

  if (isLoading || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{isRtl ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "vegetables":
        return "bg-green-100 text-green-700";
      case "proteins":
        return "bg-red-100 text-red-700";
      case "dairy":
        return "bg-blue-100 text-blue-700";
      case "dry_goods":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "receive":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "consume":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Edit className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setLocation("/inventory")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{item.nameAr}</h1>
              {item.nameEn && (
                <p className="text-sm text-gray-500">{item.nameEn}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "تعديل" : "Edit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Item Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "الباركود" : "Barcode"}</p>
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4 text-gray-400" />
                <p className="font-medium text-gray-900">{item.barcode || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "التصنيف" : "Category"}</p>
              <Badge className={getCategoryColor(item.category)}>
                {item.category}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "الوحدة" : "Unit"}</p>
              <p className="font-medium text-gray-900">{item.unit}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "المخزون الحالي" : "Current Stock"}</p>
              <p className="text-2xl font-bold text-cyan-600">{item.currentStock}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "الحد الأدنى" : "Min Stock"}</p>
              <p className="font-medium text-gray-900">{item.minStock}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{isRtl ? "الهدف" : "Target Stock"}</p>
              <p className="font-medium text-gray-900">{item.targetStock}</p>
            </div>
          </div>

          {item.currentStock <= item.minStock && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-700">
                  {isRtl ? "تنبيه: المخزون أقل من الحد الأدنى" : "Alert: Stock below minimum"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => setShowReceiveModal(true)}
            className="bg-green-500 hover:bg-green-600"
          >
            <TrendingUp className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {isRtl ? "إضافة شحنة" : "Receive"}
          </Button>
          <Button
            onClick={() => setShowConsumeModal(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <TrendingDown className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {isRtl ? "استهلاك" : "Consume"}
          </Button>
          <Button
            onClick={() => {
              setAdjustForm({ ...adjustForm, newQuantity: item.currentStock });
              setShowAdjustModal(true);
            }}
            variant="outline"
          >
            <Edit className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {isRtl ? "تعديل" : "Adjust"}
          </Button>
        </div>

        {/* Batches */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {isRtl ? "الشحنات" : "Batches"}
          </h2>
          <div className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                {isRtl ? "لا توجد شحنات" : "No batches"}
              </p>
            ) : (
              batches.map((batch) => (
                <div
                  key={batch._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {batch.quantityRemaining} / {batch.quantityReceived}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isRtl ? "استلام:" : "Received:"} {batch.receivedAt}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{batch.unitCost} QAR</p>
                    {batch.expiryDate && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {batch.expiryDate}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Movements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {isRtl ? "آخر الحركات" : "Recent Movements"}
          </h2>
          <div className="space-y-2">
            {movements.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                {isRtl ? "لا توجد حركات" : "No movements"}
              </p>
            ) : (
              movements.map((movement) => (
                <div
                  key={movement._id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {getMovementIcon(movement.type)}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {movement.type === "receive"
                        ? isRtl
                          ? "استلام"
                          : "Received"
                        : movement.type === "consume"
                        ? isRtl
                          ? "استهلاك"
                          : "Consumed"
                        : isRtl
                        ? "تعديل"
                        : "Adjusted"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-bold",
                      movement.quantity > 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <ItemFormModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        item={item}
      />

      {/* Receive Stock Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className={cn("sm:max-w-[500px]", isRtl && "rtl")}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "إضافة شحنة جديدة" : "Receive Stock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRtl ? "الكمية" : "Quantity"}</Label>
              <Input
                type="number"
                min="0"
                value={receiveForm.quantity}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "سعر الوحدة (QAR)" : "Unit Cost (QAR)"}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={receiveForm.unitCost}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, unitCost: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "المورد (اختياري)" : "Supplier (Optional)"}</Label>
              <Select
                value={receiveForm.supplierId}
                onValueChange={(value) =>
                  setReceiveForm({ ...receiveForm, supplierId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRtl ? "اختر مورد" : "Select supplier"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{isRtl ? "بدون مورد" : "No supplier"}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRtl ? "تاريخ الاستلام" : "Received Date"}</Label>
                <Input
                  type="date"
                  value={receiveForm.receivedAt}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, receivedAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "تاريخ الانتهاء" : "Expiry Date"}</Label>
                <Input
                  type="date"
                  value={receiveForm.expiryDate}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, expiryDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={receiveForm.notes}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, notes: e.target.value })
                }
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowReceiveModal(false)}
                className="flex-1"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleReceive}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {isRtl ? "إضافة الشحنة" : "Add Batch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consume Stock Modal */}
      <Dialog open={showConsumeModal} onOpenChange={setShowConsumeModal}>
        <DialogContent className={cn("sm:max-w-[400px]", isRtl && "rtl")}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "استهلاك المخزون" : "Consume Stock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                {isRtl ? "المخزون الحالي:" : "Current Stock:"}
              </p>
              <p className="text-2xl font-bold text-gray-900">{item.currentStock}</p>
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "الكمية المستهلكة" : "Quantity to Consume"}</Label>
              <Input
                type="number"
                min="0"
                max={item.currentStock}
                value={consumeForm.quantity}
                onChange={(e) =>
                  setConsumeForm({ ...consumeForm, quantity: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={consumeForm.note}
                onChange={(e) =>
                  setConsumeForm({ ...consumeForm, note: e.target.value })
                }
                placeholder={isRtl ? "مثال: استخدام في المطبخ" : "e.g. Used in kitchen"}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowConsumeModal(false)}
                className="flex-1"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleConsume}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isRtl ? "استهلاك" : "Consume"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className={cn("sm:max-w-[400px]", isRtl && "rtl")}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "تعديل المخزون" : "Adjust Stock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                {isRtl ? "المخزون الحالي:" : "Current Stock:"}
              </p>
              <p className="text-2xl font-bold text-gray-900">{item.currentStock}</p>
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "الكمية الجديدة" : "New Quantity"}</Label>
              <Input
                type="number"
                min="0"
                value={adjustForm.newQuantity}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, newQuantity: Number(e.target.value) })
                }
              />
              {adjustForm.newQuantity !== item.currentStock && (
                <p className="text-sm text-gray-600">
                  {isRtl ? "الفرق:" : "Difference:"}{" "}
                  <span
                    className={cn(
                      "font-bold",
                      adjustForm.newQuantity > item.currentStock
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {adjustForm.newQuantity > item.currentStock ? "+" : ""}
                    {adjustForm.newQuantity - item.currentStock}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "سبب التعديل" : "Reason"}</Label>
              <Textarea
                value={adjustForm.note}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, note: e.target.value })
                }
                placeholder={isRtl ? "مثال: جرد المخزون" : "e.g. Stock audit"}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAdjustModal(false)}
                className="flex-1"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleAdjust}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600"
              >
                {isRtl ? "تعديل" : "Adjust"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
