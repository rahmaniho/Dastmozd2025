import { toLatinDigits } from '../utils/digits';
import type { ValidationResult } from './nationalId';

/** Removes spaces and Persian digits and upper-cases the result. */
export function normalizeIban(input: string): string {
  return toLatinDigits(String(input ?? '').replace(/[\s-]/g, '')).toUpperCase();
}

/**
 * اعتبارسنجی شماره شبا (IBAN) ایران — الگوی `IR` به‌همراه ۲۴ رقم.
 * صحت شبا با الگوریتم MOD-97 استاندارد ISO 7064 بررسی می‌شود.
 */
export function validateIranIban(input: string): ValidationResult {
  const value = normalizeIban(input);
  if (!value) return { valid: false, reason: 'شماره شبا را وارد کنید.' };
  if (!/^IR\d{24}$/.test(value)) {
    return { valid: false, reason: 'شماره شبا باید با IR شروع شده و ۲۴ رقم داشته باشد.' };
  }
  const rearranged = `${value.slice(4)}${value.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const numeric = code >= 65 && code <= 90 ? String(code - 55) : char;
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  if (remainder !== 1) {
    return { valid: false, reason: 'شماره شبا از نظر رقم کنترل معتبر نیست.' };
  }
  return { valid: true };
}

/** Converts a numeric account number into a full IBAN with the Iranian bank code. */
export function toIranIban(bankCode: string, accountNumber: string): string {
  const bank = toLatinDigits(bankCode).padStart(3, '0');
  // Iranian IBAN = IR + 2 control digits + 3 bank digits + 19 account digits.
  const account = toLatinDigits(accountNumber).padStart(19, '0').slice(-19);
  const checkSource = `${bank}${account}182700`;
  let remainder = 0;
  for (const digit of checkSource) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  const check = String(98 - remainder).padStart(2, '0');
  return `IR${check}${bank}${account}`;
}

/** Iranian bank codes used by the IBAN builder above (کدهای بانک مرکزی). */
export const IRAN_BANK_CODES: Record<string, string> = {
  '010': 'بانک مرکزی جمهوری اسلامی ایران',
  '011': 'بانک صنعت و معدن',
  '012': 'بانک ملت',
  '013': 'بانک رفاه کارگران',
  '014': 'بانک مسکن',
  '015': 'بانک سپه',
  '016': 'بانک کشاورزی',
  '017': 'بانک ملی ایران',
  '018': 'بانک تجارت',
  '019': 'بانک صادرات ایران',
  '020': 'بانک توسعه صادرات ایران',
  '021': 'پست بانک ایران',
  '022': 'بانک توسعه تعاون',
  '051': 'مؤسسه اعتباری توسعه',
  '053': 'بانک پارسیان',
  '054': 'بانک پارسیان',
  '055': 'بانک اقتصاد نوین',
  '056': 'بانک سامان',
  '057': 'بانک پاسارگاد',
  '058': 'بانک سرمایه',
  '059': 'بانک سینا',
  '060': 'بانک قرض‌الحسنه مهر ایران',
  '061': 'بانک شهر',
  '062': 'بانک آینده',
  '063': 'بانک قوامین',
  '064': 'بانک گردشگری',
  '065': 'بانک دی',
  '066': 'بانک ایران زمین',
  '069': 'بانک میهن (کارآفرین سابق)',
  '070': 'بانک رسالت',
  '078': 'بانک خاورمیانه',
  '079': 'بانک ایران زمین',
  '080': 'بانک مهر ایران',
  '081': 'بانک ملل (آینده سابق)',
  '082': 'بانک نور (قوامین سابق)',
  '083': 'بانک سینا (شعبه‌های سابق)',
  '084': 'بانک کشاورزی (شعبه‌های سابق)',
  '085': 'بانک توسعه صادرات (شعبه‌های سابق)',
  '086': 'بانک پاسارگاد (شعبه‌های سابق)',
  '087': 'بانک شهر (شعبه‌های سابق)',
  '088': 'بانک رفاه (شعبه‌های سابق)',
  '089': 'بانک سامان (شعبه‌های سابق)',
  '090': 'بانک ملی (شعبه‌های سابق)',
};
