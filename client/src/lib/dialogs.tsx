/**
 * @file client/src/lib/dialogs.tsx
 * @description Promise-based alert/confirm helpers — بديل نوافذ المتصفح الأصلية.
 *
 *   الاستخدام (imperative من أي مكان — hooks أو handlers):
 *     const ok = await confirmDialog({ title, message, confirmText, variant: "danger" });
 *     if (ok) { ...destructive action... }
 *
 *     await alertDialog({ title, message });
 *
 *   لا يحتاج Provider — الملف بيركّب root portal لوحده مرة واحدة.
 *   يستخدم shadcn AlertDialog تحت الغطاء، مع دعم rtl + a11y (role=alertdialog).
 */
import { createRoot, type Root } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { getUserError } from "@/lib/userError";

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};
type AlertOpts = { title?: string; message: string; okText?: string };
type PromptOpts = ConfirmOpts & { placeholder?: string; minLength?: number };

let container: HTMLDivElement | null = null;
let root: Root | null = null;
function ensureRoot(): Root {
  if (root) return root;
  container = document.createElement("div");
  container.id = "app-dialog-root";
  document.body.appendChild(container);
  root = createRoot(container);
  return root;
}

function isRtl(): boolean {
  try { return (localStorage.getItem("app_language") || "ar") !== "en"; }
  catch { return true; }
}

type PendingDialog =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts)
  | ({ kind: "alert"; resolve: () => void } & AlertOpts);

let currentSetter: ((d: PendingDialog | null) => void) | null = null;

function DialogHost() {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [promptValue, setPromptValue] = useState("");
  useEffect(() => { currentSetter = setPending; return () => { currentSetter = null; }; }, []);
  if (!pending) return null;
  const rtl = isRtl();

  if (pending.kind === "confirm") {
    const {
      title, message, confirmText, cancelText, variant, resolve,
    } = pending;
    const cText = confirmText || (rtl ? "تأكيد" : "Confirm");
    const xText = cancelText || (rtl ? "إلغاء" : "Cancel");
    const danger = variant === "danger";
    return (
      <AlertDialog open onOpenChange={(o) => { if (!o) { resolve(false); setPending(null); } }}>
        <AlertDialogContent dir={rtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            {title && <AlertDialogTitle>{title}</AlertDialogTitle>}
            <AlertDialogDescription className="whitespace-pre-wrap">{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { resolve(false); setPending(null); }}>{xText}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resolve(true); setPending(null); }}
              className={danger ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : undefined}
            >{cText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (pending.kind === "prompt") {
    const { title, message, confirmText, cancelText, variant, placeholder, minLength = 1, resolve } = pending;
    const cText = confirmText || (rtl ? "تأكيد" : "Confirm");
    const xText = cancelText || (rtl ? "إلغاء" : "Cancel");
    const valid = promptValue.trim().length >= minLength;
    return (
      <AlertDialog open onOpenChange={(o) => { if (!o) { resolve(null); setPromptValue(""); setPending(null); } }}>
        <AlertDialogContent dir={rtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            {title && <AlertDialogTitle>{title}</AlertDialogTitle>}
            <AlertDialogDescription className="whitespace-pre-wrap">{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input autoFocus value={promptValue} onChange={(e) => setPromptValue(e.target.value)} placeholder={placeholder} className="h-11" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { resolve(null); setPromptValue(""); setPending(null); }}>{xText}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!valid}
              onClick={() => { if (valid) { resolve(promptValue.trim()); setPromptValue(""); setPending(null); } }}
              className={variant === "danger" ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : undefined}
            >{cText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const { title, message, okText, resolve } = pending;
  const oText = okText || (rtl ? "حسنًا" : "OK");
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) { resolve(); setPending(null); } }}>
      <AlertDialogContent dir={rtl ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          {title && <AlertDialogTitle>{title}</AlertDialogTitle>}
          <AlertDialogDescription className="whitespace-pre-wrap">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => { resolve(); setPending(null); }}>{oText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function mountIfNeeded() {
  const r = ensureRoot();
  // مرة واحدة فقط
  if (!(container as any)?._mounted) {
    r.render(<DialogHost />);
    (container as any)._mounted = true;
  }
}

/** Confirm بديل window.confirm — يعيد Promise<boolean>. */
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  mountIfNeeded();
  return new Promise<boolean>((resolve) => {
    const tryOpen = () => {
      if (currentSetter) currentSetter({ kind: "confirm", ...opts, resolve });
      else setTimeout(tryOpen, 20); // ننتظر لحظة إلى أن يُركّب الـHost
    };
    tryOpen();
  });
}

/** Alert بديل window.alert — يعيد Promise<void>. */
export function alertDialog(opts: AlertOpts): Promise<void> {
  mountIfNeeded();
  const safeOpts = { ...opts, message: getUserError(opts.message, isRtl() ? "ar" : "en") };
  return new Promise<void>((resolve) => {
    const tryOpen = () => {
      if (currentSetter) currentSetter({ kind: "alert", ...safeOpts, resolve });
      else setTimeout(tryOpen, 20);
    };
    tryOpen();
  });
}

/** Prompt dialog for short, required operational reasons. */
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  mountIfNeeded();
  return new Promise<string | null>((resolve) => {
    const tryOpen = () => {
      if (currentSetter) currentSetter({ kind: "prompt", ...opts, resolve });
      else setTimeout(tryOpen, 20);
    };
    tryOpen();
  });
}
