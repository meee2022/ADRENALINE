/**
 * أصول تطبيق Expo (apps/mobile/assets): أيقونة، طبقة تكيّفية، سبلاش، فافيكون.
 * نفس قناع الشعار الحادّ الذي يولّد أيقونات iOS/Android (script/make-app-icons.ts).
 *   npx tsx script/make-mobile-assets.ts
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const p = (...s: string[]) => path.join(process.cwd(), ...s);
const OUT = p("apps", "mobile", "assets");
const LOGO = p("client", "public", "adrenaline-logo-full.png");
const HEART = p("client", "public", "heart-logo.png");
const CYAN = { r: 60, g: 196, b: 240 };
const WHITE = { r: 255, g: 255, b: 255 };
const NAVY = "#0B2138";

type Flat = { input: Buffer; width: number; height: number };
async function crisp(src: sharp.Sharp, srcW: number, srcH: number, targetW: number, color: { r: number; g: number; b: number }, ss = 6): Promise<Flat> {
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round(w * (srcH / srcW)));
  const mask = await src.clone().ensureAlpha().extractChannel("alpha")
    .resize(w * ss, Math.max(1, Math.round(h * ss)), { kernel: "cubic", fit: "fill" })
    .threshold(128).resize(w, h, { kernel: "lanczos3", fit: "fill" }).raw().toBuffer();
  const input = await sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .joinChannel(mask, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  return { input, width: w, height: h };
}
async function wordMark() {
  const m = await sharp(LOGO).metadata();
  const w = m.width!, h = Math.round(m.height! * 0.66);
  return { img: sharp(LOGO).extract({ left: 0, top: 0, width: w, height: h }), w, h };
}

/** الاسم وتحته القلب داخل مربّع S — بخلفية بيضاء (أيقونة) أو شفافة (سبلاش/تكيّفية) وبلون للاسم. */
async function stack(S: number, wordColor: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number; alpha: number }, scale = 0.84) {
  const wm = await wordMark();
  const hm = await sharp(HEART).metadata();
  const word = await crisp(wm.img, wm.w, wm.h, Math.round(S * scale), wordColor);
  const heart = await crisp(sharp(HEART), hm.width!, hm.height!, Math.round(S * scale * 0.5), CYAN);
  const gap = Math.round(S * 0.05);
  const top = Math.round((S - (word.height + gap + heart.height)) / 2);
  return sharp({ create: { width: S, height: S, channels: 4, background: bg } })
    .composite([
      { input: word.input, top, left: Math.round((S - word.width) / 2) },
      { input: heart.input, top: top + word.height + gap, left: Math.round((S - heart.width) / 2) },
    ]).png().toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  fs.writeFileSync(path.join(OUT, "icon.png"), await stack(1024, CYAN, white));
  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), await stack(1024, CYAN, clear, 0.62));
  // السبلاش: اسم أبيض وقلب سماوي على شفاف — الخلفية الكحلية من app.json
  fs.writeFileSync(path.join(OUT, "splash-icon.png"), await stack(1024, WHITE, clear, 0.7));
  // الاسم وحده (بلا قلب) لرأس الشاشات — أبيض على الكحلي، وسماوي على الأبيض
  for (const [name, color] of [["wordmark-white.png", WHITE], ["wordmark-cyan.png", CYAN]] as const) {
    const wm = await wordMark();
    const word = await crisp(wm.img, wm.w, wm.h, 1024, color);
    fs.writeFileSync(path.join(OUT, name), await sharp({ create: { width: word.width, height: word.height, channels: 4, background: clear } }).composite([{ input: word.input, top: 0, left: 0 }]).png().toBuffer());
  }
  // الشعار الكامل (الاسم + HEALTHY FOOD) للسبلاش الكحلي: الاسم سماوي والسطر أبيض بدل الأسود
  {
    const m = await sharp(LOGO).metadata();
    const W = m.width!, H = m.height!, cut = Math.round(H * 0.66);
    const word = await crisp(sharp(LOGO).extract({ left: 0, top: 0, width: W, height: cut }), W, cut, 1024, CYAN);
    const tag = await crisp(sharp(LOGO).extract({ left: 0, top: cut, width: W, height: H - cut }), W, H - cut, 1024, WHITE);
    fs.writeFileSync(path.join(OUT, "brand-wordmark-navy.png"), await sharp({ create: { width: 1024, height: word.height + tag.height, channels: 4, background: clear } })
      .composite([{ input: word.input, top: 0, left: 0 }, { input: tag.input, top: word.height, left: 0 }]).png().toBuffer());
  }
  fs.writeFileSync(path.join(OUT, "favicon.png"), await sharp(await stack(1024, CYAN, white)).resize(48, 48).png().toBuffer());
  console.log("mobile assets written →", OUT, "| splash bg", NAVY);
}
main();
