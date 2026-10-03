import { describe, expect, it } from 'vitest';
import type { CompanyProfile, Employee, Payslip } from '@dastmozd/types';
import { buildInsuranceDiskette } from '../documents';

const COMPANY = {
  id: 'cmp-1',
  name: 'شرکت صنعت بسته‌بندی نقش آرمانی',
  workshopCode: '8412345678',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
} as unknown as CompanyProfile;

const EMPLOYEE = {
  id: 'emp-1',
  personnelCode: 'AR-1001',
  firstName: 'علی',
  lastName: 'محمدی',
  nationalId: '0084575948',
  insuranceNumber: '1234567890',
  hireDate: { jy: 1398, jm: 1, jd: 1 },
} as unknown as Employee;

function slip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    id: 'slip-1',
    employeeId: 'emp-1',
    period: { jy: 1405, jm: 7 },
    earnings: [
      {
        key: 'base-wage',
        title: 'مزد پایه',
        type: 'earning',
        amount: 166_255_500,
        quantity: 30,
        unit: 'day',
      },
    ],
    deductions: [],
    tax: { total: 0 },
    insurance: {
      base: 223_255_500,
      employeeShare: 15_627_885,
      employerShare: 51_348_765,
    },
    totals: { grossEarnings: 223_255_500, netPay: 207_627_615 },
    employerCost: { total: 274_604_265 },
    trace: [],
    warnings: [],
    verificationCode: 'DM-1405-07-AR1001',
    createdAt: '2025-10-01T00:00:00.000Z',
    updatedAt: '2025-10-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Payslip;
}

describe('buildInsuranceDiskette', () => {
  it('رکورد سرآیند، رکورد کارمند و رکورد جمع را می‌سازد', () => {
    const result = buildInsuranceDiskette({
      payslips: [slip()],
      employees: [EMPLOYEE],
      company: COMPANY,
      jy: 1405,
      jm: 7,
    });

    const lines = result.content.split('\r\n');
    expect(result.fileName).toBe('DSK-140507.txt');
    expect(result.recordCount).toBe(1);
    expect(result.totalInsurance).toBe(15_627_885 + 51_348_765);

    // رکورد سرآیند: نوع، کد کارگاه ۱۰ رقمی، نام کارگاه ۳۰ نویسه، دوره و تعداد.
    expect(lines[0]?.startsWith('H8412345678')).toBe(true);
    expect(lines[0]).toContain('140507');
    expect(lines[0]).toContain('00001');

    // رکورد کارمند: نوع، ردیف ۴ رقمی، شماره بیمه ۱۲ رقمی و کد ملی ۱۰ رقمی.
    const detail = lines[1] ?? '';
    expect(detail.startsWith('D0001')).toBe(true);
    expect(detail).toContain('001234567890');
    expect(detail).toContain('0084575948');
    expect(detail.length).toBeGreaterThan(100);

    expect(lines[2]?.startsWith('T00001')).toBe(true);
  });

  it('روزهای کارکرد را از سطر مزد پایه استخراج می‌کند', () => {
    const result = buildInsuranceDiskette({
      payslips: [slip()],
      employees: [EMPLOYEE],
      company: COMPANY,
      jy: 1405,
      jm: 7,
    });

    const detail = result.content.split('\r\n')[1] ?? '';
    // ترتیب فیلدها: نوع، ردیف، شماره بیمه، کد ملی، نام خانوادگی، نام، تاریخ استخدام،
    // روزهای کارکرد، پایه بیمه، مزد روزانه، سهم کارگر، سهم کارفرما.
    expect(detail.startsWith('D0001')).toBe(true);
    expect(detail.slice(72, 80)).toBe('13980101');
    expect(detail.slice(80, 82)).toBe('30');
  });

  it('فیش‌های بدون پایه بیمه را حذف و شماره بیمه ناقص را هشدار می‌دهد', () => {
    const withoutInsurance = {
      ...EMPLOYEE,
      id: 'emp-2',
      personnelCode: 'AR-1002',
      insuranceNumber: undefined,
    } as unknown as Employee;

    const result = buildInsuranceDiskette({
      payslips: [
        slip(),
        slip({ id: 'slip-2', employeeId: 'emp-2' }),
        slip({
          id: 'slip-3',
          employeeId: 'emp-3',
          insurance: { base: 0, employeeShare: 0, employerShare: 0 } as never,
        }),
      ],
      employees: [EMPLOYEE, withoutInsurance],
      company: COMPANY,
      jy: 1405,
      jm: 7,
    });

    expect(result.recordCount).toBe(2);
    expect(result.warnings.join(' ')).toContain('شماره بیمه ثبت نشده است');
  });

  it('فیش بدون کارمند متناظر را نادیده می‌گیرد و هشدار می‌دهد', () => {
    const result = buildInsuranceDiskette({
      payslips: [slip({ id: 'slip-9', employeeId: 'emp-unknown' })],
      employees: [EMPLOYEE],
      company: COMPANY,
      jy: 1405,
      jm: 7,
    });

    expect(result.warnings.join(' ')).toContain('یافت نشد');
  });
});
