import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { Settings, Phone, Mail, MapPin, Instagram, Twitter, Facebook, Clock, Save, Upload, Image as ImageIcon } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function RestaurantSettings() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const settings = useQuery(api.restaurantSettings.get);
  const updateSettings = useMutation(api.restaurantSettings.update);
  const updateHeroLogo = useMutation(api.restaurantSettings.updateHeroLogo);
  const deleteHeroLogo = useMutation(api.restaurantSettings.deleteHeroLogo);
  const initializeDefault = useMutation(api.restaurantSettings.initializeDefault);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);

  const [formData, setFormData] = useState({
    phone: "",
    email: "",
    addressAr: "",
    addressEn: "",
    instagramUrl: "",
    twitterUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
    snapchatUrl: "",
    whatsappNumber: "",
    descriptionAr: "",
    descriptionEn: "",
    workingHoursAr: "",
    workingHoursEn: "",
    privacyPolicyUrl: "",
    termsUrl: "",
    // Hero Section
    heroTitleAr: "",
    heroTitleEn: "",
    heroSubtitleAr: "",
    heroSubtitleEn: "",
    heroCta1TextAr: "",
    heroCta1TextEn: "",
    heroCta1Link: "",
    heroCta2TextAr: "",
    heroCta2TextEn: "",
    heroCta2Link: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load settings into form when data arrives
  useEffect(() => {
    if (settings) {
      setFormData({
        phone: settings.phone || "",
        email: settings.email || "",
        addressAr: settings.addressAr || "",
        addressEn: settings.addressEn || "",
        instagramUrl: settings.instagramUrl || "",
        twitterUrl: settings.twitterUrl || "",
        facebookUrl: settings.facebookUrl || "",
        tiktokUrl: settings.tiktokUrl || "",
        snapchatUrl: (settings as any).snapchatUrl || "",
        whatsappNumber: settings.whatsappNumber || "",
        descriptionAr: settings.descriptionAr || "",
        descriptionEn: settings.descriptionEn || "",
        workingHoursAr: settings.workingHoursAr || "",
        workingHoursEn: settings.workingHoursEn || "",
        privacyPolicyUrl: settings.privacyPolicyUrl || "",
        termsUrl: settings.termsUrl || "",
        // Hero Section
        heroTitleAr: settings.heroTitleAr || "",
        heroTitleEn: settings.heroTitleEn || "",
        heroSubtitleAr: settings.heroSubtitleAr || "",
        heroSubtitleEn: settings.heroSubtitleEn || "",
        heroCta1TextAr: settings.heroCta1TextAr || "",
        heroCta1TextEn: settings.heroCta1TextEn || "",
        heroCta1Link: settings.heroCta1Link || "",
        heroCta2TextAr: settings.heroCta2TextAr || "",
        heroCta2TextEn: settings.heroCta2TextEn || "",
        heroCta2Link: settings.heroCta2Link || "",
      });
    }
  }, [settings]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ ...formData, sessionToken });
      alert("✅ تم حفظ الإعدادات بنجاح!");
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await initializeDefault({ sessionToken });
      alert("✅ تم إنشاء الإعدادات الافتراضية!");
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("❌ يرجى اختيار صورة فقط");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("❌ حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setIsUploadingLogo(true);
    try {
      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl({ sessionToken });

      // 2. Upload file
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResult.json();

      // 3. Update settings with new logo
      await updateHeroLogo({ storageId, sessionToken });

      alert("✅ تم رفع الشعار بنجاح!");
    } catch (error: any) {
      console.error("Logo upload error:", error);
      alert(`❌ خطأ في رفع الشعار: ${error?.message || "حاول مرة أخرى"}`);
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm("هل أنت متأكد من حذف الشعار؟")) {
      return;
    }

    setIsDeletingLogo(true);
    try {
      await deleteHeroLogo({ sessionToken });
      alert("✅ تم حذف الشعار بنجاح!");
    } catch (error: any) {
      console.error("Logo delete error:", error);
      alert(`❌ خطأ في حذف الشعار: ${error?.message || "حاول مرة أخرى"}`);
    } finally {
      setIsDeletingLogo(false);
    }
  };

  if (settings === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (settings === null) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <Settings className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold mb-2">لا توجد إعدادات</h2>
            <p className="text-gray-600 mb-6">
              يبدو أن هذه هي المرة الأولى. انقر لإنشاء الإعدادات الافتراضية.
            </p>
            <Button onClick={handleInitialize} className="bg-primary">
              إنشاء الإعدادات الافتراضية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={<Settings className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="إعدادات المطعم" titleEn="Restaurant Settings"
        subtitleAr="إدارة معلومات الاتصال والسوشيال ميديا ووصف المطعم" subtitleEn="Manage contact info, social media & restaurant description"
        actions={
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
          >
            <Save className="h-5 w-5 ml-2" />
            {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        }
      />

      <div className="grid gap-6 max-w-5xl">
        {/* Contact Information */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              معلومات الاتصال
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+974 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="info@adrenaline.qa"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addressAr">العنوان (عربي)</Label>
                <Input
                  id="addressAr"
                  value={formData.addressAr}
                  onChange={(e) => handleChange("addressAr", e.target.value)}
                  placeholder="الدوحة، قطر"
                />
              </div>
              <div>
                <Label htmlFor="addressEn">العنوان (English)</Label>
                <Input
                  id="addressEn"
                  value={formData.addressEn}
                  onChange={(e) => handleChange("addressEn", e.target.value)}
                  placeholder="Doha, Qatar"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="whatsappNumber">رقم الواتساب (اختياري)</Label>
              <Input
                id="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={(e) => handleChange("whatsappNumber", e.target.value)}
                placeholder="+974 1234 5678"
              />
            </div>
          </CardContent>
        </Card>

        {/* Social Media */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-primary" />
              روابط السوشيال ميديا
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="instagramUrl">Instagram</Label>
                <Input
                  id="instagramUrl"
                  value={formData.instagramUrl}
                  onChange={(e) => handleChange("instagramUrl", e.target.value)}
                  placeholder="https://instagram.com/adrenaline"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="twitterUrl">Twitter</Label>
                <Input
                  id="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={(e) => handleChange("twitterUrl", e.target.value)}
                  placeholder="https://twitter.com/adrenaline"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="facebookUrl">Facebook</Label>
                <Input
                  id="facebookUrl"
                  value={formData.facebookUrl}
                  onChange={(e) => handleChange("facebookUrl", e.target.value)}
                  placeholder="https://facebook.com/adrenaline"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="tiktokUrl">TikTok (اختياري)</Label>
                <Input
                  id="tiktokUrl"
                  value={formData.tiktokUrl}
                  onChange={(e) => handleChange("tiktokUrl", e.target.value)}
                  placeholder="https://tiktok.com/@adrenaline"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="snapchatUrl">Snapchat (اختياري)</Label>
                <Input
                  id="snapchatUrl"
                  value={formData.snapchatUrl}
                  onChange={(e) => handleChange("snapchatUrl", e.target.value)}
                  placeholder="https://snapchat.com/add/adrenaline"
                  dir="ltr"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              وصف المطعم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="descriptionAr">الوصف (عربي)</Label>
              <Textarea
                id="descriptionAr"
                value={formData.descriptionAr}
                onChange={(e) => handleChange("descriptionAr", e.target.value)}
                rows={4}
                placeholder="أدرينالين - نقدم لكم وجبات صحية..."
              />
            </div>
            <div>
              <Label htmlFor="descriptionEn">الوصف (English)</Label>
              <Textarea
                id="descriptionEn"
                value={formData.descriptionEn}
                onChange={(e) => handleChange("descriptionEn", e.target.value)}
                rows={4}
                placeholder="Adrenaline - We offer healthy meals..."
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              ساعات العمل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workingHoursAr">ساعات العمل (عربي)</Label>
                <Input
                  id="workingHoursAr"
                  value={formData.workingHoursAr}
                  onChange={(e) => handleChange("workingHoursAr", e.target.value)}
                  placeholder="السبت - الخميس: 8 صباحاً - 10 مساءً"
                />
              </div>
              <div>
                <Label htmlFor="workingHoursEn">ساعات العمل (English)</Label>
                <Input
                  id="workingHoursEn"
                  value={formData.workingHoursEn}
                  onChange={(e) => handleChange("workingHoursEn", e.target.value)}
                  placeholder="Sat - Thu: 8 AM - 10 PM"
                  dir="ltr"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              روابط إضافية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="privacyPolicyUrl">رابط سياسة الخصوصية</Label>
                <Input
                  id="privacyPolicyUrl"
                  value={formData.privacyPolicyUrl}
                  onChange={(e) => handleChange("privacyPolicyUrl", e.target.value)}
                  placeholder="https://adrenaline.qa/privacy"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="termsUrl">رابط الشروط والأحكام</Label>
                <Input
                  id="termsUrl"
                  value={formData.termsUrl}
                  onChange={(e) => handleChange("termsUrl", e.target.value)}
                  placeholder="https://adrenaline.qa/terms"
                  dir="ltr"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hero Section Settings */}
        <Card className="border-2 border-[#3CC4F0]/30">
          <CardHeader className="bg-gradient-to-r from-[#0F4A5E] to-[#3CC4F0] text-white">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              إعدادات Hero Section (الصفحة الرئيسية)
            </CardTitle>
            <p className="text-sm text-white/80 mt-2">
              تحكم في النصوص والأزرار التي تظهر فوق السلايدر في الصفحة الرئيسية
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Hero Logo Upload */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-[#3CC4F0]/30">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[#3CC4F0]" />
                شعار Hero Section
              </h3>
              <div className="space-y-4">
                {/* Current Logo Preview */}
                {settings?.heroLogoUrl && (
                  <div className="flex items-center justify-center p-4 bg-white rounded-lg border border-gray-200">
                    <img
                      src={settings.heroLogoUrl}
                      alt="Hero Logo"
                      className="max-h-20 object-contain"
                    />
                  </div>
                )}

                {/* Upload Button */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo || isDeletingLogo}
                    className="bg-[#3CC4F0] hover:bg-[#3CC4F0]/90 text-white"
                  >
                    <Upload className="h-4 w-4 ml-2" />
                    {isUploadingLogo ? "جاري الرفع..." : "رفع شعار جديد"}
                  </Button>

                  {/* Delete Button - Only show if logo exists */}
                  {settings?.heroLogoUrl && (
                    <Button
                      type="button"
                      onClick={handleLogoDelete}
                      disabled={isUploadingLogo || isDeletingLogo}
                      variant="destructive"
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      {isDeletingLogo ? "جاري الحذف..." : "حذف الشعار"}
                    </Button>
                  )}

                  <span className="text-sm text-gray-600">
                    صورة PNG أو JPG (أقل من 5 ميجابايت)
                  </span>
                </div>

                <p className="text-xs text-gray-500 bg-white/50 p-3 rounded border border-gray-200">
                  💡 <strong>نصيحة:</strong> استخدم صورة بخلفية شفافة (PNG) بعرض 300-500 بكسل للحصول على أفضل نتيجة
                </p>
              </div>
            </div>

            {/* Hero Title */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3CC4F0]"></span>
                العنوان الرئيسي (Hero Title)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroTitleAr">العنوان (عربي)</Label>
                  <Input
                    id="heroTitleAr"
                    value={formData.heroTitleAr}
                    onChange={(e) => handleChange("heroTitleAr", e.target.value)}
                    placeholder="أدرينالين - وجبات صحية لحياة نشيطة"
                  />
                </div>
                <div>
                  <Label htmlFor="heroTitleEn">العنوان (English)</Label>
                  <Input
                    id="heroTitleEn"
                    value={formData.heroTitleEn}
                    onChange={(e) => handleChange("heroTitleEn", e.target.value)}
                    placeholder="Adrenaline - Healthy Meals for Active Life"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Hero Subtitle */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3CC4F0]"></span>
                العنوان الفرعي (Hero Subtitle)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroSubtitleAr">العنوان الفرعي (عربي)</Label>
                  <Textarea
                    id="heroSubtitleAr"
                    value={formData.heroSubtitleAr}
                    onChange={(e) => handleChange("heroSubtitleAr", e.target.value)}
                    rows={2}
                    placeholder="نقدم لك وجبات مُصممة خصيصاً لأهدافك الصحية والرياضية"
                  />
                </div>
                <div>
                  <Label htmlFor="heroSubtitleEn">العنوان الفرعي (English)</Label>
                  <Textarea
                    id="heroSubtitleEn"
                    value={formData.heroSubtitleEn}
                    onChange={(e) => handleChange("heroSubtitleEn", e.target.value)}
                    rows={2}
                    placeholder="Delivering meals tailored to your health and fitness goals"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* CTA Button 1 */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#3CC4F0] text-white text-xs font-bold">1</span>
                الزر الأول (Primary Button)
              </h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="heroCta1TextAr">نص الزر (عربي)</Label>
                    <Input
                      id="heroCta1TextAr"
                      value={formData.heroCta1TextAr}
                      onChange={(e) => handleChange("heroCta1TextAr", e.target.value)}
                      placeholder="اشترك الآن"
                    />
                  </div>
                  <div>
                    <Label htmlFor="heroCta1TextEn">نص الزر (English)</Label>
                    <Input
                      id="heroCta1TextEn"
                      value={formData.heroCta1TextEn}
                      onChange={(e) => handleChange("heroCta1TextEn", e.target.value)}
                      placeholder="Subscribe Now"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="heroCta1Link">الرابط (Link)</Label>
                  <Input
                    id="heroCta1Link"
                    value={formData.heroCta1Link}
                    onChange={(e) => handleChange("heroCta1Link", e.target.value)}
                    placeholder="#plans-section أو /public/plans"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    استخدم <code className="bg-gray-100 px-1 rounded">#plans-section</code> للانتقال السلس داخل الصفحة
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button 2 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-400 text-white text-xs font-bold">2</span>
                الزر الثاني (Secondary Button)
              </h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="heroCta2TextAr">نص الزر (عربي)</Label>
                    <Input
                      id="heroCta2TextAr"
                      value={formData.heroCta2TextAr}
                      onChange={(e) => handleChange("heroCta2TextAr", e.target.value)}
                      placeholder="المنيو"
                    />
                  </div>
                  <div>
                    <Label htmlFor="heroCta2TextEn">نص الزر (English)</Label>
                    <Input
                      id="heroCta2TextEn"
                      value={formData.heroCta2TextEn}
                      onChange={(e) => handleChange("heroCta2TextEn", e.target.value)}
                      placeholder="Menu"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="heroCta2Link">الرابط (Link)</Label>
                  <Input
                    id="heroCta2Link"
                    value={formData.heroCta2Link}
                    onChange={(e) => handleChange("heroCta2Link", e.target.value)}
                    placeholder="/public/menu"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="px-12 rounded-xl font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
          >
            <Save className="h-5 w-5 ml-2" />
            {isSaving ? "جاري الحفظ..." : "حفظ جميع التغييرات"}
          </Button>
        </div>
      </div>
    </div>
  );
}
