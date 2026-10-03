import { describe, expect, it } from 'vitest';
import {
  creditedDays,
  minutesBetween,
  nightHoursOf,
  summarizeAttendance,
  unpaidDays,
  workedHoursOf,
} from '../engine/attendance';
import { emptyAttendance } from '../engine/types';
import type { AttendanceRecord } from '@dastmozd/types';

function record(partial: Partial<AttendanceRecord> & Pick<AttendanceRecord, 'date' | 'kind'>): AttendanceRecord {
  return {
    id: `rec-${partial.date}-${partial.kind}`,
    employeeId: 'emp-1',
    jalali: { jy: 1405, jm: 7, jd: 1 },
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...partial,
  };
}

describe('محاسبات پایه حضور و غیاب', () => {
  it('اختلاف دقیقه بین دو ساعت با عبور از نیمه‌شب', () => {
    expect(minutesBetween('08:00', '17:00')).toBe(540);
    expect(minutesBetween('22:00', '06:00')).toBe(480);
    expect(minutesBetween('08:00', '08:00')).toBe(0);
  });

  it('ساعات کارکرد روزانه با کسر استراحت محاسبه می‌شود', () => {
    expect(workedHoursOf(record({ date: '2026-09-23', kind: 'present', checkIn: '08:00', checkOut: '17:00', breakMinutes: 60 }))).toBe(8);
    expect(workedHoursOf(record({ date: '2026-09-24', kind: 'present', workedHours: 7.5 }))).toBe(7.5);
    expect(workedHoursOf(record({ date: '2026-09-25', kind: 'present' }))).toBe(0);
  });

  it('ساعات شب‌کاری در بازه ۲۲ تا ۶ بامداد شناسایی می‌شود', () => {
    expect(nightHoursOf('22:00', '06:00')).toBe(8);
    expect(nightHoursOf('20:00', '23:00')).toBe(1);
    expect(nightHoursOf('08:00', '17:00')).toBe(0);
    expect(nightHoursOf('23:00', '01:00')).toBe(2);
    expect(nightHoursOf('22:30', '06:00', 30)).toBe(7);
  });
});

describe('جمع‌بندی ماهانه کارکرد', () => {
  it('روزهای عادی، مرخصی، غیبت و مأموریت درست شمارش می‌شود', () => {
    const summary = summarizeAttendance(
      [
        record({ date: '2026-09-23', kind: 'present', checkIn: '08:00', checkOut: '17:00', breakMinutes: 60, overtimeHours: 2 }),
        record({ date: '2026-09-24', kind: 'present', checkIn: '08:00', checkOut: '16:00', breakMinutes: 0 }),
        record({ date: '2026-09-25', kind: 'paid-leave' }),
        record({ date: '2026-09-26', kind: 'unpaid-leave' }),
        record({ date: '2026-09-27', kind: 'absence' }),
        record({ date: '2026-09-28', kind: 'mission', missionHours: 8 }),
        record({ date: '2026-09-29', kind: 'sick-leave' }),
        record({ date: '2026-10-02', kind: 'holiday', checkIn: '08:00', checkOut: '16:00' }),
      ],
      30,
    );
    expect(summary.presentDays).toBe(3);
    expect(summary.paidLeaveDays).toBe(1);
    expect(summary.unpaidLeaveDays).toBe(1);
    expect(summary.absenceDays).toBe(1);
    expect(summary.sickLeaveDays).toBe(1);
    expect(summary.missionDays).toBe(1);
    expect(summary.missionHours).toBe(8);
    expect(summary.overtimeHours).toBe(2);
    expect(summary.holidayHours).toBe(8);
    expect(summary.nightOvertimeHours).toBe(0);
    expect(creditedDays(summary)).toBe(6);
    // یک روز مرخصی بدون حقوق، یک روز غیبت و یک روز استعلاجی خارج از پوشش کارفرما.
    expect(unpaidDays(summary)).toBe(3);
    // با احتساب یک روز استعلاجی پرداختی توسط کارفرما، دو روز کسر می‌شود.
    expect(unpaidDays(summary, 1)).toBe(2);
  });

  it('شب‌کاری و نوبت‌کاری جداگانه تجمیع می‌شود', () => {
    const summary = summarizeAttendance(
      [
        record({ date: '2026-09-23', kind: 'night', checkIn: '22:00', checkOut: '06:00' }),
        record({
          date: '2026-09-24',
          kind: 'present',
          checkIn: '22:00',
          checkOut: '06:00',
          overtimeHours: 2,
          shiftKind: 'night',
        }),
        record({ date: '2026-09-25', kind: 'overtime', checkIn: '17:00', checkOut: '21:00', overtimeHours: 4 }),
      ],
      30,
    );
    expect(summary.nightHours).toBe(14);
    expect(summary.nightOvertimeHours).toBe(2);
    expect(summary.overtimeHours).toBe(6);
    expect(summary.shiftHours.night).toBe(8);
  });

  it('تأخیر و تعجیل و تعطیلات رسمی پشتیبانی می‌شود', () => {
    const summary = summarizeAttendance(
      [
        record({ date: '2026-09-23', kind: 'present', checkIn: '08:30', checkOut: '17:00', lateMinutes: 30, earlyLeaveMinutes: 15 }),
      ],
      30,
      { holidayDates: ['2026-09-23'] },
    );
    expect(summary.lateMinutes).toBe(30);
    expect(summary.earlyLeaveMinutes).toBe(15);
    expect(summary.holidayHours).toBe(8.5);
    expect(summary.holidayOvertimeHours).toBeCloseTo(1.17, 1);
  });

  it('خلاصه خالی پیش‌فرض‌های درست دارد', () => {
    const summary = emptyAttendance(31);
    expect(summary.periodDays).toBe(31);
    expect(summary.presentDays).toBe(31);
    expect(summary.overtimeHours).toBe(0);
    expect(creditedDays(emptyAttendance(30))).toBe(30);
  });
});
