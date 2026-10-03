import { describe, expect, it } from 'vitest';
import {
  validateIdCardNumber,
  validateInsuranceNumber,
  validateNationalId,
  validatePersonnelCode,
} from '../validation/nationalId';
import { IRAN_BANK_CODES, normalizeIban, toIranIban, validateIranIban } from '../validation/iban';
import { validateEmployee } from '../validation/employee';
import type { Employee } from '@dastmozd/types';

describe('اعتبارسنجی کد ملی', () => {
  it('کدهای ملی معتبر پذیرفته می‌شوند', () => {
    expect(validateNationalId('1234567891').valid).toBe(true);
    expect(validateNationalId('0084575948').valid).toBe(true);
    expect(validateNationalId('0930123451').valid).toBe(true);
    // ارقام فارسی نیز باید پذیرفته شود.
    expect(validateNationalId('۱۲۳۴۵۶۷۸۹۱').valid).toBe(true);
  });

  it('کدهای ملی نامعتبر با پیام فارسی رد می‌شوند', () => {
    expect(validateNationalId('1234567890').valid).toBe(false);
    expect(validateNationalId('123').reason).toContain('۱۰ رقم');
    expect(validateNationalId('1111111111').valid).toBe(false);
    expect(validateNationalId('۱۲۳۴۵۶۷۸۹a').valid).toBe(false);
    expect(validateNationalId('').reason).toContain('وارد کنید');
  });

  it('شماره بیمه و شناسنامه و پرسنلی اعتبارسنجی می‌شوند', () => {
    expect(validateInsuranceNumber('1234567890').valid).toBe(true);
    expect(validateInsuranceNumber('12345').valid).toBe(false);
    expect(validateIdCardNumber('1234').valid).toBe(true);
    expect(validateIdCardNumber('12345678901').valid).toBe(false);
    expect(validatePersonnelCode('AR-1001').valid).toBe(true);
    expect(validatePersonnelCode('ا').valid).toBe(false);
  });
});

describe('اعتبارسنجی شماره شبا', () => {
  it('شبای معتبر نمونه نیز پذیرفته می‌شود', () => {
    expect(validateIranIban('IR062960000000100324200001').valid).toBe(true);
  });

  it('شبای ساخته‌شده معتبر است', () => {
    const iban = toIranIban('017', '123456789012345678');
    expect(iban.startsWith('IR')).toBe(true);
    expect(iban).toHaveLength(26);
    expect(validateIranIban(iban).valid).toBe(true);
    expect(IranBankCodesHas('017')).toBe(true);
  });

  it('شباهای نامعتبر رد می‌شوند', () => {
    expect(validateIranIban('IR062960000000100324200002').valid).toBe(false);
    expect(validateIranIban('IR123').reason).toContain('۲۴ رقم');
    expect(validateIranIban('').valid).toBe(false);
    expect(normalizeIban('ir062960000000100324200001')).toBe('IR062960000000100324200001');
  });

  function IranBankCodesHas(code: string): boolean {
    return Boolean(IRAN_BANK_CODES[code]);
  }
});

describe('اعتبارسنجی پرونده کارمند', () => {
  const validEmployee: Partial<Employee> = {
    personnelCode: 'AR-1001',
    firstName: 'سمیه',
    lastName: 'رحیمی',
    fatherName: 'محمد',
    nationalId: '1234567891',
    idCardNumber: '1234',
    birthDate: { jy: 1370, jm: 5, jd: 12 },
    hireDate: { jy: 1398, jm: 1, jd: 1 },
    position: 'کارشناس حسابداری',
    departmentId: 'dep-1',
    insuranceNumber: '1234567890',
    bankAccount: { iban: toIranIban('017', '123456789012345678'), bankName: 'بانک ملی ایران' },
    salary: { baseMonthly: 166_255_500, seniorityMonthly: 5_000_000 },
    children: [{ id: 'c1', birthDate: { jy: 1395, jm: 1, jd: 1 } }],
  };

  it('پرونده کامل خطایی ندارد', () => {
    expect(validateEmployee(validEmployee)).toEqual([]);
  });

  it('فیلدهای ضروری و کد ملی تکراری گزارش می‌شود', () => {
    const issues = validateEmployee(
      {
        ...validEmployee,
        firstName: '',
        nationalId: '1234567891',
        salary: { baseMonthly: 0, seniorityMonthly: 0 },
      },
      { existingNationalIds: ['1234567891'], existingPersonnelCodes: ['AR-1001'] },
    );
    const fields = issues.map((issue) => issue.field);
    expect(fields).toContain('firstName');
    expect(fields).toContain('nationalId');
    expect(fields).toContain('baseMonthly');
    expect(fields).toContain('personnelCode');
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });

  it('تاریخ تولد آینده و شبا نامعتبر رد می‌شود', () => {
    const issues = validateEmployee({
      ...validEmployee,
      birthDate: { jy: 1410, jm: 1, jd: 1 },
      bankAccount: { iban: 'IR000000000000000000000000', bankName: 'بانک ملت' },
      children: [{ id: 'c2', birthDate: { jy: 0, jm: 0, jd: 0 } }],
    });
    const fields = issues.map((issue) => issue.field);
    expect(fields).toContain('birthDate');
    expect(fields).toContain('bankAccount');
    expect(fields).toContain('children');
  });
});
