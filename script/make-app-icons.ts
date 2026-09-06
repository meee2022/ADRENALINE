/**
 * @file script/make-app-icons.ts
 * @description يولّد أيقونات التطبيق (iOS + أندرويد + متجر بلاي) من شعار الموقع.
 *
 *   ═══ لماذا لا نُكبّر الصورة مباشرةً؟ ═══
 *   ملف الشعار 676×166 بكسل، وتكبيره إلى 1024 يُموّه الحواف فتبدو الأيقونة رديئة.
 *   الشعار شكلٌ مسطّح بلون واحد وحوافٍّ حادّة، فنعامله معاملة الفيكتور: نأخذ قناع
 *   الشفافية، نُكبّره ونقصّه ثنائياً في دقة ستة أضعاف، ثم نُصغّره بترشيح ناعم —
 *   فتُحسب الحواف عند المقاس النهائي بدل أن تُمطّ من الأصل. وكل مقاس يُرسم من
 *   الأصل لا من صورة كبيرة مُصغَّرة.
 *
 *   ═══ لماذا بلا سطر HEALTHY FOOD؟ ═══
 *   قِيس في الحجم الحقيقي: يختفي تماماً تحت 60 بكسل، فيُضيف تشويشاً لا معنى.
 *
 *   التشغيل:  npx tsx script/make-app-icons.ts
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const p = (...s: string[]) => path.join(ROOT, ...s);

/** خلفية الأيقونة — غيّرها هنا فقط (ولون أندرويد التكيّفي أدناه معها). */
const BG = { r: 255, g: 255, b: 255, alpha: 1 };
const BG_HEX = "#FFFFFF";
const WORD_COLOR = { r: 60, g: 196, b: 240 };
const HEART_COLOR = { r: 58, g: 199, b: 244 };

const LOGO = p("client", "public", "adrenaline-logo-full.png");
const HEART = p("client", "public", "heart-logo.png");

type Flat = { input: Buffer; width: number; height: number };

/** يرسم شكلاً مسطّحاً بلون واحد في العرض المطلوب بحوافٍّ حادّة (يحاكي الفيكتور). */
async function crisp(
  src: sharp.Sharp,
  targetW: number,
  color: { r: number; g: number; b: number },
  ss = 6,
): Promise<Flat> {
  const meta = await src.clone().metadata();
  const ratio = (meta.height || 1) / (meta.width || 1);
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round(w * ratio));

  const mask = await src
    .clone()
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(w * ss, Math.max(1, Math.round(w * ss * ratio)), { kernel: "cubic" })
    .threshold(128)
    .resize(w, h, { kernel: "lanczos3" })
    .raw()
    .toBuffer();

  const input = await sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .joinChannel(mask, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();

  return { input, width: w, height: h };
}

/** الشعار بلا سطر HEALTHY FOOD — أعلى 66% من الملف. */
async function wordMark(): Promise<sharp.Sharp> {
  const m = await sharp(LOGO).metadata();
  return sharp(LOGO).extract({
    left: 0,
    top: 0,
    width: m.width!,
    height: Math.round(m.height! * 0.66),
  });
}

/** أيقونة مربّعة: الاسم وتحته القلب، مع خلفية أو بشفافية (للطبقة التكيّفية). */
async function build(S: number, withBg: boolean): Promise<Buffer> {
  const word = await crisp(await wordMark(), Math.round(S * 0.84), WORD_COLOR);
  const heart = await crisp(sharp(HEART), Math.round(S * 0.42), HEART_COLOR);
  const gap = Math.max(1, Math.round(S * 0.05));
  const top = Math.round((S - (word.height + gap + heart.height)) / 2);

  return sharp({
    create: {
      width: S,
      height: S,
      channels: 4,
      background: withBg ? BG : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: word.input, top, left: Math.round((S - word.width) / 2) },
      { input: heart.input, top: top + word.height + gap, left: Math.round((S - heart.width) / 2) },
    ])
    .png()
    .toBuffer();
}

async function circleCrop(buf: Buffer, S: number): Promise<Buffer> {
  const circle = Buffer.from(
    `<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`,
  );
  return sharp(buf).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
}

async function main(): Promise<void> {
  // ── iOS: 1024 بلا قناة شفافية (آبل ترفض الشفافية في أيقونة المتجر) ──
  await sharp(await build(1024, true))
    .removeAlpha()
    .png()
    .toFile(p("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"));

  // ── أندرويد: مربّعة + دائرية + طبقة أمامية تكيّفية ──
  const densities: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(densities)) {
    const dir = p("android", "app", "src", "main", "res", `mipmap-${d}`);
    const icon = await build(s, true);
    await sharp(icon).removeAlpha().png().toFile(path.join(dir, "ic_launcher.png"));
    await writeFile(path.join(dir, "ic_launcher_round.png"), await circleCrop(icon, s));

    // الطبقة الأمامية 108dp والمحتوى داخل 66% منها، وإلا قصّته أشكال المشغّلات
    const fs = Math.round((s * 108) / 48);
    const innerSize = Math.round(fs * 0.66);
    const inner = await build(innerSize, false);
    const off = Math.round((fs - innerSize) / 2);
    await sharp({ create: { width: fs, height: fs, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: inner, top: off, left: off }])
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));
  }

  await writeFile(
    p("android", "app", "src", "main", "res", "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG_HEX}</color>\n</resources>\n`,
    "utf8",
  );

  // ── أيقونة متجر بلاي 512 ──
  const store = await sharp(await build(512, true)).removeAlpha().png().toBuffer();
  await writeFile(p("android", "play-store-icon-512.png"), store);
  await mkdir(p(".play-assets"), { recursive: true });
  await writeFile(p(".play-assets", "store-icon-512.png"), store);

  console.log("✅ أيقونات iOS وأندرويد ومتجر بلاي تولّدت من الشعار.");
}

await main();
