import { expect, type Page } from '@playwright/test';

/**
 * آماده‌سازی برنامه برای آزمون: در نخستین اجرا کارت خوش‌آمد نمایش داده می‌شود و
 * با «بارگذاری داده نمونه» پنج کارمند، پنج دپارتمان و کارکرد ماه مهر ۱۴۰۵ ساخته می‌شود.
 */
export async function seedDemoApp(page: Page): Promise<void> {
  await page.goto('/');
  const seedButton = page.getByRole('button', { name: 'بارگذاری داده نمونه' });
  if (await seedButton.isVisible().catch(() => false)) {
    await seedButton.click();
    await expect(
      page.getByRole('heading', { name: /خوش آمدید|داشبورد|دستمزد آرمانی/ }).first(),
    ).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'کارکنان' }).first()).toBeVisible();
}

/** رفتن به یک صفحه از ناوبری اصلی. */
export async function gotoSection(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name, exact: true }).first().click();
  await page.waitForLoadState('networkidle');
}

/** انتظار برای دیده‌شدن یک پیام توست با بخشی از متن آن. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 20_000 });
}

/** پر کردن یک میدان بر پایه برچسب فارسی آن. */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label, { exact: false }).first();
  await field.fill(value);
}
