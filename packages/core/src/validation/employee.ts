import type { Employee } from '@dastmozd/types';
import { validateIranIban } from './iban';
import {
  validateIdCardNumber,
  validateInsuranceNumber,
  validateNationalId,
  validatePersonnelCode,
} from './nationalId';
import { toLatinDigits } from '../utils/digits';

export type EmployeeField =
  | 'personnelCode'
  | 'firstName'
  | 'lastName'
  | 'fatherName'
  | 'nationalId'
  | 'idCardNumber'
  | 'birthDate'
  | 'hireDate'
  | 'position'
  | 'departmentId'
  | 'insuranceNumber'
  | 'bankAccount'
  | 'baseMonthly'
  | 'children';

export interface EmployeeIssue {
  field: EmployeeField;
  /** Persian message shown under the form field. */
  message: string;
}

/** True when every required identity/contract field is present. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Validates an employee record before it is stored.
 * The rules mirror the checks an Iranian payroll accountant performs manually:
 * کد ملی با چک‌سام، شماره بیمه، شماره پرسنلی یکتا، تاریخ‌ها و شماره شبا.
 */
export function validateEmployee(
  employee: Partial<Employee>,
  context: { existingPersonnelCodes?: readonly string[]; existingNationalIds?: readonly string[] } = {},
): EmployeeIssue[] {
  const issues: EmployeeIssue[] = [];

  const push = (field: EmployeeField, message: string): void => {
    issues.push({ field, message });
  };

  if (isBlank(employee.firstName)) push('firstName', 'نام را وارد کنید.');
  if (isBlank(employee.lastName)) push('lastName', 'نام خانوادگی را وارد کنید.');
  if (isBlank(employee.fatherName)) push('fatherName', 'نام پدر را وارد کنید.');

  const personnel = validatePersonnelCode(employee.personnelCode ?? '');
  if (!personnel.valid) push('personnelCode', personnel.reason ?? 'شماره پرسنلی نامعتبر است.');
  const normalizedPersonnel = toLatinDigits(employee.personnelCode ?? '').trim();
  if (
    normalizedPersonnel &&
    (context.existingPersonnelCodes ?? []).some((code) => toLatinDigits(code).trim() === normalizedPersonnel)
  ) {
    push('personnelCode', 'این شماره پرسنلی قبلاً ثبت شده است.');
  }

  const national = validateNationalId(employee.nationalId ?? '');
  if (!national.valid) push('nationalId', national.reason ?? 'کد ملی نامعتبر است.');
  const normalizedNational = toLatinDigits(employee.nationalId ?? '').trim();
  if (
    normalizedNational &&
    (context.existingNationalIds ?? []).some((code) => toLatinDigits(code).trim() === normalizedNational)
  ) {
    push('nationalId', 'این کد ملی قبلاً در سامانه ثبت شده است.');
  }

  const idCard = validateIdCardNumber(employee.idCardNumber ?? '');
  if (!idCard.valid) push('idCardNumber', idCard.reason ?? 'شماره شناسنامه نامعتبر است.');

  if (!employee.birthDate || !employee.birthDate.jy || !employee.birthDate.jm || !employee.birthDate.jd) {
    push('birthDate', 'تاریخ تولد (شمسی) را وارد کنید.');
  } else if (employee.birthDate.jy > 1405) {
    push('birthDate', 'سال تولد نمی‌تواند بزرگ‌تر از سال جاری باشد.');
  }

  if (!employee.hireDate || !employee.hireDate.jy) {
    push('hireDate', 'تاریخ استخدام را وارد کنید.');
  }

  if (isBlank(employee.position)) push('position', 'سمت سازمانی را وارد کنید.');
  if (isBlank(employee.departmentId)) push('departmentId', 'دپارتمان را انتخاب کنید.');

  if (!isBlank(employee.insuranceNumber)) {
    const insurance = validateInsuranceNumber(employee.insuranceNumber ?? '');
    if (!insurance.valid) push('insuranceNumber', insurance.reason ?? 'شماره بیمه نامعتبر است.');
  }

  if (employee.bankAccount) {
    const iban = validateIranIban(employee.bankAccount.iban ?? '');
    if (!iban.valid) push('bankAccount', iban.reason ?? 'شماره شبا نامعتبر است.');
    if (isBlank(employee.bankAccount.bankName)) push('bankAccount', 'نام بانک را انتخاب کنید.');
  }

  const base = employee.salary?.baseMonthly ?? 0;
  if (!Number.isFinite(base) || base <= 0) {
    push('baseMonthly', 'پایه حقوق ماهانه باید عددی بزرگ‌تر از صفر باشد.');
  }

  for (const child of employee.children ?? []) {
    if (!child.birthDate || !child.birthDate.jy) {
      push('children', 'تاریخ تولد همه فرزندان باید ثبت شود.');
      break;
    }
  }

  return issues;
}
