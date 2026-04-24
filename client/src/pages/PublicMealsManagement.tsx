/**
 * @file client/src/pages/PublicMealsManagement.tsx
 * @description إدارة وجبات الموقع العام (المنيو)
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { convex } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UtensilsCrossed, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PublicMealsManagement() {
  const { toast } = useToast();

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
    if (!confirm("هل أنت متأكد من حذف هذه الوجبة؟")) return;

    try {
      await convex.mutation(api.publicMeals.remove, { id });
      toast({ title: "تم الحذف", description: "تم حذف الوجبة بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!formData.nameAr || !formData.slug || !formData.imageUrl) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الحقول المطلوبة (الاسم بالعربي، Slug، رابط الصورة)",
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
        await convex.mutation(api.publicMeals.update, { id: selectedMeal._id, ...data });
        toast({ title: "تم التحديث", description: "تم تحديث الوجبة بنجاح" });
      } else {
        await convex.mutation(api.publicMeals.create, data);
        toast({ title: "تم الإضافة", description: "تم إضافة الوجبة بنجاح" });
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      breakfast: "إفطار",
      lunch: "غداء",
      dinner: "عشاء",
      salad: "سلطة",
      snack: "سناك",
    };
    return labels[cat] || cat;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UtensilsCrossed className="h-8 w-8 text-[#3CC4F0]" />
            إدارة المنيو العام
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            إدارة الوجبات الظاهرة في الموقع العام للعملاء
          </p>
        </div>
        <Button onClick={handleAdd} size="lg" className="gap-2 bg-[#3CC4F0] hover:bg-[#2ab3df]">
          <Plus className="h-5 w-5" />
          إضافة وجبة جديدة
        </Button>
      </div>

      {/* Meals Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>الوجبات ({meals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>السعرات</TableHead>
                <TableHead>السعر (QAR)</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    لا توجد وجبات. اضغط "إضافة وجبة جديدة" للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                meals.map((meal: any) => (
                  <TableRow key={meal._id}>
                    <TableCell>
                      <img
                        src={meal.imageUrl}
                        alt={meal.nameAr}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{meal.nameAr}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(meal.category)}</Badge>
                    </TableCell>
                    <TableCell>{meal.calories} Cal</TableCell>
                    <TableCell>{meal.priceQAR} QAR</TableCell>
                    <TableCell>
                      <Badge variant={meal.isActive ? "default" : "secondary"}>
                        {meal.isActive ? "نشط" : "غير نشط"}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMeal ? "تعديل الوجبة" : "إضافة وجبة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربي *</Label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="سلطة السلمون المشوي"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزي</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Grilled Salmon Salad"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Slug (للرابط) *</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="grilled-salmon-salad"
                className="text-left"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">
                سيظهر في الرابط: /meal/grilled-salmon-salad
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                رابط الصورة *
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
                <Label>وصف مختصر (عربي)</Label>
                <Textarea
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  placeholder="وصف قصير يظهر في البطاقة"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>وصف مختصر (إنجليزي)</Label>
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
                <Label>وصف تفصيلي (عربي)</Label>
                <Textarea
                  value={formData.aboutAr}
                  onChange={(e) => setFormData({ ...formData, aboutAr: e.target.value })}
                  placeholder="وصف طويل يظهر في صفحة التفاصيل"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>وصف تفصيلي (إنجليزي)</Label>
                <Textarea
                  value={formData.aboutEn}
                  onChange={(e) => setFormData({ ...formData, aboutEn: e.target.value })}
                  placeholder="Long description for details page"
                  rows={3}
                />
              </div>
            </div>

            {/* Nutrition */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>السعرات</Label>
                <Input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  placeholder="450"
                />
              </div>
              <div className="space-y-2">
                <Label>البروتين (g)</Label>
                <Input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                  placeholder="35"
                />
              </div>
              <div className="space-y-2">
                <Label>الكربوهيدرات (g)</Label>
                <Input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                  placeholder="20"
                />
              </div>
              <div className="space-y-2">
                <Label>الدهون (g)</Label>
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
                <Label>الفئة</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="breakfast">إفطار</option>
                  <option value="lunch">غداء</option>
                  <option value="dinner">عشاء</option>
                  <option value="salad">سلطة</option>
                  <option value="snack">سناك</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>السعر (QAR)</Label>
                <Input
                  type="number"
                  value={formData.priceQAR}
                  onChange={(e) => setFormData({ ...formData, priceQAR: e.target.value })}
                  placeholder="45.00"
                />
              </div>
              <div className="space-y-2">
                <Label>ترتيب العرض</Label>
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
              <Label>الوسوم (مفصولة بفاصلة)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="غني بالبروتين, قليل الكربوهيدرات, خالي من الغلوتين"
              />
            </div>

            <div className="space-y-2">
              <Label>المكونات (مفصولة بفاصلة)</Label>
              <Textarea
                value={formData.ingredients}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                placeholder="سلمون مشوي, خس, طماطم, ليمون"
                rows={2}
              />
            </div>

            {/* NEW: Scheduling Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-bold text-[#0F1516] mb-4">🔷 جدولة الوجبة</h3>
              
              <div className="space-y-4">
                {/* Weeks */}
                <div>
                  <Label className="text-sm font-bold mb-2 block">اختر الأسابيع</Label>
                  <div className="grid grid-cols-4 gap-2">
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
                        <span className="text-sm">الأسبوع {week}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Days */}
                <div>
                  <Label className="text-sm font-bold mb-2 block">اختر الأيام</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "saturday", label: "السبت" },
                      { value: "sunday", label: "الأحد" },
                      { value: "monday", label: "الإثنين" },
                      { value: "tuesday", label: "الثلاثاء" },
                      { value: "wednesday", label: "الأربعاء" },
                      { value: "thursday", label: "الخميس" },
                      { value: "friday", label: "الجمعة" },
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
                  <Label htmlFor="cutoffTime">وقت القفل</Label>
                  <Input
                    id="cutoffTime"
                    type="time"
                    value={formData.cutoffTime}
                    onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">الوقت الذي يتم فيه قفل الاختيار</p>
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
              <Label htmlFor="isActive">نشط (يظهر في الموقع)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} className="bg-[#3CC4F0] hover:bg-[#2ab3df]">
              {selectedMeal ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
