import type { LegalProfile } from '@dastmozd/legal';
import { amountOf, roundRial, safeDivide } from '../utils/money';
import type { PayrollRates, PayrollRunOptions } from './types';

/**
 * Derives the monetary rates used by every payroll formula.
 *
 * قانون کار، ماده ۳۴ و ۴۷: مزد روزانه از تقسیم مزد ماهانه بر ۳۰ و مزد ساعتی از
 * تقسیم مزد روزانه بر ساعت کار موظفی روزانه (۴۴ ÷ ۶ ≈ ۷٫۳۳) به دست می‌آید.
 * برای پرهیز از خطای تجمعی، در همه فرمول‌ها از مخرج ثابت ۲۲۰ (= ۳۰ × ۷٫۳۳)
 * استفاده می‌شود تا مزد ساعتی درست محاسبه شود.
 */
export interface DerivedRates {
  /** مزد ماهانه پایه (پایه حقوق + پایه سنوات در صورت شمول). */
  monthlyWage: number;
  /** مزد روزانه. */
  dailyWage: number;
  /** مزد ساعتی. */
  hourlyWage: number;
  /** ضریب اضافه‌کاری. */
  overtimeCoefficient: number;
  /** ضریب کار در تعطیل. */
  holidayCoefficient: number;
  /** ضریب شب‌کاری (نرخ فوق‌العاده). */
  nightAllowanceRate: number;
}

export interface DerivedRatesInput {
  baseMonthly: number;
  seniorityMonthly: number;
  options?: PayrollRunOptions;
  profile: LegalProfile;
}

/** Computes the raw rates before attendance proration. */
export function deriveRates({ baseMonthly, seniorityMonthly, options, profile }: DerivedRatesInput): DerivedRates {
  const monthlyWage = roundRial(baseMonthly + seniorityMonthly);
  const dailyWage = roundRial(safeDivide(monthlyWage, profile.monthlyDayDivisor));
  const hourlyWage = roundRial(safeDivide(monthlyWage, profile.monthlyHourDivisor));
  return {
    monthlyWage,
    dailyWage,
    hourlyWage,
    overtimeCoefficient: options?.overtimeCoefficient ?? profile.overtimeCoefficient,
    holidayCoefficient: options?.holidayCoefficient ?? profile.holidayCoefficient,
    nightAllowanceRate: options?.nightAllowanceRate ?? profile.nightWorkAllowanceRate,
  };
}

/** Builds the hour-based rates shown on the payslip and used by the engine. */
export function buildPayrollRates(rates: DerivedRates, payableDailyWage: number): PayrollRates {
  const nightHourly = amountOf(rates.hourlyWage, 1 + rates.nightAllowanceRate);
  const holidayHourly = amountOf(rates.hourlyWage, rates.holidayCoefficient);
  return {
    dailyWage: rates.dailyWage,
    hourlyWage: rates.hourlyWage,
    overtimeHourly: amountOf(rates.hourlyWage, rates.overtimeCoefficient),
    nightHourly,
    holidayHourly,
    holidayOvertimeHourly: amountOf(
      rates.hourlyWage,
      rates.holidayCoefficient + (rates.overtimeCoefficient - 1),
    ),
    payableDailyWage,
  };
}

/**
 * Hourly wage according to article 47 of the Labour Law:
 * `مزد روزانه ÷ ۷٫۳۳` which is identical to `مزد ماهانه ÷ ۲۲۰`.
 */
export function hourlyWageOf(monthlyWage: number, profile: LegalProfile): number {
  return roundRial(safeDivide(monthlyWage, profile.monthlyHourDivisor));
}

/** Daily wage of a monthly amount (مبنای ۳۰ روز). */
export function dailyWageOf(monthlyWage: number, profile: LegalProfile): number {
  return roundRial(safeDivide(monthlyWage, profile.monthlyDayDivisor));
}

/** Overtime wage of a single hour (۱٫۴ برابر مزد ساعتی). */
export function overtimeHourlyWage(monthlyWage: number, profile: LegalProfile, coefficient?: number): number {
  const hourly = hourlyWageOf(monthlyWage, profile);
  return amountOf(hourly, coefficient ?? profile.overtimeCoefficient);
}

/** Night-work wage of a single hour (مزد + ۳۵٪). */
export function nightHourlyWage(monthlyWage: number, profile: LegalProfile, rate?: number): number {
  const hourly = hourlyWageOf(monthlyWage, profile);
  return amountOf(hourly, 1 + (rate ?? profile.nightWorkAllowanceRate));
}
