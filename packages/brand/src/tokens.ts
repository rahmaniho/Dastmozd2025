/**
 * توکن‌های طراحی «دستمزد آرمانی ۱۴۰۵»
 *
 * تنها منبع حقیقت برای رنگ، تایپوگرافی، فاصله‌ها، شعاع گوشه‌ها، سایه‌ها و
 * انیمیشن. این توکن‌ها هم در Tailwind (از طریق CSS Variables) و هم در کد
 * TypeScript (برای نمودارها و PDF) استفاده می‌شوند تا رنگ‌ها هرگز تکرار نشوند.
 */

export interface ColorScale {
  /** رنگ اصلی برند — فیروزه‌ای صنعتی */
  primary: string;
  primaryHover: string;
  primaryActive: string;
  /** سطح کم‌رنگ اصلی برای پس‌زمینه‌های ملایم */
  primarySubtle: string;
  /** رنگ مکمل — سرمه‌ای عمیق صنعت */
  secondary: string;
  secondarySoft: string;
  /** رنگ تلنگر — نارنجی گرم برای تأکید و اعداد مهم */
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  /** سطوح و متن */
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  ring: string;
}

export interface ThemeTokens {
  colors: ColorScale;
  /** مقادیر خام HSL برای استفاده در CSS Variables (بدون واحد) */
  css: Record<string, string>;
}

/** پالت روشن — پس‌زمینه روشن با کنتراست بالا (WCAG AA). */
export const lightTheme: ThemeTokens = {
  colors: {
    primary: '#0d9488',
    primaryHover: '#0f766e',
    primaryActive: '#115e59',
    primarySubtle: '#e6f7f5',
    secondary: '#0f3f5c',
    secondarySoft: '#123b52',
    accent: '#e87532',
    accentSoft: '#fff0e7',
    success: '#0f7b52',
    successSoft: '#e8f7f0',
    warning: '#9a5b00',
    warningSoft: '#fff7e7',
    danger: '#b42318',
    dangerSoft: '#fdeeed',
    info: '#155e9e',
    infoSoft: '#eaf3fd',
    background: '#f4f8f9',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    surfaceSunken: '#eef4f5',
    border: '#d8e3e6',
    borderStrong: '#b9cbd0',
    text: '#10212b',
    textMuted: '#4c6470',
    textSubtle: '#6d8592',
    ring: 'rgba(13, 148, 136, 0.45)',
  },
  css: {
    '--dm-primary': '13 148 136',
    '--dm-primary-hover': '15 118 110',
    '--dm-primary-active': '17 94 89',
    '--dm-primary-subtle': '230 247 245',
    '--dm-secondary': '15 63 92',
    '--dm-secondary-soft': '18 59 82',
    '--dm-accent': '232 117 50',
    '--dm-accent-soft': '255 240 231',
    '--dm-success': '15 123 82',
    '--dm-success-soft': '232 247 240',
    '--dm-warning': '154 91 0',
    '--dm-warning-soft': '255 247 231',
    '--dm-danger': '180 35 24',
    '--dm-danger-soft': '253 238 237',
    '--dm-info': '21 94 158',
    '--dm-info-soft': '234 243 253',
    '--dm-background': '244 248 249',
    '--dm-surface': '255 255 255',
    '--dm-surface-elevated': '255 255 255',
    '--dm-surface-sunken': '238 244 245',
    '--dm-border': '216 227 230',
    '--dm-border-strong': '185 203 208',
    '--dm-text': '16 33 43',
    '--dm-text-muted': '76 100 112',
    '--dm-text-subtle': '109 133 146',
    '--dm-ring': '13 148 136',
  },
};

/** پالت تیره — کنتراست حداقل ۴٫۵:۱ روی سطوح اصلی. */
export const darkTheme: ThemeTokens = {
  colors: {
    primary: '#2dd4bf',
    primaryHover: '#5eead4',
    primaryActive: '#99f6e4',
    primarySubtle: '#123a3d',
    secondary: '#7cc6e8',
    secondarySoft: '#15394f',
    accent: '#f6a97a',
    accentSoft: '#42291a',
    success: '#4ade9f',
    successSoft: '#0f3125',
    warning: '#f3c76b',
    warningSoft: '#3d2f10',
    danger: '#ff9c96',
    dangerSoft: '#431f1e',
    info: '#7cb8f2',
    infoSoft: '#132c44',
    background: '#0b1418',
    surface: '#121f25',
    surfaceElevated: '#16272e',
    surfaceSunken: '#0e1a1f',
    border: '#26414a',
    borderStrong: '#3a5b66',
    text: '#e8f1f4',
    textMuted: '#adc2c9',
    textSubtle: '#8ba4ad',
    ring: 'rgba(45, 212, 191, 0.5)',
  },
  css: {
    '--dm-primary': '45 212 191',
    '--dm-primary-hover': '94 234 212',
    '--dm-primary-active': '153 246 228',
    '--dm-primary-subtle': '18 58 61',
    '--dm-secondary': '124 198 232',
    '--dm-secondary-soft': '21 57 79',
    '--dm-accent': '246 169 122',
    '--dm-accent-soft': '66 41 26',
    '--dm-success': '74 222 159',
    '--dm-success-soft': '15 49 37',
    '--dm-warning': '243 199 107',
    '--dm-warning-soft': '61 47 16',
    '--dm-danger': '255 156 150',
    '--dm-danger-soft': '67 31 30',
    '--dm-info': '124 184 242',
    '--dm-info-soft': '19 44 68',
    '--dm-background': '11 20 24',
    '--dm-surface': '18 31 37',
    '--dm-surface-elevated': '22 39 46',
    '--dm-surface-sunken': '14 26 31',
    '--dm-border': '38 65 74',
    '--dm-border-strong': '58 91 102',
    '--dm-text': '232 241 244',
    '--dm-text-muted': '173 194 201',
    '--dm-text-subtle': '139 164 173',
    '--dm-ring': '45 212 191',
  },
};

/** پالت ثابت برند (مستقل از تم) — برای نشان، نمودارها و PDF. */
export const brandColors = {
  teal: '#0d9488',
  tealDeep: '#0f766e',
  navy: '#0f3f5c',
  navyDeep: '#0a2c42',
  orange: '#e87532',
  gold: '#f2b544',
  mint: '#7dd3c7',
  paper: '#ffffff',
  ink: '#10212b',
} as const;

/** سلسله‌مراتب تایپوگرافی (px). */
export const typography = {
  fontFamily: '"Vazirmatn", "IRANSansX", "Tahoma", system-ui, sans-serif',
  fontFamilyNumeric: '"Vazirmatn", "Tahoma", monospace',
  size: {
    xs: '0.6875rem', // 11px
    sm: '0.8125rem', // 13px
    base: '0.9375rem', // 15px
    lg: '1.0625rem', // 17px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  lineHeight: { tight: 1.25, snug: 1.4, normal: 1.6, relaxed: 1.8 },
  letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.02em' },
} as const;

/** مقیاس فاصله‌گذاری بر پایه ۴ پیکسل. */
export const spacing = {
  0: '0',
  px: '1px',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

/** شعاع گوشه‌ها. */
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  full: '9999px',
} as const;

/** سایه‌ها — ملایم و لایه‌ای برای حس عمق. */
export const shadows = {
  xs: '0 1px 2px rgba(9, 30, 38, 0.06)',
  sm: '0 2px 6px rgba(9, 30, 38, 0.07)',
  md: '0 8px 24px rgba(9, 30, 38, 0.09)',
  lg: '0 18px 45px rgba(9, 30, 38, 0.12)',
  xl: '0 30px 70px rgba(9, 30, 38, 0.16)',
  ring: '0 0 0 3px rgba(13, 148, 136, 0.35)',
} as const;

/** توکن‌های حرکت و انیمیشن. */
export const motion = {
  duration: { instant: '80ms', fast: '140ms', base: '220ms', slow: '340ms', slower: '520ms' },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

/** نقطه‌های شکست واکنش‌گرایی (mobile-first). */
export const breakpoints = {
  xs: '360px',
  sm: '480px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/** لایه‌های z-index. */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
} as const;

/** نمودارها — پالت رنگی سازگار با تم روشن و تیره. */
export const chartPalette = [
  '#0d9488',
  '#0f3f5c',
  '#e87532',
  '#f2b544',
  '#2f8ee0',
  '#8b5cf6',
  '#0f7b52',
  '#c02b6a',
] as const;

export const brandTokens = {
  lightTheme,
  darkTheme,
  brandColors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  breakpoints,
  zIndex,
  chartPalette,
} as const;

export type BrandTokens = typeof brandTokens;
