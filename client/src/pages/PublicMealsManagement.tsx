/**
 * @file client/src/pages/PublicMealsManagement.tsx
 * @description إدارة وجبات الموقع العام (المنيو)
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import type { Id } from "@/../../convex/_generated/dataModel";
import { convex } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { confirmDialog } from "@/lib/dialogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UtensilsCrossed, Image, UsersRound, ShoppingBag, Store, Search, SlidersHorizontal, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/lib/i18n";
import { IngredientsDialog } from "@/components/IngredientsDialog";

export default function PublicMealsManagement() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [recipeMeal, setRecipeMeal] = useState<any>(null);
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [mealSearch, setMealSearch] = useState("");
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
    costQAR: "",
    subscriberEnabled: true,
    onlineEnabled: false,
    onlinePrice: "",
    isActive: true,
    sortOrder: "999",
    // ✅ الجدولة الدقيقة: أزواج (دورة+يوم) — نفس ما يقرؤه المنيو الحي (schedule[]).
    //    نخزّنها كمفاتيح "week:day" لسهولة التبديل، ونحوّلها عند الحفظ.
    schedule: [] as string[],
    cutoffTime: "18:00",
  });

  const meals = useQuery(api.publicMeals.list, sessionToken ? { sessionToken } : {}) || [];
  const onlineItems = useQuery(api.posAdmin.listItemsForAdmin, sessionToken ? { sessionToken } : "skip") || [];
  const outlets = useQuery(api.gymSales.listGyms, sessionToken ? { sessionToken } : "skip") || [];
  const selectedOutletId = catalogFilter.startsWith("outlet:") ? catalogFilter.slice(7) : "";
  const selectedOutletItems = useQuery(
    api.gymSales.listOutletCatalogAdmin,
    selectedOutletId ? { outletId: selectedOutletId as Id<"gymAccounts">, sessionToken } : "skip",
  ) || [];
  const onlineByMeal = new Map((onlineItems as any[]).map((item: any) => [String(item.id), item]));
  const selectedOutletByMeal = new Map((selectedOutletItems as any[]).map((item: any) => [String(item.id), item]));
  const selectedOutlet = (outlets as any[]).find((outlet: any) => String(outlet.id) === selectedOutletId);
  const filteredMeals = useMemo(() => {
    const query = mealSearch.trim().toLocaleLowerCase();
    return (meals as any[]).filter((meal: any) => {
      const onlineItem: any = onlineByMeal.get(String(meal._id));
      const subscriberOn = !meal.isOnlineOnly && !meal.isGymOnly;
      const onlineOn = onlineItem?.posPrice != null && !onlineItem?.isHidden;
      const outletOn = !!selectedOutletByMeal.get(String(meal._id))?.isEnabled;

      if (catalogFilter === "subscribers" && !subscriberOn) return false;
      if (catalogFilter === "online" && !onlineOn) return false;
      if (selectedOutletId && !outletOn) return false;
      if (!query) return true;
      return [meal.nameAr, meal.nameEn, meal.slug, meal.category]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
  }, [catalogFilter, mealSearch, meals, onlineItems, selectedOutletId, selectedOutletItems]);

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
      costQAR: "",
      subscriberEnabled: true,
      onlineEnabled: false,
      onlinePrice: "",
      isActive: true,
      sortOrder: "999",
      schedule: [],
      cutoffTime: "18:00",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (meal: any) => {
    const onlineItem: any = onlineByMeal.get(String(meal._id));
    const hasOnlinePrice = onlineItem?.posPrice != null && Number.isFinite(Number(onlineItem.posPrice));
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
      costQAR: meal.costQAR != null ? String(meal.costQAR) : "",
      subscriberEnabled: !meal.isOnlineOnly && !meal.isGymOnly,
      onlineEnabled: hasOnlinePrice && !onlineItem?.isHidden,
      onlinePrice: hasOnlinePrice ? String(onlineItem.posPrice) : "",
      isActive: meal.isActive,
      sortOrder: meal.sortOrder.toString(),
      // ✅ نحمّل الجدولة الدقيقة. لو الوجبة قديمة (weeks/days فقط) نحوّلها لأزواج.
      schedule: Array.isArray(meal.schedule) && meal.schedule.length
        ? meal.schedule.map((s: any) => `${s.week}:${String(s.day).toLowerCase()}`)
        : ((meal.weeks || []) as number[]).flatMap((w: number) =>
            ((meal.days || []) as string[]).map((d: string) => `${w}:${String(d).toLowerCase()}`)),
      cutoffTime: meal.cutoffTime || "18:00",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: t("تأكيد الحذف", "Confirm Delete"),
      message: t("هل أنت متأكد من حذف هذه الوجبة؟", "Are you sure you want to delete this meal?"),
      variant: "danger",
      confirmText: t("حذف", "Delete"),
    }))) return;

    try {
      await convex.mutation(api.publicMeals.remove, { id: id as Id<"publicMeals">, sessionToken });
      toast({ title: t("تم الحذف", "Deleted"), description: t("تم حذف الوجبة بنجاح", "Meal deleted successfully") });
    } catch (error: any) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    const isExistingOutletOnly = !!selectedMeal?.isGymOnly;
    if (!formData.nameAr || !formData.slug || !formData.imageUrl) {
      toast({
        title: t("خطأ", "Error"),
        description: t("يرجى ملء الحقول المطلوبة (الاسم بالعربي، Slug، رابط الصورة)", "Please fill in the required fields (Arabic name, Slug, image URL)"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.subscriberEnabled && !formData.onlineEnabled && !isExistingOutletOnly) {
      toast({
        title: t("اختر قناة ظهور", "Choose a channel"),
        description: t("فعّل منيو المشتركين أو الأونلاين على الأقل.", "Enable at least the subscriber menu or online POS."),
        variant: "destructive",
      });
      return;
    }

    const parsedOnlinePrice = Number(formData.onlinePrice);
    if (formData.onlineEnabled && (formData.onlinePrice.trim() === "" || !Number.isFinite(parsedOnlinePrice) || parsedOnlinePrice < 0)) {
      toast({
        title: t("سعر الأونلاين مطلوب", "Online price is required"),
        description: t("اكتب سعراً صحيحاً لقناة الأونلاين.", "Enter a valid price for the online channel."),
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
        costQAR: formData.costQAR ? parseFloat(formData.costQAR) : undefined,
        sortOrder: parseInt(formData.sortOrder) || 999,
        isActive: formData.isActive,
        // Preserve legacy outlet-only isolation; this screen never changes an
        // outlet catalogue assignment.
        isOnlineOnly: formData.subscriberEnabled ? false : (isExistingOutletOnly ? !!selectedMeal?.isOnlineOnly : true),
        // ✅ نكتب الجدولة الدقيقة (schedule[]) — هي اللي المنيو الحي بيقرأها.
        //    ونصفّر weeks/days القديمة كي لا تتعارض (schedule له الأولوية دائماً).
        schedule: (formData.subscriberEnabled ? formData.schedule : []).map((k) => {
          const [w, d] = k.split(":");
          return { week: Number(w), day: d };
        }),
        weeks: [],
        days: [],
        cutoffTime: formData.cutoffTime || undefined,
      };

      let mealId: Id<"publicMeals">;
      if (selectedMeal) {
        await convex.mutation(api.publicMeals.update, { id: selectedMeal._id, ...data, sessionToken });
        mealId = selectedMeal._id;
        toast({ title: t("تم التحديث", "Updated"), description: t("تم تحديث الوجبة بنجاح", "Meal updated successfully") });
      } else {
        mealId = await convex.mutation(api.publicMeals.create, { ...data, sessionToken });
        toast({ title: t("تم الإضافة", "Added"), description: t("تم إضافة الوجبة بنجاح", "Meal added successfully") });
      }

      const existingOnline: any = onlineByMeal.get(String(mealId));
      if (formData.onlineEnabled) {
        await convex.mutation(api.posAdmin.upsertItemMeta, {
          mealId,
          posPrice: parsedOnlinePrice,
          isHidden: false,
          sessionToken,
        });
      } else if (existingOnline?.metaId) {
        // Preserve the online price so the item can be re-enabled later.
        await convex.mutation(api.posAdmin.upsertItemMeta, { mealId, isHidden: true, sessionToken });
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
        <CardHeader className="gap-4 border-b border-slate-100 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{t("الوجبات", "Meals")}</CardTitle>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {t("اعرض الوجبات حسب قناة البيع دون تغيير إعداداتها", "Filter meals by sales channel without changing their settings")}
              </p>
            </div>
            <Badge className="rounded-full border-0 bg-cyan-50 px-3 py-1 text-cyan-700">
              {filteredMeals.length} {t("نتيجة", "results")}
            </Badge>
          </div>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1.2fr)]">
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E76AC]" />
              <select
                value={catalogFilter}
                onChange={(event) => setCatalogFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#3CC4F0] focus:ring-2 focus:ring-[#3CC4F0]/15"
                aria-label={t("تصفية حسب القناة أو المنفذ", "Filter by channel or outlet")}
              >
                <option value="all">{t("كل الوجبات وكل القنوات", "All meals and channels")}</option>
                <option value="subscribers">{t("منيو المشتركين", "Subscriber menu")}</option>
                <option value="online">{t("الأونلاين والتوصيل", "Online and delivery")}</option>
                {(outlets as any[]).length > 0 && (
                  <optgroup label={t("المنافذ", "Outlets")}>
                    {(outlets as any[]).map((outlet: any) => (
                      <option key={outlet.id} value={`outlet:${outlet.id}`}>
                        {outlet.name}{outlet.isActive ? "" : ` (${t("متوقف", "Inactive")})`}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={mealSearch}
                onChange={(event) => setMealSearch(event.target.value)}
                placeholder={t("ابحث بالاسم أو التصنيف...", "Search by name or category...")}
                className="h-11 border-slate-200 bg-white ps-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table className="mobile-card-table">
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>{t("الصورة", "Image")}</TableHead>
                <TableHead>{t("الاسم", "Name")}</TableHead>
                <TableHead>{t("الفئة", "Category")}</TableHead>
                <TableHead>{t("السعرات", "Calories")}</TableHead>
                <TableHead>{selectedOutletId ? t("سعر المنفذ (QAR)", "Outlet price (QAR)") : t("السعر (QAR)", "Price (QAR)")}</TableHead>
                <TableHead>{t("قنوات الظهور", "Channels")}</TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
                <TableHead>{t("الإجراءات", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500">
                    {meals.length === 0
                      ? t('لا توجد وجبات. اضغط "إضافة وجبة جديدة" للبدء.', 'No meals yet. Click "Add New Meal" to get started.')
                      : t("لا توجد وجبات مطابقة لهذا الفلتر.", "No meals match this filter.")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMeals.map((meal: any) => (
                  <TableRow key={meal._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                    <TableCell data-mobile-label={t("الصورة", "Image")}>
                      <img
                        src={meal.imageUrl}
                        alt={meal.nameAr}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    </TableCell>
                    <TableCell data-mobile-label={t("الاسم", "Name")} className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr)}</span>
                        {(() => {
                          // 🏷️ لأي قناة الوجبة؟ (مشترك/منفذ/أونلاين) — عشان تفرّقهم بلمحة
                          const ch = meal.isGymOnly
                            ? { l: t("منفذ · كافيه", "Outlet · Cafe"), c: "bg-amber-100 text-amber-700" }
                            : meal.isOnlineOnly
                              ? { l: t("أونلاين", "Online"), c: "bg-violet-100 text-violet-700" }
                              : { l: t("مشترك", "Subscriber"), c: "bg-cyan-100 text-cyan-700" };
                          const sub = !meal.isGymOnly && !meal.isOnlineOnly;
                          const noSched = sub && !(Array.isArray(meal.schedule) && meal.schedule.length);
                          return (
                            <span className="flex flex-wrap gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${ch.c}`}>{ch.l}</span>
                              {noSched && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t("غير مجدول", "Unscheduled")}</span>}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell data-mobile-label={t("الفئة", "Category")}>
                      <Badge variant="outline">{getCategoryLabel(meal.category)}</Badge>
                    </TableCell>
                    <TableCell data-mobile-label={t("السعرات", "Calories")}>{meal.calories} Cal</TableCell>
                    <TableCell data-mobile-label={selectedOutletId ? t("سعر المنفذ", "Outlet price") : t("السعر", "Price")}>
                      {selectedOutletId ? selectedOutletByMeal.get(String(meal._id))?.outletPrice : meal.priceQAR} QAR
                    </TableCell>
                    <TableCell data-mobile-label={t("قنوات الظهور", "Channels")}>
                      {(() => {
                        const onlineItem: any = onlineByMeal.get(String(meal._id));
                        const onlineOn = onlineItem?.posPrice != null && !onlineItem?.isHidden;
                        const subscriberOn = !meal.isOnlineOnly && !meal.isGymOnly;
                        const outletOn = selectedOutletId
                          ? !!selectedOutletByMeal.get(String(meal._id))?.isEnabled
                          : !!meal.isGymOnly || !!meal.isGymItem;
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {subscriberOn && <Badge className="gap-1 border-0 bg-cyan-50 text-cyan-700"><UsersRound className="h-3 w-3" />{t("مشتركين", "Subscribers")}</Badge>}
                            {onlineOn && <Badge className="gap-1 border-0 bg-violet-50 text-violet-700"><ShoppingBag className="h-3 w-3" />{t("أونلاين", "Online")}</Badge>}
                            {outletOn && <Badge className="gap-1 border-0 bg-amber-50 text-amber-700"><Store className="h-3 w-3" />{selectedOutlet?.name || t("منافذ", "Outlets")}</Badge>}
                            {!subscriberOn && !onlineOn && !outletOn && <span className="text-xs text-slate-400">{t("غير مضاف لقناة", "No channel")}</span>}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell data-mobile-label={t("الحالة", "Status")}>
                      <Badge className={`rounded-full ${meal.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {meal.isActive ? t("نشط", "Active") : t("غير نشط", "Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell data-mobile-label={t("الإجراءات", "Actions")}>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRecipeMeal(meal)}
                          title={t("وصفة المخزون", "Inventory recipe")}
                          className="text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        >
                          <Boxes className="h-4 w-4" />
                        </Button>
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

      {recipeMeal && (
        <IngredientsDialog
          meal={recipeMeal}
          catalog="public"
          open={!!recipeMeal}
          onClose={() => setRecipeMeal(null)}
        />
      )}

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
                <Label>{t("التكلفة (QAR) — لتقارير الربحية", "Cost (QAR) — for profit reports")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costQAR}
                  onChange={(e) => setFormData({ ...formData, costQAR: e.target.value })}
                  placeholder="15.00"
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

            {/* Channels are independent: online pricing never schedules a subscriber meal. */}
            <div className="mt-6 space-y-3 border-t border-gray-200 pt-6">
              <div>
                <h3 className="text-lg font-bold text-[#0F1516]">{t("قنوات ظهور الوجبة", "Meal channels")}</h3>
                <p className="mt-1 text-xs text-slate-500">{t("اختيار الأونلاين لا يضيف الوجبة إلى دورة المشتركين، وسعره مستقل عن سعر المنيو العام.", "Online availability does not add the meal to the subscriber rotation, and its price is independent from the public menu price.")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, subscriberEnabled: !f.subscriberEnabled }))}
                  className={`flex min-h-[86px] items-center gap-3 rounded-xl border p-4 text-start transition-colors ${formData.subscriberEnabled ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${formData.subscriberEnabled ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}><UsersRound className="h-5 w-5" /></span>
                  <span><strong className="block text-sm text-slate-900">{t("منيو المشتركين", "Subscriber menu")}</strong><small className="mt-1 block text-xs text-slate-500">{t("تدخل في دورة الأيام والأسابيع المحددة بالأسفل", "Uses the day and cycle schedule below")}</small></span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, onlineEnabled: !f.onlineEnabled }))}
                  className={`flex min-h-[86px] items-center gap-3 rounded-xl border p-4 text-start transition-colors ${formData.onlineEnabled ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${formData.onlineEnabled ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500"}`}><ShoppingBag className="h-5 w-5" /></span>
                  <span><strong className="block text-sm text-slate-900">{t("POS الأونلاين والتوصيل", "Online & delivery POS")}</strong><small className="mt-1 block text-xs text-slate-500">{t("تظهر للكاشير بسعر أونلاين مستقل", "Shown to the cashier with a separate online price")}</small></span>
                </button>
              </div>

              {formData.onlineEnabled && (
                <div className="max-w-sm space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                  <Label htmlFor="onlinePrice">{t("سعر الأونلاين (ر.ق)", "Online price (QAR)")}</Label>
                  <Input id="onlinePrice" type="number" min="0" step="0.01" value={formData.onlinePrice} onChange={(e) => setFormData({ ...formData, onlinePrice: e.target.value })} className="bg-white" placeholder="45.00" />
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <Store className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("المنافذ لا تُفعّل من هنا لأن لكل منفذ قائمته وسعره. استخدم مبيعات المنافذ ← أصناف المنافذ.", "Outlets are managed separately because each outlet has its own catalogue and price. Use Outlet Sales → Outlet Items.")}</span>
              </div>
            </div>

            {/* NEW: Scheduling Section */}
            {formData.subscriberEnabled && <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-bold text-[#0F1516] mb-4">🔷 {t("جدولة الوجبة", "Meal Scheduling")}</h3>
              
              <div className="space-y-4">
                {/* ✅ شبكة دقيقة: اختر بالظبط في أي (دورة + يوم) تظهر الوجبة.
                    كل خانة مؤشّرة = زوج (دورة+يوم) في المنيو الحي. الجمعة غير موجودة (لا توصيل). */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-bold">{t("متى تظهر الوجبة؟ (الدورة × اليوم)", "When does it show? (Cycle × Day)")}</Label>
                    <span className="text-xs font-bold text-[#0E76AC]">{formData.schedule.length} {t("خانة", "slots")}</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[520px] text-center text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-2 text-start">{t("الدورة", "Cycle")}</th>
                          {[
                            { v: "saturday", l: t("السبت", "Sat") },
                            { v: "sunday", l: t("الأحد", "Sun") },
                            { v: "monday", l: t("الإثنين", "Mon") },
                            { v: "tuesday", l: t("الثلاثاء", "Tue") },
                            { v: "wednesday", l: t("الأربعاء", "Wed") },
                            { v: "thursday", l: t("الخميس", "Thu") },
                          ].map((d) => <th key={d.v} className="p-2">{d.l}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4].map((wk) => (
                          <tr key={wk} className="border-t border-slate-100">
                            <td className="p-2 text-start font-bold text-slate-700">{t("دورة", "Cycle")} {wk}</td>
                            {["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"].map((day) => {
                              const key = `${wk}:${day}`;
                              const on = formData.schedule.includes(key);
                              return (
                                <td key={day} className="p-1">
                                  <button
                                    type="button"
                                    onClick={() => setFormData((f) => ({
                                      ...f,
                                      schedule: on ? f.schedule.filter((k) => k !== key) : [...f.schedule, key],
                                    }))}
                                    className={`h-8 w-8 rounded-md border-2 font-black transition-colors ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-transparent hover:border-emerald-300"}`}
                                    aria-label={`${t("دورة", "Cycle")} ${wk} · ${day}`}
                                  >✓</button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{t("اضغط الخانة لتفعيل/إلغاء ظهور الوجبة في تلك الدورة واليوم.", "Tap a cell to toggle the meal on that cycle & day.")}</p>
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
            </div>}

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">{t("نشط في القنوات المحددة", "Active in selected channels")}</Label>
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
