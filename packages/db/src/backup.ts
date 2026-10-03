import type {
  AttendanceRecord,
  CompanyProfile,
  Department,
  Employee,
  LoanContract,
  PayrollRun,
  Payslip,
} from '@dastmozd/types';
import { db, TABLE_NAMES } from './schema';
import { buildBackupFile, parseBackupFile } from './crypto';
import { makeId, nowIso } from './helpers';
import { recordAudit } from './audit';

/** ساختار داده پشتیبان — همه جدول‌ها به‌صورت آرایه خالص. */
export interface BackupData {
  format: 'dastmozd-data';
  formatVersion: 1;
  exportedAt: string;
  companies: CompanyProfile[];
  departments: Department[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  payrollRuns: PayrollRun[];
  payslips: Payslip[];
  loans: LoanContract[];
  settings: unknown[];
  legalOverrides: unknown[];
  calendarEvents: unknown[];
}

/** خواندن همه داده‌های شرکت برای پشتیبان‌گیری. */
export async function collectBackupData(companyId?: string): Promise<BackupData> {
  const companies = companyId
    ? await db.companies.where('id').equals(companyId).toArray()
    : await db.companies.toArray();
  const companyIds = new Set(companies.map((company) => company.id));

  const [
    departments,
    employees,
    attendance,
    payrollRuns,
    payslips,
    loans,
    settings,
    legalOverrides,
    calendarEvents,
  ] = await Promise.all([
    db.departments.toArray().then((rows) => rows.filter((row) => companyIds.has(row.companyId))),
    db.employees.toArray().then((rows) => rows.filter((row) => companyIds.has(row.companyId))),
    db.attendance.toArray(),
    db.payrollRuns.toArray().then((rows) => rows.filter((row) => companyIds.has(row.companyId))),
    db.payslips.toArray(),
    db.loans.toArray().then((rows) => rows.filter((row) => companyIds.has(row.companyId))),
    db.settings.toArray(),
    db.legalOverrides.toArray(),
    db.calendarEvents.toArray().then((rows) => rows.filter((row) => companyIds.has(row.companyId))),
  ]);

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const runIds = new Set(payrollRuns.map((run) => run.id));

  return {
    format: 'dastmozd-data',
    formatVersion: 1,
    exportedAt: nowIso(),
    companies,
    departments,
    employees,
    attendance: attendance.filter((record) => employeeIds.has(record.employeeId)),
    payrollRuns,
    payslips: payslips.filter(
      (slip) => runIds.has(slip.payrollRunId) && employeeIds.has(slip.employeeId),
    ),
    loans,
    settings,
    legalOverrides,
    calendarEvents,
  };
}

export interface CreateBackupOptions {
  companyId: string;
  companyName: string;
  appVersion: string;
  passphrase?: string;
  /** ذخیره کپی سبک داخل مرورگر (برای بازیابی سریع). */
  keepLocalCopy?: boolean;
  kind?: 'auto' | 'manual' | 'pre-operation';
}

/** ساخت فایل پشتیبان رمزنگاری‌شده `.dastmozd`. */
export async function createBackup(
  options: CreateBackupOptions,
): Promise<{ content: string; fileName: string }> {
  const data = await collectBackupData(options.companyId);
  const { content, manifest } = await buildBackupFile(data, {
    companyId: options.companyId,
    companyName: options.companyName,
    appVersion: options.appVersion,
    ...(options.passphrase ? { passphrase: options.passphrase } : {}),
  });

  if (options.keepLocalCopy) {
    await db.backups.add({
      id: makeId('bak'),
      label: `پشتیبان ${new Date().toLocaleString('fa-IR')}`,
      createdAt: manifest.createdAt,
      kind: options.kind ?? 'manual',
      period: 'daily',
      sizeBytes: content.length,
      sha256: manifest.payloadSha256,
      encrypted: manifest.encrypted,
    });
    await enforceRetention();
  }

  await recordAudit({
    action: 'backup',
    entityType: 'backup',
    entityId: options.companyId,
    summary: `پشتیبان ${manifest.encrypted ? 'رمزنگاری‌شده' : 'ساده'} ساخته شد (${manifest.counts.employees ?? 0} کارمند).`,
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return { content, fileName: `dastmozd-backup-${stamp}.dastmozd` };
}

export interface RestoreOptions {
  content: string;
  passphrase?: string;
  mode: 'replace' | 'merge';
  actorId?: string;
}

/** بازیابی داده از فایل پشتیبان با بررسی یکپارچگی. */
export async function restoreBackup(options: RestoreOptions): Promise<{
  integrity: { valid: boolean; message: string };
  restored: Record<string, number>;
}> {
  const parsed = await parseBackupFile<BackupData>(options.content, options.passphrase);
  if (!parsed.integrity.valid) {
    return { integrity: parsed.integrity, restored: {} };
  }
  const data = parsed.data;
  if (data.format !== 'dastmozd-data') {
    throw new Error('محتوای فایل پشتیبان با ساختار سامانه سازگار نیست.');
  }

  const restored: Record<string, number> = {};

  await db.transaction(
    'rw',
    [
      db.companies,
      db.departments,
      db.employees,
      db.attendance,
      db.payrollRuns,
      db.payslips,
      db.loans,
      db.calendarEvents,
      db.legalOverrides,
    ],
    async () => {
      if (options.mode === 'replace') {
        await Promise.all([
          db.companies.clear(),
          db.departments.clear(),
          db.employees.clear(),
          db.attendance.clear(),
          db.payrollRuns.clear(),
          db.payslips.clear(),
          db.loans.clear(),
          db.calendarEvents.clear(),
        ]);
      }
      await db.companies.bulkPut(data.companies ?? []);
      await db.departments.bulkPut(data.departments ?? []);
      await db.employees.bulkPut(data.employees ?? []);
      await db.attendance.bulkPut(data.attendance ?? []);
      await db.payrollRuns.bulkPut(data.payrollRuns ?? []);
      await db.payslips.bulkPut(data.payslips ?? []);
      await db.loans.bulkPut(data.loans ?? []);
      await db.calendarEvents.bulkPut((data.calendarEvents ?? []) as never[]);
      restored.companies = data.companies?.length ?? 0;
      restored.employees = data.employees?.length ?? 0;
      restored.attendance = data.attendance?.length ?? 0;
      restored.payrollRuns = data.payrollRuns?.length ?? 0;
      restored.payslips = data.payslips?.length ?? 0;
    },
  );

  await recordAudit({
    action: 'restore-backup',
    entityType: 'backup',
    entityId: parsed.manifest.companyId,
    summary: `بازیابی پشتیبان در حالت «${options.mode === 'replace' ? 'جایگزینی' : 'ادغام'}» انجام شد.`,
    ...(options.actorId ? { actorId: options.actorId } : {}),
  });

  return { integrity: parsed.integrity, restored };
}

/**
 * نگهداری چرخه پشتیبان: ۳۰ نسخه روزانه، ۱۲ نسخه ماهانه و ۵ نسخه سالانه.
 * نسخه‌های قدیمی‌تر از این چرخه حذف می‌شوند تا حجم داده محدود بماند.
 */
export async function enforceRetention(): Promise<void> {
  const all = await db.backups.orderBy('createdAt').reverse().toArray();
  const keep = new Set<string>();
  const take = (predicate: (item: (typeof all)[number]) => boolean, limit: number): void => {
    let taken = 0;
    for (const item of all) {
      if (taken >= limit) break;
      if (predicate(item) && !keep.has(item.id)) {
        keep.add(item.id);
        taken += 1;
      }
    }
  };
  const now = new Date();
  take((item) => item.createdAt.slice(0, 10) === now.toISOString().slice(0, 10), 30);
  take(() => true, 30);
  take((item) => item.period === 'monthly', 12);
  take((item) => item.period === 'yearly', 5);

  const toDelete = all.filter((item) => !keep.has(item.id));
  if (toDelete.length > 0) {
    await db.backups.bulkDelete(toDelete.map((item) => item.id));
  }
}

/** فهرست پشتیبان‌های ذخیره‌شده در مرورگر. */
export async function listBackups() {
  return db.backups.orderBy('createdAt').reverse().toArray();
}

/** حذف کامل داده‌های سامانه (با ثبت در گزارش حسابرسی). */
export async function wipeDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    TABLE_NAMES.map((name) => db.table(name)),
    async () => {
      for (const name of TABLE_NAMES) {
        if (name === 'auditLog') continue;
        await db.table(name).clear();
      }
    },
  );
  await recordAudit({
    action: 'delete',
    entityType: 'settings',
    entityId: 'database',
    summary: 'همه داده‌های سامانه پاک شد (گزارش حسابرسی حفظ شد).',
  });
}
