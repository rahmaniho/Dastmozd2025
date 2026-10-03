import type { LegalProfile } from '@dastmozd/legal';
import type { CalculationTraceEntry, DeductionComponentKey, PayrollLineItem } from '@dastmozd/types';
import { roundRial } from '../utils/money';
import type { AttendanceSummary, ExtraDeduction, PayrollRunOptions } from './types';

/** Persian titles of the deduction categories used when none is provided. */
export const DEDUCTION_TITLES: Record<DeductionComponentKey, string> = {
  'social-security': 'بیمه تأمین اجتماعی (سهم کارمند)',
  'income-tax': 'مالیات بر درآمد حقوق',
  'supplementary-insurance': 'بیمه تکمیلی',
  vat: 'مالیات بر ارزش افزوده',
  loan: 'قسط وام',
  advance: 'مساعده',
  penalty: 'جریمه',
  'union-fee': 'کسورات اتحادیه و انجمن صنفی',
  membership: 'حق عضویت',
  'other-deduction': 'سایر کسورات',
};

export interface BuildDeductionsInput {
  profile: LegalProfile;
  extras?: readonly ExtraDeduction[];
  attendance: AttendanceSummary;
  options?: PayrollRunOptions;
  /** Company-level late/early-leave penalty configuration. */
  latePenalty?: { enabled: boolean; perMinute: number };
}

export interface BuildDeductionsOutput {
  deductions: PayrollLineItem[];
  trace: CalculationTraceEntry[];
}

/**
 * Builds the voluntary and contractual deduction lines. Legal deductions
 * (insurance and tax) are appended by the payroll orchestrator because they
 * depend on the tax/insurance computations.
 */
export function buildDeductions({
  profile,
  extras = [],
  attendance,
  options,
  latePenalty,
}: BuildDeductionsInput): BuildDeductionsOutput {
  const deductions: PayrollLineItem[] = [];
  const trace: CalculationTraceEntry[] = [];
  let step = 1;

  for (const item of extras) {
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
    deductions.push({
      key: item.key,
      title: item.title ?? DEDUCTION_TITLES[item.key] ?? 'کسورات',
      type: 'deduction',
      amount: roundRial(item.amount),
      taxable: false,
      insured: false,
      reducesBase: item.reducesBase ?? false,
      note: item.note,
    });
  }

  const perMinute = options?.latePenaltyPerMinute ?? (latePenalty?.enabled ? latePenalty.perMinute : 0);
  const penaltyMinutes = attendance.lateMinutes + attendance.earlyLeaveMinutes;
  if (perMinute > 0 && penaltyMinutes > 0) {
    const amount = roundRial(perMinute * penaltyMinutes);
    deductions.push({
      key: 'penalty',
      title: 'جریمه تأخیر و تعجیل',
      type: 'deduction',
      quantity: penaltyMinutes,
      unitRate: perMinute,
      amount,
      taxable: false,
      insured: false,
      note: `${penaltyMinutes} دقیقه تأخیر/تعجیل`,
    });
    trace.push({
      step: step++,
      code: 'deduction.late-penalty',
      title: 'جریمه تأخیر',
      detail: `${penaltyMinutes} دقیقه تأخیر با نرخ ${perMinute.toLocaleString('en-US')} ریال در دقیقه محاسبه شد.`,
      value: amount,
      legalRef: 'آیین‌نامه داخلی کارگاه — ماده ۲۹ قانون کار',
    });
  }

  if (profile) {
    // Profile is accepted for symmetry with the other builders and future rules
    // such as per-profile penalty caps.
  }

  return { deductions, trace };
}
