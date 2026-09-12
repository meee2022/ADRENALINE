export function planArtwork(plan: any) {
  const key = `${plan.slug || ''} ${plan.nameEn || ''} ${plan.nameAr || ''}`.toLowerCase();
  if (/diet|tanshif|تنظيف|تنشيف|تنحيف/.test(key)) return require('../assets/plans/plan-diet.png');
  if (/fitness|liyaqa|لياقت|لياقة/.test(key)) return require('../assets/plans/plan-fitness.png');
  if (/bulk|tadkhim|تضخيم/.test(key)) return require('../assets/plans/plan-bulk.png');
  return require('../assets/plans/plan-custom.png');
}
