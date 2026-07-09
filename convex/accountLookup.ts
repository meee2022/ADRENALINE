/**
 * @file convex/accountLookup.ts
 * @description بحث موحّد عن الحساب بالبريد — يستخدمه تسجيل الدخول واستعادة كلمة المرور
 *   بنفس الترتيب بالضبط (موظفين أولاً ثم عملاء) وبدون حساسية لحالة الحروف.
 *
 * لماذا موحّد: لو بحث الـlogin في جدول والـreset في جدول آخر، تتغيّر كلمة مرور
 * حساب ويحاول المستخدم الدخول بحساب آخر — وهو ما حدث فعلاً مع بريد موجود في الجدولين.
 */

const norm = (e: string) => String(e || "").trim().toLowerCase();

/** يبحث في users (الموظفين). الجدول صغير — مسح كامل مقبول ويضمن عدم الحساسية للحروف. */
export async function findStaffByEmail(ctx: any, rawEmail: string) {
  const target = norm(rawEmail);
  if (!target) return null;
  const all = await ctx.db.query("users").collect();
  return all.find((u: any) => norm(u.email) === target) ?? null;
}

/** يبحث في customerAccounts (العملاء). */
export async function findCustomerByEmail(ctx: any, rawEmail: string) {
  const target = norm(rawEmail);
  if (!target) return null;
  const all = await ctx.db.query("customerAccounts").collect();
  return all.find((c: any) => norm(c.email) === target) ?? null;
}

/**
 * الترتيب المُعتمد: موظف أولاً، ثم عميل — مطابق لـ authenticateUnified.
 * أي تغيير في الأولوية هنا يجب أن ينعكس في الاثنين معاً.
 */
export async function findAccountByEmail(
  ctx: any,
  rawEmail: string
): Promise<
  | { kind: "staff"; doc: any }
  | { kind: "customer"; doc: any }
  | null
> {
  const staff = await findStaffByEmail(ctx, rawEmail);
  if (staff) return { kind: "staff", doc: staff };
  const customer = await findCustomerByEmail(ctx, rawEmail);
  if (customer) return { kind: "customer", doc: customer };
  return null;
}
