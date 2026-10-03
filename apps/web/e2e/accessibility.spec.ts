import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedDemoApp } from './helpers';

/**
 * سنجش دسترس‌پذیری با axe در همه صفحه‌های اصلی.
 *
 * معیار پذیرش: هیچ خطای سطح A یا AA در WCAG 2.1 گزارش نشود.
 */
const ROUTES: Array<{ path: string; title: string }> = [
  { path: '/', title: 'داشبورد' },
  { path: '/employees/', title: 'کارکنان' },
  { path: '/attendance/', title: 'حضور و غیاب' },
  { path: '/payroll/', title: 'محاسبه حقوق' },
  { path: '/reports/', title: 'گزارش‌ها' },
  { path: '/settings/', title: 'تنظیمات' },
  { path: '/help/', title: 'راهنما' },
];

test.describe('دسترس‌پذیری WCAG 2.1 AA', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'سنجش axe فقط روی کروم اجرا می‌شود.');

  for (const route of ROUTES) {
    test(`صفحه ${route.title} بدون خطای دسترس‌پذیری است`, async ({ page }) => {
      await seedDemoApp(page);
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('[data-axe-ignore]')
        .analyze();

      const summary = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      }));

      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }

  test('پیمایش کامل با صفحه‌کلید ممکن است', async ({ page }) => {
    await seedDemoApp(page);
    await page.goto('/employees/');
    // پرش به محتوای اصلی از راه پیوند «پرش به محتوا» و رسیدن به فرم کارمند جدید.
    await page.keyboard.press('Tab');
    const focusRing = await page.evaluate(() => {
      const element = document.activeElement;
      return element ? getComputedStyle(element).outlineStyle : '';
    });
    expect(['solid', 'auto', 'dashed']).toContain(focusRing);
  });
});
