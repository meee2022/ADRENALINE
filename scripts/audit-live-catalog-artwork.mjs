import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const marketingRoot = "O:\\الخاص\\شغلي\\abeer adrenaline\\ADRENALINE - محتوى تسويقي\\01 - صور الوجبات";
const groups = {
  approved: ["01 - التصميم الجديد - أونلاين", "02 - التصميم الجديد - مشتركين (عريض)"],
  legacy: ["05 - التصميم القديم - مشتركين (استوديو)", "06 - التصميم القديم - أونلاين"],
};
const outDir = path.join(marketingRoot, "09 - الفهرس والسجلات");

async function dHash(input) {
  const { data } = await sharp(input).rotate().resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let value = 0n;
  let bit = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (data[y * 9 + x] > data[y * 9 + x + 1]) value |= 1n << bit;
    bit++;
  }
  return value;
}
function distance(a, b) {
  let n = a ^ b;
  let count = 0;
  while (n) { count += Number(n & 1n); n >>= 1n; }
  return count;
}
async function indexFolders(names, kind) {
  const rows = [];
  for (const folder of names) {
    const dir = path.join(marketingRoot, folder);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
      const file = path.join(dir, entry.name);
      try { rows.push({ kind, folder, file, name: entry.name, hash: await dHash(file) }); } catch {}
    }
  }
  return rows;
}

const body = JSON.stringify({ path: "restaurantCatalog:list", args: {} });
const response = await fetch("https://rightful-parakeet-660.convex.cloud/api/query", {
  method: "POST", headers: { "content-type": "application/json" }, body,
});
const payload = await response.json();
if (payload.status !== "success") throw new Error(payload.errorMessage || "catalog query failed");

const references = [
  ...(await indexFolders(groups.approved, "approved")),
  ...(await indexFolders(groups.legacy, "legacy")),
];
const results = [];
for (const card of payload.value) {
  if (!card.image) {
    results.push({ en: card.en, ar: card.ar, channels: card.channels, sourceIds: card.sourceIds, status: "missing", image: null });
    continue;
  }
  try {
    const bytes = Buffer.from(await (await fetch(card.image)).arrayBuffer());
    const hash = await dHash(bytes);
    const ranked = references.map((ref) => ({ ...ref, distance: distance(hash, ref.hash) })).sort((a, b) => a.distance - b.distance);
    const bestApproved = ranked.find((x) => x.kind === "approved");
    const bestLegacy = ranked.find((x) => x.kind === "legacy");
    const status = bestLegacy.distance <= 8 && bestLegacy.distance + 2 < bestApproved.distance ? "legacy" : "review";
    results.push({
      en: card.en, ar: card.ar, channels: card.channels, sourceIds: card.sourceIds, image: card.image, status,
      nearestApproved: { name: bestApproved.name, distance: bestApproved.distance },
      nearestLegacy: { name: bestLegacy.name, distance: bestLegacy.distance },
    });
  } catch (error) {
    results.push({ en: card.en, ar: card.ar, channels: card.channels, sourceIds: card.sourceIds, image: card.image, status: "error", error: String(error) });
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    cards: results.length,
    missing: results.filter((x) => x.status === "missing").length,
    legacyMatches: results.filter((x) => x.status === "legacy").length,
  },
  legacy: results.filter((x) => x.status === "legacy"),
  missing: results.filter((x) => x.status === "missing"),
  all: results,
};
fs.writeFileSync(path.join(outDir, "تدقيق صور المنيو الحية - Live Artwork Audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ totals: report.totals, legacy: report.legacy, missing: report.missing }, null, 2));
