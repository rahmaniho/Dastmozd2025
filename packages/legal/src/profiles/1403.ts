import { buildComponents, DEFAULT_COMPONENTS } from '../components';
import type { LegalProfile } from '../types';

/**
 * پروفایل حقوقی سال ۱۴۰۳
 * ---------------------------------------------------------------
 * مبنای ارقام: مصوبه شورای عالی کار (اسفند ۱۴۰۲) و قانون بودجه ۱۴۰۳.
 *  - حداقل مزد روزانه ۲٬۳۸۸٬۷۲۸ ریال (۳۵٫۳٪ افزایش)
 *  - حق مسکن ۹٬۰۰۰٬۰۰۰ ریال، بن کارگری ۱۴٬۰۰۰٬۰۰۰ ریال، حق تأهل ۵٬۰۰۰٬۰۰۰ ریال
 *  - پایه سنوات روزانه ۷۰٬۰۰۰ ریال، حق اولاد ۷٬۱۶۶٬۱۸۴ ریال
 *  - سقف معافیت مالیاتی ماهانه ۱۲۰٬۰۰۰٬۰۰۰ ریال (۱۲ میلیون تومان)
 *
 * ⚠️ این پروفایل برای محاسبات آرشیوی و مقایسه‌ای نگه‌داری می‌شود. جداول مالیاتی
 * سال ۱۴۰۳ بر پایه قانون بودجه همان سال بازسازی شده است؛ پیش از استفاده رسمی،
 * ارقام را با بخشنامه سازمان امور مالیاتی تطبیق دهید. وضعیت `verified` برای
 * همین منظور `false` است و در رابط کاربری هشدار نمایش داده می‌شود.
 */
export const PROFILE_1403: LegalProfile = {
  year: 1403,
  label: '۱۴۰۳',
  description:
    'مصوبه شورای عالی کار اسفند ۱۴۰۲؛ حداقل مزد روزانه ۲٬۳۸۸٬۷۲۸ ریال، حق مسکن ۹٬۰۰۰٬۰۰۰ ریال و سقف معافیت مالیاتی ماهانه ۱۲۰٬۰۰۰٬۰۰۰ ریال. برای آرشیو.',
  verified: false,
  sources: [
    {
      title: 'مصوبه شورای عالی کار در مورد تعیین حداقل مزد سال ۱۴۰۳',
      issuer: 'شورای عالی کار',
      reference: 'اسفند ۱۴۰۲',
      note: 'حداقل مزد روزانه ۲٬۳۸۸٬۷۲۸ ریال و پایه سنوات روزانه ۷۰٬۰۰۰ ریال.',
    },
    {
      title: 'قانون بودجه سال ۱۴۰۳ کل کشور',
      issuer: 'سازمان برنامه و بودجه کشور',
      note: 'سقف معافیت مالیاتی سالانه و نرخ مقطوع ۱۰٪ مزایای رفاهی و انگیزشی.',
    },
  ],

  minDailyWage: 2_388_728,
  minMonthlyWage: 71_661_840,
  housingAllowanceMonthly: 9_000_000,
  groceryAllowanceMonthly: 14_000_000,
  marriageAllowanceMonthly: 5_000_000,
  childAllowanceDayMultiplier: 3,
  childAllowanceDaily: 2_388_728 * 3,
  maxChildren: 4,
  childAllowanceAgeLimit: 18,
  seniorityDaily: 70_000,
  seniorityMonthly: 2_100_000,

  weeklyHours: 44,
  dailyHours: 44 / 6,
  monthlyHourDivisor: 220,
  monthlyDayDivisor: 30,

  overtimeCoefficient: 1.4,
  maxOvertimeHoursPerMonth: 40,
  holidayCoefficient: 1.4,
  holidayOvertimeCoefficient: 1.8,
  nightWorkAllowanceRate: 0.35,
  nightWindow: { from: '22:00', to: '06:00' },
  shiftWorkRules: [
    { kind: 'morning', rate: 0.1, title: 'نوبت صبح' },
    { kind: 'evening', rate: 0.1, title: 'نوبت عصر' },
    { kind: 'night', rate: 0.15, title: 'نوبت شب' },
    { kind: 'rotating', rate: 0.225, title: 'نوبت گردشی' },
  ],

  insurance: {
    employeeRate: 0.07,
    employerRate: 0.23,
    unemploymentRate: 0.03,
    ceilingMultiplier: 7,
    ceiling: 7 * 71_661_840,
    note: 'سقف مبنای کسر حق بیمه ۷ برابر حداقل مزد ماهانه (۵۰۱٬۶۳۲٬۸۸۰ ریال).',
  },

  tax: {
    monthlyExemption: 120_000_000,
    annualExemption: 1_440_000_000,
    eidiExemptionCap: 120_000_000,
    flatSegments: [
      {
        rate: 0.1,
        categories: ['benefit', 'performance'],
        label: 'مالیات مقطوع ۱۰٪ مزایای رفاهی، انگیزشی و تبعی',
        legalRef: 'قانون بودجه ۱۴۰۳ — مالیات بر درآمد حقوق',
      },
    ],
    brackets: [
      { upTo: 120_000_000, rate: 0, label: 'تا ۱۲ میلیون تومان — معاف' },
      { upTo: 165_000_000, rate: 0.1, label: 'مازاد ۱۲ تا ۱۶٫۵ میلیون تومان — ۱۰٪' },
      { upTo: 210_000_000, rate: 0.15, label: 'مازاد ۱۶٫۵ تا ۲۱ میلیون تومان — ۱۵٪' },
      { upTo: 255_000_000, rate: 0.2, label: 'مازاد ۲۱ تا ۲۵٫۵ میلیون تومان — ۲۰٪' },
      { upTo: null, rate: 0.3, label: 'مازاد بر ۲۵٫۵ میلیون تومان — ۳۰٪' },
    ],
    note: 'جدول بازسازی‌شده بر پایه قانون بودجه ۱۴۰۳؛ برای گزارش‌های رسمی با بخشنامه تطبیق شود.',
  },

  eidi: {
    minMultiplier: 2,
    maxMultiplier: 3,
    proRatePerMonthFraction: 1 / 12,
    note: 'عیدی حداقل دو برابر و حداکثر سه برابر حداقل مزد ماهانه.',
  },

  severance: {
    daysPerYear: 30,
    minWorkingDays: 30,
    note: 'حق سنوات معادل یک ماه آخرین مزد برای هر سال سابقه.',
  },

  leave: {
    annualPaidLeaveDays: 26,
    accrualAfterDays: 0,
    sickLeaveFirstDaysUnpaid: 3,
    encashable: true,
    note: 'مرخصی استحقاقی ۲۶ روز کاری در سال.',
  },

  components: buildComponents({
    ...DEFAULT_COMPONENTS,
    eidi: {
      ...DEFAULT_COMPONENTS.eidi,
      taxExemptMonthlyCap: 120_000_000,
      note: 'عیدی تا سقف ۱۲۰٬۰۰۰٬۰۰۰ ریال معاف از مالیات است.',
    },
  }),
};
