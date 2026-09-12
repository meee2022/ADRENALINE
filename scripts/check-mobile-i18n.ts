import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const { uiEnglish, uiTemplates, translateUI } = createRequire(import.meta.url)('../apps/mobile/src/uiTranslations.ts') as typeof import('../apps/mobile/src/uiTranslations');

for (const [ar, en] of Object.entries(uiEnglish)) {
  assert.equal(translateUI(ar, 'ar'), ar, `Arabic changed: ${ar}`);
  assert.equal(translateUI(ar, 'en'), en, `Missing English: ${ar}`);
  assert.equal(translateUI(` ${ar} `, 'en'), ` ${en} `, `Lost spacing: ${ar}`);
}
for (const [ar, en] of uiTemplates) {
  const sample = (s: string) => s.replace(/\{(\d+)\}/g, (_, i) => String(Number(i) + 10));
  assert.equal(translateUI(sample(ar), 'en'), sample(en), `Template mismatch: ${ar}`);
}
assert.equal(translateUI('اكتملت اختيارات اليوم. انتقلنا إلى السبت.', 'en'), 'Today’s selections are complete. Moving to Saturday.');
assert.equal(translateUI('أكمل كل أيام الاشتراك أولًا. المتبقي: 2 وجبة و1 سناك.', 'en'), 'Complete all subscription days first. Remaining: 2 meals and 1 snack.');
assert.equal(translateUI('تم الحفظ على هذا الجهاز\n\nهذه الوجبة لم تعد متاحة. اختر وجبة أخرى.', 'en'), 'Saved on this device\n\nThis meal is no longer available. Choose another meal.');
for (const personal of ['30296555', 'private@example.com', 'عميل غير موجود في القاموس', 'وصف وجبة غير موجود في القاموس', 'expo_attempt_123', '2026-09-12']) {
  assert.equal(translateUI(personal, 'en'), personal, 'Never guess or modify customer data');
}

// Guard all static copy, not comments. Explicit bilingual branches and business matching terms are excluded.
const intentional = new Set(['العربية', 'لغة التطبيق', 'تعذّر حفظ اللغة؛ اخترها مجددًا للمحاولة.', '،', '٫', '٠١٢٣٤٥٦٧٨٩']);
const businessTerms = new Set(['خسارة', 'نزول', 'توازن', 'ثبات', 'كتلة', 'عضلات']);
const missing: string[] = [];
let checked = 0;
function scan(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!/\.tsx?$/.test(path) || /(?:Artwork|Translations|useContentLanguage)\.ts$/.test(path)) continue;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const value = node.text.trim();
        if (/[\u0600-\u06ff]/.test(value)) {
          const explicitPair = ts.isCallExpression(node.parent) && node.parent.expression.getText(source) === 't';
          const ruleTerm = path.endsWith('calorieCalculator.ts') && businessTerms.has(value);
          if (!explicitPair && !ruleTerm && !intentional.has(value)) {
            checked++;
            if (translateUI(value, 'en') === value) missing.push(`${relative('.', path)}: ${value}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
scan('apps/mobile/app'); scan('apps/mobile/src');
assert.deepEqual(missing, [], 'Untranslated static mobile copy');
console.log(`PASS: ${Object.keys(uiEnglish).length} translations, ${uiTemplates.length} templates, ${checked} source strings; Arabic and personal data preserved.`);
