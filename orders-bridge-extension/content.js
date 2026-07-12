/**
 * Adrenaline Orders Alert — content script
 * يراقب لوحة كل منصّة، وأول ما يزيد عدد الطلبات يطلق إشعاراً موحّداً + صوت.
 * كل شيء محلي على الجهاز — لا تُرسَل أي بيانات لأي مكان.
 *
 * ⚠️ عدّادات المنصّات قد تتغيّر شكلها؛ لو توقّف الكشف لمنصّة، عدّل getCount لها.
 */
(function () {
  const host = location.hostname;
  const platform = host.includes("talabat") ? "طلبات (Talabat)"
    : host.includes("snoonu") ? "سنونو (Snoonu)"
    : host.includes("gorafeeq") ? "رفيق (Rafeeq)"
    : "أونلاين";

  // --- عدّاد الطلبات النشِطة لكل منصّة (عدة إشارات + احتياطي عام) ---
  function num(re, text) { const m = String(text).match(re); return m ? parseInt(m[1], 10) : null; }

  function getCount() {
    const body = document.body ? document.body.innerText : "";
    const title = document.title || "";
    let c = null;

    if (host.includes("talabat")) {
      // العنوان يظهر عدد الطلبات مثل: "(2) Talabat Partner | Live Orders"
      c = num(/\((\d+)\)/, title);
      if (c == null) { // احتياطي: New N + Accepted N
        const n = num(/New\s+(\d+)/i, body), a = num(/Accepted\s+(\d+)/i, body);
        if (n != null || a != null) c = (n || 0) + (a || 0);
      }
    } else if (host.includes("snoonu")) {
      // Needs Action / Preparing / Ready for Pickup
      const na = num(/Needs Action\s*(\d+)/i, body);
      const pr = num(/Preparing\s*(\d+)/i, body);
      const rp = num(/Ready for Pickup\s*(\d+)/i, body);
      if (na != null || pr != null || rp != null) c = (na || 0) + (pr || 0) + (rp || 0);
    } else if (host.includes("gorafeeq")) {
      c = num(/Current Orders\s*\((\d+)\)/i, body);
    }

    // احتياطي عام لكل المنصّات: عدّ أرقام الطلبات الظاهرة (#12345 أو Order #...)
    if (c == null) {
      const ids = (body.match(/#\s?\d{5,}/g) || []);
      c = new Set(ids.map((x) => x.replace(/\s/g, ""))).size;
    }
    return c || 0;
  }

  // --- تنبيه صوتي (بجانب صوت إشعار النظام) ---
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      for (let i = 0; i < 3; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.value = 0.001; o.connect(g); g.connect(audioCtx.destination);
        const t = audioCtx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.start(t); o.stop(t + 0.32);
      }
    } catch (e) { /* الصوت قد يحتاج تفاعلاً — إشعار النظام يكفي */ }
  }

  function notify(added) {
    try {
      chrome.runtime.sendMessage({
        type: "NEW_ORDER",
        platform,
        detail: `وصلك ${added > 1 ? added + " طلبات" : "طلب"} جديد — راجع شاشة ${platform}.`,
      });
    } catch (e) { /* ignore */ }
    beep();
    // وميض في عنوان التبويب
    const orig = document.title;
    let f = 0; const iv = setInterval(() => {
      document.title = (f % 2 ? "🔔 طلب جديد — " : "") + orig; f++;
      if (f > 8) { clearInterval(iv); document.title = orig; }
    }, 700);
  }

  let last = null;
  function tick() {
    const c = getCount();
    if (last != null && c > last) notify(c - last);
    last = c;
  }

  // تفعيل الصوت بأول نقرة (سياسة المتصفح)
  window.addEventListener("click", () => { try { audioCtx && audioCtx.resume(); } catch (e) {} }, { once: false });

  // يبدأ بعد ثانيتين ثم كل 4 ثوانٍ
  setTimeout(() => { last = getCount(); setInterval(tick, 4000); }, 2000);
  console.log("[Adrenaline Orders Alert] مُفعّل على", platform);
})();
