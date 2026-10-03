import { expect, test } from '@playwright/test';

/**
 * سنجش رفتار PWA روی خروجی ساخته‌شده (سرور ایستا): manifest، سرویس‌ورکر و کار
 * کردن برنامه در حالت آفلاین.
 */
test.describe('نصب‌شدنی بودن و کارکرد آفلاین', () => {
  test('manifest نصب‌شدنی با میان‌برها و آیکون‌ها موجود است', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(manifestHref).toBeTruthy();

    const response = await request.get(new URL(manifestHref as string, page.url()).toString());
    expect(response.ok()).toBeTruthy();
    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: Array<{ sizes: string; purpose?: string }>;
      shortcuts?: Array<{ name: string }>;
    };

    expect(manifest.name).toContain('دستمزد');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBeTruthy();
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBeTruthy();
    const shortcutNames = (manifest.shortcuts ?? []).map((item) => item.name);
    expect(shortcutNames).toEqual(
      expect.arrayContaining(['کارمند جدید', 'محاسبه حقوق', 'گزارش ماهانه']),
    );
  });

  test('سرویس‌ورکر ثبت می‌شود و صفحه در حالت آفلاین باز می‌ماند', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            navigator.serviceWorker.getRegistrations().then((list) => list.length),
          ),
        {
          timeout: 30_000,
        },
      )
      .toBeGreaterThan(0);

    // بار نخست برنامه کامل پیش‌بارگذاری می‌شود؛ سپس اتصال قطع می‌شود.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'کارکنان' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await context.setOffline(false);
  });

  test('بدون منبع خارجی بارگذاری می‌شود', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http')) {
        external.push(request.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(external.filter((url) => !url.includes('supabase.co'))).toEqual([]);
  });
});
