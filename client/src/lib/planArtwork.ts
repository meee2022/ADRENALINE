/** Approved Expo subscription artwork, shared by website presentation surfaces. */
export function planArtworkUrl(plan: {slug?:string;nameEn?:string;nameAr?:string}) {
  const key=`${plan.slug||''} ${plan.nameEn||''} ${plan.nameAr||''}`.toLowerCase();
  if(/diet|tanshif|تنظيف|تنشيف|تنحيف/.test(key))return '/plan-artwork/plan-diet.png';
  if(/fitness|liyaqa|لياقت|لياقة/.test(key))return '/plan-artwork/plan-fitness.png';
  if(/bulk|tadkhim|تضخيم/.test(key))return '/plan-artwork/plan-bulk.png';
  return '/plan-artwork/plan-custom.png';
}
