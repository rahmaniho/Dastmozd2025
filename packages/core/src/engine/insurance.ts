import type { LegalProfile } from '@dastmozd/legal';
import type {
  CalculationTraceEntry,
  ComponentKey,
  InsuranceComputation,
  PayrollLineItem,
} from '@dastmozd/types';
import { amountOf, roundRial, sum } from '../utils/money';
import type { PayrollRunOptions } from './types';

export interface InsuranceInput {
  profile: LegalProfile;
  earnings: readonly PayrollLineItem[];
  /** Wage reductions (غیبت، مرخصی بدون حقوق) subtracted from the base. */
  reductions: number;
  options?: PayrollRunOptions;
}

export interface InsuranceOutput {
  insurance: InsuranceComputation;
  trace: CalculationTraceEntry[];
}

/**
 * Computes the Social Security withholding (بیمه تأمین اجتماعی).
 *
 * ماده ۲۸ و ۳۹ قانون تأمین اجتماعی: سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ (شامل ۳٪
 * بیمه بیکاری) از «مزد و مزایای مشمول» کسر می‌شود. سقف مبنای کسر حق بیمه معادل
 * ۷ برابر حداقل مزد ماهانه است.
 */
export function computeInsurance({
  profile,
  earnings,
  reductions,
  options,
}: InsuranceInput): InsuranceOutput {
  const trace: CalculationTraceEntry[] = [];
  let step = 1;

  const included: ComponentKey[] = [];
  const excluded: ComponentKey[] = [];
  let rawBase = 0;

  for (const line of earnings) {
    const rule = profile.components[line.key as keyof typeof profile.components];
    if (!rule) continue;
    if (rule.insured && line.amount > 0) {
      included.push(line.key);
      rawBase += line.amount;
    } else {
      excluded.push(line.key);
    }
  }

  const afterReductions = Math.max(0, roundRial(rawBase - Math.max(0, reductions)));
  const ceiling =
    options?.insuranceCeiling === undefined ? profile.insurance.ceiling : options.insuranceCeiling;
  const base =
    options?.manualInsuranceBase != null
      ? roundRial(options.manualInsuranceBase)
      : ceiling === null
        ? afterReductions
        : Math.min(afterReductions, ceiling);

  trace.push({
    step: step++,
    code: 'insurance.base',
    title: 'مبنای کسر حق بیمه',
    detail: `جمع اقلام مشمول بیمه ${rawBase.toLocaleString('en-US')} ریال و پس از کسر کسورات کارکرد ${afterReductions.toLocaleString('en-US')} ریال محاسبه شد.`,
    value: afterReductions,
    legalRef: 'ماده ۳۹ قانون تأمین اجتماعی',
  });

  if (ceiling !== null && afterReductions > ceiling) {
    trace.push({
      step: step++,
      code: 'insurance.ceiling',
      title: 'سقف مبنای کسر حق بیمه',
      detail: `مبنا به سقف ${ceiling.toLocaleString('en-US')} ریال محدود شد (۷ برابر حداقل مزد ماهانه).`,
      value: ceiling,
      legalRef: 'مصوبه شورای عالی تأمین اجتماعی',
    });
  }

  const employeeShare = amountOf(base, profile.insurance.employeeRate);
  const employerShare = amountOf(base, profile.insurance.employerRate);
  const unemploymentShare = amountOf(base, profile.insurance.unemploymentRate);

  trace.push(
    {
      step: step++,
      code: 'insurance.employee',
      title: 'بیمه سهم کارمند',
      detail: 'کسر حق بیمه سهم کارگر از فیش حقوقی.',
      value: employeeShare,
      formula: `${base.toLocaleString('en-US')} × ${(profile.insurance.employeeRate * 100).toFixed(0)}٪`,
      legalRef: 'ماده ۲۸ قانون تأمین اجتماعی',
    },
    {
      step: step++,
      code: 'insurance.employer',
      title: 'بیمه سهم کارفرما',
      detail: 'هزینه کارفرما برای ارسال لیست بیمه تأمین اجتماعی.',
      value: employerShare,
      formula: `${base.toLocaleString('en-US')} × ${(profile.insurance.employerRate * 100).toFixed(0)}٪`,
      legalRef: 'ماده ۲۸ و ۳۸ قانون تأمین اجتماعی',
    },
  );

  const insurance: InsuranceComputation = {
    included,
    excluded,
    rawBase: roundRial(rawBase),
    ceiling: ceiling ?? Number.POSITIVE_INFINITY,
    base,
    employeeRate: profile.insurance.employeeRate,
    employerRate: profile.insurance.employerRate,
    unemploymentRate: profile.insurance.unemploymentRate,
    employeeShare,
    employerShare,
    unemploymentShare,
    totalShare: roundRial(sum([employeeShare, employerShare])),
  };

  return { insurance, trace };
}
