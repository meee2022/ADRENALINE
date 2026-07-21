/**
 * @file client/src/pages/MenuManagement.tsx
 * @description صفحة إدارة الوجبات - إضافة وتعديل وحذف
 */
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { confirmDialog } from "@/lib/dialogs";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UtensilsCrossed, Download, Loader2, Boxes } from "lucide-react";
import { IngredientsDialog } from "@/components/IngredientsDialog";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import type { Id } from "@/../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";

export default function MenuManagement() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { t, dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ingredientsMeal, setIngredientsMeal] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    tags: "",
    isActive: true,
  });

  // ✅ Sync from publicMeals
  const syncFromPublicMutation = useMutation(api.menuItems.syncFromPublicMeals);

  const handleSyncFromPublic = async () => {
    if (!(await confirmDialog({ message: isRtl ? "هل تريد نسخ جميع الوجبات من قائمة الوجبات العامة للموقع؟\nسيتم تجاهل الوجبات الموجودة مسبقًا بالاسم نفسه." : "Copy all meals from the public website menu?\nMeals already existing with the same name will be skipped." }))) {
      return;
    }
    setIsSyncing(true);
    try {
      const result: any = await syncFromPublicMutation({});
      toast({
        title: isRtl ? "✅ تم النسخ" : "✅ Copied",
        description: result.message || (isRtl ? `تم إضافة ${result.created} وجبة` : `${result.created} meals added`),
      });
    } catch (error: any) {
      toast({
        title: isRtl ? "❌ فشل النسخ" : "❌ Copy failed",
        description: error?.message || (isRtl ? "حدث خطأ" : "An error occurred"),
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const meals = useQuery(api.menuItems.list, { sessionToken }) || [];
  const categories = useQuery(api.mealCategories.list, { sessionToken }) || [];

  const handleAdd = () => {
    setSelectedMeal(null);
    setFormData({ name: "", categoryId: "", calories: "", protein: "", carbs: "", fats: "", tags: "", isActive: true });
    setIsDialogOpen(true);
  };

  const handleEdit = (meal: any) => {
    setSelectedMeal(meal);
    setFormData({
      name: meal.name,
      categoryId: meal.categoryId,
      calories: meal.calories?.toString() || "",
      protein: meal.protein?.toString() || "",
      carbs: meal.carbs?.toString() || "",
      fats: meal.fats?.toString() || "",
      tags: meal.tags?.join(", ") || "",
      isActive: meal.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: t("menu_management.delete_confirm"), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;

    try {
      await convex.mutation(api.menuItems.remove, { id: id as Id<"menuItems">, sessionToken });
      toast({
        title: t("menu_management.delete_meal"),
        description: isRtl ? "تم حذف الوجبة بنجاح" : "Meal deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.categoryId) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "يرجى ملء الحقول المطلوبة" : "Please fill in the required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const protein = Number(formData.protein) || 0;
      const carbs = Number(formData.carbs) || 0;
      const fats = Number(formData.fats) || 0;
      const calculatedCalories = protein > 0 || carbs > 0 || fats > 0
        ? Math.round(protein * 4 + carbs * 4 + fats * 9)
        : (formData.calories ? parseInt(formData.calories) : undefined);
      const data = {
        name: formData.name,
        categoryId: formData.categoryId as Id<"mealCategories">,
        calories: calculatedCalories,
        protein: protein || undefined,
        carbs: carbs || undefined,
        fats: fats || undefined,
        macros: protein > 0 || carbs > 0 || fats > 0 ? `P:${protein}g C:${carbs}g F:${fats}g` : undefined,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : undefined,
        isActive: formData.isActive,
      };

      if (selectedMeal) {
        await convex.mutation(api.menuItems.update, { id: selectedMeal._id, ...data, sessionToken });
        toast({ title: isRtl ? "تم التحديث" : "Updated", description: isRtl ? "تم تحديث الوجبة بنجاح" : "Meal updated successfully" });
      } else {
        await convex.mutation(api.menuItems.create, { ...data, sessionToken });
        toast({ title: isRtl ? "تم الإضافة" : "Added", description: isRtl ? "تم إضافة الوجبة بنجاح" : "Meal added successfully" });
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c: any) => c._id === categoryId);
    return category?.name || categoryId;
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<UtensilsCrossed className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr={t("menu_management.title")} titleEn={t("menu_management.title")}
        subtitleAr={t("menu_management.subtitle")} subtitleEn={t("menu_management.subtitle")}
        actions={
          <>
            <Button
              onClick={handleSyncFromPublic}
              disabled={isSyncing}
              variant="outline"
              className="h-11 rounded-xl font-bold gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 text-sm"
            >
              {isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {isRtl ? "استيراد من قائمة وجبات الموقع" : "Import from website menu"}
            </Button>
            <Button onClick={handleAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
              <Plus className="h-5 w-5" />
              {t("menu_management.add_meal")}
            </Button>
          </>
        }
        kpis={[{ value: meals.length, labelAr: "إجمالي الوجبات", labelEn: "Total meals" }]}
      />

      <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            {t("menu_management.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>{t("menu_management.meal_name")}</TableHead>
                <TableHead>{t("menu_management.category")}</TableHead>
                <TableHead>{t("menu_management.calories")}</TableHead>
                <TableHead>{t("menu_management.status")}</TableHead>
                <TableHead className="text-center">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meals.map((meal: any) => (
                <TableRow key={meal._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                  <TableCell className="font-medium">{meal.name}</TableCell>
                  <TableCell>{getCategoryName(meal.categoryId)}</TableCell>
                  <TableCell>{meal.calories || "-"}</TableCell>
                  <TableCell>
                    <Badge className={`rounded-full ${meal.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {meal.isActive ? t("menu_management.active") : t("menu_management.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIngredientsMeal(meal)}
                        title={isRtl ? "مكوّنات المخزون" : "Inventory ingredients"}
                        className="text-[#47759c] hover:bg-[#eaf1f7]"
                      >
                        <Boxes className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(meal)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(meal._id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {selectedMeal ? t("menu_management.edit_title") : t("menu_management.add_title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("menu_management.meal_name")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isRtl ? "مثال: سلمون مشوي" : "e.g. Grilled salmon"}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("menu_management.category")}</Label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">{isRtl ? "اختر الفئة" : "Select category"}</option>
                {categories.map((cat: any) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>{t("menu_management.calories")}</Label>
              <Input
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                placeholder="450"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{isRtl ? "البروتين P" : "Protein P"}</Label>
                <Input type="number" min="0" step="1" value={formData.protein} onChange={(e) => setFormData({ ...formData, protein: e.target.value })} placeholder="40" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "الكربوهيدرات C" : "Carbs C"}</Label>
                <Input type="number" min="0" step="1" value={formData.carbs} onChange={(e) => setFormData({ ...formData, carbs: e.target.value })} placeholder="45" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "الدهون F" : "Fat F"}</Label>
                <Input type="number" min="0" step="1" value={formData.fats} onChange={(e) => setFormData({ ...formData, fats: e.target.value })} placeholder="15" dir="ltr" />
              </div>
            </div>
            {(Number(formData.protein) > 0 || Number(formData.carbs) > 0 || Number(formData.fats) > 0) && (
              <p className="rounded-md bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800" dir="ltr">
                {`P ${Number(formData.protein) || 0}g · C ${Number(formData.carbs) || 0}g · F ${Number(formData.fats) || 0}g = ${Math.round((Number(formData.protein) || 0) * 4 + (Number(formData.carbs) || 0) * 4 + (Number(formData.fats) || 0) * 9)} kcal`}
              </p>
            )}

            <div className="space-y-2">
              <Label>{t("menu_management.tags")}</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder={isRtl ? "عالي البروتين, قليل الدهون" : "High protein, low fat"}
              />
              <p className="text-xs text-muted-foreground">{isRtl ? "افصل بين الوسوم بفاصلة" : "Separate tags with a comma"}</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">{t("menu_management.active")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>{isRtl ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingredients dialog */}
      {ingredientsMeal && (
        <IngredientsDialog
          meal={ingredientsMeal}
          open={!!ingredientsMeal}
          onClose={() => setIngredientsMeal(null)}
        />
      )}
    </div>
  );
}
