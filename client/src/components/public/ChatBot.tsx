/**
 * @file ChatBot.tsx
 * @description مساعد أدرينالين الذكي (المرحلة 2) — ودجت محادثة عائمة.
 */
import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";

const B = { brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A", line: "#D9E6F1", bg2: "#EAF3FB" };

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatBot() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const chat = useAction(api.ai.chat);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: isRtl
      ? "أهلاً بك في أدرينالين 🌿 أنا مساعدك الذكي — اسألني عن الوجبات، السعرات، أو باقات الاشتراك."
      : "Welcome to Adrenaline 🌿 I'm your smart assistant — ask me about meals, calories, or subscription plans." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const res: any = await chat({ messages: next, lang: isRtl ? "ar" : "en" });
      setMsgs([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: isRtl ? "حدث خطأ مؤقت، يُرجى المحاولة مرة أخرى 🌿" : "A temporary error occurred, please try again 🌿" }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Launcher — أيقونة دائرية بسيطة */}
      <button onClick={() => setOpen(!open)} aria-label={isRtl ? "المساعد الذكي" : "Smart Assistant"}
        title={isRtl ? "المساعد الذكي" : "Smart Assistant"}
        className="no-print"
        style={{
          position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", right: 18, zIndex: 1000,
          width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer",
          background: `linear-gradient(145deg,${B.brand},${B.accent})`,
          boxShadow: "0 10px 26px -8px rgba(14,118,172,.6)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
        }}>
        {open ? "✕" : "💬"}
      </button>

      {/* Panel */}
      {open && (
        <div dir={isRtl ? "rtl" : "ltr"} className="no-print" style={{
          position: "fixed", bottom: "calc(160px + env(safe-area-inset-bottom))", right: 18, zIndex: 1000,
          width: "min(360px, calc(100vw - 44px))", height: "min(480px, calc(100vh - 220px))",
          background: "#fff", borderRadius: 20, overflow: "hidden",
          border: `1px solid ${B.line}`, boxShadow: "0 24px 60px -20px rgba(14,42,74,.4)",
          display: "flex", flexDirection: "column", fontFamily: "'Cairo',sans-serif",
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg,${B.ink},${B.accent})`, color: "#fff",
            padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{isRtl ? "مساعد أدرينالين" : "Adrenaline Assistant"}</div>
              <div style={{ fontSize: 11, opacity: .8 }}>{isRtl ? "يرد عادةً خلال ثوانٍ" : "Usually replies in seconds"}</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, background: "#F7FBFE" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end", marginBottom: 10 }}>
                <div style={{
                  maxWidth: "82%", padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.7,
                  background: m.role === "user" ? B.accent : "#fff",
                  color: m.role === "user" ? "#fff" : B.ink,
                  border: m.role === "user" ? "none" : `1px solid ${B.line}`,
                  whiteSpace: "pre-wrap",
                }}>{m.content}</div>
              </div>
            ))}
            {loading && <div style={{ textAlign: "center", color: B.accent, fontSize: 13 }}>{isRtl ? "...يكتب" : "typing..."}</div>}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${B.line}`, background: "#fff" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={isRtl ? "اكتب رسالتك…" : "Type your message…"}
              style={{ flex: 1, border: `1px solid ${B.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 14, fontFamily: "'Cairo',sans-serif" }} />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{
                border: "none", borderRadius: 12, padding: "0 18px", cursor: "pointer",
                background: loading || !input.trim() ? "#9CC5DB" : B.accent, color: "#fff", fontWeight: 800,
              }}>{isRtl ? "إرسال" : "Send"}</button>
          </div>
        </div>
      )}
    </>
  );
}
