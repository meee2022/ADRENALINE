import { Pick, SelectionMeal, Subscriber, pickVerdict, selectionState } from './subscriberSelection';
import { slotToDate } from './rules';

export type SuggestedDay = { date: string; rotationWeek: number; day: string; picks: { id: string }[] };
/** Suggestions are untrusted: retain manual picks and use current canonical meals/rules. */
export function mergeSmartSuggestions(customer: Subscriber, rotation: number, existing: Pick[], catalog: SelectionMeal[], days: SuggestedDay[], today?: string) {
  const picks = [...existing];
  for (const slot of selectionState(customer, rotation, existing, today).slots) {
    const date = slotToDate(customer.startDate, rotation, slot.week, slot.day, today);
    const suggestion = days.find(d => d.date === date && d.rotationWeek === slot.week && d.day === slot.day);
    for (const candidate of suggestion?.picks || []) {
      const meal = catalog.find(m => m._id === candidate.id);
      if (!meal) continue;
      const verdict = pickVerdict(customer, rotation, picks, slot.week, slot.day, meal, today);
      if (verdict.block || verdict.duplicate || verdict.secondBreakfast || verdict.restriction) continue;
      picks.push({ meal, week: slot.week, day: slot.day });
    }
  }
  return picks;
}
