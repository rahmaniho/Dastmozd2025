import { toLatinDigits, validateEmployee } from '@dastmozd/core';
import type { Department, Employee, Paginated } from '@dastmozd/types';
import { db } from '../schema';
import { DataError, auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

export interface EmployeeQuery {
  companyId: string;
  search?: string;
  departmentId?: string;
  status?: Employee['status'];
  contractType?: Employee['contractType'];
  sort?: { field: keyof Employee; direction: 'asc' | 'desc' };
  page?: number;
  pageSize?: number;
}

const COLLATOR = new Intl.Collator('fa-IR');

/** فهرست کارکنان با جست‌وجو، پالایش، مرتب‌سازی و صفحه‌بندی. */
export async function listEmployees(query: EmployeeQuery): Promise<Paginated<Employee>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? 20);

  let rows = await db.employees.where('companyId').equals(query.companyId).toArray();
  rows = rows.filter((employee) => !employee.deletedAt);

  if (query.status) rows = rows.filter((employee) => employee.status === query.status);
  if (query.contractType)
    rows = rows.filter((employee) => employee.contractType === query.contractType);
  if (query.departmentId)
    rows = rows.filter((employee) => employee.departmentId === query.departmentId);

  const search = query.search?.trim();
  if (search) {
    // ارقام فارسی در جست‌وجو نیز پذیرفته می‌شوند (کد ملی، شماره پرسنلی، شماره بیمه).
    const needle = toLatinDigits(search).toLowerCase();
    rows = rows.filter((employee) =>
      [
        employee.firstName,
        employee.lastName,
        `${employee.firstName} ${employee.lastName}`,
        employee.personnelCode,
        employee.nationalId,
        employee.position,
        employee.insuranceNumber ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .includes(needle),
    );
  }

  const field = query.sort?.field ?? 'lastName';
  const direction = query.sort?.direction ?? 'asc';
  rows.sort((first, second) => {
    const a = first[field];
    const b = second[field];
    if (typeof a === 'number' && typeof b === 'number') return direction === 'asc' ? a - b : b - a;
    const result = COLLATOR.compare(String(a ?? ''), String(b ?? ''));
    return direction === 'asc' ? result : -result;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const employee = await db.employees.get(id);
  return employee && !employee.deletedAt ? employee : undefined;
}

export async function allActiveEmployees(companyId: string): Promise<Employee[]> {
  const rows = await db.employees.where('companyId').equals(companyId).toArray();
  return rows.filter((employee) => employee.status === 'active' && !employee.deletedAt);
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Employee, 'id' | 'createdAt'>>;

/**
 * ذخیره پرونده کارمند پس از اعتبارسنجی کامل:
 * کد ملی با چک‌سام، شماره بیمه، یکتایی شماره پرسنلی و کد ملی، تاریخ‌ها و شبا.
 */
export async function saveEmployee(input: EmployeeInput, actorId?: string): Promise<Employee> {
  const existingList = await db.employees.where('companyId').equals(input.companyId).toArray();
  const duplicated = existingList.filter(
    (employee) => employee.id !== input.id && !employee.deletedAt,
  );

  const issues = validateEmployee(input, {
    existingPersonnelCodes: duplicated.map((employee) => employee.personnelCode),
    existingNationalIds: duplicated.map((employee) => employee.nationalId),
  });
  if (issues.length > 0) {
    throw new DataError(issues[0]?.message ?? 'اطلاعات کارمند معتبر نیست.', 'EMPLOYEE_INVALID');
  }

  const now = new Date().toISOString();
  const existing = input.id ? await db.employees.get(input.id) : undefined;
  const record: Employee = {
    ...input,
    id: input.id ?? makeId('emp'),
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
    ...(actorId ? { updatedBy: actorId } : {}),
  } as Employee;

  await db.employees.put(record);

  const diff = existing
    ? buildDiff(
        existing as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>,
      )
    : undefined;
  await recordAudit({
    action: existing ? 'update' : 'create',
    entityType: 'employee',
    entityId: record.id,
    summary: existing
      ? `پرونده «${record.firstName} ${record.lastName}» ویرایش شد.`
      : `کارمند جدید «${record.firstName} ${record.lastName}» ثبت شد.`,
    ...(diff ? { diff } : {}),
    ...(actorId ? { actorId } : {}),
  });
  return record;
}

function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Array<{ field: string; before: unknown; after: unknown }> {
  const fields = [
    'firstName',
    'lastName',
    'personnelCode',
    'nationalId',
    'position',
    'status',
    'contractType',
  ];
  const diff: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const field of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      diff.push({ field, before: before[field], after: after[field] });
    }
  }
  return diff;
}

/**
 * حذف نرم کارمند. اگر کارمند فیش حقوقی ثبت‌شده داشته باشد، فقط غیرفعال می‌شود تا
 * سابقه مالی حفظ شود.
 */
export async function deleteEmployee(id: string, actorId?: string): Promise<{ soft: boolean }> {
  const employee = await db.employees.get(id);
  if (!employee) throw new DataError('کارمند یافت نشد.', 'EMPLOYEE_NOT_FOUND');
  const payslipCount = await db.payslips.where('employeeId').equals(id).count();
  const soft = payslipCount > 0;
  await db.employees.update(id, {
    ...(soft ? { status: 'terminated' as const } : { deletedAt: new Date().toISOString() }),
    updatedAt: new Date().toISOString(),
  });
  await recordAudit({
    action: soft ? 'update' : 'delete',
    entityType: 'employee',
    entityId: id,
    summary: soft
      ? `کارمند «${employee.firstName} ${employee.lastName}» به دلیل وجود سابقه حقوق، غیرفعال شد.`
      : `کارمند «${employee.firstName} ${employee.lastName}» حذف شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return { soft };
}

/**
 * بازگردانی پرونده‌ای که به‌صورت نرم حذف یا غیرفعال شده است.
 * وضعیت پیشین را می‌توان با `status` بازنویسی کرد تا بازگردانی دقیق باشد.
 */
export async function restoreEmployee(
  id: string,
  options: { status?: Employee['status']; actorId?: string } = {},
): Promise<Employee> {
  const employee = await db.employees.get(id);
  if (!employee) throw new DataError('کارمند یافت نشد.', 'EMPLOYEE_NOT_FOUND');
  const patch: Partial<Employee> = {
    deletedAt: undefined,
    updatedAt: new Date().toISOString(),
    ...(options.status ? { status: options.status } : {}),
  };
  await db.employees.update(id, patch);
  await recordAudit({
    action: 'restore',
    entityType: 'employee',
    entityId: id,
    summary: `پرونده «${employee.firstName} ${employee.lastName}» بازگردانی شد.`,
    ...(options.actorId ? { actorId: options.actorId } : {}),
  });
  const restored = await db.employees.get(id);
  if (!restored) throw new DataError('بازگردانی پرونده ناموفق بود.', 'EMPLOYEE_NOT_FOUND');
  return restored;
}

/* ------------------------------------------------------------------ دپارتمان‌ها */

export async function listDepartments(companyId: string): Promise<Department[]> {
  const rows = await db.departments.where('companyId').equals(companyId).toArray();
  return rows
    .filter((department) => !department.deletedAt)
    .sort((a, b) => COLLATOR.compare(a.title, b.title));
}

export async function saveDepartment(
  input: Omit<Department, 'createdAt' | 'updatedAt'> & Partial<Pick<Department, 'createdAt'>>,
): Promise<Department> {
  const now = new Date().toISOString();
  const record: Department = {
    ...input,
    id: input.id || makeId('dep'),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  } as Department;
  await db.departments.put(record);
  return record;
}

export async function deleteDepartment(id: string): Promise<void> {
  const inUse = await db.employees.where('departmentId').equals(id).count();
  if (inUse > 0) {
    throw new DataError(
      'این دپارتمان به کارکنان تخصیص یافته و قابل حذف نیست.',
      'DEPARTMENT_IN_USE',
    );
  }
  await db.departments.delete(id);
}

/** شمار کارکنان فعال به تفکیک دپارتمان — برای نمودار داشبورد. */
export async function employeeCountsByDepartment(
  companyId: string,
): Promise<Array<{ departmentId: string; title: string; count: number }>> {
  const [departments, employees] = await Promise.all([
    listDepartments(companyId),
    allActiveEmployees(companyId),
  ]);
  return departments.map((department) => ({
    departmentId: department.id,
    title: department.title,
    count: employees.filter((employee) => employee.departmentId === department.id).length,
  }));
}

/** آمار تکمیلی داشبورد: میانگین حقوق و نرخ ترک خدمت. */
export async function employeeStatistics(companyId: string): Promise<{
  active: number;
  inactive: number;
  terminated: number;
  averageBaseSalary: number;
}> {
  const rows = (await db.employees.where('companyId').equals(companyId).toArray()).filter(
    (employee) => !employee.deletedAt,
  );
  const active = rows.filter((employee) => employee.status === 'active');
  const averageBaseSalary =
    active.length > 0
      ? Math.round(
          active.reduce((total, employee) => total + employee.salary.baseMonthly, 0) /
            active.length,
        )
      : 0;
  return {
    active: active.length,
    inactive: rows.filter(
      (employee) => employee.status === 'inactive' || employee.status === 'unpaid-leave',
    ).length,
    terminated: rows.filter((employee) => employee.status === 'terminated').length,
    averageBaseSalary,
  };
}

export function emptyEmployee(companyId: string, departmentId: string): EmployeeInput {
  return {
    companyId,
    personnelCode: '',
    firstName: '',
    lastName: '',
    fatherName: '',
    nationalId: '',
    idCardNumber: '',
    birthDate: { jy: 1365, jm: 1, jd: 1 },
    gender: 'male',
    maritalStatus: 'single',
    children: [],
    education: 'diploma',
    position: '',
    departmentId,
    hireDate: { jy: 1405, jm: 1, jd: 1 },
    contractType: 'labour',
    status: 'active',
    salary: { baseMonthly: 166_255_500, seniorityMonthly: 0 },
    ...auditStamp(),
  } as EmployeeInput;
}
