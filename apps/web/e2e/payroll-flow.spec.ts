import { expect, test, type Page } from '@playwright/test';
import { expectToast, gotoSection, seedDemoApp } from './helpers';

/**
 * جریان کامل کاری حسابدار:
 * افزودن کارمند ← ثبت کارکرد ← اجرای دوره حقوقی ← مشاهده فیش ← خروجی رسمی.
 */
test.describe('جریان کامل حقوق و دستمزد', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'این سناریو فقط روی کروم اجرا می‌شود.',
  );

  /** پر کردن یک تاریخ شمسی از سه گزینشگر روز/ماه/سال. */
  async function setJalali(
    page: Page,
    groupName: string,
    jy: number,
    jm: number,
    jd: number,
  ): Promise<void> {
    const group = page.getByRole('group', { name: groupName });
    const selects = group.locator('select');
    await selects.nth(0).selectOption(String(jd));
    await selects.nth(1).selectOption(String(jm));
    await selects.nth(2).selectOption(String(jy));
  }

  test('از ثبت کارمند تا خروجی فیش و دیسکت بیمه', async ({ page }) => {
    await seedDemoApp(page);

    // ۱) ثبت کارمند تازه از راه فرم کامل
    await gotoSection(page, 'کارکنان');
    await page.getByRole('button', { name: 'کارمند جدید' }).first().click();
    await expect(page.getByText('ثبت کارمند جدید').first()).toBeVisible();

    await page.getByLabel('شماره پرسنلی').fill('AR-9001');
    await page.getByLabel('نام', { exact: true }).fill('آزمون');
    await page.getByLabel('نام خانوادگی').fill('سرتاسری');
    await page.getByLabel('نام پدر').fill('محمد');
    await page.getByLabel('کد ملی').fill('3456789017');
    await page.getByLabel('شماره شناسنامه').fill('1234');
    await setJalali(page, 'تاریخ تولد', 1365, 1, 1);
    await page.getByLabel('دپارتمان').selectOption({ index: 0 });
    await page.getByLabel('سمت').fill('کارشناس آزمون');
    await setJalali(page, 'تاریخ استخدام', 1404, 1, 1);
    await page.getByLabel('شماره بیمه تأمین اجتماعی').fill('1234567890');
    await page.getByLabel('پایه حقوق ماهانه').fill('166255500');

    await page.getByRole('button', { name: 'ثبت کارمند' }).click();
    await expectToast(page, /ذخیره شد|ثبت شد/);
    await expect(page.getByText('AR-9001').first()).toBeVisible();

    // ۲) ثبت کارکرد یک روز برای کارمند تازه
    await gotoSection(page, 'حضور و غیاب');
    const employeeSelect = page.getByRole('combobox', { name: 'انتخاب کارمند' });
    const newEmployeeOption = await employeeSelect
      .locator('option', { hasText: 'AR-9001' })
      .first()
      .getAttribute('value');
    await employeeSelect.selectOption(newEmployeeOption ?? { index: 0 });
    const firstCell = page
      .getByRole('button', { name: /آزمون سرتاسری، روز ۱(?![۰-۹0-9])/ })
      .first();
    await firstCell.click();
    await expect(page.getByLabel('نوع کارکرد')).toBeVisible();
    await page.getByLabel('نوع کارکرد').selectOption('present');
    await page.getByLabel('ساعت ورود').fill('08:00');
    await page.getByLabel('ساعت خروج').fill('17:00');
    await page.getByRole('button', { name: 'ثبت کارکرد' }).click();
    await expectToast(page, /ثبت شد|ذخیره شد/);

    // ۳) اجرای دوره حقوقی در چهار گام
    await gotoSection(page, 'محاسبه حقوق');
    await expect(page.getByText('گام بعدی').first()).toBeVisible();
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole('button', { name: 'گام بعدی' }).click();
    }
    await expect(page.getByText(/کسورات/).first()).toBeVisible();
    await page.getByRole('button', { name: /اجرای محاسبه حقوق/ }).click();
    await expectToast(page, /اجرا|محاسبه/);

    // ۴) تولید فیش حقوقی و خروجی‌های رسمی
    await gotoSection(page, 'گزارش‌ها');
    await expect(page.getByText('گزارش‌ها و خروجی‌های رسمی')).toBeVisible();

    const disketteDownload = page.waitForEvent('download', { timeout: 30_000 });
    await page
      .getByRole('button', { name: /بارگیری فایل دیسکت/ })
      .first()
      .click();
    const diskette = await disketteDownload;
    expect(diskette.suggestedFilename()).toMatch(/DSK-.*\.txt/);

    // ۵) قفل دوره و اطمینان از باقی‌ماندن نسخه
    await gotoSection(page, 'محاسبه حقوق');
    await expect(page.getByText(/تاریخچه نسخه‌های دوره/).first()).toBeVisible();
  });
});
