export {
  brandColors,
  brandTokens,
  breakpoints,
  chartPalette,
  darkTheme,
  lightTheme,
  motion,
  radius,
  shadows,
  spacing,
  typography,
  zIndex,
} from './tokens';
export type { BrandTokens, ColorScale, ThemeTokens } from './tokens';

/** متن‌های ثابت هویت برند (نام، شعار، سال). */
export const brandIdentity = {
  nameFa: 'دستمزد آرمانی',
  nameFaFull: 'دستمزد آرمانی ۱۴۰۵',
  nameEn: 'Dastmozd-e Armani',
  taglineFa: 'حقوق و دستمزد، دقیق و آرمانی',
  taglineEn: 'Payroll, precise and principled',
  companyFa: 'شرکت صنعت بسته‌بندی نقش آرمانی',
  appId: 'ir.armani.dastmozd',
  supportEmail: 'support@karen-soft.ir',
  website: 'https://karen-soft.ir',
  ogDescriptionFa:
    'سامانه جامع حقوق و دستمزد ایران بر پایه قانون کار، تأمین اجتماعی و مالیات؛ با موتور محاسباتی شفاف، گزارش‌های رسمی و نسخه وب و ویندوز.',
} as const;
