import type { AttendanceRecord } from '@dastmozd/types';
import type { AttendanceSummary, ShiftKind } from './types';
import { emptyAttendance } from './types';

/** Minutes between two `HH:mm` strings (handles the midnight wrap). */
export function minutesBetween(from: string, to: string): number {
  const parse = (value: string): number => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const start = parse(from);
  let end = parse(to);
  if (end < start) end += 24 * 60; // overnight shift
  return end - start;
}

/**
 * Worked hours of a single attendance day, honouring the unpaid break and the
 * overnight wrap. When `workedHours` is set explicitly it always wins.
 */
export function workedHoursOf(record: AttendanceRecord): number {
  if (typeof record.workedHours === 'number') return record.workedHours;
  if (!record.checkIn || !record.checkOut) return 0;
  const gross = minutesBetween(record.checkIn, record.checkOut) - (record.breakMinutes ?? 0);
  return Math.max(0, Math.round((gross / 60) * 100) / 100);
}

/** Hours of a record that fall inside the legal night window (22:00–06:00). */
export function nightHoursOf(checkIn: string, checkOut: string, breakMinutes = 0): number {
  const toMinutes = (value: string): number => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const start = toMinutes(checkIn);
  let end = toMinutes(checkOut);
  if (end < start) end += 24 * 60;
  const nightStart = 22 * 60;
  const nightEnd = 30 * 60; // 06:00 of the next day
  let overlap = 0;
  // Night window repeated for the two days the shift may span.
  for (const offset of [-24 * 60, 0, 24 * 60]) {
    const windowStart = nightStart + offset;
    const windowEnd = nightEnd + offset;
    overlap += Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
  }
  return Math.max(0, Math.round(((overlap - breakMinutes) / 60) * 100) / 100);
}

export interface SummarizeAttendanceOptions {
  /** Treat these ISO dates as Fridays/holidays for the holiday counters. */
  holidayDates?: string[];
  /** Shift kind per ISO date, used for the نوبت‌کاری allowance. */
  shiftByDate?: Record<string, ShiftKind>;
  /** Standard hours per day (7.33 by default) used to detect overtime hours. */
  dailyHours?: number;
}

/**
 * Aggregates a list of daily attendance records into the monthly summary used by
 * the payroll engine. The function is pure: the same records always produce the
 * same summary, no matter in which order they are supplied.
 */
export function summarizeAttendance(
  records: readonly AttendanceRecord[],
  periodDays: number,
  options: SummarizeAttendanceOptions = {},
): AttendanceSummary {
  const summary = emptyAttendance(periodDays);
  const holidays = new Set(options.holidayDates ?? []);
  const dailyHours = options.dailyHours ?? 44 / 6;
  let presentDays = 0;

  for (const record of records) {
    const shift =
      options.shiftByDate?.[record.date] ??
      (record.shiftKind === 'none' ? undefined : record.shiftKind);
    const isHoliday = holidays.has(record.date);
    const hours = workedHoursOf(record);
    const overtime = record.overtimeHours ?? 0;
    const night =
      record.nightHours ??
      (record.checkIn && record.checkOut
        ? nightHoursOf(record.checkIn, record.checkOut, record.breakMinutes ?? 0)
        : 0);
    const holidayHours = record.holidayHours ?? (isHoliday ? hours : 0);

    switch (record.kind) {
      case 'present':
      case 'remote': {
        presentDays += 1;
        summary.regularHours += Math.max(0, hours - overtime - holidayHours);
        summary.overtimeHours += overtime;
        summary.nightOvertimeHours += Math.min(night, overtime);
        summary.nightHours += Math.max(0, night - overtime);
        summary.holidayHours += holidayHours;
        summary.holidayOvertimeHours += Math.max(0, holidayHours - dailyHours);
        if (shift) {
          summary.shiftHours[shift] = (summary.shiftHours[shift] ?? 0) + hours;
        }
        break;
      }
      case 'overtime': {
        presentDays += 1;
        const hoursOver = record.overtimeHours ?? hours;
        summary.overtimeHours += hoursOver;
        summary.nightOvertimeHours += Math.min(night, hoursOver);
        summary.nightHours += Math.max(0, night - hoursOver);
        break;
      }
      case 'night': {
        presentDays += 1;
        summary.nightHours += night || hours;
        summary.regularHours += record.holidayHours ? 0 : Math.max(0, hours - night);
        break;
      }
      case 'holiday': {
        presentDays += 1;
        const holidayWork = record.holidayHours ?? hours;
        summary.holidayHours += holidayWork;
        if (holidayWork > dailyHours) summary.holidayOvertimeHours += holidayWork - dailyHours;
        break;
      }
      case 'paid-leave':
        summary.paidLeaveDays += record.leaveDays ?? 1;
        break;
      case 'sick-leave':
        summary.sickLeaveDays += record.leaveDays ?? 1;
        break;
      case 'unpaid-leave':
        summary.unpaidLeaveDays += record.leaveDays ?? 1;
        break;
      case 'absence':
        summary.absenceDays += record.leaveDays ?? 1;
        break;
      case 'mission':
        summary.missionDays += 1;
        summary.missionHours += record.missionHours ?? dailyHours;
        break;
      case 'unpaid-holiday':
      default:
        break;
    }

    if (record.lateMinutes) summary.lateMinutes += record.lateMinutes;
    if (record.earlyLeaveMinutes) summary.earlyLeaveMinutes += record.earlyLeaveMinutes;
  }

  summary.presentDays = Math.round(presentDays * 100) / 100;
  return summary;
}

/**
 * Days credited to the employee: days present + paid leave + sick leave (paid by
 * the employer for days beyond the legal waiting period is handled upstream) +
 * missions. Unpaid leave and absences are excluded and deducted separately.
 */
export function creditedDays(summary: AttendanceSummary): number {
  return summary.presentDays + summary.paidLeaveDays + summary.sickLeaveDays + summary.missionDays;
}

/** Days that reduce the payable wage (غیبت + مرخصی بدون حقوق + استعلاجی بدون مزد). */
export function unpaidDays(summary: AttendanceSummary, employerPaidSickDays = 0): number {
  const sickUnpaid = Math.max(0, summary.sickLeaveDays - employerPaidSickDays);
  return summary.unpaidLeaveDays + summary.absenceDays + sickUnpaid;
}
