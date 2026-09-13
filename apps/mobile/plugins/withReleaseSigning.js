/**
 * يوقّع بناء أندرويد release بمفتاح الرفع المسجّل في Google Play (نفس مفتاح نسخة Capacitor).
 *
 * كلمات المرور تبقى في android/keystore.properties خارج git — هذا الملف لا يقرأها ولا ينسخها،
 * بل يوجّه Gradle إلى الملف نفسه وقت البناء. لو الملف غير موجود يبقى البناء على مفتاح debug
 * (بناء تجريبي لا يُرفع)، فلا يفشل البناء على جهاز لا يملك المفتاح.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// adrenaline-release-signing';

// apps/mobile/android (rootProject) → جذر المستودع → android/
const PROPS_PATH = "rootProject.file('../../../android/keystore.properties')";
// storeFile في keystore.properties نسبي إلى android/app في مشروع Capacitor
const STORE_BASE = "rootProject.file('../../../android/app')";

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;

    const header = [
      MARK,
      'def adrenalineKeystoreProps = new Properties()',
      `def adrenalineKeystoreFile = ${PROPS_PATH}`,
      'if (adrenalineKeystoreFile.exists()) { adrenalineKeystoreFile.withInputStream { adrenalineKeystoreProps.load(it) } }',
      '',
    ].join('\n');
    if (!/\nandroid\s*\{/.test(gradle)) throw new Error('withReleaseSigning: android { block not found');
    gradle = gradle.replace(/\nandroid\s*\{/, `\n${header}android {`);

    const releaseConfig = [
      'signingConfigs {',
      '        release {',
      '            if (adrenalineKeystoreFile.exists()) {',
      `                storeFile new File(${STORE_BASE}, adrenalineKeystoreProps['storeFile'])`,
      "                storePassword adrenalineKeystoreProps['storePassword']",
      "                keyAlias adrenalineKeystoreProps['keyAlias']",
      "                keyPassword adrenalineKeystoreProps['keyPassword']",
      '            }',
      '        }',
    ].join('\n');
    if (!/signingConfigs\s*\{/.test(gradle)) throw new Error('withReleaseSigning: signingConfigs { block not found');
    gradle = gradle.replace(/signingConfigs\s*\{/, releaseConfig);

    // داخل buildTypes.release فقط: استبدل توقيع debug بالمفتاح الحقيقي حين يوجد ملفه
    const releaseBlock = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    if (!releaseBlock.test(gradle)) throw new Error('withReleaseSigning: release signingConfig line not found');
    gradle = gradle.replace(
      releaseBlock,
      '$1signingConfig adrenalineKeystoreFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
}

module.exports = withReleaseSigning;
