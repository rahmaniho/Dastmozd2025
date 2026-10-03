'use client';

import { jalaliToGregorianIso, toLatinDigits } from '@dastmozd/core';
import type { AttendanceKind, AttendanceRecord, Employee } from '@dastmozd/types';
import * as XLSX from 'xlsx';
import { parseJalaliCell } from './excel';

export interface AttendanceImportIssue {
  row: number;
  message: string;
}

export interface AttendanceImportRow {
  row: number;
  employeeId: string;
  fullName: string;
  record: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface AttendanceImportResult {
  rows: AttendanceImportRow[];
  issues: AttendanceImportIssue[];
  totalRows: number;
}

export interface AttendanceAdapter {
  id: string;
  label: string;
  /** توضیح کوتاه برای راهنمای کاربر. */
  description: string;
  columns: {
    personnel: string[];
    date: string[];
    kind?: string[];
    checkIn?: string[];
    checkOut?: string[];
    note?: string[];
  };
}

/**
 * آداپتورهای ورود فایل دستگاه‌های حضور و غیاب پرکاربرد در ایران.
 * هر آداپتور نام ستون‌های احتمالی همان نرم‌افزار را می‌شناسد.
 */
export const ATTENDANCE_ADAPTERS: AttendanceAdapter[] = [
  {
    id: 'generic',
    label: 'قالب استاندارد دستمزد آرمانی',
    description: 'ستون‌های «شماره پرسنلی، تاریخ، نوع کارکرد، ساعت ورود، ساعت خروج».',
    columns: {
      personnel: ['شماره پرسنلی', 'کد پرسنلی', 'personnelCode', 'کد کارمند'],
      date: ['تاریخ', 'تاریخ شمسی', 'date'],
      kind: ['نوع کارکرد', 'وضعیت', 'kind'],
      checkIn: ['ساعت ورود', 'ورود', 'checkIn'],
      checkOut: ['ساعت خروج', 'خروج', 'checkOut'],
      note: ['توضیحات', 'note'],
    },
  },
  {
    id: 'parsapolis',
    label: 'پارس‌پولیس (سیستم پرسنلی)',
    description: 'خروجی گزارش کارکرد ماهانه پارس‌پولیس با ستون «کد پرسنلی» و «ورود/خروج».',
    columns: {
      personnel: ['کد پرسنلی', 'کد پرسنل', 'شماره پرسنلی'],
      date: ['تاریخ', 'تاریخ کارکرد'],
      checkIn: ['ساعت ورود', 'زمان ورود'],
      checkOut: ['ساعت خروج', 'زمان خروج'],
      note: ['نوع کارکرد', 'شرح'],
    },
  },
  {
    id: 'sepidar',
    label: 'سپیدار سیستم',
    description: 'فایل کارکرد سپیدار با ستون‌های «کد کارمند»، «تاریخ»، «مرخصی/غیبت» و ساعات ورود و خروج.',
    columns: {
      personnel: ['کد کارمند', 'کد پرسنلی', 'کد'],
      date: ['تاریخ', 'تاریخ روز'],
      kind: ['نوع', 'مرخصی', 'وضعیت حضور'],
      checkIn: ['ورود', 'ساعت ورود'],
      checkOut: ['خروج', 'ساعت خروج'],
    },
  },
  {
    id: 'rahkaran',
    label: 'راهکاران (همکاران سیستم)',
    description: 'خروجی حضور و غیاب راهکاران با ستون‌های «شماره پرسنلی» و «زمان ورود/خروج».',
    columns: {
      personnel: ['شماره پرسنلی', 'کد پرسنلی'],
      date: ['تاریخ شمسی', 'تاریخ'],
      checkIn: ['زمان ورود', 'ساعت ورود'],
      checkOut: ['زمان خروج', 'ساعت خروج'],
      note: ['نوع روز', 'شرح'],
    },
  },
];

const KIND_ALIASES: Array<{ match: string[]; kind: AttendanceKind }> = [
  { match: ['حاضر', 'عادی', 'موظف', 'present'], kind: 'present' },
  { match: ['اضافه', 'اضافه‌کار', 'اضافه کار', 'overtime'], kind: 'overtime' },
  { match: ['شب', 'شب‌کاری', 'شب کار', 'night'], kind: 'night' },
  { match: ['تعطیل کاری', 'تعطیل‌کاری', 'holiday'], kind: 'holiday' },
  { match: ['استحقاقی', 'مرخصی استحقاقی'], kind: 'paid-leave' },
  { match: ['استعلاجی', 'مریضی', 'بیماری'], kind: 'sick-leave' },
  { match: ['بدون حقوق', 'بی‌حقوق'], kind: 'unpaid-leave' },
  { match: ['غیبت', 'absence'], kind: 'absence' },
  { match: ['ماموریت', 'مأموریت', 'mission'], kind: 'mission' },
  { match: ['دورکاری', 'remote'], kind: 'remote' },
  { match: ['تعطیل', 'جمعه', 'holiday-off'], kind: 'unpaid-holiday' },
];

/** تبدیل ساعت‌های نوشتاری گوناگون به قالب HH:mm. */
export function parseClockCell(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  const text = toLatinDigits(String(input)).trim();
  if (!text) return undefined;

  // شکل‌های «۸:۵»، «08:30» یا «8.5» پیش از هر پردازش دیگری جدا می‌شوند.
  const separated = text.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/);
  if (separated) {
    const hour = Math.min(Number(separated[1]), 23);
    const minute = Math.min(Number(separated[2]), 59);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  if (digits.length === 3) {
    const hour = Number(digits.slice(0, 1));
    const minute = Number(digits.slice(1));
    return `${String(Math.min(hour, 23)).padStart(2, '0')}:${String(Math.min(minute, 59)).padStart(2, '0')}`;
  }
  if (digits.length >= 4) {
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2, 4));
    return `${String(Math.min(hour, 23)).padStart(2, '0')}:${String(Math.min(minute, 59)).padStart(2, '0')}`;
  }
  const hour = Number(digits);
  return `${String(Math.min(hour, 23)).padStart(2, '0')}:00`;
}

/** تشخیص نوع کارکرد از متن ستون وضعیت؛ پیش‌فرض «عادی» است. */
function normalizeKind(input: string | undefined): AttendanceKind {
  const text = (input ?? '').trim();
  if (text) {
    const found = KIND_ALIASES.find((alias) => alias.match.some((token) => text.includes(token)));
    if (found) return found.kind;
  }
  return 'present';
}

function cell(row: Record<string, string>, keys: string[] | undefined): string | undefined {
  if (!keys) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

/**
 * خواندن فایل دستگاه حضور و غیاب و تبدیل آن به رکوردهای کارکرد.
 * کارکنان بر پایه «شماره پرسنلی» تطبیق داده می‌شوند؛ سطرهای ناشناخته گزارش می‌شوند.
 */
export function readAttendanceWorkbook(
  file: ArrayBuffer,
  options: { employees: Employee[]; adapterId: string },
): AttendanceImportResult {
  const adapter = ATTENDANCE_ADAPTERS.find((item) => item.id === options.adapterId) ?? ATTENDANCE_ADAPTERS[0];
  if (!adapter) throw new Error('آداپتور ورود یافت نشد.');

  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows = sheet
    ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false })
    : [];

  const byPersonnel = new Map<string, Employee>();
  for (const employee of options.employees) {
    byPersonnel.set(toLatinDigits(employee.personnelCode).trim().toLowerCase(), employee);
  }

  const issues: AttendanceImportIssue[] = [];
  const parsed: AttendanceImportRow[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const personnelRaw = cell(row, adapter.columns.personnel);
    if (!personnelRaw) {
      issues.push({ row: rowNumber, message: 'شماره پرسنلی در این سطر خالی است.' });
      return;
    }
    const employee = byPersonnel.get(toLatinDigits(personnelRaw).trim().toLowerCase());
    if (!employee) {
      issues.push({ row: rowNumber, message: `کارمندی با شماره پرسنلی «${personnelRaw}» یافت نشد.` });
      return;
    }

    const jalali = parseJalaliCell(cell(row, adapter.columns.date));
    if (!jalali) {
      issues.push({ row: rowNumber, message: 'تاریخ شمسی معتبر نیست (نمونه درست: ۱۴۰۵/۰۷/۰۳).' });
      return;
    }

    const date = jalaliToGregorianIso(jalali);
    const key = `${employee.id}|${date}`;
    if (seen.has(key)) {
      issues.push({ row: rowNumber, message: 'کارکرد این روز برای این کارمند در فایل تکراری است.' });
      return;
    }
    seen.add(key);

    const checkIn = parseClockCell(cell(row, adapter.columns.checkIn));
    const checkOut = parseClockCell(cell(row, adapter.columns.checkOut));
    const kind = normalizeKind(cell(row, adapter.columns.kind));
    const note = cell(row, adapter.columns.note);

    parsed.push({
      row: rowNumber,
      employeeId: employee.id,
      fullName: `${employee.firstName} ${employee.lastName}`,
      record: {
        employeeId: employee.id,
        date,
        jalali,
        kind,
        ...(checkIn ? { checkIn } : {}),
        ...(checkOut ? { checkOut } : {}),
        ...(note ? { note } : {}),
      },
    });
  });

  return { rows: parsed, issues, totalRows: rows.length };
}

/** بارگیری قالب اکسل کارکرد برای ورود گروهی. */
export function downloadAttendanceTemplate(): void {
  const sample = [
    {
      'شماره پرسنلی': 'AR-1001',
      تاریخ: '1405/07/01',
      'نوع کارکرد': 'عادی',
      'ساعت ورود': '08:00',
      'ساعت خروج': '17:00',
      توضیحات: '',
    },
    {
      'شماره پرسنلی': 'AR-1001',
      تاریخ: '1405/07/02',
      'نوع کارکرد': 'اضافه‌کار',
      'ساعت ورود': '08:00',
      'ساعت خروج': '20:00',
      توضیحات: 'اضافه‌کار پروژه بسته‌بندی',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample);
  sheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 28 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'کارکرد');
  XLSX.writeFile(workbook, 'dastmozd-attendance-template.xlsx');
}
