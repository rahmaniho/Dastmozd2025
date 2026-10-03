import type { LegalProfile } from '@dastmozd/legal';
import type { CalculationTraceEntry } from '@dastmozd/types';
import { roundRial, safeDivide } from '../utils/money';

export interface EidiInput {
  profile: LegalProfile;
  /** Monthly wage of the employee used as the reference (مزد ماهانه). */
  monthlyWage?: number;
  /** Completed months of service in the current year (0..12). */
  monthsWorked: number;
  /** Days worked during the year; when provided it wins over monthsWorked. */
  daysWorked?: number;
}

export interface EidiResult {
  /** Minimum legal bonus for the computed service length. */
  min: number;
  /** Maximum legal bonus (three times the minimum wage). */
  max: number;
  /** Recommended amount: ۲ برابر مزد ماهانه به‌نسبت کارکرد. */
  recommended: number;
  /** Amount that stays exempt from income tax (یک‌دوازدهم معافیت سالانه). */
  taxExempt: number;
  /** Taxable part of the bonus. */
  taxable: number;
  trace: CalculationTraceEntry[];
}

/**
 * عیدی و پاداش پایان سال — ماده ۷۵ قانون کار و آیین‌نامه اجرایی آن.
 * حداقل معادل دو برابر حداقل مزد ماهانه و حداکثر سه برابر آن است. کارگران با
 * کمتر از یک سال سابقه به نسبت ماه‌های کارکرد مشمول عیدی می‌شوند.
 */
export function calculateEidi({ profile, monthsWorked, daysWorked }: EidiInput): EidiResult {
  const minWage = profile.minMonthlyWage;
  const min = roundRial(minWage * profile.eidi.minMultiplier);
  const max = roundRial(minWage * profile.eidi.maxMultiplier);
  const serviceRatio = roundRial(
    daysWorked !== undefined
      ? Math.min(1, safeDivide(daysWorked, 365))
      : Math.min(1, safeDivide(Math.min(Math.max(monthsWorked, 0), 12), 12)) * 10000,
  );
  const ratio =
    daysWorked !== undefined
      ? Math.min(1, safeDivide(daysWorked, 365))
      : Math.min(1, safeDivide(Math.min(Math.max(monthsWorked, 0), 12), 12));

  const baseForRecommended = Math.max(profile.minMonthlyWage, minWage);
  const recommended = roundRial(
    Math.min(max, Math.max(min * ratio, baseForRecommended * profile.eidi.minMultiplier * ratio)),
  );
  const taxExempt = Math.min(recommended, profile.tax.eidiExemptionCap);

  return {
    min: roundRial(min * ratio),
    max: roundRial(max * ratio),
    recommended,
    taxExempt: roundRial(taxExempt),
    taxable: roundRial(recommended - taxExempt),
    trace: [
      {
        step: 1,
        code: 'eidi.min',
        title: 'حداقل عیدی',
        detail: `دو برابر حداقل مزد ماهانه (${profile.minMonthlyWage.toLocaleString('en-US')} ریال) برای یک سال کارکرد.`,
        value: roundRial(min * ratio),
        legalRef: 'ماده ۷۵ قانون کار',
      },
      {
        step: 2,
        code: 'eidi.max',
        title: 'حداکثر عیدی',
        detail: 'سه برابر حداقل مزد ماهانه برای یک سال کارکرد کامل.',
        value: roundRial(max * ratio),
        legalRef: 'آیین‌نامه اجرایی ماده ۷۵ قانون کار',
      },
      {
        step: 3,
        code: 'eidi.exempt',
        title: 'بخش معاف از مالیات',
        detail: 'یک‌دوازدهم سقف معافیت سالانه مالیات، معاف از مالیات است.',
        value: roundRial(taxExempt),
        formula: `${profile.tax.eidiExemptionCap.toLocaleString('en-US')}`,
        legalRef: 'ماده ۹۱ قانون مالیات‌های مستقیم',
      },
      {
        step: 4,
        code: 'eidi.ratio',
        title: 'نسبت کارکرد',
        detail:
          daysWorked !== undefined
            ? `نسبت بر پایه ${daysWorked} روز کارکرد محاسبه شد.`
            : `نسبت بر پایه ${Math.min(monthsWorked, 12)} ماه کارکرد محاسبه شد.`,
        value: ratio,
      },
    ],
  };
  void serviceRatio;
}

export interface SeveranceInput {
  profile: LegalProfile;
  /** Last monthly wage (پایه حقوق ماهانه). */
  monthlyWage: number;
  /** Full years of service. */
  years: number;
  /** Extra days beyond complete years. */
  extraDays?: number;
  /** Optional reason: resignation, termination, retirement, contract end. */
  reason?: 'resignation' | 'termination' | 'retirement' | 'contract-end';
}

export interface SeveranceResult {
  /** Days of wage owed. */
  owedDays: number;
  amount: number;
  trace: CalculationTraceEntry[];
}

/**
 * حق سنوات پایان کار — ماده ۲۴ قانون کار.
 * به‌ازای هر سال سابقه، معادل یک ماه آخرین مزد؛ برای کسری از سال به نسبت روزها.
 */
export function calculateSeverance({
  profile,
  monthlyWage,
  years,
  extraDays = 0,
  reason = 'contract-end',
}: SeveranceInput): SeveranceResult {
  const daysPerYear = profile.severance.daysPerYear;
  const dailyWage = safeDivide(monthlyWage, profile.monthlyDayDivisor);
  const owedDays = years * daysPerYear + safeDivide(extraDays, 365) * daysPerYear;
  const amount = roundRial(dailyWage * owedDays);
  return {
    owedDays: Math.round(owedDays * 100) / 100,
    amount,
    trace: [
      {
        step: 1,
        code: 'severance.days',
        title: 'روزهای سنوات',
        detail: `${years} سال سابقه × ${daysPerYear} روز در سال به‌علاوه کسری ${extraDays} روز.`,
        value: Math.round(owedDays * 100) / 100,
        legalRef: 'ماده ۲۴ قانون کار',
      },
      {
        step: 2,
        code: 'severance.amount',
        title: 'مبلغ سنوات',
        detail: `${owedDays.toFixed(2)} روز × مزد روزانه ${Math.round(dailyWage).toLocaleString('en-US')} ریال.`,
        value: amount,
        legalRef: 'ماده ۲۴ و ۴۷ قانون کار',
      },
      {
        step: 3,
        code: 'severance.reason',
        title: 'علت تسویه',
        detail:
          reason === 'resignation'
            ? 'استعفا — سنوات خدمت به کارگر تعلق می‌گیرد.'
            : reason === 'termination'
              ? 'خاتمه رابطه کارگری — سنوات و مزایای پایان کار به کارگر تعلق می‌گیرد.'
              : reason === 'retirement'
                ? 'بازنشستگی — سنوات و مزایای پایان کار پرداخت می‌شود.'
                : 'پایان قرارداد کار — سنوات به کارگر تعلق می‌گیرد.',
        value: 0,
      },
    ],
  };
}

export interface UnusedLeaveInput {
  profile: LegalProfile;
  /** Days accrued since the hiring date. */
  accruedDays: number;
  /** Days already taken by the employee. */
  usedDays: number;
  /** Monthly wage used to value the days. */
  monthlyWage: number;
}

export interface UnusedLeaveResult {
  balanceDays: number;
  amount: number;
  trace: CalculationTraceEntry[];
}

/**
 * محاسبه مانده مرخصی و ارزش بازخرید آن.
 * ماده ۶۴ قانون کار: ۲۶ روز مرخصی استحقاقی در سال و ماده ۶۶: مرخصی استفاده‌نشده
 * قابل ذخیره و بازخرید است.
 */
export function calculateUnusedLeave({
  profile,
  accruedDays,
  usedDays,
  monthlyWage,
}: UnusedLeaveInput): UnusedLeaveResult {
  const balanceDays = Math.max(0, accruedDays - usedDays);
  const dailyWage = safeDivide(monthlyWage, profile.monthlyDayDivisor);
  const amount = roundRial(balanceDays * dailyWage);
  return {
    balanceDays: Math.round(balanceDays * 100) / 100,
    amount,
    trace: [
      {
        step: 1,
        code: 'leave.balance',
        title: 'مانده مرخصی',
        detail: `${accruedDays} روز استحقاق منهای ${usedDays} روز استفاده‌شده.`,
        value: Math.round(balanceDays * 100) / 100,
        legalRef: 'ماده ۶۴ و ۶۶ قانون کار',
      },
      {
        step: 2,
        code: 'leave.encashment',
        title: 'ارزش بازخرید',
        detail: 'بازخرید مانده مرخصی معاف از مالیات و بیمه است.',
        value: amount,
        legalRef: 'ماده ۹۱ قانون مالیات‌های مستقیم',
      },
    ],
  };
}

/** Accrual of عیدی and سنوات used by the employer-cost report. */
export interface AccrualInput {
  profile: LegalProfile;
  monthlyWage: number;
  /** Months elapsed in the current fiscal year (0..12). */
  monthsElapsed: number;
}

export interface AccrualResult {
  eidi: number;
  severance: number;
  total: number;
}

/** Monthly accrual of the two year-end obligations (هزینه ماهانه کارفرما). */
export function calculateAccruals({
  profile,
  monthlyWage,
  monthsElapsed,
}: AccrualInput): AccrualResult {
  const eidi = calculateEidi({ profile, monthsWorked: monthsElapsed });
  const severance = roundRial(safeDivide(monthlyWage, 12));
  return {
    eidi: roundRial(safeDivide(eidi.recommended, 12)),
    severance,
    total: roundRial(safeDivide(eidi.recommended, 12) + severance),
  };
}
