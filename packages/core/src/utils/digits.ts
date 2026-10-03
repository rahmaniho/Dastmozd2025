/** Persian number formatting helpers shared by reports, payslips and exports. */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/** Converts Latin digits of a string to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** Converts Persian/Arabic digits of a string to Latin digits. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Formats an integer with thousand separators (Latin digits, exports/reports). */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Formats an amount with separators and Persian digits (UI default). */
export function formatPersianNumber(value: number): string {
  return toPersianDigits(formatNumber(value));
}

/** Formats Rial as a Persian price string, e.g. «۱٬۶۶۲٬۵۵۵ ریال». */
export function formatRial(value: number): string {
  return `${formatPersianNumber(value)} ریال`;
}

/** Formats Rial as Toman with Persian digits. */
export function formatToman(value: number): string {
  return `${formatPersianNumber(Math.round(value / 10))} تومان`;
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', ' هزار', ' میلیون', ' میلیارد', ' بیلیون'];

function threeDigitsToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds] ?? '');
  if (remainder >= 10 && remainder < 20) {
    parts.push(TEENS[remainder - 10] ?? '');
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens > 0) parts.push(TENS[tens] ?? '');
    if (ones > 0) parts.push(ONES[ones] ?? '');
  }
  return parts.filter(Boolean).join(' و ');
}

/**
 * Converts a non-negative integer into its Persian wording, e.g.
 * 1_662_555 → «یک میلیون و ششصد و شصت و دو هزار و پانصد و پنجاه و پنج».
 */
export function numberToPersianWords(value: number): string {
  const rounded = Math.round(Math.abs(value));
  if (rounded === 0) return 'صفر';
  const groups: number[] = [];
  let rest = rounded;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i] ?? 0;
    if (group === 0) continue;
    words.push(`${threeDigitsToWords(group)}${SCALES[i] ?? ''}`);
  }
  return words.join(' و ');
}

/** Amount in words for a payslip: «۱٫۲۳۴٫۵۶۷ ریال (یک میلیون ... ریال)». */
export function rialInWords(value: number): string {
  const sign = value < 0 ? 'منفی ' : '';
  return `${sign}${numberToPersianWords(value)} ریال`;
}
