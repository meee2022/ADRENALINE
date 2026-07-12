/**
 * @file client/src/components/IngredientsDialog.tsx
 * @description إدارة مكوّنات الوجبة من المخزون - لخصم تلقائي عند التحضير
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

export function IngredientsDialog({
  meal,
  open,
  onClose,
}: {
  meal: any;
  open: boolean;
  onClose: () => void;
}) {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const ingredients = useQuery(api.mealIngredients.listByMeal, { menuItemId: meal._id, sessionToken }) || [];
  const inventoryItems = useQuery(api.inventory.listItems, {}) || [];

  const createMutation = useMutation(api.mealIngredients.create);
  const removeMutation = useMutation(api.mealIngredients.remove);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const handleAdd = async () => {
    if (!selectedItemId || !quantity) {
      toast({ title: t("خطأ", "Error"), description: t("اختر مكوّن وحدد الكمية", "Select an ingredient and set the quantity"), variant: "destructive" });
      return;
    }
    const item = inventoryItems.find((i: any) => i._id === selectedItemId);
    try {
      await createMutation({
        sessionToken,
        menuItemId: meal._id,
        inventoryItemId: selectedItemId as any,
        quantityPerServing: parseFloat(quantity),
        unit: unit || item?.unit || "",
      });
      toast({ title: t("تم الإضافة", "Added"), description: t("تم ربط المكوّن بالوجبة", "Ingredient linked to the meal") });
      setSelectedItemId("");
      setQuantity("");
      setUnit("");
    } catch (e: any) {
      toast({ title: t("خطأ", "Error"), description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t("حذف هذا المكوّن من الوجبة؟", "Remove this ingredient from the meal?"))) return;
    await removeMutation({ id: id as any, sessionToken });
    toast({ title: t("تم الحذف", "Deleted") });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-amber-600" />
            {t("مكوّنات:", "Ingredients:")} {meal.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t('هذه المكوّنات تُخصم تلقائياً من المخزون عند تعليم الوجبة كـ "جاهزة للتوصيل"', 'These ingredients are automatically deducted from inventory when the meal is marked "ready for delivery"')}
          </p>
        </DialogHeader>

        {/* Existing ingredients */}
        <div className="space-y-2">
          <Label className="text-sm font-bold">{t("المكوّنات الحالية", "Current ingredients")}</Label>
          {ingredients.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t("لا توجد مكوّنات مرتبطة", "No linked ingredients")}</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {ingredients.map((ing: any) => (
                <div
                  key={ing._id}
                  className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{(isRtl ? ing.inventoryItem?.nameAr : (ing.inventoryItem?.nameEn || ing.inventoryItem?.nameAr)) || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {t("المخزون الحالي:", "Current stock:")} {ing.inventoryItem?.currentStock || 0} {ing.inventoryItem?.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-700">
                      {ing.quantityPerServing} {ing.unit}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(ing._id)}
                      className="text-red-500 h-7 w-7"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-bold">{t("إضافة مكوّن جديد", "Add new ingredient")}</Label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  const item = inventoryItems.find((i: any) => i._id === e.target.value);
                  if (item) setUnit(item.unit);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t("اختر المكوّن", "Select ingredient")}</option>
                {inventoryItems.map((item: any) => (
                  <option key={item._id} value={item._id}>
                    {isRtl ? item.nameAr : (item.nameEn || item.nameAr)} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <Input
                type="number"
                step="0.01"
                placeholder={t("الكمية", "Quantity")}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input
                placeholder={t("الوحدة", "Unit")}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {t("إضافة المكوّن", "Add ingredient")}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("إغلاق", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
