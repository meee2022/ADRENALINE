import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Image as ImageIcon, Upload, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function BannersManagement() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();
  const banners = useQuery(api.banners.list, { sessionToken }) || [];
  const createBanner = useMutation(api.banners.create);
  const deleteBanner = useMutation(api.banners.remove);
  const toggleActive = useMutation(api.banners.toggleActive);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [isUploading, setIsUploading] = useState(false);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleAr, setSubtitleAr] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار صورة فقط",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !titleAr) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال العنوان واختيار صورة",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl({ sessionToken });

      // 2. Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!result.ok) {
        throw new Error("فشل رفع الصورة");
      }

      const { storageId } = await result.json();

      // 3. Create banner record
      await createBanner({
        sessionToken,
        titleAr,
        titleEn: titleEn || undefined,
        subtitleAr: subtitleAr || undefined,
        subtitleEn: subtitleEn || undefined,
        imageStorageId: storageId,
        sortOrder: banners.length + 1,
      });

      toast({
        title: "نجاح",
        description: "تم إضافة البانر بنجاح",
      });

      // Reset form
      setTitleAr("");
      setTitleEn("");
      setSubtitleAr("");
      setSubtitleEn("");
      setSelectedFile(null);
      setPreviewUrl("");
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء رفع البانر",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا البانر؟")) return;

    try {
      await deleteBanner({ id: id as any, sessionToken });
      toast({
        title: "نجاح",
        description: "تم حذف البانر بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف البانر",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await toggleActive({ id: id as any, sessionToken });
      toast({
        title: "نجاح",
        description: currentStatus ? "تم إخفاء البانر" : "تم إظهار البانر",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث حالة البانر",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <DashboardHeader
          icon={<ImageIcon className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="إدارة البانرات (السلايدر)" titleEn="Banners (Slider)"
          subtitleAr="رفع وإدارة صور السلايدر في الصفحة الرئيسية" subtitleEn="Upload & manage homepage slider images"
          kpis={[
            { value: banners.length, labelAr: "إجمالي البانرات", labelEn: "Total banners" },
            { value: banners.filter((b: any) => b.isActive).length, labelAr: "نشط", labelEn: "Active" },
          ]}
        />

        {/* Upload Form */}
        <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              إضافة بانر جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>العنوان (عربي) *</Label>
                <Input
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: عروض خاصة"
                />
              </div>
              <div>
                <Label>العنوان (إنجليزي)</Label>
                <Input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Example: Special Offers"
                />
              </div>
              <div>
                <Label>العنوان الفرعي (عربي)</Label>
                <Input
                  value={subtitleAr}
                  onChange={(e) => setSubtitleAr(e.target.value)}
                  placeholder="خصم 20% على جميع الباقات"
                />
              </div>
              <div>
                <Label>العنوان الفرعي (إنجليزي)</Label>
                <Input
                  value={subtitleEn}
                  onChange={(e) => setSubtitleEn(e.target.value)}
                  placeholder="20% off on all plans"
                />
              </div>
            </div>

            <div>
              <Label>الصورة *</Label>
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-cyan-500 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">
                      {selectedFile ? selectedFile.name : "اضغط لرفع صورة"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (حجم موصى به: 1920x600)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </div>

            {previewUrl && (
              <div>
                <Label>معاينة</Label>
                <div className="relative mt-2 rounded-lg overflow-hidden border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile || !titleAr}
              className="w-full rounded-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
            >
              {isUploading ? "جاري الرفع..." : "رفع البانر"}
            </Button>
          </CardContent>
        </Card>

        {/* Banners List */}
        <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              البانرات الحالية ({banners.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {banners.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>لا توجد بانرات حالياً</p>
              </div>
            ) : (
              <div className="space-y-4">
                {banners.map((banner: any) => (
                  <div
                    key={banner._id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      banner.isActive
                        ? "border-[#e8eef4] bg-white"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                    style={banner.isActive ? { boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" } : undefined}
                  >
                    {/* Image */}
                    <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt={banner.titleAr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{banner.titleAr}</h3>
                      {banner.titleEn && (
                        <p className="text-sm text-slate-500 truncate">{banner.titleEn}</p>
                      )}
                      {banner.subtitleAr && (
                        <p className="text-xs text-slate-400 truncate mt-1">{banner.subtitleAr}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            banner.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {banner.isActive ? "نشط" : "مخفي"}
                        </span>
                        <span className="text-xs text-slate-400">ترتيب: {banner.sortOrder}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(banner._id, banner.isActive)}
                      >
                        {banner.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(banner._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
