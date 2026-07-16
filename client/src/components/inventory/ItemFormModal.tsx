/**
 * @file client/src/components/inventory/ItemFormModal.tsx
 * @description نموذج إضافة/تعديل مادة في المخزون
 */
import { useState, useEffect } from "react";
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useSuppliers,
  type InventoryItem,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Barcode, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  initialBarcode?: string;
}

const CATEGORIES = [
  { value: "vegetables", ar: "خضروات", en: "Vegetables" },
  { value: "proteins", ar: "بروتينات", en: "Proteins" },
  { value: "dairy", ar: "ألبان", en: "Dairy" },
  { value: "dry_goods", ar: "مواد جافة", en: "Dry Goods" },
  { value: "other", ar: "أخرى", en: "Other" },
];

const UNITS = [
  { value: "kg", ar: "كجم", en: "kg" },
  { value: "piece", ar: "قطعة", en: "piece" },
  { value: "liter", ar: "لتر", en: "liter" },
  { value: "pack", ar: "عبوة", en: "pack" },
  { value: "box", ar: "صندوق", en: "box" },
];

export default function ItemFormModal({
  open,
  onClose,
  item,
  initialBarcode,
}: ItemFormModalProps) {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const setup: any = useQuery(api.inventorySetup.getSetupData, sessionToken ? { sessionToken } : "skip");

  const { data: suppliers = [] } = useSuppliers();
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();

  const [formData, setFormData] = useState({
    barcode: "",
    nameAr: "",
    nameEn: "",
    category: "vegetables" as any,
    unit: "kg" as any,
    sku: "",
    itemType: "ingredient",
    purchaseUnit: "kg",
    purchaseToBaseFactor: 1,
    defaultLocationId: "",
    notes: "",
    supplierId: "",
    minStock: 0,
    targetStock: 0,
  });

  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        barcode: item.barcode || "",
        nameAr: item.nameAr,
        nameEn: item.nameEn || "",
        category: item.category,
        unit: item.unit,
        sku: item.sku || "",
        itemType: item.itemType || "ingredient",
        purchaseUnit: item.purchaseUnit || item.unit,
        purchaseToBaseFactor: item.purchaseToBaseFactor || 1,
        defaultLocationId: item.defaultLocationId || "",
        notes: item.notes || "",
        supplierId: item.supplierId || "",
        minStock: item.minStock,
        targetStock: item.targetStock,
      });
    } else if (initialBarcode) {
      setFormData((prev) => ({ ...prev, barcode: initialBarcode }));
    }
  }, [item, initialBarcode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameAr.trim()) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الاسم العربي مطلوب" : "Arabic name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.targetStock < formData.minStock) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl
          ? "الهدف يجب أن يكون أكبر من الحد الأدنى"
          : "Target must be greater than minimum",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        barcode: formData.barcode.trim() || undefined,
        nameAr: formData.nameAr.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        category: formData.category,
        unit: formData.unit,
        sku: formData.sku.trim() || undefined,
        itemType: formData.itemType,
        purchaseUnit: formData.purchaseUnit || formData.unit,
        purchaseToBaseFactor: Number(formData.purchaseToBaseFactor) || 1,
        defaultLocationId: formData.defaultLocationId || undefined,
        notes: formData.notes.trim() || undefined,
        supplierId: formData.supplierId || undefined,
        minStock: formData.minStock,
        targetStock: formData.targetStock,
      };

      if (item) {
        await updateMutation.mutateAsync({ id: item._id, ...payload });
        toast({
          title: isRtl ? "تم التحديث" : "Updated",
          description: isRtl ? "تم تحديث المادة بنجاح" : "Item updated successfully",
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: isRtl ? "تمت الإضافة" : "Added",
          description: isRtl ? "تمت إضافة المادة بنجاح" : "Item added successfully",
        });
      }

      onClose();
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"),
        variant: "destructive",
      });
    }
  };

  const handleScan = () => {
    setScanning(true);
    toast({
      title: isRtl ? "جاهز للمسح" : "Ready to Scan",
      description: isRtl ? "امسح الباركود الآن" : "Scan barcode now",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn("max-h-[90vh] overflow-y-auto sm:max-w-[620px]", isRtl && "rtl")}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {item
              ? isRtl
                ? "تعديل مادة"
                : "Edit Item"
              : isRtl
              ? "إضافة مادة جديدة"
              : "Add New Item"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Barcode */}
          <div className="space-y-2">
            <Label>{isRtl ? "الباركود (اختياري)" : "Barcode (Optional)"}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400",
                    isRtl ? "right-3" : "left-3"
                  )}
                />
                <Input
                  placeholder={isRtl ? "امسح أو أدخل الباركود" : "Scan or enter barcode"}
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                  onFocus={() => setScanning(true)}
                  onBlur={() => setScanning(false)}
                  className={cn(isRtl ? "pr-10 text-right" : "pl-10")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleScan}
                className={cn(scanning && "bg-cyan-50 border-cyan-400")}
              >
                <Scan className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Name Arabic */}
          <div className="space-y-2">
            <Label>
              {isRtl ? "الاسم بالعربي" : "Name (Arabic)"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              required
              placeholder={isRtl ? "مثال: صدور دجاج" : "e.g. صدور دجاج"}
              value={formData.nameAr}
              onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              className={isRtl ? "text-right" : ""}
            />
          </div>

          {/* Name English */}
          <div className="space-y-2">
            <Label>{isRtl ? "الاسم بالإنجليزي (اختياري)" : "Name (English)"}</Label>
            <Input
              placeholder={isRtl ? "e.g. Chicken Breast" : "e.g. Chicken Breast"}
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {isRtl ? "التصنيف" : "Category"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(setup?.categories?.length ? setup.categories.map((c: any) => ({ value: c.code, ar: c.nameAr, en: c.nameEn })) : CATEGORIES).map((cat: any) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {isRtl ? cat.ar : cat.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {isRtl ? "الوحدة" : "Unit"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(setup?.units?.length ? setup.units.map((u: any) => ({ value: u.code, ar: u.nameAr, en: u.nameEn })) : UNITS).map((unit: any) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {isRtl ? unit.ar : unit.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{isRtl ? "نوع الصنف" : "Item type"}</Label><Select value={formData.itemType} onValueChange={(value) => setFormData({ ...formData, itemType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ingredient">{isRtl ? "مادة غذائية" : "Ingredient"}</SelectItem><SelectItem value="packaging">{isRtl ? "تغليف" : "Packaging"}</SelectItem><SelectItem value="consumable">{isRtl ? "مستهلكات" : "Consumable"}</SelectItem><SelectItem value="asset">{isRtl ? "عهدة / أصل" : "Asset"}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{isRtl ? "كود الصنف SKU" : "SKU"}</Label><Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{isRtl ? "وحدة الشراء" : "Purchase unit"}</Label><Select value={formData.purchaseUnit} onValueChange={(value) => setFormData({ ...formData, purchaseUnit: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(setup?.units?.length ? setup.units.map((u: any) => ({ value: u.code, ar: u.nameAr, en: u.nameEn })) : UNITS).map((u: any) => <SelectItem key={u.value} value={u.value}>{isRtl ? u.ar : u.en}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{isRtl ? `كل وحدة شراء = كم ${formData.unit}` : `Base units per purchase unit`}</Label><Input type="number" min="0.0001" step="0.0001" value={formData.purchaseToBaseFactor} onChange={(e) => setFormData({ ...formData, purchaseToBaseFactor: Number(e.target.value) })} /></div>
          </div>

          <div className="space-y-2"><Label>{isRtl ? "موقع التخزين الافتراضي" : "Default location"}</Label><Select value={formData.defaultLocationId || "none"} onValueChange={(value) => setFormData({ ...formData, defaultLocationId: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder={isRtl ? "اختر الموقع" : "Select location"} /></SelectTrigger><SelectContent><SelectItem value="none">{isRtl ? "غير محدد" : "Not set"}</SelectItem>{(setup?.locations || []).map((l: any) => <SelectItem key={l._id} value={l._id}>{isRtl ? l.nameAr : l.nameEn}</SelectItem>)}</SelectContent></Select></div>

          <div className="space-y-2"><Label>{isRtl ? "ملاحظات التخزين" : "Storage notes"}</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={isRtl ? "مثال: الرف B2، يحفظ مجمداً" : "e.g. Shelf B2, keep frozen"} /></div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label>{isRtl ? "المورد (اختياري)" : "Supplier (Optional)"}</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(value) =>
                setFormData({ ...formData, supplierId: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isRtl ? "اختر مورد" : "Select supplier"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  {isRtl ? "بدون مورد" : "No supplier"}
                </SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min & Target Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isRtl ? "الحد الأدنى" : "Min Stock"}</Label>
              <Input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({ ...formData, minStock: Number(e.target.value) })
                }
                className={isRtl ? "text-right" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "الهدف" : "Target Stock"}</Label>
              <Input
                type="number"
                min="0"
                value={formData.targetStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetStock: Number(e.target.value),
                  })
                }
                className={isRtl ? "text-right" : ""}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-600">
              {item ? (isRtl ? "تحديث" : "Update") : isRtl ? "إضافة" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
