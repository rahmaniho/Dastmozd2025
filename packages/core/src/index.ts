/**
 * @dastmozd/core — موتور محاسباتی دستمزد آرمانی
 *
 * تمام توابع این بسته «خالص» (pure) و مستقل از رابط کاربری هستند و می‌توانند در
 * وب، دسکتاپ، آزمون‌ها و یا یک سرویس بک‌اند استفاده شوند. هیچ ورودی/خروجی شبکه
 * یا دسترسی به DOM در این بسته وجود ندارد.
 */

// ---------------------------------------------------------------- utilities
export {
  roundRial,
  roundToStep,
  amountOf,
  sum,
  clamp,
  safeDivide,
} from './utils/money';
export {
  toPersianDigits,
  toLatinDigits,
  formatNumber,
  formatPersianNumber,
  formatRial,
  formatToman,
  numberToPersianWords,
  rialInWords,
} from './utils/digits';
export { fnv1a, makeVerificationCode, makeRunCode } from './utils/code';
export {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  addJalaliDays,
  addJalaliMonths,
  compareJalali,
  dateToJalali,
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
} from './utils/jalali';

// --------------------------------------------------------------- validation
export {
  validateIdCardNumber,
  validateInsuranceNumber,
  validateNationalId,
  validatePersonnelCode,
} from './validation/nationalId';
export type { ValidationResult } from './validation/nationalId';
export { IRAN_BANK_CODES, normalizeIban, toIranIban, validateIranIban } from './validation/iban';
export { validateEmployee } from './validation/employee';
export type { EmployeeField, EmployeeIssue } from './validation/employee';

// ------------------------------------------------------------------ engine
export {
  ENGINE_VERSION,
  emptyAttendance,
} from './engine/types';
export type {
  AttendanceSummary,
  BatchPayrollInput,
  BatchPayrollResult,
  ExtraDeduction,
  ExtraEarning,
  PayrollEmployee,
  PayrollInput,
  PayrollPeriodInput,
  PayrollRates,
  PayrollResult,
  PayrollRunOptions,
  ShiftKind,
} from './engine/types';

export {
  buildPayrollRates,
  dailyWageOf,
  deriveRates,
  hourlyWageOf,
  nightHourlyWage,
  overtimeHourlyWage,
} from './engine/rates';
export type { DerivedRates, DerivedRatesInput } from './engine/rates';

export {
  creditedDays,
  minutesBetween,
  nightHoursOf,
  summarizeAttendance,
  unpaidDays,
  workedHoursOf,
} from './engine/attendance';
export type { SummarizeAttendanceOptions } from './engine/attendance';

export { absorbReduction, applyProgressiveBrackets, bucketTaxableEarnings, computeTax, taxableComponentKeys } from './engine/tax';
export type { CategoryBuckets, ProgressiveTaxResult, TaxInput, TaxOutput } from './engine/tax';

export { computeInsurance } from './engine/insurance';
export type { InsuranceInput, InsuranceOutput } from './engine/insurance';

export { buildEarnings, creditDaysOf, earningLine, isSeniorityEligible } from './engine/earnings';
export type { BuildEarningsInput, BuildEarningsOutput } from './engine/earnings';

export { DEDUCTION_TITLES, buildDeductions } from './engine/deductions';
export type { BuildDeductionsInput, BuildDeductionsOutput } from './engine/deductions';

export { calculatePayroll, calculatePayrollBatch, resolveOptions } from './engine/payroll';

export {
  calculateAccruals,
  calculateEidi,
  calculateSeverance,
  calculateUnusedLeave,
} from './engine/bonuses';
export type {
  AccrualInput,
  AccrualResult,
  EidiInput,
  EidiResult,
  SeveranceInput,
  SeveranceResult,
  UnusedLeaveInput,
  UnusedLeaveResult,
} from './engine/bonuses';
