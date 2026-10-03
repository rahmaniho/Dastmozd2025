'use client';

import { toLatinDigits, validateEmployee } from '@dastmozd/core';
import { emptyEmployee, type EmployeeInput } from '@dastmozd/db';
import type { Department, Employee } from '@dastmozd/types';
import * as XLSX from 'xlsx';
import { z } from 'zod';

/* --------------------------------------------------------------- ابزار مشترک */

export interface SheetRow {
  [key: string]: string;
}

/** تاریخ شمسی را از رشته‌هایی مانند «۱۳۷۰/۰۵/۰۳» یا «1370-5-3» می‌خواند. */
export function parseJalaliCell(input: unknown): { jy: number; jm: number; jd: number } | null {
  if (input === null || input === undefined) return null;
  const text = toLatinDigits(String(input)).trim();
  if (!text) return null;
  const match = text.match(/(\d{3,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (!jy || !jm || !jd || jm > 12 || jd > 31) return null;
  return { jy, jm, jd };
}

/** تبدیل عدد نوشتاری با ارقام فارسی/لاتین و جداکننده هزارگان. */
export function parseAmountCell(input: unknown): number {
  const text = toLatinDigits(String(input ?? '')).replace(/[^\d]/g, '');
  return text ? Number(text) : 0;
}

function readSheet(file: ArrayBuffer): SheetRow[] {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '', raw: false });
}

/* --------------------------------------------------- ورود گروهی کارکنان (اکسل) */

export interface ImportIssue {
  row: number;
  field: string;
  message: string;
}

export interface EmployeeImportPreview {
  rows: Array<{ row: number; input: EmployeeInput; fullName: string }>;
  issues: ImportIssue[];
  totalRows: number;
}

/** سرواژه‌های مورد انتظار در فایل ورودی کارکنان. */
export const EMPLOYEE_TEMPLATE_HEADERS = [
  'شماره پرسنلی',
  'نام',
  'نام خانوادگی',
  'نام پدر',
  'کد ملی',
  'شماره شناسنامه',
  'تاریخ تولد',
  'جنسیت',
  'وضعیت تأهل',
  'تعداد فرزندان',
  'سمت',
  'دپارتمان',
  'تاریخ استخدام',
  'نوع قرارداد',
  'وضعیت اشتغال',
  'شماره بیمه',
  'پایه حقوق ماهانه',
  'پایه سنوات ماهانه',
  'شماره شبا',
  'نام بانک',
] as const;

const GENDER_MAP: Record<string, 'male' | 'female'> = {
  مرد: 'male',
  male: 'male',
  م: 'male',
  زن: 'female',
  female: 'female',
  ز: 'female',
};

const MARITAL_MAP: Record<string, 'single' | 'married'> = {
  مجرد: 'single',
  single: 'single',
  متأهل: 'married',
  متاهل: 'married',
  married: 'married',
};

const CONTRACT_MAP: Record<string, EmployeeInput['contractType']> = {
  'قانون کار': 'labour',
  تمام‌وقت: 'labour',
  labour: 'labour',
  پاره‌وقت: 'part-time',
  'part-time': 'part-time',
  موقت: 'temporary',
  temporary: 'temporary',
  قراردادی: 'contractual',
  contractual: 'contractual',
  کارآموزی: 'internship',
  کارآموز: 'internship',
  internship: 'internship',
  رسمی: 'official',
  official: 'official',
  پیمانی: 'contractual',
};

const STATUS_MAP: Record<string, EmployeeInput['status']> = {
  شاغل: 'active',
  active: 'active',
  غیرفعال: 'inactive',
  inactive: 'inactive',
  'مرخصی بدون حقوق': 'unpaid-leave',
  'unpaid-leave': 'unpaid-leave',
  تسویه‌شده: 'terminated',
  terminated: 'terminated',
};

const IMPORT_ROW_SCHEMA = z.object({
  personnelCode: z.string().min(1, 'شماره پرسنلی الزامی است.'),
  firstName: z.string().min(1, 'نام الزامی است.'),
  lastName: z.string().min(1, 'نام خانوادگی الزامی است.'),
  fatherName: z.string().min(1, 'نام پدر الزامی است.'),
  nationalId: z.string().min(1, 'کد ملی الزامی است.'),
  idCardNumber: z.string().min(1, 'شماره شناسنامه الزامی است.'),
  position: z.string().min(1, 'سمت الزامی است.'),
  departmentTitle: z.string().min(1, 'دپارتمان الزامی است.'),
  baseMonthly: z.number().nonnegative(),
  seniorityMonthly: z.number().nonnegative(),
  childCount: z.number().int().min(0).max(10),
});

function cell(row: SheetRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

/**
 * خواندن و اعتبارسنجی فایل اکسل کارکنان.
 * خروجی شامل سطرهای معتبر و فهرست خطاهای هر سطر (برای گزارش اعتبارسنجی) است.
 */
export function previewEmployeeImport(
  file: ArrayBuffer,
  context: { companyId: string; departments: Department[]; defaults: { departmentId: string } },
): EmployeeImportPreview {
  const rows = readSheet(file);
  const issues: ImportIssue[] = [];
  const valid: EmployeeImportPreview['rows'] = [];
  const seenPersonnel = new Set<string>();
  const seenNational = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // سطر ۱ سرصفحه است
    const raw = {
      personnelCode: toLatinDigits(cell(row, 'شماره پرسنلی', 'personnelCode')),
      firstName: cell(row, 'نام', 'firstName'),
      lastName: cell(row, 'نام خانوادگی', 'lastName'),
      fatherName: cell(row, 'نام پدر', 'fatherName'),
      nationalId: toLatinDigits(cell(row, 'کد ملی', 'nationalId')),
      idCardNumber: toLatinDigits(cell(row, 'شماره شناسنامه', 'idCardNumber')),
      position: cell(row, 'سمت', 'position'),
      departmentTitle: cell(row, 'دپارتمان', 'departmentTitle'),
      baseMonthly: parseAmountCell(cell(row, 'پایه حقوق ماهانه', 'baseMonthly', 'پایه حقوق')),
      seniorityMonthly: parseAmountCell(
        cell(row, 'پایه سنوات ماهانه', 'seniorityMonthly', 'پایه سنوات'),
      ),
      childCount: Math.max(
        0,
        Math.round(parseAmountCell(cell(row, 'تعداد فرزندان', 'childCount'))),
      ),
    };

    const parsed = IMPORT_ROW_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      for (const error of parsed.error.issues) {
        issues.push({
          row: rowNumber,
          field: error.path.join('.'),
          message: error.message,
        });
      }
      return;
    }

    if (seenPersonnel.has(raw.personnelCode)) {
      issues.push({
        row: rowNumber,
        field: 'personnelCode',
        message: 'شماره پرسنلی در فایل تکراری است.',
      });
      return;
    }
    seenPersonnel.add(raw.personnelCode);
    if (seenNational.has(raw.nationalId)) {
      issues.push({ row: rowNumber, field: 'nationalId', message: 'کد ملی در فایل تکراری است.' });
      return;
    }
    seenNational.add(raw.nationalId);

    const department =
      context.departments.find((item) => item.title.trim() === raw.departmentTitle.trim()) ??
      context.departments.find((item) => item.id === context.defaults.departmentId);
    const departmentId = department?.id ?? context.defaults.departmentId;

    const birthDate = parseJalaliCell(cell(row, 'تاریخ تولد', 'birthDate')) ?? {
      jy: 1370,
      jm: 1,
      jd: 1,
    };
    const hireDate = parseJalaliCell(cell(row, 'تاریخ استخدام', 'hireDate')) ?? {
      jy: 1405,
      jm: 1,
      jd: 1,
    };
    const children = Array.from({ length: Math.min(raw.childCount, 8) }, (_, childIndex) => ({
      id: `child-${rowNumber}-${childIndex}`,
      birthDate: { jy: Math.max(1360, birthDate.jy + 25), jm: 1, jd: 1 },
    }));

    const input: EmployeeInput = {
      ...emptyEmployee(context.companyId, departmentId),
      personnelCode: raw.personnelCode,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fatherName: raw.fatherName,
      nationalId: raw.nationalId,
      idCardNumber: raw.idCardNumber,
      birthDate,
      gender: GENDER_MAP[toLatinDigits(cell(row, 'جنسیت', 'gender')).toLowerCase()] ?? 'male',
      maritalStatus: MARITAL_MAP[cell(row, 'وضعیت تأهل', 'maritalStatus')] ?? 'single',
      children,
      position: raw.position,
      departmentId,
      hireDate,
      contractType: CONTRACT_MAP[cell(row, 'نوع قرارداد', 'contractType')] ?? 'labour',
      status: STATUS_MAP[cell(row, 'وضعیت اشتغال', 'status')] ?? 'active',
      salary: {
        baseMonthly: raw.baseMonthly > 0 ? raw.baseMonthly : 166_255_500,
        seniorityMonthly: raw.seniorityMonthly,
      },
    };

    const insurance = cell(row, 'شماره بیمه', 'insuranceNumber');
    if (insurance) input.insuranceNumber = toLatinDigits(insurance);
    const iban = cell(row, 'شماره شبا', 'iban');
    const bankName = cell(row, 'نام بانک', 'bankName');
    if (iban) input.bankAccount = { iban: iban.toUpperCase(), bankName: bankName || 'بانک ملت' };

    const fieldIssues = validateEmployee(input);
    if (fieldIssues.length > 0) {
      for (const issue of fieldIssues) {
        issues.push({ row: rowNumber, field: issue.field, message: issue.message });
      }
      return;
    }

    valid.push({ row: rowNumber, input, fullName: `${raw.firstName} ${raw.lastName}` });
  });

  return { rows: valid, issues, totalRows: rows.length };
}

/** ساخت و بارگیری قالب اکسل ورود کارکنان به همراه یک سطر نمونه. */
export function downloadEmployeeTemplate(): void {
  const sample: SheetRow = {
    'شماره پرسنلی': 'AR-2001',
    نام: 'زهرا',
    'نام خانوادگی': 'کریمی',
    'نام پدر': 'محمود',
    'کد ملی': '0084575948',
    'شماره شناسنامه': '12345',
    'تاریخ تولد': '1372/04/12',
    جنسیت: 'زن',
    'وضعیت تأهل': 'متأهل',
    'تعداد فرزندان': '1',
    سمت: 'کارشناس کنترل کیفیت',
    دپارتمان: 'خط تولید',
    'تاریخ استخدام': '1402/07/01',
    'نوع قرارداد': 'قانون کار',
    'وضعیت اشتغال': 'شاغل',
    'شماره بیمه': '1234567890',
    'پایه حقوق ماهانه': '166255500',
    'پایه سنوات ماهانه': '5000000',
    'شماره شبا': 'IR820170000000000000000001',
    'نام بانک': 'بانک ملت',
  };
  const sheet = XLSX.utils.json_to_sheet([sample], { header: [...EMPLOYEE_TEMPLATE_HEADERS] });
  sheet['!cols'] = EMPLOYEE_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'کارکنان');
  XLSX.writeFile(workbook, 'dastmozd-employees-template.xlsx');
}

/** بارگیری گزارش خطاهای ورود گروهی. */
export function downloadImportIssues(issues: ImportIssue[]): void {
  const rows = issues.map((issue) => ({
    'شماره سطر': String(issue.row),
    فیلد: issue.field,
    پیام: issue.message,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 60 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'خطاها');
  XLSX.writeFile(workbook, 'dastmozd-import-errors.xlsx');
}

/* ------------------------------------------------------------ خروجی اکسل عمومی */

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
  /** عرض ستون در اکسل. */
  width?: number;
}

/**
 * خروجی اکسل از هر مجموعه داده با ستون‌های تعریف‌شده.
 * برای گزارش‌ها ارقام لاتین (بدون جداکننده) استفاده می‌شود تا در اکسل قابل محاسبه باشد.
 */
export function exportToExcel<T>(options: {
  fileName: string;
  sheetName: string;
  columns: Array<ExportColumn<T>>;
  rows: T[];
  /** سطرهای بالای جدول، مثلاً عنوان شرکت و دوره. */
  title?: string;
}): void {
  const header = options.columns.map((column) => column.header);
  const body = options.rows.map((row) => options.columns.map((column) => column.value(row)));
  const data = options.title ? [[options.title], header, ...body] : [header, ...body];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = options.columns.map((column) => ({ wch: column.width ?? 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, options.sheetName.slice(0, 30));
  XLSX.writeFile(workbook, options.fileName);
}

/** خروجی CSV با UTF-8 BOM تا در Excel فارسی درست باز شود. */
export function exportToCsv<T>(options: {
  fileName: string;
  columns: Array<ExportColumn<T>>;
  rows: T[];
}): void {
  const escape = (value: string | number): string => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    options.columns.map((column) => escape(column.header)).join(','),
    ...options.rows.map((row) =>
      options.columns.map((column) => escape(column.value(row))).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** خروجی JSON برای بازرسی و آرشیو (گزارش رهگیری). */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------ خروجی فهرست کارکنان */

export const EMPLOYEE_EXPORT_COLUMNS: Array<ExportColumn<Employee>> = [
  { header: 'شماره پرسنلی', value: (row) => row.personnelCode, width: 14 },
  { header: 'نام', value: (row) => row.firstName },
  { header: 'نام خانوادگی', value: (row) => row.lastName },
  { header: 'نام پدر', value: (row) => row.fatherName },
  { header: 'کد ملی', value: (row) => `="${row.nationalId}"`, width: 16 },
  { header: 'شماره شناسنامه', value: (row) => `="${row.idCardNumber}"`, width: 15 },
  {
    header: 'تاریخ تولد',
    value: (row) => `${row.birthDate.jy}/${pad(row.birthDate.jm)}/${pad(row.birthDate.jd)}`,
  },
  {
    header: 'تاریخ استخدام',
    value: (row) => `${row.hireDate.jy}/${pad(row.hireDate.jm)}/${pad(row.hireDate.jd)}`,
  },
  { header: 'سمت', value: (row) => row.position, width: 22 },
  { header: 'شماره بیمه', value: (row) => row.insuranceNumber ?? '' },
  { header: 'پایه حقوق (ریال)', value: (row) => row.salary.baseMonthly, width: 18 },
  { header: 'پایه سنوات (ریال)', value: (row) => row.salary.seniorityMonthly, width: 18 },
  { header: 'شبا', value: (row) => row.bankAccount?.iban ?? '', width: 28 },
  { header: 'وضعیت', value: (row) => STATUS_LABELS[row.status] },
];

const STATUS_LABELS: Record<Employee['status'], string> = {
  active: 'شاغل',
  inactive: 'غیرفعال',
  'unpaid-leave': 'مرخصی بدون حقوق',
  terminated: 'تسویه‌شده',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
