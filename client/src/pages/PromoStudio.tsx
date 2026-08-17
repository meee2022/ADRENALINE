/**
 * @file client/src/pages/PromoStudio.tsx
 * @description مولّد صور الحملات — كود خصمٍ يصير منشوراً جاهزاً للنشر.
 *
 * لماذا الرسم على Canvas لا لقطة شاشة لعنصر HTML:
 * جُرّبت html2canvas في هذا المشروع من قبل فكسرت تشكيل العربي وقطّعت الحروف.
 * والـCanvas يخطّ النصّ بمُشكِّل النظام نفسه، ويعطي مقاساً بالبكسل بالضبط
 * (١٠٨٠×١٠٨٠ لا أقلّ ولا أكثر) — وهو ما تطلبه إنستجرام.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Download, QrCode, Copy, Check } from "lucide-react";
import QRCode from "qrcode";

type Brand = "ADRENALINE" | "NUTRI_RESET";
type Size = "SQUARE" | "STORY";

const BRANDS: Record<Brand, { name: string; from: string; to: string; ink: string; accent: string }> = {
  ADRENALINE:  { name: "ADRENALINE",  from: "#0E2A4A", to: "#0E76AC", ink: "#FFFFFF", accent: "#3CC4F0" },
  NUTRI_RESET: { name: "NUTRI RESET", from: "#0A4E57", to: "#22AEC0", ink: "#FFFFFF", accent: "#7FE7DE" },
};
const SIZES: Record<Size, { w: number; h: number; label: string }> = {
  SQUARE: { w: 1080, h: 1080, label: "1080 × 1080" },
  STORY:  { w: 1080, h: 1920, label: "1080 × 1920" },
};

export default function PromoStudio() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s: any) => s.sessionToken) || undefined;
  const coupons = (useQuery(api.coupons.list, { sessionToken }) as any[] | undefined) || [];

  const [code, setCode] = useState("");
  const [brand, setBrand] = useState<Brand>("ADRENALINE");
  const [size, setSize] = useState<Size>("SQUARE");
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const active = useMemo(
    () => coupons.find((c) => String(c.code).toUpperCase() === code.toUpperCase()),
    [coupons, code],
  );

  /** الرابط الذي يفتحه الرمز: الباقات وقد سبقه كودُه مطبَّقاً. */
  const link = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = brand === "NUTRI_RESET" ? "/public/plans" : "/public/plans";
    return `${origin}${base}${code ? `?promo=${encodeURIComponent(code.toUpperCase())}` : ""}`;
  }, [brand, code]);

  /** عبارةُ الخصم كما يقرؤها الناس: «خصم ٢٥٪» أو «خصم ٢٠٠ ر.ق». */
  const offerText = useMemo(() => {
    if (!active) return "";
    return active.discountType === "PERCENT"
      ? `${active.discountValue}% ${isRtl ? "خصم" : "OFF"}`
      : `${active.discountValue} ${isRtl ? "ر.ق خصم" : "QAR OFF"}`;
  }, [active, isRtl]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const { w, h } = SIZES[size];
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    if (!g) return;
    const B = BRANDS[brand];
    const story = size === "STORY";

    (async () => {
      // ── الأرضية: تدرّجٌ قطريّ من داكن العلامة إلى فاتحها ──
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, B.from); grad.addColorStop(1, B.to);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);

      // هالةٌ خفيفة تكسر استواء الخلفية
      const halo = g.createRadialGradient(w * 0.8, h * 0.12, 10, w * 0.8, h * 0.12, w * 0.7);
      halo.addColorStop(0, `${B.accent}33`); halo.addColorStop(1, "#00000000");
      g.fillStyle = halo; g.fillRect(0, 0, w, h);

      const cx = w / 2;
      const F = (px: number, weight = 900) => `${weight} ${px}px Cairo, Tahoma, "Segoe UI", sans-serif`;
      g.textAlign = "center";
      g.direction = isRtl ? "rtl" : "ltr";

      // ── اسم العلامة ──
      let y = story ? 210 : 130;
      g.fillStyle = `${B.ink}CC`;
      g.font = F(story ? 46 : 40, 800);
      g.fillText(B.name, cx, y);

      // ── العنوان الرئيسي ──
      y += story ? 150 : 120;
      g.fillStyle = B.ink;
      const title = headline.trim() || (isRtl ? "خصم على الاشتراك الشهري" : "Save on your monthly plan");
      wrap(g, title, cx, y, w - 160, story ? 92 : 84, (px) => F(px, 900), story ? 108 : 96);

      // ── قيمة الخصم: أبرز ما في الصورة ──
      y += story ? 300 : 250;
      if (offerText) {
        g.fillStyle = B.accent;
        g.font = F(story ? 150 : 128, 900);
        g.fillText(offerText, cx, y);
      }

      // ── الرمز ──
      const qrSize = story ? 480 : 400;
      const qrY = y + (story ? 110 : 80);
      if (code.trim()) {
        const url = await QRCode.toDataURL(link, {
          margin: 1, width: qrSize, errorCorrectionLevel: "M",
          color: { dark: "#0F1516", light: "#FFFFFF" },
        });
        const img = new Image();
        await new Promise((res) => { img.onload = res; img.src = url; });
        const pad = 26;
        roundRect(g, cx - qrSize / 2 - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 34);
        g.fillStyle = "#FFFFFF"; g.fill();
        g.drawImage(img, cx - qrSize / 2, qrY, qrSize, qrSize);
      }

      // ── الكود مكتوباً: لمن يقرأ ولا يمسح ──
      let ty = qrY + qrSize + (story ? 130 : 105);
      if (code.trim()) {
        g.fillStyle = `${B.ink}B3`;
        g.font = F(story ? 40 : 34, 700);
        g.fillText(isRtl ? "امسح الرمز أو استخدم الكود" : "Scan the code or use", cx, ty - (story ? 62 : 52));
        const label = code.toUpperCase();
        g.font = F(story ? 86 : 74, 900);
        const tw = g.measureText(label).width;
        roundRect(g, cx - tw / 2 - 40, ty - (story ? 70 : 60), tw + 80, story ? 106 : 92, 26);
        g.fillStyle = `${B.ink}1F`; g.fill();
        g.lineWidth = 4; g.strokeStyle = `${B.accent}AA`; g.stroke();
        g.fillStyle = B.ink;
        g.fillText(label, cx, ty);
      }

      // ── سطر ختامي ──
      if (sub.trim()) {
        g.fillStyle = `${B.ink}B3`;
        g.font = F(story ? 42 : 36, 700);
        wrap(g, sub.trim(), cx, h - (story ? 150 : 90), w - 200, story ? 42 : 36, (px) => F(px, 700), story ? 56 : 48);
      }
    })();
  }, [brand, size, headline, sub, code, link, offerText, isRtl]);

  const download = (name: string, data: string) => {
    const a = document.createElement("a");
    a.href = data; a.download = name; a.click();
  };
  const savePoster = () => {
    const cv = canvasRef.current; if (!cv) return;
    download(`promo-${code || "adrenaline"}-${size.toLowerCase()}.png`, cv.toDataURL("image/png"));
  };
  const saveQr = async () => {
    if (!code.trim()) return;
    const url = await QRCode.toDataURL(link, { margin: 1, width: 1200, errorCorrectionLevel: "M" });
    download(`qr-${code.toUpperCase()}.png`, url);
  };

  return (
    <div className="p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#0E2A4A]">{t("استوديو الحملات", "Promo Studio")}</h1>
        <p className="text-sm font-bold text-slate-500">
          {t("حوّل كود الخصم إلى منشور جاهز للنشر", "Turn a discount code into a ready-to-post image")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>{t("كود الخصم", "Discount code")}</Label>
              {coupons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {coupons.filter((c) => c.isActive).map((c) => (
                    <button key={c._id} type="button" onClick={() => setCode(String(c.code))}
                      className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-black",
                        code.toUpperCase() === String(c.code).toUpperCase()
                          ? "border-[#0E76AC] bg-[#0E76AC] text-white"
                          : "border-slate-200 bg-white text-slate-600")}>
                      {c.code}
                    </button>
                  ))}
                </div>
              )}
              <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABF91" className="font-black tracking-widest" />
              {code.trim() && !active && (
                <p className="text-xs font-bold text-amber-600">
                  {t("الكود غير موجود — الصورة ستُنشأ لكن لن يعمل عند الدفع",
                     "Code not found — the image will render but won't work at checkout")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("العنوان", "Headline")}</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)}
                placeholder={t("خصم على الاشتراك الشهري", "Save on your monthly plan")} />
            </div>
            <div className="space-y-2">
              <Label>{t("سطر ختامي (اختياري)", "Footer line (optional)")}</Label>
              <Input value={sub} onChange={(e) => setSub(e.target.value)}
                placeholder={t("توصيل يومي في قطر", "Daily delivery across Qatar")} />
            </div>

            <div className="space-y-2">
              <Label>{t("الهوية", "Brand")}</Label>
              <div className="flex gap-2">
                {(Object.keys(BRANDS) as Brand[]).map((k) => (
                  <button key={k} type="button" onClick={() => setBrand(k)}
                    className={cn("flex-1 rounded-xl border px-2 py-2 text-xs font-black",
                      brand === k
                        ? k === "NUTRI_RESET" ? "border-[#22AEC0] bg-[#22AEC0] text-white" : "border-[#0E76AC] bg-[#0E76AC] text-white"
                        : "border-slate-200 bg-white text-slate-600")}>
                    {BRANDS[k].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("المقاس", "Size")}</Label>
              <div className="flex gap-2">
                {(Object.keys(SIZES) as Size[]).map((k) => (
                  <button key={k} type="button" onClick={() => setSize(k)}
                    className={cn("flex-1 rounded-xl border px-2 py-2 text-xs font-black",
                      size === k ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
                    {k === "SQUARE" ? t("منشور", "Post") : t("ستوري", "Story")}
                    <span className="block text-[10px] font-bold opacity-70">{SIZES[k].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Label className="text-[11px]">{t("الرابط الذي يفتحه الرمز", "Link behind the code")}</Label>
              <p dir="ltr" className="mt-1 break-all text-[11px] font-bold text-slate-600">{link}</p>
              <Button variant="outline" size="sm" className="mt-2 h-8 w-full text-xs font-black"
                onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check className="me-1.5 h-3.5 w-3.5" /> : <Copy className="me-1.5 h-3.5 w-3.5" />}
                {copied ? t("تم النسخ", "Copied") : t("انسخ الرابط", "Copy link")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={savePoster} className="h-11 bg-[#0E76AC] font-black hover:bg-[#0a668f]">
                <Download className="me-1.5 h-4 w-4" />{t("نزّل الصورة", "Download image")}
              </Button>
              <Button variant="outline" onClick={saveQr} disabled={!code.trim()} className="h-11 font-black">
                <QrCode className="me-1.5 h-4 w-4" />{t("الرمز فقط", "QR only")}
              </Button>
            </div>
            <p className="text-[11px] font-bold leading-relaxed text-slate-400">
              {t("«الرمز فقط» يُنزّل QR بدقة عالية للمصمّم ليضعه في تصميمه الخاص.",
                 "\"QR only\" downloads a high-resolution code for your designer to place in their own artwork.")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-center p-4">
            <canvas ref={canvasRef}
              className="max-h-[70vh] w-auto rounded-2xl shadow-lg"
              style={{ maxWidth: "100%" }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** مستطيلٌ بأركانٍ دائرية — يُترك المسار مفتوحاً ليملأه المستدعي أو يحدّه. */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * يلفّ النصّ على أسطر داخل عرضٍ محدّد، ويصغّر الخطّ إن طال حتى لا يتجاوز
 * ثلاثة أسطر — فالعنوان الطويل يبقى داخل الصورة بدل أن يقتطعه إطارها.
 */
function wrap(
  g: CanvasRenderingContext2D, text: string, cx: number, y: number,
  maxW: number, px: number, font: (p: number) => string, lineH: number,
) {
  let sizePx = px;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    g.font = font(sizePx);
    lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const probe = line ? `${line} ${word}` : word;
      if (g.measureText(probe).width > maxW && line) { lines.push(line); line = word; }
      else line = probe;
    }
    if (line) lines.push(line);
    if (lines.length <= 3) break;
    sizePx = Math.round(sizePx * 0.86);
    lineH = Math.round(lineH * 0.86);
  }
  lines.forEach((l, i) => g.fillText(l, cx, y + i * lineH));
}
