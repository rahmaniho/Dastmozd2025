import {
  emptyAttendance,
  gregorianIsoToJalali,
  jalaliMonthLength,
  jalaliToGregorianIso,
  summarizeAttendance,
} from '@dastmozd/core';
import type { AttendanceKind, AttendanceRecord } from '@dastmozd/types';
import type { AttendanceSummary } from '@dastmozd/core';
import { db } from '../schema';
import { DataError, auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

/** همه رکوردهای کارکرد یک کارمند در یک ماه شمسی. */
export async function attendanceOfMonth(
  employeeId: string,
  jy: number,
  jm: number,
): Promise<AttendanceRecord[]> {
  const records = await db.attendance
    .where('[employeeId+date]')
    .between(
      [employeeId, jalaliToGregorianIso({ jy, jm, jd: 1 })],
      [employeeId, jalaliToGregorianIso({ jy, jm, jd: jalaliMonthLength(jy, jm) })],
      true,
      true,
    )
    .toArray();
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

/** کارکرد همه کارکنان یک ماه — برای شبکه کارکرد و محاسبه گروهی. */
export async function attendanceOfPeriod(jy: number, jm: number): Promise<AttendanceRecord[]> {
  const from = jalaliToGregorianIso({ jy, jm, jd: 1 });
  const to = jalaliToGregorianIso({ jy, jm, jd: jalaliMonthLength(jy, jm) });
  const records = await db.attendance.where('date').between(from, to, true, true).toArray();
  return records.filter((record) => !record.deletedAt);
}

/**
 * ذخیره یا به‌روزرسانی کارکرد یک روز.
 * اگر رکورد آن روز در دوره قفل‌شده حقوقی باشد، ویرایش رد می‌شود.
 */
export async function upsertAttendance(
  input: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<AttendanceRecord, 'id' | 'createdAt'>>,
  actorId?: string,
): Promise<AttendanceRecord> {
  const existing = await db.attendance
    .where('[employeeId+date]')
    .equals([input.employeeId, input.date])
    .first();

  if (existing?.payrollRunId) {
    const run = await db.payrollRuns.get(existing.payrollRunId);
    if (run && (run.status === 'locked' || run.status === 'paid')) {
      throw new DataError(
        'این روز در دوره قفل‌شده حقوقی ثبت شده و قابل ویرایش نیست.',
        'PERIOD_LOCKED',
      );
    }
  }

  const stamp = auditStamp(actorId);
  const jalali = input.jalali ?? gregorianIsoToJalali(input.date);
  const record: AttendanceRecord = {
    ...input,
    jalali,
    id: existing?.id ?? input.id ?? makeId('att'),
    createdAt: existing?.createdAt ?? input.createdAt ?? stamp.createdAt,
    updatedAt: stamp.updatedAt,
    ...(actorId ? { updatedBy: actorId } : {}),
  };

  if (record.workedHours === undefined && record.checkIn && record.checkOut) {
    record.workedHours = undefined;
  }

  await db.attendance.put(record);
  return record;
}

/** ثبت گروهی کارکرد (مثلاً هنگام ورود از فایل اکسل). */
export async function bulkUpsertAttendance(
  records: Array<Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  actorId?: string,
): Promise<number> {
  let count = 0;
  await db.transaction('rw', db.attendance, async () => {
    for (const item of records) {
      await upsertAttendance(item, actorId);
      count += 1;
    }
  });
  await recordAudit({
    action: 'import',
    entityType: 'attendance',
    entityId: 'bulk',
    summary: `${count} رکورد کارکرد از فایل ورودی ثبت شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return count;
}

/** خلاصه کارکرد ماهانه یک کارمند بر پایه قواعد پروفایل حقوقی. */
export async function summarizeEmployeeMonth(
  employeeId: string,
  jy: number,
  jm: number,
  options: { holidayDates?: string[]; dailyHours?: number } = {},
): Promise<AttendanceSummary> {
  const records = await attendanceOfMonth(employeeId, jy, jm);
  const days = jalaliMonthLength(jy, jm);
  if (records.length === 0) {
    const summary = emptyAttendance(days);
    summary.presentDays = days;
    return summary;
  }
  return summarizeAttendance(records, days, options);
}

/** حذف یک روز کارکرد (پیش از قفل دوره). */
export async function deleteAttendance(id: string): Promise<void> {
  const record = await db.attendance.get(id);
  if (!record) return;
  if (record.payrollRunId) {
    throw new DataError('این رکورد در دوره حقوقی ثبت شده و قابل حذف نیست.', 'PERIOD_LOCKED');
  }
  await db.attendance.delete(id);
}

/** تعداد روزهای ثبت‌شده هر کارمند در یک ماه — برای نمایش وضعیت تکمیل کارکرد. */
export async function attendanceCoverage(jy: number, jm: number): Promise<Map<string, number>> {
  const records = await attendanceOfPeriod(jy, jm);
  const map = new Map<string, number>();
  for (const record of records) {
    map.set(record.employeeId, (map.get(record.employeeId) ?? 0) + 1);
  }
  return map;
}

/** عناوین فارسی انواع کارکرد — در شبکه کارکرد و خروجی‌ها استفاده می‌شود. */
export const ATTENDANCE_KIND_LABELS: Record<AttendanceKind, string> = {
  present: 'عادی',
  overtime: 'اضافه‌کار',
  night: 'شب‌کاری',
  holiday: 'تعطیل‌کاری',
  'paid-leave': 'مرخصی استحقاقی',
  'sick-leave': 'مرخصی استعلاجی',
  'unpaid-leave': 'مرخصی بدون حقوق',
  absence: 'غیبت',
  mission: 'مأموریت',
  remote: 'دورکاری',
  'unpaid-holiday': 'تعطیل',
};
