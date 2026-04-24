/**
 * @file client/src/pages/public/PublicMenu.tsx
 * @description صفحة المنيو للموقع العام - مع نظام جدولة الأسابيع والأيام
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePublicMeals } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, X, Clock, Lock, ShoppingCart, Plus, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cartStore";

type Category = "all" | "breakfast" | "lunch" | "dinner" | "salad" | "snack";
// ✅ أيام العمل فقط (السبت-الأربعاء) - الخميس والجمعة إجازة
type DayOfWeek = "saturday" | "sunday" | "monday" | "tuesday" | "wednesday";

export default function PublicMenuPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [, setLocation] = useLocation();
  
  // Cart State
  const { items, addItem, getTotalMeals } = useCartStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  
  // NEW: Week & Day selection
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  
  // Handle adding meal to cart
  const handleAddToCart = (meal: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (!selectedDay) {
      alert(isRtl ? "يرجى اختيار اليوم أولاً" : "Please select a day first");
      return;
    }
    
    // ✅ تم تعطيل فحص isLocked - الطلبات مفتوحة دائماً
    // if (isLocked) {
    //   alert(isRtl ? "انتهى وقت الطلب لهذا اليوم" : "Order time has ended for this day");
    //   return;
    // }
    
    addItem({
      _id: meal._id,
      nameAr: meal.nameAr,
      nameEn: meal.nameEn || "",
      category: meal.category,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
      imageUrl: meal.imageUrl,
      priceQAR: meal.priceQAR || 45,
      week: selectedWeek,
      day: selectedDay,
    });
  };
  
  // Check if meal is already in cart
  const isInCart = (mealId: string) => {
    if (!selectedDay) return false;
    return items.some(
      (item) => item._id === mealId && item.week === selectedWeek && item.day === selectedDay
    );
  };

  const { data: allMeals = [] } = usePublicMeals({
    category: activeCategory,
    search: searchQuery,
  });

  // Filter meals by selected week and day
  const filteredMeals = allMeals.filter((meal: any) => {
    // If meal has no schedule (weeks/days), show it by default
    if (!meal.weeks || meal.weeks.length === 0) {
      if (!meal.days || meal.days.length === 0) {
        return true; // Show meals without any schedule
      }
    }

    // If week/day are selected, filter strictly
    if (selectedDay) {
      // BOTH week AND day must match
      const hasWeek = meal.weeks && meal.weeks.includes(selectedWeek);
      const hasDay = meal.days && meal.days.includes(selectedDay);
      return hasWeek && hasDay;
    } else {
      // Only week is selected
      return meal.weeks && meal.weeks.includes(selectedWeek);
    }
  });

  const meals = filteredMeals;

  // Countdown timer logic - DISABLED (always allow ordering)
  useEffect(() => {
    // ✅ تعطيل نظام قفل الوقت بالكامل - الطلبات مفتوحة دائماً
    setIsLocked(false);
    setTimeRemaining("");
    
    // الكود القديم (معطل):
    // if (!selectedDay) {
    //   setIsLocked(false);
    //   setTimeRemaining("");
    //   return;
    // }
    // const cutoffTime = "18:00";
    // const updateCountdown = () => { ... }
  }, [selectedDay]);

  const categories = [
    { id: "all" as Category, labelAr: "الكل", labelEn: "All" },
    { id: "breakfast" as Category, labelAr: "الإفطار", labelEn: "Breakfast" },
    { id: "lunch" as Category, labelAr: "الغداء", labelEn: "Lunch" },
    { id: "dinner" as Category, labelAr: "العشاء", labelEn: "Dinner" },
    { id: "salad" as Category, labelAr: "سلطات", labelEn: "Salads" },
    { id: "snack" as Category, labelAr: "سناكس", labelEn: "Snacks" },
  ];

  const weeks = [
    { value: 1, label: "الأسبوع 1" },
    { value: 2, label: "الأسبوع 2" },
    { value: 3, label: "الأسبوع 3" },
    { value: 4, label: "الأسبوع 4" },
  ];

  const days: { value: DayOfWeek; label: string }[] = [
    { value: "saturday", label: "السبت" },
    { value: "sunday", label: "الأحد" },
    { value: "monday", label: "الإثنين" },
    { value: "tuesday", label: "الثلاثاء" },
    { value: "wednesday", label: "الأربعاء" },
    // ⚠️ الخميس والجمعة: أيام إجازة (لا توصيل)
  ];

  return (
    <PublicLayout>
      {/* Hero Section with Logo & Background */}
      <section className="relative bg-gradient-to-br from-[#0F1516] via-[#47759C] to-[#3CC4F0] text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center">
            {/* Logos Container */}
            <div className="flex items-center justify-center gap-6 mb-8">
              {/* Main Logo */}
              <div className="animate-fade-in">
                <img
                  src="/adrenaline-logo-full.png"
                  alt="Adrenaline Healthy Food"
                  className="h-16 md:h-20 w-auto drop-shadow-2xl"
                />
              </div>
              
              {/* Heart Logo */}
              <div className="animate-bounce-slow">
                <img
                  src="/heart-logo.png"
                  alt="Heart"
                  className="h-14 md:h-16 w-auto drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg animate-fade-in-up">
              {isRtl ? "قائمة الوجبات" : "Our Menu"}
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-2xl text-white/90 max-w-3xl mx-auto mb-8 animate-fade-in-up animation-delay-200">
              {isRtl
                ? "اكتشف مجموعتنا المتنوعة من الوجبات الصحية واللذيذة"
                : "Discover our diverse collection of healthy and delicious meals"}
            </p>

            {/* Decorative Line */}
            <div className="flex items-center justify-center gap-3 animate-fade-in-up animation-delay-300">
              <div className="h-1 w-20 bg-white/30 rounded-full" />
              <div className="h-2 w-2 bg-[#3CC4F0] rounded-full" />
              <div className="h-1 w-20 bg-white/30 rounded-full" />
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-12 md:h-20">
            <path
              fill="#ffffff"
              fillOpacity="1"
              d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* NEW: Week & Day Scheduling Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Week Tabs */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#47759C] mb-3">اختر الأسبوع</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {weeks.map((week) => (
                <button
                  key={week.value}
                  onClick={() => setSelectedWeek(week.value)}
                  className={cn(
                    "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                    selectedWeek === week.value
                      ? "bg-[#3CC4F0] text-white shadow-md scale-105"
                      : "bg-white text-[#47759C] border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5"
                  )}
                >
                  {week.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day Chips */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#47759C] mb-3">اختر اليوم</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {days.map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDay(selectedDay === day.value ? null : day.value)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    selectedDay === day.value
                      ? "bg-[#3CC4F0] text-white shadow-md"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Countdown Banner */}
          {selectedDay && (
            <div
              className={cn(
                "rounded-xl p-4 flex items-center justify-between",
                isLocked
                  ? "bg-red-50 border-2 border-red-300"
                  : "bg-orange-50 border-2 border-orange-300"
              )}
            >
              <div className="flex items-center gap-3">
                {isLocked ? (
                  <Lock className="h-6 w-6 text-red-600" />
                ) : (
                  <Clock className="h-6 w-6 text-orange-600" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "text-xs font-bold",
                        isLocked
                          ? "bg-red-600 text-white"
                          : "bg-orange-500 text-white"
                      )}
                    >
                      {isLocked ? "مغلق" : "نشط"}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mt-1">
                    {isLocked
                      ? "انتهى وقت اختيار وجبات هذا اليوم"
                      : "الطلبات مفتوحة طوال اليوم"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search & Filters */}
      <section className="bg-white border-b border-gray-100 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#47759C]" />
            <Input
              type="text"
              placeholder={isRtl ? "ابحث عن وجبة..." : "Search for a meal..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 pl-12 pr-4 rounded-full border-2 border-gray-200 focus:border-[#3CC4F0] text-base"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-6 py-2 rounded-full font-medium transition-all",
                  activeCategory === cat.id
                    ? "bg-[#3CC4F0] text-white shadow-md"
                    : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
                )}
              >
                {isRtl ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Meals Grid */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          {meals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-[#47759C]">
                {isRtl ? "لا توجد وجبات متاحة" : "No meals available"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {meals.map((meal: any) => (
                <Card
                  key={meal._id}
                  className="group hover:shadow-xl transition-all duration-300 border-2 border-gray-100 hover:border-[#3CC4F0] overflow-hidden cursor-pointer bg-white"
                  onClick={() => setSelectedMeal(meal)}
                >
                  {/* Meal Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={meal.imageUrl}
                      alt={isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    {/* Calories Badge */}
                    <div className="absolute top-3 right-3">
                      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-bold text-[#0F1516]">
                          {meal.calories}
                        </span>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div className="absolute bottom-3 left-3">
                      <Badge
                        className={cn(
                          "text-xs font-bold px-3 py-1 border-0",
                          meal.category === "breakfast" && "bg-orange-500 text-white",
                          meal.category === "lunch" && "bg-cyan-500 text-white",
                          meal.category === "dinner" && "bg-indigo-500 text-white",
                          meal.category === "salad" && "bg-green-500 text-white",
                          meal.category === "snack" && "bg-amber-500 text-white"
                        )}
                      >
                        {meal.category === "breakfast" && (isRtl ? "فطور" : "Breakfast")}
                        {meal.category === "lunch" && (isRtl ? "غداء" : "Lunch")}
                        {meal.category === "dinner" && (isRtl ? "عشاء" : "Dinner")}
                        {meal.category === "salad" && (isRtl ? "سلطة" : "Salad")}
                        {meal.category === "snack" && (isRtl ? "سناك" : "Snack")}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    {/* Meal Name */}
                    <h3 className="text-xl font-bold text-[#0F1516] mb-2 line-clamp-1">
                      {isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                    </h3>

                    {/* Subtitle (if exists) */}
                    {meal.nameEn && isRtl && (
                      <p className="text-sm text-[#47759C] mb-3">{meal.nameEn}</p>
                    )}

                    {/* Description */}
                    <p className="text-sm text-[#47759C] mb-4 line-clamp-2">
                      {isRtl ? meal.descriptionAr : meal.descriptionEn || meal.descriptionAr}
                    </p>

                    {/* Macros */}
                    <div className="flex items-center gap-3 mb-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "بروتين" : "P"}: {meal.protein}g
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "كارب" : "C"}: {meal.carbs}g
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "دهون" : "F"}: {meal.fats}g
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    {meal.tags && meal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {meal.tags.slice(0, 3).map((tag: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs bg-[#3CC4F0]/10 text-[#3CC4F0] border-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Price & Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-2xl font-bold text-[#3CC4F0]">
                          {meal.priceQAR}
                          <span className="text-sm text-[#47759C] ml-1">
                            {isRtl ? "ر.ق" : "QAR"}
                          </span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => handleAddToCart(meal, e)}
                        disabled={isInCart(meal._id) || !selectedDay}
                        className={cn(
                          "h-9 px-5 rounded-full font-bold transition-all",
                          isInCart(meal._id)
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-[#3CC4F0] hover:bg-[#47759C] text-white"
                        )}
                      >
                        {isInCart(meal._id) ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            {isRtl ? "تم الإضافة" : "Added"}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            {isRtl ? "أضف" : "Add"}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Meal Details Modal */}
      <Dialog open={!!selectedMeal} onOpenChange={() => setSelectedMeal(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
          {selectedMeal && (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#0F1516]">
                  {isRtl ? selectedMeal.nameAr : selectedMeal.nameEn || selectedMeal.nameAr}
                </DialogTitle>
                {selectedMeal.nameEn && isRtl && (
                  <p className="text-sm text-[#47759C]">{selectedMeal.nameEn}</p>
                )}
              </DialogHeader>

              {/* Image */}
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <img
                  src={selectedMeal.imageUrl}
                  alt={isRtl ? selectedMeal.nameAr : selectedMeal.nameEn}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-bold">{selectedMeal.calories}</span>
                </div>
              </div>

              {/* Category & Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={cn(
                    "text-xs font-bold px-3 py-1 border-0",
                    selectedMeal.category === "breakfast" && "bg-orange-500 text-white",
                    selectedMeal.category === "lunch" && "bg-cyan-500 text-white",
                    selectedMeal.category === "dinner" && "bg-indigo-500 text-white",
                    selectedMeal.category === "salad" && "bg-green-500 text-white",
                    selectedMeal.category === "snack" && "bg-amber-500 text-white"
                  )}
                >
                  {selectedMeal.category === "breakfast" && (isRtl ? "فطور" : "Breakfast")}
                  {selectedMeal.category === "lunch" && (isRtl ? "غداء" : "Lunch")}
                  {selectedMeal.category === "dinner" && (isRtl ? "عشاء" : "Dinner")}
                  {selectedMeal.category === "salad" && (isRtl ? "سلطة" : "Salad")}
                  {selectedMeal.category === "snack" && (isRtl ? "سناك" : "Snack")}
                </Badge>
                {selectedMeal.tags?.map((tag: string, idx: number) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs bg-[#3CC4F0]/10 text-[#3CC4F0] border-0"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              {(selectedMeal.aboutAr || selectedMeal.aboutEn) && (
                <div>
                  <h3 className="font-bold text-[#0F1516] mb-2">
                    {isRtl ? "الوصف" : "Description"}
                  </h3>
                  <p className="text-[#47759C] leading-relaxed">
                    {isRtl ? selectedMeal.aboutAr : selectedMeal.aboutEn || selectedMeal.aboutAr}
                  </p>
                </div>
              )}

              {/* Macros */}
              <div>
                <h3 className="font-bold text-[#0F1516] mb-3">
                  {isRtl ? "القيم الغذائية" : "Nutrition Facts"}
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.calories}</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "سعرة" : "Calories"}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.protein}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "بروتين" : "Protein"}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.carbs}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "كربوهيدرات" : "Carbs"}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.fats}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "دهون" : "Fats"}</p>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                <div>
                  <h3 className="font-bold text-[#0F1516] mb-2">
                    {isRtl ? "المكونات" : "Ingredients"}
                  </h3>
                  <ul className="space-y-1">
                    {selectedMeal.ingredients.map((ingredient: string, idx: number) => (
                      <li key={idx} className="text-[#47759C] flex items-start gap-2">
                        <span className="text-[#3CC4F0] mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Price & CTA */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <p className="text-3xl font-bold text-[#3CC4F0]">
                    {selectedMeal.priceQAR}
                    <span className="text-sm text-[#47759C] ml-2">
                      {isRtl ? "ر.ق" : "QAR"}
                    </span>
                  </p>
                </div>
                <Button 
                  onClick={(e) => {
                    handleAddToCart(selectedMeal, e);
                    setSelectedMeal(null);
                  }}
                  disabled={isInCart(selectedMeal._id) || !selectedDay}
                  className={cn(
                    "h-11 px-8 rounded-full font-bold",
                    isInCart(selectedMeal._id)
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-[#3CC4F0] hover:bg-[#47759C] text-white"
                  )}
                >
                  {isInCart(selectedMeal._id) ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      {isRtl ? "تم الإضافة" : "Already Added"}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      {isRtl ? "إضافة للسلة" : "Add to Cart"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Floating Cart Button */}
      {getTotalMeals() > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <Button
            onClick={() => setLocation("/public/order-review")}
            className="h-14 px-8 rounded-full bg-gradient-to-l from-[#3CC4F0] to-[#47759C] hover:from-[#47759C] hover:to-[#3CC4F0] text-white font-bold shadow-2xl flex items-center gap-3"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>{isRtl ? "مراجعة الطلب" : "Review Order"}</span>
            <div className="bg-white text-[#3CC4F0] rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold">
              {getTotalMeals()}
            </div>
          </Button>
        </div>
      )}
    </PublicLayout>
  );
}
