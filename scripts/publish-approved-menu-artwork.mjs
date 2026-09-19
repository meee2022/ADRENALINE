import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const repo = process.cwd();
const marketingRoot = "O:\\الخاص\\شغلي\\abeer adrenaline\\ADRENALINE - محتوى تسويقي";
const onlineDir = path.join(marketingRoot, "01 - صور الوجبات", "01 - التصميم الجديد - أونلاين");
const referenceDir = path.join(marketingRoot, "01 - صور الوجبات", "09 - الفهرس والسجلات");

const approved = [
  ["Pistachio Lava Cake", "كيكة اللافا بالفستق", "exec-03ee16c5-ff1e-4501-97ab-b97ff3ea8301.png"],
  ["Hazelnut Lava Cake", "كيكة اللافا بالبندق", "exec-559887bd-6724-41b4-bb84-d6f126a894f8.png"],
  ["Blueberry Muffin", "مافن التوت الأزرق", "exec-927a01b9-f874-4c2c-a741-177621b0c58f.png"],
  ["Talbina Majdoul", "تلبينة المجهول", "exec-d7ddef7e-15bd-46a3-8f34-e90062bca543.png"],
  ["Rice Pudding", "بودينغ الأرز", "exec-3faed992-8e85-4374-b74a-9641f239dcd3.png"],
  ["Fresh Pineapple Cut", "أناناس طازج مقطع", "exec-b76e4951-2f4c-4d98-b200-b12540149d18.png"],
  ["Fresh Mandarin with Pomegranate", "يوسفي طازج مع الرمان", "exec-c98fa293-fba6-4d8b-a452-ec97c90aa27f.png"],
  ["Mix Pomegranate&pineapple", "مزيج الرمان والأناناس", "exec-16ff20bc-f8ed-4e6c-956e-87b634981c75.png"],
  ["Pomegranate", "رمان", "exec-108a207d-5e7b-4714-b045-f5307f8e19db.png"],
  ["Pecan with Chocolate", "بيكان بالشوكولاتة", "exec-ccb8c587-e375-4ef1-ba11-8ffba04f4068.png"],
  ["Greek Infusion", "جرِيك إنفيوجن", "exec-e45b92d3-2270-4e50-a7b4-a603663326de.png"],
  ["Mix Strawberry & Blueberry", "مزيج الفراولة والتوت الأزرق", "exec-ae9781f4-2a4b-4d8d-a75c-203b73149c16.png"],
  ["Raspberry Rice Pudding", "بودينغ الأرز بالتوت", "exec-872a66f2-8b5f-4efe-8f3f-6ff6c4b97cfa.png"],
];

const generatedDir = path.join(
  process.env.USERPROFILE,
  ".codex",
  "generated_images",
  "019fd1b2-6f01-7433-bb6a-8fa4bd48f4ff",
);
const mappingText = fs.readFileSync(path.join(repo, "client", "src", "lib", "posMealImages.ts"), "utf8");
const idToArtwork = new Map(
  [...mappingText.matchAll(/"(kh[a-z0-9]+)":\s*"([^"]+\.webp)"/g)].map((match) => [match[1], match[2]]),
);
const published = [];

for (const [english, arabic, generatedFile] of approved) {
  const generatedPath = path.join(generatedDir, generatedFile);
  if (!fs.existsSync(generatedPath)) throw new Error(`Missing generated asset: ${generatedPath}`);

  const bilingualName = `${english} - ${arabic}.png`;
  const sourcePath = path.join(onlineDir, bilingualName);
  fs.copyFileSync(generatedPath, sourcePath);

  const webp = await sharp(generatedPath)
    .resize(1280, 1280, { fit: "cover", position: "centre" })
    .webp({ quality: 92, effort: 6 })
    .toBuffer();
  const thumbnailPath = path.join(repo, "client", "public", "pos-meals", "thumbs", `${english}.webp`);
  fs.writeFileSync(thumbnailPath, webp);

  const catalogIds = [...idToArtwork.entries()]
    .filter(([, filename]) => filename === `${english}.webp`)
    .map(([id]) => id);
  for (const id of catalogIds) {
    fs.writeFileSync(path.join(repo, "client", "public", "restaurant-catalog", `${id}.webp`), webp);
  }

  published.push({
    nameEn: english,
    nameAr: arabic,
    approvedFile: bilingualName,
    source: sourcePath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
    catalogIds,
    visualStandard: "light warm-gray speckled ceramic; pale cool white-gray studio background; no wood/plastic",
  });
}

// These files were already visually compliant in the marketing library, but the
// website was still linked to older Convex copies. Republish the approved source
// without regenerating it so the library remains the single source of truth.
for (const [english, arabic] of [
  ["Basbousa Coconut", "بسبوسة جوز الهند"],
  ["Basbousa Pistachio", "بسبوسة الفستق"],
]) {
  const bilingualName = `${english} - ${arabic}.png`;
  const sourcePath = path.join(onlineDir, bilingualName);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing approved source: ${sourcePath}`);
  const webp = await sharp(sourcePath)
    .resize(1280, 1280, { fit: "cover", position: "centre" })
    .webp({ quality: 92, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(repo, "client", "public", "pos-meals", "thumbs", `${english}.webp`), webp);
  const catalogIds = [...idToArtwork.entries()]
    .filter(([, filename]) => filename === `${english}.webp`)
    .map(([id]) => id);
  for (const id of catalogIds) {
    fs.writeFileSync(path.join(repo, "client", "public", "restaurant-catalog", `${id}.webp`), webp);
  }
  published.push({
    nameEn: english,
    nameAr: arabic,
    approvedFile: bilingualName,
    source: sourcePath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
    catalogIds,
    visualStandard: "existing approved light ceramic artwork; force-republished to replace stale Convex copy",
  });
}

fs.mkdirSync(referenceDir, { recursive: true });
const manifestPath = path.join(referenceDir, "سجل الصور المعتمدة - Approved Artwork.json");
fs.writeFileSync(
  manifestPath,
  JSON.stringify({ updatedAt: new Date().toISOString(), language: "Arabic + English", images: published }, null, 2),
);

const imageLibraryFolders = [
  ["online", "أونلاين / Online", onlineDir],
  [
    "subscriber",
    "مشتركين / Subscribers",
    path.join(marketingRoot, "01 - صور الوجبات", "02 - التصميم الجديد - مشتركين (عريض)"),
  ],
];
const libraryRows = imageLibraryFolders.flatMap(([channel, channelLabel, directory]) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
    .map((entry) => {
      const relative = path.relative(referenceDir, path.join(directory, entry.name)).split(path.sep).join("/");
      const title = path.parse(entry.name).name;
      return { channel, channelLabel, title, relative };
    }),
);
const cards = libraryRows
  .map(
    (row) => `<article data-channel="${row.channel}" data-search="${row.title.toLowerCase()}">
  <img loading="lazy" src="${encodeURI(row.relative)}" alt="${row.title.replaceAll('"', '&quot;')}">
  <h2>${row.title}</h2><span>${row.channelLabel}</span>
</article>`,
  )
  .join("\n");
const libraryHtml = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>مكتبة صور المنيو / Menu Artwork Library</title>
<style>body{font:15px Arial,sans-serif;background:#f4f7f7;color:#173849;margin:0;padding:24px}header{position:sticky;top:0;background:#f4f7f7eF;padding:0 0 18px;z-index:2}h1{margin:0 0 6px}p{margin:4px 0 12px;color:#567}input{box-sizing:border-box;width:100%;max-width:700px;padding:13px 16px;border:1px solid #aacbd0;border-radius:12px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}article{background:#fff;border:1px solid #c8e1e4;padding:10px;border-radius:16px;box-shadow:0 5px 18px #1232}img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:11px;background:#eef2f3}h2{font-size:15px;margin:10px 2px 5px;line-height:1.5}span{font-size:12px;color:#078a93}article[hidden]{display:none}</style>
<header><h1>مكتبة صور المنيو / Menu Artwork Library</h1><p>${libraryRows.length} صورة معتمدة — الأسماء بالعربية والإنجليزية — آخر تحديث ${new Date().toLocaleString("ar-QA")}</p><input id="q" placeholder="ابحث بالعربي أو الإنجليزي / Search Arabic or English"></header>
<main>${cards}</main><script>q.oninput=()=>{const s=q.value.trim().toLowerCase();document.querySelectorAll('article').forEach(x=>x.hidden=s&&!x.dataset.search.includes(s))}</script></html>`;
fs.writeFileSync(path.join(referenceDir, "افتح مكتبة الصور.html"), libraryHtml);
console.log(JSON.stringify({ published: published.length, manifestPath, images: published }, null, 2));
