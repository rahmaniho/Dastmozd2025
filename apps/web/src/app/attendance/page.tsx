'use client';

import {
  JALALI_WEEKDAYS,
  jalaliMonthLength,
  jalaliToGregorianIso,
  jalaliWeekday,
  minutesBetween,
  toPersianDigits,
} from '@dastmozd/core';
import {
  ATTENDANCE_KIND_LABELS,
  attendanceCoverage,
  bulkUpsertAttendance,
  deleteAttendance,
  listDepartments,
  summarizeEmployeeMonth,
  upsertAttendance,
} from '@dastmozd/db';
import { resolveLegalProfile } from '@dastmozd/legal';
import type { AttendanceKind, AttendanceRecord, Employee } from '@dastmozd/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  IllustrationAttendance,
  Input,
  Money,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  useToast,
} from '@dastmozd/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Wand2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { AttendanceImportDialog } from '@/components/attendance-import-dialog';
import { downloadAttendanceTemplate } from '@/lib/attendance-import';
import { exportToExcel, type ExportColumn } from '@/lib/excel';
import { JALALI_MONTH_LABELS, useActiveEmployees, useAttendanceGrid, useLeaveBalances, usePeriodNavigator } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

/** نماد کوتاه هر نوع کارکرد در شبکه ماهانه. */
const KIND_GLYPH: Record<AttendanceKind, string> = {
  present: 'ح',
  overtime: 'ا',
  night: 'ش',
  holiday: 'ت',
  'paid-leave': 'م',
  'sick-leave': 'ب',
  'unpaid-leave': 'خ',
  absence: 'غ',
  mission: 'أ',
  remote: 'د',
  'unpaid-holiday': '—',
};

const KIND_STYLE: Record<AttendanceKind, string> = {
  present: 'bg-[rgb(var(--dm-success-soft))] text-[rgb(var(--dm-success))]',
  overtime: 'bg-[rgb(var(--dm-info-soft))] text-[rgb(var(--dm-info))]',
  night: 'bg-[rgb(var(--dm-secondary-soft))] text-[rgb(var(--dm-secondary))]',
  holiday: 'bg-[rgb(var(--dm-warning-soft))] text-[rgb(var(--dm-warning))]',
  'paid-leave': 'bg-[rgb(var(--dm-primary-subtle))] text-[rgb(var(--dm-primary))]',
  'sick-leave': 'bg-[rgb(var(--dm-warning-soft))] text-[rgb(var(--dm-warning))]',
  'unpaid-leave': 'bg-[rgb(var(--dm-surface-sunken))] text-[rgb(var(--dm-text-muted))]',
  absence: 'bg-[rgb(var(--dm-danger-soft))] text-[rgb(var(--dm-danger))]',
  mission: 'bg-[rgb(var(--dm-accent-soft))] text-[rgb(var(--dm-accent))]',
  remote: 'bg-[rgb(var(--dm-info-soft))] text-[rgb(var(--dm-info))]',
  'unpaid-holiday': 'bg-[rgb(var(--dm-surface-sunken))] text-[rgb(var(--dm-text-subtle))]',
};

function AttendancePageInner() {
  const { jy, jm, monthLabel } = usePeriodNavigator();
  const companyId = useAppStore((state) => state.companyId);
  const { records, loading, byEmployeeDate } = useAttendanceGrid();
  const employees = useActiveEmployees();
  const leaveBalances = useLeaveBalances();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [tab, setTab] = useState('grid');
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<{ employee: Employee; day: number; record?: AttendanceRecord } | null>(null);
  const [pendingClear, setPendingClear] = useState<{ employeeId: string; day: number; recordId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const departments = useLiveQuery(
    () => (companyId ? listDepartments(companyId) : Promise.resolve([])),
    [companyId],
    undefined,
  );
  const coverage = useLiveQuery(() => attendanceCoverage(jy, jm), [jy, jm], undefined);

  const days = useMemo(
    () => Array.from({ length: jalaliMonthLength(jy, jm) }, (_, index) => index + 1),
    [jy, jm],
  );

  const filteredEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (departmentId && employee.departmentId !== departmentId) return false;
      if (!needle) return true;
      const haystack = `${employee.firstName} ${employee.lastName} ${employee.personnelCode} ${employee.nationalId}`;
      return haystack.toLowerCase().includes(needle);
    });
  }, [employees, search, departmentId]);

  useEffect(() => {
    if (!selectedEmployeeId && filteredEmployees[0]) setSelectedEmployeeId(filteredEmployees[0].id);
  }, [filteredEmployees, selectedEmployeeId]);

  const selectedEmployee = filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const { profile } = resolveLegalProfile(jy);

  const monthSummary = useLiveQuery(
    async () => {
      if (!selectedEmployeeId) return null;
      return summarizeEmployeeMonth(selectedEmployeeId, jy, jm);
    },
    [selectedEmployeeId, jy, jm],
    undefined,
  );

  const saveDay = async (payload: {
    employeeId: string;
    day: number;
    kind: AttendanceKind;
    checkIn?: string;
    checkOut?: string;
    breakMinutes: number;
    note?: string;
  }): Promise<void> => {
    setBusy(true);
    try {
      const jalali = { jy, jm, jd: payload.day };
      await upsertAttendance({
        employeeId: payload.employeeId,
        date: jalaliToGregorianIso(jalali),
        jalali,
        kind: payload.kind,
        ...(payload.checkIn ? { checkIn: payload.checkIn } : {}),
        ...(payload.checkOut ? { checkOut: payload.checkOut } : {}),
        ...(payload.breakMinutes ? { breakMinutes: payload.breakMinutes } : {}),
        ...(payload.note ? { note: payload.note } : {}),
      });
      toast({ tone: 'success', title: 'کارکرد ثبت شد', description: `روز ${toPersianDigits(payload.day)} ${monthLabel}` });
      setEditing(null);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ثبت کارکرد ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(false);
    }
  };

  const fillWorkdays = async (): Promise<void> => {
    if (filteredEmployees.length === 0) return;
    setBusy(true);
    try {
      const drafts: Array<Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>> = [];
      for (const employee of filteredEmployees) {
        for (const day of days) {
          const weekday = jalaliWeekday({ jy, jm, jd: day });
          if (weekday === 6) continue; // جمعه تعطیل هفتگی است
          if (byEmployeeDate.has(`${employee.id}|${day}`)) continue;
          drafts.push({
            employeeId: employee.id,
            date: jalaliToGregorianIso({ jy, jm, jd: day }),
            jalali: { jy, jm, jd: day },
            kind: 'present',
            checkIn: '08:00',
            checkOut: '17:00',
            breakMinutes: 60,
          });
        }
      }
      if (drafts.length === 0) {
        toast({ tone: 'info', title: 'کارکردی برای تکمیل وجود ندارد', description: 'همه روزهای کاری ثبت شده‌اند.' });
        return;
      }
      const count = await bulkUpsertAttendance(drafts);
      toast({
        tone: 'success',
        title: `${toPersianDigits(count)} روز کاری ثبت شد`,
        description: 'ساعات پیش‌فرض ۸ تا ۱۷ با یک ساعت استراحت اعمال شد؛ در صورت نیاز ویرایش کنید.',
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ثبت گروهی ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(false);
    }
  };

  const exportMonth = (): void => {
    const columns: ExportColumn<AttendanceRecord>[] = [
      { header: 'شماره پرسنلی', value: (row) => employees.find((item) => item.id === row.employeeId)?.personnelCode ?? '' },
      {
        header: 'نام و نام خانوادگی',
        value: (row) => {
          const employee = employees.find((item) => item.id === row.employeeId);
          return employee ? `${employee.firstName} ${employee.lastName}` : '';
        },
        width: 26,
      },
      {
        header: 'تاریخ',
        value: (row) =>
          `${row.jalali.jy}/${String(row.jalali.jm).padStart(2, '0')}/${String(row.jalali.jd).padStart(2, '0')}`,
      },
      { header: 'نوع کارکرد', value: (row) => ATTENDANCE_KIND_LABELS[row.kind] },
      { header: 'ورود', value: (row) => row.checkIn ?? '' },
      { header: 'خروج', value: (row) => row.checkOut ?? '' },
      { header: 'استراحت (دقیقه)', value: (row) => row.breakMinutes ?? 0 },
      { header: 'توضیحات', value: (row) => row.note ?? '', width: 30 },
    ];
    exportToExcel({
      fileName: `dastmozd-attendance-${jy}-${String(jm).padStart(2, '0')}.xlsx`,
      sheetName: 'کارکرد',
      columns,
      rows: records,
      title: `کارکرد ${JALALI_MONTH_LABELS[jm - 1]} ${jy}`,
    });
    toast({ tone: 'success', title: 'خروجی اکسل کارکرد آماده شد' });
  };

  const holidays = useMemo(
    () => days.filter((day) => jalaliWeekday({ jy, jm, jd: day }) === 6),
    [days, jy, jm],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`حضور و غیاب ${monthLabel}`}
        description={`ثبت و ویرایش کارکرد روزانه سال ${toPersianDigits(jy)} — تعداد روزهای ماه: ${toPersianDigits(days.length)}`}
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <>
            <Button variant="outline" onClick={downloadAttendanceTemplate}>
              <Download className="size-4" />
              قالب اکسل
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              ورود از فایل دستگاه
            </Button>
            <Button variant="secondary" onClick={exportMonth} disabled={records.length === 0}>
              <Download className="size-4" />
              خروجی کارکرد
            </Button>
            <Button onClick={fillWorkdays} disabled={busy || filteredEmployees.length === 0}>
              <Wand2 className="size-4" />
              تکمیل روزهای کاری
            </Button>
          </>
        }
      />

      <Alert tone="info" title="قاعده پیش‌فرض تکمیل خودکار">
        روزهای شنبه تا پنج‌شنبه با ساعت ۸ تا ۱۷ و یک ساعت استراحت ثبت می‌شوند؛ روزهای جمعه به‌عنوان تعطیل هفتگی
        خالی می‌مانند. روزهای دارای رکورد دست‌نخورده باقی می‌مانند.
      </Alert>

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
            <div>
              <label className="sr-only" htmlFor="attendance-search">
                جست‌وجوی کارمند
              </label>
              <Input
                id="attendance-search"
                placeholder="جست‌وجوی کارمند بر پایه نام یا شماره پرسنلی…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="attendance-department">
                پالایش دپارتمان
              </label>
              <Select
                id="attendance-department"
                value={departmentId}
                placeholder="همه دپارتمان‌ها"
                options={(departments ?? []).map((department) => ({ value: department.id, label: department.title }))}
                onChange={(event) => setDepartmentId(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-xs text-[rgb(var(--dm-text-muted))]">
              <Badge tone="neutral">{toPersianDigits(records.length)} رکورد ثبت‌شده</Badge>
              <Badge tone="warning">{toPersianDigits(holidays.length)} جمعه</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={setTab}
        ariaLabel="حالت‌های ثبت کارکرد"
        tabs={[
          { value: 'grid', label: 'شبکه ماهانه' },
          { value: 'daily', label: 'ثبت روزانه' },
          { value: 'leaves', label: 'مانده مرخصی' },
        ]}
      />

      {tab === 'grid' ? (
        <Card>
          <CardHeader>
            <CardTitle>شبکه ماهانه کارکرد</CardTitle>
            <CardDescription>
              برای ویرایش هر روز، روی خانه مربوطه کلیک کنید. راهنمای نمادها: ح=عادی، ا=اضافه‌کار، ش=شب‌کاری،
              ت=تعطیل‌کاری، م=استحقاقی، ب=استعلاجی، خ=بدون حقوق، غ=غیبت، أ=مأموریت، د=دورکاری.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : filteredEmployees.length === 0 ? (
              <EmptyState
                title="کارمندی برای نمایش نیست"
                description="نخست پرونده کارکنان را ثبت کنید یا پالایه جست‌وجو را تغییر دهید."
                illustration={<IllustrationAttendance />}
              />
            ) : (
              <div className="dm-scroll max-h-[70vh] overflow-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">
                    شبکه کارکرد ماهانه؛ هر خانه یک روز از ماه برای یک کارمند است.
                  </caption>
                  <thead className="sticky top-0 z-10 bg-[rgb(var(--dm-surface))]">
                    <tr>
                      <th
                        scope="col"
                        className="sticky right-0 z-20 min-w-44 border-b border-l border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] px-3 py-2 text-right"
                      >
                        کارمند
                      </th>
                      {days.map((day) => {
                        const weekday = jalaliWeekday({ jy, jm, jd: day });
                        return (
                          <th
                            key={day}
                            scope="col"
                            title={JALALI_WEEKDAYS[weekday]}
                            className={`w-9 border-b border-[rgb(var(--dm-border))] px-0.5 py-2 text-center font-semibold ${
                              weekday === 6 ? 'bg-[rgb(var(--dm-warning-soft))]' : ''
                            }`}
                          >
                            <span className="dm-numeric block">{toPersianDigits(day)}</span>
                            <span className="block text-[0.55rem] font-normal opacity-70">
                              {JALALI_WEEKDAYS[weekday]?.slice(0, 1)}
                            </span>
                          </th>
                        );
                      })}
                      <th scope="col" className="min-w-24 border-b border-r border-[rgb(var(--dm-border))] px-2 py-2">
                        ثبت‌شده
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const filled = coverage?.get(employee.id) ?? 0;
                      return (
                        <tr key={employee.id} className="odd:bg-[rgb(var(--dm-surface-sunken))]/40">
                          <th
                            scope="row"
                            className="sticky right-0 z-10 border-b border-l border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] px-3 py-1.5 text-right font-semibold"
                          >
                            <button
                              type="button"
                              className="hover:text-[rgb(var(--dm-primary))]"
                              onClick={() => {
                                setSelectedEmployeeId(employee.id);
                                setTab('daily');
                              }}
                            >
                              {employee.firstName} {employee.lastName}
                            </button>
                            <span className="dm-numeric block text-[0.6rem] font-normal opacity-70">
                              {toPersianDigits(employee.personnelCode)}
                            </span>
                          </th>
                          {days.map((day) => {
                            const record = byEmployeeDate.get(`${employee.id}|${day}`);
                            const weekday = jalaliWeekday({ jy, jm, jd: day });
                            return (
                              <td key={day} className="border-b border-[rgb(var(--dm-border))] p-0.5 text-center">
                                <button
                                  type="button"
                                  className={`size-7 rounded-[var(--dm-radius-sm)] text-xs font-bold transition-transform hover:scale-110 ${
                                    record
                                      ? KIND_STYLE[record.kind]
                                      : weekday === 6
                                        ? 'bg-[rgb(var(--dm-warning-soft))]/60 text-[rgb(var(--dm-text-subtle))]'
                                        : 'bg-transparent text-[rgb(var(--dm-text-subtle))] hover:bg-[rgb(var(--dm-surface-sunken))]'
                                  }`}
                                  aria-label={`${employee.firstName} ${employee.lastName}، روز ${day} ${
                                    JALALI_MONTH_LABELS[jm - 1]
                                  }${record ? `، ${ATTENDANCE_KIND_LABELS[record.kind]}` : '، ثبت‌نشده'}`}
                                  onClick={() => setEditing({ employee, day, ...(record ? { record } : {}) })}
                                >
                                  {record ? KIND_GLYPH[record.kind] : weekday === 6 ? 'ج' : '·'}
                                </button>
                              </td>
                            );
                          })}
                          <td className="dm-numeric border-b border-r border-[rgb(var(--dm-border))] px-2 py-1 text-center">
                            {toPersianDigits(filled)}/{toPersianDigits(days.length)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'daily' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>انتخاب کارمند</CardTitle>
              <CardDescription>برای ثبت روزانه، نخست کارمند را انتخاب کنید.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                aria-label="انتخاب کارمند"
                value={selectedEmployeeId}
                placeholder="انتخاب کارمند"
                options={filteredEmployees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.firstName} ${employee.lastName} (${employee.personnelCode})`,
                }))}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              />
              {selectedEmployee ? (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-semibold">{selectedEmployee.position}</p>
                  <p className="text-xs text-[rgb(var(--dm-text-muted))]">
                    روزهای ثبت‌شده در {monthLabel}: {toPersianDigits(coverage?.get(selectedEmployee.id) ?? 0)} از{' '}
                    {toPersianDigits(days.length)}
                  </p>
                  <Progress value={coverage?.get(selectedEmployee.id) ?? 0} max={days.length} label="پیشرفت ثبت کارکرد" />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>کارکرد روز به روز {selectedEmployee ? `— ${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}</CardTitle>
              <CardDescription>هر روز را انتخاب و ساعت‌ها و نوع کارکرد را ثبت کنید.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedEmployee ? (
                <p className="text-sm text-[rgb(var(--dm-text-subtle))]">کاری انتخاب نشده است.</p>
              ) : (
                days.map((day) => {
                  const record = byEmployeeDate.get(`${selectedEmployee.id}|${day}`);
                  const weekday = jalaliWeekday({ jy, jm, jd: day });
                  const hours =
                    record?.checkIn && record.checkOut ? minutesBetween(record.checkIn, record.checkOut) / 60 : null;
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between gap-3 rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="dm-numeric w-10 text-center text-sm font-bold">{toPersianDigits(day)}</span>
                        <span className="text-xs text-[rgb(var(--dm-text-muted))]">{JALALI_WEEKDAYS[weekday]}</span>
                        {record ? (
                          <Badge tone="neutral">{ATTENDANCE_KIND_LABELS[record.kind]}</Badge>
                        ) : (
                          <Badge tone={weekday === 6 ? 'warning' : 'neutral'}>
                            {weekday === 6 ? 'تعطیل هفتگی' : 'ثبت‌نشده'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {record?.checkIn && record.checkOut ? (
                          <span className="dm-numeric text-xs text-[rgb(var(--dm-text-muted))]">
                            {toPersianDigits(record.checkIn)} – {toPersianDigits(record.checkOut)}
                            {hours !== null ? ` (${toPersianDigits(Math.round(hours * 10) / 10)} ساعت)` : ''}
                          </span>
                        ) : null}
                        <Button
                          size="sm"
                          variant={record ? 'outline' : 'primary'}
                          onClick={() => setEditing({ employee: selectedEmployee, day, ...(record ? { record } : {}) })}
                        >
                          {record ? 'ویرایش' : 'ثبت'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'leaves' ? (
        <Card>
          <CardHeader>
            <CardTitle>مانده مرخصی سال {toPersianDigits(jy)}</CardTitle>
            <CardDescription>
              استحقاق مرخصی سالانه {toPersianDigits(profile.leave.annualPaidLeaveDays)} روز (ماده ۶۴ قانون کار)؛
              مصرف از رکوردهای همین سال محاسبه می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeaveTable
              employees={filteredEmployees}
              balances={leaveBalances}
              annualDays={profile.leave.annualPaidLeaveDays}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>خلاصه کارکرد دوره</CardTitle>
            <CardDescription>
              جمع ساعات و بلوک‌های کارکرد {monthLabel} بر پایه پروفایل حقوقی {toPersianDigits(jy)}.
            </CardDescription>
          </div>
          <Badge tone={profile.verified ? 'success' : 'warning'}>
            {profile.verified ? 'پروفایل تأییدشده' : 'در انتظار تأیید بخشنامه'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="جمع ساعات عادی"
            value={records.reduce((total, record) => {
              if (!record.checkIn || !record.checkOut) return total;
              return total + minutesBetween(record.checkIn, record.checkOut) / 60;
            }, 0)}
            unit="ساعت"
          />
          <SummaryTile
            label="روزهای عادی"
            value={records.filter((record) => record.kind === 'present').length}
            unit="روز"
          />
          <SummaryTile
            label="اضافه‌کار / شب‌کاری"
            value={records.filter((record) => record.kind === 'overtime' || record.kind === 'night').length}
            unit="روز"
          />
          <SummaryTile
            label="غیبت‌ها"
            value={records.filter((record) => record.kind === 'absence').length}
            unit="روز"
            tone="danger"
          />
        </CardContent>
      </Card>

      {editing ? (
        <DayEditorDialog
          open
          employee={editing.employee}
          day={editing.day}
          jy={jy}
          jm={jm}
          {...(editing.record ? { record: editing.record } : {})}
          busy={busy}
          onOpenChange={() => setEditing(null)}
          onSave={saveDay}
          onRequestClear={(recordId) =>
            setPendingClear({ employeeId: editing.employee.id, day: editing.day, recordId })
          }
          summary={monthSummary ?? undefined}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingClear)}
        onOpenChange={(open) => {
          if (!open) setPendingClear(null);
        }}
        title="حذف رکورد کارکرد"
        description="با حذف این رکورد، روز مورد نظر به حالت ثبت‌نشده بازمی‌گردد."
        confirmLabel="حذف کن"
        onConfirm={async () => {
          if (!pendingClear) return;
          try {
            await deleteAttendance(pendingClear.recordId);
            toast({ tone: 'success', title: 'رکورد کارکرد حذف شد' });
          } catch (error) {
            toast({
              tone: 'error',
              title: 'حذف ناموفق بود',
              description: error instanceof Error ? error.message : 'خطای نامشخص',
            });
          } finally {
            setPendingClear(null);
            setEditing(null);
          }
        }}
      />

      <AttendanceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        employees={employees}
        jy={jy}
        jm={jm}
        onImported={() => setTab('grid')}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string;
  value: number;
  unit: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3.5">
      <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p
        className={`dm-numeric mt-1 text-lg font-bold ${
          tone === 'danger' ? 'text-[rgb(var(--dm-danger))]' : 'text-[rgb(var(--dm-text))]'
        }`}
      >
        {toPersianDigits(Math.round(value * 10) / 10)}{' '}
        <span className="text-xs font-normal opacity-70">{unit}</span>
      </p>
    </div>
  );
}

function LeaveTable({
  employees,
  balances,
  annualDays,
}: {
  employees: Employee[];
  balances: Map<string, { paidUsed: number; sickUsed: number; unpaidUsed: number }>;
  annualDays: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>کارمند</TableHead>
          <TableHead>استحقاق سالانه</TableHead>
          <TableHead>استفاده‌شده (استحقاقی)</TableHead>
          <TableHead>استعلاجی</TableHead>
          <TableHead>بدون حقوق</TableHead>
          <TableHead>مانده</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const balance = balances.get(employee.id) ?? { paidUsed: 0, sickUsed: 0, unpaidUsed: 0 };
          const remaining = Math.max(0, annualDays - balance.paidUsed);
          return (
            <TableRow key={employee.id}>
              <TableCell className="font-semibold">
                {employee.firstName} {employee.lastName}
              </TableCell>
              <TableCell className="dm-numeric">{toPersianDigits(annualDays)} روز</TableCell>
              <TableCell className="dm-numeric">{toPersianDigits(balance.paidUsed)} روز</TableCell>
              <TableCell className="dm-numeric">{toPersianDigits(balance.sickUsed)} روز</TableCell>
              <TableCell className="dm-numeric">{toPersianDigits(balance.unpaidUsed)} روز</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="dm-numeric font-bold">{toPersianDigits(remaining)} روز</span>
                  <Progress value={balance.paidUsed} max={annualDays} className="w-24" />
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DayEditorDialog({
  open,
  employee,
  day,
  jy,
  jm,
  record,
  busy,
  summary,
  onOpenChange,
  onSave,
  onRequestClear,
}: {
  open: boolean;
  employee: Employee;
  day: number;
  jy: number;
  jm: number;
  record?: AttendanceRecord;
  busy: boolean;
  summary?: Awaited<ReturnType<typeof summarizeEmployeeMonth>>;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    employeeId: string;
    day: number;
    kind: AttendanceKind;
    checkIn?: string;
    checkOut?: string;
    breakMinutes: number;
    note?: string;
  }) => Promise<void>;
  onRequestClear: (recordId: string) => void;
}) {
  const [kind, setKind] = useState<AttendanceKind>(record?.kind ?? 'present');
  const [checkIn, setCheckIn] = useState(record?.checkIn ?? '08:00');
  const [checkOut, setCheckOut] = useState(record?.checkOut ?? '17:00');
  const [breakMinutes, setBreakMinutes] = useState(String(record?.breakMinutes ?? 60));
  const [note, setNote] = useState(record?.note ?? '');

  useEffect(() => {
    setKind(record?.kind ?? 'present');
    setCheckIn(record?.checkIn ?? '08:00');
    setCheckOut(record?.checkOut ?? '17:00');
    setBreakMinutes(String(record?.breakMinutes ?? 60));
    setNote(record?.note ?? '');
  }, [record, day]);

  const weekday = jalaliWeekday({ jy, jm, jd: day });
  const needsTimes = kind === 'present' || kind === 'overtime' || kind === 'night' || kind === 'holiday' || kind === 'remote';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title={`کارکرد ${employee.firstName} ${employee.lastName}`}
        description={`${JALALI_WEEKDAYS[weekday]} ${toPersianDigits(day)} ${JALALI_MONTH_LABELS[jm - 1]} ${toPersianDigits(jy)}`}
        footer={
          <>
            {record ? (
              <Button
                variant="danger"
                onClick={() => onRequestClear(record.id)}
                className="ml-auto"
              >
                حذف رکورد
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void onSave({
                  employeeId: employee.id,
                  day,
                  kind,
                  ...(needsTimes ? { checkIn, checkOut } : {}),
                  breakMinutes: Number(breakMinutes) || 0,
                  ...(note ? { note } : {}),
                })
              }
            >
              {busy ? 'در حال ذخیره…' : 'ثبت کارکرد'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="نوع کارکرد" htmlFor="day-kind">
            <Select
              id="day-kind"
              value={kind}
              options={(Object.keys(ATTENDANCE_KIND_LABELS) as AttendanceKind[]).map((value) => ({
                value,
                label: ATTENDANCE_KIND_LABELS[value],
              }))}
              onChange={(event) => setKind(event.target.value as AttendanceKind)}
            />
          </FormField>
          <FormField label="استراحت (دقیقه)" htmlFor="day-break">
            <Input
              id="day-break"
              numeric
              inputMode="numeric"
              value={breakMinutes}
              onChange={(event) => setBreakMinutes(event.target.value)}
            />
          </FormField>
          {needsTimes ? (
            <>
              <FormField label="ساعت ورود" htmlFor="day-in">
                <Input
                  id="day-in"
                  dir="ltr"
                  className="text-center"
                  type="time"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                />
              </FormField>
              <FormField label="ساعت خروج" htmlFor="day-out">
                <Input
                  id="day-out"
                  dir="ltr"
                  className="text-center"
                  type="time"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                />
              </FormField>
            </>
          ) : null}
          <FormField label="توضیحات" htmlFor="day-note" className="sm:col-span-2">
            <Textarea id="day-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
        </div>

        {summary ? (
          <div className="rounded-[var(--dm-radius-lg)] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs text-[rgb(var(--dm-text-muted))]">
            <p className="mb-1 font-bold text-[rgb(var(--dm-text))]">خلاصه ماه این کارمند</p>
            <p className="dm-numeric">
              کارکرد {toPersianDigits(summary.presentDays)} روز · اضافه‌کار {toPersianDigits(summary.overtimeHours)}{' '}
              ساعت · شب‌کاری {toPersianDigits(summary.nightHours)} ساعت · تأخیر{' '}
              {toPersianDigits(summary.lateMinutes)} دقیقه
            </p>
          </div>
        ) : null}

        {record?.checkIn && record.checkOut ? (
          <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
            ساعات ثبت‌شده فعلی: {toPersianDigits(record.checkIn)} تا {toPersianDigits(record.checkOut)} · مبلغ ساعتی
            پایه:{' '}
            <Money value={Math.round(employee.salary.baseMonthly / 220)} size="sm" />
          </p>
        ) : null}

        <Alert tone="info" title="محاسبه خودکار">
          ساعات کارکرد، شب‌کاری و اضافه‌کار هنگام اجرای دوره حقوقی به‌صورت خودکار از همین رکوردها محاسبه می‌شود.
        </Alert>
      </DialogContent>
    </Dialog>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AttendancePageInner />
    </Suspense>
  );
}
