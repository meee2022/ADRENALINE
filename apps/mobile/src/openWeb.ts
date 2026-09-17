/**
 * فتح روابط الويب داخل التطبيق (SFSafariViewController / Chrome Custom Tabs) بدل متصفح الجهاز.
 * Apple رفضت 1.1.0 (Guideline 4) لأن رابط إنشاء الحساب كان يخرج المستخدم إلى Safari.
 * واتساب والاتصال والبريد تبقى روابط نظام لأنها تفتح تطبيقات أخرى لا صفحات ويب.
 */
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const SYSTEM_LINK = /^(tel:|mailto:|sms:|whatsapp:|https?:\/\/(wa\.me|api\.whatsapp\.com|maps\.apple\.com|maps\.app\.goo\.gl|www\.google\.com\/maps))/i;

export async function openWeb(url: string): Promise<void> {
  if (Platform.OS === 'web' || SYSTEM_LINK.test(url) || !/^https?:\/\//i.test(url)) {
    await Linking.openURL(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close', controlsColor: '#0E76AC' });
}
