import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Employee } from '@dastmozd/types';
import { parseClockCell, readAttendanceWorkbook } from '../attendance-import';

/** ساخت فایل اکسل در حافظه از سطرهای داده. */
function workbook(rows: Array<Record<string, unknown>>): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'کارکرد');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const EMPLOYEES = [
  {
    id: 'emp-1',
    companyId: 'cmp-1',
    personnelCode: 'AR-1001',
    firstName: 'علی',
    lastName: 'محمدی',
    nationalId: '1234567891',
    fatherName: 'حسن',
    idCardNumber: '12345',
    birthDate: { jy: 1365, jm: 1, jd: 1 },
    gender: 'male',
    maritalStatus: 'married',
    children: [],
    education: 'diploma',
    position: 'اپراتور',
    departmentId: 'dep-1',
    hireDate: { jy: 1398, jm: 1, jd: 1 },
    contractType: 'labour',
    status: 'active',
    salary: { baseMonthly: 166_255_500, seniorityMonthly: 5_000_000 },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
] as unknown as Employee[];

describe('parseClockCell', () => {
  it('ساعت‌های نوشتاری گوناگون را به قالب HH:mm تبدیل می‌کند', () => {
    expect(parseClockCell('08:30')).toBe('08:30');
    expect(parseClockCell('8:5')).toBe('08:05');
    expect(parseClockCell('۰۸:۴۵')).toBe('08:45');
    expect(parseClockCell('0830')).toBe('08:30');
    expect(parseClockCell(830)).toBe('08:30');
    expect(parseClockCell(8)).toBe('08:00');
    expect(parseClockCell('')).toBeUndefined();
    expect(parseClockCell(null)).toBeUndefined();
  });

  it('مقادیر خارج از بازه را اصلاح می‌کند', () => {
    expect(parseClockCell('25:99')).toBe('23:59');
  });
});

describe('readAttendanceWorkbook', () => {
  it('رکوردهای کارکرد را بر پایه شماره پرسنلی تطبیق می‌دهد', () => {
    const file = workbook([
      {
        'شماره پرسنلی': 'AR-1001',
        تاریخ: '1405/07/01',
        'نوع کارکرد': 'عادی',
        'ساعت ورود': '08:00',
        'ساعت خروج': '17:00',
      },
      {
        'شماره پرسنلی': 'AR-1001',
        تاریخ: '۱۴۰۵/۰۷/۰۲',
        'نوع کارکرد': 'اضافه‌کار',
        'ساعت ورود': '8:00',
        'ساعت خروج': '20:30',
      },
    ]);

    const result = readAttendanceWorkbook(file, { employees: EMPLOYEES, adapterId: 'generic' });

    expect(result.totalRows).toBe(2);
    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.record.kind).toBe('present');
    expect(result.rows[0]?.record.checkIn).toBe('08:00');
    expect(result.rows[0]?.record.jalali).toEqual({ jy: 1405, jm: 7, jd: 1 });
    expect(result.rows[1]?.record.kind).toBe('overtime');
    expect(result.rows[1]?.record.checkOut).toBe('20:30');
    // تاریخ میلادی متناظر باید ذخیره شود تا پرس‌وجوهای بازه‌ای درست کار کنند.
    expect(result.rows[0]?.record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('سطرهای ناشناخته، تاریخ نامعتبر و تکرار را گزارش می‌کند', () => {
    const file = workbook([
      { 'شماره پرسنلی': 'AR-9999', تاریخ: '1405/07/01', 'ساعت ورود': '08:00' },
      { 'شماره پرسنلی': 'AR-1001', تاریخ: 'بدون تاریخ', 'ساعت ورود': '08:00' },
      { 'شماره پرسنلی': 'AR-1001', تاریخ: '1405/07/03', 'ساعت ورود': '08:00' },
      { 'شماره پرسنلی': 'AR-1001', تاریخ: '1405/07/03', 'ساعت ورود': '09:00' },
      { تاریخ: '1405/07/04', 'ساعت ورود': '08:00' },
    ]);

    const result = readAttendanceWorkbook(file, { employees: EMPLOYEES, adapterId: 'generic' });

    expect(result.rows).toHaveLength(1);
    expect(result.issues).toHaveLength(4);
    expect(result.issues.map((issue) => issue.message).join(' ')).toContain('یافت نشد');
    expect(result.issues.map((issue) => issue.message).join(' ')).toContain(
      'تاریخ شمسی معتبر نیست',
    );
    expect(result.issues.map((issue) => issue.message).join(' ')).toContain('تکراری');
    expect(result.issues.map((issue) => issue.message).join(' ')).toContain('خالی است');
  });

  it('آداپتور سپیدار ستون‌های اختصاصی همان نرم‌افزار را می‌خواند', () => {
    const file = workbook([
      { 'کد کارمند': 'AR-1001', تاریخ: '1405/07/05', مرخصی: 'مرخصی استحقاقی', ورود: '', خروج: '' },
    ]);

    const result = readAttendanceWorkbook(file, { employees: EMPLOYEES, adapterId: 'sepidar' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.record.kind).toBe('paid-leave');
  });

  it('آداپتور راهکاران زمان‌های ورود و خروج را ترجمه می‌کند', () => {
    const file = workbook([
      {
        'شماره پرسنلی': 'AR-1001',
        'تاریخ شمسی': '1405/07/06',
        'زمان ورود': '۰۷:۳۰',
        'زمان خروج': '۱۶:۰۰',
      },
    ]);

    const result = readAttendanceWorkbook(file, { employees: EMPLOYEES, adapterId: 'rahkaran' });

    expect(result.rows[0]?.record.checkIn).toBe('07:30');
    expect(result.rows[0]?.record.checkOut).toBe('16:00');
  });
});
