'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  IllustrationNoResults,
  Money,
  MoneyShort,
  Progress,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  JalaliDateText,
  PageHeader,
  EmptyState,
} from '@dastmozd/ui';
import { toPersianDigits } from '@dastmozd/core';
import { syncCalendarEvents } from '@dastmozd/db';
import {
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { DepartmentChart, PayrollTrendChart, type TrendPoint } from '@/components/charts';
import { ListRow } from '@/components/list-row';
import { useAppStore } from '@/lib/store';
import { JALALI_MONTH_LABELS, useDashboardStats, usePeriodNavigator } from '@/lib/hooks';

const EVENT_TONES: Record<string, 'primary' | 'accent' | 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  'contract-end': 'warning',
  'loan-due': 'accent',
  'insurance-due': 'info',
  'tax-due': 'danger',
  task: 'neutral',
  birthday: 'success',
};

const EVENT_LABELS: Record<string, string> = {
  'contract-end': 'پایان قرارداد',
  'loan-due': 'سررسید وام',
  'insurance-due': 'مهلت بیمه',
  'tax-due': 'مهلت مالیات',
  task: 'کار',
  birthday: 'تولد',
};

export default function DashboardPage() {
  const companyId = useAppStore((state) => state.companyId);
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const { data, loading } = useDashboardStats();
  const { monthLabel } = usePeriodNavigator();

  useEffect(() => {
    if (!companyId) return;
    void syncCalendarEvents(companyId, { jy: fiscalYear, jm: currentMonth }).catch(() => undefined);
  }, [companyId, fiscalYear, currentMonth]);

  const trend = useMemo<TrendPoint[]>(
    () =>
      (data?.trend ?? []).map((point) => ({
        month: JALALI_MONTH_LABELS[point.month - 1] ?? String(point.month),
        gross: point.gross,
        net: point.net,
        employerCost: point.employerCost,
      })),
    [data?.trend],
  );

  const previous = useMemo(() => {
    const run = data?.runs.find((item) => item.period.jm === currentMonth - 1 && item.period.jy === fiscalYear);
    return run?.totals.netPay ?? 0;
  }, [data?.runs, currentMonth, fiscalYear]);

  const netDelta = useMemo(() => {
    const net = data?.currentRun?.totals.netPay ?? 0;
    if (!previous || !net) return undefined;
    return Math.round(((net - previous) / previous) * 1000) / 10;
  }, [data?.currentRun, previous]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const { stats, departments, runs, events, loans, currentRun } = data;
  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const remainingLoan = activeLoans.reduce((total, loan) => total + loan.remainingBalance, 0);
  const payable = currentRun?.totals.netPay ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`داشبورد ${monthLabel}`}
        description={`تصویر کلی حقوق و دستمزد سال ${toPersianDigits(fiscalYear)} — همه ارقام به ریال.`}
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/employees?new=1">
                <Plus className="size-4" />
                کارمند جدید
              </Link>
            </Button>
            <Button asChild>
              <Link href="/payroll">
                <Wallet className="size-4" />
                محاسبه حقوق
              </Link>
            </Button>
            <Button asChild variant="secondary" className="hidden sm:inline-flex">
              <Link href="/reports">
                <BarChart3 className="size-4" />
                گزارش ماهانه
              </Link>
            </Button>
          </>
        }
      />

      {currentRun ? (
        <Alert
          tone={currentRun.status === 'locked' ? 'info' : 'warning'}
          title={
            currentRun.status === 'locked'
              ? `دوره ${monthLabel} قفل شده است (نسخه ${toPersianDigits(currentRun.version)})`
              : `دوره ${monthLabel} محاسبه شده اما نهایی نشده است (نسخه ${toPersianDigits(currentRun.version)})`
          }
        >
          {currentRun.status === 'locked'
            ? 'برای اعمال تغییر، ابتدا دوره را از صفحه محاسبه حقوق باز کنید؛ همه تغییرات در گزارش رهگیری ثبت می‌شود.'
            : 'پس از بازبینی فیش‌ها و تأیید مدیر مالی، دوره را نهایی و قفل کنید تا از تغییرات ناخواسته محفوظ بماند.'}
        </Alert>
      ) : null}

      <section aria-label="شاخص‌های کلیدی" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="کارکنان فعال"
          value={toPersianDigits(stats.active)}
          hint={`${toPersianDigits(stats.inactive)} غیرفعال · ${toPersianDigits(stats.terminated)} تسویه‌شده`}
          icon={<Users className="size-4" />}
          tone="primary"
        />
        <StatCard
          label={`خالص پرداختی ${monthLabel}`}
          value={<MoneyShort value={payable} />}
          {...(netDelta !== undefined ? { delta: netDelta } : {})}
          hint={currentRun ? `${toPersianDigits(currentRun.totals.employeeCount)} فیش حقوقی` : 'دوره‌ای محاسبه نشده است'}
          icon={<CircleDollarSign className="size-4" />}
          tone="success"
        />
        <StatCard
          label="هزینه تمام‌شده کارفرما"
          value={<MoneyShort value={currentRun?.totals.employerCost ?? 0} />}
          hint={
            currentRun
              ? `شامل بیمه کارفرما ${toPersianDigits(
                  Math.round((currentRun.totals.employerInsurance / Math.max(currentRun.totals.employerCost, 1)) * 100),
                )}٪`
              : 'بر پایه دوره‌های محاسبه‌شده'
          }
          icon={<TrendingUp className="size-4" />}
          tone="accent"
        />
        <StatCard
          label="مانده اقساط وام"
          value={<MoneyShort value={remainingLoan} />}
          hint={`${toPersianDigits(activeLoans.length)} قرارداد فعال`}
          icon={<Receipt className="size-4" />}
          tone="info"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>روند دوازده‌ماهه حقوق</CardTitle>
            <CardDescription>
              خالص پرداختی و هزینه کارفرما به تفکیک ماه؛ ماه‌های بدون دوره محاسبه‌شده صفر نمایش داده می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PayrollTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تقویم رویدادها</CardTitle>
            <CardDescription>مهلت‌های قانونی، سررسید وام و پایان قراردادهای نزدیک.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <EmptyState
                title="رویداد پیش‌رویی ثبت نشده است"
                description="با ثبت قرارداد و وام، سررسیدها به‌صورت خودکار در تقویم نمایش داده می‌شوند."
                illustration={<IllustrationNoResults className="h-24 w-28" />}
              />
            ) : (
              events.map((event) => (
                <ListRow
                  key={event.id}
                  title={event.title}
                  icon={<CalendarClock className="size-4" aria-hidden />}
                  meta={
                    <span className="flex items-center gap-2">
                      <JalaliDateText jy={event.jalali.jy} jm={event.jalali.jm} jd={event.jalali.jd} />
                      <Badge tone={EVENT_TONES[event.kind] ?? 'neutral'}>
                        {EVENT_LABELS[event.kind] ?? event.kind}
                      </Badge>
                    </span>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>دوره‌های حقوقی</CardTitle>
              <CardDescription>پنج دوره آخر به همراه وضعیت قفل و نسخه محاسبه.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/payroll">مدیریت دوره‌ها</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <EmptyState
                title="هنوز دوره حقوقی محاسبه نشده است"
                description="پس از ثبت کارکرد ماه، از صفحه محاسبه حقوق، دوره را اجرا کنید."
                action={
                  <Button asChild>
                    <Link href="/payroll">شروع محاسبه</Link>
                  </Button>
                }
                illustration={<IllustrationNoResults />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>دوره</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>نسخه</TableHead>
                    <TableHead>تعداد فیش</TableHead>
                    <TableHead>خالص پرداختی</TableHead>
                    <TableHead>هزینه کارفرما</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.slice(0, 5).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-semibold">
                        {JALALI_MONTH_LABELS[run.period.jm - 1]} {toPersianDigits(run.period.jy)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={run.status === 'locked' ? 'info' : 'primary'}>
                          {run.status === 'locked' ? 'قفل‌شده' : 'محاسبه‌شده'}
                        </Badge>
                      </TableCell>
                      <TableCell className="dm-numeric">{toPersianDigits(run.version)}</TableCell>
                      <TableCell className="dm-numeric">{toPersianDigits(run.totals.employeeCount)}</TableCell>
                      <TableCell>
                        <Money value={run.totals.netPay} />
                      </TableCell>
                      <TableCell>
                        <Money value={run.totals.employerCost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>توزیع دپارتمانی</CardTitle>
            <CardDescription>تعداد کارکنان فعال در هر دپارتمان.</CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentChart data={departments} />
            <div className="mt-4 space-y-2">
              {departments.map((department) => {
                const share = stats.active > 0 ? Math.round((department.count / stats.active) * 100) : 0;
                return (
                  <div key={department.departmentId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{department.title}</span>
                      <span className="dm-numeric text-[rgb(var(--dm-text-muted))]">
                        {toPersianDigits(department.count)} نفر ({toPersianDigits(share)}٪)
                      </span>
                    </div>
                    <Progress value={share} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>خلاصه کارکرد و مزایای دوره</CardTitle>
          <CardDescription>مبالغ تجمعی دوره {monthLabel} برای بازبینی سریع مدیر مالی.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="جمع کل پرداختی (ناخالص)" value={currentRun?.totals.grossEarnings ?? 0} />
          <SummaryItem label="بیمه سهم کارکنان" value={currentRun?.totals.employeeInsurance ?? 0} />
          <SummaryItem label="مالیات بر درآمد حقوق" value={currentRun?.totals.tax ?? 0} />
          <SummaryItem label="بیمه سهم کارفرما" value={currentRun?.totals.employerInsurance ?? 0} />
          <SummaryItem label="میانگین حقوق پایه" value={stats.averageBaseSalary} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3.5">
      <p className="mb-1 text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <Money value={value} />
    </div>
  );
}
