import { beforeEach, describe, expect, it } from 'vitest';
import { validateInsuranceNumber, validateNationalId } from '@dastmozd/core';
import { db } from '../schema';
import { seedDemoData } from '../seed';
import { listEmployees, employeeStatistics } from '../repositories/employees';
import { attendanceOfPeriod } from '../repositories/attendance';
import {
  listPayrollRuns,
  lockPayrollRun,
  payslipsOfRun,
  runPayroll,
  unlockPayrollRun,
} from '../repositories/payroll';
import { insertThroughUpsert } from './helpers.test-utils';

beforeEach(async () => {
  await Promise.all([
    db.companies.clear(),
    db.departments.clear(),
    db.employees.clear(),
    db.attendance.clear(),
    db.payrollRuns.clear(),
    db.payslips.clear(),
    db.auditLog.clear(),
    db.loans.clear(),
  ]);
});

describe('داده نمونه سامانه', () => {
  it('پنج کارمند نمونه با کد ملی معتبر ساخته می‌شود', async () => {
    const result = await seedDemoData();
    expect(result.employees).toBe(5);
    expect(result.departments).toBe(5);

    const page = await listEmployees({ companyId: result.companyId, pageSize: 10 });
    expect(page.total).toBe(5);
    // ترتیب پیش‌فرض بر پایه نام خانوادگی با هم‌گذاری الفبای فارسی است.
    expect(new Set(page.rows.map((employee) => employee.personnelCode))).toEqual(
      new Set(['AR-1001', 'AR-1002', 'AR-1003', 'AR-1004', 'AR-1005']),
    );
    // کد ملی و شماره بیمه باید از اعتبارسنجی قانونی عبور کنند تا داده نمونه
    // برای آموزش و آزمون محاسبه واقعی قابل استفاده باشد.
    expect(page.rows.every((employee) => validateNationalId(employee.nationalId).valid)).toBe(true);
    expect(
      page.rows.every((employee) => validateInsuranceNumber(employee.insuranceNumber ?? '').valid),
    ).toBe(true);
    expect(page.rows.every((employee) => employee.salary.baseMonthly >= 166_255_500)).toBe(true);
  });

  it('کارکرد ماهانه برای همه کارکنان ثبت می‌شود', async () => {
    await seedDemoData();
    const records = await attendanceOfPeriod(1405, 7);
    expect(records.length).toBeGreaterThan(100);
    expect(records.every((record) => record.date.startsWith('2026-'))).toBe(true);
  });

  it('آمار کارکنان برای داشبورد محاسبه می‌شود', async () => {
    const { companyId } = await seedDemoData();
    const stats = await employeeStatistics(companyId);
    expect(stats.active).toBe(5);
    expect(stats.averageBaseSalary).toBeGreaterThan(100_000_000);
  });
});

describe('اجرای دوره حقوقی', () => {
  it('محاسبه گروهی، نسخه اول دوره را می‌سازد و فیش‌ها را ذخیره می‌کند', async () => {
    const { companyId } = await seedDemoData();
    const progress: number[] = [];
    const { run, results } = await runPayroll({
      companyId,
      jy: 1405,
      jm: 7,
      onProgress: (done) => progress.push(done),
    });

    expect(results).toHaveLength(5);
    expect(progress.at(-1)).toBe(5);
    expect(run.version).toBe(1);
    expect(run.status).toBe('calculated');
    expect(run.totals.employeeCount).toBe(5);
    expect(run.totals.netPay).toBeGreaterThan(0);
    expect(run.totals.employerCost).toBeGreaterThan(run.totals.netPay);
    expect(run.meta.legalProfileYear).toBe(1405);
    expect(run.changeLog[0]).toContain('RUN-1405-07');

    const slips = await payslipsOfRun(run.id);
    expect(slips).toHaveLength(5);
    expect(slips[0]?.trace.length).toBeGreaterThan(5);
    expect(slips.every((slip) => slip.verificationCode.startsWith('DM-1405-07'))).toBe(true);
  });

  it('اجرای مجدد همان ماه نسخه جدید می‌سازد و تاریخچه حفظ می‌شود', async () => {
    const { companyId } = await seedDemoData();
    const first = await runPayroll({ companyId, jy: 1405, jm: 7 });
    const second = await runPayroll({ companyId, jy: 1405, jm: 7 });
    expect(second.run.version).toBe(2);
    const runs = await listPayrollRuns(companyId);
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.id)).toContain(first.run.id);
  });

  it('کارمند غیرفعال در محاسبه گروهی لحاظ نمی‌شود', async () => {
    const { companyId } = await seedDemoData();
    const employees = await db.employees.where('companyId').equals(companyId).toArray();
    const target = employees[0];
    if (target) await db.employees.update(target.id, { status: 'terminated' });
    const { results } = await runPayroll({ companyId, jy: 1405, jm: 7 });
    expect(results).toHaveLength(4);
  });

  it('انتخاب کارکنان مشخص برای محاسبه پشتیبانی می‌شود', async () => {
    const { companyId } = await seedDemoData();
    const employees = await db.employees.where('companyId').equals(companyId).toArray();
    const selected = employees.slice(0, 2).map((employee) => employee.id);
    const { results } = await runPayroll({ companyId, jy: 1405, jm: 7, employeeIds: selected });
    expect(results).toHaveLength(2);
  });
});

describe('قفل دوره حقوقی', () => {
  it('پس از قفل، کارکرد دوره قابل ویرایش نیست', async () => {
    const { companyId } = await seedDemoData();
    const { run } = await runPayroll({ companyId, jy: 1405, jm: 7 });
    const locked = await lockPayrollRun(run.id);
    expect(locked.status).toBe('locked');
    expect(locked.lockedAt).toBeTruthy();

    const record = (await attendanceOfPeriod(1405, 7))[0];
    expect(record?.payrollRunId).toBe(run.id);
    await expect(insertThroughUpsert(record!)).rejects.toThrow(/قفل/);
  });

  it('بازکردن قفل توسط مدیر، ویرایش را ممکن می‌کند', async () => {
    const { companyId } = await seedDemoData();
    const { run } = await runPayroll({ companyId, jy: 1405, jm: 7 });
    await lockPayrollRun(run.id);
    const unlocked = await unlockPayrollRun(run.id);
    expect(unlocked.status).toBe('calculated');
    const record = (await attendanceOfPeriod(1405, 7))[0];
    await expect(insertThroughUpsert(record!)).resolves.toBeTruthy();
  });
});
