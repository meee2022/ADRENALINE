/**
 * @file script/android-gradle.ts
 * @description يشغّل Gradle بجافا صالحة. Capacitor 8 يترجم بـJava 21، وجافا
 *   النظام هنا 17 — فالبناء يفشل بـ«invalid source release: 21». وAndroid
 *   Studio يحمل جافا حديثة داخله، فتُستعمل بدل مطالبة المستخدم بتثبيتٍ آخر.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const CANDIDATES = [
  process.env.CAPACITOR_ANDROID_JAVA_HOME,
  process.env.JAVA_HOME,
  "C:/Program Files/Android/Android Studio/jbr",
  "C:/Program Files/Android/Android Studio1/jbr",
  `${process.env.LOCALAPPDATA}/Programs/Android Studio/jbr`,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
].filter(Boolean) as string[];

/** رقم الإصدار الرئيسي لجافا في هذا المسار، أو 0 إن لم تكن جافا صالحة. */
function majorOf(home: string): number {
  const bin = path.join(home, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(bin)) return 0;
  /* جافا تطبع إصدارها على stderr لا stdout، فيُقرأ المجريان معاً. */
  const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
  const m = /version "(\d+)/.exec(`${r.stdout || ""}${r.stderr || ""}`);
  return m ? Number(m[1]) : 0;
}

const home = CANDIDATES.find((c) => majorOf(c) >= 21);
if (!home) {
  throw new Error(
    "لم أجد جافا 21 أو أحدث. ثبّت Android Studio (يحمل جافا داخله)، أو اضبط CAPACITOR_ANDROID_JAVA_HOME على مسار JDK 21+.",
  );
}
console.log(`Gradle JDK: ${home} (Java ${majorOf(home)})`);

const ANDROID = path.resolve(process.cwd(), "android");
const task = process.argv[2] || "bundleRelease";
const r = spawnSync(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  [task],
  {
    cwd: ANDROID,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, JAVA_HOME: home, PATH: `${ANDROID}${path.delimiter}${process.env.PATH}` },
  },
);
process.exit(r.status ?? 1);
