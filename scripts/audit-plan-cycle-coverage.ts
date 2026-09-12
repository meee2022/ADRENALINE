/** Read-only fixtures. Reports ambiguous recurring slot keys; never contacts a backend. */
import { orderedSubscriptionSlots, slotToDate } from '../shared/rules/subscription';

const start = '2026-09-12';
const today = '2026-09-09';
let ambiguous = false;
for (const calendarDays of [7, 14, 28, 30, 35, 56]) {
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + calendarDays - 1);
  const slots = orderedSubscriptionSlots(start, end.toISOString().slice(0, 10), 1, today);
  const keys = new Set(slots.map(s => `${s.week}:${s.day}`));
  const dates = new Set(slots.map(s => slotToDate(start, 1, s.week, s.day, today)));
  const repeated = slots.length - keys.size;
  ambiguous ||= repeated > 0;
  console.log(JSON.stringify({calendarDays, deliveryDays: slots.length, uniqueSlotKeys: keys.size, resolvedDates: dates.size, repeated}));
}
if (ambiguous) {
  console.error('RELEASE HOLD: recurring week/day keys cannot distinguish all dates beyond one rotation. Confirm intended repeat-vs-full-period policy before changing production logic.');
  process.exitCode = 1;
}
