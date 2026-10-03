import { addJalaliDays, gregorianIsoToJalali, jalaliToGregorianIso } from '@dastmozd/core';
import type { CalendarEventRecord } from '../schema';
import { db } from '../schema';
import { makeId, nowIso } from '../helpers';

/** رویدادهای خودکار تقویم: پایان قرارداد، سررسید وام، مهلت بیمه و مالیات. */
export async function syncCalendarEvents(companyId: string, period: { jy: number; jm: number }): Promise<number> {
  // مهلت ارسال لیست بیمه: پایان ماه بعد؛ مهلت مالیات: آخرین روز ماه بعد.
  const dueYearMonth = period.jm === 12 ? { jy: period.jy + 1, jm: 1 } : { jy: period.jy, jm: period.jm + 1 };
  const dueDate = jalaliToGregorianIso(addJalaliDays({ ...dueYearMonth, jd: 1 }, 29));

  const [employees, loans] = await Promise.all([
    db.employees.where('companyId').equals(companyId).toArray(),
    db.loans.where('companyId').equals(companyId).toArray(),
  ]);

  const events: CalendarEventRecord[] = [];

  for (const employee of employees) {
    if (employee.contractType === 'temporary' && employee.terminationDate) {
      events.push({
        id: makeId('evt'),
        companyId,
        title: `پایان قرارداد ${employee.firstName} ${employee.lastName}`,
        date: jalaliToGregorianIso(employee.terminationDate),
        jalali: employee.terminationDate,
        kind: 'contract-end',
        employeeId: employee.id,
        done: false,
      });
    }
  }

  for (const loan of loans.filter((item) => item.status === 'active')) {
    events.push({
      id: makeId('evt'),
      companyId,
      title: `سررسید قسط وام — ${loan.title}`,
      date: dueDate,
      jalali: gregorianIsoToJalali(dueDate),
      kind: 'loan-due',
      employeeId: loan.employeeId,
      done: false,
      note: `قسط ${loan.installmentAmount.toLocaleString('en-US')} ریال`,
    });
  }

  events.push({
    id: makeId('evt'),
    companyId,
    title: `مهلت ارسال لیست بیمه تأمین اجتماعی ${period.jm}/${period.jy}`,
    date: dueDate,
    jalali: gregorianIsoToJalali(dueDate),
    kind: 'insurance-due',
    done: false,
    note: 'ارسال از طریق سامانه خدمات الکترونیکی سازمان تأمین اجتماعی انجام می‌شود.',
  });
  events.push({
    id: makeId('evt'),
    companyId,
    title: `مهلت ارسال لیست مالیات حقوق ${period.jm}/${period.jy}`,
    date: dueDate,
    jalali: gregorianIsoToJalali(dueDate),
    kind: 'tax-due',
    done: false,
    note: 'ماده ۸۶ قانون مالیات‌های مستقیم — ارسال تا پایان ماه پس از پرداخت.',
  });

  const existing = await db.calendarEvents.where('companyId').equals(companyId).toArray();
  const existingKeys = new Set(existing.map((event) => `${event.kind}|${event.date}|${event.title}`));
  const fresh = events.filter((event) => !existingKeys.has(`${event.kind}|${event.date}|${event.title}`));
  if (fresh.length > 0) await db.calendarEvents.bulkAdd(fresh);
  return fresh.length;
}

export async function listCalendarEvents(companyId: string, limit = 50): Promise<CalendarEventRecord[]> {
  const rows = await db.calendarEvents.where('companyId').equals(companyId).toArray();
  return rows
    .filter((event) => !event.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export async function markEventDone(id: string): Promise<void> {
  await db.calendarEvents.update(id, { done: true });
}

export async function addManualEvent(input: {
  companyId: string;
  title: string;
  date: string;
  kind: CalendarEventRecord['kind'];
  note?: string;
}): Promise<CalendarEventRecord> {
  const event: CalendarEventRecord = {
    id: makeId('evt'),
    companyId: input.companyId,
    title: input.title,
    date: input.date,
    jalali: gregorianIsoToJalali(input.date),
    kind: input.kind,
    done: false,
    ...(input.note ? { note: input.note } : {}),
  };
  await db.calendarEvents.add(event);
  return event;
}

/** یادآوری اقساط معوق و قراردادهای نزدیک به پایان برای داشبورد. */
export async function dashboardReminders(companyId: string): Promise<{
  events: CalendarEventRecord[];
  updatedAt: string;
}> {
  return { events: await listCalendarEvents(companyId, 8), updatedAt: nowIso() };
}
