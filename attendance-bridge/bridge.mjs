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

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const importFn = makeFunctionReference("attendance:importPunchesDevice");
const convex = new ConvexHttpClient(cfg.convexUrl);

function log(...a) { console.log(new Date().toLocaleString(), "|", ...a); }

// ---- HTTP Digest auth (Hikvision ISAPI) ----
async function digestRequest(method, path, body) {
  const base = `http://${cfg.deviceIp}:${cfg.httpPort}`;
  const first = await fetch(base + path, { method, body, headers: { "Content-Type": "application/json" } });
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
  return fetch(base + path, { method, body, headers: { "Content-Type": "application/json", Authorization: auth } });
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
    const res = await digestRequest("POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", body);
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
  for (let guard = 0; guard < 400; guard++) {
    const body = JSON.stringify({
      AcsEventCond: { searchID: "adr", searchResultPosition: pos, maxResults: 50, major: 0, minor: 0, startTime, endTime },
    });
    const res = await digestRequest("POST", "/ISAPI/AccessControl/AcsEvent?format=json", body);
    if (res.status === 401) throw new Error("بيانات دخول الجهاز غير صحيحة (401) — راجع username/password في config.json");
    if (!res.ok) throw new Error(`الجهاز رجّع خطأ ${res.status}`);
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
    pos += list.length;
    if (ev.responseStatusStrg !== "MORE" || list.length === 0 || pos >= total) break;
  }
  return punches;
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
    } else {
      log("لا بصمات جديدة");
    }
    fs.writeFileSync(STATE, JSON.stringify({ lastEnd: now.toISOString() }));
  } catch (e) {
    log("⚠️ خطأ:", e.message);
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
  const users = await fetchUsers();
  log(`👥 ${Object.keys(users).length} موظف على الجهاز`);
  const punches = await fetchEvents(`${from}T00:00:00${cfg.timezone}`, `${to}T23:59:59${cfg.timezone}`, users);
  if (punches.length) {
    const r = await convex.mutation(importFn, { key: cfg.bridgeKey, punches });
    log(`✓ تم سحب ${punches.length} بصمة → ${r.days} يوم لـ ${r.employees} موظف`);
  } else {
    log("لا توجد بصمات في هذه الفترة");
  }
  log("✅ انتهى سحب الفترة.");
  process.exit(0);
}

// ---- الوضع العادي: سحب مستمر كل X دقيقة ----
log(`جسر بصمة أدرينالين يعمل — الجهاز ${cfg.deviceIp}:${cfg.httpPort} — كل ${cfg.intervalMinutes} دقيقة`);
tick();
setInterval(tick, Math.max(1, cfg.intervalMinutes) * 60 * 1000);
