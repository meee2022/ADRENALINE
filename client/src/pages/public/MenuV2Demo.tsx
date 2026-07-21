/**
 * @file client/src/pages/public/MenuV2Demo.tsx
 * @description 🧪 نموذج تجريبي غير مربوط — «مسار الأيام»: إعادة تصميم اختيار الوجبات.
 *
 *   الفكرة: العميل لا يرى «أسابيع دورة» ولا أقفالاً — يرى **أيامه هو** مرتّبة:
 *   «اليوم 1 من 6 — الأربعاء 22 يوليو»، يملأ خانات يومه (فطور/غداء/عشاء/سناك×2)
 *   وأول ما يكتمل اليوم ينتقل تلقائياً لليوم التالي. الدورة تشتغل خلف الكواليس.
 *
 *   ⚠️ صفحة تجريبية بحتة: بيانات وهمية، لا Convex ولا سلة حقيقية ولا إرسال.
 *   الرابط: /public/menu-v2 (غير معروض في أي قائمة). لو عجبت نطبّقها، لو لأ تُحذف.
 */
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Flame, Sparkles, RotateCcw } from "lucide-react";

/* ─── بيانات تجريبية (شكل واقعي من منيو أدرينالين) ─── */
type Cat = "breakfast" | "lunch" | "dinner" | "snack";
type Meal = { id: string; ar: string; en: string; kcal: number; p: number; c: number; f: number; cat: Cat; emoji: string };

const MEALS: Meal[] = [
  { id: "b1", ar: "زبدة الفول السوداني بالشوكولاتة", en: "Chocolate Peanut Butter", kcal: 262, p: 15, c: 28, f: 10, cat: "breakfast", emoji: "🥜" },
  { id: "b2", ar: "توست الأفوكادو بالبيض", en: "Egg Avocado Toast", kcal: 264, p: 22, c: 17, f: 12, cat: "breakfast", emoji: "🥑" },
  { id: "b3", ar: "بان كيك بالتوت", en: "Berry Pancake", kcal: 256, p: 14, c: 30, f: 8, cat: "breakfast", emoji: "🥞" },
  { id: "l1", ar: "لحم البقر فيندالو مع أرز", en: "Beef Vindaloo & Rice", kcal: 422, p: 36, c: 38, f: 14, cat: "lunch", emoji: "🍛" },
  { id: "l2", ar: "سلمون جامايكي متبل", en: "Jamaican Jerk Salmon", kcal: 359, p: 35, c: 30, f: 11, cat: "lunch", emoji: "🐟" },
  { id: "l3", ar: "دجاج مشوي بالأعشاب", en: "Grilled Herb Chicken", kcal: 380, p: 40, c: 28, f: 10, cat: "lunch", emoji: "🍗" },
  { id: "d1", ar: "ساندويتش بسطرمة اللحم", en: "Beef Pastrami Sandwich", kcal: 396, p: 38, c: 34, f: 12, cat: "dinner", emoji: "🥪" },
  { id: "d2", ar: "مجبوس الدجاج", en: "Chicken Majbous", kcal: 404, p: 40, c: 34, f: 12, cat: "dinner", emoji: "🍚" },
  { id: "d3", ar: "ستيك ساندويتش", en: "Steak Sandwich", kcal: 380, p: 36, c: 30, f: 12, cat: "dinner", emoji: "🥩" },
  { id: "s1", ar: "سموثي ماتشا شيك", en: "Matcha Smoothie", kcal: 260, p: 11, c: 36, f: 8, cat: "snack", emoji: "🥤" },
  { id: "s2", ar: "سلطة كينوا بفاكهة الباشن", en: "Passion Quinoa Salad", kcal: 219, p: 10, c: 29, f: 7, cat: "snack", emoji: "🥗" },
  { id: "s3", ar: "شوربة ذرة", en: "Corn Soup", kcal: 132, p: 5, c: 19, f: 4, cat: "snack", emoji: "🥣" },
  { id: "s4", ar: "تيراميسو", en: "Tiramisu", kcal: 321, p: 9, c: 34, f: 15, cat: "snack", emoji: "🍰" },
];

const DAYS = [
  { d: "الأربعاء", date: "22 يوليو" }, { d: "الخميس", date: "23 يوليو" },
  { d: "السبت", date: "25 يوليو" }, { d: "الأحد", date: "26 يوليو" },
  { d: "الإثنين", date: "27 يوليو" }, { d: "الثلاثاء", date: "28 يوليو" },
];

/* خانات اليوم: فطور 1 + غداء 1 + عشاء 1 + سناك 2 */
const SLOTS: { key: string; cat: Cat; label: string; icon: string }[] = [
  { key: "breakfast", cat: "breakfast", label: "الفطور", icon: "☕" },
  { key: "lunch", cat: "lunch", label: "الغداء", icon: "🍽️" },
  { key: "dinner", cat: "dinner", label: "العشاء", icon: "🌙" },
  { key: "snack1", cat: "snack", label: "سناك 1", icon: "🍎" },
  { key: "snack2", cat: "snack", label: "سناك 2", icon: "🍏" },
];

const B = { brand: "#3CC4F0", deep: "#0E76AC", ink: "#0E2A4A", line: "#D9E6F1", bg: "#F4FAFD" };

export default function MenuV2Demo() {
  // picks[dayIdx][slotKey] = mealId
  const [picks, setPicks] = useState<Record<number, Record<string, string>>>({});
  const [dayIdx, setDayIdx] = useState(0);
  const [activeSlot, setActiveSlot] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const dayPicks = picks[dayIdx] || {};
  const filledCount = SLOTS.filter((s) => dayPicks[s.key]).length;
  const dayDone = (i: number) => SLOTS.every((s) => (picks[i] || {})[s.key]);
  const doneDays = DAYS.filter((_, i) => dayDone(i)).length;
  const allDone = doneDays === DAYS.length;
  const slot = SLOTS[activeSlot];
  const candidates = useMemo(() => MEALS.filter((m) => m.cat === slot.cat), [slot]);
  const dayKcal = SLOTS.reduce((s, sl) => s + (MEALS.find((m) => m.id === dayPicks[sl.key])?.kcal || 0), 0);

  const pick = (mealId: string) => {
    const next = { ...picks, [dayIdx]: { ...dayPicks, [slot.key]: mealId } };
    setPicks(next);
    // ➡️ الخانة التالية الفاضية، أو انتقال لليوم التالي لو اكتمل
    const nextEmpty = SLOTS.findIndex((s, i) => i !== activeSlot && !next[dayIdx][s.key]);
    if (nextEmpty >= 0) { setActiveSlot(nextEmpty); return; }
    // اليوم اكتمل ✨
    setCelebrate(true);
    setTimeout(() => {
      setCelebrate(false);
      const nd = DAYS.findIndex((_, i) => !SLOTS.every((s) => (next[i] || {})[s.key]));
      if (nd >= 0) { setDayIdx(nd); setActiveSlot(0); }
    }, 1100);
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: B.bg, fontFamily: "'Tajawal','Cairo',sans-serif", color: B.ink }}>
      {/* شريط تجريبي */}
      <div style={{ background: "#7c2d12", color: "#fff", textAlign: "center", padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>
        🧪 نسخة تجريبية للعرض فقط — غير مربوطة بأي بيانات حقيقية ولا تُرسل طلبات
      </div>

      {/* هيدر: التقدم الكلي */}
      <div style={{ background: `linear-gradient(135deg, ${B.deep}, ${B.brand})`, color: "#fff", padding: "18px 16px 22px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 700 }}>خطة وجباتك</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                اليوم {dayIdx + 1} من {DAYS.length} — {DAYS[dayIdx].d} {DAYS[dayIdx].date}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,.18)", borderRadius: 14, padding: "8px 14px", fontWeight: 900, fontSize: 14 }}>
              {doneDays}/{DAYS.length} يوم مكتمل
            </div>
          </div>
          {/* شريط تقدم */}
          <div style={{ marginTop: 12, height: 8, background: "rgba(255,255,255,.25)", borderRadius: 99 }}>
            <div style={{ width: `${(doneDays / DAYS.length) * 100}%`, height: "100%", background: "#fff", borderRadius: 99, transition: "width .4s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 14px 90px" }}>
        {/* خط الأيام */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 10px" }}>
          {DAYS.map((d, i) => {
            const done = dayDone(i);
            const cur = i === dayIdx;
            const locked = !done && !cur && i !== DAYS.findIndex((_, k) => !dayDone(k));
            return (
              <button key={i}
                onClick={() => { if (!locked) { setDayIdx(i); setActiveSlot(SLOTS.findIndex((s) => !(picks[i] || {})[s.key]) >= 0 ? SLOTS.findIndex((s) => !(picks[i] || {})[s.key]) : 0); } }}
                style={{
                  minWidth: 86, padding: "8px 10px", borderRadius: 14, border: `1.5px solid ${cur ? B.deep : done ? "#a7f3d0" : B.line}`,
                  background: cur ? B.deep : done ? "#ecfdf5" : "#fff", color: cur ? "#fff" : done ? "#059669" : locked ? "#b8c9d6" : B.ink,
                  fontWeight: 800, fontSize: 12, cursor: locked ? "not-allowed" : "pointer", textAlign: "center", flexShrink: 0,
                }}>
                <div>{d.d} {done && "✓"}{locked && " 🔒"}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{d.date}</div>
              </button>
            );
          })}
        </div>

        {allDone ? (
          <div style={{ background: "#ecfdf5", border: "1.5px solid #6ee7b7", borderRadius: 18, padding: 26, textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#065f46" }}>تم اختيار وجباتك حتى نهاية اشتراكك!</div>
            <div style={{ color: "#047857", fontWeight: 700, marginTop: 6, fontSize: 14 }}>راجع اختياراتك ثم أرسلها للأخصائية بضغطة واحدة.</div>
            <button style={{ marginTop: 14, background: B.deep, color: "#fff", border: 0, borderRadius: 14, padding: "12px 28px", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
              مراجعة وإرسال (تجريبي)
            </button>
            <button onClick={() => { setPicks({}); setDayIdx(0); setActiveSlot(0); }}
              style={{ marginTop: 14, marginInlineStart: 8, background: "#fff", color: B.deep, border: `1.5px solid ${B.line}`, borderRadius: 14, padding: "12px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              <RotateCcw size={13} style={{ verticalAlign: -2 }} /> إعادة التجربة
            </button>
          </div>
        ) : (
          <>
            {/* خانات اليوم */}
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {SLOTS.map((s, i) => {
                const m = MEALS.find((x) => x.id === dayPicks[s.key]);
                const cur = i === activeSlot;
                return (
                  <button key={s.key} onClick={() => setActiveSlot(i)}
                    style={{
                      flex: "1 1 120px", borderRadius: 16, padding: "10px 12px", textAlign: "start", cursor: "pointer",
                      border: `2px solid ${cur ? B.brand : m ? "#a7f3d0" : B.line}`,
                      background: cur ? "#eefafe" : m ? "#f0fdf9" : "#fff",
                      boxShadow: cur ? "0 4px 14px rgba(60,196,240,.18)" : "none",
                    }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: m ? "#059669" : "#64748b" }}>
                      {s.icon} {s.label} {m && <Check size={11} style={{ verticalAlign: -1 }} />}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 3, minHeight: 18, color: m ? B.ink : "#b8c9d6" }}>
                      {m ? m.ar : "اضغط للاختيار"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* سعرات اليوم */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 2px 6px", fontSize: 12.5, fontWeight: 800, color: "#64748b" }}>
              <Flame size={14} color="#f59e0b" /> إجمالي اليوم: <b style={{ color: B.ink }}>{dayKcal}</b> سعرة · {filledCount}/{SLOTS.length} خانة
            </div>

            {/* اختيار الوجبة للخانة النشطة */}
            <div style={{ background: "#fff", border: `1.5px solid ${B.line}`, borderRadius: 18, padding: 14, marginTop: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10 }}>
                اختر {slot.label} {DAYS[dayIdx].d} <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>— وجبات هذا اليوم من منيو المطبخ</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                {candidates.map((m) => {
                  const sel = dayPicks[slot.key] === m.id;
                  return (
                    <button key={m.id} onClick={() => pick(m.id)}
                      style={{
                        textAlign: "start", borderRadius: 16, padding: 12, cursor: "pointer",
                        border: `2px solid ${sel ? "#10b981" : B.line}`, background: sel ? "#f0fdf9" : "#fbfdfe",
                        transition: "transform .15s", position: "relative",
                      }}>
                      {sel && <span style={{ position: "absolute", top: 8, insetInlineEnd: 8, background: "#10b981", color: "#fff", borderRadius: 99, width: 22, height: 22, display: "grid", placeItems: "center" }}><Check size={13} /></span>}
                      <div style={{ fontSize: 30 }}>{m.emoji}</div>
                      <div style={{ fontWeight: 900, fontSize: 13.5, marginTop: 6 }}>{m.ar}</div>
                      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>{m.en}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, fontSize: 10.5, fontWeight: 800 }}>
                        <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "2px 7px" }}>🔥 {m.kcal}</span>
                        <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 8, padding: "2px 7px" }}>ب {m.p}g</span>
                        <span style={{ background: "#f3e8ff", color: "#6b21a8", borderRadius: 8, padding: "2px 7px" }}>ك {m.c}g</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* احتفال اكتمال اليوم */}
      {celebrate && (
        <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "rgba(14,42,74,.35)", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: "26px 34px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>اكتمل {DAYS[dayIdx].d}!</div>
            <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
              <Sparkles size={13} style={{ verticalAlign: -2 }} /> ننقلك لليوم التالي…
            </div>
          </div>
        </div>
      )}

      {/* شريط سفلي ثابت: ملخص + زر */}
      {!allDone && (
        <div style={{ position: "fixed", bottom: 0, insetInline: 0, background: "#fff", borderTop: `1.5px solid ${B.line}`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#64748b" }}>
            {DAYS[dayIdx].d}: <b style={{ color: B.ink }}>{filledCount}/{SLOTS.length}</b> · إجمالي الأيام المكتملة: <b style={{ color: "#059669" }}>{doneDays}</b>
          </div>
          <button disabled={filledCount < SLOTS.length}
            style={{ background: filledCount < SLOTS.length ? "#e2e8f0" : B.deep, color: filledCount < SLOTS.length ? "#94a3b8" : "#fff", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 900, fontSize: 13, cursor: filledCount < SLOTS.length ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            اليوم التالي <ChevronLeft size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
