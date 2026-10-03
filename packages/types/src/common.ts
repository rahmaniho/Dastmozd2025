/**
 * Shared primitive types used across the whole Dastmozd-e Armani platform.
 * All monetary values are expressed in **Rial (IRR)** as integers unless a
 * field name explicitly states otherwise.
 */

/** Jalali (Solar Hijri) calendar date. */
export interface JalaliDate {
  /** Jalali year, e.g. 1405 */
  jy: number;
  /** Jalali month 1..12 */
  jm: number;
  /** Jalali day 1..31 */
  jd: number;
}

/** A payroll period expressed in the Jalali calendar. */
export interface JalaliPeriod {
  jy: number;
  jm: number;
}

/** Gregorian ISO date string (YYYY-MM-DD) — used for persistence and export. */
export type IsoDate = string;

/** ISO-8601 timestamp with timezone offset, e.g. 2026-10-03T09:12:00.000Z */
export type IsoDateTime = string;

/** Currency unit used for display. Storage is always Rial. */
export type CurrencyUnit = 'IRR' | 'IRT';

export type ThemeMode = 'light' | 'dark' | 'system';

export type Locale = 'fa-IR' | 'en-US';

/** Contract types recognised by Iranian labour law. */
export type ContractType =
  | 'official' // رسمی
  | 'contractual' // پیمانی
  | 'temporary' // موقت
  | 'labour' // کارگری (مشمول قانون کار)
  | 'part-time' // پاره‌وقت
  | 'internship'; // کارآموزی

/** Employment status of an employee. */
export type EmploymentStatus =
  | 'active' // فعال
  | 'inactive' // غیرفعال
  | 'unpaid-leave' // مرخصی بدون حقوق
  | 'terminated'; // پایان همکاری

export type Gender = 'male' | 'female';

export type MaritalStatus = 'single' | 'married';

export type EducationLevel =
  | 'below-diploma' // زیر دیپلم
  | 'diploma' // دیپلم
  | 'associate' // کاردانی
  | 'bachelor' // کارشناسی
  | 'master' // کارشناسی ارشد
  | 'phd'; // دکتری

export type UserRole = 'admin' | 'accountant' | 'viewer';

/** Iranian IBAN: IR + 24 digits. Stored without spaces. */
export type IranIban = string;

/** 10-digit Iranian national ID (کد ملی). */
export type NationalId = string;

/** 10-digit Social Security insurance number (شماره بیمه). */
export type InsuranceNumber = string;

export interface AuditStamp {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Identifier of the user who created the record. */
  createdBy?: string;
  updatedBy?: string;
}

export interface BaseEntity extends AuditStamp {
  id: string;
  /** Soft delete marker — records are never physically removed. */
  deletedAt?: IsoDateTime | null;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SortQuery {
  field: string;
  direction: 'asc' | 'desc';
}

export interface Result<T, E = string> {
  ok: boolean;
  value?: T;
  error?: E;
}
