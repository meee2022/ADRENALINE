/**
 * @file client/src/pages/PublicMealsManagement.tsx
 * @description إدارة وجبات الموقع العام (المنيو)
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import type { Id } from "@/../../convex/_generated/dataModel";
import { convex } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UtensilsCrossed, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/lib/i18n";

export default function PublicMealsManagement() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [formData, setFormData] = useState({
    nameAr: "",
    nameEn: "",
    slug: "",
    descriptionAr: "",
    descriptionEn: "",
    aboutAr: "",
    aboutEn: "",
    imageUrl: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    category: "lunch" as "breakfast" | "lunch" | "dinner" | "salad" | "snack",
    tags: "",
    ingredients: "",
    priceQAR: "",
    isActive: true,
    sortOrder: "999",
    // NEW: Scheduling
    weeks: [] as number[],
    days: [] as string[],
    cutoffTime: "18:00",
  });

  const meals = useQuery(api.publicMeals.list) || [];

  const handleAdd = () => {
    setSelectedMeal(null);
    setFormData({
      nameAr: "",
      nameEn: "",
      slug: "",
      descriptionAr: "",
      descriptionEn: "",
      aboutAr: "",
      aboutEn: "",
      imageUrl: "",
      calories: "",
      protein: "",
      carbs: "",
      fats: "",
      category: "lunch",
      tags: "",
      ingredients: "",
      priceQAR: "",
      isActive: true,
      sortOrder: "999",
      weeks: [],
      days: [],
      cutoffTime: "18:00",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (meal: any) => {
    setSelectedMeal(meal);
    setFormData({
      nameAr: meal.nameAr,
      nameEn: meal.nameEn || "",
      slug: meal.slug,
      descriptionAr: meal.descriptionAr || "",
      descriptionEn: meal.descriptionEn || "",
      aboutAr: meal.aboutAr || "",
      aboutEn: meal.aboutEn || "",
      imageUrl: meal.imageUrl,
      calories: meal.calories.toString(),
      protein: meal.protein.toString(),
      carbs: meal.carbs.toString(),
      fats: meal.fats.toString(),
      category: meal.category,
      tags: meal.tags?.join(", ") || "",
      ingredients: meal.ingredients?.join(", ") || "",
      priceQAR: meal.priceQAR.toString(),
      isActive: meal.isActive,
      sortOrder: meal.sortOrder.toString(),
      weeks: meal.weeks || [],
      days: meal.days || [],
      cutoffTime: meal.cutoffTime || "18:00",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("هل أنت متأكد من حذف هذه الوجبة؟", "Are you sure you want to delete this meal?"))) return;

    try {
      await convex.mutation(api.publicMeals.remove, { id: id as Id<"publicMeals">, sessionToken });
      toast({ title: t("تم الحذف", "Deleted"), description: t("تم حذف الوجبة بنجاح", "Meal deleted successfully") });
    } catch (error: any) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!formData.nameAr || !formData.slug || !formData.imageUrl) {
      toast({
        title: t("خطأ", "Error"),
        description: t("يرجى ملء الحقول المطلوبة (الاسم بالعربي، Slug، رابط الصورة)", "Please fill in the required fields (Arabic name, Slug, image URL)"),
        variant: "destructive",
      });
      return;
    }

    try {
      const data = {
        nameAr: formData.nameAr,
        nameEn: formData.nameEn || undefined,
        slug: formData.slug,
        descriptionAr: formData.descriptionAr || undefined,
        descriptionEn: formData.descriptionEn || undefined,
        aboutAr: formData.aboutAr || undefined,
        aboutEn: formData.aboutEn || undefined,
        imageUrl: formData.imageUrl,
        calories: parseInt(formData.calories) || 0,
        protein: parseInt(formData.protein) || 0,
        carbs: parseInt(formData.carbs) || 0,
        fats: parseInt(formData.fats) || 0,
        category: formData.category,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: formData.ingredients.split(",").map((i) => i.trim()).filter(Boolean),
        priceQAR: parseFloat(formData.priceQAR) || 0,
        sortOrder: parseInt(formData.sortOrder) || 999,
        isActive: formData.isActive,
        weeks: formData.weeks.length > 0 ? formData.weeks : undefined,
        days: formData.days.length > 0 ? formData.days : undefined,
        cutoffTime: formData.cutoffTime || undefined,
      };

      if (selectedMeal) {
        await convex.mutation(api.publicMeals.update, { id: selectedMeal._id, ...data, sessionToken });
        toast({ title: t("تم التحديث", "Updated"), description: t("تم تحديث الوجبة بنجاح", "Meal updated successfully") });
      } else {
        await convex.mutation(api.publicMeals.create, { ...data, sessionToken });
        toast({ title: t("تم الإضافة", "Added"), description: t("تم إضافة الوجبة بنجاح", "Meal added successfully") });
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      breakfast: t("إفطار", "Breakfast"),
      lunch: t("غداء", "Lunch"),
      dinner: t("عشاء", "Dinner"),
      salad: t("سلطة", "Salad"),
      snack: t("سناك", "Snack"),
    };
    return labels[cat] || cat;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <DashboardHeader
        icon={<UtensilsCrossed className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="إدارة المنيو العام" titleEn="Public Menu"
        subtitleAr="إدارة الوجبات الظاهرة في الموقع العام للعملاء" subtitleEn="Manage meals shown on the public site"
        actions={
          <Button onClick={handleAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
            <Plus className="h-5 w-5" />
            {t("إضافة وجبة جديدة", "Add New Meal")}
          </Button>
        }
        kpis={[
          { value: meals.length, labelAr: "إجمالي الوجبات", labelEn: "Total meals" },
          { value: meals.filter((m: any) => m.isActive).length, labelAr: "نشط", labelEn: "Active" },
        ]}
      />

      {/* Meals Table */}
      <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle>{t("الوجبات", "Meals")} ({meals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>{t("الصورة", "Image")}</TableHead>
                <TableHead>{t("الاسم", "Name")}</TableHead>
                <TableHead>{t("الفئة", "Category")}</TableHead>
                <TableHead>{t("السعرات", "Calories")}</TableHead>
                <TableHead>{t("السعر (QAR)", "Price (QAR)")}</TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
                <TableHead>{t("الإجراءات", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    {t('لا توجد وجبات. اضغط "إضافة وجبة جديدة" للبدء.', 'No meals yet. Click "Add New Meal" to get started.')}
                  </TableCell>
                </TableRow>
              ) : (
                meals.map((meal: any) => (
                  <TableRow key={meal._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                    <TableCell>
                      <img
                        src={meal.imageUrl}
                        alt={meal.nameAr}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(meal.category)}</Badge>
                    </TableCell>
                    <TableCell>{meal.calories} Cal</TableCell>
                    <TableCell>{meal.priceQAR} QAR</TableCell>
                    <TableCell>
                      <Badge className={`rounded-full ${meal.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {meal.isActive ? t("نشط", "Active") : t("غير نشط", "Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(meal)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(meal._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMeal ? t("تعديل الوجبة", "Edit Meal") : t("إضافة وجبة جديدة", "Add New Meal")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("الاسم بالعربي *", "Arabic Name *")}</Label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder={t("سلطة السلمون المشوي", "Grilled Salmon Salad")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("الاسم بالإنجليزي", "English Name")}</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Grilled Salmon Salad"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("Slug (للرابط) *", "Slug (for URL) *")}</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="grilled-salmon-salad"
                className="text-left"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">
                {t("سيظهر في الرابط: /meal/grilled-salmon-salad", "Appears in the URL: /meal/grilled-salmon-salad")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                {t("رابط الصورة *", "Image URL *")}
              </Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="text-left"
                dir="ltr"
              />
              {formData.imageUrl && (
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="h-32 w-full object-cover rounded-lg mt-2"
                />
              )}
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("وصف مختصر (عربي)", "Short description (Arabic)")}</Label>
                <Textarea
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  placeholder={t("وصف قصير يظهر في البطاقة", "Short description shown on the card")}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("وصف مختصر (إنجليزي)", "Short description (English)")}</Label>
                <Textarea
                  value={formData.descriptionEn}
                  onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                  placeholder="Short description for card"
                  rows={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("وصف تفصيلي (عربي)", "Detailed description (Arabic)")}</Label>
                <Textarea
                  value={formData.aboutAr}
                  onChange={(e) => setFormData({ ...formData, aboutAr: e.target.value })}
                  placeholder={t("وصف طويل يظهر في صفحة التفاصيل", "Long description shown on the details page")}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("وصف تفصيلي (إنجليزي)", "Detailed description (English)")}</Label>
                <Textarea
                  value={formData.aboutEn}
                  onChange={(e) => setFormData({ ...formData, aboutEn: e.target.value })}
                  placeholder="Long description for details page"
                  rows={3}
                />
              </div>
            </div>

            {/* Nutrition */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t("السعرات", "Calories")}</Label>
                <Input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  placeholder="450"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("البروتين (g)", "Protein (g)")}</Label>
                <Input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                  placeholder="35"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("الكربوهيدرات (g)", "Carbs (g)")}</Label>
                <Input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                  placeholder="20"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("الدهون (g)", "Fats (g)")}</Label>
                <Input
                  type="number"
                  value={formData.fats}
                  onChange={(e) => setFormData({ ...formData, fats: e.target.value })}
                  placeholder="15"
                />
              </div>
            </div>

            {/* Category & Price */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("الفئة", "Category")}</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="breakfast">{t("إفطار", "Breakfast")}</option>
                  <option value="lunch">{t("غداء", "Lunch")}</option>
                  <option value="dinner">{t("عشاء", "Dinner")}</option>
                  <option value="salad">{t("سلطة", "Salad")}</option>
                  <option value="snack">{t("سناك", "Snack")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("السعر (QAR)", "Price (QAR)")}</Label>
                <Input
                  type="number"
                  value={formData.priceQAR}
                  onChange={(e) => setFormData({ ...formData, priceQAR: e.target.value })}
                  placeholder="45.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ترتيب العرض", "Display order")}</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  placeholder="999"
                />
              </div>
            </div>

            {/* Tags & Ingredients */}
            <div className="space-y-2">
              <Label>{t("الوسوم (مفصولة بفاصلة)", "Tags (comma-separated)")}</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder={t("غني بالبروتين, قليل الكربوهيدرات, خالي من الغلوتين", "High protein, low carb, gluten-free")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("المكونات (مفصولة بفاصلة)", "Ingredients (comma-separated)")}</Label>
              <Textarea
                value={formData.ingredients}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                placeholder={t("سلمون مشوي, خس, طماطم, ليمون", "Grilled salmon, lettuce, tomato, lemon")}
                rows={2}
              />
            </div>

            {/* NEW: Scheduling Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-bold text-[#0F1516] mb-4">🔷 {t("جدولة الوجبة", "Meal Scheduling")}</h3>
              
              <div className="space-y-4">
                {/* Weeks */}
                <div>
                  <Label className="text-sm font-bold mb-2 block">{t("اختر الأسابيع", "Select weeks")}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((week) => (
                      <label key={week} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.weeks.includes(week)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, weeks: [...formData.weeks, week] });
                            } else {
                              setFormData({ ...formData, weeks: formData.weeks.filter((w) => w !== week) });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{t("الأسبوع", "Week")} {week}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Days */}
                <div>
                  <Label className="text-sm font-bold mb-2 block">{t("اختر الأيام", "Select days")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "saturday", label: t("السبت", "Saturday") },
                      { value: "sunday", label: t("الأحد", "Sunday") },
                      { value: "monday", label: t("الإثنين", "Monday") },
                      { value: "tuesday", label: t("الثلاثاء", "Tuesday") },
                      { value: "wednesday", label: t("الأربعاء", "Wednesday") },
                      { value: "thursday", label: t("الخميس", "Thursday") },
                      { value: "friday", label: t("الجمعة", "Friday") },
                    ].map((day) => (
                      <label key={day.value} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.days.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, days: [...formData.days, day.value] });
                            } else {
                              setFormData({ ...formData, days: formData.days.filter((d) => d !== day.value) });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Cutoff Time */}
                <div>
                  <Label htmlFor="cutoffTime">{t("وقت القفل", "Cutoff time")}</Label>
                  <Input
                    id="cutoffTime"
                    type="time"
                    value={formData.cutoffTime}
                    onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t("الوقت الذي يتم فيه قفل الاختيار", "The time at which selection is locked")}</p>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">{t("نشط (يظهر في الموقع)", "Active (shown on the site)")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button onClick={handleSave} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {selectedMeal ? t("تحديث", "Update") : t("إضافة", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
