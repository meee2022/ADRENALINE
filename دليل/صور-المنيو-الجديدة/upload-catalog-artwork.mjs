// رفع صور التصميم الجديد (الأطباق على الخلفية الفاتحة) إلى تخزين Convex الإنتاج لبطاقات المشتركين والمنافذ،
// حتى يقرأ الموقع والتطبيق كل الصور من الخادم بدل الملفات المدموجة في الكود.
// لا يغيّر إلا storageId للبطاقة، ويسجّل الصورة السابقة لكل بطاقة للتراجع.
//   node "دليل/صور-المنيو-الجديدة/upload-catalog-artwork.mjs" --dry     ← عرض ما سيحدث فقط
//   node "دليل/صور-المنيو-الجديدة/upload-catalog-artwork.mjs"           ← التنفيذ (يُستأنف لو انقطع)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const ROOT = "E:/projects/adrenaline-last";
const DRY = process.argv.includes("--dry");
const here = path.join(ROOT, "دليل/صور-المنيو-الجديدة");
const logPath = path.join(here, "سجل-رفع-صور-الكتالوج.json");
const onlineLog = JSON.parse(fs.readFileSync(path.join(here, "سجل-استبدال-صور-الأونلاين-2026-09-15.json"), "utf8"));
const art = { ...JSON.parse(fs.readFileSync(path.join(ROOT, "shared/menuArtwork.json"), "utf8")), ...JSON.parse(fs.readFileSync(path.join(ROOT, "shared/restaurantCatalogArtwork.json"), "utf8")) };

const runOnce = (args) => {
  const out = execFileSync(process.execPath, [path.join(ROOT, "node_modules/convex/bin/main.js"), ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 32e6, stdio: ["ignore", "pipe", "pipe"] });
  const t = out.trim(); return JSON.parse(t.slice(t.search(/[\[{"]/)));
};
const run = (fn, a) => {
  let last;
  for (let i = 1; i <= 4; i++) {
    try { return runOnce(["run", fn, JSON.stringify(a ?? {}), "--prod"]); }
    catch (e) { last = e; console.log(`  … retry ${i}/3 ${fn}`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000 * i); }
  }
  throw last;
};

const meals = new Map(runOnce(["data", "publicMeals", "--deployment-name", "laudable-mongoose-958", "--limit", "2000", "--format", "json"]).map((r) => [r._id, r]));
// بطاقات الأونلاين أخذت صورها الجديدة في 2026-09-15 — لا تُلمس ما دامت على نفس الصورة.
const alreadyNew = new Set(Object.values(onlineLog.meals || {}).map((m) => m.storageId));
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : { uploads: {}, meals: {} };
const rows = [], skipped = { missingMeal: [], inactive: [], missingFile: [], alreadyNew: [] };
for (const [id, file] of Object.entries(art)) {
  const m = meals.get(id), abs = path.join(ROOT, "client/public", file);
  if (!m) skipped.missingMeal.push(id);
  else if (!m.isActive) skipped.inactive.push(m.nameEn);
  else if (!fs.existsSync(abs)) skipped.missingFile.push(m.nameEn + " " + file);
  else if (m.storageId && (alreadyNew.has(m.storageId) || Object.values(log.uploads).includes(m.storageId))) skipped.alreadyNew.push(m.nameEn);
  else rows.push({ id, nameEn: m.nameEn, file, abs });
}
const distinct = [...new Set(rows.map((r) => r.file))];
console.log(`to update: ${rows.length} cards from ${distinct.length} files`);
for (const [k, v] of Object.entries(skipped)) console.log(`skip ${k}: ${v.length}${v.length && k !== "alreadyNew" ? " → " + v.join(" | ") : ""}`);
if (DRY) process.exit(0);

for (const r of rows) {
  if (log.uploads[r.file]) continue;
  const url = run("publicMeals:adminUploadUrl");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/webp" }, body: fs.readFileSync(r.abs) });
  if (!res.ok) throw new Error("upload failed " + res.status + " " + r.file);
  log.uploads[r.file] = (await res.json()).storageId;
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log("uploaded", r.file);
}
for (const r of rows) {
  if (log.meals[r.id]) continue;
  const prev = run("publicMeals:adminSetImage", { mealId: r.id, storageId: log.uploads[r.file] });
  log.meals[r.id] = { nameEn: r.nameEn, file: r.file, storageId: log.uploads[r.file], ...prev, at: new Date().toISOString() };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log("set", r.nameEn);
}
console.log("done. cards updated:", Object.keys(log.meals).length);
