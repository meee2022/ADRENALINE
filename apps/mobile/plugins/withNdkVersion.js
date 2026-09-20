/**
 * تثبيت نسخة NDK على المثبَّتة محلياً بدل التي يطلبها الافتراض.
 *
 * السبب: بناء الأندرويد محلي (لا CI) وتنزيل حزم Android SDK متعذّر على شبكة المكتب —
 * يتوقف عند "Preparing Install NDK" بلا تقدّم. النسخة 27.1.12297006 مثبَّتة كاملة (2.2GB)
 * ومعتمدة في بناء 1.2.0 السابق، فنوجّه Gradle إليها ولا ننزّل شيئاً.
 *
 * للتغيير لاحقاً: عدّل NDK_VERSION، أو احذف الملحق من app.json ليعود السلوك الافتراضي.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const NDK_VERSION = '27.1.12297006';
const MARK = '// adrenaline-ndk-pin';

module.exports = function withNdkVersion(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes(MARK)) return cfg;
    cfg.modResults.contents += [
      '',
      MARK,
      `ext.ndkVersion = "${NDK_VERSION}"`,
      'subprojects { sub ->',
      '  sub.afterEvaluate {',
      '    if (sub.extensions.findByName("android") != null) {',
      `      sub.extensions.getByName("android").ndkVersion = "${NDK_VERSION}"`,
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');
    return cfg;
  });
};
