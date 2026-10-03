import { defineConfig, devices } from '@playwright/test';

/**
 * پیکربندی آزمون‌های سرتاسری دستمزد آرمانی ۱۴۰۵.
 *
 * دو سرور بالا می‌آید:
 *  ۱) سرور توسعه Next روی پورت ۳۱۰۰ برای آزمون‌های تعاملی.
 *  ۲) سرور ایستا روی خروجی `out` (پورت ۳۱۰۱) برای سنجش رفتار واقعی PWA،
 *     سرویس‌ورکر و manifest.
 */
const DEV_PORT = Number(process.env.E2E_PORT ?? 3100);
const STATIC_PORT = Number(process.env.E2E_STATIC_PORT ?? 3101);
const DEV_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${DEV_PORT}`;
const STATIC_URL = `http://127.0.0.1:${STATIC_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // هر آزمون در بافت مرورگر تازه اجرا می‌شود؛ پایگاه‌داده محلی مشترک نیست.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL: DEV_URL,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], baseURL: DEV_URL } },
    {
      name: 'pwa-static',
      testMatch: /pwa-offline\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: STATIC_URL },
    },
  ],
  webServer: [
    {
      command: `pnpm exec next dev -p ${DEV_PORT}`,
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { GITHUB_PAGES: 'false' },
    },
    {
      command: `node scripts/serve-static.mjs ${STATIC_PORT}`,
      url: STATIC_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
