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
  const ingredients = useQuery(api.mealIngredients.listByMeal, { menuItemId: meal._id, sessionToken }) || [];
  const inventoryItems = useQuery(api.inventory.listItems, {}) || [];

  const createMutation = useMutation(api.mealIngredients.create);
  const removeMutation = useMutation(api.mealIngredients.remove);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const handleAdd = async () => {
    if (!selectedItemId || !quantity) {
      toast({ title: "خطأ", description: "اختر مكوّن وحدد الكمية", variant: "destructive" });
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
      toast({ title: "تم الإضافة", description: "تم ربط المكوّن بالوجبة" });
      setSelectedItemId("");
      setQuantity("");
      setUnit("");
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("حذف هذا المكوّن من الوجبة؟")) return;
    await removeMutation({ id: id as any, sessionToken });
    toast({ title: "تم الحذف" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-amber-600" />
            مكوّنات: {meal.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            هذه المكوّنات تُخصم تلقائياً من المخزون عند تعليم الوجبة كـ "جاهزة للتوصيل"
          </p>
        </DialogHeader>

        {/* Existing ingredients */}
        <div className="space-y-2">
          <Label className="text-sm font-bold">المكوّنات الحالية</Label>
          {ingredients.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">لا توجد مكوّنات مرتبطة</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {ingredients.map((ing: any) => (
                <div
                  key={ing._id}
                  className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ing.inventoryItem?.nameAr || "—"}</p>
                    <p className="text-xs text-slate-500">
                      المخزون الحالي: {ing.inventoryItem?.currentStock || 0} {ing.inventoryItem?.unit}
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
          <Label className="text-sm font-bold">إضافة مكوّن جديد</Label>
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
                <option value="">اختر المكوّن</option>
                {inventoryItems.map((item: any) => (
                  <option key={item._id} value={item._id}>
                    {item.nameAr} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <Input
                type="number"
                step="0.01"
                placeholder="الكمية"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input
                placeholder="الوحدة"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAdd} size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            إضافة المكوّن
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
