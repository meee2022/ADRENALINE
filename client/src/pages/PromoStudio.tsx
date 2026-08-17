/**
 * @file client/src/pages/PromoStudio.tsx
 * @description مولّد صور حملات الخصم بمقاسات إنستجرام الجاهزة للنشر.
 */
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, ImagePlus, Megaphone, QrCode, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

type Brand = "ADRENALINE" | "NUTRI_RESET";
type Size = "POST" | "STORY";
type PosterLanguage = "AR" | "EN";
type Audience = "TRAINERS" | "GENERAL";

const BRANDS: Record<Brand, {
  name: string; logo: string; ink: string; accent: string; deep: string;
  images: Array<{ src: string; ar: string; en: string }>;
}> = {
  ADRENALINE: {
    name: "ADRENALINE", logo: "/adrenaline-logo-full.png", ink: "#F6FBFE", accent: "#3CC4F0", deep: "#071E31",
    images: [
      { src: "/promo-adrenaline-protein.png", ar: "وجبة بروتين فاخرة", en: "Premium protein meal" },
      { src: "/promo-adrenaline-plans.png", ar: "باقات الوجبات", en: "Meal plan collection" },
      { src: "/promo-adrenaline-lifestyle.png", ar: "أسلوب حياة رياضي", en: "Active lifestyle" },
      { src: "/promo-coach-box-adrenaline.png", ar: "مدرب مع بوكس أدرينالين", en: "Coach with Adrenaline box" },
      { src: "/promo-coach-female-kraft.png", ar: "مدربة مع طبق أدرينالين", en: "Female coach with meal" },
      { src: "/promo-coach-community-kraft.png", ar: "مجتمع الأداء والوجبات", en: "Performance community" },
      { src: "/pos-meals/Adrenaline Healthy Majboos مجبوس صحي.jpg", ar: "مجبوس أدرينالين الصحي", en: "Healthy Majboos" },
      { src: "/pos-meals/Greek Chicken دجاج يوناني.jpg", ar: "الدجاج اليوناني", en: "Greek Chicken" },
      { src: "/pos-meals/Beef Kofta with Safran Rice كفتة لحم البقر مع أرز الزعفران.jpg", ar: "كفتة وأرز الزعفران", en: "Kofta & Saffron Rice" },
    ],
  },
  NUTRI_RESET: {
    name: "NUTRI RESET", logo: "/nutri-reset-logo.png", ink: "#F5FFFD", accent: "#7FE7DE", deep: "#063A42",
    images: [
      { src: "/nutri-reset-woman-meal.png", ar: "أسلوب حياة", en: "Lifestyle" },
      { src: "/nutri-reset-hero-original.png", ar: "نيوتري ريست", en: "Nutri Reset" },
    ],
  },
};

const SIZES: Record<Size, { w: number; h: number; ar: string; en: string }> = {
  POST: { w: 1080, h: 1350, ar: "منشور إنستجرام", en: "Instagram post" },
  STORY: { w: 1080, h: 1920, ar: "ستوري إنستجرام", en: "Instagram story" },
};

export default function PromoStudio() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);
  const sessionToken = useStore((s: any) => s.sessionToken) || undefined;
  const couponRows = useQuery(api.coupons.list, { sessionToken }) as any[] | undefined;
  const coupons = useMemo(() => couponRows || [], [couponRows]);
  const queryCode = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() || "";

  const [code, setCode] = useState(queryCode);
  const [brand, setBrand] = useState<Brand>("ADRENALINE");
  const [size, setSize] = useState<Size>("POST");
  const [posterLanguage, setPosterLanguage] = useState<PosterLanguage>("AR");
  const [audience, setAudience] = useState<Audience>("TRAINERS");
  const [headline, setHeadline] = useState("");
  const [footer, setFooter] = useState("");
  const [imageSrc, setImageSrc] = useState(BRANDS.ADRENALINE.images[0].src);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [renderError, setRenderError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const coupon = useMemo(
    () => coupons.find((item) => String(item.code).toUpperCase() === code.trim().toUpperCase()),
    [coupons, code],
  );
  const couponBrand = (coupon?.restaurantKey || "ADRENALINE") as Brand;
  const usable = Boolean(coupon?.isActive) && (!coupon?.expiresAt || coupon.expiresAt >= qatarToday());

  useEffect(() => {
    if (!coupon) return;
    const nextBrand = couponBrand === "NUTRI_RESET" ? "NUTRI_RESET" : "ADRENALINE";
    setBrand(nextBrand);
    setCustomImage(null);
    setImageSrc(BRANDS[nextBrand].images[0].src);
  }, [coupon, couponBrand]);

  /**
   * رابط الحملة يُبنى من دومين المطعم لا من عنوان المتصفح.
   *
   * كان يأخذ `window.location.origin`، فالبوستر المُصمَّم على جهاز التطوير
   * يحمل رمزاً يفتح `localhost` — لا يعمل عند أحد سوى من صنعه. والملصق
   * يُطبع ويُنشر ولا يُراجَع بعدها، فخطأٌ كهذا لا يُكتشف إلا من زبون.
   *
   * ولكل علامةٍ دومينها، فيتبع الرابطُ العلامةَ المختارة لا الصفحة المفتوحة.
   */
  const campaignLink = useMemo(() => {
    const origin = brand === "NUTRI_RESET"
      ? "https://nutrireset.online"
      : "https://adrenalinehealthy.com";
    const promo = code.trim() ? `?promo=${encodeURIComponent(code.trim().toUpperCase())}` : "";
    return `${origin}/public/plans${promo}`;
  }, [brand, code]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dimensions = SIZES[size];
      canvas.width = dimensions.w;
      canvas.height = dimensions.h;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      setRenderError("");
      try {
        await document.fonts.ready;
        const [photo, logo, qr] = await Promise.all([
          loadImage(customImage || imageSrc),
          loadImage(BRANDS[brand].logo),
          code.trim()
            ? QRCode.toDataURL(campaignLink, {
                margin: 1, width: 900, errorCorrectionLevel: "H",
                color: { dark: BRANDS[brand].deep, light: "#FFFFFF" },
              }).then(loadImage)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        drawCampaign(g, {
          w: dimensions.w, h: dimensions.h, size, brand, posterLanguage,
          photo, logo, qr, code: code.trim().toUpperCase(), coupon,
          headline: headline.trim(), footer: footer.trim(), audience,
        });
      } catch {
        if (!cancelled) setRenderError(isRtl ? "تعذّر تحميل صورة المعاينة" : "Unable to load the preview image");
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [audience, brand, campaignLink, code, coupon, customImage, footer, headline, imageSrc, isRtl, posterLanguage, size]);

  const chooseBrand = (next: Brand) => {
    if (coupon && next !== couponBrand) return;
    setBrand(next);
    setCustomImage(null);
    setImageSrc(BRANDS[next].images[0].src);
  };

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setCustomImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const downloadPoster = () => {
    if (!usable || !canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png", 1);
    a.download = `${brand.toLowerCase()}-${code.toLowerCase()}-${size.toLowerCase()}.png`;
    a.click();
  };

  const downloadQr = async () => {
    if (!usable) return;
    const data = await QRCode.toDataURL(campaignLink, { margin: 2, width: 1600, errorCorrectionLevel: "H" });
    const a = document.createElement("a");
    a.href = data;
    a.download = `qr-${code.toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <DashboardHeader
        icon={<Megaphone className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="استوديو الحملات" titleEn="Promo Studio"
        subtitleAr="صمّم إعلان خصم جاهزًا لإنستجرام مع رابط وQR يعملان فعليًا"
        subtitleEn="Create a polished Instagram campaign with a working link and QR code"
      />

      <div className="grid items-start gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_-24px_rgba(14,42,74,.35)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#0E76AC]">{t("1. العرض", "1. Offer")}</p>
            <h2 className="mt-1 text-lg font-black text-[#0F1516]">{t("اختر كوبونًا فعّالًا", "Choose an active coupon")}</h2>
          </div>

          <div className="space-y-2">
            <Label>{t("كود الخصم", "Discount code")}</Label>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-slate-50 p-2.5">
              {coupons.filter((item) => item.isActive).map((item) => (
                <button key={item._id} type="button" onClick={() => setCode(String(item.code))}
                  className={cn("rounded-xl border px-3 py-2 text-xs font-black transition-colors",
                    code === String(item.code)
                      ? "border-[#0E76AC] bg-[#0E76AC] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[#3CC4F0]")}>
                  {item.code} · {item.discountValue}{item.discountType === "PERCENT" ? "%" : " QAR"}
                </button>
              ))}
              {!coupons.some((item) => item.isActive) && (
                <p className="px-2 py-3 text-xs font-bold text-slate-500">{t("أنشئ كوبونًا وفعّله أولًا", "Create and activate a coupon first")}</p>
              )}
            </div>
            <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME25" className="h-11 rounded-xl font-black tracking-widest" />
            {code.trim() && !coupon && <Validation tone="danger" text={t("هذا الكود غير موجود ولن يعمل عند الدفع", "This code does not exist and will not work at checkout")} />}
            {coupon && !coupon.isActive && <Validation tone="danger" text={t("الكوبون متوقف؛ فعّله قبل النشر", "The coupon is disabled; activate it before publishing")} />}
            {coupon?.expiresAt && coupon.expiresAt < qatarToday() && <Validation tone="danger" text={t("الكوبون منتهي الصلاحية", "The coupon has expired")} />}
            {usable && <Validation tone="success" text={t("الكوبون صالح والرابط جاهز للنشر", "Coupon is valid and the campaign link is ready")} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Segmented label={t("لغة الصورة", "Poster language")}
              items={[{ key: "AR", label: "عربي" }, { key: "EN", label: "English" }]}
              value={posterLanguage} onChange={(value) => setPosterLanguage(value as PosterLanguage)} />
            <Segmented label={t("المقاس", "Format")}
              items={[{ key: "POST", label: t("منشور", "Post") }, { key: "STORY", label: t("ستوري", "Story") }]}
              value={size} onChange={(value) => setSize(value as Size)} />
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#0E76AC]">{t("2. الهوية والصورة", "2. Brand & image")}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{t("الهوية تتطابق تلقائيًا مع المطعم المرتبط بالكوبون", "Brand is matched automatically to the coupon restaurant")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["ADRENALINE", "NUTRI_RESET"] as Brand[]).map((item) => (
                <button key={item} type="button" onClick={() => chooseBrand(item)}
                  disabled={Boolean(coupon && couponBrand !== item)}
                  className={cn("h-11 rounded-xl border text-xs font-black disabled:cursor-not-allowed disabled:opacity-40",
                    brand === item ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
                  {BRANDS[item].name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS[brand].images.map((item) => (
                <button key={item.src} type="button" onClick={() => { setCustomImage(null); setImageSrc(item.src); }}
                  className={cn("overflow-hidden rounded-xl border-2 bg-slate-100 text-start",
                    !customImage && imageSrc === item.src ? "border-[#3CC4F0]" : "border-transparent")}>
                  <img src={item.src} alt="" className="aspect-[4/3] w-full object-cover" />
                  <span className="block truncate px-2 py-1.5 text-[10px] font-black text-slate-600">{t(item.ar, item.en)}</span>
                </button>
              ))}
              <label className={cn("flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center",
                customImage ? "border-[#3CC4F0] bg-cyan-50 text-[#0E76AC]" : "border-slate-300 text-slate-500")}>
                <ImagePlus className="h-5 w-5" />
                <span className="mt-1 px-1 text-[10px] font-black">{t("ارفع صورتك", "Upload yours")}</span>
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-5">
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#0E76AC]">{t("3. الرسالة", "3. Message")}</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {(["TRAINERS", "GENERAL"] as Audience[]).map((item) => (
                <button key={item} type="button" onClick={() => setAudience(item)}
                  className={cn("rounded-lg px-3 py-2 text-xs font-black transition", audience === item ? "bg-white text-[#0E76AC] shadow-sm" : "text-slate-500")}>
                  {item === "TRAINERS" ? t("حملة الأداء الرياضي", "Performance campaign") : t("جمهور عام", "General")}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>{t("العنوان الرئيسي (اختياري)", "Headline (optional)")}</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)}
                placeholder={audience === "TRAINERS"
                  ? (posterLanguage === "AR" ? "قوّتك تبدأ من طبقك" : "Strength starts on your plate")
                  : (posterLanguage === "AR" ? "ابدأ رحلتك الصحية اليوم" : "Start your healthier routine")} />
            </div>
            <div className="space-y-2">
              <Label>{t("السطر الختامي (اختياري)", "Footer line (optional)")}</Label>
              <Input value={footer} onChange={(e) => setFooter(e.target.value)}
                placeholder={posterLanguage === "AR" ? "وجبات محسوبة وتوصيل يومي في قطر" : "Calorie-counted meals, delivered daily"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700"><QrCode className="h-4 w-4 text-[#0E76AC]" />{t("الرابط داخل QR", "QR destination")}</div>
            <p dir="ltr" className="mt-1 break-all text-[10px] font-bold leading-5 text-slate-500">{campaignLink}</p>
            <Button variant="outline" size="sm" className="mt-2 h-8 w-full rounded-lg text-xs font-black"
              onClick={() => { navigator.clipboard.writeText(campaignLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="me-1.5 h-3.5 w-3.5" /> : <Copy className="me-1.5 h-3.5 w-3.5" />}
              {copied ? t("تم النسخ", "Copied") : t("نسخ رابط الحملة", "Copy campaign link")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={downloadPoster} disabled={!usable || Boolean(renderError)} className="h-12 rounded-xl bg-[#0E76AC] font-black hover:bg-[#095f89]">
              <Download className="me-2 h-4 w-4" />{t("تنزيل الصورة", "Download poster")}
            </Button>
            <Button variant="outline" onClick={downloadQr} disabled={!usable} className="h-12 rounded-xl font-black">
              <QrCode className="me-2 h-4 w-4" />{t("تنزيل QR", "Download QR")}
            </Button>
          </div>
        </section>

        <section className="sticky top-20 rounded-3xl border border-slate-200 bg-[#E9F0F5] p-4 md:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#0E76AC]">{t("معاينة مباشرة", "Live preview")}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{isRtl ? SIZES[size].ar : SIZES[size].en} · {SIZES[size].w} × {SIZES[size].h}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />{t("PNG عالي الجودة", "High-quality PNG")}
            </span>
          </div>
          <div className="flex min-h-[520px] items-start justify-center overflow-hidden rounded-2xl bg-[#DCE7EE] p-3 md:p-5">
            <canvas ref={canvasRef} className="block max-h-[74vh] max-w-full rounded-xl shadow-[0_24px_70px_-30px_rgba(7,30,49,.65)]" />
          </div>
          {renderError && <p className="mt-3 text-center text-sm font-bold text-red-600">{renderError}</p>}
        </section>
      </div>
    </div>
  );
}

function Segmented({ label, items, value, onChange }: { label: string; items: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><div className="flex gap-1 rounded-xl bg-slate-100 p-1">
    {items.map((item) => <button key={item.key} type="button" onClick={() => onChange(item.key)}
      className={cn("h-9 flex-1 rounded-lg text-[11px] font-black", value === item.key ? "bg-white text-[#0E76AC] shadow-sm" : "text-slate-500")}>{item.label}</button>)}
  </div></div>;
}

function Validation({ tone, text }: { tone: "success" | "danger"; text: string }) {
  return <p className={cn("flex items-center gap-1.5 text-xs font-bold", tone === "success" ? "text-emerald-700" : "text-red-600")}>
    {tone === "success" ? <Check className="h-3.5 w-3.5" /> : null}{text}
  </p>;
}

function qatarToday() { return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCampaign(g: CanvasRenderingContext2D, p: {
  w: number; h: number; size: Size; brand: Brand; posterLanguage: PosterLanguage;
  photo: HTMLImageElement; logo: HTMLImageElement; qr: HTMLImageElement | null;
  code: string; coupon: any; headline: string; footer: string; audience: Audience;
}) {
  const { w, h, brand, posterLanguage, photo, logo, qr, code, coupon } = p;
  const B = BRANDS[brand];
  const ar = posterLanguage === "AR";
  const story = p.size === "STORY";
  const trainers = p.audience === "TRAINERS";
  const panelY = trainers ? (story ? 1400 : 930) : (story ? 1220 : 865);
  const topArea = panelY - (story ? 80 : 75);

  drawCover(g, photo, 0, 0, w, h, trainers ? .58 : .5);
  if (trainers) {
    const sideShade = g.createLinearGradient(0, 0, w, 0);
    sideShade.addColorStop(0, `${B.deep}D9`);
    sideShade.addColorStop(.42, `${B.deep}9E`);
    sideShade.addColorStop(.66, `${B.deep}24`);
    sideShade.addColorStop(1, "rgba(4,18,29,0)");
    g.fillStyle = sideShade; g.fillRect(0, 0, w, topArea + 150);

    const bottomShade = g.createLinearGradient(0, h * .48, 0, h);
    bottomShade.addColorStop(0, "rgba(4,18,29,0)");
    bottomShade.addColorStop(.56, `${B.deep}E8`);
    bottomShade.addColorStop(1, B.deep);
    g.fillStyle = bottomShade; g.fillRect(0, h * .45, w, h * .55);
  } else {
    const shade = g.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(4,18,29,.10)");
    shade.addColorStop(story ? .48 : .40, "rgba(4,18,29,.38)");
    shade.addColorStop(story ? .68 : .60, `${B.deep}F2`);
    shade.addColorStop(1, B.deep);
    g.fillStyle = shade; g.fillRect(0, 0, w, h);
  }

  const glow = g.createRadialGradient(w * .83, topArea * .25, 10, w * .83, topArea * .25, 680);
  glow.addColorStop(0, `${B.accent}66`); glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow; g.fillRect(0, 0, w, topArea);

  roundRect(g, 64, 58, brand === "NUTRI_RESET" ? 310 : 370, 116, 28);
  g.fillStyle = "rgba(248,252,253,.96)"; g.fill();
  drawContain(g, logo, 86, 75, brand === "NUTRI_RESET" ? 266 : 326, 80);
  pill(g, trainers ? (ar ? "لأول مرة" : "FOR THE FIRST TIME") : (ar ? "عرض محدود" : "LIMITED OFFER"), w - 300, 76, 228, 58, B.accent, B.deep, trainers && !ar ? 18 : 25);

  g.direction = ar ? "rtl" : "ltr";
  g.textAlign = ar ? "right" : "left";
  const startX = trainers && ar ? 520 : (ar ? w - 72 : 72);
  const copyWidth = trainers ? 440 : w - 144;
  const discountValue = Number(coupon?.discountValue || 0);
  const isPercent = coupon?.discountType !== "FIXED";
  const big = isPercent ? `${discountValue || 25}%` : `${discountValue || 200}`;
  if (trainers) {
    g.fillStyle = "rgba(246,251,254,.72)"; g.font = font(story ? 31 : 27, 800);
    g.fillText(ar ? "العرض الأقوى من أدرينالين" : "ADRENALINE'S STRONGEST OFFER", startX, story ? 285 : 235);
  }
  g.fillStyle = B.ink; g.font = font(trainers ? (story ? 218 : 180) : (story ? 238 : 205), 900);
  g.fillText(big, startX, story ? 530 : 430);

  g.fillStyle = B.accent; g.font = font(trainers ? (story ? 56 : 45) : (story ? 76 : 64), 900);
  g.fillText(isPercent ? (ar ? "على اشتراكات الوجبات" : "OFF MEAL SUBSCRIPTIONS") : (ar ? "ر.ق خصم" : "QAR OFF"), startX, story ? 625 : 510);

  const defaultHeadline = trainers
    ? (ar ? "قوّتك تبدأ من طبقك" : "Strength starts on your plate")
    : (ar ? "ابدأ رحلتك الصحية اليوم" : "Start your healthier routine today");
  g.fillStyle = B.ink;
  wrapText(g, p.headline || defaultHeadline, startX, story ? 750 : 605, copyWidth, trainers ? (story ? 58 : 48) : (story ? 62 : 54), 1.18, 900, ar ? "right" : "left", 2);

  const panelH = h - panelY - 62;
  roundRect(g, 58, panelY, w - 116, panelH, trainers ? 30 : 40);
  g.fillStyle = "rgba(247,251,252,.97)"; g.fill();
  if (trainers) {
    roundRect(g, 82, panelY + 22, w - 164, 7, 4);
    g.fillStyle = B.accent; g.fill();
  }

  const qrSize = story ? 286 : 250;
  const qrX = ar ? w - 92 - qrSize : 92;
  const qrY = panelY + (panelH - qrSize) / 2;
  if (qr) {
    roundRect(g, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 24);
    g.fillStyle = "#FFFFFF"; g.fill();
    g.drawImage(qr, qrX, qrY, qrSize, qrSize);
  }

  const contentLeft = ar ? 92 : qrX + qrSize + 52;
  const contentRight = ar ? qrX - 52 : w - 92;
  const contentX = ar ? contentRight : contentLeft;
  const contentWidth = contentRight - contentLeft;
  g.textAlign = ar ? "right" : "left"; g.direction = ar ? "rtl" : "ltr";
  const ctaSize = p.audience === "TRAINERS" && !ar ? (story ? 30 : 25) : (story ? 39 : 34);
  g.fillStyle = B.deep; g.font = font(ctaSize, 900);
  g.fillText(
    trainers
      ? (ar ? "خطتك جاهزة. ابدأ الآن" : "YOUR PLAN IS READY")
      : (ar ? "امسح الرمز واختر باقتك" : "SCAN. CHOOSE. SAVE."),
    contentX, panelY + 74,
  );
  g.fillStyle = "#526574"; g.font = font(story ? 25 : 22, 700);
  wrapText(g,
    trainers
      ? (ar ? "امسح الرمز واختر باقتك" : "Scan the code and choose your plan")
      : (ar ? "الخصم ينتقل تلقائيًا إلى صفحة الدفع" : "Your discount is applied automatically at checkout"),
    contentX, panelY + 116, contentWidth, story ? 25 : 22, 1.3, 700, ar ? "right" : "left", 2,
  );

  const codeBoxY = panelY + (story ? 190 : 166);
  roundRect(g, contentLeft, codeBoxY, contentWidth, story ? 96 : 88, 22);
  g.fillStyle = B.deep; g.fill();
  g.textAlign = "center"; g.direction = "ltr"; g.fillStyle = B.accent; g.font = font(story ? 48 : 44, 900);
  g.fillText(code || "YOURCODE", contentLeft + contentWidth / 2, codeBoxY + (story ? 65 : 60));

  g.direction = ar ? "rtl" : "ltr"; g.textAlign = ar ? "right" : "left";
  g.fillStyle = "#536877"; g.font = font(19, 800);
  const expiry = coupon?.expiresAt
    ? (ar ? `صالح حتى ${coupon.expiresAt}` : `Valid until ${coupon.expiresAt}`)
    : (ar ? "تُطبّق الشروط والأحكام" : "Terms and conditions apply");
  g.fillText(expiry, contentX, panelY + panelH - 34);

  if (p.footer) {
    g.textAlign = "center"; g.fillStyle = "rgba(246,251,254,.86)"; g.font = font(20, 800);
    g.fillText(p.footer, w / 2, panelY - 28);
  }
}

function font(size: number, weight = 900) { return `${weight} ${size}px Cairo, Tahoma, "Segoe UI", sans-serif`; }

function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focalY = .5) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale; const sh = h / scale;
  const maxSourceY = Math.max(0, img.naturalHeight - sh);
  const sourceY = Math.max(0, Math.min(maxSourceY, img.naturalHeight * focalY - sh / 2));
  g.drawImage(img, (img.naturalWidth - sw) / 2, sourceY, sw, sh, x, y, w, h);
}

function drawContain(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale; const dh = img.naturalHeight * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function pill(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, bg: string, fg: string, size: number) {
  roundRect(g, x, y, w, h, h / 2); g.fillStyle = bg; g.fill();
  g.direction = "ltr"; g.textAlign = "center"; g.fillStyle = fg; g.font = font(size, 900);
  g.fillText(text, x + w / 2, y + h * .67);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + radius, y); g.arcTo(x + w, y, x + w, y + h, radius);
  g.arcTo(x + w, y + h, x, y + h, radius); g.arcTo(x, y + h, x, y, radius);
  g.arcTo(x, y, x + w, y, radius); g.closePath();
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number,
  size: number, lineRatio: number, weight: number, align: CanvasTextAlign, maxLines: number) {
  g.textAlign = align; g.font = font(size, weight);
  const words = text.trim().split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (g.measureText(candidate).width > maxWidth && line) {
      lines.push(line); line = word;
      if (lines.length === maxLines - 1) break;
    } else line = candidate;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => g.fillText(item, x, y + index * size * lineRatio));
}
