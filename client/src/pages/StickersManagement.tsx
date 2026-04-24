/**
 * @file client/src/pages/StickersManagement.tsx
 * @description إدارة طباعة الستيكرات - Stickers Print Management
 */
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Plus, Sun, Moon } from "lucide-react";

export default function StickersManagement() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [deliveryTime, setDeliveryTime] = useState<"morning" | "evening">("morning");
  const [activeTab, setActiveTab] = useState<"meals" | "boxes">("meals");

  // Mock data - في الواقع ستأتي من Convex
  const stickerData = [
    {
      id: 1,
      orderNumber: "12",
      customerName: "ABDULLA ALSUFI",
      mealName: "BERRY OATMEAL BOWL",
      calories: 380,
      date: "10/02/2026",
    },
    {
      id: 2,
      orderNumber: "13",
      customerName: "FATIMA HASAN",
      mealName: "GRILLED CHICKEN SALAD",
      calories: 420,
      date: "10/02/2026",
    },
    {
      id: 3,
      orderNumber: "14",
      customerName: "OMAR KHALID",
      mealName: "PROTEIN PANCAKES",
      calories: 350,
      date: "10/02/2026",
    },
  ];

  // Sticker dimensions
  const [dimensions, setDimensions] = useState({
    width: 70,
    length: 35,
    meals: 4,
    wrapping: 3.2,
  });

  const handlePrintAll = () => {
    alert("جاري طباعة جميع الستيكرات...");
    // TODO: تنفيذ منطق الطباعة
  };

  const handleReset = () => {
    setDimensions({
      width: 70,
      length: 35,
      meals: 4,
      wrapping: 3.2,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">إدارة طباعة الستيكرات</h1>
          <Button onClick={handlePrintAll} className="bg-[#3CC4F0] hover:bg-[#3CC4F0]/90">
            <Printer className="h-4 w-4 ml-2" />
            طباعة الكل
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="border-2 border-gray-200">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date Filter */}
              <div>
                <Label htmlFor="delivery-date" className="text-lg font-semibold mb-3 block">
                  التاريخ
                </Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-lg h-12"
                />
              </div>

              {/* Delivery Time */}
              <div>
                <Label className="text-lg font-semibold mb-3 block">وقت التوصيل</Label>
                <div className="flex gap-3">
                  <Button
                    variant={deliveryTime === "morning" ? "default" : "outline"}
                    onClick={() => setDeliveryTime("morning")}
                    className={`flex-1 h-12 text-base ${
                      deliveryTime === "morning"
                        ? "bg-white text-gray-900 border-2 border-[#3CC4F0]"
                        : "bg-gray-100"
                    }`}
                  >
                    <Sun className="h-5 w-5 ml-2" />
                    صباحي
                  </Button>
                  <Button
                    variant={deliveryTime === "evening" ? "default" : "outline"}
                    onClick={() => setDeliveryTime("evening")}
                    className={`flex-1 h-12 text-base ${
                      deliveryTime === "evening"
                        ? "bg-gray-700 text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    <Moon className="h-5 w-5 ml-2" />
                    مسائي
                  </Button>
                </div>
              </div>
            </div>

            {/* Sticker Dimensions */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-lg font-semibold">مقاس الستيكر (مم)</Label>
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="text-[#3CC4F0] hover:text-[#3CC4F0]/80"
                >
                  إعادة ضبط
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <Input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, width: Number(e.target.value) })
                    }
                    className="text-center text-xl font-bold h-14 mb-2"
                  />
                  <span className="text-sm text-gray-600">العرض</span>
                </div>
                <div className="text-center">
                  <Input
                    type="number"
                    value={dimensions.length}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, length: Number(e.target.value) })
                    }
                    className="text-center text-xl font-bold h-14 mb-2"
                  />
                  <span className="text-sm text-gray-600">الطول</span>
                </div>
                <div className="text-center">
                  <Input
                    type="number"
                    value={dimensions.meals}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, meals: Number(e.target.value) })
                    }
                    className="text-center text-xl font-bold h-14 mb-2"
                  />
                  <span className="text-sm text-gray-600">الوجبة</span>
                </div>
                <div className="text-center">
                  <Input
                    type="number"
                    step="0.1"
                    value={dimensions.wrapping}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, wrapping: Number(e.target.value) })
                    }
                    className="text-center text-xl font-bold h-14 mb-2"
                  />
                  <span className="text-sm text-gray-600">الحلاسة</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-3">
          <Button
            variant={activeTab === "meals" ? "default" : "outline"}
            onClick={() => setActiveTab("meals")}
            className={`flex-1 h-14 text-lg font-semibold rounded-full ${
              activeTab === "meals"
                ? "bg-white text-[#3CC4F0] border-2 border-[#3CC4F0]"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            ستيكرات الوجبات
          </Button>
          <Button
            variant={activeTab === "boxes" ? "default" : "outline"}
            onClick={() => setActiveTab("boxes")}
            className={`flex-1 h-14 text-lg font-semibold rounded-full ${
              activeTab === "boxes"
                ? "bg-white text-[#3CC4F0] border-2 border-[#3CC4F0]"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            ستيكرات البوكس
          </Button>
        </div>

        {/* Section Title */}
        <h2 className="text-xl font-bold text-gray-800">المعاينة المباشرة</h2>

        {/* Stickers List */}
        <div className="space-y-4">
          {stickerData.map((sticker) => (
            <Card
              key={sticker.id}
              className="border-2 border-gray-200 hover:border-[#3CC4F0] transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Order Number Badge */}
                  <div className="flex-shrink-0 w-16 h-16 bg-black rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">{sticker.orderNumber}</span>
                  </div>

                  {/* Sticker Content */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1 tracking-wider">ADRENALINE</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">
                      {sticker.customerName}
                    </h3>
                    <p className="text-lg text-[#3CC4F0] font-semibold">{sticker.mealName}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <span className="text-sm font-semibold">
                        CAL: {sticker.calories}
                      </span>
                      <span className="text-sm text-gray-500">{sticker.date}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Floating Add Button */}
        <button
          className="fixed bottom-8 left-8 w-16 h-16 bg-[#3CC4F0] hover:bg-[#3CC4F0]/90 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          onClick={() => alert("إضافة ستيكر جديد")}
        >
          <Plus className="h-8 w-8" />
        </button>
      </div>
    </AppLayout>
  );
}
