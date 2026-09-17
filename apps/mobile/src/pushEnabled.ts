/**
 * هل تظهر إشعارات الطلبات على هذا الجهاز؟
 * أندرويد: extra.subscriberPushEnabled. iOS يحتاج أيضاً extra.iosPushEnabled لأن البناء بلا صلاحية
 * Push (aps-environment) يفشل فيه طلب الرمز، وزر لا يعمل سبب رفض في مراجعة App Store (2.1).
 * Codemagic يضبط iosPushEnabled عند IOS_PUSH_READY=true (بعد تفعيل Push في Apple Developer ومفتاح APNs).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function pushEnabled(): boolean {
  const extra = Constants.expoConfig?.extra as any;
  if (!extra?.subscriberPushEnabled) return false;
  return Platform.OS !== 'ios' || extra?.iosPushEnabled === true;
}
