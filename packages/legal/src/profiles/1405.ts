import { buildComponents, DEFAULT_COMPONENTS } from '../components';
import type { LegalProfile } from '../types';

/**
 * پروفایل حقوقی سال ۱۴۰۵
 * ---------------------------------------------------------------
 * مبنای ارقام: مصوبه شورای عالی کار (جلسه ۲۴ اسفند ۱۴۰۴) و بخشنامه مزد ۱۴۰۵
 * وزارت تعاون، کار و رفاه اجتماعی، به‌همراه قانون بودجه ۱۴۰۵ کل کشور.
 *
 * نکات کلیدی سال ۱۴۰۵:
 *  - حداقل مزد روزانه: ۵٬۵۴۱٬۸۵۰ ریال (۱۶۶٬۲۵۵٬۵۰۰ ریال برای ماه ۳۰ روزه)
 *  - حق مسکن با جهش ۲۳۳ درصدی به ۳۰٬۰۰۰٬۰۰۰ ریال رسیده است.
 *  - بن کارگری بدون تغییر ۲۲٬۰۰۰٬۰۰۰ ریال و حق تأهل ۵٬۰۰۰٬۰۰۰ ریال است.
 *  - حق اولاد برابر ۳ روز حداقل مزد روزانه (۱۶٬۶۲۵٬۵۵۰ ریال) برای هر فرزند.
 *  - پایه سنوات ماهانه ۵٬۰۰۰٬۰۰۰ ریال (روزانه ۱۶۶٬۶۶۷ ریال).
 *  - سقف معافیت مالیاتی ماهانه ۴۰٬۰۰۰٬۰۰۰ تومان (۴۰۰٬۰۰۰٬۰۰۰ ریال).
 *  - بیمه سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ (شامل ۳٪ بیمه بیکاری).
 */
export const PROFILE_1405: LegalProfile = {
  year: 1405,
  label: '۱۴۰۵',
  description:
    'مصوبه شورای عالی کار اسفند ۱۴۰۴ و قانون بودجه ۱۴۰۵؛ حداقل مزد روزانه ۵٬۵۴۱٬۸۵۰ ریال، حق مسکن ۳۰٬۰۰۰٬۰۰۰ ریال و سقف معافیت مالیاتی ماهانه ۴۰۰٬۰۰۰٬۰۰۰ ریال.',
  verified: true,
  sources: [
    {
      title: 'مصوبه شورای عالی کار در مورد تعیین حداقل مزد سال ۱۴۰۵',
      issuer: 'شورای عالی کار',
      reference: 'جلسه ۲۴ اسفند ۱۴۰۴',
      note: 'حداقل مزد روزانه ۵٬۵۴۱٬۸۵۰ ریال؛ پایه سنوات روزانه ۱۶۶٬۶۶۷ ریال؛ حق مسکن ۳۰٬۰۰۰٬۰۰۰ ریال.',
    },
    {
      title: 'قانون بودجه سال ۱۴۰۵ کل کشور',
      issuer: 'سازمان برنامه و بودجه کشور',
      reference: 'تبصره مالیات بر درآمد حقوق',
      note: 'سقف معافیت مالیاتی ماهانه ۴۰۰٬۰۰۰٬۰۰۰ ریال (۴۰ میلیون تومان) و پله‌های ۱۰ تا ۳۰ درصد.',
    },
    {
      title: 'قانون تأمین اجتماعی — مواد ۳۹، ۵۵، ۵۶ و ۵۸',
      issuer: 'سازمان تأمین اجتماعی',
      note: 'نرخ‌های ۷٪ کارگر، ۲۰٪ کارفرما، ۳٪ بیمه بیکاری و ضرایب نوبت‌کاری و شب‌کاری.',
    },
    {
      title: 'قانون کار جمهوری اسلامی ایران',
      issuer: 'مجلس شورای اسلامی',
      reference: 'مواد ۴۱، ۵۱، ۵۶، ۵۸، ۵۹، ۶۱، ۶۴ و ۷۱',
      note: 'حداقل مزد، اضافه‌کاری ۴۰٪، شب‌کاری ۳۵٪، تعطیل‌کاری ۴۰٪، مرخصی استحقاقی و عیدی.',
    },
  ],

  minDailyWage: 5_541_850,
  minMonthlyWage: 166_255_500,
  housingAllowanceMonthly: 30_000_000,
  groceryAllowanceMonthly: 22_000_000,
  marriageAllowanceMonthly: 5_000_000,
  childAllowanceDayMultiplier: 3,
  childAllowanceDaily: 5_541_850 * 3,
  maxChildren: 4,
  childAllowanceAgeLimit: 18,
  seniorityDaily: 166_667,
  seniorityMonthly: 5_000_000,

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
    ceiling: 7 * 166_255_500,
    note: 'سقف مبنای کسر حق بیمه معادل ۷ برابر حداقل مزد ماهانه است (۱٬۱۶۳٬۷۸۸٬۵۰۰ ریال در ۱۴۰۵).',
  },

  tax: {
    monthlyExemption: 400_000_000,
    annualExemption: 4_800_000_000,
    eidiExemptionCap: 400_000_000,
    flatSegments: [],
    brackets: [
      { upTo: 400_000_000, rate: 0, label: 'تا ۴۰ میلیون تومان — معاف' },
      { upTo: 800_000_000, rate: 0.1, label: 'مازاد ۴۰ تا ۸۰ میلیون تومان — ۱۰٪' },
      { upTo: 1_000_000_000, rate: 0.15, label: 'مازاد ۸۰ تا ۱۰۰ میلیون تومان — ۱۵٪' },
      { upTo: 1_200_000_000, rate: 0.2, label: 'مازاد ۱۰۰ تا ۱۲۰ میلیون تومان — ۲۰٪' },
      { upTo: 1_400_000_000, rate: 0.25, label: 'مازاد ۱۲۰ تا ۱۴۰ میلیون تومان — ۲۵٪' },
      { upTo: null, rate: 0.3, label: 'مازاد بر ۱۴۰ میلیون تومان — ۳۰٪' },
    ],
    note: 'از سال ۱۴۰۵ نرخ مقطوع ۱۰٪ مزایای رفاهی حذف شده و همه اقلام مشمول با جدول پلکانی مشمول مالیات می‌شوند.',
  },

  eidi: {
    minMultiplier: 2,
    maxMultiplier: 3,
    proRatePerMonthFraction: 1 / 12,
    note: 'عیدی حداقل معادل دو برابر حداقل مزد ماهانه و حداکثر سه برابر آن؛ برای کمتر از یک سال، به‌نسبت ماه‌های کارکرد.',
  },

  severance: {
    daysPerYear: 30,
    minWorkingDays: 30,
    note: 'حق سنوات پایان کار معادل یک ماه آخرین مزد به‌ازای هر سال سابقه (ماده ۲۴ قانون کار).',
  },

  leave: {
    annualPaidLeaveDays: 26,
    accrualAfterDays: 0,
    sickLeaveFirstDaysUnpaid: 3,
    encashable: true,
    note: 'مرخصی استحقاقی سالانه ۲۶ روز کاری؛ در شرایط سخت ۳۰ روز (ماده ۶۴ قانون کار).',
  },

  components: buildComponents({
    ...DEFAULT_COMPONENTS,
    eidi: {
      ...DEFAULT_COMPONENTS.eidi,
      taxExemptMonthlyCap: 400_000_000,
      note: 'عیدی تا سقف یک‌دوازدهم معافیت سالانه (۴۰۰٬۰۰۰٬۰۰۰ ریال) معاف از مالیات و مازاد آن مشمول مالیات است.',
    },
  }),
};
