/**
 * ذاكرة بناء أندرويد — بناء release فشل بعد «expo prebuild --clean» لأن Gradle استنفد
 * JVM Metaspace (512MB) أثناء compileReleaseKotlin في expo-constants وexpo-log-box،
 * بلا رسالة خطأ في الكود. prebuild يعيد توليد android/gradle.properties كل مرة، فالقيم هنا.
 *
 * الجهاز: 15.5GB RAM و12 نواة؛ 6 عمّال تكفي دون استنزاف الذاكرة.
 */
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'kotlin.daemon.jvmargs': '-Xmx2048m -XX:MaxMetaspaceSize=512m',
  'org.gradle.workers.max': '6',
};

function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
}

module.exports = withGradleMemory;
