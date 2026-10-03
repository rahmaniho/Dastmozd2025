import { describe, expect, it } from 'vitest';
import {
  addJalaliDays,
  addJalaliMonths,
  compareJalali,
  gregorianIsoToJalali,
  isJalaliLeapYear,
  isoToJalali,
  jalaliDiffInDays,
  jalaliDiffInMonths,
  jalaliFullYears,
  jalaliMonthLength,
  jalaliToDate,
  jalaliToGregorianIso,
  jalaliToIso,
  jalaliWeekday,
  toGregorian,
  toJalali,
} from '../utils/jalali';

describe('تبدیل تاریخ شمسی و میلادی', () => {
  it('نوروز ۱۴۰۵ برابر ۲۱ مارس ۲۰۲۶ است', () => {
    expect(toGregorian(1405, 1, 1)).toEqual({ gy: 2026, gm: 3, gd: 21 });
    const jalali = gregorianIsoToJalali('2026-03-21');
    expect(jalali).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it('نوروز ۱۴۰۴ برابر ۲۱ مارس ۲۰۲۵ است', () => {
    expect(toJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(jalaliToGregorianIso({ jy: 1404, jm: 1, jd: 1 })).toBe('2025-03-21');
  });

  it('آخرین روز اسفند ۱۴۰۳ (سال کبیسه) برابر ۲۰ مارس ۲۰۲۵ است', () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliToGregorianIso({ jy: 1403, jm: 12, jd: 30 })).toBe('2025-03-20');
  });

  it('اسفند ۱۴۰۴ و ۱۴۰۵ سی روزه نیست', () => {
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(isJalaliLeapYear(1405)).toBe(false);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1405, 12)).toBe(29);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(jalaliMonthLength(1405, 6)).toBe(31);
  });

  it('سریال و بازگشت سریال تاریخ‌ها درست کار می‌کند', () => {
    for (const iso of ['1405-01-01', '1405-07-15', '1404-12-29', '1403-06-31']) {
      const jalali = isoToJalali(iso);
      const roundTrip = gregorianIsoToJalali(jalaliToGregorianIso(jalali));
      expect(roundTrip).toEqual(jalali);
      expect(jalaliToIso(jalali)).toBe(iso);
      expect(jalaliToDate(jalali).getFullYear()).toBeGreaterThan(2000);
    }
  });

  it('جمع و تفریق روز و ماه شمسی درست است', () => {
    expect(addJalaliDays({ jy: 1405, jm: 1, jd: 1 }, 31)).toEqual({ jy: 1405, jm: 2, jd: 1 });
    expect(addJalaliDays({ jy: 1405, jm: 1, jd: 1 }, -1)).toEqual({ jy: 1404, jm: 12, jd: 29 });
    expect(addJalaliMonths({ jy: 1405, jm: 1, jd: 31 }, 1)).toEqual({ jy: 1405, jm: 2, jd: 31 });
    expect(addJalaliMonths({ jy: 1405, jm: 6, jd: 31 }, 6)).toEqual({ jy: 1405, jm: 12, jd: 29 });
    expect(addJalaliMonths({ jy: 1405, jm: 12, jd: 1 }, 1)).toEqual({ jy: 1406, jm: 1, jd: 1 });
  });

  it('اختلاف روز، ماه و سال شمسی درست محاسبه می‌شود', () => {
    expect(jalaliDiffInDays({ jy: 1405, jm: 1, jd: 1 }, { jy: 1404, jm: 1, jd: 1 })).toBe(365);
    expect(jalaliDiffInMonths({ jy: 1405, jm: 1, jd: 1 }, { jy: 1404, jm: 1, jd: 1 })).toBe(12);
    expect(jalaliDiffInMonths({ jy: 1405, jm: 1, jd: 1 }, { jy: 1404, jm: 2, jd: 1 })).toBe(11);
    expect(jalaliDiffInMonths({ jy: 1405, jm: 1, jd: 1 }, { jy: 1404, jm: 1, jd: 2 })).toBe(11);
    expect(jalaliFullYears({ jy: 1405, jm: 6, jd: 1 }, { jy: 1398, jm: 6, jd: 1 })).toBe(7);
    expect(jalaliFullYears({ jy: 1405, jm: 5, jd: 31 }, { jy: 1398, jm: 6, jd: 1 })).toBe(6);
    expect(compareJalali({ jy: 1405, jm: 1, jd: 1 }, { jy: 1405, jm: 1, jd: 2 })).toBe(-1);
    expect(compareJalali({ jy: 1405, jm: 2, jd: 1 }, { jy: 1405, jm: 1, jd: 1 })).toBe(1);
    expect(compareJalali({ jy: 1405, jm: 1, jd: 1 }, { jy: 1405, jm: 1, jd: 1 })).toBe(0);
  });

  it('روز هفته شمسی با شروع از شنبه محاسبه می‌شود', () => {
    // ۱ فروردین ۱۴۰۴ برابر جمعه ۲۱ مارس ۲۰۲۵ بود.
    expect(jalaliWeekday({ jy: 1404, jm: 1, jd: 1 })).toBe(6);
    expect(jalaliWeekday({ jy: 1404, jm: 1, jd: 2 })).toBe(0);
    // نوروز ۱۴۰۵ برابر شنبه ۲۱ مارس ۲۰۲۶ است.
    expect(jalaliWeekday({ jy: 1405, jm: 1, jd: 1 })).toBe(0);
  });
});
