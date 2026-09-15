// رفع صور منيو الأونلاين بالتصميم الجديد إلى تخزين Convex الإنتاج وربطها بالوجبات.
// node upload-online-images.mjs [--dry]   (يُشغَّل من جذر المشروع حتى يجد npx convex)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const SP = "C:/Users/M/AppData/Local/Temp/claude/E--projects-adrenaline-last/86c8d8a2-6c4f-4744-ae36-d285d386a16e/scratchpad";
const WEB = path.join(SP, "online-web");
const DRY = process.argv.includes("--dry");
const map = JSON.parse(fs.readFileSync(path.join(SP, "online-image-map.json"), "utf8"));
// إكمالات يدوية: الأرز 250 جم يشارك صورة الأرز، والمياه الصغيرة نفس عبوة 500 مل (تأكيد المستخدم في فهرس المكتبة)
const manual = {
  "Rice 250g": "Rice 100g - أرز 100 جم.png",
  "Water Alkaline 500ml": "Alka Live Water 500ml - مياه ألكالايف 500 مل.png",
  "Water alkaline small": "Alka Live Water 500ml - مياه ألكالايف 500 مل.png",
};
const rows = [...map.mapping];
for (const u of map.unmatched) if (manual[u.nameEn]) rows.push({ ...u, file: manual[u.nameEn], how: "manual" });
const skipped = map.unmatched.filter((u) => !manual[u.nameEn]).map((u) => u.nameEn);
const run = (fn, args) => {
  let last;
  for (let i = 1; i <= 4; i++) {
    try { return runOnce(fn, args); } catch (e) { last = e; console.log(`  … retry ${i}/3 ${fn}`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000 * i); }
  }
  throw last;
};
const runOnce = (fn, args) => {
  const out = execFileSync(process.execPath, ["E:/projects/adrenaline-last/node_modules/convex/bin/main.js", "run", fn, JSON.stringify(args ?? {}), "--prod"], { cwd: "E:/projects/adrenaline-last", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const t = out.trim(); const i = t.search(/[{"]/); return JSON.parse(t.slice(i));
};
const logPath = path.join(SP, "online-image-replace-log.json");
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : { uploads: {}, meals: {} };
const distinct = [...new Set(rows.map((r) => r.file))];
console.log(`meals: ${rows.length}, distinct files: ${distinct.length}, skipped (no image): ${skipped.length} → ${skipped.join(" | ")}`);
if (DRY) process.exit(0);
for (const file of distinct) {
  if (log.uploads[file]) continue;
  const webp = path.join(WEB, path.parse(file).name + ".webp");
  if (!fs.existsSync(webp)) throw new Error("missing webp: " + webp);
  const url = run("publicMeals:adminUploadUrl");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/webp" }, body: fs.readFileSync(webp) });
  if (!res.ok) throw new Error("upload failed " + res.status + " " + file);
  const { storageId } = await res.json();
  log.uploads[file] = storageId;
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log("uploaded", file, "→", storageId);
}
for (const r of rows) {
  if (log.meals[r.id]) continue;
  const storageId = log.uploads[r.file];
  const prev = run("publicMeals:adminSetImage", { mealId: r.id, storageId });
  log.meals[r.id] = { nameEn: r.nameEn, file: r.file, storageId, ...prev, at: new Date().toISOString() };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log("set", r.nameEn, "←", r.file);
}
console.log("done. meals updated:", Object.keys(log.meals).length);
