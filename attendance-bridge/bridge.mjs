/**
 * جسر بصمة أدرينالين — Hikvision ISAPI → Convex
 * يسحب سجلّات الحضور من جهاز البصمة (بروتوكول ISAPI / Digest) ويبعتها لنظام أدرينالين.
 * تشغيل: node bridge.mjs   (يفضل شغّال، يسحب كل intervalMinutes دقيقة)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const STATE = new URL("./state.json", import.meta.url);
const LOG = new URL("./bridge.log", import.meta.url);      // سجل يقدر أي حد يفتحه ويتأكد إنه بيسحب
const STATUS = new URL("./status.json", import.meta.url);  // آخر حالة (للعرض السريع)

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const importFn = makeFunctionReference("attendance:importPunchesDevice");
const convex = new ConvexHttpClient(cfg.convexUrl);

// يكتب في الشاشة + في ملف bridge.log (مع تحديد الحجم) عشان يبقى فيه دليل فعلي حتى لو شغّال مخفي
function log(...a) {
  const line = `${new Date().toLocaleString()} | ${a.join(" ")}`;
  console.log(line);
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1_000_000) fs.writeFileSync(LOG, ""); // تصفير لو كبر
    fs.appendFileSync(LOG, line + "\n");
  } catch {}
}
// يسجّل آخر حالة في ملف صغير (لعرضها في زرار "حالة الجسر")
function writeStatus(obj) {
  try { fs.writeFileSync(STATUS, JSON.stringify({ ...obj, at: new Date().toLocaleString() }, null, 2)); } catch {}
}

// ---- HTTP Digest auth (Hikvision ISAPI) — بمهلة زمنية لكل طلب ----
const REQ_TIMEOUT = 25000; // 25 ثانية لكل طلب — يمنع التعليق للأبد لو الشبكة قطعت
async function digestRequest(method, path, body) {
  const base = `http://${cfg.deviceIp}:${cfg.httpPort}`;
  const opts = () => ({ method, body, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(REQ_TIMEOUT) });
  const first = await fetch(base + path, opts());
  if (first.status !== 401) return first;
  const wa = first.headers.get("www-authenticate") || "";
  const get = (k) => (wa.match(new RegExp(`${k}="?([^",]+)"?`)) || [])[1];
  const realm = get("realm"), nonce = get("nonce"), qop = get("qop") || "auth", opaque = get("opaque");
  const cnonce = crypto.randomBytes(8).toString("hex"), nc = "00000001";
  const ha1 = md5(`${cfg.username}:${realm}:${cfg.password}`);
  const ha2 = md5(`${method}:${path}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  let auth = `Digest username="${cfg.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (opaque) auth += `, opaque="${opaque}"`;
  const o = opts(); o.headers.Authorization = auth;
  return fetch(base + path, o);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// إعادة المحاولة تلقائيًا عند تقطّع الشبكة أو 401 لحظي (الجهاز بيتخنق من الطلبات السريعة أحيانًا).
// بنعيد الـhandshake من جديد في كل محاولة (nonce جديد) فالـ401 المؤقت بيتصلح.
async function req(method, path, body, tries = 6) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await digestRequest(method, path, body);
      if (r.ok) return r;                 // 200 = تمام
      last = new Error(`HTTP ${r.status}`); // بما فيها 401 اللحظي → نعيد المحاولة
    } catch (e) { last = e; }
    if (i < tries) { log(`   … تعذّر مؤقتًا، إعادة المحاولة (${i}/${tries - 1})`); await sleep(3000); }
  }
  throw last;
}

const pad = (n) => String(n).padStart(2, "0");
function isoLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${cfg.timezone}`;
}

// ---- اجلب قائمة الموظفين (رقم → اسم) — أحداث الجهاز فيها الرقم فقط بدون الاسم ----
async function fetchUsers() {
  const map = {};
  let pos = 0;
  for (let guard = 0; guard < 100; guard++) {
    const body = JSON.stringify({ UserInfoSearchCond: { searchID: "adrusr", searchResultPosition: pos, maxResults: 50 } });
    const res = await req("POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", body);
    if (!res.ok) break;
    const json = await res.json();
    const s = json.UserInfoSearch || {};
    const list = s.UserInfo || [];
    for (const u of list) {
      const no = String(u.employeeNo ?? "").trim();
      const nm = String(u.name ?? "").trim();
      if (no && nm) map[no] = nm;
    }
    pos += list.length;
    if (s.responseStatusStrg !== "MORE" || list.length === 0 || pos >= (s.totalMatches || 0)) break;
  }
  return map;
}

// ---- اسحب أحداث الحضور من الجهاز في فترة (يحوّل رقم الموظف لاسمه) ----
async function fetchEvents(startTime, endTime, users = {}) {
  const punches = [];
  let pos = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const body = JSON.stringify({
      AcsEventCond: { searchID: "adr", searchResultPosition: pos, maxResults: 50, major: 0, minor: 0, startTime, endTime },
    });
    const res = await req("POST", "/ISAPI/AccessControl/AcsEvent?format=json", body); // req بيعيد المحاولة على 401 اللحظي
    if (!res.ok) throw new Error(`الجهاز رجّع خطأ ${res.status}`);
    await sleep(120); // مهلة بسيطة بين الطلبات عشان ميخنقش الجهاز
    const json = await res.json();
    const ev = json.AcsEvent || {};
    const list = ev.InfoList || [];
    for (const it of list) {
      const t = it.time; // e.g. 2026-07-06T05:08:32+08:00 — ناخد وقت وتاريخ الجهاز المحلي كما هو
      const empNo = String(it.employeeNoString ?? it.employeeNo ?? "").trim();
      // الاسم من قائمة الموظفين (بالرقم)، وإلا الاسم المضمّن، وإلا الرقم نفسه
      const empName = users[empNo] || (it.name || "").trim() || empNo;
      if (!t || !empName) continue;
      const date = t.slice(0, 10);
      const time = t.slice(11, 16);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) continue;
      punches.push({ name: empName, date, time });
    }
    const total = ev.totalMatches || 0;
    const prev = pos;
    pos += list.length;
    if (total > 200 && Math.floor(pos / 200) > Math.floor(prev / 200)) log(`   … جاري القراءة ${pos}/${total}`);
    if (ev.responseStatusStrg !== "MORE" || list.length === 0 || pos >= total) break;
  }
  return punches;
}

// يقسّم فترة كبيرة لمقاطع أسبوعية — يسحب ويرفع كل مقطع لوحده (تقدّم واضح + رفعات صغيرة)
function weekChunks(from, to) {
  const chunks = [];
  const day = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const fmt = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  let s = day(from); const end = day(to);
  while (s <= end) {
    const e = Math.min(s + 6 * 86400000, end);
    chunks.push([fmt(s), fmt(e)]);
    s = e + 86400000;
  }
  return chunks;
}

async function tick() {
  try {
    const now = new Date();
    let start;
    try { start = new Date(JSON.parse(fs.readFileSync(STATE)).lastEnd); } catch { start = new Date(now.getTime() - 24 * 3600 * 1000); }
    // تداخل رجوعي 18 ساعة: يضمن إن الشيفت الليلي (دخول العصر/خروج الفجر) يوصل بدخوله وخروجه معًا
    // فيتقرنوا صح. الاستيراد idempotent (upsert بيوم الدخول) فالتكرار مالوش أثر.
    start = new Date(start.getTime() - 18 * 3600 * 1000);
    const users = await fetchUsers();
    const punches = await fetchEvents(isoLocal(start), isoLocal(now), users);
    if (punches.length) {
      const r = await convex.mutation(importFn, { key: cfg.bridgeKey, punches });
      log(`✓ ${punches.length} بصمة → ${r.days} يوم لـ ${r.employees} موظف`);
      writeStatus({ ok: true, lastPull: punches.length, days: r.days, employees: r.employees, note: "تم السحب والرفع بنجاح" });
    } else {
      log("لا بصمات جديدة (الاتصال بالجهاز تمام)");
      writeStatus({ ok: true, lastPull: 0, note: "متصل بالجهاز — لا بصمات جديدة" });
    }
    fs.writeFileSync(STATE, JSON.stringify({ lastEnd: now.toISOString() }));
  } catch (e) {
    log("⚠️ خطأ:", e.message);
    writeStatus({ ok: false, note: "خطأ: " + e.message });
  }
}

if (cfg.password.includes("ضع_كلمة")) { log("❌ من فضلك اكتب كلمة مرور الجهاز في config.json ثم أعد التشغيل"); process.exit(1); }

// ---- وضع سحب فترة قديمة (Backfill): node bridge.mjs backfill 2026-06-01 2026-06-30 ----
if (process.argv[2] === "backfill") {
  const from = process.argv[3], to = process.argv[4];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    log("الاستخدام: node bridge.mjs backfill 2026-06-01 2026-06-30");
    process.exit(1);
  }
  log(`⏳ سحب فترة من ${from} إلى ${to} ...`);
  let users = {};
  try {
    users = await fetchUsers();
  } catch (e) {
    log(`⚠️ مش قادر أوصل للجهاز (${e.message}).`);
    log(`   • تأكد إن الكمبيوتر موصول بالجهاز، وجرّب الأمر تاني (بيكمّل من غير تكرار).`);
    process.exit(1);
  }
  if (!Object.keys(users).length) { log("⚠️ الاتصال بالجهاز ضعيف — جرّب تاني."); process.exit(1); }
  log(`👥 ${Object.keys(users).length} موظف على الجهاز`);
  // نسحب أسبوع أسبوع — كل مقطع يُرفع لوحده (تقدّم واضح ورفعات صغيرة تتحمّل تقطّع الشبكة)
  const chunks = weekChunks(from, to);
  let totPunches = 0, totDays = 0;
  const failed = [];
  for (let i = 0; i < chunks.length; i++) {
    const [cf, ct] = chunks[i];
    log(`— مقطع ${i + 1}/${chunks.length}: ${cf} ← ${ct}`);
    try {
      const punches = await fetchEvents(`${cf}T00:00:00${cfg.timezone}`, `${ct}T23:59:59${cfg.timezone}`, users);
      if (punches.length) {
        const r = await convex.mutation(importFn, { key: cfg.bridgeKey, punches });
        totPunches += punches.length; totDays += r.days || 0;
        log(`   ✓ ${punches.length} بصمة → ${r.days} يوم لـ ${r.employees} موظف`);
      } else {
        log("   (لا بصمات في المقطع ده)");
      }
    } catch (e) {
      // مقطع فشل (الجهاز اتخنق مؤقتًا) → نكمّل الباقي، ونستنى شوية عشان الجهاز يفكّ
      failed.push(`${cf}←${ct}`);
      log(`   ⚠️ فشل المقطع ده مؤقتًا (${e.message}) — هيكمّل الباقي. استنى شوية...`);
      await sleep(15000);
    }
  }
  log(`✅ انتهى — إجمالي ${totPunches} بصمة / ${totDays} يوم.`);
  if (failed.length) log(`⚠️ مقاطع فشلت: ${failed.join("، ")} — شغّل نفس الأمر تاني عشان يكمّلها (آمن، مبيكررش).`);
  process.exit(0);
}

// ---- الوضع العادي: سحب مستمر كل X دقيقة ----
log(`جسر بصمة أدرينالين يعمل — الجهاز ${cfg.deviceIp}:${cfg.httpPort} — كل ${cfg.intervalMinutes} دقيقة`);
tick();
setInterval(tick, Math.max(1, cfg.intervalMinutes) * 60 * 1000);
