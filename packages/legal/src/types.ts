import type { EarningComponentKey } from '@dastmozd/types';

/** A citable legal source backing the numbers of a yearly profile. */
export interface LegalSource {
  /** Persian title of the document. */
  title: string;
  /** Issuing authority, e.g. «شورای عالی کار». */
  issuer: string;
  /** Circular / clause reference when available. */
  reference?: string;
  url?: string;
  /** Persian note about how the figure was applied. */
  note?: string;
}

/**
 * Tax category of an earning component. This drives the optional flat-rate
 * segment used by the 1403/1404 budget laws (`مزایای رفاهی و انگیزشی`).
 */
export type TaxCategory =
  | 'wage' // مزد و مزایای مستمر
  | 'benefit' // مزایای رفاهی و انگیزشی (بن، مسکن، تأهل، اولاد...)
  | 'performance' // اضافه‌کار، شب‌کاری، نوبت‌کاری (مزایای تبعی شغل)
  | 'reimbursement' // مأموریت، ایاب و ذهاب — هزینه اصلاح‌شده
  | 'exempt'; // مشمول‌نشین (سنوات، بازخرید مرخصی)

/** Tax / insurance treatment of a single earning component. */
export interface ComponentRule {
  key: EarningComponentKey;
  /** Persian label used on payslips. */
  title: string;
  taxable: boolean;
  insured: boolean;
  category: TaxCategory;
  /**
   * Absolute monthly ceiling that stays tax-exempt (e.g. عیدی up to one twelfth
   * of the annual exemption). `null` means "no special ceiling".
   */
  taxExemptMonthlyCap?: number | null;
  /** Persian explanation of the rule and its legal basis. */
  note?: string;
}

export interface TaxBracket {
  /** Upper bound of the bracket in Rial, exclusive. `null` = infinite. */
  upTo: number | null;
  /** Marginal rate, 0..1 */
  rate: number;
  /** Persian label, e.g. «مازاد ۴۰ تا ۸۰ میلیون تومان». */
  label: string;
}

/**
 * Flat-rate tax segment (۱۰٪ مقطوع) applied to the listed categories after the
 * exempt ceiling has been consumed. Used by the 1403 and 1404 budget laws and
 * disabled (empty array) for 1405.
 */
export interface FlatTaxSegment {
  rate: number;
  categories: TaxCategory[];
  /** Persian label shown in the tax breakdown. */
  label: string;
  legalRef: string;
}

/** Shift-work allowance coefficients (نوبت‌کاری). */
export interface ShiftWorkRule {
  kind: 'morning' | 'evening' | 'night' | 'rotating';
  /** Allowance as a fraction of the base hourly wage (e.g. 0.1 = ۱۰٪). */
  rate: number;
  /** Persian label. */
  title: string;
}

export interface InsuranceRules {
  /** Employee (worker) share — 7% by law. */
  employeeRate: number;
  /** Employer share including the 3% unemployment premium — 23% by law. */
  employerRate: number;
  /** Unemployment premium inside the employer share — 3%. */
  unemploymentRate: number;
  /** Insurance ceiling as a multiple of the minimum monthly wage (7×). */
  ceilingMultiplier: number;
  /** Absolute ceiling in Rial (derived from ceilingMultiplier and rounded). */
  ceiling: number;
  note?: string;
}

export interface TaxRules {
  /** Monthly exemption ceiling in Rial. */
  monthlyExemption: number;
  /** Annual exemption ceiling in Rial (12× monthly). */
  annualExemption: number;
  /** Progressive brackets applied to the monthly taxable income. */
  brackets: TaxBracket[];
  /** Percentage of the annual exemption that عیدی/پاداش are exempt from. */
  eidiExemptionCap: number;
  /** Optional flat-rate segments (1403/1404 only). */
  flatSegments: FlatTaxSegment[];
  /** Minimum salary for applying the progressive table. */
  note?: string;
}

export interface EidiRules {
  /** Minimum bonus as a multiple of the monthly minimum wage (2×). */
  minMultiplier: number;
  /** Maximum bonus as a multiple of the monthly minimum wage (3×). */
  maxMultiplier: number;
  /** Fraction of the annual wage used for pro-rating partial years (1/12 per month). */
  proRatePerMonthFraction: number;
  note?: string;
}

export interface SeveranceRules {
  /** Days of wage paid per year of service (30 by law). */
  daysPerYear: number;
  /** Minimum paid working days to qualify for severance in a period. */
  minWorkingDays: number;
  note?: string;
}

export interface LeaveRules {
  /** Annual paid leave days (26 days per Art. 64 of the Labour Law). */
  annualPaidLeaveDays: number;
  /** Months of service required before leave entitlement accrues. */
  accrualAfterDays: number;
  /** Sick leave: first 3 days unpaid by employer (Art. 67). */
  sickLeaveFirstDaysUnpaid: number;
  /** Whether unused leave can be encashed (بازخرید). */
  encashable: boolean;
  note?: string;
}

/** The complete yearly legal profile consumed by the payroll engine. */
export interface LegalProfile {
  /** Jalali year, e.g. 1405. */
  year: number;
  /** Persian display label, e.g. «۱۴۰۵». */
  label: string;
  /** Persian short description shown in settings. */
  description: string;
  /**
   * True when the figures were cross-checked against the official circular that
   * is published in `sources`. Profiles that are still waiting for the official
   * circular are flagged `false` and the UI shows a verification warning.
   */
  verified: boolean;
  sources: LegalSource[];

  /** حداقل مزد روزانه (Rial). */
  minDailyWage: number;
  /** حداقل مزد ماهانه بر مبنای ۳۰ روز. */
  minMonthlyWage: number;
  /** حق مسکن ماهانه. */
  housingAllowanceMonthly: number;
  /** بن کارگری (کمک‌هزینه اقلام مصرفی خانوار) ماهانه. */
  groceryAllowanceMonthly: number;
  /** حق تأهل ماهانه. */
  marriageAllowanceMonthly: number;
  /** ضریب حق اولاد نسبت به حداقل مزد روزانه (۳ روز). */
  childAllowanceDayMultiplier: number;
  /** حداقل مزد روزانه × ضریب = حق اولاد روزانه. */
  childAllowanceDaily: number;
  /** حداکثر فرزند مشمول حق اولاد. */
  maxChildren: number;
  /** سن پایان حق اولاد (سال شمسی). */
  childAllowanceAgeLimit: number;
  /** پایه سنوات روزانه برای کارگران با حداقل یک سال سابقه. */
  seniorityDaily: number;
  /** پایه سنوات ماهانه (۳۰ روز). */
  seniorityMonthly: number;

  /** ساعات کار موظفی هفتگی (۴۴ ساعت). */
  weeklyHours: number;
  /** ساعات کار موظفی روزانه (۴۴ ÷ ۶ ≈ ۷٫۳۳). */
  dailyHours: number;
  /** مخرج تبدیل مزد ماهانه به ساعتی (۳۰ × ۷٫۳۳ = ۲۲۰). */
  monthlyHourDivisor: number;
  /** روزهای مبنای تبدیل مزد ماهانه به روزانه (۳۰). */
  monthlyDayDivisor: number;

  /** ضریب اضافه‌کاری عادی (۱٫۴ = ۴۰٪ اضافه بر مزد). */
  overtimeCoefficient: number;
  /** حداکثر اضافه‌کاری مجاز ماهانه (ساعت) بدون مجوز اداره کار. */
  maxOvertimeHoursPerMonth: number;
  /** ضریب پرداخت ساعات کار در روز جمعه/تعطیل رسمی (۱٫۴). */
  holidayCoefficient: number;
  /** ضریب اضافه‌کار برای ساعات کار در تعطیلاتی که از ساعات موظفی هفتگی عبور کنند. */
  holidayOvertimeCoefficient: number;
  /** مبلغ ثابت شب‌کاری به‌صورت ضریبی از مزد ساعتی (۰٫۳۵). */
  nightWorkAllowanceRate: number;
  /** بازه شب‌کاری. */
  nightWindow: { from: string; to: string };
  /** ضرایب نوبت‌کاری. */
  shiftWorkRules: ShiftWorkRule[];

  insurance: InsuranceRules;
  tax: TaxRules;
  eidi: EidiRules;
  severance: SeveranceRules;
  leave: LeaveRules;

  /** قواعد مشمولیت مالیات و بیمه به تفکیک اقلام حقوقی. */
  components: Record<EarningComponentKey, ComponentRule>;
}

export type LegalProfiles = Record<number, LegalProfile>;
