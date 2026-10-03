import js from '@eslint/js';
import next from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * پیکربندی مشترک ESLint برای همه بسته‌های دستمزد آرمانی ۱۴۰۵.
 *
 * قواعد سخت‌گیرانه پروژه: ممنوعیت `any`، الزام دسترس‌پذیری (jsx-a11y) و
 * قواعد هوک‌های React. بسته‌های وب، دسکتاپ و کتابخانه رابط کاربری از یک
 * پیکربندی استفاده می‌کنند تا رفتار یکسان بماند.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/src-tauri/target/**',
      'packages/brand/logo/**',
      'apps/web/public/**',
      '**/*.mjs',
      '**/*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': next,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      // قرارداد پروژه: هیچ `any` صریحی مجاز نیست.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      // مسیر صفحات با App Router در apps/web تعیین می‌شود.
      '@next/next/no-html-link-for-pages': 'off',
      // متن‌های فارسی و شناسه‌های فنی در پروژه ترکیبی هستند.
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipComments: true, skipTemplates: true },
      ],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  prettier,
);
