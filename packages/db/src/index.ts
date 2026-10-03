/**
 * @dastmozd/db — لایه داده محلی سامانه دستمزد آرمانی
 *
 * پایگاه داده IndexedDB با Dexie: تنها منبع حقیقت برنامه. همه عملیات نوشتن از
 * این لایه عبور می‌کند تا گزارش حسابرسی، اعتبارسنجی و پشتیبان‌گیری یکجا اعمال شود.
 */
export { DastmozdDatabase, db, TABLE_NAMES } from './schema';
export type { BackupRecord, CalendarEventRecord, LegalOverrideRecord, TableName } from './schema';

export { DataError, auditStamp, makeId, nowIso } from './helpers';

export {
  exportAuditJson,
  latestAuditEntries,
  recordAudit,
  verifyAuditChain,
} from './audit';
export type { AuditInput, AuditIntegrityResult } from './audit';

export {
  BACKUP_EXTENSION,
  BACKUP_FORMAT_VERSION,
  PBKDF2_ITERATIONS,
  buildBackupFile,
  decryptText,
  deriveKey,
  encryptText,
  fromBase64,
  parseBackupFile,
  sha256Hex,
  toBase64,
} from './crypto';
export type { BackupFile, EncryptedPayload, ParsedBackup } from './crypto';

export {
  collectBackupData,
  createBackup,
  enforceRetention,
  listBackups,
  restoreBackup,
  wipeDatabase,
} from './backup';
export type { BackupData, CreateBackupOptions, RestoreOptions } from './backup';

export {
  archiveCompany,
  createDefaultCompany,
  ensureActiveCompany,
  getCompany,
  listCompanies,
  saveCompany,
} from './repositories/companies';

export {
  allActiveEmployees,
  deleteDepartment,
  deleteEmployee,
  employeeCountsByDepartment,
  employeeStatistics,
  emptyEmployee,
  getEmployee,
  listDepartments,
  listEmployees,
  restoreEmployee,
  saveDepartment,
  saveEmployee,
} from './repositories/employees';
export type { EmployeeInput, EmployeeQuery } from './repositories/employees';

export {
  ATTENDANCE_KIND_LABELS,
  attendanceCoverage,
  attendanceOfMonth,
  attendanceOfPeriod,
  bulkUpsertAttendance,
  deleteAttendance,
  summarizeEmployeeMonth,
  upsertAttendance,
} from './repositories/attendance';

export {
  getPayrollRun,
  listPayrollRuns,
  listPayslips,
  lockPayrollRun,
  monthlyPayrollTrend,
  payslipsOfRun,
  runPayroll,
  toPayrollEmployee,
  unlockPayrollRun,
} from './repositories/payroll';
export type { RunPayrollOptions } from './repositories/payroll';

export {
  ROLE_PERMISSIONS,
  can,
  createUser,
  defaultSettings,
  deleteUser,
  getSettings,
  hashPassword,
  listUsers,
  roleLabel,
  saveSettings,
  verifyUserPassword,
} from './repositories/settings';

export {
  createLoan,
  installmentForPeriod,
  installmentSchedule,
  listLoans,
  registerInstallment,
  upcomingInstallments,
} from './repositories/loans';
export type { LoanInput } from './repositories/loans';

export {
  addManualEvent,
  dashboardReminders,
  listCalendarEvents,
  markEventDone,
  syncCalendarEvents,
} from './repositories/events';

export { seedDemoData } from './seed';
export type { SeedOptions, SeedResult } from './seed';
