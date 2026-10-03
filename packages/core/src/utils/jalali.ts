import type { JalaliDate } from '@dastmozd/types';

/**
 * Jalali (Solar Hijri) calendar utilities.
 *
 * The arithmetic follows the well-known Khayyam/Birashk-compatible algorithm
 * used by `jalaali-js`, implemented here as dependency-free pure functions.
 * All conversions are exact and deterministic, which matters for payroll
 * because hire dates, leave accrual and insurance files are date driven.
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

interface JalCal {
  /** Number of years since the last leap year (0 means the year is a leap year). */
  leap: number;
  /** Gregorian year that starts the Jalali year. */
  gy: number;
  /** Day of March (Gregorian) on which Farvardin 1st falls. */
  march: number;
}

function jalCal(jy: number): JalCal {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] as number;
  let jump = 0;
  let jm = 0;

  if (jy < jp || jy >= (BREAKS[bl - 1] as number)) {
    throw new RangeError(`Invalid Jalali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** Gregorian date → Julian Day Number. */
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number → Gregorian date. */
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** Converts a Gregorian date to a Jalali date. */
export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

/** Converts a Jalali date to a Gregorian date. */
export function toGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

/** Length of a Jalali month: 31 for the first six months, 30 for 7–11 and 29/30 for Esfand. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** True when the Jalali year is a leap year (۳۰ روزه بودن اسفند). */
export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** Jalali date → `YYYY-MM-DD` string (Latin digits, used for storage/export). */
export function jalaliToIso(date: JalaliDate): string {
  return `${pad(date.jy, 4)}-${pad(date.jm)}-${pad(date.jd)}`;
}

/** Parses a `YYYY-MM-DD` Jalali string into a Jalali date. */
export function isoToJalali(iso: string): JalaliDate {
  const [y = '0', m = '0', d = '0'] = iso.split('-');
  return { jy: Number(y), jm: Number(m), jd: Number(d) };
}

/** Gregorian `Date` → Jalali date (uses the local calendar date of the Date). */
export function dateToJalali(date: Date): JalaliDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Jalali date → JavaScript `Date` (Gregorian midnight, local time). */
export function jalaliToDate(date: JalaliDate): Date {
  const { gy, gm, gd } = toGregorian(date.jy, date.jm, date.jd);
  return new Date(gy, gm - 1, gd);
}

/** ISO-8601 (Gregorian) `YYYY-MM-DD` of a Jalali date. */
export function jalaliToGregorianIso(date: JalaliDate): string {
  const { gy, gm, gd } = toGregorian(date.jy, date.jm, date.jd);
  return `${pad(gy, 4)}-${pad(gm)}-${pad(gd)}`;
}

/** Gregorian `YYYY-MM-DD` → Jalali date. */
export function gregorianIsoToJalali(iso: string): JalaliDate {
  const [y = '0', m = '0', d = '0'] = iso.split('-');
  return toJalali(Number(y), Number(m), Number(d));
}

/** Adds (or subtracts) days to a Jalali date. */
export function addJalaliDays(date: JalaliDate, days: number): JalaliDate {
  const jdn = j2d(date.jy, date.jm, date.jd) + days;
  return d2j(jdn);
}

/** Adds months to a Jalali date, clamping the day to the month length. */
export function addJalaliMonths(date: JalaliDate, months: number): JalaliDate {
  const total = date.jy * 12 + (date.jm - 1) + months;
  const jy = Math.floor(total / 12);
  const jm = (total % 12) + 1;
  const jd = Math.min(date.jd, jalaliMonthLength(jy, jm));
  return { jy, jm, jd };
}

/** Difference in whole days between two Jalali dates (a - b). */
export function jalaliDiffInDays(a: JalaliDate, b: JalaliDate): number {
  return j2d(a.jy, a.jm, a.jd) - j2d(b.jy, b.jm, b.jd);
}

/** Difference in whole months between two Jalali dates (a - b). */
export function jalaliDiffInMonths(a: JalaliDate, b: JalaliDate): number {
  let months = (a.jy - b.jy) * 12 + (a.jm - b.jm);
  if (a.jd < b.jd) months -= 1;
  return months;
}

/** Completed years of service (or age) between two Jalali dates. */
export function jalaliFullYears(a: JalaliDate, b: JalaliDate): number {
  let years = a.jy - b.jy;
  if (a.jm < b.jm || (a.jm === b.jm && a.jd < b.jd)) years -= 1;
  return years;
}

/**
 * Weekday index of a Jalali date where 0 = شنبه … 6 = جمعه.
 * Useful for weekly-rest detection and the timesheet header.
 */
export function jalaliWeekday(date: JalaliDate): number {
  const { gy, gm, gd } = toGregorian(date.jy, date.jm, date.jd);
  // JS: 0 = Sunday … 6 = Saturday. Saturday = 0 in the Iranian week.
  const jsDay = new Date(gy, gm - 1, gd).getDay();
  return (jsDay + 1) % 7;
}

/** 1 = فروردین … 12 = اسفند */
export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** 0 = شنبه … 6 = جمعه */
export const JALALI_WEEKDAYS = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

/** Compares two Jalali dates: -1 (a<b), 0 (equal) or 1 (a>b). */
export function compareJalali(a: JalaliDate, b: JalaliDate): number {
  if (a.jy !== b.jy) return a.jy < b.jy ? -1 : 1;
  if (a.jm !== b.jm) return a.jm < b.jm ? -1 : 1;
  if (a.jd !== b.jd) return a.jd < b.jd ? -1 : 1;
  return 0;
}
