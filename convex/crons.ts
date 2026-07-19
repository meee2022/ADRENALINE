/**
 * @file convex/crons.ts
 * @description المهام المجدولة.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * تقديم أسبوع دورة الطبخ +1 فجر الجمعة بتوقيت قطر — المطبخ يحضّر الجمعة على
 * الأسبوع الجديد ليوصّل العميل السبت.
 * قطر +03:00، فالجمعة 00:15 محلياً = الخميس 21:15 UTC.
 * محمية ضد التكرار عبر cookingWeekAdvancedOn، فلا تتقدّم مرتين في نفس الجمعة.
 */
crons.weekly(
  "advance cooking week",
  { dayOfWeek: "thursday", hourUTC: 21, minuteUTC: 15 },
  internal.restaurantSettings.advanceCookingWeek,
);

/**
 * تقرير POS اليومي (Z-report) بالإيميل. يعمل كل ساعة، ويرسل مرة واحدة يومياً
 * حين تتجاوز ساعة قطر ساعة الإرسال المضبوطة (posDailyReport.sendTime).
 * محمي ضد التكرار عبر lastSentDate. لا يرسل شيئاً إن كان معطّلاً أو بلا مفتاح Resend.
 */
crons.hourly(
  "pos daily report",
  { minuteUTC: 5 },
  internal.posReports.runDailyReportCron,
);

export default crons;
