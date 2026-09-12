export type PlanOption = { mealsCount: number; snacksCount: number; priceQAR: number };
export type PlanChoice = { index: number; fingerprint: string };
export const optionFingerprint = (option: PlanOption) => JSON.stringify([option.mealsCount, option.snacksCount, option.priceQAR]);
/** Do not silently carry a selection to a different duration or changed price. */
export function resolvePlanChoice(options: PlanOption[], choice?: PlanChoice) {
  if (!choice || !Number.isInteger(choice.index) || choice.index < 0) return undefined;
  const option = options[choice.index];
  return option && optionFingerprint(option) === choice.fingerprint ? option : undefined;
}
export const payablePrice = (option?: PlanOption) => !!option && Number.isFinite(Number(option.priceQAR)) && Number(option.priceQAR) > 0;
