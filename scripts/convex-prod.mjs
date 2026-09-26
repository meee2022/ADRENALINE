#!/usr/bin/env node
/**
 * أوامر Convex على الإنتاج بمفتاح النشر (Deploy Key) لا بحساب المستخدم المسجَّل.
 *
 * لماذا: للمستخدم أكثر من حساب Convex، وكل تسجيل دخول بحساب آخر يُفقد CLI صلاحية
 * المشروع فيتعطّل النشر والاستعلام. مفتاح النشر مربوط بمشروع أدرينالين (الإنتاج) نفسه.
 *
 * المفتاح في `.env.convex-prod` (متجاهَل في git عبر `.env.*`)، بالسطر:
 *   CONVEX_DEPLOY_KEY=prod:laudable-mongoose-958|...
 * لا يُطبع المفتاح ولا يُمرَّر في سطر الأوامر؛ يُعطى للعملية الفرعية عبر البيئة فقط.
 *
 * أمثلة:
 *   node scripts/convex-prod.mjs deploy -y
 *   node scripts/convex-prod.mjs run restaurantCatalog:list "{}"
 *   node scripts/convex-prod.mjs data clientErrors --limit 20
 *   node scripts/convex-prod.mjs logs --history 50
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".env.convex-prod");
if (!existsSync(file)) {
  console.error("✖ الملف .env.convex-prod غير موجود. أنشئه وضع فيه: CONVEX_DEPLOY_KEY=...");
  process.exit(1);
}
const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^\s*CONVEX_DEPLOY_KEY\s*=/.test(l));
const key = line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
if (!key || key.includes("ضع_المفتاح_هنا")) {
  console.error("✖ لا يوجد مفتاح في .env.convex-prod — الصق مفتاح Production Deploy Key بعد CONVEX_DEPLOY_KEY=");
  process.exit(1);
}
if (!key.startsWith("prod:")) {
  console.error("✖ المفتاح ليس مفتاح إنتاج (يجب أن يبدأ بـ prod:). أنشئ Production Deploy Key من لوحة Convex.");
  process.exit(1);
}

// المفتاح يحدّد النشرة بنفسه؛ نُزيل CONVEX_DEPLOYMENT (dev) حتى لا يتعارض معه.
const env = { ...process.env, CONVEX_DEPLOY_KEY: key };
delete env.CONVEX_DEPLOYMENT;
const args = process.argv.slice(2).filter((a) => a !== "--prod");
const r = spawnSync(process.execPath, [path.join(root, "node_modules/convex/bin/main.js"), ...args], {
  cwd: root, env, stdio: "inherit",
});
process.exit(r.status ?? 1);
