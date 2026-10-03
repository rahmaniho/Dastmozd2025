import { legalProfileHash } from '@dastmozd/legal';
import type {
  CalculationTraceEntry,
  EmployerCost,
  PayrollLineItem,
  PayrollTotals,
  PayrollWarning,
} from '@dastmozd/types';
import { roundRial, roundToStep, safeDivide, sum } from '../utils/money';
import { jalaliMonthLength, jalaliToIso } from '../utils/jalali';
import { makeVerificationCode } from '../utils/code';
import { buildDeductions } from './deductions';
import { buildEarnings, creditDaysOf, isSeniorityEligible, type BuildEarningsOutput } from './earnings';
import { computeInsurance } from './insurance';
import { computeTax } from './tax';
import { buildPayrollRates, deriveRates } from './rates';
import {
  ENGINE_VERSION,
  type BatchPayrollInput,
  type BatchPayrollResult,
  type PayrollInput,
  type PayrollResult,
  type PayrollRunOptions,
} from './types';

/** Merges the caller options with the company-level defaults. */
export function resolveOptions(input: PayrollInput): PayrollRunOptions {
  const company = input.company;
  const options: PayrollRunOptions = { ...input.options };
  if (options.prorateBenefits === undefined && company?.prorateBenefits !== undefined) {
    options.prorateBenefits = company.prorateBenefits;
  }
  if (options.insuranceBeforeTax === undefined && company?.insuranceBeforeTax !== undefined) {
    options.insuranceBeforeTax = company.insuranceBeforeTax;
  }
  if (options.roundingStep === undefined) {
    options.roundingStep = company?.roundPayout ? (company.roundingStep ?? 1000) : 1;
  }
  if (options.latePenaltyPerMinute === undefined && company?.latePenaltyEnabled) {
    options.latePenaltyPerMinute = company.latePenaltyPerMinute ?? 0;
  }
  return options;
}

/** Sums the lines of one type, rounding the total to whole Rial. */
function totalOf(lines: readonly PayrollLineItem[]): number {
  return roundRial(sum(lines.map((line) => line.amount)));
}

/**
 * Calculates the full payslip of a single employee for one Jalali month.
 *
 * The function is deterministic: identical inputs always produce identical
 * outputs, and every step is recorded in `result.trace` so that an accountant
 * can reproduce the number by hand.
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { employee, profile, attendance, period } = input;
  const options = resolveOptions(input);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();

  const periodEndIso =
    options.seniorityReferenceIso ??
    jalaliToIso({ jy: period.jy, jm: period.jm, jd: jalaliMonthLength(period.jy, period.jm) });
  const runOptions: PayrollRunOptions = { ...options, seniorityReferenceIso: periodEndIso };

  // --- 1) Rates -----------------------------------------------------------
  const seniorityEligible = isSeniorityEligible(employee, periodEndIso);
  const seniorityMonthly =
    seniorityEligible && runOptions.includeSeniority !== false
      ? (employee.wage.seniorityMonthly ?? profile.seniorityMonthly)
      : 0;
  const rateBaseMode = runOptions.rateBaseMode ?? 'base';
  const rateBase = rateBaseMode === 'base' ? employee.wage.baseMonthly : employee.wage.baseMonthly + seniorityMonthly;
  const rates = deriveRates({
    baseMonthly: rateBase,
    // In `base` mode the seniority allowance is paid as its own line and is not
    // part of the daily/hourly rate — the convention of the official wage tables.
    // In `base+seniority` mode it is already inside `rateBase`.
    seniorityMonthly: 0,
    options: runOptions,
    profile,
  });

  const creditDays = creditDaysOf(period.days, profile.monthlyDayDivisor);
  const employerPaidSickDays = 0;

  // --- 2) Earnings --------------------------------------------------------
  const earningsResult: BuildEarningsOutput = buildEarnings({
    employee,
    profile,
    attendance,
    rates,
    options: runOptions,
    extras: input.earnings ?? [],
    creditDays,
    employerPaidSickDays,
    baseMonthlyWage: employee.wage.baseMonthly,
  });

  const trace: CalculationTraceEntry[] = [];
  let step = 1;
  const pushTrace = (entry: Omit<CalculationTraceEntry, 'step'>): void => {
    trace.push({ step: step++, ...entry });
  };

  pushTrace({
    code: 'rates.daily',
    title: 'مزد روزانه و ساعتی',
    detail: `مبنای محاسبه: ${rateBaseMode === 'base' ? 'پایه حقوق' : 'پایه حقوق و پایه سنوات'} × ${profile.monthlyDayDivisor} روز؛ مزد ساعتی بر مبنای ${profile.monthlyHourDivisor} ساعت در ماه.`,
    value: rates.dailyWage,
    formula: `${rateBase.toLocaleString('en-US')} ÷ ${profile.monthlyDayDivisor} = ${rates.dailyWage.toLocaleString('en-US')}`,
    legalRef: 'ماده ۴۷ قانون کار',
  });
  pushTrace({
    code: 'rates.hourly',
    title: 'مزد ساعتی',
    detail: `مزد ساعتی برای محاسبه اضافه‌کار، شب‌کاری و تعطیل‌کاری.`,
    value: rates.hourlyWage,
    formula: `${rateBase.toLocaleString('en-US')} ÷ ${profile.monthlyHourDivisor} = ${rates.hourlyWage.toLocaleString('en-US')}`,
    legalRef: 'ماده ۴۷ قانون کار — ۴۴ ساعت در هفته',
  });
  if (audienceWantsSeniorityNote(runOptions)) {
    pushTrace({
      code: 'wage.seniority',
      title: 'پایه سنوات',
      detail: seniorityMonthly > 0
        ? 'کارمند واجد شرایط پایه سنوات تشخیص داده شد.'
        : 'کارمند واجد شرایط پایه سنوات نبود یا پرداخت آن غیرفعال است.',
      value: seniorityMonthly,
      legalRef: 'ماده ۴۹ قانون کار',
    });
  }

  // --- 3) Insurance -------------------------------------------------------
  const reductionBase = roundRial(
    sum(earningsResult.reductions.filter((line) => line.reducesBase !== false).map((line) => line.amount)),
  );
  const insuranceResult = options.insuranceEnabled === false
    ? {
        insurance: {
          included: [],
          excluded: [],
          rawBase: 0,
          ceiling: 0,
          base: 0,
          employeeRate: profile.insurance.employeeRate,
          employerRate: profile.insurance.employerRate,
          unemploymentRate: profile.insurance.unemploymentRate,
          employeeShare: 0,
          employerShare: 0,
          unemploymentShare: 0,
          totalShare: 0,
        },
        trace: [],
      }
    : computeInsurance({
        profile,
        earnings: earningsResult.earnings,
        reductions: reductionBase,
        options: runOptions,
      });

  // --- 4) Tax -------------------------------------------------------------
  const taxResult = options.taxEnabled === false
    ? {
        tax: {
          taxableIncome: 0,
          exemption: profile.tax.monthlyExemption,
          afterExemption: 0,
          brackets: [],
          flatTax: 0,
          flatSegments: [],
          total: 0,
          effectiveRate: 0,
        },
        trace: [],
      }
    : computeTax({
        profile,
        earnings: earningsResult.earnings,
        reductions: reductionBase,
        options: runOptions,
      });

  // --- 5) Deduction lines -------------------------------------------------
  const extraDeductions = buildDeductions({
    profile,
    extras: input.deductions ?? [],
    attendance,
    options: runOptions,
    latePenalty: {
      enabled: input.company?.latePenaltyEnabled ?? false,
      perMinute: input.company?.latePenaltyPerMinute ?? 0,
    },
  });

  const deductions: PayrollLineItem[] = [
    ...earningsResult.reductions,
    ...extraDeductions.deductions,
  ];
  if (insuranceResult.insurance.employeeShare > 0) {
    deductions.push({
      key: 'social-security',
      title: 'بیمه تأمین اجتماعی (سهم کارمند)',
      type: 'deduction',
      amount: insuranceResult.insurance.employeeShare,
      taxable: false,
      insured: false,
      note: `${(profile.insurance.employeeRate * 100).toFixed(0)}٪ مبنای ${insuranceResult.insurance.base.toLocaleString('en-US')} ریال`,
    });
  }
  if (taxResult.tax.total > 0) {
    deductions.push({
      key: 'income-tax',
      title: 'مالیات بر درآمد حقوق',
      type: 'deduction',
      amount: taxResult.tax.total,
      taxable: false,
      insured: false,
      note: `نرخ مؤثر ${(taxResult.tax.effectiveRate * 100).toFixed(1)}٪`,
    });
  }

  // --- 6) Totals ----------------------------------------------------------
  const grossEarnings = totalOf(earningsResult.earnings);
  const totalDeductions = totalOf(deductions);
  const netPay = roundRial(grossEarnings - totalDeductions);
  const roundingStep = options.roundingStep ?? 1;
  const payableAmount = roundToStep(netPay, roundingStep);

  const totals: PayrollTotals = {
    grossEarnings,
    otherDeductions: roundRial(
      totalOf(deductions.filter((line) => line.key !== 'social-security' && line.key !== 'income-tax')),
    ),
    tax: taxResult.tax.total,
    insurance: insuranceResult.insurance.employeeShare,
    totalDeductions,
    netPay,
    payableAmount,
  };

  const employerCost: EmployerCost = {
    grossEarnings,
    employerInsurance: insuranceResult.insurance.employerShare,
    accruals: [],
    total: roundRial(grossEarnings + insuranceResult.insurance.employerShare),
  };

  // --- 7) Warnings --------------------------------------------------------
  const warnings: PayrollWarning[] = [
    ...earningsResult.warnings,
    ...detectGlobalWarnings({ totals, insurance: insuranceResult.insurance, profile, employeeText: employee }),
  ];

  // --- 8) Trace assembly --------------------------------------------------
  trace.push(...earningsResult.trace, ...insuranceResult.trace, ...taxResult.trace, ...extraDeductions.trace);
  pushTrace({
    code: 'totals.net',
    title: 'خالص پرداختی',
    detail: `جمع مزایا ${grossEarnings.toLocaleString('en-US')} ریال منهای کسورات ${totalDeductions.toLocaleString('en-US')} ریال.`,
    value: netPay,
    formula: `${grossEarnings.toLocaleString('en-US')} − ${totalDeductions.toLocaleString('en-US')}`,
  });

  const payableDailyWage = roundRial(safeDivide(employee.wage.baseMonthly - reductionBase, creditDays));
  const verificationCode = makeVerificationCode([
    employee.id,
    employee.nationalId ?? '',
    period.jy,
    period.jm,
    grossEarnings,
    totalDeductions,
    netPay,
  ]);

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    period,
    rates: buildPayrollRates(rates, payableDailyWage),
    attendance,
    earnings: earningsResult.earnings,
    deductions,
    tax: taxResult.tax,
    insurance: insuranceResult.insurance,
    totals,
    employerCost,
    trace: trace.sort((a, b) => a.step - b.step),
    warnings,
    verificationCode,
    meta: {
      engineVersion: ENGINE_VERSION,
      legalProfileYear: profile.year,
      legalProfileHash: legalProfileHash(profile),
      calculatedAt,
      calculatedBy: input.calculatedBy,
      currency: 'IRR',
    },
  };
}

function audienceWantsSeniorityNote(options: PayrollRunOptions): boolean {
  return options.includeSeniority !== false;
}

/** Detects issues that only become visible after all parts are computed. */
function detectGlobalWarnings({
  totals,
  insurance,
  profile,
  employeeText,
}: {
  totals: PayrollTotals;
  insurance: { rawBase: number; base: number };
  profile: { insurance: { ceiling: number } };
  employeeText: { insuranceNumber?: string; status: string };
}): PayrollWarning[] {
  const warnings: PayrollWarning[] = [];
  if (totals.netPay < 0) {
    warnings.push({
      code: 'NEGATIVE_NET_PAY',
      severity: 'error',
      message: 'خالص پرداختی منفی است؛ کسورات این دوره از مزایا بیشتر شده است.',
      hint: 'اقساط وام، مساعده یا کسورات را بازبینی کنید.',
    });
  }
  if (insurance.rawBase > profile.insurance.ceiling) {
    warnings.push({
      code: 'INSURANCE_CEILING_EXCEEDED',
      severity: 'info',
      message: `مبنای بیمه از سقف قانونی (${profile.insurance.ceiling.toLocaleString('en-US')} ریال) فراتر رفته و به سقف محدود شد.`,
    });
  }
  if (!employeeText.insuranceNumber && employeeText.status === 'active') {
    warnings.push({
      code: 'MISSING_INSURANCE_NUMBER',
      severity: 'warning',
      message: 'شماره بیمه تأمین اجتماعی این کارمند ثبت نشده است.',
      hint: 'برای ارسال لیست بیمه، شماره بیمه ۱۰ رقمی الزامی است.',
    });
  }
  return warnings;
}

/** Calculates a full month payroll for many employees (progress friendly). */
export function calculatePayrollBatch({ employees, onProgress }: BatchPayrollInput): BatchPayrollResult {
  const results: PayrollResult[] = [];
  const total = employees.length;
  for (let index = 0; index < total; index += 1) {
    const input = employees[index];
    if (!input) continue;
    results.push(calculatePayroll(input));
    onProgress?.(index + 1, total);
  }
  const totals = results.reduce(
    (acc, result) => ({
      employeeCount: acc.employeeCount + 1,
      grossEarnings: acc.grossEarnings + result.totals.grossEarnings,
      netPay: acc.netPay + result.totals.netPay,
      tax: acc.tax + result.totals.tax,
      employeeInsurance: acc.employeeInsurance + result.totals.insurance,
      employerInsurance: acc.employerInsurance + result.employerCost.employerInsurance,
      employerCost: acc.employerCost + result.employerCost.total,
    }),
    {
      employeeCount: 0,
      grossEarnings: 0,
      netPay: 0,
      tax: 0,
      employeeInsurance: 0,
      employerInsurance: 0,
      employerCost: 0,
    },
  );
  return { results, totals };
}
