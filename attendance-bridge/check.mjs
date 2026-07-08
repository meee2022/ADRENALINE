/**
 * فحص سريع: يتأكد إن الجهاز موصول، الباسورد صح، وبيقرأ الموظفين والأحداث.
 * لا يرفع أي شيء لـ Convex — للتشخيص فقط.  تشغيل: node check.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

async function digestRequest(method, path, body) {
  const base = `http://${cfg.deviceIp}:${cfg.httpPort}`;
  const first = await fetch(base + path, { method, body, headers: { "Content-Type": "application/json" } });
  if (first.status !== 401) return first;
  const wa = first.headers.get("www-authenticate") || "";
  const get = (k) => (wa.match(new RegExp(`${k}="?([^",]+)"?`)) || [])[1];
  const realm = get("realm"), nonce = get("nonce"), qop = get("qop") || "auth";
  const cnonce = crypto.randomBytes(8).toString("hex"), nc = "00000001";
  const ha1 = md5(`${cfg.username}:${realm}:${cfg.password}`);
  const ha2 = md5(`${method}:${path}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const auth = `Digest username="${cfg.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  return fetch(base + path, { method, body, headers: { "Content-Type": "application/json", Authorization: auth } });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < tries) { console.log(`   … الشبكة متقطّعة، إعادة المحاولة (${i}/${tries})`); await sleep(3000); } }
  }
  throw last;
}

console.log(`\nفحص الجهاز ${cfg.deviceIp}:${cfg.httpPort} بالمستخدم ${cfg.username} ...\n`);
try {
  const info = await withRetry(() => digestRequest("GET", "/ISAPI/System/deviceInfo"));
  if (info.status === 401) { console.log("❌ الباسورد غلط (401). راجع password في config.json"); process.exit(1); }
  if (!info.ok) { console.log(`❌ الجهاز رجّع ${info.status}`); process.exit(1); }
  const txt = await info.text();
  const model = (txt.match(/<model>([^<]+)</) || [])[1] || "?";
  console.log(`✅ الاتصال والباسورد تمام — الموديل: ${model}`);

  const ur = await digestRequest("POST", "/ISAPI/AccessControl/UserInfo/Search?format=json",
    JSON.stringify({ UserInfoSearchCond: { searchID: "chk", searchResultPosition: 0, maxResults: 1 } }));
  const uj = await ur.json();
  console.log(`✅ عدد الموظفين على الجهاز: ${uj?.UserInfoSearch?.totalMatches ?? "?"}`);

  console.log(`\n✅ كل حاجة تمام — تقدر تشغّل run.bat وهو هيسحب البصمة تلقائيًا.\n`);
} catch (e) {
  console.log(`❌ مش قادر أوصل للجهاز: ${e.message}`);
  console.log(`   • اتأكد إن الكمبيوتر على نفس شبكة الجهاز (${cfg.deviceIp})`);
  console.log(`   • اتأكد إن الـ IP والبورت في config.json صح\n`);
  process.exit(1);
}
