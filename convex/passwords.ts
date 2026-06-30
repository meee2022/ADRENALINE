/**
 * @file convex/passwords.ts
 * @description تشفير كلمات المرور بـ PBKDF2-SHA256 مع توافق رجعي مع التجزئة القديمة.
 *  - hashPassword: ينتج "pbkdf2$<iters>$<saltB64>$<hashB64>"
 *  - verifyPassword: يتحقق من الصيغة الجديدة، ويسقط على simpleHash القديمة للحسابات القديمة.
 */
const ITERATIONS = 120000;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// التجزئة القديمة (للتوافق فقط)
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored && stored.startsWith("pbkdf2$")) {
    const [, , saltB64, hashB64] = stored.split("$");
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const actual = await derive(password, salt);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  }
  // توافق رجعي: حسابات قديمة بالتجزئة البسيطة
  return simpleHash(password) === stored;
}
