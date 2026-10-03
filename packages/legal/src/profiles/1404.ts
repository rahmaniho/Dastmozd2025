import { buildComponents, DEFAULT_COMPONENTS } from '../components';
import type { LegalProfile } from '../types';

/**
 * پروفایل حقوقی سال ۱۴۰۴
 * ---------------------------------------------------------------
 * مبنای ارقام: مصوبه شورای عالی کار (اسفند ۱۴۰۳) و قانون بودجه ۱۴۰۴.
 *  - حداقل مزد روزانه ۳٬۴۶۳٬۶۵۶ ریال (۴۵٪ افزایش) و ماهانه ۱۰۳٬۹۰۹٬۶۸۰ ریال
 *  - حق مسکن ۹٬۰۰۰٬۰۰۰ ریال (بدون تغییر)، بن کارگری ۲۲٬۰۰۰٬۰۰۰ ریال
 *  - پایه سنوات روزانه ۹۴٬۰۰۰ ریال، حق اولاد ۳ روز حداقل مزد (۱۰٬۳۹۰٬۹۶۸ ریال)
 *  - سقف معافیت مالیاتی ماهانه ۲۴۰٬۰۰۰٬۰۰۰ ریال (۲۴ میلیون تومان)
 *  - مالیات مقطوع ۱۰٪ برای مزایای رفاهی، انگیزشی و تبعی
 */
export const PROFILE_1404: LegalProfile = {
  year: 1404,
  label: '۱۴۰۴',
  description:
    'مصوبه شورای عالی کار اسفند ۱۴۰۳ و قانون بودجه ۱۴۰۴؛ حداقل مزد روزانه ۳٬۴۶۳٬۶۵۶ ریال، حق مسکن ۹٬۰۰۰٬۰۰۰ ریال و سقف معافیت مالیاتی ماهانه ۲۴۰٬۰۰۰٬۰۰۰ ریال با نرخ مقطوع ۱۰٪ برای مزایای رفاهی.',
  verified: true,
  sources: [
    {
      title: 'مصوبه شورای عالی کار در مورد تعیین حداقل مزد سال ۱۴۰۴',
      issuer: 'شورای عالی کار',
      reference: 'اسفند ۱۴۰۳',
      note: 'حداقل مزد روزانه ۳٬۴۶۳٬۶۵۶ ریال، پایه سنوات روزانه ۹۴٬۰۰۰ ریال، حق اولاد ۳ روز مزد روزانه.',
    },
    {
      title: 'قانون بودجه سال ۱۴۰۴ کل کشور',
      issuer: 'سازمان برنامه و بودجه کشور',
      note: 'سقف معافیت مالیاتی سالانه ۲٬۸۸۰٬۰۰۰٬۰۰۰ ریال و مالیات مقطوع ۱۰٪ مزایای رفاهی و انگیزشی.',
    },
    {
      title: 'بخشنامه سازمان امور مالیاتی درباره مالیات بر درآمد حقوق ۱۴۰۴',
      issuer: 'سازمان امور مالیاتی کشور',
      note: 'جدول پلکانی و نحوه اعمال معافیت ماهانه.',
    },
  ],

  minDailyWage: 3_463_656,
  minMonthlyWage: 103_909_680,
  housingAllowanceMonthly: 9_000_000,
  groceryAllowanceMonthly: 22_000_000,
  marriageAllowanceMonthly: 5_000_000,
  childAllowanceDayMultiplier: 3,
  childAllowanceDaily: 3_463_656 * 3,
  maxChildren: 4,
  childAllowanceAgeLimit: 18,
  seniorityDaily: 94_000,
  seniorityMonthly: 2_820_000,

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
    ceiling: 7 * 103_909_680,
    note: 'سقف مبنای کسر حق بیمه ۷ برابر حداقل مزد ماهانه (۷۲۷٬۳۶۷٬۷۶۰ ریال).',
  },

  tax: {
    monthlyExemption: 240_000_000,
    annualExemption: 2_880_000_000,
    eidiExemptionCap: 240_000_000,
    flatSegments: [
      {
        rate: 0.1,
        categories: ['benefit', 'performance'],
        label: 'مالیات مقطوع ۱۰٪ مزایای رفاهی، انگیزشی و تبعی',
        legalRef: 'بند (ز) تبصره ۱ قانون بودجه ۱۴۰۴',
      },
    ],
    brackets: [
      { upTo: 240_000_000, rate: 0, label: 'تا ۲۴ میلیون تومان — معاف' },
      { upTo: 300_000_000, rate: 0.1, label: 'مازاد ۲۴ تا ۳۰ میلیون تومان — ۱۰٪' },
      { upTo: 350_000_000, rate: 0.15, label: 'مازاد ۳۰ تا ۳۵ میلیون تومان — ۱۵٪' },
      { upTo: 400_000_000, rate: 0.2, label: 'مازاد ۳۵ تا ۴۰ میلیون تومان — ۲۰٪' },
      { upTo: 500_000_000, rate: 0.25, label: 'مازاد ۴۰ تا ۵۰ میلیون تومان — ۲۵٪' },
      { upTo: null, rate: 0.3, label: 'مازاد بر ۵۰ میلیون تومان — ۳۰٪' },
    ],
    note: 'طبق قانون بودجه ۱۴۰۴ مزایای رفاهی، انگیزشی و تبعی پس از مصرف سقف معافیت با نرخ مقطوع ۱۰٪ مشمول مالیات هستند.',
  },

  eidi: {
    minMultiplier: 2,
    maxMultiplier: 3,
    proRatePerMonthFraction: 1 / 12,
    note: 'عیدی بین دو تا سه برابر حداقل مزد ماهانه؛ معافیت مالیاتی تا یک‌دوازدهم سقف معافیت سالانه.',
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
      taxExemptMonthlyCap: 240_000_000,
      note: 'عیدی تا سقف ۲۴۰٬۰۰۰٬۰۰۰ ریال معاف از مالیات است.',
    },
  }),
};
