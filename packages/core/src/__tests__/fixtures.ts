import type { PayrollEmployee, PayrollInput, PayrollPeriodInput } from '../engine/types';
import { emptyAttendance } from '../engine/types';
import { PROFILE_1405 } from '@dastmozd/legal';

/** A minimal, valid single employee used by the golden payroll scenarios. */
export function employee(overrides: Partial<PayrollEmployee> = {}): PayrollEmployee {
  return {
    id: 'emp-1',
    fullName: 'سمیه رحیمی',
    personnelCode: 'AR-1001',
    nationalId: '1234567891',
    insuranceNumber: '1234567890',
    hireDate: { jy: 1398, jm: 1, jd: 1 },
    maritalStatus: 'single',
    childCount: 0,
    contractType: 'labour',
    status: 'active',
    wage: {
      baseMonthly: 166_255_500,
      seniorityMonthly: 5_000_000,
    },
    ...overrides,
  };
}

/** The Jalali month of Mehr 1405 (30 days) used across the scenarios. */
export const PERIOD_1405_07: PayrollPeriodInput = { jy: 1405, jm: 7, days: 30 };

export function input(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    employee: employee(),
    period: PERIOD_1405_07,
    attendance: emptyAttendance(PERIOD_1405_07.days),
    profile: PROFILE_1405,
    calculatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

/** Sum of every earning line of a result, handy for quick assertions. */
export function grossOf(earnings: ReadonlyArray<{ amount: number }>): number {
  return earnings.reduce((total, line) => total + line.amount, 0);
}
