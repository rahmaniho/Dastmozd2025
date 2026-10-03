import type { BaseEntity, IsoDateTime, JalaliPeriod } from './common';

/**
 * Legal component keys — the abstract vocabulary of the payroll engine.
 * Every earning/deduction line produced by `@dastmozd/core` references one of
 * these keys so that tax/insurance rules can be resolved from a legal profile.
 */
export type EarningComponentKey =
  | 'base-wage' // مزد پایه / حقوق پایه
  | 'seniority' // پایه سنوات
  | 'housing' // حق مسکن
  | 'grocery' // بن کارگری / کمک‌هزینه اقلام مصرفی
  | 'marriage' // حق تأهل
  | 'child-allowance' // حق اولاد
  | 'overtime' // اضافه‌کاری
  | 'night-work' // شب‌کاری
  | 'holiday-work' // تعطیل‌کاری و جمعه‌کاری
  | 'shift-work' // نوبت‌کاری
  | 'mission' // حق مأموریت
  | 'bonus' // پاداش / کارانه
  | 'transport' // ایاب و ذهاب
  | 'food' // حق غذا
  | 'eidi' // عیدی
  | 'severance' // سنوات خدمت
  | 'leave-encashment' // بازخرید مرخصی
  | 'hardship' // حق سختی کار
  | 'supervision' // حق سرپرستی
  | 'other-benefit' // سایر مزایا
  | 'unpaid-leave-deduction' // کسر مرخصی بدون حقوق
  | 'absence-deduction' // کسر غیبت
  | 'late-deduction'; // کسر تأخیر و تعجیل

export type DeductionComponentKey =
  | 'social-security' // بیمه تأمین اجتماعی (سهم کارگر)
  | 'income-tax' // مالیات بر درآمد حقوق
  | 'supplementary-insurance' // بیمه تکمیلی
  | 'vat' // مالیات بر ارزش افزوده
  | 'loan' // وام
  | 'advance' // مساعده
  | 'penalty' // جریمه
  | 'union-fee' // کسورات اتحادیه
  | 'membership' // حق عضویت
  | 'other-deduction' // سایر کسورات

export type ComponentKey = EarningComponentKey | DeductionComponentKey;

export type PayrollLineType = 'earning' | 'deduction' | 'employer-cost';

export interface PayrollLineItem {
  key: ComponentKey;
  /** Persian label displayed on the payslip. */
  title: string;
  type: PayrollLineType;
  /** Hours, days or quantity that produced the amount (kept for auditing). */
  quantity?: number;
  /** Multiplier applied to `unitRate` (e.g. 1.4 for overtime). */
  coefficient?: number;
  unitRate?: number;
  /** Signed amount in Rial. Earnings are positive, deductions are positive too. */
  amount: number;
  /** Subject to labour-tax rules of the active legal profile. */
  taxable: boolean;
  /** Subject to social-security withholding. */
  insured: boolean;
  /**
   * True for wage-reduction lines (غیبت، مرخصی بدون حقوق) that must be
   * subtracted from the tax and insurance base before those are computed.
   */
  reducesBase?: boolean;
  /** Free-form explanation used by the trace viewer. */
  note?: string;
}

/** Machine-readable audit trail entry — one per calculation step. */
export interface CalculationTraceEntry {
  step: number;
  /** Stable identifier of the step, e.g. `overtime.hourly-rate`. */
  code: string;
  /** Persian title shown in the UI. */
  title: string;
  /** Persian explanation of what was computed. */
  detail: string;
  /** Result of the step in Rial (or the raw value for non-monetary steps). */
  value: number;
  /** Optional human readable inputs, e.g. "۶ ساعت × ۱٫۴". */
  formula?: string;
  legalRef?: string;
}

export interface TaxBracketResult {
  from: number;
  to: number | null;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface TaxComputation {
  /** Sum of all taxable earning lines. */
  taxableIncome: number;
  /** Monthly exemption ceiling applied by the profile. */
  exemption: number;
  /** Income after applying the exemption. */
  afterExemption: number;
  /** Breakdown per progressive bracket. */
  brackets: TaxBracketResult[];
  /** Sum of flat-rate segments (used by 1403/1404 profiles). */
  flatTax: number;
  flatSegments: Array<{ key: ComponentKey | 'refah-engizehi'; amount: number; rate: number; tax: number }>;
  /** Final tax to be withheld. */
  total: number;
  /** Effective rate as a fraction (0..1). */
  effectiveRate: number;
}

export interface InsuranceComputation {
  /** Component keys included in the insurance base. */
  included: ComponentKey[];
  /** Component keys explicitly excluded by the profile. */
  excluded: ComponentKey[];
  /** Raw insurance base before the ceiling. */
  rawBase: number;
  /** Ceiling applied by the profile (سقف بیمه). */
  ceiling: number;
  /** Base actually used (rawBase capped at ceiling). */
  base: number;
  employeeRate: number;
  employerRate: number;
  unemploymentRate: number;
  /** sهم کارگر */
  employeeShare: number;
  /** سهم کارفرما (شامل بیمه بیکاری) */
  employerShare: number;
  /** سهم بیمه بیکاری */
  unemploymentShare: number;
  /** Total paid to the Social Security Organisation. */
  totalShare: number;
}

export interface PayrollTotals {
  grossEarnings: number;
  /** Sum of all deductions excluding tax and insurance. */
  otherDeductions: number;
  tax: number;
  insurance: number;
  totalDeductions: number;
  netPay: number;
  /** Net pay rounded to the nearest 1,000 Rial (company convention, configurable). */
  payableAmount: number;
}

export interface EmployerCost {
  grossEarnings: number;
  employerInsurance: number;
  /** Employer-paid items such as عیدی and سنوات accrual. */
  accruals: PayrollLineItem[];
  total: number;
}

export type PayrollWarningCode =
  | 'BELOW_MINIMUM_WAGE'
  | 'INSURANCE_CEILING_EXCEEDED'
  | 'NEGATIVE_NET_PAY'
  | 'INVALID_WORKING_DAYS'
  | 'CHILD_COUNT_CAPPED'
  | 'MISSING_INSURANCE_NUMBER'
  | 'OVERTIME_OVER_LIMIT' // > 40 hours overtime a month requires labour-office approval
  | 'UNPAID_LEAVE_NO_BASE'
  | 'SENIORITY_NOT_ELIGIBLE'
  | 'TAX_EXEMPTION_PARTIAL';

export interface PayrollWarning {
  code: PayrollWarningCode;
  severity: 'info' | 'warning' | 'error';
  /** Persian message shown to the operator. */
  message: string;
  /** Correction hint. */
  hint?: string;
}

export interface PayrollRun extends BaseEntity {
  companyId: string;
  period: JalaliPeriod;
  /** 29, 30 or 31 working days of the Jalali month. */
  periodDays: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid' | 'locked';
  /** Monotonic version number for the same period (تاریخچه محاسبات). */
  version: number;
  /** Engine and legal profile metadata for full reproducibility. */
  meta: {
    engineVersion: string;
    legalProfileYear: number;
    legalProfileHash: string;
    calculatedAt: IsoDateTime;
    calculatedBy?: string;
    currency: 'IRR';
  };
  totals: {
    employeeCount: number;
    grossEarnings: number;
    netPay: number;
    tax: number;
    employeeInsurance: number;
    employerInsurance: number;
    employerCost: number;
  };
  /** Human readable changelog of this run. */
  changeLog: string[];
  lockedAt?: IsoDateTime;
  lockedBy?: string;
}

export interface Payslip extends BaseEntity {
  payrollRunId: string;
  employeeId: string;
  period: JalaliPeriod;
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  tax: TaxComputation;
  insurance: InsuranceComputation;
  totals: PayrollTotals;
  employerCost: EmployerCost;
  trace: CalculationTraceEntry[];
  warnings: PayrollWarning[];
  /** Deterministic verification code printed as a QR code on the payslip. */
  verificationCode: string;
}
