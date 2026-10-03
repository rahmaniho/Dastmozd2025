import type { LegalProfile } from '@dastmozd/legal';
import type {
  CalculationTraceEntry,
  EarningComponentKey,
  PayrollLineItem,
  PayrollWarning,
} from '@dastmozd/types';
import { amountOf, roundRial, sum } from '../utils/money';
import { jalaliDiffInMonths } from '../utils/jalali';
import type { DerivedRates } from './rates';
import type {
  AttendanceSummary,
  ExtraEarning,
  PayrollEmployee,
  PayrollRunOptions,
  ShiftKind,
} from './types';

export interface BuildEarningsInput {
  employee: PayrollEmployee;
  profile: LegalProfile;
  attendance: AttendanceSummary;
  rates: DerivedRates;
  options?: PayrollRunOptions;
  extras?: readonly ExtraEarning[];
  /** Days credited for a fully attended month (`max(periodDays, 30)`). */
  creditDays: number;
  /**
   * Monthly amount that the base-wage line represents (پایه حقوق). Seniority is
   * always paid as its own line, so the monthly figure is used directly instead
   * of multiplying a rounded daily wage — this avoids 10-Rial drift on large
   * salaries and keeps the numbers exactly reproducible by hand.
   */
  baseMonthlyWage: number;
  /** Days that the employer still pays during sick leave. */
  employerPaidSickDays: number;
}

export interface BuildEarningsOutput {
  earnings: PayrollLineItem[];
  /** Wage reductions (غیبت، مرخصی بدون حقوق) shown in the deductions column. */
  reductions: PayrollLineItem[];
  reductionTotal: number;
  trace: CalculationTraceEntry[];
  warnings: PayrollWarning[];
  payableDays: number;
  /** Ratio used to pro-rate fixed benefits (payableDays ÷ creditDays). */
  prorationRatio: number;
  seniorityIncluded: boolean;
}

/** Creates an earning line with the profile driven tax/insurance flags. */
export function earningLine(
  profile: LegalProfile,
  key: EarningComponentKey,
  amount: number,
  extra: Partial<PayrollLineItem> = {},
): PayrollLineItem {
  const rule = profile.components[key];
  return {
    key,
    title: extra.title ?? rule.title,
    type: 'earning',
    amount: roundRial(amount),
    taxable: extra.taxable ?? rule.taxable,
    insured: extra.insured ?? rule.insured,
    ...extra,
  };
}

/** Creates a deduction line with the profile driven flags. */
export function deductionLine(
  profile: LegalProfile,
  key: EarningComponentKey | keyof typeof profile.components,
  amount: number,
  extra: Partial<PayrollLineItem> = {},
): PayrollLineItem {
  const rule = profile.components[key as EarningComponentKey];
  return {
    key: key as PayrollLineItem['key'],
    title: extra.title ?? rule?.title ?? 'کسورات',
    type: 'deduction',
    amount: roundRial(amount),
    taxable: false,
    insured: false,
    ...extra,
  };
}

/**
 * Number of days credited to the employee for a fully attended month.
 * این مبنای پرداخت ماهانه است: ماه ۳۰ و ۳۱ روزه با احتساب روزهای واقعی و ماه
 * ۲۹ روزه (اسفند) به‌صورت ماه کامل ۳۰ روزه پرداخت می‌شود.
 */
export function creditDaysOf(periodDays: number, monthlyDayDivisor: number): number {
  return Math.max(periodDays, monthlyDayDivisor);
}

/**
 * Whether the employee is entitled to the seniority allowance (پایه سنوات).
 * ماده ۴۹ قانون کار: کارگران دارای یک سال سابقه کار در یک کارگاه، پایه سنوات
 * روزانه دریافت می‌کنند؛ برای کارگران دارای بیش از یک سال، مبلغ پایه سنوات بر
 * مبنای سال‌های سابقه افزایش می‌یابد.
 */
export function isSeniorityEligible(employee: PayrollEmployee, periodEndIso: string): boolean {
  if (typeof employee.wage.seniorityEligible === 'boolean') return employee.wage.seniorityEligible;
  if (!employee.hireDate || !periodEndIso) return false;
  const parts = periodEndIso.split('-').map(Number);
  const jy = parts[0];
  const jm = parts[1];
  const jd = parts[2];
  if (jy === undefined || jm === undefined || jd === undefined) return false;
  if (Number.isNaN(jy) || Number.isNaN(jm) || Number.isNaN(jd)) return false;
  return jalaliDiffInMonths({ jy, jm, jd }, employee.hireDate) >= 12;
}

/** Builds every earning line of the payslip. Pure function. */
export function buildEarnings({
  employee,
  profile,
  attendance,
  rates,
  options,
  extras = [],
  creditDays,
  employerPaidSickDays,
  baseMonthlyWage,
}: BuildEarningsInput): BuildEarningsOutput {
  const trace: CalculationTraceEntry[] = [];
  const warnings: PayrollWarning[] = [];
  const earnings: PayrollLineItem[] = [];
  const reductions: PayrollLineItem[] = [];
  let step = 1;

  const daysInMonth = attendance.periodDays;
  const unpaidSickDays = Math.max(0, attendance.sickLeaveDays - employerPaidSickDays);
  const deductedDays =
    attendance.unpaidLeaveDays + attendance.absenceDays + unpaidSickDays + attendance.nonPayableDays;
  const payableDays = Math.max(0, creditDays - deductedDays);
  const prorationRatio = creditDays > 0 ? payableDays / creditDays : 0;

  // 1) Base wage — full monthly entitlement (مبنای ۳۰/۳۱ روز).
  const baseWageAmount = roundRial((baseMonthlyWage * creditDays) / profile.monthlyDayDivisor);
  const baseDailyRate = roundRial(baseMonthlyWage / profile.monthlyDayDivisor);
  earnings.push(
    earningLine(profile, 'base-wage', baseWageAmount, {
      quantity: creditDays,
      unitRate: baseDailyRate,
      note: `مزد روزانه ${baseDailyRate.toLocaleString('en-US')} ریال × ${creditDays} روز`,
    }),
  );
  trace.push({
    step: step++,
    code: 'wage.base',
    title: 'مزد پایه ماهانه',
    detail: `پایه حقوق ماهانه ${baseMonthlyWage.toLocaleString('en-US')} ریال برای ${creditDays} روز محاسبه شد.`,
    value: baseWageAmount,
    formula: `${baseDailyRate.toLocaleString('en-US')} × ${creditDays}`,
    legalRef: 'ماده ۳۴ و ۴۷ قانون کار',
  });

  // 2) Seniority allowance (پایه سنوات).
  const seniorityIncluded =
    options?.includeSeniority !== false &&
    isSeniorityEligible(employee, options?.seniorityReferenceIso ?? '');
  const seniorityAmount = employee.wage.seniorityMonthly ?? profile.seniorityMonthly;
  if (seniorityIncluded && seniorityAmount > 0) {
    earnings.push(
      earningLine(profile, 'seniority', seniorityAmount * (options?.prorateBenefits ? prorationRatio : 1), {
        quantity: 1,
        unitRate: seniorityAmount,
        coefficient: options?.prorateBenefits ? prorationRatio : 1,
        note: 'پایه سنوات ماهانه برای کارکنان با حداقل یک سال سابقه',
      }),
    );
  } else if (!seniorityIncluded && employee.hireDate) {
    warnings.push({
      code: 'SENIORITY_NOT_ELIGIBLE',
      severity: 'info',
      message: 'کارمند هنوز یک سال سابقه کار کامل نکرده است؛ پایه سنوات در این دوره لحاظ نشد.',
      hint: 'در صورت وجود سابقه قبلی، از تنظیمات کارمند گزینه پایه سنوات را فعال کنید.',
    });
  }

  // 3) Fixed legal benefits (مزایای ثابت): مسکن، بن، تأهل، اولاد.
  const benefitFactor = options?.prorateBenefits ? prorationRatio : 1;
  const housing = employee.wage.housingMonthly ?? profile.housingAllowanceMonthly;
  const grocery = employee.wage.groceryMonthly ?? profile.groceryAllowanceMonthly;
  const marriage = employee.wage.marriageMonthly ?? profile.marriageAllowanceMonthly;

  if (housing > 0) {
    earnings.push(
      earningLine(profile, 'housing', housing * benefitFactor, {
        quantity: 1,
        unitRate: housing,
        coefficient: benefitFactor,
      }),
    );
  }
  if (grocery > 0) {
    earnings.push(
      earningLine(profile, 'grocery', grocery * benefitFactor, {
        quantity: 1,
        unitRate: grocery,
        coefficient: benefitFactor,
      }),
    );
  }
  if (employee.maritalStatus === 'married' && marriage > 0) {
    earnings.push(
      earningLine(profile, 'marriage', marriage * benefitFactor, {
        quantity: 1,
        unitRate: marriage,
        coefficient: benefitFactor,
      }),
    );
  }

  const childCount = Math.max(0, Math.min(employee.childCount, profile.maxChildren));
  if (employee.childCount > profile.maxChildren) {
    warnings.push({
      code: 'CHILD_COUNT_CAPPED',
      severity: 'warning',
      message: `تعداد فرزندان مشمول حق اولاد به ${profile.maxChildren} فرزند محدود شد.`,
      hint: 'طبق قانون کار حق اولاد حداکثر برای چهار فرزند پرداخت می‌شود.',
    });
  }
  if (childCount > 0) {
    // ماده ۸۶ قانون تأمین اجتماعی و تبصره ماده ۷۸ قانون کار: حق اولاد معادل سه
    // روز حداقل مزد روزانه **در ماه** برای هر فرزند است (نه سه روز در هر روز).
    const childDaily = employee.wage.childAllowanceDaily ?? profile.childAllowanceDaily;
    const childMonthly = childDaily * childCount;
    earnings.push(
      earningLine(profile, 'child-allowance', childMonthly * benefitFactor, {
        quantity: childCount,
        unitRate: childDaily,
        coefficient: benefitFactor,
        note: `حق اولاد ${childCount} فرزند × ${profile.childAllowanceDayMultiplier} روز حداقل مزد (${childDaily.toLocaleString('en-US')} ریال در ماه برای هر فرزند)`,
      }),
    );
  }

  // 4) Overtime (اضافه‌کاری).
  if (attendance.overtimeHours > 0) {
    const amount = amountOf(rates.hourlyWage, attendance.overtimeHours, rates.overtimeCoefficient);
    earnings.push(
      earningLine(profile, 'overtime', amount, {
        quantity: attendance.overtimeHours,
        unitRate: rates.hourlyWage,
        coefficient: rates.overtimeCoefficient,
        note: `${attendance.overtimeHours} ساعت × مزد ساعتی × ${rates.overtimeCoefficient}`,
      }),
    );
    trace.push({
      step: step++,
      code: 'wage.overtime',
      title: 'اضافه‌کاری',
      detail: `${attendance.overtimeHours} ساعت اضافه‌کار با ضریب ${rates.overtimeCoefficient} محاسبه شد.`,
      value: amount,
      formula: `${rates.hourlyWage.toLocaleString('en-US')} × ${attendance.overtimeHours} × ${rates.overtimeCoefficient}`,
      legalRef: 'ماده ۵۹ قانون کار — ۴۰٪ اضافه بر مزد عادی',
    });
    if (attendance.overtimeHours > profile.maxOvertimeHoursPerMonth) {
      warnings.push({
        code: 'OVERTIME_OVER_LIMIT',
        severity: 'warning',
        message: `اضافه‌کاری این ماه (${attendance.overtimeHours} ساعت) از سقف ${profile.maxOvertimeHoursPerMonth} ساعت فراتر رفته است.`,
        hint: 'مازاد بر ۴۰ ساعت در ماه نیازمند موافقت اداره کار و پرداخت ۵۰٪ اضافه بر مزد است.',
      });
    }
  }

  // 5) Night work (فوق‌العاده شب‌کاری).
  const nightHours = attendance.nightHours;
  const nightOvertimeHours = attendance.nightOvertimeHours;
  if (nightHours > 0) {
    const mode = options?.nightWorkMode ?? 'full-rate';
    const coefficient = mode === 'premium' ? rates.nightAllowanceRate : 1 + rates.nightAllowanceRate;
    const amount = amountOf(rates.hourlyWage, nightHours, coefficient);
    earnings.push(
      earningLine(profile, 'night-work', amount, {
        quantity: nightHours,
        unitRate: rates.hourlyWage,
        coefficient,
        note: `${nightHours} ساعت شب‌کاری (بازه ${profile.nightWindow.from} تا ${profile.nightWindow.to})`,
      }),
    );
    trace.push({
      step: step++,
      code: 'wage.night',
      title: 'شب‌کاری',
      detail: `${nightHours} ساعت کار در بازه شب با ضریب ${coefficient} محاسبه شد.`,
      value: amount,
      legalRef: 'ماده ۵۸ قانون کار — ۳۵٪ اضافه بر مزد ساعتی',
    });
  }
  if (nightOvertimeHours > 0) {
    const coefficient = 1 + rates.nightAllowanceRate + (rates.overtimeCoefficient - 1);
    const amount = amountOf(rates.hourlyWage, nightOvertimeHours, coefficient);
    earnings.push(
      earningLine(profile, 'night-work', amount, {
        title: 'شب‌کاری توأم با اضافه‌کاری',
        quantity: nightOvertimeHours,
        unitRate: rates.hourlyWage,
        coefficient,
        note: `${nightOvertimeHours} ساعت شب‌کاری که اضافه‌کار نیز محسوب می‌شود`,
      }),
    );
  }

  // 6) Holiday work (جمعه‌کاری و تعطیل‌کاری).
  if (attendance.holidayHours > 0) {
    const amount = amountOf(rates.hourlyWage, attendance.holidayHours, rates.holidayCoefficient);
    earnings.push(
      earningLine(profile, 'holiday-work', amount, {
        quantity: attendance.holidayHours,
        unitRate: rates.hourlyWage,
        coefficient: rates.holidayCoefficient,
        note: 'کار در جمعه یا تعطیل رسمی',
      }),
    );
    trace.push({
      step: step++,
      code: 'wage.holiday',
      title: 'تعطیل‌کاری',
      detail: `${attendance.holidayHours} ساعت کار در تعطیل با ضریب ${rates.holidayCoefficient} محاسبه شد.`,
      value: amount,
      legalRef: 'ماده ۵۹ قانون کار — کار در جمعه با ۴۰٪ اضافه بر مزد',
    });
  }
  if (attendance.holidayOvertimeHours > 0) {
    const coefficient = rates.holidayCoefficient + (rates.overtimeCoefficient - 1);
    const amount = amountOf(rates.hourlyWage, attendance.holidayOvertimeHours, coefficient);
    earnings.push(
      earningLine(profile, 'holiday-work', amount, {
        title: 'تعطیل‌کاری توأم با اضافه‌کاری',
        quantity: attendance.holidayOvertimeHours,
        unitRate: rates.hourlyWage,
        coefficient,
        note: 'ساعات کار در تعطیل که از ساعات موظفی هفتگی عبور کرده است',
      }),
    );
  }

  // 7) Shift work allowance (نوبت‌کاری).
  for (const [kind, hours] of Object.entries(attendance.shiftHours) as Array<[ShiftKind, number | undefined]>) {
    if (!hours || hours <= 0) continue;
    const rule = profile.shiftWorkRules.find((item) => item.kind === kind);
    if (!rule) continue;
    const amount = amountOf(rates.hourlyWage, hours, rule.rate);
    earnings.push(
      earningLine(profile, 'shift-work', amount, {
        title: `فوق‌العاده ${rule.title}`,
        quantity: hours,
        unitRate: rates.hourlyWage,
        coefficient: rule.rate,
        note: `${hours} ساعت ${rule.title} با مزایای ${(rule.rate * 100).toFixed(1)}٪`,
      }),
    );
  }

  // 8) Mission allowance (حق مأموریت) derived from the mission hours.
  if (attendance.missionHours > 0 && attendance.missionDays > 0) {
    const perHour = options?.missionHourlyRate ?? 0;
    if (perHour > 0) {
      earnings.push(
        earningLine(profile, 'mission', perHour * attendance.missionHours, {
          quantity: attendance.missionHours,
          unitRate: perHour,
          note: 'فوق‌العاده مأموریت طبق آیین‌نامه پرداخت کارگاه',
        }),
      );
    }
  }

  // 9) Company specific fixed allowances.
  for (const item of employee.wage.extraFixed ?? []) {
    earnings.push(
      earningLine(profile, item.key, item.amount * benefitFactor, {
        title: item.title,
        coefficient: benefitFactor,
      }),
    );
  }

  // 10) Variable extras entered by the operator.
  for (const extra of extras) {
    const rule = profile.components[extra.key];
    const amount =
      extra.amount ??
      amountOf(
        extra.unitRate ?? (extra.key === 'overtime' ? rates.hourlyWage : rates.dailyWage),
        extra.quantity ?? 0,
        extra.coefficient ?? 1,
      );
    if (amount === 0) continue;
    earnings.push(
      earningLine(profile, extra.key, amount, {
        title: extra.title ?? rule.title,
        quantity: extra.quantity,
        unitRate: extra.unitRate,
        coefficient: extra.coefficient,
        note: extra.note,
      }),
    );
  }

  // 11) Wage reductions (غیبت، مرخصی بدون حقوق، عدم کارکرد).
  if (attendance.unpaidLeaveDays > 0) {
    reductions.push(
      deductionLine(profile, 'unpaid-leave-deduction', rates.dailyWage * attendance.unpaidLeaveDays, {
        title: 'کسر مرخصی بدون حقوق',
        quantity: attendance.unpaidLeaveDays,
        unitRate: rates.dailyWage,
        reducesBase: true,
        note: `${attendance.unpaidLeaveDays} روز مرخصی بدون حقوق`,
      }),
    );
  }
  if (attendance.absenceDays > 0) {
    reductions.push(
      deductionLine(profile, 'absence-deduction', rates.dailyWage * attendance.absenceDays, {
        title: 'کسر غیبت',
        quantity: attendance.absenceDays,
        unitRate: rates.dailyWage,
        reducesBase: true,
        note: `${attendance.absenceDays} روز غیبت غیرموجه`,
      }),
    );
  }
  if (unpaidSickDays > 0) {
    reductions.push(
      deductionLine(profile, 'unpaid-leave-deduction', rates.dailyWage * unpaidSickDays, {
        title: 'کسر مرخصی استعلاجی بدون مزد',
        quantity: unpaidSickDays,
        unitRate: rates.dailyWage,
        reducesBase: true,
        note: `${unpaidSickDays} روز استعلاجی خارج از پوشش کارفرما`,
      }),
    );
  }
  if (attendance.nonPayableDays > 0) {
    reductions.push(
      deductionLine(profile, 'unpaid-leave-deduction', rates.dailyWage * attendance.nonPayableDays, {
        title: 'کسر عدم کارکرد (ورود یا خروج در ماه)',
        quantity: attendance.nonPayableDays,
        unitRate: rates.dailyWage,
        reducesBase: true,
        note: `${attendance.nonPayableDays} روز بدون کارکرد و بدون حقوق`,
      }),
    );
  }

  const reductionTotal = roundRial(sum(reductions.map((line) => line.amount)));

  // 12) Sanity warnings.
  const payableBase = baseWageAmount - reductionTotal;
  const minMonthly = profile.minMonthlyWage;
  if (options?.minimumWageCheck !== false && payableBase < minMonthly && attendance.nonPayableDays === 0) {
    warnings.push({
      code: 'BELOW_MINIMUM_WAGE',
      severity: 'warning',
      message: `مزد قابل پرداخت این دوره (${payableBase.toLocaleString('en-US')} ریال) از حداقل مزد ماهانه ${minMonthly.toLocaleString('en-US')} ریال کمتر است.`,
      hint: 'کسر غیبت و مرخصی بدون حقوق یا پایه حقوق کمتر از مصوبه می‌تواند سبب شکایت در اداره کار شود.',
    });
  }
  if (deductedDays > daysInMonth) {
    warnings.push({
      code: 'INVALID_WORKING_DAYS',
      severity: 'error',
      message: 'جمع روزهای کسر شده از تعداد روزهای ماه بیشتر است؛ کارکرد را بازبینی کنید.',
    });
  }

  return {
    earnings,
    reductions,
    reductionTotal,
    trace,
    warnings,
    payableDays,
    prorationRatio,
    seniorityIncluded,
  };
}
