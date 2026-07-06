/**
 * @file client/src/pages/PlansManagement.tsx
 * @description صفحة إدارة خطط الاشتراكات
 */
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Package, X, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import type { Id } from "@/../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";

interface PlanOption {
  meals: number;
  snacks: number;
  priceQAR: number;
}

export default function PlansManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار صورة فقط",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("فشل رفع الصورة");

      const { storageId } = await result.json();
      const imageUrl = await convex.query(api.files.getFileUrl, { storageId });

      if (imageUrl) {
        setFormData((prev) => ({ ...prev, imageUrl }));
        toast({
          title: "نجاح",
          description: "تم رفع الصورة وتحديث الرابط بنجاح",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء رفع الصورة",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [formData, setFormData] = useState({
    nameAr: "",
    nameEn: "",
    slug: "",
    descriptionAr: "",
    descriptionEn: "",
    imageUrl: "",
    duration: "week" as "week" | "two_weeks" | "month",
    options: [] as PlanOption[],
    features: [] as string[],
    badge: "none" as "none" | "most_requested" | "best_value" | "most_chosen_business" | "special_offer",
    isFeatured: false,
    showInComparison: false,
    isActive: true,
  });

  const plans = useQuery(api.publicPlans.list) || [];

  const handleAdd = () => {
    setSelectedPlan(null);
    setFormData({
      nameAr: "",
      nameEn: "",
      slug: "",
      descriptionAr: "",
      descriptionEn: "",
      imageUrl: "",
      duration: "week",
      options: [{ meals: 2, snacks: 2, priceQAR: 0 }],
      features: [],
      badge: "none",
      isFeatured: false,
      showInComparison: false,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setFormData({
      nameAr: plan.nameAr,
      nameEn: plan.nameEn || "",
      slug: plan.slug,
      descriptionAr: plan.descriptionAr || "",
      descriptionEn: plan.descriptionEn || "",
      imageUrl: plan.imageUrl,
      duration: plan.duration,
      // تحويل من mealsCount/snacksCount إلى meals/snacks للفورم
      options: (plan.options || []).map((opt: any) => ({
        meals: opt.mealsCount || opt.meals || 2,
        snacks: opt.snacksCount || opt.snacks || 2,
        priceQAR: opt.priceQAR || 0,
      })),
      features: plan.features || [],
      badge: plan.badge || "none",
      isFeatured: plan.isFeatured || false,
      showInComparison: plan.showInComparison || false,
      isActive: plan.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("plans_management.delete_confirm"))) return;

    try {
      await convex.mutation(api.publicPlans.remove, { id: id as Id<"publicPlans"> });
      toast({
        title: "تم الحذف",
        description: "تم حذف الخطة بنجاح",
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
    if (!formData.nameAr || !formData.slug || formData.options.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الحقول المطلوبة",
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
        imageUrl: formData.imageUrl,
        duration: formData.duration,
        options: formData.options.map(opt => ({
          mealsCount: opt.meals,
          snacksCount: opt.snacks,
          priceQAR: opt.priceQAR,
        })),
        features: formData.features.length > 0 ? formData.features : undefined,
        badge: formData.badge as any,
        isFeatured: formData.isFeatured,
        showInComparison: formData.showInComparison,
        isActive: formData.isActive,
      };

      if (selectedPlan) {
        await convex.mutation(api.publicPlans.update, { id: selectedPlan._id, ...data });
        toast({ title: "تم التحديث", description: "تم تحديث الخطة بنجاح" });
      } else {
        await convex.mutation(api.publicPlans.create, data);
        toast({ title: "تم الإضافة", description: "تم إضافة الخطة بنجاح" });
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

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { meals: 2, snacks: 2, priceQAR: 0 }],
    });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, field: keyof PlanOption, value: number) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  const addFeature = () => {
    const feature = prompt("أدخل الميزة:");
    if (feature) {
      setFormData({ ...formData, features: [...formData.features, feature] });
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<Package className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr={t("plans_management.title")} titleEn={t("plans_management.title")}
        subtitleAr={t("plans_management.subtitle")} subtitleEn={t("plans_management.subtitle")}
        actions={
          <Button onClick={handleAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
            <Plus className="h-5 w-5" />
            {t("plans_management.add_plan")}
          </Button>
        }
        kpis={[{ value: plans.length, labelAr: "إجمالي الباقات", labelEn: "Total plans" }]}
      />

      <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t("plans_management.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>اسم الخطة</TableHead>
                <TableHead>{t("plans_management.duration")}</TableHead>
                <TableHead>عدد الخيارات</TableHead>
                <TableHead>{t("menu_management.status")}</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan: any) => (
                <TableRow key={plan._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                  <TableCell className="font-medium">{plan.nameAr}</TableCell>
                  <TableCell>
                    {plan.duration === "week"
                      ? "أسبوعي"
                      : plan.duration === "two_weeks"
                      ? "أسبوعين"
                      : "شهري"}
                  </TableCell>
                  <TableCell>{plan.options?.length || 0}</TableCell>
                  <TableCell>
                    <Badge className={`rounded-full ${plan.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {plan.isActive ? t("menu_management.active") : t("menu_management.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(plan._id)}
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
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan ? t("plans_management.edit_plan") : t("plans_management.add_plan")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("plans_management.plan_name_ar")}</Label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="باقة التخسيس"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("plans_management.plan_name_en")}</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Diet Pack"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("plans_management.slug")}</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="diet-pack"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("plans_management.duration")}</Label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value as any })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="week">أسبوعي</option>
                  <option value="two_weeks">أسبوعين</option>
                  <option value="month">شهري</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("plans_management.image_url")}</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  dir="ltr"
                  className="flex-1"
                />
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="plan-image-upload"
                    disabled={isUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("plan-image-upload")?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isUploading ? "جاري الرفع..." : "رفع صورة"}
                  </Button>
                </div>
              </div>
              {formData.imageUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 h-28 w-44 bg-slate-50">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("plans_management.description_ar")}</Label>
              <Textarea
                value={formData.descriptionAr}
                onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("plans_management.description_en")}</Label>
              <Textarea
                value={formData.descriptionEn}
                onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                rows={2}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("plans_management.options")}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("plans_management.add_option")}
                </Button>
              </div>
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Input
                    type="number"
                    value={option.meals}
                    onChange={(e) =>
                      updateOption(index, "meals", parseInt(e.target.value) || 0)
                    }
                    placeholder="وجبات"
                    className="w-20"
                  />
                  <span className="text-sm">وجبات</span>
                  <Input
                    type="number"
                    value={option.snacks}
                    onChange={(e) =>
                      updateOption(index, "snacks", parseInt(e.target.value) || 0)
                    }
                    placeholder="سناكات"
                    className="w-20"
                  />
                  <span className="text-sm">سناكات</span>
                  <Input
                    type="number"
                    value={option.priceQAR}
                    onChange={(e) =>
                      updateOption(index, "priceQAR", parseInt(e.target.value) || 0)
                    }
                    placeholder="السعر"
                    className="w-24"
                  />
                  <span className="text-sm">ريال</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOption(index)}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("plans_management.features")}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addFeature}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("plans_management.add_feature")}
                </Button>
              </div>
              {formData.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="flex-1 text-sm">{feature}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFeature(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Marketing Fields */}
            <div className="space-y-4 border-t pt-4 mt-4">
              <h3 className="font-bold text-sm text-gray-700">خيارات التسويق</h3>
              
              {/* Badge Selector */}
              <div className="space-y-2">
                <Label>تمييز الخطة</Label>
                <select
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value as any })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="none">بدون تمييز</option>
                  <option value="most_requested">الأكثر طلبًا</option>
                  <option value="best_value">الأفضل قيمة</option>
                  <option value="most_chosen_business">الأكثر اختيارًا للشركات</option>
                  <option value="special_offer">عرض خاص</option>
                </select>
              </div>

              {/* Featured Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isFeatured" className="font-normal">
                  إبراز هذه الخطة (تكبير الكارت وإبرازه في الواجهة)
                </Label>
              </div>

              {/* Show in Comparison Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showInComparison"
                  checked={formData.showInComparison}
                  onChange={(e) => setFormData({ ...formData, showInComparison: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="showInComparison" className="font-normal">
                  عرض في جدول المقارنة
                </Label>
              </div>
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
    </div>
  );
}
