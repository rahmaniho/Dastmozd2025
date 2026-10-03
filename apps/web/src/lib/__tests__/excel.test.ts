import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Department } from '@dastmozd/types';
import { parseAmountCell, parseJalaliCell, previewEmployeeImport } from '../excel';

function workbook(rows: Array<Record<string, unknown>>): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'کارکنان');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const DEPARTMENTS = [
  {
    id: 'dep-1',
    companyId: 'cmp-1',
    title: 'خط تولید',
    costCenter: 'CC-200',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
] as unknown as Department[];

const VALID_ROW = {
  'شماره پرسنلی': 'AR-2001',
  نام: 'زهرا',
  'نام خانوادگی': 'کریمی',
  'نام پدر': 'محمود',
  'کد ملی': '1234567891',
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
  'شماره شبا': 'IR760170000000000000000001',
  'نام بانک': 'بانک ملت',
};

describe('parseJalaliCell', () => {
  it('تاریخ شمسی با ارقام فارسی و جداکننده‌های گوناگون را می‌خواند', () => {
    expect(parseJalaliCell('1405/07/03')).toEqual({ jy: 1405, jm: 7, jd: 3 });
    expect(parseJalaliCell('۱۴۰۵-۷-۳')).toEqual({ jy: 1405, jm: 7, jd: 3 });
    expect(parseJalaliCell('1405.07.03')).toEqual({ jy: 1405, jm: 7, jd: 3 });
  });

  it('ورودی نامعتبر را رد می‌کند', () => {
    expect(parseJalaliCell('')).toBeNull();
    expect(parseJalaliCell(null)).toBeNull();
    expect(parseJalaliCell('۱۴۰۵/۱۳/۰۱')).toBeNull();
    expect(parseJalaliCell('متن آزاد')).toBeNull();
  });
});

describe('parseAmountCell', () => {
  it('مبالغ با جداکننده هزارگان و ارقام فارسی را می‌خواند', () => {
    expect(parseAmountCell('166,255,500')).toBe(166_255_500);
    expect(parseAmountCell('۱۶۶٬۲۵۵٬۵۰۰')).toBe(166_255_500);
    expect(parseAmountCell('۵۰۰۰۰۰۰ ریال')).toBe(5_000_000);
    expect(parseAmountCell('')).toBe(0);
  });
});

describe('previewEmployeeImport', () => {
  it('یک سطر کامل و معتبر را می‌پذیرد', () => {
    const result = previewEmployeeImport(workbook([VALID_ROW]), {
      companyId: 'cmp-1',
      departments: DEPARTMENTS,
      defaults: { departmentId: 'dep-1' },
    });

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const input = result.rows[0]?.input;
    expect(input?.firstName).toBe('زهرا');
    expect(input?.lastName).toBe('کریمی');
    expect(input?.gender).toBe('female');
    expect(input?.maritalStatus).toBe('married');
    expect(input?.departmentId).toBe('dep-1');
    expect(input?.birthDate).toEqual({ jy: 1372, jm: 4, jd: 12 });
    expect(input?.hireDate).toEqual({ jy: 1402, jm: 7, jd: 1 });
    expect(input?.salary.baseMonthly).toBe(166_255_500);
    expect(input?.children).toHaveLength(1);
    expect(input?.bankAccount?.iban).toBe('IR760170000000000000000001');
    expect(input?.insuranceNumber).toBe('1234567890');
  });

  it('کد ملی نامعتبر، کد تکراری در فایل و ستون خالی را گزارش می‌کند', () => {
    const result = previewEmployeeImport(
      workbook([
        VALID_ROW,
        { ...VALID_ROW, نام: 'سارا' },
        { ...VALID_ROW, 'شماره پرسنلی': 'AR-2002', 'نام خانوادگی': 'نجفی', 'کد ملی': '1111111111' },
        {
          ...VALID_ROW,
          'شماره پرسنلی': 'AR-2003',
          'نام خانوادگی': 'رحیمی',
          'کد ملی': '1234567891',
        },
        { ...VALID_ROW, 'شماره پرسنلی': 'AR-2004', نام: '' },
      ]),
      { companyId: 'cmp-1', departments: DEPARTMENTS, defaults: { departmentId: 'dep-1' } },
    );

    expect(result.rows).toHaveLength(1);
    const messages = result.issues.map((issue) => `${issue.field}:${issue.message}`).join(' | ');
    expect(messages).toContain('personnelCode:شماره پرسنلی در فایل تکراری است.');
    expect(messages).toContain('nationalId:کد ملی در فایل تکراری است.');
    expect(messages).toContain('firstName:نام الزامی است.');
    expect(result.rows[0]?.fullName).toBe('زهرا کریمی');
  });

  it('دپارتمان ناشناخته را با دپارتمان پیش‌فرض جایگزین می‌کند', () => {
    const result = previewEmployeeImport(
      workbook([{ ...VALID_ROW, دپارتمان: 'دپارتمان ناشناخته' }]),
      { companyId: 'cmp-1', departments: DEPARTMENTS, defaults: { departmentId: 'dep-1' } },
    );

    expect(result.rows[0]?.input.departmentId).toBe('dep-1');
  });
});
