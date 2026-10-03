import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPONENTS } from '../components';
import { PROFILE_1403 } from '../profiles/1403';
import { PROFILE_1404 } from '../profiles/1404';
import { PROFILE_1405 } from '../profiles/1405';
import {
  DEFAULT_PROFILE_YEAR,
  LEGAL_PROFILES,
  SUPPORTED_YEARS,
  getLegalProfile,
  legalProfileHash,
  resolveLegalProfile,
} from '../registry';
import type { LegalProfile } from '../types';
import type { EarningComponentKey } from '@dastmozd/types';

const ALL_PROFILES: LegalProfile[] = [PROFILE_1403, PROFILE_1404, PROFILE_1405];

describe('پروفایل‌های حقوقی سالانه', () => {
  it('هر سه سال ۱۴۰۳ تا ۱۴۰۵ در سامانه ثبت شده است', () => {
    expect(SUPPORTED_YEARS).toEqual([1403, 1404, 1405]);
    expect(DEFAULT_PROFILE_YEAR).toBe(1405);
  });

  it.each(ALL_PROFILES)('پروفایل $year از نظر داخلی سازگار است', (profile) => {
    expect(profile.minMonthlyWage).toBe(profile.minDailyWage * profile.monthlyDayDivisor);
    expect(profile.childAllowanceDaily).toBe(
      profile.minDailyWage * profile.childAllowanceDayMultiplier,
    );
    expect(profile.childAllowanceDayMultiplier).toBe(3);
    expect(profile.maxChildren).toBe(4);
    expect(profile.seniorityMonthly).toBeCloseTo(profile.seniorityDaily * 30, -4);
    expect(profile.insurance.ceiling).toBe(
      profile.minMonthlyWage * profile.insurance.ceilingMultiplier,
    );
    expect(profile.insurance.employeeRate + profile.insurance.employerRate).toBeCloseTo(0.3, 6);
    expect(profile.insurance.unemploymentRate).toBe(0.03);
    expect(profile.tax.annualExemption).toBe(profile.tax.monthlyExemption * 12);
    expect(profile.overtimeCoefficient).toBe(1.4);
    expect(profile.nightWorkAllowanceRate).toBe(0.35);
    expect(profile.holidayCoefficient).toBe(1.4);
    expect(profile.weeklyHours).toBe(44);
    expect(profile.dailyHours).toBeCloseTo(7.3333, 3);
    expect(profile.monthlyHourDivisor).toBe(220);
    expect(profile.eidi.minMultiplier).toBe(2);
    expect(profile.eidi.maxMultiplier).toBe(3);
    expect(profile.severance.daysPerYear).toBe(30);
    expect(profile.leave.annualPaidLeaveDays).toBe(26);
    expect(profile.components['base-wage']?.taxable).toBe(true);
    expect(profile.components['child-allowance']?.insured).toBe(false);
    expect(profile.components.severance?.taxable).toBe(false);
    expect(profile.leave.encashable).toBe(true);
    expect(profile.tax.eidiExemptionCap).toBe(profile.tax.monthlyExemption);
    expect(profile.leave.sickLeaveFirstDaysUnpaid).toBe(3);
    expect(profile.shiftWorkRules).toHaveLength(4);
    expect(profile.nightWindow.from).toBe('22:00');
  });

  it.each(ALL_PROFILES)('جدول مالیات پروفایل $year صعودی و پیوسته است', (profile) => {
    let previous = 0;
    for (const bracket of profile.tax.brackets) {
      if (bracket.upTo !== null) {
        expect(bracket.upTo).toBeGreaterThan(previous);
        previous = bracket.upTo;
      }
    }
    const first = profile.tax.brackets[0];
    expect(first?.rate).toBe(0);
    expect(first?.upTo).toBe(profile.tax.monthlyExemption);
    const last = profile.tax.brackets.at(-1);
    expect(last?.upTo).toBeNull();
    expect(last?.rate).toBe(0.3);
  });

  it('ارقام کلیدی سال ۱۴۰۵ با مصوبه شورای عالی کار مطابقت دارد', () => {
    expect(PROFILE_1405.minDailyWage).toBe(5_541_850);
    expect(PROFILE_1405.minMonthlyWage).toBe(166_255_500);
    expect(PROFILE_1405.housingAllowanceMonthly).toBe(30_000_000);
    expect(PROFILE_1405.groceryAllowanceMonthly).toBe(22_000_000);
    expect(PROFILE_1405.marriageAllowanceMonthly).toBe(5_000_000);
    expect(PROFILE_1405.childAllowanceDaily).toBe(16_625_550);
    expect(PROFILE_1405.seniorityMonthly).toBe(5_000_000);
    expect(PROFILE_1405.tax.monthlyExemption).toBe(400_000_000);
    expect(PROFILE_1405.insurance.ceiling).toBe(1_163_788_500);
    expect(PROFILE_1405.verified).toBe(true);
    expect(PROFILE_1405.tax.flatSegments).toHaveLength(0);
  });

  it('ارقام کلیدی سال ۱۴۰۴ با مصوبه شورای عالی کار مطابقت دارد', () => {
    expect(PROFILE_1404.minDailyWage).toBe(3_463_656);
    expect(PROFILE_1404.minMonthlyWage).toBe(103_909_680);
    expect(PROFILE_1404.housingAllowanceMonthly).toBe(9_000_000);
    expect(PROFILE_1404.childAllowanceDaily).toBe(10_390_968);
    expect(PROFILE_1404.seniorityDaily).toBe(94_000);
    expect(PROFILE_1404.tax.monthlyExemption).toBe(240_000_000);
    expect(PROFILE_1404.tax.flatSegments[0]?.rate).toBe(0.1);
  });

  it('ارقام کلیدی سال ۱۴۰۳ برای آرشیو نگهداری می‌شود', () => {
    expect(PROFILE_1403.minDailyWage).toBe(2_388_728);
    expect(PROFILE_1403.minMonthlyWage).toBe(71_661_840);
    expect(PROFILE_1403.groceryAllowanceMonthly).toBe(14_000_000);
    expect(PROFILE_1403.childAllowanceDaily).toBe(7_166_184);
    expect(PROFILE_1403.tax.monthlyExemption).toBe(120_000_000);
    expect(PROFILE_1403.verified).toBe(false);
  });

  it('همه اجزای درآمدی در هر پروفایل دارای قاعده مالیات و بیمه هستند', () => {
    const keys = Object.keys(DEFAULT_COMPONENTS) as EarningComponentKey[];
    expect(keys.length).toBeGreaterThan(18);
    for (const profile of ALL_PROFILES) {
      for (const key of keys) {
        const rule = profile.components[key];
        expect(rule, `قاعده ${key} در پروفایل ${profile.year}`).toBeDefined();
        expect(rule?.title.length).toBeGreaterThan(1);
      }
    }
  });

  it('منابع حقوقی برای هر پروفایل ثبت شده است', () => {
    for (const profile of ALL_PROFILES) {
      expect(profile.sources.length).toBeGreaterThanOrEqual(2);
      for (const source of profile.sources) {
        expect(source.title.length).toBeGreaterThan(5);
        expect(source.issuer.length).toBeGreaterThan(2);
      }
    }
  });
});

describe('رجیستری پروفایل‌ها', () => {
  it('پروفایل سال درخواستی را برمی‌گرداند', () => {
    expect(getLegalProfile(1405)).toBe(PROFILE_1405);
    expect(getLegalProfile(1404)).toBe(PROFILE_1404);
    expect(LEGAL_PROFILES[1403]).toBe(PROFILE_1403);
  });

  it('برای سال ناموجود به جدیدترین پروفایل بازمی‌گردد و هشدار می‌دهد', () => {
    const resolved = resolveLegalProfile(1410);
    expect(resolved.fallback).toBe(true);
    expect(resolved.profile.year).toBe(DEFAULT_PROFILE_YEAR);
    expect(resolved.warning).toContain('1410');
    expect(getLegalProfile(1499).year).toBe(1405);
  });

  it('برای سال موجود هشداری صادر نمی‌شود', () => {
    const resolved = resolveLegalProfile(1404);
    expect(resolved.fallback).toBe(false);
    expect(resolved.warning).toBeUndefined();
  });

  it('اثر انگشت پروفایل پایدار و یکتا است', () => {
    const first = legalProfileHash(PROFILE_1405);
    const second = legalProfileHash(PROFILE_1405);
    expect(first).toBe(second);
    expect(first).toMatch(/^p1405-[0-9a-f]{8}$/);
    expect(legalProfileHash(PROFILE_1404)).not.toBe(first);
  });
});
