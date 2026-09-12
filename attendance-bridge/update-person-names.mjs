/**
 * One-time Hikvision person-name updater.
 * Default mode is preview only. Pass --apply to modify names on the device.
 * Only employeeNo + name are sent, so fingerprints/cards/validity stay intact.
 */
import crypto from "node:crypto";
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const APPLY = process.argv.includes("--apply");
const PATH_SEARCH = "/ISAPI/AccessControl/UserInfo/Search?format=json";
const PATH_MODIFY = "/ISAPI/AccessControl/UserInfo/Modify?format=json";
const timeoutMs = 25_000;
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const desiredNames = new Map(Object.entries({
  "1": "Abu Sayed Shakib",
  "6": "Billal Abulbassar",
  "7": "Arman Hossan",
  "12": "Shorub Hossan",
  "15": "Ramsheed Majeed",
  "17": "Muhammed Rashed",
  "18": "Amal Hanan",
  "19": "Saidul Islam Nurul",
  "23": "Mohamed Wagiealla",
  "38": "Siddig Mohamed",
  "39": "Mosab Eltahir",
  "41": "Arif Mohammad",
  "52": "Bakri Mirghani Mustafa Elhassan",
  "53": "Abdelaziz Mohamed",
  "56": "MD Ratul Islam",
  "57": "Fakheredin Ashraf Sabir Eisa",
  "60": "Md Robin Md Nasir Sheikh",
}));

async function digestRequest(method, requestPath, body) {
  const base = `http://${cfg.deviceIp}:${cfg.httpPort}`;
  const makeOptions = () => ({
    method,
    body,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const first = await fetch(base + requestPath, makeOptions());
  if (first.status !== 401) return first;
  const challenge = first.headers.get("www-authenticate") || "";
  const get = (key) => (challenge.match(new RegExp(`${key}="?([^",]+)"?`)) || [])[1];
  const realm = get("realm");
  const nonce = get("nonce");
  const qop = get("qop") || "auth";
  const opaque = get("opaque");
  if (!realm || !nonce) throw new Error("Device did not return a valid Digest challenge");
  const cnonce = crypto.randomBytes(8).toString("hex");
  const nc = "00000001";
  const ha1 = md5(`${cfg.username}:${realm}:${cfg.password}`);
  const ha2 = md5(`${method}:${requestPath}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  let authorization = `Digest username="${cfg.username}", realm="${realm}", nonce="${nonce}", uri="${requestPath}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (opaque) authorization += `, opaque="${opaque}"`;
  const options = makeOptions();
  options.headers.Authorization = authorization;
  return fetch(base + requestPath, options);
}

async function request(method, requestPath, body) {
  const response = await digestRequest(method, requestPath, body);
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const detail = json?.ResponseStatus?.subStatusCode || json?.subStatusCode || json?.errorMsg || text || "Unknown device response";
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  const status = json?.ResponseStatus || json;
  if (status?.statusCode != null && String(status.statusCode) !== "1") {
    throw new Error(`Device rejected request: ${status.subStatusCode || status.statusString || status.errorMsg || status.statusCode}`);
  }
  return json;
}

async function fetchUsers() {
  const users = new Map();
  let position = 0;
  const searchID = `name-update-${Date.now()}`;
  for (let guard = 0; guard < 100; guard++) {
    const body = JSON.stringify({UserInfoSearchCond:{searchID,searchResultPosition:position,maxResults:50}});
    const json = await request("POST", PATH_SEARCH, body);
    const search = json?.UserInfoSearch || {};
    const list = search.UserInfo || [];
    for (const user of list) users.set(String(user.employeeNo ?? "").trim(), user);
    position += list.length;
    if (search.responseStatusStrg !== "MORE" || !list.length || position >= (search.totalMatches || 0)) break;
  }
  return users;
}

console.log("Reading people from Hikvision device...");
const before = await fetchUsers();
const missing = [...desiredNames.keys()].filter((id) => !before.has(id));
if (missing.length) throw new Error(`Safety stop: Person ID not found on device: ${missing.join(", ")}`);

const changes = [...desiredNames].map(([id, desired]) => ({id,current:String(before.get(id)?.name || "").trim(),desired}))
  .filter((row) => row.current !== row.desired);

console.log("\nPlanned name changes:");
for (const row of changes) console.log(`  ${row.id}: ${row.current}  ->  ${row.desired}`);
console.log(`\n${changes.length} name(s) need updating. Fingerprints and cards are not changed.`);

if (!APPLY) {
  console.log("\nPREVIEW ONLY. No device data was modified.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = new URL(`./person-names-backup-${stamp}.json`, import.meta.url);
fs.writeFileSync(backupPath, JSON.stringify([...before.values()], null, 2));
console.log(`Backup saved: ${backupPath.pathname}`);

let updated = 0;
for (const row of changes) {
  const payload = JSON.stringify({UserInfo:{employeeNo:row.id,name:row.desired}});
  await request("PUT", PATH_MODIFY, payload);
  updated++;
  console.log(`  OK ${row.id}: ${row.desired}`);
  await sleep(350);
}

const after = await fetchUsers();
const failed = [...desiredNames].filter(([id, desired]) => String(after.get(id)?.name || "").trim() !== desired);
if (failed.length) {
  console.error("\nVerification failed for:");
  for (const [id, desired] of failed) console.error(`  ${id}: expected ${desired}, got ${after.get(id)?.name || "<missing>"}`);
  process.exit(2);
}

console.log(`\nSUCCESS: ${updated} name(s) updated and all 17 mappings verified.`);
