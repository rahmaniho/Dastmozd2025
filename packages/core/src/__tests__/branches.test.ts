import { describe, expect, it } from 'vitest';
import type { Employee } from '@dastmozd/types';
import { validateEmployee } from '../validation/employee';
import {
  validateIdCardNumber,
  validateInsuranceNumber,
  validatePersonnelCode,
} from '../validation/nationalId';
import { makeRunCode, makeVerificationCode } from '../utils/code';
import { buildDeductions } from '../engine/deductions';
import { computeInsurance } from '../engine/insurance';
import { emptyAttendance, type PayrollEmployee } from '../engine/types';
import type { PayrollLineItem } from '@dastmozd/types';
import { PROFILE_1405 } from '@dastmozd/legal';
import { employee } from './fixtures';

/**
 * آزمون‌های مرزی: شاخه‌هایی از اعتبارسنجی و موتور که در سناریوهای عادی لمس
 * نمی‌شوند اما در داده واقعی کارگاه پیش می‌آیند (فیلد خالی، سقف بیمه دستی،
 * کسورات نامعتبر و کد پیگیری بدون سال).
 */

function validEmployee(overrides: Partial<Employee> = {}): Partial<Employee> {
  return {
    personnelCode: 'AR-2001',
    firstName: 'مریم',
    lastName: 'کاظمی',
    fatherName: 'حسین',
    nationalId: '1234567891',
    idCardNumber: '1234',
    birthDate: { jy: 1365, jm: 5, jd: 10 },
    hireDate: { jy: 1400, jm: 1, jd: 1 },
    position: 'اپراتور خط',
    departmentId: 'dep-1',
    insuranceNumber: '1234567890',
    bankAccount: { iban: 'IR760170000000000000000001', bankName: 'بانک ملت' },
    salary: { baseMonthly: 166_255_500, seniorityMonthly: 5_000_000 },
    ...overrides,
  };
}

describe('اعتبارسنجی پرونده کارمند — شاخه‌های مرزی', () => {
  it('پرونده کامل بدون خطا پذیرفته می‌شود', () => {
    expect(validateEmployee(validEmployee())).toEqual([]);
  });

  it('نبود اجزای تاریخ تولد یا استخدام را جداگانه گزارش می‌کند', () => {
    const fields = validateEmployee(
      validEmployee({ birthDate: { jy: 0, jm: 0, jd: 0 }, hireDate: undefined }),
    ).map((issue) => issue.field);
    expect(fields).toContain('birthDate');
    expect(fields).toContain('hireDate');
  });

  it('سال تولد بزرگ‌تر از سال جاری پذیرفته نمی‌شود', () => {
    const issues = validateEmployee(validEmployee({ birthDate: { jy: 1410, jm: 1, jd: 1 } }));
    expect(issues.some((issue) => issue.field === 'birthDate')).toBe(true);
  });

  it('نبود سمت و دپارتمان گزارش می‌شود', () => {
    const fields = validateEmployee(validEmployee({ position: '   ', departmentId: '' })).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual(expect.arrayContaining(['position', 'departmentId']));
  });

  it('شماره بیمه و شبا نامعتبر با پیام مشخص رد می‌شوند', () => {
    const fields = validateEmployee(
      validEmployee({
        insuranceNumber: '123',
        bankAccount: { iban: 'IR000000000000000000000000', bankName: 'بانک ملت' },
      }),
    ).map((issue) => issue.field);
    expect(fields).toContain('insuranceNumber');
    expect(fields).toContain('bankAccount');
  });

  it('تکرار شماره پرسنلی و کد ملی نسبت به داده موجود گزارش می‌شود', () => {
    const issues = validateEmployee(validEmployee(), {
      existingPersonnelCodes: ['AR-2001', 'AR-2002'],
      existingNationalIds: ['۱۲۳۴۵۶۷۸۹۱'],
    });
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['personnelCode', 'nationalId']),
    );
  });
});

describe('شماره بیمه، شناسنامه و پرسنلی', () => {
  it('شماره بیمه فقط ۸ تا ۱۰ رقمی را می‌پذیرد', () => {
    expect(validateInsuranceNumber('12345678').valid).toBe(true);
    expect(validateInsuranceNumber('123456789').valid).toBe(true);
    expect(validateInsuranceNumber('1234567').reason).toContain('۸ تا ۱۰');
    expect(validateInsuranceNumber('12345678901').valid).toBe(false);
    expect(validateInsuranceNumber('12a45678').reason).toContain('ارقام');
    expect(validateInsuranceNumber('').reason).toContain('وارد کنید');
  });

  it('شماره شناسنامه حداکثر ده رقم است', () => {
    expect(validateIdCardNumber('1234').valid).toBe(true);
    expect(validateIdCardNumber('12345678901').reason).toContain('۱۰');
    expect(validateIdCardNumber('12x').reason).toContain('ارقام');
    expect(validateIdCardNumber('').reason).toContain('وارد کنید');
  });

  it('شماره پرسنلی الگوی حرف، رقم و خط تیره را می‌پذیرد', () => {
    expect(validatePersonnelCode('A-1').valid).toBe(true);
    expect(validatePersonnelCode('101').valid).toBe(true);
    expect(validatePersonnelCode('کارمند ۱').valid).toBe(false);
    expect(validatePersonnelCode('A').valid).toBe(false);
    expect(validatePersonnelCode('').reason).toContain('وارد کنید');
  });
});

describe('کدهای پیگیری فیش و دوره', () => {
  it('کد فیش بدون سال و ماه عددی نیز ساخته می‌شود', () => {
    const code = makeVerificationCode(['emp-1', 'AR-1001', 'متن', null]);
    expect(code.startsWith('DM-')).toBe(true);
    expect(code).not.toContain('null');
  });

  it('کد فیش با سال و ماه، دوره را در خود دارد', () => {
    expect(makeVerificationCode(['emp-1', 'AR-1001', 1405, 7])).toMatch(/^DM-1405-07-[0-9A-F]{8}$/);
  });

  it('کد دوره با نسخه تفاوت می‌کند', () => {
    expect(makeRunCode(1405, 7, 1, 'payload')).not.toBe(makeRunCode(1405, 7, 2, 'payload'));
    expect(makeRunCode(1405, 7, 1, 'payload')).toMatch(/^RUN-1405-07-[0-9A-F]{8}$/);
  });
});

describe('محاسبه بیمه — سقف و مبنای دستی', () => {
  const earnings = [
    {
      key: 'base-wage',
      title: 'مزد پایه',
      type: 'earning',
      amount: 200_000_000,
      taxable: true,
      insured: true,
    },
    {
      key: 'grocery-allowance',
      title: 'بن کارگری',
      type: 'earning',
      amount: 22_000_000,
      taxable: true,
      insured: false,
    },
  ] as PayrollLineItem[];

  it('مبنای دستی بیمه بر محاسبه خودکار مقدم است', () => {
    const result = computeInsurance({
      earnings,
      profile: PROFILE_1405,
      reductions: 0,
      options: { manualInsuranceBase: 150_000_000 },
    });
    expect(result.insurance.base).toBe(150_000_000);
  });

  it('حذف سقف بیمه، کل مبلغ مشمول را مبنای محاسبه می‌کند', () => {
    const result = computeInsurance({
      earnings,
      profile: PROFILE_1405,
      reductions: 0,
      options: { insuranceCeiling: null },
    });
    expect(result.insurance.base).toBe(200_000_000);
  });

  it('سقف سفارشی پایین‌تر، مبنای محاسبه را محدود می‌کند', () => {
    const result = computeInsurance({
      earnings,
      profile: PROFILE_1405,
      reductions: 0,
      options: { insuranceCeiling: 120_000_000 },
    });
    expect(result.insurance.base).toBe(120_000_000);
  });
});

describe('کسورات اختیاری — ورودی نامعتبر', () => {
  const base = {
    attendance: emptyAttendance(30),
    profile: PROFILE_1405,
  };

  it('کسورات با مبلغ صفر یا نامتناهی نادیده گرفته می‌شود', () => {
    const result = buildDeductions({
      ...base,
      extras: [
        { key: 'loan', title: 'قسط وام', amount: 0 },
        { key: 'advance', title: 'مساعده', amount: Number.POSITIVE_INFINITY },
        { key: 'custom', title: 'کسر توافقی', amount: -5000 },
      ] as never,
    });
    expect(result.deductions).toHaveLength(0);
  });

  it('جریمه تأخیر با نرخ ساعتی تنظیمات شرکت محاسبه می‌شود', () => {
    const result = buildDeductions({
      ...base,
      extras: [],
      options: { latePenaltyPerMinute: 10_000 },
      attendance: { ...emptyAttendance(30), lateMinutes: 45, earlyLeaveMinutes: 15 },
    });
    const penalty = result.deductions.find((line) => line.key === 'penalty');
    expect(penalty?.amount).toBe(600_000);
  });
});

describe('کارمند نمونه آزمون‌ها', () => {
  it('کارمند نمونه از نوع موتور محاسبه است', () => {
    const sample: PayrollEmployee = employee();
    expect(sample.wage.baseMonthly).toBeGreaterThan(0);
  });
});
