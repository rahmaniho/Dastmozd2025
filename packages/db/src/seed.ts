import { PROFILE_1405 } from '@dastmozd/legal';
import type { AttendanceRecord, Department, Employee, EmployeeChild } from '@dastmozd/types';
import { db } from './schema';
import { auditStamp, makeId } from './helpers';
import { createDefaultCompany, saveCompany } from './repositories/companies';
import { saveDepartment } from './repositories/employees';
import { jalaliToGregorianIso } from '@dastmozd/core';

/**
 * داده نمونه واقعی برای آغاز کار.
 *
 * پنج کارمند نمونه با کد ملی معتبر (چک‌سام‌شده)، دپارتمان‌های واقعی یک کارخانه
 * بسته‌بندی و کارکرد ماه مهر ۱۴۰۵ ساخته می‌شود تا کاربر بتواند بی‌درنگ یک دوره
 * حقوقی کامل را آزمایش کند.
 */

interface SeedEmployee {
  personnelCode: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalId: string;
  idCardNumber: string;
  birthDate: { jy: number; jm: number; jd: number };
  gender: 'male' | 'female';
  maritalStatus: 'single' | 'married';
  children: EmployeeChild[];
  education: Employee['education'];
  position: string;
  departmentKey: string;
  hireDate: { jy: number; jm: number; jd: number };
  contractType: Employee['contractType'];
  baseMonthly: number;
  seniorityMonthly: number;
  insuranceNumber: string;
  iban: string;
  bankName: string;
  /** الگوی کارکرد ماهانه این کارمند در داده نمونه. */
  attendance: {
    present: number;
    overtimeHours: number;
    nightHours: number;
    holidayHours: number;
    paidLeave: number;
    absence: number;
    unpaidLeave: number;
    missionDays: number;
  };
}

const CHILD = (jy: number, jm: number, jd: number, id: string): EmployeeChild => ({
  id,
  birthDate: { jy, jm, jd },
});

const SEED_EMPLOYEES: SeedEmployee[] = [
  {
    personnelCode: 'AR-1001',
    firstName: 'سمیه',
    lastName: 'رحیمی',
    fatherName: 'محمد',
    nationalId: '1234567891',
    idCardNumber: '2841',
    birthDate: { jy: 1365, jm: 4, jd: 12 },
    gender: 'female',
    maritalStatus: 'married',
    children: [CHILD(1392, 2, 5, 'ch-1'), CHILD(1396, 8, 21, 'ch-2')],
    education: 'bachelor',
    position: 'کارشناس ارشد حسابداری',
    departmentKey: 'finance',
    hireDate: { jy: 1394, jm: 2, jd: 1 },
    contractType: 'official',
    baseMonthly: 420_000_000,
    seniorityMonthly: PROFILE_1405.seniorityMonthly,
    insuranceNumber: '1234567890',
    iban: 'IR170170000000123456789012',
    bankName: 'بانک ملی ایران',
    attendance: {
      present: 30,
      overtimeHours: 12,
      nightHours: 0,
      holidayHours: 0,
      paidLeave: 0,
      absence: 0,
      unpaidLeave: 0,
      missionDays: 0,
    },
  },
  {
    personnelCode: 'AR-1002',
    firstName: 'علی',
    lastName: 'موسوی',
    fatherName: 'حسن',
    nationalId: '0084575948',
    idCardNumber: '1937',
    birthDate: { jy: 1372, jm: 9, jd: 3 },
    gender: 'male',
    maritalStatus: 'single',
    children: [],
    education: 'diploma',
    position: 'اپراتور خط تولید',
    departmentKey: 'production',
    hireDate: { jy: 1402, jm: 6, jd: 15 },
    contractType: 'labour',
    baseMonthly: PROFILE_1405.minMonthlyWage,
    seniorityMonthly: PROFILE_1405.seniorityMonthly,
    insuranceNumber: '2045871236',
    iban: 'IR120120000000204587123600',
    bankName: 'بانک ملت',
    attendance: {
      present: 26,
      overtimeHours: 34,
      nightHours: 18,
      holidayHours: 8,
      paidLeave: 2,
      absence: 1,
      unpaidLeave: 1,
      missionDays: 0,
    },
  },
  {
    personnelCode: 'AR-1003',
    firstName: 'زهرا',
    lastName: 'کاظمی',
    fatherName: 'رضا',
    nationalId: '0930123451',
    idCardNumber: '4125',
    birthDate: { jy: 1378, jm: 1, jd: 27 },
    gender: 'female',
    maritalStatus: 'single',
    children: [],
    education: 'master',
    position: 'کارشناس کنترل کیفیت',
    departmentKey: 'quality',
    hireDate: { jy: 1403, jm: 3, jd: 1 },
    contractType: 'contractual',
    baseMonthly: 260_000_000,
    seniorityMonthly: PROFILE_1405.seniorityMonthly,
    insuranceNumber: '3190456712',
    iban: 'IR230130000000319045671200',
    bankName: 'بانک رفاه کارگران',
    attendance: {
      present: 29,
      overtimeHours: 6,
      nightHours: 0,
      holidayHours: 0,
      paidLeave: 1,
      absence: 0,
      unpaidLeave: 0,
      missionDays: 1,
    },
  },
  {
    personnelCode: 'AR-1004',
    firstName: 'محسن',
    lastName: 'تبریزی',
    fatherName: 'اکبر',
    nationalId: '1111222231',
    idCardNumber: '7712',
    birthDate: { jy: 1360, jm: 11, jd: 8 },
    gender: 'male',
    maritalStatus: 'married',
    children: [CHILD(1390, 5, 14, 'ch-3'), CHILD(1393, 10, 2, 'ch-4'), CHILD(1399, 12, 19, 'ch-5')],
    education: 'associate',
    position: 'سرپرست انبار',
    departmentKey: 'warehouse',
    hireDate: { jy: 1388, jm: 7, jd: 10 },
    contractType: 'labour',
    baseMonthly: 300_000_000,
    seniorityMonthly: PROFILE_1405.seniorityMonthly,
    insuranceNumber: '1758432906',
    iban: 'IR350180000000175843290600',
    bankName: 'بانک تجارت',
    attendance: {
      present: 28,
      overtimeHours: 20,
      nightHours: 10,
      holidayHours: 4,
      paidLeave: 2,
      absence: 0,
      unpaidLeave: 0,
      missionDays: 0,
    },
  },
  {
    personnelCode: 'AR-1005',
    firstName: 'فاطمه',
    lastName: 'نوری',
    fatherName: 'جواد',
    nationalId: '0079900119',
    idCardNumber: '5563',
    birthDate: { jy: 1375, jm: 7, jd: 30 },
    gender: 'female',
    maritalStatus: 'married',
    children: [CHILD(1400, 3, 11, 'ch-6')],
    education: 'bachelor',
    position: 'کارشناس منابع انسانی',
    departmentKey: 'hr',
    hireDate: { jy: 1400, jm: 1, jd: 20 },
    contractType: 'official',
    baseMonthly: 285_000_000,
    seniorityMonthly: PROFILE_1405.seniorityMonthly,
    insuranceNumber: '2865017439',
    iban: 'IR560150000000286501743900',
    bankName: 'بانک سپه',
    attendance: {
      present: 30,
      overtimeHours: 4,
      nightHours: 0,
      holidayHours: 0,
      paidLeave: 0,
      absence: 0,
      unpaidLeave: 0,
      missionDays: 2,
    },
  },
];

const DEPARTMENTS: Array<{ key: string; title: string; costCenter: string }> = [
  { key: 'finance', title: 'امور مالی و حسابداری', costCenter: 'CC-100' },
  { key: 'production', title: 'خط تولید و بسته‌بندی', costCenter: 'CC-200' },
  { key: 'quality', title: 'کنترل کیفیت', costCenter: 'CC-300' },
  { key: 'warehouse', title: 'انبار و لجستیک', costCenter: 'CC-400' },
  { key: 'hr', title: 'منابع انسانی', costCenter: 'CC-500' },
];

export interface SeedResult {
  companyId: string;
  employees: number;
  attendance: number;
  departments: number;
}

export interface SeedOptions {
  /** سال و ماه شمسی کارکرد نمونه. */
  jy?: number;
  jm?: number;
  /** حذف کامل داده‌های پیشین پیش از بارگذاری نمونه. */
  reset?: boolean;
}

/**
 * بارگذاری داده نمونه. در صورت وجود شرکت فعال، فقط کارکنان موجود تکمیل می‌شوند
 * مگر آنکه `reset` فعال باشد.
 */
export async function seedDemoData(options: SeedOptions = {}): Promise<SeedResult> {
  const jy = options.jy ?? 1405;
  const jm = options.jm ?? 7;

  if (options.reset) {
    await db.transaction(
      'rw',
      [db.companies, db.departments, db.employees, db.attendance, db.payrollRuns, db.payslips],
      async () => {
        await Promise.all([
          db.companies.clear(),
          db.departments.clear(),
          db.employees.clear(),
          db.attendance.clear(),
          db.payrollRuns.clear(),
          db.payslips.clear(),
        ]);
      },
    );
  }

  const company = (await db.companies.toArray())[0] ?? createDefaultCompany();
  if (!(await db.companies.get(company.id))) {
    await db.companies.add(company);
  } else {
    await saveCompany({ ...company, managerName: company.managerName ?? 'مهندس حسین رحمانی' });
  }

  const departmentIds = new Map<string, string>();
  for (const item of DEPARTMENTS) {
    const existing = (await db.departments.where('companyId').equals(company.id).toArray()).find(
      (department) => department.title === item.title,
    );
    const record: Department =
      existing ??
      (await saveDepartment({
        id: makeId('dep'),
        companyId: company.id,
        title: item.title,
        costCenter: item.costCenter,
        ...auditStamp('seed'),
      }));
    departmentIds.set(item.key, record.id);
  }

  let attendanceCount = 0;
  for (const seed of SEED_EMPLOYEES) {
    const existing = await db.employees
      .where('[companyId+status]')
      .equals([company.id, 'active'])
      .filter((employee) => employee.personnelCode === seed.personnelCode)
      .first();
    if (existing) continue;

    const employee: Employee = {
      id: makeId('emp'),
      companyId: company.id,
      personnelCode: seed.personnelCode,
      firstName: seed.firstName,
      lastName: seed.lastName,
      fatherName: seed.fatherName,
      nationalId: seed.nationalId,
      idCardNumber: seed.idCardNumber,
      birthDate: seed.birthDate,
      birthPlace: 'تهران',
      gender: seed.gender,
      maritalStatus: seed.maritalStatus,
      children: seed.children,
      education: seed.education,
      position: seed.position,
      departmentId: departmentIds.get(seed.departmentKey) ?? '',
      hireDate: seed.hireDate,
      contractType: seed.contractType,
      status: 'active',
      insuranceNumber: seed.insuranceNumber,
      bankAccount: {
        iban: seed.iban,
        bankName: seed.bankName,
        accountHolder: `${seed.firstName} ${seed.lastName}`,
      },
      salary: { baseMonthly: seed.baseMonthly, seniorityMonthly: seed.seniorityMonthly },
      notes: 'این پرونده به‌صورت داده نمونه ساخته شده است و برای آزمایش سامانه کاربرد دارد.',
      ...auditStamp('seed'),
    };
    await db.employees.add(employee);

    const records: AttendanceRecord[] = [];
    const pattern = seed.attendance;
    let day = 1;
    const push = (kind: AttendanceRecord['kind'], extra: Partial<AttendanceRecord> = {}): void => {
      if (day > 30) return;
      const date = jalaliToGregorianIso({ jy, jm, jd: day });
      records.push({
        id: makeId('att'),
        employeeId: employee.id,
        date,
        jalali: { jy, jm, jd: day },
        kind,
        ...extra,
        ...auditStamp('seed'),
      });
      day += 1;
    };

    // الگوی کارکرد: دورکاری ناموجود، اضافه‌کار و شب‌کاری در روزهای ابتدایی ماه.
    let overtimeLeft = pattern.overtimeHours;
    let nightLeft = pattern.nightHours;
    let holidayLeft = pattern.holidayHours;
    for (let index = 0; index < pattern.present; index += 1) {
      const overtime = Math.min(2, overtimeLeft);
      overtimeLeft -= overtime;
      const night = Math.min(2, nightLeft);
      nightLeft -= night;
      const holiday = Math.min(4, holidayLeft);
      holidayLeft -= holiday;
      push('present', {
        checkIn: '08:00',
        checkOut: overtime > 0 ? '19:00' : '17:00',
        breakMinutes: 60,
        ...(overtime > 0 ? { overtimeHours: overtime } : {}),
        ...(night > 0 ? { nightHours: night } : {}),
        ...(holiday > 0 ? { holidayHours: holiday } : {}),
      });
    }
    for (let index = 0; index < pattern.paidLeave; index += 1) push('paid-leave', { leaveDays: 1 });
    for (let index = 0; index < pattern.absence; index += 1) push('absence', { leaveDays: 1 });
    for (let index = 0; index < pattern.unpaidLeave; index += 1)
      push('unpaid-leave', { leaveDays: 1 });
    for (let index = 0; index < pattern.missionDays; index += 1)
      push('mission', { missionHours: 8 });

    await db.attendance.bulkAdd(records);
    attendanceCount += records.length;
  }

  return {
    companyId: company.id,
    employees: SEED_EMPLOYEES.length,
    attendance: attendanceCount,
    departments: DEPARTMENTS.length,
  };
}
