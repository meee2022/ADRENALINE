/**
 * @file convex/crons.ts
 * @description المهام المجدولة.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * تقديم أسبوع دورة الطبخ +1 كل بداية أسبوع توصيل (السبت فجراً بتوقيت قطر).
 * قطر +03:00، فالسبت 00:15 محلياً = الجمعة 21:15 UTC.
 * المهمة نفسها محمية ضد التكرار عبر cookingWeekAdvancedOn، فحتى لو أُعيد
 * تشغيلها لا تتقدّم مرتين في نفس السبت.
 */
crons.weekly(
  "advance cooking week",
  { dayOfWeek: "friday", hourUTC: 21, minuteUTC: 15 },
  internal.restaurantSettings.advanceCookingWeek,
);

export default crons;
