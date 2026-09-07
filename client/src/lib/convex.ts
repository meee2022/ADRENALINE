import { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required. Refusing to start with an unknown database deployment.");
}

export const convex = new ConvexReactClient(convexUrl);

/**
 * الإنتاج يحجب نصّ الخطأ: تصل الرسالة في `error.data` (ConvexError) بينما
 * `error.message` تصير «Server Error» فقط. ومعظم الشاشات تعرض `e.message`،
 * فتظهر «تعذر إكمال العملية» بلا سبب. هنا تُعاد صياغة الرسالة بصيغة التطوير
 * نفسها («Uncaught ConvexError: …») فتستخرجها getUserError كما هي.
 */
function withReadableMessage<T>(p: Promise<T>): Promise<T> {
  return p.catch((e: unknown) => {
    if (e instanceof ConvexError && typeof e.data === "string" && e.data.trim()
        && !String(e.message).includes(e.data)) {
      const head = String(e.message).split("\n")[0];
      try { e.message = `${head}\nUncaught ConvexError: ${e.data}\n  Called by client`; } catch { /* read-only */ }
    }
    throw e;
  });
}
const origMutation = convex.mutation.bind(convex);
const origAction = convex.action.bind(convex);
(convex as any).mutation = (...args: any[]) => withReadableMessage((origMutation as any)(...args));
(convex as any).action = (...args: any[]) => withReadableMessage((origAction as any)(...args));
