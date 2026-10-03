'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  attendanceOfPeriod,
  allActiveEmployees,
  db,
  employeeCountsByDepartment,
  employeeStatistics,
  listCalendarEvents,
  listDepartments,
  listEmployees,
  listPayrollRuns,
  monthlyPayrollTrend,
  payslipsOfRun,
  ensureActiveCompany,
  getSettings,
  listLoans,
} from '@dastmozd/db';
import type { AttendanceRecord, Employee } from '@dastmozd/types';
import type { EmployeeQuery } from '@dastmozd/db';
import { useAppStore } from './store';

/** اطمینان از وجود شرکت فعال و مقدارگذاری شرکت جاری. */
export function useBootstrap(): { ready: boolean; error?: string } {
  const companyId = useAppStore((state) => state.companyId);
  const setCompany = useAppStore((state) => state.setCompany);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const company = await ensureActiveCompany();
        if (!cancelled && companyId !== company.id) setCompany(company.id);
        if (!cancelled) setReady(true);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'خطا در آماده‌سازی پایگاه داده محلی.');
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, setCompany]);

  return { ready, ...(error ? { error } : {}) };
}

/** فهرست کارکنان با پالایه‌های زنده. */
export function useEmployees(query: Partial<EmployeeQuery> & { companyId?: string | null }) {
  const storeCompanyId = useAppStore((state) => state.companyId);
  const companyId = query.companyId ?? storeCompanyId;
  const result = useLiveQuery(
    () =>
      companyId
        ? listEmployees({
            companyId,
            ...(query.search ? { search: query.search } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.contractType ? { contractType: query.contractType } : {}),
            ...(query.sort ? { sort: query.sort } : {}),
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 20,
          })
        : Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 20 }),
    [companyId, query.search, query.departmentId, query.status, query.contractType, query.page, query.pageSize, query.sort?.field, query.sort?.direction],
    undefined,
  );
  return result ?? { rows: [], total: 0, page: 1, pageSize: 20 };
}

export function useDepartments(): { departments: Awaited<ReturnType<typeof listDepartments>>; loading: boolean } {
  const companyId = useAppStore((state) => state.companyId);
  const departments = useLiveQuery(() => (companyId ? listDepartments(companyId) : []), [companyId]);
  return { departments: departments ?? [], loading: departments === undefined };
}

/** شاخص‌های کلیدی داشبورد. */
export function useDashboardStats() {
  const companyId = useAppStore((state) => state.companyId);
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);

  const data = useLiveQuery(
    async () => {
      if (!companyId) return null;
      const [stats, trend, departments, runs, events, loans] = await Promise.all([
        employeeStatistics(companyId),
        monthlyPayrollTrend(companyId, fiscalYear),
        employeeCountsByDepartment(companyId),
        listPayrollRuns(companyId),
        listCalendarEvents(companyId, 8),
        listLoans(companyId),
      ]);
      const currentRun = runs.find(
        (run) => run.period.jy === fiscalYear && run.period.jm === currentMonth,
      );
      return { stats, trend, departments, runs, events, loans, currentRun };
    },
    [companyId, fiscalYear, currentMonth],
    undefined,
  );

  return { data: data ?? null, loading: data === undefined };
}

/** کارکنان فعال برای انتخاب در محاسبه حقوق. */
export function useActiveEmployees(): Employee[] {
  const companyId = useAppStore((state) => state.companyId);
  const employees = useLiveQuery(() => (companyId ? allActiveEmployees(companyId) : []), [companyId]);
  return employees ?? [];
}

/** کارکرد ماه جاری برای شبکه حضور و غیاب. */
export function useAttendanceGrid(): {
  records: AttendanceRecord[];
  loading: boolean;
  byEmployeeDate: Map<string, AttendanceRecord>;
} {
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const records = useLiveQuery(
    () => attendanceOfPeriod(fiscalYear, currentMonth),
    [fiscalYear, currentMonth],
    undefined,
  );

  const byEmployeeDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of records ?? []) map.set(`${record.employeeId}|${record.jalali.jd}`, record);
    return map;
  }, [records]);

  return { records: records ?? [], loading: records === undefined, byEmployeeDate };
}

export function usePayrollRuns() {
  const companyId = useAppStore((state) => state.companyId);
  const runs = useLiveQuery(() => (companyId ? listPayrollRuns(companyId) : []), [companyId]);
  return { runs: runs ?? [], loading: runs === undefined };
}

export function usePayslips(runId: string | null) {
  const slips = useLiveQuery(() => (runId ? payslipsOfRun(runId) : []), [runId]);
  const employees = useActiveEmployees();
  const enriched = useMemo(
    () =>
      (slips ?? []).map((slip) => ({
        slip,
        employee: employees.find((employee) => employee.id === slip.employeeId),
      })),
    [slips, employees],
  );
  return { slips: slips ?? [], enriched, loading: slips === undefined };
}

export function useSettingsLive() {
  const settings = useLiveQuery(() => getSettings(), []);
  return settings ?? null;
}

/** پیمایشگر دوره (سال و ماه شمسی) با محدودسازی به بازه مجاز. */
export function usePeriodNavigator(): {
  jy: number;
  jm: number;
  monthLabel: string;
  next: () => void;
  previous: () => void;
  setPeriod: (jy: number, jm: number) => void;
} {
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const setStorePeriod = useAppStore((state) => state.setPeriod);

  const monthLabel = useMemo(
    () => `${JALALI_MONTH_LABELS[currentMonth - 1] ?? ''} ${currentMonth}`,
    [currentMonth],
  );

  const next = useCallback(() => {
    if (currentMonth === 12) setStorePeriod(fiscalYear + 1, 1);
    else setStorePeriod(fiscalYear, currentMonth + 1);
  }, [currentMonth, fiscalYear, setStorePeriod]);

  const previous = useCallback(() => {
    if (currentMonth === 1) setStorePeriod(fiscalYear - 1, 12);
    else setStorePeriod(fiscalYear, currentMonth - 1);
  }, [currentMonth, fiscalYear, setStorePeriod]);

  return { jy: fiscalYear, jm: currentMonth, monthLabel, next, previous, setPeriod: setStorePeriod };
}

export const JALALI_MONTH_LABELS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** شمارش رکوردهای پایگاه‌داده برای صفحه پشتیبان‌گیری. */
export function useDatabaseCounts() {
  const counts = useLiveQuery(async () => {
    const [employees, attendance, runs, slips, audit] = await Promise.all([
      db.employees.count(),
      db.attendance.count(),
      db.payrollRuns.count(),
      db.payslips.count(),
      db.auditLog.count(),
    ]);
    return { employees, attendance, runs, slips, audit };
  }, []);
  return counts ?? null;
}

/** مانده مرخصی هر کارمند در سال مالی جاری (بر پایه ۲۶ روز استحقاقی سالانه). */
export function useLeaveBalances(): Map<string, { paidUsed: number; sickUsed: number; unpaidUsed: number }> {
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const balances = useLiveQuery(
    async () => {
      const records = await db.attendance.toArray();
      const map = new Map<string, { paidUsed: number; sickUsed: number; unpaidUsed: number }>();
      for (const record of records) {
        if (record.jalali.jy !== fiscalYear) continue;
        const entry = map.get(record.employeeId) ?? { paidUsed: 0, sickUsed: 0, unpaidUsed: 0 };
        if (record.kind === 'paid-leave') entry.paidUsed += 1;
        if (record.kind === 'sick-leave') entry.sickUsed += 1;
        if (record.kind === 'unpaid-leave') entry.unpaidUsed += 1;
        map.set(record.employeeId, entry);
      }
      return map;
    },
    [fiscalYear],
    undefined,
  );
  return balances ?? new Map();
}
