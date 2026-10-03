'use client';

import { formatPersianNumber, toPersianDigits } from '@dastmozd/core';
import { db, listLoans, listPayslips, summarizeEmployeeMonth } from '@dastmozd/db';
import type { Employee } from '@dastmozd/types';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  Money,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  useToast,
} from '@dastmozd/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Printer, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { JALALI_MONTH_LABELS } from '@/lib/hooks';
import { ListRow } from './list-row';

const STATUS_LABELS: Record<Employee['status'], string> = {
  active: 'شاغل',
  inactive: 'غیرفعال',
  'unpaid-leave': 'مرخصی بدون حقوق',
  terminated: 'تسویه‌شده',
};

const CONTRACT_LABELS: Record<Employee['contractType'], string> = {
  labour: 'کارگری (قانون کار)',
  'part-time': 'پاره‌وقت',
  temporary: 'موقت',
  contractual: 'پیمانی',
  official: 'رسمی',
  internship: 'کارآموزی',
};

const EDUCATION_LABELS: Record<Employee['education'], string> = {
  'below-diploma': 'زیر دیپلم',
  diploma: 'دیپلم',
  associate: 'کاردانی',
  bachelor: 'کارشناسی',
  master: 'کارشناسی ارشد',
  phd: 'دکتری',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  restore: 'بازگردانی',
  calculate: 'محاسبه',
  import: 'ورود گروهی',
  export: 'خروجی',
  lock: 'قفل دوره',
  unlock: 'باز کردن دوره',
};

export interface EmployeeProfileDialogProps {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
}

/**
 * پرونده کارمند در قالب زبانه‌ها: اطلاعات فردی، شغلی، کارکرد دوره جاری،
 * فیش‌های حقوقی، وام‌ها و رهگیری تغییرات.
 */
export function EmployeeProfileDialog({
  employee,
  onOpenChange,
  onEdit,
}: EmployeeProfileDialogProps) {
  const [tab, setTab] = useState('personal');
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const { toast } = useToast();
  const employeeId = employee?.id ?? '';

  const payslips = useLiveQuery(
    () => (employeeId ? listPayslips(employeeId) : Promise.resolve([])),
    [employeeId],
    undefined,
  );
  const loans = useLiveQuery(
    () => (employeeId ? listLoans(employee?.companyId, employeeId) : Promise.resolve([])),
    [employeeId, employee?.companyId],
    undefined,
  );
  const summary = useLiveQuery(
    () => (employeeId ? summarizeEmployeeMonth(employeeId, fiscalYear, currentMonth) : Promise.resolve(null)),
    [employeeId, fiscalYear, currentMonth],
    undefined,
  );
  const audit = useLiveQuery(
    async () => {
      if (!employeeId) return [];
      const rows = await db.auditLog.where('entityId').equals(employeeId).toArray();
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
    },
    [employeeId],
    undefined,
  );

  const children = useMemo(() => employee?.children ?? [], [employee]);

  if (!employee) return null;

  const departmentLabel = employee.departmentId;

  const copyDetails = async (): Promise<void> => {
    const text = [
      `نام: ${employee.firstName} ${employee.lastName}`,
      `شماره پرسنلی: ${employee.personnelCode}`,
      `کد ملی: ${employee.nationalId}`,
      `سمت: ${employee.position}`,
      `پایه حقوق: ${employee.salary.baseMonthly} ریال`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'اطلاعات پرونده در حافظه موقت کپی شد' });
    } catch {
      toast({ tone: 'error', title: 'کپی اطلاعات ممکن نشد', description: 'دسترسی به حافظه موقت رد شده است.' });
    }
  };

  return (
    <Dialog open={Boolean(employee)} onOpenChange={onOpenChange}>
      <DialogContent
        size="wide"
        title={`${employee.firstName} ${employee.lastName}`}
        description={`شماره پرسنلی ${employee.personnelCode} · کد ملی ${employee.nationalId}`}
        footer={
          <>
            <Button variant="ghost" onClick={copyDetails}>
              کپی مشخصات
            </Button>
            <Button variant="outline" onClick={() => onEdit(employee)}>
              <Pencil className="size-4" />
              ویرایش پرونده
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={employee.status === 'active' ? 'success' : 'warning'}>
            {STATUS_LABELS[employee.status]}
          </Badge>
          <Badge tone="neutral">{CONTRACT_LABELS[employee.contractType]}</Badge>
          <Badge tone="info">
            {employee.gender === 'male' ? 'مرد' : 'زن'} · {employee.maritalStatus === 'married' ? 'متأهل' : 'مجرد'}
          </Badge>
          {children.length > 0 ? <Badge tone="accent">{toPersianDigits(children.length)} فرزند</Badge> : null}
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          ariaLabel="زبانه‌های پرونده کارمند"
          tabs={[
            { value: 'personal', label: 'اطلاعات فردی' },
            { value: 'job', label: 'اطلاعات شغلی' },
            { value: 'attendance', label: 'کارکرد دوره' },
            { value: 'payslips', label: 'فیش‌های حقوقی', badge: payslips?.length ?? 0 },
            { value: 'loans', label: 'وام و اقساط', badge: loans?.length ?? 0 },
            { value: 'audit', label: 'رهگیری تغییرات' },
          ]}
        />

        {tab === 'personal' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام پدر" value={employee.fatherName} />
            <Field label="شماره شناسنامه" value={employee.idCardNumber} numeric />
            <Field
              label="تاریخ تولد"
              value={`${toPersianDigits(employee.birthDate.jy)}/${toPersianDigits(
                String(employee.birthDate.jm).padStart(2, '0'),
              )}/${toPersianDigits(String(employee.birthDate.jd).padStart(2, '0'))}`}
              numeric
            />
            <Field label="محل تولد" value={employee.birthPlace ?? '—'} />
            <Field label="مدرک تحصیلی" value={EDUCATION_LABELS[employee.education]} />
            <Field label="شماره شبا" value={employee.bankAccount?.iban ?? '—'} numeric />
            <Field label="بانک" value={employee.bankAccount?.bankName ?? '—'} />
            <Field label="یادداشت" value={employee.notes ?? '—'} className="sm:col-span-2" />
            {children.length > 0 ? (
              <div className="sm:col-span-2">
                <Separator className="my-2" />
                <p className="mb-2 text-xs font-bold text-[rgb(var(--dm-text-muted))]">فرزندان (حق اولاد)</p>
                <div className="space-y-2">
                  {children.map((child) => (
                    <ListRow
                      key={child.id}
                      title={child.firstName ?? 'بدون نام'}
                      meta={
                        <span className="flex flex-wrap gap-2">
                          <span>
                            تولد {toPersianDigits(child.birthDate.jy)}/
                            {toPersianDigits(String(child.birthDate.jm).padStart(2, '0'))}/
                            {toPersianDigits(String(child.birthDate.jd).padStart(2, '0'))}
                          </span>
                          {child.isStudent ? <Badge tone="info">تحت تحصیل</Badge> : null}
                          {child.isDisabled ? <Badge tone="warning">دارای معلولیت</Badge> : null}
                        </span>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'job' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="سمت" value={employee.position} />
            <Field label="شناسه دپارتمان" value={departmentLabel} />
            <Field
              label="تاریخ استخدام"
              numeric
              value={`${toPersianDigits(employee.hireDate.jy)}/${toPersianDigits(
                String(employee.hireDate.jm).padStart(2, '0'),
              )}/${toPersianDigits(String(employee.hireDate.jd).padStart(2, '0'))}`}
            />
            <Field label="شماره بیمه" value={employee.insuranceNumber ?? '—'} numeric />
            <Field label="پایه حقوق ماهانه" value={`${formatPersianNumber(employee.salary.baseMonthly)} ریال`} numeric />
            <Field
              label="پایه سنوات ماهانه"
              value={`${formatPersianNumber(employee.salary.seniorityMonthly)} ریال`}
              numeric
            />
            <Field
              label="حق مسکن (بازنویسی)"
              value={employee.salary.housingMonthly ? `${formatPersianNumber(employee.salary.housingMonthly)} ریال` : 'مبلغ قانونی'}
              numeric
            />
            <Field
              label="بن کارگری (بازنویسی)"
              value={employee.salary.groceryMonthly ? `${formatPersianNumber(employee.salary.groceryMonthly)} ریال` : 'مبلغ قانونی'}
              numeric
            />
            {(employee.salary.extraFixedAllowances ?? []).length > 0 ? (
              <div className="sm:col-span-2 space-y-2">
                <Separator className="my-1" />
                <p className="text-xs font-bold text-[rgb(var(--dm-text-muted))]">مزایای ثابت اختصاصی</p>
                {(employee.salary.extraFixedAllowances ?? []).map((item) => (
                  <ListRow
                    key={item.title}
                    title={item.title}
                    meta={<Money value={item.amount} />}
                    icon={<Wallet className="size-4" aria-hidden />}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'attendance' ? (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--dm-text-muted))]">
              خلاصه کارکرد {JALALI_MONTH_LABELS[currentMonth - 1]} {toPersianDigits(fiscalYear)}
            </p>
            {!summary ? (
              <p className="text-sm text-[rgb(var(--dm-text-subtle))]">در حال محاسبه…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Metric label="روزهای کارکرد" value={summary.presentDays} />
                <Metric label="مرخصی استحقاقی" value={summary.paidLeaveDays} />
                <Metric label="مرخصی استعلاجی" value={summary.sickLeaveDays} />
                <Metric label="مرخصی بدون حقوق" value={summary.unpaidLeaveDays} />
                <Metric label="غیبت" value={summary.absenceDays} tone="danger" />
                <Metric label="مأموریت" value={summary.missionDays} />
                <Metric label="ساعات عادی" value={summary.regularHours} />
                <Metric label="ساعات اضافه‌کار" value={summary.overtimeHours} />
                <Metric label="ساعات شب‌کاری" value={summary.nightHours} />
                <Metric label="ساعات تعطیل‌کاری" value={summary.holidayHours} />
                <Metric label="تأخیر (دقیقه)" value={summary.lateMinutes} tone={summary.lateMinutes > 0 ? 'warning' : 'default'} />
                <Metric
                  label="تعجیل در خروج (دقیقه)"
                  value={summary.earlyLeaveMinutes}
                  tone={summary.earlyLeaveMinutes > 0 ? 'warning' : 'default'}
                />
              </div>
            )}
            <Alert tone="info" title="ویرایش کارکرد">
              برای ثبت یا اصلاح کارکرد روزانه، به صفحه «حضور و غیاب» بروید؛ در آنجا شبکه ماهانه و ورود از فایل
              دستگاه‌های حضور در دسترس است.
            </Alert>
          </div>
        ) : null}

        {tab === 'payslips' ? (
          <div className="space-y-3">
            {(payslips ?? []).length === 0 ? (
              <p className="text-sm text-[rgb(var(--dm-text-subtle))]">
                برای این کارمند هنوز فیش حقوقی صادر نشده است.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>دوره</TableHead>
                    <TableHead>جمع پرداختی</TableHead>
                    <TableHead>بیمه</TableHead>
                    <TableHead>مالیات</TableHead>
                    <TableHead>خالص پرداختی</TableHead>
                    <TableHead>کد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payslips ?? [])
                    .slice()
                    .sort(
                      (a, b) =>
                        b.period.jy - a.period.jy || b.period.jm - a.period.jm,
                    )
                    .map((slip) => (
                      <TableRow key={slip.id}>
                        <TableCell className="font-semibold">
                          {JALALI_MONTH_LABELS[slip.period.jm - 1]} {toPersianDigits(slip.period.jy)}
                        </TableCell>
                        <TableCell>
                          <Money value={slip.totals.grossEarnings} />
                        </TableCell>
                        <TableCell>
                          <Money value={slip.insurance.employeeShare} tone="muted" />
                        </TableCell>
                        <TableCell>
                          <Money value={slip.tax.total} tone="muted" />
                        </TableCell>
                        <TableCell>
                          <Money value={slip.totals.netPay} tone="positive" />
                        </TableCell>
                        <TableCell className="dm-numeric text-xs">{slip.verificationCode}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `/reports?employee=${employee.id}`;
              }}
            >
              <Printer className="size-4" />
              رفتن به فیش‌ها و چاپ
            </Button>
          </div>
        ) : null}

        {tab === 'loans' ? (
          <div className="space-y-3">
            {(loans ?? []).length === 0 ? (
              <p className="text-sm text-[rgb(var(--dm-text-subtle))]">قرارداد وامی برای این کارمند ثبت نشده است.</p>
            ) : (
              (loans ?? []).map((loan) => {
                const paid = loan.paidInstallments;
                return (
                  <ListRow
                    key={loan.id}
                    title={loan.title}
                    icon={<Wallet className="size-4" aria-hidden />}
                    meta={
                      <span className="flex flex-wrap items-center gap-2">
                        <span>
                          قسط {toPersianDigits(paid)} از {toPersianDigits(loan.installmentCount)}
                        </span>
                        <span>
                          مبلغ قسط: <Money value={loan.installmentAmount} size="sm" />
                        </span>
                        <span>
                          مانده: <Money value={loan.remainingBalance} size="sm" />
                        </span>
                        <Badge tone={loan.status === 'active' ? 'primary' : 'neutral'}>
                          {loan.status === 'active' ? 'جاری' : loan.status === 'settled' ? 'تسویه‌شده' : 'لغوشده'}
                        </Badge>
                      </span>
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div className="space-y-2">
            {(audit ?? []).length === 0 ? (
              <p className="text-sm text-[rgb(var(--dm-text-subtle))]">رکوردی در گزارش رهگیری ثبت نشده است.</p>
            ) : (
              (audit ?? []).map((entry) => (
                <ListRow
                  key={entry.id}
                  title={entry.summary}
                  meta={
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                      <span className="dm-numeric">{toPersianDigits(entry.createdAt.slice(0, 10))}</span>
                      <span className="dm-numeric text-[0.65rem] opacity-70">هش: {entry.hash.slice(0, 10)}</span>
                    </span>
                  }
                />
              ))
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  numeric,
  className,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-[rgb(var(--dm-text-subtle))]">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${numeric ? 'dm-numeric' : ''}`} dir={numeric ? 'rtl' : undefined}>
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'warning';
}) {
  const color =
    tone === 'danger'
      ? 'text-[rgb(var(--dm-danger))]'
      : tone === 'warning'
        ? 'text-[rgb(var(--dm-warning))]'
        : 'text-[rgb(var(--dm-text))]';
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3">
      <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p className={`dm-numeric mt-1 text-lg font-bold ${color}`}>{toPersianDigits(Math.round(value * 100) / 100)}</p>
    </div>
  );
}
