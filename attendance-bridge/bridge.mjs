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
/**
 * مهلة الطلب الواحد.
 *
 * السحب الدوري يريد مهلةً قصيرة: يعمل كل خمس دقائق، وطلبٌ معلّق يؤخّر الدورة
 * التالية. أما السحب اليدوي فيجلب أسبوعاً كاملاً من الأحداث دفعةً واحدة،
 * والجهاز يبطؤ تحتها فيتجاوز الخمسةَ والعشرين ثانية ويسقط المقطع كلّه —
 * ولا يظهر للطاقم إلا «فشل المقطع»، فيعيدون المحاولة ويفشلون مثلها.
 */
const REQ_TIMEOUT = process.argv[2] === "backfill" ? 90000 : 25000;
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
async function req(method, path, body, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await digestRequest(method, path, body);
      if (r.ok) return r;                 // 200 = تمام
      // ❗ 401 = الجهاز رافض الدخول (غالبًا مقفول مؤقتًا من محاولات كتير).
      // منعيدش الضغط عليه — كل محاولة بتطوّل القفل. نرمي فورًا ونستنى الدورة الجاية.
      if (r.status === 401) throw new Error("HTTP 401 — الجهاز مقفول مؤقتًا، بنستنى بدل ما نضغط عليه");
      last = new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (String(e.message).startsWith("HTTP 401")) throw e; // متعيدش على 401 نهائيًا
      last = e; // أخطاء الشبكة (fetch failed / timeout) → نعيد المحاولة عادي
    }
    if (i < tries) { log(`   … تعذّر مؤقتًا، إعادة المحاولة (${i}/${tries - 1})`); await sleep(3000); }
  }
  throw last;
}

const pad = (n) => String(n).padStart(2, "0");
const dateShift = (date, days) => {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
const nightNames = new Set((cfg.nightShiftEmployees || []).map((n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, "")));
const isNightEmployee = (name) => nightNames.has(String(name).toLowerCase().replace(/[^a-z0-9]/g, ""));
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
      // Hikvision may identify the punch direction. Preserve it so Convex does
      // not have to guess and accidentally shift every later punch by one.
      const attendanceStatus = String(it.attendanceStatus || "").toLowerCase();
      let kind = attendanceStatus === "checkin" || attendanceStatus === "breakin" || attendanceStatus === "overtimein"
        ? "in"
        : attendanceStatus === "checkout" || attendanceStatus === "breakout" || attendanceStatus === "overtimeout"
          ? "out"
          : undefined;
      let shiftDate = date;
      if (isNightEmployee(empName)) {
        const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
        if (minutes <= 4 * 60) { kind = "out"; shiftDate = dateShift(date, -1); }
        else if (minutes >= 22 * 60) kind = "out";
        else if (minutes >= 14 * 60 + 30 && minutes <= 18 * 60) kind = "in";
      }
      punches.push({ name: empName, date: shiftDate, time, ...(kind ? { kind } : {}) });
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

if (cfg.password.includes("ضع_كلمة")) { log("❌ من فضلك اكتب كلمة مرور الجهاز في config.json ثم أعد التشغيل"); await die(1); }

/**
 * قفل النسخة الواحدة — يُعرَّف هنا قبل السحب اليدوي لا بعده.
 *
 * كان يُفحص في آخر الملف، بعد كتلة السحب اليدوي وخروجها؛ فالسحب اليدوي كان
 * يمرّ من فوقه ولا يراه. ولأن الـwatchdog يُبقي الجسر التلقائي حيًّا ويسحب كل
 * خمس دقائق، كان تشغيل السحب اليدوي يُصادِق على الجهاز مرّةً ثانية في اللحظة
 * نفسها — وHikvision يردّ 401 ويقفل الحساب مؤقتاً. فبدا العطل «الجهاز مقفول»
 * والسبب أننا نحن من زاحمناه.
 */
const LOCK = new URL("./bridge.lock", import.meta.url);
/** نبضةٌ أحدث من تسعين ثانية = نسخة حيّة تعمل الآن. */
function liveInstance() {
  try {
    if (!fs.existsSync(LOCK)) return null;
    const st = JSON.parse(fs.readFileSync(LOCK));
    return st && Date.now() - (st.beat || 0) < 90000 ? st : null;
  } catch { return null; }
}

/**
 * خروجٌ نظيف.
 *
 * `process.exit` فور فشل طلبٍ شبكيّ يُنهي العملية واتصالُ fetch لم يُغلق بعد،
 * فيطبع libuv على ويندوز: `Assertion failed: UV_HANDLE_CLOSING`. لا ضرر منه،
 * لكنّه يظهر للطاقم أسفل الشاشة كأنّ البرنامج انهار فيظنّون السحب فشل وقد نجح.
 * فنمهل الحلقةَ لحظةً تُغلق فيها ما بقي مفتوحاً ثم نخرج.
 */
async function die(code) {
  process.exitCode = code;
  await sleep(150);
  process.exit(code);
}

// ---- وضع سحب فترة قديمة (Backfill): node bridge.mjs backfill 2026-06-01 2026-06-30 ----
if (process.argv[2] === "backfill") {
  const from = process.argv[3], to = process.argv[4];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    log("الاستخدام: node bridge.mjs backfill 2026-06-01 2026-06-30");
    await die(1);
  }
  /* لا يُزاحم الجسرَ التلقائي على الجهاز: عمليتان تُصادقان معاً ⇒ 401 وقفل. */
  const live = liveInstance();
  if (live) {
    log("⛔ الجسر التلقائي شغّال دلوقتي — والسحب معاه بيخنق الجهاز ويقفله (401).");
    log("   ١) دوس STOP-BRIDGE.bat");
    log("   ٢) استنى ١٥ دقيقة من غير ما تشغّل أي حاجة");
    log("   ٣) شغّل السحب ده تاني");
    log("   ٤) وبعد ما يخلص، رجّع الجسر بـ ENABLE-AUTO-START.bat");
    await die(1);
  }
  log(`⏳ سحب فترة من ${from} إلى ${to} ...`);
  let users = {};
  try {
    users = await fetchUsers();
  } catch (e) {
    const locked = String(e.message).includes("401");
    log(`⚠️ مش قادر أوصل للجهاز (${e.message}).`);
    if (locked) {
      log("   • الجهاز رافض الدخول. الأسباب المرتّبة:");
      log("     ١) الجسر التلقائي أو نسخة سحب تانية شغّالة — اقفلها بـ STOP-BRIDGE.bat");
      log("     ٢) الجهاز قافل الحساب مؤقتاً من محاولات كتير — استنى ١٥ دقيقة");
      log("        وما تشغّلش أي حاجة في الفترة دي، كل محاولة بتجدّد القفل");
      log("     ٣) لو فضلت المشكلة: كلمة المرور في config.json اتغيّرت على الجهاز");
    } else {
      log("   • تأكد إن الكمبيوتر موصول بنفس شبكة الجهاز، وجرّب تاني (بيكمّل من غير تكرار).");
    }
    await die(1);
  }
  if (!Object.keys(users).length) { log("⚠️ الاتصال بالجهاز ضعيف — جرّب تاني."); await die(1); }
  log(`👥 ${Object.keys(users).length} موظف على الجهاز`);
  // نسحب أسبوع أسبوع — كل مقطع يُرفع لوحده (تقدّم واضح ورفعات صغيرة تتحمّل تقطّع الشبكة)
  const chunks = weekChunks(from, to);
  let totPunches = 0, totDays = 0;
  const failed = [];
  for (let i = 0; i < chunks.length; i++) {
    const [cf, ct] = chunks[i];
    log(`— مقطع ${i + 1}/${chunks.length}: ${cf} ← ${ct}`);
    try {
      // Include 00:00-04:00 of the following day so the final night's checkout
      // is attached to the previous work date.
      const fetched = await fetchEvents(`${cf}T00:00:00${cfg.timezone}`, `${dateShift(ct, 1)}T04:00:00${cfg.timezone}`, users);
      // A dawn checkout is shifted to the prior work date. Keep only work dates
      // owned by this chunk, otherwise the next chunk would overwrite the same
      // prior day with an out-only partial record.
      const punches = fetched.filter((p) => p.date >= cf && p.date <= ct);
      if (punches.length) {
        const r = await convex.mutation(importFn, {
          key: cfg.bridgeKey,
          punches,
          // A completed historical interval is safe to reconcile. Live pulls
          // must never mark somebody absent before their workday has ended.
          reconcileFrom: cf,
          reconcileTo: ct,
        });
        totPunches += punches.length; totDays += r.days || 0;
        log(`   ✓ ${punches.length} بصمة → ${r.days} يوم لـ ${r.employees} موظف`);
      } else {
        log("   (لا بصمات في المقطع ده)");
      }
    } catch (e) {
      // مقطع فشل (الجهاز اتخنق مؤقتًا) → نكمّل الباقي، ونستنى شوية عشان الجهاز يفكّ
      failed.push(`${cf}←${ct}`);
      log(`   ⚠️ فشل المقطع ده مؤقتًا (${e.message}) — هيكمّل الباقي. استنى دقيقة...`);
      await sleep(60000); // ننتظر أطول عشان الجهاز يفكّ لو كان اتخنق
    }
  }
  log(`✅ انتهى — إجمالي ${totPunches} بصمة / ${totDays} يوم.`);
  if (failed.length) log(`⚠️ مقاطع فشلت: ${failed.join("، ")} — شغّل نفس الأمر تاني عشان يكمّلها (آمن، مبيكررش).`);
  await die(0);
}

// ---- نسخة واحدة فقط: لو فيه نسخة شغّالة نخرج فورًا (يمنع تعدد النسخ اللي بتخنق الجهاز) ----
if (liveInstance()) {
  console.log("نسخة تانية من الجسر شغّالة بالفعل — بخرج (نسخة واحدة تكفي).");
  await die(0);   // خروج نظيف (0) → run.bat ميعيدش التشغيل
}
const beat = () => { try { fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, beat: Date.now() })); } catch {} };
beat();
setInterval(beat, 30000);   // نبضة كل 30 ثانية تثبت إن النسخة دي حيّة
// عند الخروج الطبيعي/الاستثناء: امسح القفل بتاعنا فقط (عشان run.bat يقدر يعيد التشغيل بعد كراش)
process.on("exit", () => { try { const st = JSON.parse(fs.readFileSync(LOCK)); if (st.pid === process.pid) fs.unlinkSync(LOCK); } catch {} });

// ---- الوضع العادي: سحب مستمر كل X دقيقة ----
log(`جسر بصمة أدرينالين يعمل — الجهاز ${cfg.deviceIp}:${cfg.httpPort} — كل ${cfg.intervalMinutes} دقيقة`);
tick();
setInterval(tick, Math.max(1, cfg.intervalMinutes) * 60 * 1000);
