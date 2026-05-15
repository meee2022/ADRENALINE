/**
 * @file client/src/lib/whatsapp.ts
 * @description Helper لإنشاء روابط واتساب لإرسال رسائل تلقائية للعملاء
 */

function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  // قطر: لو الرقم 8 أرقام فقط، أضف 974
  if (digits.length === 8) return `974${digits}`;
  // لو يبدأ بـ 00974
  if (digits.startsWith("00974")) return digits.slice(2);
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const num = normalizePhone(phone);
  if (!num) return "";
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(phone: string, message: string) {
  const link = buildWhatsAppLink(phone, message);
  if (link) window.open(link, "_blank", "noopener,noreferrer");
}

// ===== قوالب الرسائل =====

export const WhatsAppTemplates = {
  /** ترحيب بطلب جديد */
  orderReceived: (name: string, orderNumber: string, totalMeals: number) =>
    `مرحباً ${name} 👋\n\n` +
    `شكراً لطلبك من *Adrenaline Healthy Food*! 🥗\n\n` +
    `📋 رقم الطلب: *${orderNumber}*\n` +
    `🍽️ عدد الوجبات: ${totalMeals}\n\n` +
    `سيتم مراجعة طلبك من قبل أخصائية التغذية وسنتواصل معك قريباً.\n\n` +
    `لتتبع طلبك: https://adrenaline-healthy.com/public/track`,

  /** اعتماد الطلب */
  orderApproved: (name: string, orderNumber: string, startDate: string) =>
    `أهلاً ${name} 🎉\n\n` +
    `تم اعتماد طلبك *${orderNumber}*\n` +
    `📅 بداية التوصيل: ${startDate}\n\n` +
    `جاهزون لخدمتك! 💪\n` +
    `Adrenaline Healthy Food`,

  /** الوجبة جاهزة */
  mealPrepared: (name: string, date: string) =>
    `مرحباً ${name} ✅\n\n` +
    `وجباتك ليوم *${date}* جاهزة وستصلك قريباً.\n\n` +
    `استمتع بوجبتك! 🥗\n` +
    `Adrenaline Healthy Food`,

  /** تم التوصيل */
  delivered: (name: string) =>
    `${name} 🚚\n\n` +
    `تم توصيل وجباتك بنجاح!\n` +
    `نتمنى لك تجربة لذيذة ومفيدة.\n\n` +
    `📝 شاركنا تقييمك على المنتجات في حسابك.\n\n` +
    `شكراً لاختيارك *Adrenaline Healthy Food* 💚`,

  /** تذكير بنهاية الاشتراك */
  subscriptionEnding: (name: string, endDate: string) =>
    `أهلاً ${name} 👋\n\n` +
    `اشتراكك في *Adrenaline Healthy Food* ينتهي بتاريخ *${endDate}*.\n\n` +
    `هل ترغب في التجديد؟ تواصل معنا للحصول على عرض خاص! 🎁`,

  /** رفض طلب */
  orderRejected: (name: string, reason: string) =>
    `مرحباً ${name}\n\n` +
    `نعتذر، لم نتمكن من تأكيد طلبك للسبب التالي:\n*${reason}*\n\n` +
    `يسعدنا تواصلك معنا لإيجاد حل مناسب.\n` +
    `Adrenaline Healthy Food`,

  /** رسالة عيد ميلاد */
  birthday: (name: string) =>
    `كل عام وأنت بخير ${name} 🎂🎉\n\n` +
    `بمناسبة عيد ميلادك، إليك كود خصم خاص: *BIRTHDAY15*\n` +
    `(خصم 15% على طلبك القادم)\n\n` +
    `Adrenaline Healthy Food 💚`,

  /** عرض ترويجي */
  promotion: (name: string, code: string, discount: string) =>
    `أهلاً ${name} 🎁\n\n` +
    `عرض خاص لك من *Adrenaline Healthy Food*!\n` +
    `كود الخصم: *${code}*\n` +
    `الخصم: ${discount}\n\n` +
    `لا تفوّت الفرصة! 🔥`,
};
