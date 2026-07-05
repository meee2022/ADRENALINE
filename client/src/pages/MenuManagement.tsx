/**
 * @file client/src/pages/MenuManagement.tsx
 * @description صفحة إدارة الوجبات - إضافة وتعديل وحذف
 */
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
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
import { useQuery, useMutation } from "convex/react";

export default function MenuManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ingredientsMeal, setIngredientsMeal] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    calories: "",
    macros: "",
    tags: "",
    isActive: true,
  });

  // ✅ Sync from publicMeals
  const syncFromPublicMutation = useMutation(api.menuItems.syncFromPublicMeals);

  const handleSyncFromPublic = async () => {
    if (!window.confirm("هل تريد نسخ كل الوجبات من منيو الموقع العام؟\nسيتم تجاهل الوجبات الموجودة مسبقاً بنفس الاسم.")) {
      return;
    }
    setIsSyncing(true);
    try {
      const result: any = await syncFromPublicMutation({});
      toast({
        title: "✅ تم النسخ",
        description: result.message || `تم إضافة ${result.created} وجبة`,
      });
    } catch (error: any) {
      toast({
        title: "❌ فشل النسخ",
        description: error?.message || "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const meals = useQuery(api.menuItems.list) || [];
  const categories = useQuery(api.mealCategories.list) || [];

  const handleAdd = () => {
    setSelectedMeal(null);
    setFormData({ name: "", categoryId: "", calories: "", macros: "", tags: "", isActive: true });
    setIsDialogOpen(true);
  };

  const handleEdit = (meal: any) => {
    setSelectedMeal(meal);
    setFormData({
      name: meal.name,
      categoryId: meal.categoryId,
      calories: meal.calories?.toString() || "",
      macros: meal.macros || "",
      tags: meal.tags?.join(", ") || "",
      isActive: meal.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("menu_management.delete_confirm"))) return;

    try {
      await convex.mutation(api.menuItems.remove, { id });
      toast({
        title: t("menu_management.delete_meal"),
        description: "تم حذف الوجبة بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.categoryId) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = {
        name: formData.name,
        categoryId: formData.categoryId,
        calories: formData.calories ? parseInt(formData.calories) : undefined,
        macros: formData.macros || undefined,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : undefined,
        isActive: formData.isActive,
      };

      if (selectedMeal) {
        await convex.mutation(api.menuItems.update, { id: selectedMeal._id, ...data });
        toast({ title: "تم التحديث", description: "تم تحديث الوجبة بنجاح" });
      } else {
        await convex.mutation(api.menuItems.create, data);
        toast({ title: "تم الإضافة", description: "تم إضافة الوجبة بنجاح" });
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
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
              استيراد من منيو الموقع
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
                <TableHead className="text-center">الإجراءات</TableHead>
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
                        title="مكوّنات المخزون"
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
                placeholder="مثال: سلمون مشوي"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("menu_management.category")}</Label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">اختر الفئة</option>
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

            <div className="space-y-2">
              <Label>{t("menu_management.macros")}</Label>
              <Input
                value={formData.macros}
                onChange={(e) => setFormData({ ...formData, macros: e.target.value })}
                placeholder="P:35g C:40g F:15g"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("menu_management.tags")}</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="عالي البروتين, قليل الدهون"
              />
              <p className="text-xs text-muted-foreground">افصل بين الوسوم بفاصلة</p>
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
              إلغاء
            </Button>
            <Button onClick={handleSave}>حفظ</Button>
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
