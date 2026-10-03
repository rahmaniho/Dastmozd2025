import { describe, expect, it } from 'vitest';
import { PROFILE_1404, PROFILE_1405 } from '@dastmozd/legal';
import {
  buildPayrollRates,
  dailyWageOf,
  deriveRates,
  hourlyWageOf,
  nightHourlyWage,
  overtimeHourlyWage,
} from '../engine/rates';
import { calculatePayroll } from '../engine/payroll';
import { employee, input } from './fixtures';
import { emptyAttendance } from '../engine/types';

describe('مشتق‌های مزد', () => {
  it('مزد روزانه و ساعتی بر پایه مخرج‌های قانونی محاسبه می‌شود', () => {
    expect(dailyWageOf(166_255_500, PROFILE_1405)).toBe(5_541_850);
    expect(hourlyWageOf(166_255_500, PROFILE_1405)).toBe(755_707);
    expect(dailyWageOf(103_909_680, PROFILE_1404)).toBe(3_463_656);
  });

  it('مزد اضافه‌کار، شب‌کار و تعطیل‌کار محاسبه می‌شود', () => {
    expect(overtimeHourlyWage(166_255_500, PROFILE_1405)).toBe(1_057_990);
    expect(overtimeHourlyWage(166_255_500, PROFILE_1405, 1.5)).toBe(1_133_561);
    expect(nightHourlyWage(166_255_500, PROFILE_1405)).toBe(1_020_204);
    expect(nightHourlyWage(166_255_500, PROFILE_1405, 0.5)).toBe(1_133_561);
  });

  it('ضرایب قابل بازنویسی است و نرخ‌های فیش ساخته می‌شود', () => {
    const derived = deriveRates({
      baseMonthly: 400_000_000,
      seniorityMonthly: 0,
      profile: PROFILE_1405,
      options: { overtimeCoefficient: 1.5, holidayCoefficient: 1.6, nightAllowanceRate: 0.4 },
    });
    expect(derived.overtimeCoefficient).toBe(1.5);
    expect(derived.holidayCoefficient).toBe(1.6);
    expect(derived.nightAllowanceRate).toBe(0.4);
    expect(derived.hourlyWage).toBe(1_818_182);
    const payrollRates = buildPayrollRates(derived, 400_000_000 / 30);
    expect(payrollRates.overtimeHourly).toBe(2_727_273);
    // ضریب تعطیل‌کاری (۱٫۶) به‌همراه مابه‌التفاوت اضافه‌کاری (۰٫۵) = ۲٫۱
    expect(payrollRates.holidayOvertimeHourly).toBe(3_818_182);
    expect(payrollRates.nightHourly).toBe(2_545_455);
  });

  it('در حالت پایه + پایه سنوات، مبنای نرخ‌ها بزرگ‌تر می‌شود', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ wage: { baseMonthly: 200_000_000, seniorityMonthly: 5_000_000 } }),
        options: { rateBaseMode: 'base+seniority' },
      }),
    );
    expect(result.rates.dailyWage).toBe(Math.round(205_000_000 / 30));
    expect(result.earnings.find((line) => line.key === 'seniority')?.amount).toBe(5_000_000);
    expect(result.earnings[0]?.amount).toBe(200_000_000);
  });
});

describe('گزینه‌های محاسبه', () => {
  it('تنظیمات کارگاه روی گزینه‌های محاسبه اثر می‌گذارد', () => {
    const result = calculatePayroll(
      input({
        attendance: { ...emptyAttendance(30), unpaidLeaveDays: 6, lateMinutes: 60 },
        company: {
          prorateBenefits: true,
          insuranceBeforeTax: true,
          latePenaltyEnabled: true,
          latePenaltyPerMinute: 2_000,
          roundPayout: true,
          roundingStep: 1_000,
        },
      }),
    );
    expect(result.earnings.find((line) => line.key === 'housing')?.amount).toBe(24_000_000);
    expect(result.deductions.find((line) => line.key === 'penalty')?.amount).toBe(120_000);
    expect(result.totals.payableAmount % 1_000).toBe(0);
  });

  it('حالت شب‌کاری «فقط مابه‌التفاوت» پشتیبانی می‌شود', () => {
    const result = calculatePayroll(
      input({
        attendance: { ...emptyAttendance(30), nightHours: 10 },
        options: { nightWorkMode: 'premium' },
      }),
    );
    const night = result.earnings.find((line) => line.key === 'night-work');
    expect(night?.coefficient).toBe(0.35);
    expect(night?.amount).toBe(2_644_975);
  });

  it('مزایای متغیر سفارشی و ثابت‌های کارگاه در فیش می‌آید', () => {
    const result = calculatePayroll(
      input({
        employee: employee({
          wage: {
            baseMonthly: 166_255_500,
            seniorityMonthly: 5_000_000,
            extraFixed: [{ key: 'hardship', title: 'حق سختی کار', amount: 15_000_000 }],
          },
        }),
        earnings: [{ key: 'transport', amount: 6_000_000 }],
      }),
    );
    expect(result.earnings.some((line) => line.title === 'حق سختی کار')).toBe(true);
    expect(result.earnings.some((line) => line.key === 'transport')).toBe(true);
  });

  it('دستمزد ساعتی برای اقلام متغیر قابل محاسبه است', () => {
    const result = calculatePayroll(
      input({
        earnings: [{ key: 'bonus', quantity: 4, unitRate: 1_000_000 }],
      }),
    );
    expect(result.earnings.find((line) => line.key === 'bonus')?.amount).toBe(4_000_000);
  });

  it('عدم امکان کسر غیبت بیشتر از روزهای ماه گزارش خطا می‌دهد', () => {
    const result = calculatePayroll(
      input({ attendance: { ...emptyAttendance(30), unpaidLeaveDays: 25, absenceDays: 10 } }),
    );
    expect(result.warnings.some((warning) => warning.code === 'INVALID_WORKING_DAYS')).toBe(true);
  });

  it('بدون شماره بیمه برای کارمند فعال هشدار صادر می‌شود', () => {
    const result = calculatePayroll(input({ employee: employee({ insuranceNumber: undefined }) }));
    expect(result.warnings.some((warning) => warning.code === 'MISSING_INSURANCE_NUMBER')).toBe(
      true,
    );
  });

  it('خالص پرداختی منفی هشدار خطا می‌دهد', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
        deductions: [{ key: 'loan', amount: 250_000_000 }],
      }),
    );
    expect(result.totals.netPay).toBeLessThan(0);
    expect(result.warnings.some((warning) => warning.code === 'NEGATIVE_NET_PAY')).toBe(true);
  });
});
