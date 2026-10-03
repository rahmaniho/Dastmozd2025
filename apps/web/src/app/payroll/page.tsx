'use client';

import type {
  AttendanceSummary,
  ExtraDeduction,
  ExtraEarning,
  PayrollRunOptions,
} from '@dastmozd/core';
import type { DeductionComponentKey, EarningComponentKey } from '@dastmozd/types';
import { formatPersianNumber, toPersianDigits } from '@dastmozd/core';
import {
  db,
  getPayrollRun,
  listLoans,
  listPayrollRuns,
  lockPayrollRun,
  payslipsOfRun,
  registerInstallment,
  runPayroll,
  summarizeEmployeeMonth,
  unlockPayrollRun,
  installmentForPeriod,
} from '@dastmozd/db';
import type { PayrollRun } from '@dastmozd/types';
import { resolveLegalProfile } from '@dastmozd/legal';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FormField,
  IllustrationPayroll,
  Money,
  PageHeader,
  Progress,
  Select,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@dastmozd/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BadgeCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  LockOpen,
  Trash2,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { PayrollPreview } from '@/components/payroll-preview';
import { useActiveEmployees, usePeriodNavigator } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

const STEPS = [
  { id: 'basics', label: 'اطلاعات پایه', hint: 'دوره، کارکنان و گزینه‌های محاسبه' },
  { id: 'attendance', label: 'کارکرد', hint: 'بازبینی ساعات و روزهای ماه' },
  { id: 'earnings', label: 'مزایا', hint: 'پاداش، ایاب‌وذهاب و سایر دریافتی‌ها' },
  { id: 'deductions', label: 'کسورات', hint: 'وام، مساعده، بیمه تکمیلی و جریمه' },
] as const;

const EARNING_OPTIONS: Array<{ value: EarningComponentKey; label: string }> = [
  { value: 'bonus', label: 'پاداش / کارانه' },
  { value: 'transport', label: 'ایاب و ذهاب' },
  { value: 'food', label: 'حق غذا' },
  { value: 'mission', label: 'حق مأموریت' },
  { value: 'hardship', label: 'حق سختی کار' },
  { value: 'supervision', label: 'حق سرپرستی' },
  { value: 'shift-work', label: 'نوبت‌کاری' },
  { value: 'other-benefit', label: 'سایر مزایا' },
  { value: 'eidi', label: 'عیدی و پاداش پایان سال' },
  { value: 'leave-encashment', label: 'بازخرید مرخصی' },
];

const DEDUCTION_OPTIONS: Array<{ value: DeductionComponentKey; label: string }> = [
  { value: 'loan', label: 'قسط وام' },
  { value: 'advance', label: 'مساعده' },
  { value: 'supplementary-insurance', label: 'بیمه تکمیلی' },
  { value: 'penalty', label: 'جریمه' },
  { value: 'union-fee', label: 'کسورات اتحادیه' },
  { value: 'membership', label: 'حق عضویت' },
  { value: 'other-deduction', label: 'سایر کسورات' },
];

/** شکل واحد ورودی‌های دستی ویزارد؛ هنگام ارسال به موتور به نوع دقیق تبدیل می‌شود. */
interface ExtraItem {
  key: string;
  amount: number;
  note?: string;
}

interface StepState {
  selectedIds: string[];
  earnings: Record<string, ExtraItem[]>;
  deductions: Record<string, ExtraItem[]>;
}

const toExtraEarning = (item: ExtraItem): ExtraEarning => ({
  key: item.key as EarningComponentKey,
  amount: item.amount,
  ...(item.note ? { note: item.note } : {}),
});

const toExtraDeduction = (item: ExtraItem): ExtraDeduction => ({
  key: item.key as DeductionComponentKey,
  amount: item.amount,
  ...(item.note ? { note: item.note } : {}),
});

export default function PayrollPage() {
  const companyId = useAppStore((state) => state.companyId);
  const displayName = useAppStore((state) => state.displayName);
  const { jy, jm, monthLabel } = usePeriodNavigator();
  const employees = useActiveEmployees();
  const { toast } = useToast();
  const { profile } = resolveLegalProfile(jy);

  const [step, setStep] = useState(0);
  const [state, setState] = useState<StepState>({ selectedIds: [], earnings: {}, deductions: {} });
  const [includeLoans, setIncludeLoans] = useState(true);
  const [options, setOptions] = useState<PayrollRunOptions>({
    insuranceEnabled: true,
    taxEnabled: true,
    includeSeniority: true,
    rateBaseMode: 'base',
    nightWorkMode: 'full-rate',
  });
  const [previewEmployeeId, setPreviewEmployeeId] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [pendingLock, setPendingLock] = useState<PayrollRun | null>(null);

  const selected = useMemo(() => {
    if (state.selectedIds.length === 0) return employees;
    const set = new Set(state.selectedIds);
    return employees.filter((employee) => set.has(employee.id));
  }, [employees, state.selectedIds]);

  const company = useLiveQuery(
    async () => (companyId ? ((await db.companies.get(companyId)) ?? null) : null),
    [companyId],
    undefined,
  );

  const runs = useLiveQuery(
    async () => (companyId ? listPayrollRuns(companyId) : []),
    [companyId],
    undefined,
  );
  const periodRuns = useMemo(
    () => (runs ?? []).filter((run) => run.period.jy === jy && run.period.jm === jm),
    [runs, jy, jm],
  );
  const currentRun = periodRuns[0] ?? null;

  const summaries = useLiveQuery(
    async () => {
      const map = new Map<string, AttendanceSummary>();
      for (const employee of selected) {
        map.set(employee.id, await summarizeEmployeeMonth(employee.id, jy, jm));
      }
      return map;
    },
    [selected.map((employee) => employee.id).join(','), jy, jm],
    undefined,
  );

  const loans = useLiveQuery(
    async () => (companyId ? listLoans(companyId) : []),
    [companyId],
    undefined,
  );

  const activeLoansForPeriod = useMemo(
    () =>
      (loans ?? [])
        .map((loan) => ({ loan, amount: installmentForPeriod(loan, { jy, jm }) }))
        .filter((item) => item.amount > 0),
    [loans, jy, jm],
  );

  const coverageWarnings = useMemo(() => {
    if (!summaries) return [] as string[];
    const list: string[] = [];
    for (const employee of selected) {
      const summary = summaries.get(employee.id);
      if (!summary) continue;
      if (summary.absenceDays > 0) {
        list.push(
          `${employee.firstName} ${employee.lastName}: ${toPersianDigits(summary.absenceDays)} روز غیبت ثبت شده است.`,
        );
      }
      if (summary.unpaidLeaveDays > 0) {
        list.push(
          `${employee.firstName} ${employee.lastName}: ${toPersianDigits(summary.unpaidLeaveDays)} روز مرخصی بدون حقوق.`,
        );
      }
      if (summary.overtimeHours > profile.maxOvertimeHoursPerMonth) {
        list.push(
          `${employee.firstName} ${employee.lastName}: اضافه‌کار ${toPersianDigits(
            Math.round(summary.overtimeHours),
          )} ساعت، بیش از سقف مجاز ماهانه (${toPersianDigits(profile.maxOvertimeHoursPerMonth)} ساعت).`,
        );
      }
    }
    return list;
  }, [summaries, selected, profile.maxOvertimeHoursPerMonth]);

  const updateExtras = (
    kind: 'earnings' | 'deductions',
    employeeId: string,
    list: ExtraItem[],
  ): void => {
    setState((current) => ({ ...current, [kind]: { ...current[kind], [employeeId]: list } }));
  };

  const applyToAll = (kind: 'earnings' | 'deductions', item: ExtraItem): void => {
    setState((current) => {
      const next = { ...current[kind] };
      for (const employee of selected) {
        next[employee.id] = [...(next[employee.id] ?? []), item];
      }
      return { ...current, [kind]: next };
    });
    toast({
      tone: 'info',
      title: 'برای همه کارکنان انتخاب‌شده اعمال شد',
      description: `${toPersianDigits(selected.length)} کارمند به‌روزرسانی شدند.`,
    });
  };

  const execute = async (): Promise<void> => {
    if (!companyId) return;
    setRunning(true);
    setProgress({ done: 0, total: selected.length });
    try {
      const result = await runPayroll({
        companyId,
        jy,
        jm,
        employeeIds: selected.map((employee) => employee.id),
        includeLoanInstallments: includeLoans,
        earningsByEmployee: Object.fromEntries(
          Object.entries(state.earnings)
            .filter(([, list]) => list.length > 0)
            .map(([id, list]) => [id, list.map(toExtraEarning)]),
        ),
        deductionsByEmployee: Object.fromEntries(
          Object.entries(state.deductions)
            .filter(([, list]) => list.length > 0)
            .map(([id, list]) => [id, list.map(toExtraDeduction)]),
        ),
        options,
        actorName: displayName,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setLastRunId(result.run.id);
      toast({
        tone: 'success',
        title: `دوره ${monthLabel} محاسبه شد (نسخه ${toPersianDigits(result.run.version)})`,
        description: `${toPersianDigits(result.run.totals.employeeCount)} فیش صادر شد؛ خالص پرداختی ${formatPersianNumber(
          result.run.totals.netPay,
        )} ریال.`,
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'اجرای محاسبه ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const previewEmployee = previewEmployeeId
    ? (employees.find((employee) => employee.id === previewEmployeeId) ?? null)
    : (selected[0] ?? null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`محاسبه حقوق ${monthLabel}`}
        description={`اجرای دوره حقوقی سال ${toPersianDigits(jy)} در چهار گام — هر اجرا یک «نسخه» تازه می‌سازد.`}
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <>
            <Badge tone={profile.verified ? 'success' : 'warning'}>
              <BadgeCheck className="size-3.5" aria-hidden />
              {profile.verified
                ? `پروفایل ${profile.label} تأییدشده`
                : `پروفایل ${profile.label} (در انتظار بخشنامه)`}
            </Badge>
            {currentRun ? (
              <Badge tone={currentRun.status === 'locked' ? 'info' : 'primary'}>
                نسخه {toPersianDigits(currentRun.version)} ·{' '}
                {currentRun.status === 'locked' ? 'قفل‌شده' : 'محاسبه‌شده'}
              </Badge>
            ) : null}
          </>
        }
      />

      {selected.length === 0 ? (
        <EmptyState
          title="کارمند فعالی برای محاسبه وجود ندارد"
          description="نخست پرونده کارکنان را ثبت کنید یا وضعیت آن‌ها را به «شاغل» تغییر دهید."
          illustration={<IllustrationPayroll />}
          action={
            <Button asChild>
              <Link href="/employees">مدیریت کارکنان</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="dm-scroll flex gap-2 overflow-x-auto">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={step === index ? 'step' : undefined}
                  className={`min-w-44 flex-1 rounded-[var(--dm-radius-lg)] border p-3 text-right transition-colors ${
                    step === index
                      ? 'border-[rgb(var(--dm-primary))] bg-[rgb(var(--dm-primary-subtle))]'
                      : 'border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] hover:bg-[rgb(var(--dm-surface-sunken))]'
                  }`}
                >
                  <span className="dm-numeric text-xs text-[rgb(var(--dm-text-subtle))]">
                    گام {toPersianDigits(index + 1)}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold">{item.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] text-[rgb(var(--dm-text-muted))]">
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>

            {step === 0 ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>پروفایل حقوقی {profile.label}</CardTitle>
                    <CardDescription>{profile.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <LegalTile label="حداقل مزد روزانه" value={profile.minDailyWage} />
                    <LegalTile label="حداقل مزد ماهانه" value={profile.minMonthlyWage} />
                    <LegalTile label="حق مسکن" value={profile.housingAllowanceMonthly} />
                    <LegalTile label="بن کارگری" value={profile.groceryAllowanceMonthly} />
                    <LegalTile label="حق تأهل" value={profile.marriageAllowanceMonthly} />
                    <LegalTile
                      label="حق اولاد (هر فرزند)"
                      value={profile.childAllowanceDaily * 30}
                    />
                    <LegalTile label="سقف بیمه" value={profile.insurance.ceiling} />
                    <LegalTile label="معافیت مالیاتی ماهانه" value={profile.tax.monthlyExemption} />
                    <LegalTile
                      label="مزد ساعتی مبنای اضافه‌کار"
                      value={profile.minDailyWage}
                      hint="÷ ۷٫۳۳"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>انتخاب کارکنان</CardTitle>
                      <CardDescription>
                        {toPersianDigits(selected.length)} از {toPersianDigits(employees.length)}{' '}
                        کارمند فعال انتخاب شده است.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setState((c) => ({ ...c, selectedIds: employees.map((e) => e.id) }))
                        }
                      >
                        انتخاب همه
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setState((c) => ({ ...c, selectedIds: [] }))}
                      >
                        پاک‌کردن
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                    {employees.map((employee) => {
                      const checked = selected.some((item) => item.id === employee.id);
                      return (
                        <Checkbox
                          key={employee.id}
                          label={`${employee.firstName} ${employee.lastName} — ${employee.personnelCode}`}
                          checked={checked}
                          onChange={(event) =>
                            setState((current) => {
                              const ids = new Set(
                                current.selectedIds.length > 0
                                  ? current.selectedIds
                                  : employees.map((e) => e.id),
                              );
                              if (event.target.checked) ids.add(employee.id);
                              else ids.delete(employee.id);
                              return { ...current, selectedIds: [...ids] };
                            })
                          }
                        />
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>گزینه‌های محاسبه</CardTitle>
                    <CardDescription>
                      این تنظیمات روی همه کارکنان این اجرا اثر می‌گذارد و در متادیتای نسخه ذخیره
                      می‌شود.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Checkbox
                      label="محاسبه و کسر بیمه تأمین اجتماعی"
                      checked={options.insuranceEnabled !== false}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          insuranceEnabled: event.target.checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="محاسبه و کسر مالیات بر درآمد"
                      checked={options.taxEnabled !== false}
                      onChange={(event) =>
                        setOptions((current) => ({ ...current, taxEnabled: event.target.checked }))
                      }
                    />
                    <Checkbox
                      label="پرداخت پایه سنوات (در صورت احراز شرط یک سال سابقه)"
                      checked={options.includeSeniority !== false}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          includeSeniority: event.target.checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="تقسیم مزایای ثابت بر روزهای کارکرد"
                      checked={options.prorateBenefits ?? false}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          prorateBenefits: event.target.checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="افزودن خودکار اقساط وام به کسورات"
                      checked={includeLoans}
                      onChange={(event) => setIncludeLoans(event.target.checked)}
                    />
                    <FormField label="مبنای محاسبه مزد ساعتی" htmlFor="rate-base-mode">
                      <Select
                        id="rate-base-mode"
                        value={options.rateBaseMode ?? 'base'}
                        options={[
                          { value: 'base', label: 'فقط پایه حقوق (رویه جدول حداقل مزد)' },
                          { value: 'base+seniority', label: 'پایه حقوق + پایه سنوات' },
                        ]}
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            rateBaseMode: event.target.value as 'base' | 'base+seniority',
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="شیوه پرداخت شب‌کاری" htmlFor="night-mode">
                      <Select
                        id="night-mode"
                        value={options.nightWorkMode ?? 'full-rate'}
                        options={[
                          { value: 'full-rate', label: 'مزد کامل شب‌کاری (۱٫۳۵ برابر مزد ساعتی)' },
                          { value: 'premium', label: 'فقط مابه‌التفاوت ۳۵٪ (ماده ۵۸)' },
                        ]}
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            nightWorkMode: event.target.value as 'full-rate' | 'premium',
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="گِرد کردن مبلغ قابل پرداخت" htmlFor="rounding-step">
                      <Select
                        id="rounding-step"
                        value={String(options.roundingStep ?? 1000)}
                        options={[
                          { value: '1', label: 'بدون گِرد کردن (ریال دقیق)' },
                          { value: '1000', label: 'نزدیک‌ترین ۱٫۰۰۰ ریال' },
                          { value: '10000', label: 'نزدیک‌ترین ۱۰٫۰۰۰ ریال' },
                          { value: '100000', label: 'نزدیک‌ترین ۱۰۰٫۰۰۰ ریال' },
                        ]}
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            roundingStep: Number(event.target.value),
                          }))
                        }
                      />
                    </FormField>
                  </CardContent>
                </Card>

                {activeLoansForPeriod.length > 0 ? (
                  <Alert
                    tone="info"
                    title={`${toPersianDigits(activeLoansForPeriod.length)} قسط وام در این دوره`}
                  >
                    جمع اقساط این دوره{' '}
                    {formatPersianNumber(
                      activeLoansForPeriod.reduce((total, item) => total + item.amount, 0),
                    )}{' '}
                    ریال است و{' '}
                    {includeLoans ? 'به‌صورت خودکار از خالص پرداختی کسر می‌شود' : 'کسر نخواهد شد'}.
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle>بازبینی کارکرد {monthLabel}</CardTitle>
                  <CardDescription>
                    خلاصه ساعات و روزها از رکوردهای حضور و غیاب؛ برای اصلاح، به صفحه حضور و غیاب
                    بروید.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {coverageWarnings.length > 0 ? (
                    <Alert tone="warning" title="موارد نیازمند بازبینی">
                      <ul className="mr-4 list-disc space-y-1">
                        {coverageWarnings.slice(0, 8).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </Alert>
                  ) : (
                    <Alert tone="success" title="کارکرد همه کارکنان بدون هشدار است" />
                  )}

                  {!summaries ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="dm-scroll max-h-[28rem] overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>کارمند</TableHead>
                            <TableHead>کارکرد</TableHead>
                            <TableHead>اضافه‌کار</TableHead>
                            <TableHead>شب‌کاری</TableHead>
                            <TableHead>تعطیل‌کاری</TableHead>
                            <TableHead>مرخصی</TableHead>
                            <TableHead>غیبت</TableHead>
                            <TableHead>تأخیر</TableHead>
                            <TableHead>پیش‌نمایش</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.map((employee) => {
                            const summary = summaries.get(employee.id);
                            return (
                              <TableRow key={employee.id}>
                                <TableCell className="font-semibold">
                                  {employee.firstName} {employee.lastName}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary ? toPersianDigits(summary.presentDays) : '—'}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary
                                    ? toPersianDigits(Math.round(summary.overtimeHours * 10) / 10)
                                    : '—'}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary
                                    ? toPersianDigits(Math.round(summary.nightHours * 10) / 10)
                                    : '—'}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary
                                    ? toPersianDigits(Math.round(summary.holidayHours * 10) / 10)
                                    : '—'}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary
                                    ? toPersianDigits(
                                        summary.paidLeaveDays +
                                          summary.unpaidLeaveDays +
                                          summary.sickLeaveDays,
                                      )
                                    : '—'}
                                </TableCell>
                                <TableCell
                                  className={`dm-numeric ${
                                    summary && summary.absenceDays > 0
                                      ? 'text-[rgb(var(--dm-danger))] font-bold'
                                      : ''
                                  }`}
                                >
                                  {summary ? toPersianDigits(summary.absenceDays) : '—'}
                                </TableCell>
                                <TableCell className="dm-numeric">
                                  {summary ? toPersianDigits(summary.lateMinutes) : '—'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setPreviewEmployeeId(employee.id)}
                                  >
                                    مشاهده
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/attendance">رفتن به حضور و غیاب</Link>
                    </Button>
                    {company?.payroll.latePenaltyEnabled ? (
                      <Badge tone="warning">
                        <TriangleAlert className="size-3.5" aria-hidden />
                        کسر تأخیر فعال است:{' '}
                        {toPersianDigits(company.payroll.latePenaltyPerMinute ?? 0)} ریال به ازای هر
                        دقیقه
                      </Badge>
                    ) : (
                      <Badge tone="neutral">کسر تأخیر و تعجیل در تنظیمات شرکت غیرفعال است</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 2 ? (
              <ExtrasEditor
                kind="earnings"
                title="مزایا و دریافتی‌های دوره"
                description="مبالغی که از قواعد کارکرد به‌دست نمی‌آیند؛ مانند پاداش، ایاب‌وذهاب یا حق غذا."
                options={EARNING_OPTIONS}
                employees={selected}
                extras={state.earnings}
                onChange={(employeeId, list) => updateExtras('earnings', employeeId, list)}
                onApplyAll={(item) => applyToAll('earnings', item)}
              />
            ) : null}

            {step === 3 ? (
              <ExtrasEditor
                kind="deductions"
                title="کسورات دوره"
                description="اقساط وام به‌صورت خودکار افزوده می‌شود؛ سایر کسورات را اینجا ثبت کنید."
                options={DEDUCTION_OPTIONS}
                employees={selected}
                extras={state.deductions}
                onChange={(employeeId, list) => updateExtras('deductions', employeeId, list)}
                onApplyAll={(item) => applyToAll('deductions', item)}
              />
            ) : null}

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              >
                <ChevronRight className="size-4" />
                گام پیشین
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
                >
                  گام بعدی
                  <ChevronLeft className="size-4" />
                </Button>
              ) : (
                <Button onClick={execute} disabled={running || currentRun?.status === 'locked'}>
                  <Calculator className="size-4" />
                  {running ? 'در حال محاسبه…' : 'اجرای محاسبه حقوق'}
                </Button>
              )}
            </div>

            {runs && periodRuns.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>تاریخچه نسخه‌های دوره {monthLabel}</CardTitle>
                  <CardDescription>
                    هر اجرا یک نسخه تازه می‌سازد؛ نسخه‌های پیشین برای بازبینی باقی می‌مانند.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نسخه</TableHead>
                        <TableHead>وضعیت</TableHead>
                        <TableHead>تعداد فیش</TableHead>
                        <TableHead>خالص پرداختی</TableHead>
                        <TableHead>تاریخ محاسبه</TableHead>
                        <TableHead>عملیات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodRuns.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="dm-numeric">
                            {toPersianDigits(run.version)}
                          </TableCell>
                          <TableCell>
                            <Badge tone={run.status === 'locked' ? 'info' : 'primary'}>
                              {run.status === 'locked' ? 'قفل‌شده' : 'محاسبه‌شده'}
                            </Badge>
                          </TableCell>
                          <TableCell className="dm-numeric">
                            {toPersianDigits(run.totals.employeeCount)}
                          </TableCell>
                          <TableCell>
                            <Money value={run.totals.netPay} />
                          </TableCell>
                          <TableCell className="dm-numeric text-xs">
                            {toPersianDigits(run.meta.calculatedAt.slice(0, 10))}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/reports?run=${run.id}`}>
                                  <FileText className="size-3.5" />
                                  فیش‌ها
                                </Link>
                              </Button>
                              {run.status === 'locked' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    await unlockPayrollRun(run.id, displayName);
                                    toast({
                                      tone: 'info',
                                      title: `قفل نسخه ${toPersianDigits(run.version)} باز شد`,
                                    });
                                  }}
                                >
                                  <LockOpen className="size-3.5" />
                                  باز کردن قفل
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPendingLock(run)}
                                >
                                  <Lock className="size-3.5" />
                                  قفل دوره
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4" aria-label="خلاصه محاسبه">
            <Card className="xl:sticky xl:top-20">
              <CardHeader>
                <CardTitle>خلاصه دوره {monthLabel}</CardTitle>
                <CardDescription>
                  {currentRun
                    ? `آخرین نسخه محاسبه‌شده: نسخه ${toPersianDigits(currentRun.version)}`
                    : 'هنوز نسخه‌ای برای این دوره ساخته نشده است.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <SummaryRow label="کارکنان انتخاب‌شده" value={toPersianDigits(selected.length)} />
                  <SummaryRow
                    label="جمع ناخالص دوره"
                    value={currentRun ? formatPersianNumber(currentRun.totals.grossEarnings) : '—'}
                  />
                  <SummaryRow
                    label="بیمه سهم کارمند"
                    value={
                      currentRun ? formatPersianNumber(currentRun.totals.employeeInsurance) : '—'
                    }
                  />
                  <SummaryRow
                    label="مالیات"
                    value={currentRun ? formatPersianNumber(currentRun.totals.tax) : '—'}
                  />
                  <SummaryRow
                    label="خالص پرداختی"
                    value={currentRun ? formatPersianNumber(currentRun.totals.netPay) : '—'}
                    strong
                  />
                  <SummaryRow
                    label="هزینه کارفرما"
                    value={currentRun ? formatPersianNumber(currentRun.totals.employerCost) : '—'}
                  />
                </div>

                {progress ? (
                  <div className="space-y-1">
                    <Progress
                      value={progress.done}
                      max={Math.max(progress.total, 1)}
                      label="پیشرفت محاسبه"
                    />
                    <p className="dm-numeric text-xs text-[rgb(var(--dm-text-muted))]">
                      {toPersianDigits(progress.done)} از {toPersianDigits(progress.total)} کارمند
                    </p>
                  </div>
                ) : null}

                <Separator />

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={execute}
                    disabled={running || currentRun?.status === 'locked'}
                  >
                    <Wallet className="size-4" />
                    {running ? 'در حال محاسبه…' : 'اجرای محاسبه حقوق'}
                  </Button>
                  {currentRun ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/reports?run=${currentRun.id}`}>
                        <FileText className="size-4" />
                        مشاهده و چاپ فیش‌ها
                      </Link>
                    </Button>
                  ) : null}
                  {lastRunId ? (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={async () => {
                        const run = await getPayrollRun(lastRunId);
                        const slips = run ? await payslipsOfRun(run.id) : [];
                        toast({
                          tone: 'info',
                          title: 'نسخه ثبت شد',
                          description: `${toPersianDigits(slips.length)} فیش برای این نسخه ذخیره شده است.`,
                        });
                      }}
                    >
                      بررسی نسخه ثبت‌شده
                    </Button>
                  ) : null}
                </div>

                {includeLoans && activeLoansForPeriod.length > 0 ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={async () => {
                      try {
                        for (const item of activeLoansForPeriod) {
                          await registerInstallment(item.loan.id, item.amount, displayName);
                        }
                        toast({
                          tone: 'success',
                          title: 'اقساط این دوره ثبت شد',
                          description: `${toPersianDigits(activeLoansForPeriod.length)} قسط پرداخت‌شده علامت خورد.`,
                        });
                      } catch (error) {
                        toast({
                          tone: 'error',
                          title: 'ثبت اقساط ناموفق بود',
                          description: error instanceof Error ? error.message : 'خطای نامشخص',
                        });
                      }
                    }}
                  >
                    ثبت پرداخت اقساط این دوره
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            {previewEmployee ? (
              <PayrollPreview
                employeeId={previewEmployee.id}
                jy={jy}
                jm={jm}
                earnings={(state.earnings[previewEmployee.id] ?? []).map(toExtraEarning)}
                deductions={(state.deductions[previewEmployee.id] ?? []).map(toExtraDeduction)}
                includeLoans={includeLoans}
                options={options}
                company={company ?? null}
              />
            ) : null}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingLock)}
        onOpenChange={(open) => {
          if (!open) setPendingLock(null);
        }}
        title={`قفل دوره ${monthLabel}`}
        description="با قفل دوره، ویرایش کارکرد و اجرای محاسبه برای این ماه متوقف می‌شود. امکان باز کردن قفل برای مدیر سامانه وجود دارد."
        confirmLabel="قفل کن"
        tone="primary"
        onConfirm={async () => {
          if (!pendingLock) return;
          try {
            await lockPayrollRun(pendingLock.id, displayName);
            toast({
              tone: 'success',
              title: 'دوره قفل شد',
              description: 'ویرایش‌های بعدی تا باز کردن قفل ممکن نیست.',
            });
          } catch (error) {
            toast({
              tone: 'error',
              title: 'قفل دوره ناموفق بود',
              description: error instanceof Error ? error.message : 'خطای نامشخص',
            });
          } finally {
            setPendingLock(null);
          }
        }}
      />
    </div>
  );
}

function LegalTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3">
      <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p className="dm-numeric mt-1 text-sm font-bold">
        {formatPersianNumber(value)}{' '}
        <span className="text-xs font-normal opacity-70">ریال{hint ? ` ${hint}` : ''}</span>
      </p>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-[rgb(var(--dm-text-muted))]">{label}</span>
      <span
        className={`dm-numeric ${strong ? 'font-black text-[rgb(var(--dm-success))]' : 'font-semibold'}`}
      >
        {value}
        {value !== '—' ? <span className="mr-1 text-xs font-normal opacity-70">ریال</span> : null}
      </span>
    </div>
  );
}

function ExtrasEditor({
  kind,
  title,
  description,
  options,
  employees,
  extras,
  onChange,
  onApplyAll,
}: {
  kind: 'earnings' | 'deductions';
  title: string;
  description: string;
  options: Array<{ value: string; label: string }>;
  employees: Array<{ id: string; firstName: string; lastName: string; personnelCode: string }>;
  extras: Record<string, ExtraItem[]>;
  onChange: (employeeId: string, list: ExtraItem[]) => void;
  onApplyAll: (item: ExtraItem) => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [key, setKey] = useState(options[0]?.value ?? '');
  const [amount, setAmount] = useState(0);

  const current = extras[employeeId] ?? [];
  const draft = (value: string): ExtraItem => ({ key: value, amount });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1.4fr_1fr_auto]">
          <FormField label="کارمند" htmlFor={`${kind}-employee`}>
            <Select
              id={`${kind}-employee`}
              value={employeeId}
              placeholder="انتخاب کارمند"
              options={employees.map((employee) => ({
                value: employee.id,
                label: `${employee.firstName} ${employee.lastName} (${employee.personnelCode})`,
              }))}
              onChange={(event) => setEmployeeId(event.target.value)}
            />
          </FormField>
          <FormField label="عنوان" htmlFor={`${kind}-key`}>
            <Select
              id={`${kind}-key`}
              value={key}
              options={options}
              onChange={(event) => setKey(event.target.value)}
            />
          </FormField>
          <FormField label="مبلغ ماهانه" htmlFor={`${kind}-amount`}>
            <MoneyInput id={`${kind}-amount`} value={amount} onChange={setAmount} />
          </FormField>
          <div className="flex items-end gap-2 pb-0.5">
            <Button
              onClick={() => {
                if (!employeeId) return;
                onChange(employeeId, [...current, draft(key)]);
                setAmount(0);
              }}
              disabled={amount <= 0 || !employeeId}
            >
              افزودن
            </Button>
            <Button
              variant="outline"
              disabled={amount <= 0 || employees.length === 0}
              onClick={() => {
                onApplyAll(draft(key));
                setAmount(0);
              }}
            >
              برای همه
            </Button>
          </div>
        </div>

        {current.length === 0 ? (
          <p className="text-sm text-[rgb(var(--dm-text-subtle))]">
            برای این کارمند موردی ثبت نشده است. مبالغ را با «افزودن» یا «برای همه» اضافه کنید.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead className="w-16">حذف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.map((item, index) => (
                <TableRow key={`${item.key}-${index}`}>
                  <TableCell>
                    {options.find((option) => option.value === item.key)?.label ?? item.key}
                    {item.note ? (
                      <span className="block text-xs opacity-70">{item.note}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Money value={item.amount} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="حذف مورد"
                      onClick={() =>
                        onChange(
                          employeeId,
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="size-4 text-[rgb(var(--dm-danger))]" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Separator />
        <div className="grid gap-2 text-xs text-[rgb(var(--dm-text-muted))] sm:grid-cols-2">
          <p>
            جمع موارد ثبت‌شده برای این کارمند:{' '}
            <span className="dm-numeric font-bold">
              {formatPersianNumber(current.reduce((total, item) => total + item.amount, 0))} ریال
            </span>
          </p>
          <p>
            تعداد کارکنان دارای مورد:{' '}
            <span className="dm-numeric font-bold">
              {toPersianDigits(Object.values(extras).filter((list) => list.length > 0).length)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
