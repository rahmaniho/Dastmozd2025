import { describe, expect, it } from 'vitest';
import { PROFILE_1404, PROFILE_1405 } from '@dastmozd/legal';
import { calculateAccruals, calculateEidi, calculateSeverance, calculateUnusedLeave } from '../engine/bonuses';

describe('عیدی و پاداش پایان سال (ماده ۷۵ قانون کار)', () => {
  it('حداقل و حداکثر عیدی برای یک سال کارکرد کامل ۱۴۰۵', () => {
    const result = calculateEidi({ profile: PROFILE_1405, monthsWorked: 12 });
    expect(result.min).toBe(332_511_000);
    expect(result.max).toBe(498_766_500);
    expect(result.recommended).toBe(332_511_000);
    expect(result.taxExempt).toBe(332_511_000);
    expect(result.taxable).toBe(0);
    expect(result.trace).toHaveLength(4);
  });

  it('عیدی برای کارکرد کمتر از یک سال به‌نسبت محاسبه می‌شود', () => {
    const result = calculateEidi({ profile: PROFILE_1405, monthsWorked: 6 });
    expect(result.min).toBe(166_255_500);
    expect(result.recommended).toBe(166_255_500);
    expect(result.taxable).toBe(0);
  });

  it('عیدی در سال ۱۴۰۴ با ضرایب همان سال محاسبه می‌شود', () => {
    const result = calculateEidi({ profile: PROFILE_1404, monthsWorked: 12 });
    expect(result.min).toBe(207_819_360);
    expect(result.max).toBe(311_729_040);
    // عیدی معادل دو برابر حداقل مزد و بخش مازاد بر یک‌دوازدهم معافیت، مشمول مالیات است.
    const high = calculateEidi({ profile: PROFILE_1404, monthsWorked: 12 });
    expect(high.taxExempt).toBe(Math.min(high.recommended, 240_000_000));
  });

  it('کارکرد روزانه نیز پشتیبانی می‌شود', () => {
    const result = calculateEidi({ profile: PROFILE_1405, monthsWorked: 0, daysWorked: 182 });
    expect(result.recommended).toBeGreaterThan(150_000_000);
    expect(result.recommended).toBeLessThanOrEqual(result.max);
  });
});

describe('سنوات خدمت (ماده ۲۴ قانون کار)', () => {
  it('برای سه سال سابقه، سه ماه مزد پرداخت می‌شود', () => {
    const result = calculateSeverance({ profile: PROFILE_1405, monthlyWage: 166_255_500, years: 3 });
    expect(result.owedDays).toBe(90);
    expect(result.amount).toBe(498_766_500);
  });

  it('کسری از سال نیز به‌نسبت روز محاسبه می‌شود', () => {
    const result = calculateSeverance({
      profile: PROFILE_1405,
      monthlyWage: 166_255_500,
      years: 2,
      extraDays: 182,
      reason: 'resignation',
    });
    expect(result.owedDays).toBeCloseTo(74.96, 1);
    expect(result.amount).toBeGreaterThan(400_000_000);
    expect(result.trace[2]?.detail).toContain('استعفا');
  });
});

describe('مانده مرخصی و بازخرید آن', () => {
  it('مانده مرخصی و ارزش ریالی آن محاسبه می‌شود', () => {
    const result = calculateUnusedLeave({
      profile: PROFILE_1405,
      accruedDays: 26,
      usedDays: 10,
      monthlyWage: 166_255_500,
    });
    expect(result.balanceDays).toBe(16);
    expect(result.amount).toBe(88_669_600);
    expect(result.trace[1]?.detail).toContain('معاف از مالیات');
  });

  it('مرخصی بیشتر از استحقاق، مانده منفی ایجاد نمی‌کند', () => {
    const result = calculateUnusedLeave({
      profile: PROFILE_1405,
      accruedDays: 10,
      usedDays: 14,
      monthlyWage: 166_255_500,
    });
    expect(result.balanceDays).toBe(0);
    expect(result.amount).toBe(0);
  });
});

describe('ذخیره ماهانه عیدی و سنوات (هزینه کارفرما)', () => {
  it('ذخیره ماهانه درست محاسبه می‌شود', () => {
    const result = calculateAccruals({ profile: PROFILE_1405, monthlyWage: 166_255_500, monthsElapsed: 12 });
    expect(result.eidi).toBe(27_709_250);
    expect(result.severance).toBe(13_854_625);
    expect(result.total).toBe(41_563_875);
  });
});
