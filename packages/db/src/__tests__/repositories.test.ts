import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { makeId } from '../helpers';
import {
  createDefaultCompany,
  ensureActiveCompany,
  listCompanies,
  saveCompany,
  archiveCompany,
} from '../repositories/companies';
import {
  allActiveEmployees,
  deleteEmployee,
  employeeCountsByDepartment,
  emptyEmployee,
  getEmployee,
  listDepartments,
  listEmployees,
  saveDepartment,
  saveEmployee,
} from '../repositories/employees';
import {
  attendanceOfMonth,
  bulkUpsertAttendance,
  deleteAttendance,
  summarizeEmployeeMonth,
  upsertAttendance,
} from '../repositories/attendance';
import {
  createLoan,
  installmentForPeriod,
  installmentSchedule,
  listLoans,
  registerInstallment,
  upcomingInstallments,
} from '../repositories/loans';
import {
  addManualEvent,
  listCalendarEvents,
  markEventDone,
  syncCalendarEvents,
} from '../repositories/events';
import {
  can,
  createUser,
  defaultSettings,
  deleteUser,
  getSettings,
  roleLabel,
  saveSettings,
  verifyUserPassword,
} from '../repositories/settings';
import { createBackup, listBackups } from '../backup';
import { jalaliToGregorianIso } from '@dastmozd/core';

async function freshCompany() {
  await Promise.all([
    db.companies.clear(),
    db.departments.clear(),
    db.employees.clear(),
    db.attendance.clear(),
    db.loans.clear(),
    db.calendarEvents.clear(),
    db.users.clear(),
    db.backups.clear(),
  ]);
  return ensureActiveCompany();
}

async function makeEmployee(companyId: string, departmentId: string, index = 1) {
  return saveEmployee({
    ...emptyEmployee(companyId, departmentId),
    personnelCode: `AR-90${index}0`,
    firstName: 'کارمند',
    lastName: `آزمون${index}`,
    fatherName: 'پدر',
    nationalId:
      ['1234567891', '0084575948', '0930123451', '1111222231', '0079900119'][index - 1] ??
      '1234567891',
    idCardNumber: '1000',
    birthDate: { jy: 1370, jm: 1, jd: 1 },
    hireDate: { jy: 1398, jm: 1, jd: 1 },
    position: 'کارشناس',
    insuranceNumber: `123456789${index}`,
    salary: { baseMonthly: 200_000_000, seniorityMonthly: 5_000_000 },
  });
}

beforeEach(async () => {
  await freshCompany();
});

describe('شرکت و دپارتمان', () => {
  it('شرکت پیش‌فرض با اطلاعات واقعی ساخته می‌شود', () => {
    const company = createDefaultCompany();
    expect(company.name).toContain('نقش آرمانی');
    expect(company.workSchedule.weeklyHours).toBe(44);
    expect(company.payroll.insuranceBeforeTax).toBe(true);
  });

  it('شرکت تازه ایجاد، ویرایش و بایگانی می‌شود', async () => {
    const company = await ensureActiveCompany();
    expect(await listCompanies()).toHaveLength(1);
    const updated = await saveCompany({ ...company, phone: '021-12345678' }, 'usr-1');
    expect(updated.phone).toBe('021-12345678');
    expect(updated.updatedBy).toBe('usr-1');
    await archiveCompany(company.id, 'usr-1');
    expect(await listCompanies()).toHaveLength(0);
    expect(await listCompanies(true)).toHaveLength(1);
    await expect(saveCompany({ ...company, name: '  ' })).rejects.toThrow(/نام شرکت/);
    await expect(archiveCompany('missing')).rejects.toThrow(/یافت نشد/);
  });

  it('دپارتمان‌ها ساخته و در صورت استفاده حذف نمی‌شوند', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'امور مالی',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(await listDepartments(company.id)).toHaveLength(1);
    await makeEmployee(company.id, department.id);
    const counts = await employeeCountsByDepartment(company.id);
    expect(counts[0]?.count).toBe(1);
  });
});

describe('پرونده کارکنان', () => {
  it('کارمند با اعتبارسنجی کامل ذخیره، جست‌وجو و پالایش می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'تولید',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const employee = await makeEmployee(company.id, department.id, 1);
    expect(employee.id).toMatch(/^emp-/);

    const byName = await listEmployees({ companyId: company.id, search: 'آزمون1' });
    expect(byName.total).toBe(1);
    const byNationalId = await listEmployees({ companyId: company.id, search: '1234567891' });
    expect(byNationalId.total).toBe(1);
    const byDepartment = await listEmployees({
      companyId: company.id,
      departmentId: department.id,
    });
    expect(byDepartment.total).toBe(1);
    const none = await listEmployees({ companyId: company.id, status: 'terminated' });
    expect(none.total).toBe(0);
    expect(await allActiveEmployees(company.id)).toHaveLength(1);
    expect((await getEmployee(employee.id))?.lastName).toBe('آزمون1');
  });

  it('کد ملی نامعتبر و شماره پرسنلی تکراری رد می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'مالی',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await expect(
      saveEmployee({
        ...emptyEmployee(company.id, department.id),
        personnelCode: 'AR-9001',
        firstName: 'الف',
        lastName: 'ب',
        fatherName: 'ج',
        position: 'کارشناس',
        nationalId: '0000000000',
      }),
    ).rejects.toThrow(/ثبت شده|چک‌سام|معتبر/);

    await makeEmployee(company.id, department.id, 2);
    await expect(
      saveEmployee({
        ...emptyEmployee(company.id, department.id),
        personnelCode: 'AR-9020',
        firstName: 'الف',
        lastName: 'ب',
        fatherName: 'ج',
        position: 'کارشناس',
        nationalId: '0084575948',
      }),
    ).rejects.toThrow(/قبلاً/);
  });

  it('کارمند بدون سابقه حقوقی حذف و با سابقه غیرفعال می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'انبار',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const first = await makeEmployee(company.id, department.id, 3);
    const second = await makeEmployee(company.id, department.id, 4);

    const result = await deleteEmployee(first.id, 'usr-1');
    expect(result.soft).toBe(false);
    expect(await getEmployee(first.id)).toBeUndefined();

    // سابقه حقوقی برای کارمند دوم ثبت و سپس حذف درخواست می‌شود.
    await db.payslips.add({
      id: makeId('slip'),
      payrollRunId: 'run-1',
      employeeId: second.id,
      period: { jy: 1405, jm: 7 },
      earnings: [],
      deductions: [],
      tax: {
        taxableIncome: 0,
        exemption: 0,
        afterExemption: 0,
        brackets: [],
        flatTax: 0,
        flatSegments: [],
        total: 0,
        effectiveRate: 0,
      },
      insurance: {
        included: [],
        excluded: [],
        rawBase: 0,
        ceiling: 0,
        base: 0,
        employeeRate: 0.07,
        employerRate: 0.23,
        unemploymentRate: 0.03,
        employeeShare: 0,
        employerShare: 0,
        unemploymentShare: 0,
        totalShare: 0,
      },
      totals: {
        grossEarnings: 0,
        otherDeductions: 0,
        tax: 0,
        insurance: 0,
        totalDeductions: 0,
        netPay: 0,
        payableAmount: 0,
      },
      employerCost: { grossEarnings: 0, employerInsurance: 0, accruals: [], total: 0 },
      trace: [],
      warnings: [],
      verificationCode: 'DM-1405-07-00000000',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const soft = await deleteEmployee(second.id, 'usr-1');
    expect(soft.soft).toBe(true);
    expect((await getEmployee(second.id))?.status).toBe('terminated');
    await expect(deleteEmployee('missing')).rejects.toThrow(/یافت نشد/);
  });
});

describe('کارکرد', () => {
  it('ثبت، ویرایش و جمع‌بندی ماهانه کارکرد عمل می‌کند', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'تولید',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const employee = await makeEmployee(company.id, department.id, 5);

    await upsertAttendance({
      employeeId: employee.id,
      date: jalaliToGregorianIso({ jy: 1405, jm: 7, jd: 1 }),
      jalali: { jy: 1405, jm: 7, jd: 1 },
      kind: 'present',
      checkIn: '08:00',
      checkOut: '20:00',
      breakMinutes: 60,
      overtimeHours: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await upsertAttendance({
      employeeId: employee.id,
      date: jalaliToGregorianIso({ jy: 1405, jm: 7, jd: 2 }),
      jalali: { jy: 1405, jm: 7, jd: 2 },
      kind: 'paid-leave',
      leaveDays: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const month = await attendanceOfMonth(employee.id, 1405, 7);
    expect(month).toHaveLength(2);
    const summary = await summarizeEmployeeMonth(employee.id, 1405, 7);
    expect(summary.presentDays).toBe(1);
    expect(summary.paidLeaveDays).toBe(1);
    expect(summary.overtimeHours).toBe(3);

    // کارمند بدون رکورد، ماه کامل کارکرد فرض می‌شود.
    const fullMonth = await summarizeEmployeeMonth('emp-none', 1405, 7);
    expect(fullMonth.presentDays).toBe(30);

    await deleteAttendance(month[0]!.id);
    expect(await attendanceOfMonth(employee.id, 1405, 7)).toHaveLength(1);
  });

  it('ثبت گروهی کارکرد از فایل ورودی انجام می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'کیفیت',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const employee = await makeEmployee(company.id, department.id, 1);
    const count = await bulkUpsertAttendance(
      [1, 2, 3].map((day) => ({
        employeeId: employee.id,
        date: jalaliToGregorianIso({ jy: 1405, jm: 8, jd: day }),
        jalali: { jy: 1405, jm: 8, jd: day },
        kind: 'present' as const,
        checkIn: '08:00',
        checkOut: '17:00',
        breakMinutes: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    );
    expect(count).toBe(3);
    expect(await attendanceOfMonth(employee.id, 1405, 8)).toHaveLength(3);
  });
});

describe('وام‌ها و رویدادهای تقویم', () => {
  it('وام با زمان‌بندی اقساط ساخته و پرداخت می‌شود', async () => {
    const company = await ensureActiveCompany();
    const loan = await createLoan({
      employeeId: 'emp-1',
      companyId: company.id,
      title: 'وام ضروری',
      principal: 120_000_000,
      installmentCount: 12,
      startPeriod: { jy: 1405, jm: 8 },
    });
    expect(loan.installmentAmount).toBe(10_000_000);
    expect(installmentForPeriod(loan, { jy: 1405, jm: 7 })).toBe(0);
    expect(installmentForPeriod(loan, { jy: 1405, jm: 8 })).toBe(10_000_000);
    expect(installmentForPeriod(loan, { jy: 1406, jm: 8 })).toBe(0);
    expect(installmentSchedule(loan)).toHaveLength(12);

    const updated = await registerInstallment(loan.id, 10_000_000);
    expect(updated.paidInstallments).toBe(1);
    expect(updated.remainingBalance).toBe(110_000_000);
    expect(installmentForPeriod(updated, { jy: 1405, jm: 8 })).toBe(0);
    expect(installmentForPeriod(updated, { jy: 1405, jm: 9 })).toBe(10_000_000);

    const upcoming = await upcomingInstallments(company.id, { jy: 1405, jm: 9 });
    expect(upcoming).toHaveLength(1);

    const settled = await createLoan({
      employeeId: 'emp-2',
      companyId: company.id,
      title: 'وام کوتاه',
      principal: 5_000_000,
      installmentCount: 1,
      startPeriod: { jy: 1405, jm: 8 },
    });
    await registerInstallment(settled.id, 5_000_000);
    expect((await listLoans(company.id)).find((item) => item.id === settled.id)?.status).toBe(
      'settled',
    );
    await expect(
      createLoan({
        employeeId: 'e',
        companyId: company.id,
        title: 'x',
        principal: 0,
        installmentCount: 1,
        startPeriod: { jy: 1405, jm: 1 },
      }),
    ).rejects.toThrow(/بزرگ‌تر از صفر/);
    await expect(
      createLoan({
        employeeId: 'e',
        companyId: company.id,
        title: 'x',
        principal: 100,
        installmentCount: 0,
        startPeriod: { jy: 1405, jm: 1 },
      }),
    ).rejects.toThrow(/حداقل یک/);
    await expect(registerInstallment('missing', 1000)).rejects.toThrow(/یافت نشد/);
  });

  it('رویدادهای خودکار تقویم ساخته و تکمیل می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'منابع انسانی',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const employee = await makeEmployee(company.id, department.id, 2);
    await createLoan({
      employeeId: employee.id,
      companyId: company.id,
      title: 'وام مسکن',
      principal: 24_000_000,
      installmentCount: 12,
      startPeriod: { jy: 1405, jm: 8 },
    });
    const created = await syncCalendarEvents(company.id, { jy: 1405, jm: 7 });
    expect(created).toBeGreaterThanOrEqual(3);
    const secondRun = await syncCalendarEvents(company.id, { jy: 1405, jm: 7 });
    expect(secondRun).toBe(0);

    const events = await listCalendarEvents(company.id);
    expect(events.some((event) => event.kind === 'insurance-due')).toBe(true);
    expect(events.some((event) => event.kind === 'tax-due')).toBe(true);

    const manual = await addManualEvent({
      companyId: company.id,
      title: 'جلسه بررسی حقوق',
      date: '2026-10-20',
      kind: 'task',
      note: 'با حضور مدیر مالی',
    });
    await markEventDone(manual.id);
    const remaining = await listCalendarEvents(company.id);
    expect(remaining.some((event) => event.id === manual.id)).toBe(false);

    // قرارداد موقت با تاریخ پایان، رویداد پایان قرارداد می‌سازد.
    await db.employees.update(employee.id, {
      contractType: 'temporary',
      terminationDate: { jy: 1405, jm: 9, jd: 1 },
    });
    await syncCalendarEvents(company.id, { jy: 1405, jm: 8 });
    const withContract = await listCalendarEvents(company.id);
    expect(withContract.some((event) => event.kind === 'contract-end')).toBe(true);
  });
});

describe('تنظیمات و کاربران', () => {
  it('تنظیمات پیش‌فرض خوانده و به‌روزرسانی می‌شود', async () => {
    const settings = await getSettings();
    expect(settings.locale).toBe('fa-IR');
    expect(settings.analyticsEnabled).toBe(false);
    expect(settings.backupRetention).toEqual(defaultSettings().backupRetention);
    expect(settings.cloudSync.enabled).toBe(false);
    const updated = await saveSettings({ theme: 'dark', persianDigits: false });
    expect(updated.theme).toBe('dark');
    expect(updated.id).toBe('app');
  });

  it('کاربر با گذرواژه هش‌شده ساخته و وارد می‌شود', async () => {
    const user = await createUser({
      fullName: 'سمیه رحیمی',
      username: 's.rahimi',
      role: 'accountant',
      companyIds: ['cmp-1'],
      password: 'Passw0rd!1405',
    });
    expect(user.passwordHash).not.toBe('Passw0rd!1405');
    expect(user.passwordSalt).toBeTruthy();
    await expect(
      createUser({
        fullName: 'x',
        username: 's.rahimi',
        role: 'viewer',
        companyIds: [],
        password: 'Passw0rd!1405',
      }),
    ).rejects.toThrow(/نام کاربری/);
    expect(await verifyUserPassword('s.rahimi', 'wrong')).toBeNull();
    const logged = await verifyUserPassword('s.rahimi', 'Passw0rd!1405');
    expect(logged?.fullName).toBe('سمیه رحیمی');
    expect(roleLabel('admin')).toBe('مدیر سامانه');
    expect(can('accountant', 'payroll.run')).toBe(true);
    expect(can('viewer', 'payroll.run')).toBe(false);
    await deleteUser(user.id);
    expect(await db.users.count()).toBe(0);
  });

  it('آخرین مدیر سامانه حذف نمی‌شود', async () => {
    const admin = await createUser({
      fullName: 'مدیر سامانه',
      username: 'admin',
      role: 'admin',
      companyIds: [],
      password: 'Admin!1405',
    });
    await expect(deleteUser(admin.id)).rejects.toThrow(/آخرین مدیر/);
  });
});

describe('پشتیبان‌های محلی', () => {
  it('پشتیبان با کپی محلی ذخیره می‌شود', async () => {
    const company = await ensureActiveCompany();
    const department = await saveDepartment({
      id: makeId('dep'),
      companyId: company.id,
      title: 'مالی',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await makeEmployee(company.id, department.id, 1);
    const { fileName, content } = await createBackup({
      companyId: company.id,
      companyName: company.name,
      appVersion: '1.0.0',
      keepLocalCopy: true,
    });
    expect(fileName.endsWith('.dastmozd')).toBe(true);
    expect(content).toContain('dastmozd-backup');
    const backups = await listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]?.encrypted).toBe(false);
  });
});
