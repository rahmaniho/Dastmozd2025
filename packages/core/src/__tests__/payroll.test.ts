import { describe, expect, it } from 'vitest';
import { PROFILE_1404, PROFILE_1405 } from '@dastmozd/legal';
import { calculatePayroll, calculatePayrollBatch } from '../engine/payroll';
import { emptyAttendance } from '../engine/types';
import { employee, grossOf, input, PERIOD_1405_07 } from './fixtures';

/**
 * سناریوهای مرجع (golden scenarios) — همه ارقام با محاسبه دستی کنترل شده‌اند و
 * باید تا ریال با فیش واقعی مطابقت داشته باشند.
 */
describe('سناریو مرجع ۱: کارگر مجرد با حداقل مزد ۱۴۰۵', () => {
  const result = calculatePayroll(input());

  it('مزایای ثابت قانونی به‌درستی محاسبه می‌شود', () => {
    const keys = result.earnings.map((line) => line.key);
    expect(keys).toEqual(['base-wage', 'seniority', 'housing', 'grocery']);
    expect(result.earnings[0]?.amount).toBe(166_255_500);
    expect(result.earnings[1]?.amount).toBe(5_000_000);
    expect(result.earnings[2]?.amount).toBe(30_000_000);
    expect(result.earnings[3]?.amount).toBe(22_000_000);
    expect(result.totals.grossEarnings).toBe(223_255_500);
  });

  it('مزد روزانه و ساعتی بر پایه ماده ۴۷ قانون کار محاسبه می‌شود', () => {
    expect(result.rates.dailyWage).toBe(5_541_850);
    expect(result.rates.hourlyWage).toBe(755_707);
    expect(result.rates.overtimeHourly).toBe(1_057_990);
  });

  it('بیمه سهم کارمند ۷٪ و مالیات صفر است', () => {
    expect(result.insurance.base).toBe(223_255_500);
    expect(result.insurance.employeeShare).toBe(15_627_885);
    expect(result.tax.total).toBe(0);
    expect(result.totals.netPay).toBe(207_627_615);
    expect(result.totals.payableAmount).toBe(207_627_615);
  });

  it('هزینه کارفرما شامل ۲۳٪ بیمه است', () => {
    expect(result.employerCost.employerInsurance).toBe(51_348_765);
    expect(result.employerCost.total).toBe(274_604_265);
  });

  it('مسیر محاسبه کامل و مرتب ثبت می‌شود', () => {
    expect(result.trace.length).toBeGreaterThan(8);
    const steps = result.trace.map((entry) => entry.step);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(result.trace.some((entry) => entry.code === 'totals.net')).toBe(true);
    expect(result.trace.some((entry) => entry.code === 'insurance.base')).toBe(true);
    expect(result.verificationCode).toMatch(/^DM-1405-07-[0-9A-F]{8}$/);
    expect(result.meta.legalProfileYear).toBe(1405);
    expect(result.meta.engineVersion).toBe('1.0.0');
    expect(result.warnings).toEqual([]);
  });
});

describe('سناریو مرجع ۲: کارگر متأهل با دو فرزند و پایه سنوات', () => {
  const result = calculatePayroll(
    input({
      employee: employee({ maritalStatus: 'married', childCount: 2 }),
    }),
  );

  it('حق تأهل و حق اولاد افزوده می‌شود', () => {
    const childLine = result.earnings.find((line) => line.key === 'child-allowance');
    const marriageLine = result.earnings.find((line) => line.key === 'marriage');
    expect(marriageLine?.amount).toBe(5_000_000);
    expect(childLine?.amount).toBe(33_251_100);
    expect(result.totals.grossEarnings).toBe(261_506_600);
  });

  it('حق اولاد مشمول کسر حق بیمه نیست', () => {
    expect(result.insurance.rawBase).toBe(228_255_500);
    expect(result.insurance.employeeShare).toBe(15_977_885);
    expect(result.insurance.excluded).toContain('child-allowance');
  });

  it('خالص پرداختی درست است', () => {
    expect(result.totals.netPay).toBe(245_528_715);
  });
});

describe('سناریو مرجع ۳: اضافه‌کار، شب‌کاری و تعطیل‌کاری ۱۴۰۵', () => {
  const result = calculatePayroll(
    input({
      employee: employee({ maritalStatus: 'married' }),
      attendance: {
        ...emptyAttendance(30),
        overtimeHours: 10,
        nightHours: 6,
        nightOvertimeHours: 0,
        holidayHours: 8,
        holidayOvertimeHours: 0,
        regularHours: 176,
      },
    }),
  );

  it('ضرایب ۱٫۴ و ۱٫۳۵ روی مزد ساعتی اعمال می‌شود', () => {
    const overtime = result.earnings.find((line) => line.key === 'overtime');
    const night = result.earnings.find((line) => line.key === 'night-work');
    const holiday = result.earnings.find((line) => line.key === 'holiday-work');
    expect(overtime?.amount).toBe(10_579_898);
    expect(night?.amount).toBe(6_121_227);
    expect(holiday?.amount).toBe(8_463_918);
    expect(overtime?.coefficient).toBe(1.4);
    expect(night?.coefficient).toBe(1.35);
    expect(holiday?.coefficient).toBe(1.4);
  });

  it('جمع مزایا، بیمه و خالص پرداختی مطابق محاسبه دستی است', () => {
    expect(result.totals.grossEarnings).toBe(253_420_543);
    expect(result.insurance.employeeShare).toBe(17_739_438);
    expect(result.tax.total).toBe(0);
    expect(result.totals.netPay).toBe(235_681_105);
  });

  it('هشدار اضافه‌کاری بیش از ۴۰ ساعت صادر می‌شود', () => {
    const heavy = calculatePayroll(
      input({
        attendance: { ...emptyAttendance(30), overtimeHours: 52 },
      }),
    );
    expect(heavy.warnings.some((warning) => warning.code === 'OVERTIME_OVER_LIMIT')).toBe(true);
  });
});

describe('سناریو مرجع ۴: کارمند با حقوق بالاتر و مشمول مالیات پلکانی ۱۴۰۵', () => {
  const result = calculatePayroll(
    input({
      employee: employee({ wage: { baseMonthly: 1_000_000_000, seniorityMonthly: 0 } }),
    }),
  );

  it('جمع مزایا و مبنای بیمه درست است', () => {
    expect(result.totals.grossEarnings).toBe(1_052_000_000);
    expect(result.insurance.base).toBe(1_052_000_000);
    expect(result.insurance.employeeShare).toBe(73_640_000);
  });

  it('مالیات پلکانی ۸۰٬۴۰۰٬۰۰۰ ریال محاسبه می‌شود', () => {
    expect(result.tax.total).toBe(80_400_000);
    expect(result.tax.brackets.filter((bracket) => bracket.tax > 0)).toHaveLength(3);
    expect(result.tax.effectiveRate).toBeCloseTo(0.0764, 4);
    expect(result.totals.netPay).toBe(897_960_000);
  });
});

describe('سناریو مرجع ۵: بازسازی محاسبه سال ۱۴۰۴ با نرخ مقطوع ۱۰٪', () => {
  const result = calculatePayroll(
    input({
      profile: PROFILE_1404,
      period: { jy: 1404, jm: 7, days: 30 },
      employee: employee({
        maritalStatus: 'married',
        childCount: 1,
        wage: { baseMonthly: 300_000_000, seniorityMonthly: 2_820_000 },
      }),
    }),
  );

  it('اجزای حقوق ۱۴۰۴ با مصوبه مطابقت دارد', () => {
    expect(result.earnings.find((line) => line.key === 'housing')?.amount).toBe(9_000_000);
    expect(result.earnings.find((line) => line.key === 'grocery')?.amount).toBe(22_000_000);
    expect(result.earnings.find((line) => line.key === 'child-allowance')?.amount).toBe(10_390_968);
    expect(result.earnings.find((line) => line.key === 'seniority')?.amount).toBe(2_820_000);
  });

  it('مالیات مقطوع و پلکانی ۱۴۰۴ طبق محاسبه دستی است', () => {
    expect(result.totals.grossEarnings).toBe(349_210_968);
    expect(result.tax.flatTax).toBe(1_450_814);
    expect(result.tax.total).toBe(12_656_238);
  });

  it('بیمه سهم کارمند بر پایه صحیح محاسبه می‌شود', () => {
    expect(result.insurance.base).toBe(338_820_000);
    expect(result.insurance.employeeShare).toBe(23_717_400);
  });
});

describe('کسورات کارکرد و محدودیت‌ها', () => {
  it('مرخصی بدون حقوق و غیبت از مزد و مبنای بیمه کسر می‌شود', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
        attendance: { ...emptyAttendance(30), unpaidLeaveDays: 3 },
      }),
    );
    const reduction = result.deductions.find((line) => line.key === 'unpaid-leave-deduction');
    expect(reduction?.amount).toBe(16_625_550);
    expect(result.insurance.base).toBe(201_629_950);
    expect(result.insurance.employeeShare).toBe(14_114_097);
    expect(result.totals.totalDeductions).toBe(30_739_647);
    expect(result.totals.netPay).toBe(187_515_853);
  });

  it('کسر غیبت با هشدار همراه است و مبنای بیمه را کاهش می‌دهد', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
        attendance: { ...emptyAttendance(30), absenceDays: 5 },
      }),
    );
    expect(result.deductions[0]?.key).toBe('absence-deduction');
    expect(result.deductions[0]?.reducesBase).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'BELOW_MINIMUM_WAGE')).toBe(true);
    expect(result.insurance.base).toBe(190_546_250);
  });

  it('مبنا به سقف بیمه محدود و هشدار صادر می‌شود', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ wage: { baseMonthly: 1_500_000_000, seniorityMonthly: 0 } }),
      }),
    );
    expect(result.insurance.rawBase).toBeGreaterThan(PROFILE_1405.insurance.ceiling);
    expect(result.insurance.base).toBe(PROFILE_1405.insurance.ceiling);
    expect(result.insurance.employeeShare).toBe(81_465_195);
    expect(result.insurance.employerShare).toBe(267_671_355);
    expect(result.warnings.some((warning) => warning.code === 'INSURANCE_CEILING_EXCEEDED')).toBe(
      true,
    );
  });

  it('بیمه و مالیات با تنظیمات قابل غیرفعال شدن است', () => {
    const result = calculatePayroll(
      input({ options: { insuranceEnabled: false, taxEnabled: false } }),
    );
    expect(result.insurance.employeeShare).toBe(0);
    expect(result.tax.total).toBe(0);
    expect(result.totals.netPay).toBe(result.totals.grossEarnings);
  });

  it('کسورات داوطلبانه و اقساط وام در فیش لحاظ می‌شود', () => {
    const result = calculatePayroll(
      input({
        deductions: [
          { key: 'loan', amount: 20_000_000, title: 'قسط وام مسکن' },
          { key: 'advance', amount: 5_000_000 },
          { key: 'supplementary-insurance', amount: 3_000_000 },
        ],
      }),
    );
    const keys = result.deductions.map((line) => line.key);
    expect(keys).toContain('loan');
    expect(keys).toContain('advance');
    expect(keys).toContain('supplementary-insurance');
    expect(result.totals.otherDeductions).toBe(28_000_000);
    expect(result.totals.netPay).toBe(223_255_500 - 28_000_000 - 15_627_885);
  });

  it('جریمه تأخیر طبق تنظیمات کارگاه کسر می‌شود', () => {
    const result = calculatePayroll(
      input({
        attendance: { ...emptyAttendance(30), lateMinutes: 90, earlyLeaveMinutes: 30 },
        options: { latePenaltyPerMinute: 5_000 },
      }),
    );
    const penalty = result.deductions.find((line) => line.key === 'penalty');
    expect(penalty?.amount).toBe(600_000);
  });

  it('پرداخت مزایای ثابت قابل تناسب‌سازی با روزهای کارکرد است', () => {
    const result = calculatePayroll(
      input({
        attendance: { ...emptyAttendance(30), unpaidLeaveDays: 15 },
        options: { prorateBenefits: true },
      }),
    );
    expect(result.earnings.find((line) => line.key === 'housing')?.amount).toBe(15_000_000);
    expect(result.earnings.find((line) => line.key === 'grocery')?.amount).toBe(11_000_000);
  });
});

describe('پایه سنوات و سابقه کار', () => {
  it('کارمند با کمتر از یک سال سابقه پایه سنوات نمی‌گیرد', () => {
    const result = calculatePayroll(
      input({
        employee: employee({ hireDate: { jy: 1405, jm: 3, jd: 1 } }),
      }),
    );
    expect(result.earnings.some((line) => line.key === 'seniority')).toBe(false);
    expect(result.warnings.some((warning) => warning.code === 'SENIORITY_NOT_ELIGIBLE')).toBe(true);
  });

  it('پایه سنوات با فعال‌سازی دستی حتی بدون شرط سابقه پرداخت می‌شود', () => {
    const result = calculatePayroll(
      input({
        employee: employee({
          hireDate: { jy: 1405, jm: 3, jd: 1 },
          wage: { baseMonthly: 166_255_500, seniorityMonthly: 5_000_000, seniorityEligible: true },
        }),
      }),
    );
    expect(result.earnings.some((line) => line.key === 'seniority')).toBe(true);
  });

  it('تعداد فرزندان به سقف قانونی چهار فرزند محدود می‌شود', () => {
    const result = calculatePayroll(
      input({ employee: employee({ maritalStatus: 'married', childCount: 6 }) }),
    );
    const childLine = result.earnings.find((line) => line.key === 'child-allowance');
    expect(childLine?.quantity).toBe(4);
    expect(result.warnings.some((warning) => warning.code === 'CHILD_COUNT_CAPPED')).toBe(true);
  });
});

describe('مزایای متغیر و مأموریت', () => {
  it('پاداش، کارانه، ایاب و ذهاب و حق غذا در فیش لحاظ می‌شود', () => {
    const result = calculatePayroll(
      input({
        earnings: [
          { key: 'bonus', amount: 50_000_000, title: 'پاداش عملکرد' },
          { key: 'transport', amount: 8_000_000 },
          { key: 'food', amount: 12_000_000 },
          { key: 'mission', amount: 4_000_000 },
        ],
      }),
    );
    expect(result.earnings).toHaveLength(8);
    // ایاب و ذهاب، حق غذا و مأموریت معاف از بیمه و مالیات هستند.
    expect(result.insurance.rawBase).toBe(223_255_500 + 50_000_000);
    expect(result.tax.taxableIncome).toBe(273_255_500);
  });

  it('حق مأموریت ساعتی و نوبت‌کاری محاسبه می‌شود', () => {
    const result = calculatePayroll(
      input({
        attendance: {
          ...emptyAttendance(30),
          missionDays: 2,
          missionHours: 16,
          shiftHours: { night: 40, rotating: 20 },
        },
        options: { missionHourlyRate: 200_000 },
      }),
    );
    expect(result.earnings.find((line) => line.key === 'mission')?.amount).toBe(3_200_000);
    const shiftLines = result.earnings.filter((line) => line.key === 'shift-work');
    expect(shiftLines).toHaveLength(2);
    expect(shiftLines[0]?.amount).toBe(4_534_242);
    expect(shiftLines[1]?.amount).toBe(3_400_682);
  });
});

describe('محاسبه گروهی حقوق', () => {
  it('جمع کل کارکنان و پیشرفت محاسبه گزارش می‌شود', () => {
    const employees = [
      input({ employee: employee({ id: 'emp-1', fullName: 'الف' }) }),
      input({
        employee: employee({ id: 'emp-2', fullName: 'ب', maritalStatus: 'married', childCount: 1 }),
      }),
      input({
        employee: employee({
          id: 'emp-3',
          fullName: 'ج',
          wage: { baseMonthly: 500_000_000, seniorityMonthly: 0 },
        }),
      }),
    ];
    const progress: number[] = [];
    const batch = calculatePayrollBatch({
      employees,
      onProgress: (done) => progress.push(done),
    });
    expect(batch.results).toHaveLength(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(batch.totals.employeeCount).toBe(3);
    expect(batch.totals.grossEarnings).toBe(
      batch.results.reduce((total, result) => total + result.totals.grossEarnings, 0),
    );
    expect(batch.totals.netPay).toBe(
      batch.results.reduce((total, result) => total + result.totals.netPay, 0),
    );
    expect(batch.totals.employerCost).toBeGreaterThan(batch.totals.netPay);
  });

  it('محاسبه برای ماه ۳۱ روزه یک روز مزد بیشتر پرداخت می‌کند', () => {
    const result = calculatePayroll(
      input({
        period: { jy: 1405, jm: 1, days: 31 },
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
      }),
    );
    expect(result.earnings[0]?.quantity).toBe(31);
    expect(result.earnings[0]?.amount).toBe(171_797_350);
  });

  it('برای اسفند ۲۹ روزه مزد کامل ماهانه پرداخت می‌شود', () => {
    const result = calculatePayroll(
      input({
        period: { jy: 1405, jm: 12, days: 29 },
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
      }),
    );
    expect(result.earnings[0]?.quantity).toBe(30);
    expect(result.earnings[0]?.amount).toBe(166_255_500);
  });

  it('کارکرد ناقص با «کسر عدم کارکرد» پوشش داده می‌شود', () => {
    const result = calculatePayroll(
      input({
        period: PERIOD_1405_07,
        employee: employee({ wage: { baseMonthly: 166_255_500, seniorityMonthly: 0 } }),
        attendance: { ...emptyAttendance(30), nonPayableDays: 10 },
      }),
    );
    const line = result.deductions.find((item) => item.title.includes('عدم کارکرد'));
    expect(line?.amount).toBe(55_418_500);
    expect(grossOf(result.earnings)).toBe(218_255_500);
  });
});
