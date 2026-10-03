import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  AppUser,
  AttendanceRecord,
  AuditLogEntry,
  CompanyProfile,
  Department,
  Employee,
  FiscalYear,
  LoanContract,
  PayrollRun,
  Payslip,
} from '@dastmozd/types';

/** رکورد پشتیبان ذخیره‌شده در مرورگر (فراداده؛ فایل اصلی روی دیسک ذخیره می‌شود). */
export interface BackupRecord {
  id: string;
  label: string;
  createdAt: string;
  kind: 'auto' | 'manual' | 'pre-operation';
  period: 'daily' | 'monthly' | 'yearly';
  sizeBytes: number;
  sha256: string;
  encrypted: boolean;
  /** Payload رمزنگاری‌شده به‌صورت base64 — برای پشتیبان‌های سبک داخل مرورگر. */
  payloadBase64?: string;
}

/** بازنویسی پارامترهای حقوقی توسط کاربر برای یک سال مشخص. */
export interface LegalOverrideRecord {
  id: string;
  year: number;
  patch: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string;
}

/** یادداشت و رویداد تقویمی (پایان قرارداد، سررسید وام، مهلت بیمه و …). */
export interface CalendarEventRecord {
  id: string;
  companyId: string;
  title: string;
  /** Gregorian ISO date used for sorting. */
  date: string;
  jalali: { jy: number; jm: number; jd: number };
  kind: 'contract-end' | 'loan-due' | 'insurance-due' | 'tax-due' | 'task' | 'birthday';
  employeeId?: string;
  done: boolean;
  note?: string;
}

/**
 * پایگاه داده محلی سامانه — تنها منبع حقیقت (single source of truth).
 *
 * نسخه‌بندی بر پایه Dexie انجام می‌شود؛ هر ارتقای ساختار باید یک `version()`
 * جدید اضافه کند تا داده‌های کاربران فعلی بدون از دست رفتن اطلاعات مهاجرت کنند.
 */
export class DastmozdDatabase extends Dexie {
  companies!: Table<CompanyProfile, string>;
  departments!: Table<Department, string>;
  employees!: Table<Employee, string>;
  attendance!: Table<AttendanceRecord, string>;
  payrollRuns!: Table<PayrollRun, string>;
  payslips!: Table<Payslip, string>;
  loans!: Table<LoanContract, string>;
  users!: Table<AppUser, string>;
  settings!: Table<AppSettings, string>;
  fiscalYears!: Table<FiscalYear, string>;
  auditLog!: Table<AuditLogEntry, string>;
  backups!: Table<BackupRecord, string>;
  legalOverrides!: Table<LegalOverrideRecord, string>;
  calendarEvents!: Table<CalendarEventRecord, string>;

  constructor(name = 'dastmozd') {
    super(name);

    // نسخه ۱ — ساختار اولیه سامانه.
    this.version(1).stores({
      companies: 'id, name, isActive',
      departments: 'id, companyId, title, parentId',
      employees:
        'id, companyId, personnelCode, nationalId, lastName, departmentId, status, contractType, [companyId+status], [companyId+departmentId]',
      attendance:
        'id, employeeId, date, kind, payrollRunId, [employeeId+date], [employeeId+payrollRunId]',
      payrollRuns:
        'id, companyId, period.jy, period.jm, status, version, [companyId+period.jy+period.jm]',
      payslips:
        'id, payrollRunId, employeeId, period.jy, period.jm, [employeeId+period.jy+period.jm]',
      loans: 'id, employeeId, companyId, status',
      users: 'id, username, role',
      settings: 'id',
      fiscalYears: 'id, companyId, year',
      auditLog: 'id, entityType, entityId, action, createdAt, [entityType+entityId]',
      backups: 'id, createdAt, kind, period',
      legalOverrides: 'id, year',
      calendarEvents: 'id, companyId, date, kind, employeeId, done',
    });

    // نسخه ۲ — نمایه‌های مکمل برای گزارش‌های تجمعی و جست‌وجوی سریع.
    this.version(2).stores({
      employees:
        'id, companyId, personnelCode, nationalId, lastName, firstName, departmentId, status, contractType, [companyId+status], [companyId+departmentId]',
      attendance:
        'id, employeeId, date, kind, payrollRunId, [employeeId+date], [employeeId+payrollRunId], [date+kind]',
      payslips:
        'id, payrollRunId, employeeId, period.jy, period.jm, verificationCode, [employeeId+period.jy+period.jm]',
      auditLog: 'id, entityType, entityId, action, createdAt, actorId, [entityType+entityId]',
    });
  }
}

/** نمونه پیش‌فرض پایگاه‌داده برنامه. */
export const db = new DastmozdDatabase();

/** نام همه جدول‌ها — برای پشتیبان‌گیری و پاک‌سازی استفاده می‌شود. */
export const TABLE_NAMES = [
  'companies',
  'departments',
  'employees',
  'attendance',
  'payrollRuns',
  'payslips',
  'loans',
  'users',
  'settings',
  'fiscalYears',
  'auditLog',
  'legalOverrides',
  'calendarEvents',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
