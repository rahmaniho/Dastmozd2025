import {
  calculatePayroll,
  emptyAttendance,
  jalaliMonthLength,
  jalaliToGregorianIso,
  makeRunCode,
  summarizeAttendance,
} from '@dastmozd/core';
import type {
  AttendanceSummary,
  ExtraDeduction,
  ExtraEarning,
  PayrollEmployee,
  PayrollInput as EngineInput,
  PayrollResult,
} from '@dastmozd/core';
import type { EarningComponentKey, PayrollRun, Payslip } from '@dastmozd/types';
import { installmentForPeriod } from './loans';
import { legalProfileHash, resolveLegalProfile } from '@dastmozd/legal';
import { db } from '../schema';
import { DataError, auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

export interface RunPayrollOptions {
  companyId: string;
  jy: number;
  jm: number;
  /** کارکنان انتخاب‌شده؛ در صورت نبود، همه کارکنان فعال محاسبه می‌شوند. */
  employeeIds?: string[];
  runId?: string;
  actorId?: string;
  actorName?: string;
  /** به‌روزرسانی نسخه موجود یا ایجاد نسخه جدید. */
  createNewVersion?: boolean;
  /** مزایای دستی هر کارمند (کلید: شناسه کارمند) — از گام «مزایا»ی ویزارد. */
  earningsByEmployee?: Record<string, ExtraEarning[]>;
  /** کسورات دستی هر کارمند (کلید: شناسه کارمند) — از گام «کسورات»ی ویزارد. */
  deductionsByEmployee?: Record<string, ExtraDeduction[]>;
  /**
   * افزودن خودکار قسط وام‌های جاری هر کارمند به کسورات.
   * به‌صورت پیش‌فرض خاموش است تا محاسبه صرفاً بر پایه ورودی صریح انجام شود.
   */
  includeLoanInstallments?: boolean;
  onProgress?: (done: number, total: number) => void;
  options?: EngineInput['options'];
}

/** تبدیل پرونده کارمند به ورودی موتور محاسباتی. */
export function toPayrollEmployee(
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    personnelCode: string;
    nationalId: string;
    insuranceNumber?: string;
    hireDate: { jy: number; jm: number; jd: number };
    maritalStatus: 'single' | 'married';
    children: Array<{
      birthDate: { jy: number; jm: number; jd: number };
      isDisabled?: boolean;
      isStudent?: boolean;
    }>;
    contractType: PayrollEmployee['contractType'];
    status: PayrollEmployee['status'];
    salary: {
      baseMonthly: number;
      seniorityMonthly: number;
      housingMonthly?: number;
      groceryMonthly?: number;
      marriageMonthly?: number;
      extraFixedAllowances?: Array<{ title: string; amount: number; componentKey?: string }>;
    };
  },
  period: { jy: number; jm: number },
): PayrollEmployee {
  // فقط فرزندان واجد شرایط (زیر ۱۸ سال یا دارای معلولیت/اشتغال به تحصیل) شمرده می‌شوند.
  const eligibleChildren = employee.children.filter((child) => {
    const age = period.jy - child.birthDate.jy;
    return child.isDisabled || child.isStudent || age < 18;
  });

  return {
    id: employee.id,
    fullName: `${employee.firstName} ${employee.lastName}`,
    personnelCode: employee.personnelCode,
    nationalId: employee.nationalId,
    ...(employee.insuranceNumber ? { insuranceNumber: employee.insuranceNumber } : {}),
    hireDate: employee.hireDate,
    maritalStatus: employee.maritalStatus,
    childCount: eligibleChildren.length,
    contractType: employee.contractType,
    status: employee.status,
    wage: {
      baseMonthly: employee.salary.baseMonthly,
      seniorityMonthly: employee.salary.seniorityMonthly,
      ...(employee.salary.housingMonthly !== undefined
        ? { housingMonthly: employee.salary.housingMonthly }
        : {}),
      ...(employee.salary.groceryMonthly !== undefined
        ? { groceryMonthly: employee.salary.groceryMonthly }
        : {}),
      ...(employee.salary.marriageMonthly !== undefined
        ? { marriageMonthly: employee.salary.marriageMonthly }
        : {}),
      extraFixed: (employee.salary.extraFixedAllowances ?? []).map((item) => ({
        key: (item.componentKey ?? 'other-benefit') as EarningComponentKey,
        title: item.title,
        amount: item.amount,
      })),
    },
  };
}

/**
 * اجرای محاسبه حقوق یک ماه برای یک یا همه کارکنان.
 *
 * نتیجه همیشه به‌صورت «نسخه» ذخیره می‌شود؛ اجرای مجدد همان ماه نسخه تازه می‌سازد
 * تا تاریخچه محاسبات و امکان بازگشت به نسخه پیشین حفظ شود.
 */
export async function runPayroll(options: RunPayrollOptions): Promise<{
  run: PayrollRun;
  results: PayrollResult[];
}> {
  const { companyId, jy, jm } = options;
  const company = await db.companies.get(companyId);
  if (!company) throw new DataError('شرکت انتخاب‌شده یافت نشد.', 'COMPANY_NOT_FOUND');

  const periodDays = jalaliMonthLength(jy, jm);
  const resolved = resolveLegalProfile(jy);
  const profile = resolved.profile;

  let employees = await db.employees.where('companyId').equals(companyId).toArray();
  employees = employees.filter((employee) => !employee.deletedAt);
  if (options.employeeIds && options.employeeIds.length > 0) {
    const selected = new Set(options.employeeIds);
    employees = employees.filter((employee) => selected.has(employee.id));
  }
  employees = employees.filter((employee) => employee.status === 'active');
  if (employees.length === 0) {
    throw new DataError('هیچ کارمند فعالی برای محاسبه حقوق یافت نشد.', 'NO_EMPLOYEES');
  }

  const fromIso = jalaliToGregorianIso({ jy, jm, jd: 1 });
  const toIso = jalaliToGregorianIso({ jy, jm, jd: periodDays });
  const records = (
    await db.attendance.where('date').between(fromIso, toIso, true, true).toArray()
  ).filter((record) => !record.deletedAt);

  const results: PayrollResult[] = [];
  const total = employees.length;

  for (let index = 0; index < total; index += 1) {
    const employee = employees[index];
    if (!employee) continue;
    const employeeRecords = records.filter((record) => record.employeeId === employee.id);
    const attendance: AttendanceSummary =
      employeeRecords.length > 0
        ? summarizeAttendance(employeeRecords, periodDays, { dailyHours: profile.dailyHours })
        : (() => {
            const summary = emptyAttendance(periodDays);
            summary.presentDays = periodDays;
            return summary;
          })();

    const extraEarnings = options.earningsByEmployee?.[employee.id] ?? [];
    const extraDeductions: ExtraDeduction[] = [
      ...(options.deductionsByEmployee?.[employee.id] ?? []),
    ];
    if (options.includeLoanInstallments) {
      const loans = await db.loans.where('employeeId').equals(employee.id).toArray();
      for (const loan of loans) {
        const amount = installmentForPeriod(loan, { jy, jm });
        if (amount > 0) {
          extraDeductions.push({
            key: 'loan',
            title: `قسط وام ${loan.title}`,
            amount,
            note: `قسط ${loan.paidInstallments + 1} از ${loan.installmentCount}`,
          });
        }
      }
    }

    const input: EngineInput = {
      employee: toPayrollEmployee(employee, { jy, jm }),
      period: { jy, jm, days: periodDays },
      attendance,
      profile,
      ...(extraEarnings.length > 0 ? { earnings: extraEarnings } : {}),
      ...(extraDeductions.length > 0 ? { deductions: extraDeductions } : {}),
      company: {
        insuranceBeforeTax: company.payroll.insuranceBeforeTax,
        prorateBenefits: company.payroll.prorateBenefits,
        latePenaltyEnabled: company.payroll.latePenaltyEnabled,
        ...(company.payroll.latePenaltyPerMinute !== undefined
          ? { latePenaltyPerMinute: company.payroll.latePenaltyPerMinute }
          : {}),
        roundPayout: company.payroll.roundPayout,
        roundingStep: company.workSchedule.roundingStep,
      },
      options: {
        ...(options.options ?? {}),
        applyFlatTaxSegments: profile.tax.flatSegments.length > 0,
      },
      calculatedAt: new Date().toISOString(),
      ...(options.actorName ? { calculatedBy: options.actorName } : {}),
    };
    results.push(calculatePayroll(input));
    options.onProgress?.(index + 1, total);
  }

  const existingVersions = await db.payrollRuns
    .where('[companyId+period.jy+period.jm]')
    .equals([companyId, jy, jm])
    .toArray();
  const previousRun = existingVersions.sort((a, b) => b.version - a.version)[0];
  const version =
    options.createNewVersion === false && previousRun
      ? previousRun.version
      : (previousRun?.version ?? 0) + 1;

  const totals = results.reduce(
    (acc, result) => ({
      employeeCount: acc.employeeCount + 1,
      grossEarnings: acc.grossEarnings + result.totals.grossEarnings,
      netPay: acc.netPay + result.totals.netPay,
      tax: acc.tax + result.tax.total,
      employeeInsurance: acc.employeeInsurance + result.insurance.employeeShare,
      employerInsurance: acc.employerInsurance + result.employerCost.employerInsurance,
      employerCost: acc.employerCost + result.employerCost.total,
    }),
    {
      employeeCount: 0,
      grossEarnings: 0,
      netPay: 0,
      tax: 0,
      employeeInsurance: 0,
      employerInsurance: 0,
      employerCost: 0,
    },
  );

  const stamp = auditStamp(options.actorId);
  const runId = options.runId ?? makeId('run');
  const run: PayrollRun = {
    id: runId,
    companyId,
    period: { jy, jm },
    periodDays,
    status: 'calculated',
    version,
    meta: {
      engineVersion: results[0]?.meta.engineVersion ?? '1.0.0',
      legalProfileYear: profile.year,
      legalProfileHash: legalProfileHash(profile),
      calculatedAt: stamp.createdAt,
      ...(options.actorId ? { calculatedBy: options.actorId } : {}),
      currency: 'IRR',
    },
    totals,
    changeLog: [
      `کد یکتای دوره: ${makeRunCode(jy, jm, version, `${companyId}|${totals.netPay}`)}`,
      `محاسبه حقوق ${profile.label} برای ${totals.employeeCount} کارمند اجرا شد (نسخه ${version}).`,
      ...(previousRun
        ? [`نسخه پیشین (${previousRun.version}) بدون تغییر در تاریخچه باقی ماند.`]
        : []),
      ...(resolved.warning ? [resolved.warning] : []),
    ],
    ...stamp,
  };

  await db.transaction('rw', db.payrollRuns, db.payslips, async () => {
    await db.payrollRuns.put(run);
    // حذف فیش‌های نسخه‌ای که بازنویسی می‌شود.
    if (options.runId) {
      await db.payslips.where('payrollRunId').equals(options.runId).delete();
    }
    for (const result of results) {
      const payslip: Payslip = {
        id: makeId('slip'),
        payrollRunId: runId,
        employeeId: result.employeeId,
        period: { jy, jm },
        earnings: result.earnings,
        deductions: result.deductions,
        tax: result.tax,
        insurance: result.insurance,
        totals: result.totals,
        employerCost: result.employerCost,
        trace: result.trace,
        warnings: result.warnings,
        verificationCode: result.verificationCode,
        ...stamp,
      };
      await db.payslips.add(payslip);
    }
  });

  await recordAudit({
    action: 'calculate',
    entityType: 'payroll-run',
    entityId: runId,
    summary: `محاسبه حقوق ${profile.label} برای ${totals.employeeCount} کارمند (نسخه ${version}) انجام شد.`,
    ...(options.actorId ? { actorId: options.actorId } : {}),
  });

  return { run, results };
}

export async function listPayrollRuns(companyId: string): Promise<PayrollRun[]> {
  const runs = await db.payrollRuns.where('companyId').equals(companyId).toArray();
  return runs.sort(
    (a, b) => b.period.jy - a.period.jy || b.period.jm - a.period.jm || b.version - a.version,
  );
}

export async function getPayrollRun(id: string): Promise<PayrollRun | undefined> {
  return db.payrollRuns.get(id);
}

export async function payslipsOfRun(runId: string): Promise<Payslip[]> {
  return db.payslips.where('payrollRunId').equals(runId).toArray();
}

export async function listPayslips(employeeId: string): Promise<Payslip[]> {
  const rows = await db.payslips.where('employeeId').equals(employeeId).toArray();
  return rows.sort((a, b) => b.period.jy - a.period.jy || b.period.jm - a.period.jm);
}

/**
 * قفل دوره حقوقی — پس از قفل، کارکرد و فیش‌های آن دوره قابل ویرایش نیستند.
 * این کار برای حفظ یکپارچگی اسناد مالیاتی و بیمه انجام می‌شود.
 */
export async function lockPayrollRun(runId: string, actorId?: string): Promise<PayrollRun> {
  const run = await db.payrollRuns.get(runId);
  if (!run) throw new DataError('دوره حقوقی یافت نشد.', 'RUN_NOT_FOUND');
  if (run.status === 'locked') return run;

  const now = new Date().toISOString();
  const updated: PayrollRun = {
    ...run,
    status: 'locked',
    lockedAt: now,
    ...(actorId ? { lockedBy: actorId } : {}),
    updatedAt: now,
    changeLog: [...run.changeLog, 'دوره حقوقی قفل شد و از این پس قابل ویرایش نیست.'],
  };
  await db.payrollRuns.put(updated);

  // اتصال کارکردهای این ماه به دوره، تا ویرایش آن‌ها مسدود شود.
  const from = jalaliToGregorianIso({ jy: run.period.jy, jm: run.period.jm, jd: 1 });
  const to = jalaliToGregorianIso({ jy: run.period.jy, jm: run.period.jm, jd: run.periodDays });
  const records = await db.attendance.where('date').between(from, to, true, true).toArray();
  await db.transaction('rw', db.attendance, async () => {
    for (const record of records) {
      await db.attendance.update(record.id, { payrollRunId: runId });
    }
  });

  await recordAudit({
    action: 'lock',
    entityType: 'payroll-run',
    entityId: runId,
    summary: `دوره ${run.period.jm}/${run.period.jy} قفل شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return updated;
}

/** بازکردن قفل دوره — فقط برای مدیر سیستم و با ثبت در گزارش حسابرسی. */
export async function unlockPayrollRun(runId: string, actorId?: string): Promise<PayrollRun> {
  const run = await db.payrollRuns.get(runId);
  if (!run) throw new DataError('دوره حقوقی یافت نشد.', 'RUN_NOT_FOUND');
  const now = new Date().toISOString();
  const updated: PayrollRun = {
    ...run,
    status: 'calculated',
    updatedAt: now,
    changeLog: [...run.changeLog, 'قفل دوره توسط مدیر سیستم باز شد.'],
  };
  await db.payrollRuns.put(updated);

  const records = await db.attendance.where('payrollRunId').equals(runId).toArray();
  await db.transaction('rw', db.attendance, async () => {
    for (const record of records) {
      await db.attendance.update(record.id, { payrollRunId: null });
    }
  });

  await recordAudit({
    action: 'unlock',
    entityType: 'payroll-run',
    entityId: runId,
    summary: `قفل دوره ${run.period.jm}/${run.period.jy} باز شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return updated;
}

/** جمع ماهانه حقوق در یک سال شمسی — برای نمودار روند ۱۲ ماه. */
export async function monthlyPayrollTrend(
  companyId: string,
  jy: number,
): Promise<Array<{ month: number; gross: number; net: number; employerCost: number }>> {
  const runs = (await db.payrollRuns.where('companyId').equals(companyId).toArray()).filter(
    (run) => run.period.jy === jy,
  );
  const latestByMonth = new Map<number, PayrollRun>();
  for (const run of runs) {
    const current = latestByMonth.get(run.period.jm);
    if (!current || current.version < run.version) latestByMonth.set(run.period.jm, run);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const run = latestByMonth.get(index + 1);
    return {
      month: index + 1,
      gross: run?.totals.grossEarnings ?? 0,
      net: run?.totals.netPay ?? 0,
      employerCost: run?.totals.employerCost ?? 0,
    };
  });
}
