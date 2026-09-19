import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const dryRun = process.argv.includes("--dry");
const forceMealIndex = process.argv.indexOf("--force-meal");
const forceMealId = forceMealIndex >= 0 ? process.argv[forceMealIndex + 1] : null;
const publicDir = path.join(root, "client", "public");
const logPath = path.join(root, "دليل", "صور-المنيو-الجديدة", "سجل-مزامنة-صور-rightful-2026-09-19.json");
const artwork = {
  ...JSON.parse(fs.readFileSync(path.join(root, "shared", "menuArtwork.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root, "shared", "restaurantCatalogArtwork.json"), "utf8")),
};

function convex(args) {
  const output = execFileSync(process.execPath, [path.join(root, "node_modules", "convex", "bin", "main.js"), ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32e6,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const start = output.search(/[\[{\"]/);
  return JSON.parse(output.slice(start));
}

const meals = new Map(convex(["data", "publicMeals", "--limit", "2000", "--format", "json"]).map((meal) => [meal._id, meal]));
const rows = [];
for (const [mealId, relativePath] of Object.entries(artwork)) {
  const meal = meals.get(mealId);
  const absolutePath = path.join(publicDir, relativePath);
  if (!meal?.isActive || !fs.existsSync(absolutePath)) continue;
  rows.push({ mealId, nameEn: meal.nameEn, relativePath, absolutePath });
}

const log = fs.existsSync(logPath)
  ? JSON.parse(fs.readFileSync(logPath, "utf8"))
  : { deployment: "rightful-parakeet-660", uploads: {}, meals: {} };
if (forceMealId) {
  const forcedRow = rows.find((row) => row.mealId === forceMealId);
  if (!forcedRow) throw new Error(`active mapped meal not found: ${forceMealId}`);
  delete log.uploads[forcedRow.relativePath];
  delete log.meals[forceMealId];
  console.log(`forcing fresh upload and relink: ${forcedRow.nameEn}`);
}
const distinctPaths = [...new Set(rows.map((row) => row.relativePath))];
console.log(`active cards: ${rows.length}; distinct new-design images: ${distinctPaths.length}`);
if (dryRun) process.exit(0);

for (const relativePath of distinctPaths) {
  if (log.uploads[relativePath]) continue;
  const row = rows.find((candidate) => candidate.relativePath === relativePath);
  const uploadUrl = convex(["run", "publicMeals:adminUploadUrl"]);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: fs.readFileSync(row.absolutePath),
  });
  if (!response.ok) throw new Error(`upload failed ${response.status}: ${relativePath}`);
  log.uploads[relativePath] = (await response.json()).storageId;
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log("uploaded", relativePath);
}

for (const row of rows) {
  if (log.meals[row.mealId]) continue;
  const storageId = log.uploads[row.relativePath];
  const previous = convex(["run", "publicMeals:adminSetImage", JSON.stringify({ mealId: row.mealId, storageId })]);
  log.meals[row.mealId] = { nameEn: row.nameEn, file: row.relativePath, storageId, ...previous, at: new Date().toISOString() };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log("linked", row.nameEn);
}

console.log(`done: ${Object.keys(log.meals).length} cards linked to new-design artwork`);
