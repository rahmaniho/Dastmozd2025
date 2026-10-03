import { toLatinDigits } from '../utils/digits';

export interface ValidationResult {
  valid: boolean;
  /** Persian error message suitable for direct display in forms. */
  reason?: string;
}

const ALL_DIGITS = /^\d+$/;

/**
 * اعتبارسنجی کد ملی ایران (۱۰ رقم) بر پایه الگوریتم چک‌سام سازمان ثبت احوال.
 *
 * وزن‌های ۱۰ تا ۲ برای ارقام نه‌گانه اول اعمال می‌شود، باقیمانده بر ۱۱ محاسبه
 * می‌گردد و رقم کنترل با مقدار به‌دست‌آمده مقایسه می‌شود. کدهای ملی با ارقام
 * یکسان (مانند ۱۱۱۱۱۱۱۱۱۱) نیز نامعتبر شناخته می‌شوند.
 */
export function validateNationalId(input: string): ValidationResult {
  const value = toLatinDigits(String(input ?? '').trim());
  if (!value) return { valid: false, reason: 'کد ملی را وارد کنید.' };
  if (value.length !== 10) return { valid: false, reason: 'کد ملی باید ۱۰ رقم باشد.' };
  if (!ALL_DIGITS.test(value)) return { valid: false, reason: 'کد ملی باید فقط شامل ارقام باشد.' };
  if (/^(\d)\1{9}$/.test(value)) return { valid: false, reason: 'کد ملی وارد‌شده معتبر نیست.' };

  const check = Number(value[9]);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(value[i]) * (10 - i);
  }
  const remainder = sum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  if (expected !== check) {
    return { valid: false, reason: 'کد ملی وارد‌شده از نظر چک‌سام معتبر نیست.' };
  }
  return { valid: true };
}

/** بررسی شماره بیمه تأمین اجتماعی (۸ تا ۱۰ رقم). */
export function validateInsuranceNumber(input: string): ValidationResult {
  const value = toLatinDigits(String(input ?? '').trim());
  if (!value) return { valid: false, reason: 'شماره بیمه را وارد کنید.' };
  if (!ALL_DIGITS.test(value)) return { valid: false, reason: 'شماره بیمه باید فقط شامل ارقام باشد.' };
  if (value.length < 8 || value.length > 10) {
    return { valid: false, reason: 'شماره بیمه تأمین اجتماعی باید بین ۸ تا ۱۰ رقم باشد.' };
  }
  return { valid: true };
}

/** بررسی شماره شناسنامه (۱ تا ۱۰ رقم). */
export function validateIdCardNumber(input: string): ValidationResult {
  const value = toLatinDigits(String(input ?? '').trim());
  if (!value) return { valid: false, reason: 'شماره شناسنامه را وارد کنید.' };
  if (!ALL_DIGITS.test(value)) return { valid: false, reason: 'شماره شناسنامه باید فقط شامل ارقام باشد.' };
  if (value.length > 10) return { valid: false, reason: 'شماره شناسنامه نمی‌تواند بیش از ۱۰ رقم باشد.' };
  return { valid: true };
}

/** شماره پرسنلی: ارقام، حروف و خط تیره. */
export function validatePersonnelCode(input: string): ValidationResult {
  const value = toLatinDigits(String(input ?? '').trim());
  if (!value) return { valid: false, reason: 'شماره پرسنلی را وارد کنید.' };
  if (!/^[A-Za-z0-9-]{2,20}$/.test(value)) {
    return { valid: false, reason: 'شماره پرسنلی باید ۲ تا ۲۰ کاراکتر و شامل حروف، ارقام یا خط تیره باشد.' };
  }
  return { valid: true };
}
