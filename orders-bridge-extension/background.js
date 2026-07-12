// خدمة خلفية بسيطة: تعرض إشعار نظام موحّد لأي طلب جديد يرسله content.js.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "NEW_ORDER") {
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "icon.png",
      title: "🔔 طلب جديد — " + (msg.platform || "أونلاين"),
      message: msg.detail || "وصلك طلب جديد، راجع الشاشة.",
      priority: 2,
    });
  }
});
