import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { seedDemoApp } from './helpers';

/**
 * تهیه تصاویر مستندات و رسانه.
 *
 * اجرا: `pnpm --filter web screenshots` (خروجی در `docs/screenshots`).
 * این آزمون در CI اجرا نمی‌شود تا تصاویر مستندات جایگزین نشوند.
 */
const OUT_DIR = join(process.cwd(), '..', '..', 'docs', 'screenshots');

const PAGES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'dashboard' },
  { path: '/employees/', name: 'employees' },
  { path: '/attendance/', name: 'attendance' },
  { path: '/payroll/', name: 'payroll-wizard' },
  { path: '/reports/', name: 'reports' },
  { path: '/settings/', name: 'settings' },
  { path: '/help/', name: 'help' },
];

test.describe('تصاویر مستندات', () => {
  test.skip(!!process.env.CI, 'تصاویر مستندات فقط به‌صورت محلی ساخته می‌شوند.');
  test.skip(({ browserName }) => browserName !== 'chromium', 'تصاویر فقط با کروم گرفته می‌شوند.');

  test.beforeAll(async () => {
    await mkdir(OUT_DIR, { recursive: true });
  });

  for (const item of PAGES) {
    test(`تصویر ${item.name} در حالت روشن و تیره`, async ({ page }) => {
      await seedDemoApp(page);
      await page.setViewportSize({ width: 1440, height: 1000 });

      await page.goto(item.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(OUT_DIR, `${item.name}-light.png`), fullPage: true });

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload({ waitUntil: 'networkidle' });
      await page.screenshot({ path: join(OUT_DIR, `${item.name}-dark.png`), fullPage: true });
      await page.emulateMedia({ colorScheme: 'light' });

      // نسخه موبایل برای راهنمای کاربر و فروشگاه.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(item.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(OUT_DIR, `${item.name}-mobile.png`), fullPage: false });

      await expect(page).toHaveTitle(/.+/);
    });
  }
});
