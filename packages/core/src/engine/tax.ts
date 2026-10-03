import type { LegalProfile, TaxCategory } from '@dastmozd/legal';
import type {
  CalculationTraceEntry,
  ComponentKey,
  PayrollLineItem,
  TaxBracketResult,
  TaxComputation,
} from '@dastmozd/types';
import { roundRial, sum } from '../utils/money';
import type { PayrollRunOptions } from './types';

/** A bucket of taxable income grouped by its legal tax category. */
export type CategoryBuckets = Partial<Record<TaxCategory, number>>;

export interface ProgressiveTaxResult {
  total: number;
  brackets: TaxBracketResult[];
}

/**
 * Applies a progressive bracket table to an amount of income.
 *
 * @param amount    taxable income (Rial) — already net of any exemption
 * @param brackets  bracket table of the active legal profile
 * @param startAt   lower edge from which `amount` starts accruing. Use the
 *                  monthly exemption when the exemption has already been
 *                  consumed proportionally (1403/1404 flat-rate model).
 */
export function applyProgressiveBrackets(
  amount: number,
  brackets: LegalProfile['tax']['brackets'],
  startAt = 0,
): ProgressiveTaxResult {
  const result: TaxBracketResult[] = [];
  let remaining = Math.max(0, roundRial(amount));
  let cursor = Math.max(0, startAt);
  let total = 0;

  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Number.POSITIVE_INFINITY;
    const span = Math.max(0, upper - cursor);
    const taxable = Math.min(remaining, span);
    const tax = roundRial(taxable * bracket.rate);
    result.push({
      from: cursor,
      to: bracket.upTo,
      rate: bracket.rate,
      taxableAmount: taxable,
      tax,
    });
    total += tax;
    remaining -= taxable;
    cursor += taxable;
    if (remaining <= 0) break;
  }

  return { total: roundRial(total), brackets: result };
}

/** Sums the taxable amount of every earning line, grouped by tax category. */
export function bucketTaxableEarnings(
  earnings: readonly PayrollLineItem[],
  profile: LegalProfile,
  options: { applyExemptCaps?: boolean } = {},
): { buckets: CategoryBuckets; taxableIncome: number; cappedExempt: number } {
  const buckets: CategoryBuckets = {};
  let taxableIncome = 0;
  let cappedExempt = 0;

  for (const line of earnings) {
    const rule = profile.components[line.key as keyof typeof profile.components];
    if (!rule?.taxable || line.amount <= 0) continue;
    const cap = options.applyExemptCaps === false ? null : rule.taxExemptMonthlyCap;
    let taxableAmount = line.amount;
    if (typeof cap === 'number') {
      const exempt = Math.min(line.amount, cap);
      cappedExempt += exempt;
      taxableAmount = line.amount - exempt;
    }
    buckets[rule.category] = (buckets[rule.category] ?? 0) + taxableAmount;
    taxableIncome += taxableAmount;
  }

  return { buckets, taxableIncome, cappedExempt };
}

/**
 * Removes wage reductions (غیبت، مرخصی بدون حقوق) from the category buckets
 * before the tax is computed. The deduction is absorbed by the wage bucket
 * first, then by benefits, then by performance pay — mirroring how Iranian
 * payroll software reduces the taxable base.
 */
export function absorbReduction(
  buckets: CategoryBuckets,
  reduction: number,
): CategoryBuckets {
  let remaining = Math.max(0, reduction);
  const order: TaxCategory[] = ['wage', 'benefit', 'performance', 'reimbursement', 'exempt'];
  const result: CategoryBuckets = { ...buckets };
  for (const category of order) {
    if (remaining <= 0) break;
    const value = result[category] ?? 0;
    if (value <= 0) continue;
    const cut = Math.min(value, remaining);
    result[category] = value - cut;
    remaining -= cut;
  }
  return result;
}

export interface TaxInput {
  profile: LegalProfile;
  /** Earning lines produced by the earnings builder. */
  earnings: readonly PayrollLineItem[];
  /** Sum of wage-reduction lines (غیبت + مرخصی بدون هزینه). */
  reductions: number;
  options?: PayrollRunOptions;
}

export interface TaxOutput {
  tax: TaxComputation;
  trace: CalculationTraceEntry[];
}

/**
 * Computes the monthly income tax (مالیات بر درآمد حقوق).
 *
 * مدل محاسبه بر پایه ماده ۸۵ قانون مالیات‌های مستقیم و جدول پلکانی سالانه
 * (تبصره قانون بودجه) است. برای سال‌های ۱۴۰۳ و ۱۴۰۴ که قانون بودجه نرخ مقطوع
 * ۱۰٪ برای مزایای رفاهی، انگیزشی و تبعی مقرر کرده است، سقف معافیت به‌تناسب بین
 * اقلام توزیع می‌شود و سپس جدول پلکانی بر بخش مزد و نرخ مقطوع بر بخش رفاهی
 * اعمال می‌گردد. برای سال ۱۴۰۵ همه اقلام با جدول پلکانی مشمول می‌شوند.
 */
export function computeTax({ profile, earnings, reductions, options }: TaxInput): TaxOutput {
  const trace: CalculationTraceEntry[] = [];
  let step = 1;
  const applyCaps = options?.applyFlatTaxSegments !== false;
  const withCaps = bucketTaxableEarnings(earnings, profile, { applyExemptCaps: applyCaps });
  const buckets = absorbReduction(withCaps.buckets, reductions);
  const taxableIncome = roundRial(sum(Object.values(buckets).filter((v): v is number => typeof v === 'number')));
  const exemption = profile.tax.monthlyExemption;

  trace.push({
    step: step++,
    code: 'tax.base',
    title: 'درآمد مشمول مالیات',
    detail: `جمع اقلام مشمول پس از کسر کسورات کارکرد ${reductions.toLocaleString('en-US')} ریال محاسبه شد.`,
    value: taxableIncome,
    legalRef: 'ماده ۸۳ و ۸۴ قانون مالیات‌های مستقیم',
  });

  const brackets: TaxBracketResult[] = [];
  const flatSegments: TaxComputation['flatSegments'] = [];
  let totalTax = 0;

  const flatSegmentRules = options?.applyFlatTaxSegments === false ? [] : profile.tax.flatSegments;
  const flatCategories = new Set<TaxCategory>(flatSegmentRules.flatMap((rule) => rule.categories));
  const flatIncome = roundRial(
    [...flatCategories].reduce<number>((acc, category) => acc + (buckets[category] ?? 0), 0),
  );
  const regularIncome = Math.max(0, taxableIncome - flatIncome);

  if (flatSegmentRules.length > 0 && flatIncome > 0) {
    // Proportional distribution of the exemption ceiling (به‌تناسب اقلام).
    let remainingExemption = Math.min(exemption, taxableIncome);
    const ratio = taxableIncome > 0 ? flatIncome / taxableIncome : 0;
    const flatExempt = Math.min(flatIncome, roundRial(exemption * ratio));
    remainingExemption -= flatExempt;
    const regularExempt = Math.min(regularIncome, remainingExemption);
    const flatTaxable = Math.max(0, flatIncome - flatExempt);
    const regularTaxable = Math.max(0, regularIncome - regularExempt);

    trace.push({
      step: step++,
      code: 'tax.exemption-share',
      title: 'توزیع سقف معافیت',
      detail: `از سقف معافیت ${exemption.toLocaleString('en-US')} ریال، ${(flatExempt + regularExempt).toLocaleString('en-US')} ریال مصرف شد (مزایای رفاهی: ${flatExempt.toLocaleString('en-US')} ریال).`,
      value: flatExempt + regularExempt,
      legalRef: 'بند (ز) تبصره ۱ قانون بودجه — توزیع متناسب معافیت',
    });

    const progressive = applyProgressiveBrackets(regularTaxable, profile.tax.brackets, profile.tax.monthlyExemption);
    brackets.push(...progressive.brackets);
    totalTax += progressive.total;

    for (const rule of flatSegmentRules) {
      const taxableInSegment = flatTaxable;
      if (taxableInSegment <= 0) continue;
      const segmentTax = roundRial(taxableInSegment * rule.rate);
      flatSegments.push({ key: 'refah-engizehi', amount: taxableInSegment, rate: rule.rate, tax: segmentTax });
      totalTax += segmentTax;
      trace.push({
        step: step++,
        code: 'tax.flat',
        title: rule.label,
        detail: `${taxableInSegment.toLocaleString('en-US')} ریال مزایای رفاهی و انگیزشی با نرخ مقطوع ${(rule.rate * 100).toFixed(0)}٪ مشمول مالیات شد.`,
        value: segmentTax,
        formula: `${taxableInSegment.toLocaleString('en-US')} × ${rule.rate}`,
        legalRef: rule.legalRef,
      });
    }
  } else {
    const progressive = applyProgressiveBrackets(
      Math.max(0, taxableIncome - Math.min(exemption, taxableIncome)),
      profile.tax.brackets,
      exemption,
    );
    brackets.push(...progressive.brackets);
    totalTax += progressive.total;

    trace.push({
      step: step++,
      code: 'tax.exemption',
      title: 'کسر سقف معافیت مالیاتی',
      detail: `مبلغ ${Math.min(exemption, taxableIncome).toLocaleString('en-US')} ریال معافیت ماهانه از درآمد مشمول کسر شد.`,
      value: Math.min(exemption, taxableIncome),
      legalRef: 'قانون بودجه — سقف معافیت مالیاتی حقوق',
    });
  }

  for (const bracket of brackets) {
    if (bracket.taxableAmount <= 0 || bracket.rate === 0) continue;
    trace.push({
      step: step++,
      code: 'tax.bracket',
      title: `پله ${(bracket.rate * 100).toFixed(0)}٪`,
      detail: `مبلغ ${bracket.taxableAmount.toLocaleString('en-US')} ریال در این پله قرار گرفت.`,
      value: bracket.tax,
      formula: `${bracket.taxableAmount.toLocaleString('en-US')} × ${bracket.rate}`,
      legalRef: 'ماده ۸۵ قانون مالیات‌های مستقیم',
    });
  }

  const extraTaxable = options?.extraTaxableIncome ?? 0;
  if (extraTaxable > 0) {
    // The extra income continues from the current marginal position: the
    // remaining exemption is consumed first (first bracket has a 0% rate).
    const extra = applyProgressiveBrackets(extraTaxable, profile.tax.brackets, taxableIncome);
    totalTax += extra.total;
    trace.push({
      step: step++,
      code: 'tax.extra-income',
      title: 'درآمد مشمول دیگر این ماه',
      detail: `مبلغ ${extraTaxable.toLocaleString('en-US')} ریال درآمد دیگر (مانند معوقه یا کارفرمای دوم) با نرخ پلکانی مشمول شد.`,
      value: extra.total,
      legalRef: 'ماده ۸۵ قانون مالیات‌های مستقیم',
    });
  }

  if (typeof options?.manualTax === 'number') {
    totalTax = roundRial(options.manualTax);
    trace.push({
      step: step++,
      code: 'tax.manual',
      title: 'مالیات دستی',
      detail: 'مالیات این کارمند به‌صورت دستی توسط کاربر ثبت شده است.',
      value: totalTax,
    });
  }

  const taxTotal = Math.max(0, roundRial(totalTax));
  const tax: TaxComputation = {
    taxableIncome,
    exemption,
    afterExemption: Math.max(0, taxableIncome - Math.min(exemption, taxableIncome)),
    brackets,
    flatTax: roundRial(sum(flatSegments.map((segment) => segment.tax))),
    flatSegments,
    total: taxTotal,
    effectiveRate: taxableIncome > 0 ? Math.round((taxTotal / taxableIncome) * 10000) / 10000 : 0,
  };

  trace.push({
    step: step++,
    code: 'tax.total',
    title: 'جمع مالیات بر درآمد',
    detail: 'مالیات قابل کسر از فیش این ماه نهایی شد.',
    value: taxTotal,
    legalRef: 'ماده ۸۶ قانون مالیات‌های مستقیم — کسر توسط کارفرما',
  });

  return { tax, trace };
}

/** Component keys that were subject to tax in a result — used by reports. */
export function taxableComponentKeys(
  earnings: readonly PayrollLineItem[],
  profile: LegalProfile,
): ComponentKey[] {
  return earnings
    .filter((line) => profile.components[line.key as keyof typeof profile.components]?.taxable)
    .map((line) => line.key);
}
