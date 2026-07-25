// eslint.config.js
/**
 * الغرض الوحيد من هذا الملف اليوم: منع خطأ الـhooks الذي أسقط صفحة مراجعة
 * الطلبات على الأخصائية مرّتين (React #310 — hook بعد return مبكر).
 * TypeScript لا يرى هذا الخطأ، فكان يمرّ حتى يقع أمام المستخدم.
 *
 * القواعد مضبوطة كـ error على قواعد الـhooks فقط، وكل ما عداها مُطفأ عمداً
 * حتى لا يغرق التشغيل في تحذيرات تُخفي الخطأ الحقيقي.
 */
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "convex/_generated/**",
      "tmp/**",
      "migrations/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // ⛔ الأهم: hook داخل شرط/حلقة/بعد return مبكر
      "react-hooks/rules-of-hooks": "error",
      // تحذير فقط: التبعيات الناقصة كثيرة تاريخياً ولا تُسقط الصفحة
      "react-hooks/exhaustive-deps": "warn",

      // مُطفأة عمداً — ليست هدف هذا الملف
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",
      "no-cond-assign": "off",
      "no-useless-assignment": "off",
      "no-fallthrough": "off",
    },
  },
];
