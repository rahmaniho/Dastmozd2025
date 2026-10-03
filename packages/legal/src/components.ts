import type { ComponentRule } from './types';
import type { EarningComponentKey } from '@dastmozd/types';

interface ComponentInput {
  title: string;
  taxable: boolean;
  insured: boolean;
  category: ComponentRule['category'];
  taxExemptMonthlyCap?: number | null;
  note?: string;
}

/**
 * Builds the component rule map. Keeping the map in one factory guarantees that
 * every profile defines the same vocabulary (and lets TypeScript check that no
 * component key is forgotten).
 */
export function buildComponents(input: Record<EarningComponentKey, ComponentInput>): Record<EarningComponentKey, ComponentRule> {
  const keys = Object.keys(input) as EarningComponentKey[];
  const result = {} as Record<EarningComponentKey, ComponentRule>;
  for (const key of keys) {
    result[key] = { key, ...input[key] };
  }
  return result;
}

/**
 * Default Iranian payroll treatment of every component. Individual years only
 * override the entries whose legal treatment actually changed.
 *
 * 🔎 References for the defaults (see `LEGAL.md` for the full discussion):
 *  - ماده ۹۱ قانون مالیات‌های مستقیم: فهرست درآمدهای معاف.
 *  - ماده ۳۹ قانون تأمین اجتماعی + بخشنامه‌های ۸۹ و ۱۴/۳۰: مبنای کسر حق بیمه.
 */
export const DEFAULT_COMPONENTS: Record<EarningComponentKey, ComponentInput> = {
  'base-wage': {
    title: 'حقوق پایه',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'مزد مبنا؛ مشمول مالیات پلکانی و کسر حق بیمه.',
  },
  seniority: {
    title: 'پایه سنوات',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'مزد پایه سنوات مشمول مالیات و بیمه است.',
  },
  housing: {
    title: 'حق مسکن',
    taxable: true,
    insured: true,
    category: 'benefit',
    note: 'کمک‌هزینه مسکن؛ مشمول کسر حق بیمه و مشمول مالیات (پروفایل‌های ۱۴۰۳ و ۱۴۰۴ با نرخ مقطوع ۱۰٪).',
  },
  grocery: {
    title: 'بن کارگری',
    taxable: true,
    insured: true,
    category: 'benefit',
    note: 'کمک‌هزینه اقلام مصرفی خانوار؛ مشمول بیمه و مشمول مالیات.',
  },
  marriage: {
    title: 'حق تأهل',
    taxable: true,
    insured: true,
    category: 'benefit',
    note: 'حق تأهل برای کارکنان متأهل؛ مشمول بیمه و مالیات.',
  },
  'child-allowance': {
    title: 'حق اولاد',
    taxable: true,
    insured: false,
    category: 'benefit',
    note: 'حق اولاد (تا ۴ فرزند) مشمول کسر حق بیمه نیست؛ برای مالیات مشمول است مگر معافیت ماده ۹۱ اعمال شود.',
  },
  overtime: {
    title: 'اضافه‌کاری',
    taxable: true,
    insured: true,
    category: 'performance',
    note: 'اضافه‌کار تا ۴۰ ساعت در ماه بدون مجوز اداره کار؛ مشمول بیمه و مالیات.',
  },
  'night-work': {
    title: 'فوق‌العاده شب‌کاری',
    taxable: true,
    insured: true,
    category: 'performance',
    note: 'مابه‌التفاوت ۳۵٪ مزد ساعتی برای ساعات بین ۲۲ تا ۶ بامداد؛ مشمول بیمه و مالیات.',
  },
  'holiday-work': {
    title: 'فوق‌العاده تعطیل‌کاری',
    taxable: true,
    insured: true,
    category: 'performance',
    note: 'کار در جمعه و تعطیل رسمی معادل ۴۰٪ اضافه بر مزد؛ مشمول بیمه و مالیات.',
  },
  'shift-work': {
    title: 'فوق‌العاده نوبت‌کاری',
    taxable: true,
    insured: true,
    category: 'performance',
    note: '۱۰٪ برای نوبت صبح/عصر و ۱۵٪ برای نوبت شب و ۲۲٫۵٪ برای نوبت گردشی.',
  },
  mission: {
    title: 'حق مأموریت',
    taxable: false,
    insured: false,
    category: 'reimbursement',
    note: 'هزینه سفر و فوق‌العاده مأموریت با تأیید مدارک، معاف از مالیات و بیمه است (ماده ۹۱ ق.م.م).',
  },
  bonus: {
    title: 'پاداش و کارانه',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'پاداش نقدی مشمول مالیات و بیمه؛ پاداش افزایش تولید با مجوز اداره کار معاف از بیمه است.',
  },
  transport: {
    title: 'ایاب و ذهاب',
    taxable: false,
    insured: false,
    category: 'reimbursement',
    note: 'کمک‌هزینه ایاب و ذهاب معاف از مالیات و معاف از کسر حق بیمه (هزینه اصلاح‌شده).',
  },
  food: {
    title: 'حق غذا',
    taxable: false,
    insured: false,
    category: 'reimbursement',
    note: 'هزینه غذا و رستوران کارگاه معاف از مالیات و بیمه است.',
  },
  eidi: {
    title: 'عیدی و پاداش پایان سال',
    taxable: true,
    insured: true,
    category: 'benefit',
    taxExemptMonthlyCap: null,
    note: 'عیدی معادل دو برابر حداقل مزد ماهانه و حداکثر سه برابر؛ تا یک‌دوازدهم سقف معافیت سالانه از مالیات معاف است.',
  },
  severance: {
    title: 'سنوات خدمت',
    taxable: false,
    insured: false,
    category: 'exempt',
    note: 'حق سنوات پایان خدمت طبق ماده ۹۱ ق.م.م معاف از مالیات و معاف از کسر حق بیمه است.',
  },
  'leave-encashment': {
    title: 'بازخرید مانده مرخصی',
    taxable: false,
    insured: false,
    category: 'exempt',
    note: 'بازخرید مرخصی استفاده‌نشده معاف از مالیات و بیمه است.',
  },
  hardship: {
    title: 'حق سختی کار',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'فوق‌العاده سختی شرایط کار؛ مشمول مالیات و بیمه.',
  },
  supervision: {
    title: 'حق سرپرستی',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'فوق‌العاده سرپرستی؛ مشمول مالیات و بیمه.',
  },
  'other-benefit': {
    title: 'سایر مزایا',
    taxable: true,
    insured: true,
    category: 'wage',
    note: 'سایر پرداخت‌های مرتبط با شغل؛ طبق رویه محتاطانه مشمول مالیات و بیمه در نظر گرفته می‌شود.',
  },
  'unpaid-leave-deduction': {
    title: 'کسر مرخصی بدون حقوق',
    taxable: false,
    insured: false,
    category: 'exempt',
    note: 'کسر متناسب با روزهای مرخصی بدون حقوق از مزد پایه.',
  },
  'absence-deduction': {
    title: 'کسر غیبت',
    taxable: false,
    insured: false,
    category: 'exempt',
    note: 'کسر روزهای غیبت غیرموجه از مزد پایه.',
  },
  'late-deduction': {
    title: 'کسر تأخیر و تعجیل',
    taxable: false,
    insured: false,
    category: 'exempt',
    note: 'کسر ساعتی بابت تأخیر ورود و تعجیل خروج طبق آیین‌نامه داخلی کارگاه.',
  },
};
