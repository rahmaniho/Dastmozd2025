import type {
  AttendanceKind,
  CalculationTraceEntry,
  ContractType,
  DeductionComponentKey,
  EarningComponentKey,
  EmployerCost,
  EmploymentStatus,
  InsuranceComputation,
  JalaliDate,
  JalaliPeriod,
  MaritalStatus,
  PayrollLineItem,
  PayrollTotals,
  PayrollWarning,
  TaxComputation,
} from '@dastmozd/types';

/** Engine version — bumped whenever a formula changes (stored on every run). */
export const ENGINE_VERSION = '1.0.0';

/** Minimal employee projection required by the calculation engine. */
export interface PayrollEmployee {
  id: string;
  fullName: string;
  personnelCode?: string;
  nationalId?: string;
  insuranceNumber?: string;
  hireDate?: JalaliDate;
  maritalStatus: MaritalStatus;
  /** Number of children eligible for حق اولاد (already age-checked upstream). */
  childCount: number;
  contractType: ContractType;
  status: EmploymentStatus;
  wage: {
    /** پایه حقوق ماهانه (Rial). */
    baseMonthly: number;
    /** Explicit seniority override; when omitted the engine derives it. */
    seniorityMonthly?: number;
    /** Force enable/disable the seniority allowance instead of deriving from hire date. */
    seniorityEligible?: boolean;
    /** Overrides for the legal fixed allowances (Rial per month). */
    housingMonthly?: number;
    groceryMonthly?: number;
    marriageMonthly?: number;
    /** Right of child per day override. */
    childAllowanceDaily?: number;
    /** Company specific fixed allowances. */
    extraFixed?: Array<{ key: EarningComponentKey; title: string; amount: number }>;
  };
}

export type ShiftKind = 'morning' | 'evening' | 'night' | 'rotating';

/** Aggregated attendance of one employee in one Jalali month. */
export interface AttendanceSummary {
  /** Total calendar days of the month (29, 30 or 31). */
  periodDays: number;
  /** Days actually present, including partial days (fractions allowed). */
  presentDays: number;
  /** Paid leave days (مرخصی استحقاقی). */
  paidLeaveDays: number;
  /** Sick leave days (مرخصی استعلاجی). */
  sickLeaveDays: number;
  /** Unpaid leave days — deducted from the wage. */
  unpaidLeaveDays: number;
  /** Unjustified absence days — deducted from the wage. */
  absenceDays: number;
  /**
   * Days without service that are not leave: hire/termination in the middle of
   * the month, suspension, … They are deducted like unpaid leave but reported
   * under a dedicated payslip line.
   */
  nonPayableDays: number;
  /** Mission days (fully paid). */
  missionDays: number;
  /** Mission hours used for the mission allowance. */
  missionHours: number;
  /** Normal worked hours (excluding overtime/night/holiday premiums). */
  regularHours: number;
  /** Overtime hours outside the night window and outside holidays. */
  overtimeHours: number;
  /** Night hours (22:00–06:00) that receive the 35% allowance. */
  nightHours: number;
  /** Night hours that are also overtime (receive 35% + 40%). */
  nightOvertimeHours: number;
  /** Hours worked on Fridays / official holidays inside the weekly quota. */
  holidayHours: number;
  /** Holiday hours that exceed the weekly quota (overtime on a holiday). */
  holidayOvertimeHours: number;
  /** Hours per shift kind, used for the نوبت‌کاری allowance. */
  shiftHours: Partial<Record<ShiftKind, number>>;
  /** Minutes of late arrival (used by optional penalties). */
  lateMinutes: number;
  /** Minutes of early leave. */
  earlyLeaveMinutes: number;
}

/** Builds an empty attendance summary for a period. */
export function emptyAttendance(periodDays: number): AttendanceSummary {
  return {
    periodDays,
    presentDays: periodDays,
    paidLeaveDays: 0,
    sickLeaveDays: 0,
    unpaidLeaveDays: 0,
    absenceDays: 0,
    nonPayableDays: 0,
    missionDays: 0,
    missionHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    nightHours: 0,
    nightOvertimeHours: 0,
    holidayHours: 0,
    holidayOvertimeHours: 0,
    shiftHours: {},
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
  };
}

/** Extra earnings entered manually by the operator during the payroll wizard. */
export interface ExtraEarning {
  key: EarningComponentKey;
  /** Overrides the default Persian title of the component. */
  title?: string;
  /** Absolute amount in Rial (wins over quantity × unitRate). */
  amount?: number;
  quantity?: number;
  unitRate?: number;
  coefficient?: number;
  note?: string;
}

/** Extra deductions: loans, advances, penalties, union fees, custom items. */
export interface ExtraDeduction {
  key: DeductionComponentKey;
  title?: string;
  amount: number;
  note?: string;
  /** Reduce the tax/insurance base (used by غیبت and مرخصی بدون حقوق). */
  reducesBase?: boolean;
}

export interface PayrollRunOptions {
  /** Distribute fixed benefits over payable days (default false → paid in full). */
  prorateBenefits?: boolean;
  /**
   * Number of days credited for a fully attended month. Defaults to
   * `max(periodDays, 30)` which reproduces the Iranian convention of paying the
   * full monthly wage in a 29-day Esfand and one extra day in 31-day months.
   */
  fullMonthCreditDays?: number;
  /** Disable insurance withholding entirely (e.g. for day-labour contractors). */
  insuranceEnabled?: boolean;
  /** Disable income tax withholding. */
  taxEnabled?: boolean;
  /** Withhold insurance before computing the taxable income (presentational). */
  insuranceBeforeTax?: boolean;
  /** Use the profile's flat-rate tax segments (1403/1404 only). */
  applyFlatTaxSegments?: boolean;
  /** Override the insurance ceiling (Rial). `null` disables the ceiling. */
  insuranceCeiling?: number | null;
  /** Rounding step for the payable amount (1 = no rounding). */
  roundingStep?: number;
  /** Emit BELOW_MINIMUM_WAGE warnings (default true). */
  minimumWageCheck?: boolean;
  /**
   * How night hours are compensated:
   *  - `full-rate` (default): the worked night hour is paid at 1.35 × hourly
   *    wage (the convention used by the original Dastmozd calculator).
   *  - `premium`: only the 35% premium is added, because the base hour is
   *    already covered by the monthly wage (article 58 wording).
   */
  nightWorkMode?: 'full-rate' | 'premium';
  /** Extra taxable income of the same month (second employer, arrears, …). */
  extraTaxableIncome?: number;
  /** Manual tax override (Rial) — the automatic computation is skipped. */
  manualTax?: number | null;
  /** Manual insurance base override (Rial). */
  manualInsuranceBase?: number | null;
  /** Override of the night allowance rate (0.35 by default). */
  nightAllowanceRate?: number;
  /** Override of the overtime coefficient (1.4 by default). */
  overtimeCoefficient?: number;
  /** Override of the holiday coefficient (1.4 by default). */
  holidayCoefficient?: number;
  /** Skip the seniority allowance (e.g. when the company does not pay it). */
  includeSeniority?: boolean;
  /** Late/early-leave penalty per minute (Rial). 0 disables the penalty. */
  latePenaltyPerMinute?: number;
  /**
   * Jalali ISO date (YYYY-MM-DD) of the last day of the period, used to check
   * the one-year seniority requirement. The orchestrator fills it automatically.
   */
  seniorityReferenceIso?: string;
  /** Hourly rate paid for mission hours (Rial). 0 disables the allowance. */
  missionHourlyRate?: number;
  /**
   * Base used to derive the daily and hourly wage:
   *  - `base` (default): only پایه حقوق — the convention used by the official
   *    minimum-wage tables of the Ministry of Labour.
   *  - `base+seniority`: پایه حقوق + پایه سنوات for workplaces that include the
   *    seniority allowance in the overtime base.
   */
  rateBaseMode?: 'base' | 'base+seniority';
}

export interface PayrollPeriodInput extends JalaliPeriod {
  /** Days of the Jalali month: 29, 30 or 31. */
  days: number;
}

export interface PayrollInput {
  employee: PayrollEmployee;
  period: PayrollPeriodInput;
  attendance: AttendanceSummary;
  /** @see LegalProfile — injected to keep the engine free of global state. */
  profile: import('@dastmozd/legal').LegalProfile;
  earnings?: ExtraEarning[];
  deductions?: ExtraDeduction[];
  options?: PayrollRunOptions;
  /** Company settings that influence the calculation. */
  company?: {
    insuranceBeforeTax?: boolean;
    prorateBenefits?: boolean;
    latePenaltyEnabled?: boolean;
    latePenaltyPerMinute?: number;
    roundPayout?: boolean;
    roundingStep?: number;
  };
  /** Timestamp used for the deterministic metadata (defaults to now). */
  calculatedAt?: string;
  calculatedBy?: string;
}

export interface PayrollRates {
  /** مزد روزانه = پایه ماهانه ÷ ۳۰ */
  dailyWage: number;
  /** مزد ساعتی = مزد روزانه ÷ ۷٫۳۳ */
  hourlyWage: number;
  /** اجرت هر ساعت اضافه‌کاری */
  overtimeHourly: number;
  /** مبلغ هر ساعت کار در شب (مزد + ۳۵٪) */
  nightHourly: number;
  /** مبلغ هر ساعت کار در جمعه/تعطیل */
  holidayHourly: number;
  /** مبلغ هر ساعت اضافه‌کار در تعطیل */
  holidayOvertimeHourly: number;
  /** مزد مؤثر روزانه پس از اعمال کسورات کارکرد */
  payableDailyWage: number;
}

export interface PayrollResult {
  employeeId: string;
  employeeName: string;
  period: PayrollPeriodInput;
  rates: PayrollRates;
  attendance: AttendanceSummary;
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  tax: TaxComputation;
  insurance: InsuranceComputation;
  totals: PayrollTotals;
  employerCost: EmployerCost;
  trace: CalculationTraceEntry[];
  warnings: PayrollWarning[];
  /** Deterministic verification code printed on the payslip QR. */
  verificationCode: string;
  meta: {
    engineVersion: string;
    legalProfileYear: number;
    legalProfileHash: string;
    calculatedAt: string;
    calculatedBy?: string;
    currency: 'IRR';
  };
}

export interface BatchPayrollInput {
  employees: PayrollInput[];
  /** Reports progress from 0 to 1 for long running browser batches. */
  onProgress?: (done: number, total: number) => void;
}

export interface BatchPayrollResult {
  results: PayrollResult[];
  totals: {
    employeeCount: number;
    grossEarnings: number;
    netPay: number;
    tax: number;
    employeeInsurance: number;
    employerInsurance: number;
    employerCost: number;
  };
}

/** Reason why an attendance day is not payable — reused by the UI layer. */
export type AttendanceKindLike = AttendanceKind;
