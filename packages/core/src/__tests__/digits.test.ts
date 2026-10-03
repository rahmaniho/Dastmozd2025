import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatPersianNumber,
  formatRial,
  formatToman,
  numberToPersianWords,
  rialInWords,
  toLatinDigits,
  toPersianDigits,
} from '../utils/digits';
import { amountOf, clamp, roundRial, roundToStep, safeDivide, sum } from '../utils/money';
import { fnv1a, makeRunCode, makeVerificationCode } from '../utils/code';

describe('ابزارهای عددی و فارسی‌سازی', () => {
  it('ارقام لاتین به فارسی و برعکس تبدیل می‌شوند', () => {
    expect(toPersianDigits('1405/07')).toBe('۱۴۰۵/۰۷');
    expect(toPersianDigits(166255500)).toBe('۱۶۶۲۵۵۵۰۰');
    expect(toLatinDigits('۱۴۰۵')).toBe('1405');
    expect(toLatinDigits('٤٥٦')).toBe('456');
  });

  it('قالب‌بندی عدد و مبلغ درست است', () => {
    expect(formatNumber(1_662_555)).toBe('1,662,555');
    expect(formatPersianNumber(1_662_555)).toBe('۱,۶۶۲,۵۵۵');
    expect(formatRial(1_662_555)).toContain('ریال');
    expect(formatToman(166_255_500)).toBe('۱۶,۶۲۵,۵۵۰ تومان');
  });

  it('تبدیل عدد به حروف فارسی دقیق است', () => {
    expect(numberToPersianWords(0)).toBe('صفر');
    expect(numberToPersianWords(7)).toBe('هفت');
    expect(numberToPersianWords(19)).toBe('نوزده');
    expect(numberToPersianWords(100)).toBe('صد');
    expect(numberToPersianWords(1234)).toBe('یک هزار و دویست و سی و چهار');
    expect(numberToPersianWords(1_662_555)).toBe(
      'یک میلیون و ششصد و شصت و دو هزار و پانصد و پنجاه و پنج',
    );
    expect(numberToPersianWords(1_000_000_000)).toBe('یک میلیارد');
    expect(rialInWords(202_977_615)).toContain('ریال');
    expect(rialInWords(-5)).toContain('منفی');
  });
});

describe('ابزارهای پولی', () => {
  it('گرد کردن ریالی، گام و ضرب همراه با گرد کردن', () => {
    expect(roundRial(10.4)).toBe(10);
    expect(roundRial(10.5)).toBe(11);
    expect(roundToStep(1_234_567, 1_000)).toBe(1_235_000);
    expect(roundToStep(1_234_567, 1)).toBe(1_234_567);
    expect(amountOf(755_707, 6, 1.35)).toBe(6_121_227);
    expect(sum([1, 2, 3.4])).toBeCloseTo(6.4, 6);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 4)).toBe(2.5);
  });
});

describe('کدهای تأیید و اثر انگشت', () => {
  it('کد بازبینی فیش، پایدار و وابسته به محتوا است', () => {
    const parts = ['emp-1', '1234567891', 1405, 7, 218_255_500, 15_277_885, 202_977_615] as const;
    const first = makeVerificationCode([...parts]);
    expect(first).toMatch(/^DM-1405-07-[0-9A-F]{8}$/);
    expect(makeVerificationCode([...parts])).toBe(first);
    expect(
      makeVerificationCode(['emp-1', '1234567891', 1405, 7, 218_255_501, 15_277_885, 202_977_615]),
    ).not.toBe(first);
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
    expect(makeRunCode(1405, 7, 1, 'payload')).toMatch(/^RUN-1405-07-[0-9A-F]{8}$/);
  });
});
