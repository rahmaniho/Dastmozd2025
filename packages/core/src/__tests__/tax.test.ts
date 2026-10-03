import { describe, expect, it } from 'vitest';
import { PROFILE_1404, PROFILE_1405 } from '@dastmozd/legal';
import {
  absorbReduction,
  applyProgressiveBrackets,
  bucketTaxableEarnings,
  computeTax,
} from '../engine/tax';
import { earningLine } from '../engine/earnings';

describe('محاسبه مالیات پلکانی', () => {
  it('درآمد زیر سقف معافیت مالیات ندارد', () => {
    // درآمد ۱۰۰ میلیون ریالی که تمام آن زیر سقف معافیت است، مالیات ندارد.
    const result = applyProgressiveBrackets(100_000_000, PROFILE_1405.tax.brackets);
    expect(result.total).toBe(0);
    expect(applyProgressiveBrackets(0, PROFILE_1405.tax.brackets, 400_000_000).total).toBe(0);
  });

  it('پله‌های مالیات ۱۴۰۵ به‌درستی پیمایش می‌شوند', () => {
    // ۴۰۰ میلیون معاف، ۴۰۰ میلیون بعدی ۱۰٪، ۲۰۰ میلیون بعدی ۱۵٪
    // ۱٬۰۵۲ میلیون درآمد، ۴۰۰ میلیون معاف ⇒ ۶۵۲ میلیون مشمول از پله ۱۰٪ آغاز می‌شود.
    const result = applyProgressiveBrackets(652_000_000, PROFILE_1405.tax.brackets, 400_000_000);
    expect(result.total).toBe(80_400_000);
    const taxableParts = result.brackets.filter((bracket) => bracket.taxableAmount > 0);
    expect(taxableParts).toHaveLength(3);
    expect(taxableParts[0]?.taxableAmount).toBe(400_000_000);
    expect(taxableParts[1]?.taxableAmount).toBe(200_000_000);
    expect(taxableParts[2]?.taxableAmount).toBe(52_000_000);
  });

  it('بالاترین پله روی مازاد اعمال می‌شود', () => {
    const result = applyProgressiveBrackets(1_600_000_000, PROFILE_1405.tax.brackets, 400_000_000);
    // ۴۰۰×۱۰٪ + ۲۰۰×۱۵٪ + ۲۰۰×۲۰٪ + ۲۰۰×۲۵٪ + ۶۰۰×۳۰٪
    expect(result.total).toBe(40_000_000 + 30_000_000 + 40_000_000 + 50_000_000 + 180_000_000);
  });
});

describe('طبقه‌بندی اقلام مشمول مالیات', () => {
  it('اقلام بر پایه دسته قانونی دسته‌بندی می‌شوند', () => {
    const earnings = [
      earningLine(PROFILE_1405, 'base-wage', 100_000_000),
      earningLine(PROFILE_1405, 'housing', 30_000_000),
      earningLine(PROFILE_1405, 'overtime', 10_000_000),
      earningLine(PROFILE_1405, 'severance', 50_000_000),
    ];
    const { buckets, taxableIncome } = bucketTaxableEarnings(earnings, PROFILE_1405);
    expect(taxableIncome).toBe(140_000_000);
    expect(buckets.wage).toBe(100_000_000);
    expect(buckets.benefit).toBe(30_000_000);
    expect(buckets.performance).toBe(10_000_000);
    expect(buckets.exempt).toBeUndefined();
  });

  it('سقف معافیت عیدی اعمال می‌شود', () => {
    const earnings = [earningLine(PROFILE_1405, 'eidi', 600_000_000)];
    const { taxableIncome, cappedExempt } = bucketTaxableEarnings(earnings, PROFILE_1405);
    expect(cappedExempt).toBe(400_000_000);
    expect(taxableIncome).toBe(200_000_000);
  });

  it('کسورات کارکرد از طبقه مزد کسر می‌شود', () => {
    const buckets = absorbReduction({ wage: 100_000_000, benefit: 30_000_000 }, 20_000_000);
    expect(buckets.wage).toBe(80_000_000);
    expect(absorbReduction({ wage: 10_000_000, benefit: 30_000_000 }, 20_000_000)).toEqual({
      wage: 0,
      benefit: 20_000_000,
    });
    expect(absorbReduction({ wage: 0, benefit: 0 }, 5_000)).toEqual({ wage: 0, benefit: 0 });
  });
});

describe('محاسبه کامل مالیات ماهانه', () => {
  it('برای سال ۱۴۰۵ همه اقلام با جدول پلکانی مشمول می‌شوند', () => {
    const earnings = [
      earningLine(PROFILE_1405, 'base-wage', 166_255_500),
      earningLine(PROFILE_1405, 'housing', 30_000_000),
      earningLine(PROFILE_1405, 'grocery', 22_000_000),
    ];
    const { tax, trace } = computeTax({ profile: PROFILE_1405, earnings, reductions: 0 });
    expect(tax.taxableIncome).toBe(218_255_500);
    expect(tax.total).toBe(0);
    expect(tax.flatSegments).toHaveLength(0);
    expect(trace.length).toBeGreaterThanOrEqual(3);
    expect(trace[0]?.code).toBe('tax.base');
  });

  it('برای سال ۱۴۰۴ مزایای رفاهی با نرخ مقطوع ۱۰٪ مشمول می‌شوند', () => {
    const earnings = [
      earningLine(PROFILE_1404, 'base-wage', 300_000_000),
      earningLine(PROFILE_1404, 'housing', 9_000_000),
      earningLine(PROFILE_1404, 'grocery', 22_000_000),
      earningLine(PROFILE_1404, 'marriage', 5_000_000),
      earningLine(PROFILE_1404, 'child-allowance', 10_390_968),
    ];
    const { tax } = computeTax({ profile: PROFILE_1404, earnings, reductions: 0 });
    expect(tax.taxableIncome).toBe(346_390_968);
    expect(tax.flatSegments[0]?.amount).toBe(14_248_582);
    expect(tax.flatTax).toBe(1_424_858);
    expect(tax.total).toBe(12_246_216);
  });

  it('می‌توان محاسبه مالیات را غیرفعال یا دستی جایگزین کرد', () => {
    const earnings = [earningLine(PROFILE_1405, 'base-wage', 900_000_000)];
    const disabled = computeTax({
      profile: PROFILE_1405,
      earnings,
      reductions: 0,
      options: { applyFlatTaxSegments: false, manualTax: 0 },
    });
    expect(disabled.tax.total).toBe(0);
    const manual = computeTax({
      profile: PROFILE_1405,
      earnings,
      reductions: 0,
      options: { manualTax: 12_345_678 },
    });
    expect(manual.tax.total).toBe(12_345_678);
    expect(manual.trace.some((entry) => entry.code === 'tax.manual')).toBe(true);
  });

  it('درآمد اضافی این ماه با نرخ پلکانی محاسبه می‌شود', () => {
    const earnings = [earningLine(PROFILE_1405, 'base-wage', 400_000_000)];
    const { tax } = computeTax({
      profile: PROFILE_1405,
      earnings,
      reductions: 0,
      options: { extraTaxableIncome: 100_000_000 },
    });
    // ۱۰۰ میلیون مازاد پس از مصرف کامل سقف معافیت، در پله ۱۰٪ قرار می‌گیرد.
    expect(tax.total).toBe(10_000_000);
  });
});
