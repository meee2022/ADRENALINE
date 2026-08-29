/**
 * @file script/verify-android-release.ts
 * @description يمنع بناء نسخة Play على قاعدة بيانات التطوير — الخطأ الذي لا
 *   يظهر إلا بعد أن يفتح المشترك التطبيق ولا يجد بياناته.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

/* Vite's root is client/, so that is where it reads .env.<mode>.local from —
   checking the repo root would verify a file the build never loads. */
const file = path.resolve(process.cwd(), "client", ".env.android.local");

function parseEnv(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    result[line.slice(0, separator).trim()] =
      line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return result;
}

let env: Record<string, string>;
try {
  env = parseEnv(await readFile(file, "utf8"));
} catch {
  throw new Error(
    "Missing client/.env.android.local. Copy config/android.env.example, set the production Convex URL, and confirm the release environment.",
  );
}

if (!/^https:\/\/[a-z0-9-]+\.convex\.cloud$/i.test(env.VITE_CONVEX_URL || "")) {
  throw new Error("VITE_CONVEX_URL in .env.android.local must be a valid Convex cloud URL.");
}

if (env.ANDROID_RELEASE_CONFIRMED !== "true") {
  throw new Error("Set ANDROID_RELEASE_CONFIRMED=true only after verifying that the URL is the production deployment.");
}

console.log(`Android release environment verified: ${new URL(env.VITE_CONVEX_URL).hostname}`);
