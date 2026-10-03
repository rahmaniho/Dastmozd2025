'use client';

import {
  calculatePayroll,
  formatPersianNumber,
  toPersianDigits,
  type ExtraDeduction,
  type ExtraEarning,
  type PayrollResult,
  type PayrollRunOptions,
} from '@dastmozd/core';
import { installmentForPeriod, summarizeEmployeeMonth, toPayrollEmployee } from '@dastmozd/db';
import type { CompanyProfile } from '@dastmozd/types';
import { db } from '@dastmozd/db';
import { resolveLegalProfile } from '@dastmozd/legal';
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Money,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dastmozd/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { JALALI_MONTH_LABELS } from '@/lib/hooks';

export interface PayrollPreviewProps {
  employeeId: string;
  jy: number;
  jm: number;
  earnings?: ExtraEarning[];
  deductions?: ExtraDeduction[];
  includeLoans?: boolean;
  options?: PayrollRunOptions;
  company?: CompanyProfile | null;
}

/**
 * پیش‌نمایش زنده فیش حقوقی یک کارمند پیش از اجرای گروهی.
 * محاسبه با همان موتور `@dastmozd/core` انجام می‌شود تا عدد پیش‌نمایش با نتیجه
 * نهایی یکسان باشد.
 */
export function PayrollPreview({
  employeeId,
  jy,
  jm,
  earnings = [],
  deductions = [],
  includeLoans = false,
  options = {},
  company = null,
}: PayrollPreviewProps) {
  const data = useLiveQuery(
    async () => {
      const employee = await db.employees.get(employeeId);
      if (!employee) return null;
      const summary = await summarizeEmployeeMonth(employeeId, jy, jm);
      const loans = includeLoans
        ? await db.loans.where('employeeId').equals(employeeId).toArray()
        : [];
      return { employee, summary, loans };
    },
    [employeeId, jy, jm, includeLoans],
    undefined,
  );

  const result = useMemo<PayrollResult | null>(() => {
    if (!data) return null;
    const { profile } = resolveLegalProfile(jy);
    const autoDeductions: ExtraDeduction[] = [...deductions];
    for (const loan of data.loans) {
      const amount = installmentForPeriod(loan, { jy, jm });
      if (amount > 0) {
        autoDeductions.push({ key: 'loan', title: `قسط وام ${loan.title}`, amount });
      }
    }
    return calculatePayroll({
      employee: toPayrollEmployee(data.employee, { jy, jm }),
      period: { jy, jm, days: data.summary.periodDays },
      attendance: data.summary,
      profile,
      ...(earnings.length > 0 ? { earnings } : {}),
      ...(autoDeductions.length > 0 ? { deductions: autoDeductions } : {}),
      options: {
        ...options,
        applyFlatTaxSegments: profile.tax.flatSegments.length > 0,
      },
      ...(company
        ? {
            company: {
              insuranceBeforeTax: company.payroll.insuranceBeforeTax,
              prorateBenefits: company.payroll.prorateBenefits,
              latePenaltyEnabled: company.payroll.latePenaltyEnabled,
              roundPayout: company.payroll.roundPayout,
              roundingStep: company.workSchedule.roundingStep,
              ...(company.payroll.latePenaltyPerMinute !== undefined
                ? { latePenaltyPerMinute: company.payroll.latePenaltyPerMinute }
                : {}),
            },
          }
        : {}),
    });
  }, [data, jy, jm, earnings, deductions, options, company]);

  if (!data || !result) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          پیش‌نمایش فیش {data.employee.firstName} {data.employee.lastName}
        </CardTitle>
        <CardDescription>
          {JALALI_MONTH_LABELS[jm - 1]} {toPersianDigits(jy)} · کد پرسنلی{' '}
          {toPersianDigits(data.employee.personnelCode)} · همه ارقام به ریال
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.warnings.length > 0 ? (
          <div className="space-y-2">
            {result.warnings.map((warning) => (
              <Alert
                key={warning.code}
                tone={
                  warning.severity === 'error'
                    ? 'danger'
                    : warning.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
                title={
                  warning.severity === 'error'
                    ? 'خطای محاسبه'
                    : warning.severity === 'warning'
                      ? 'هشدار محاسبه'
                      : 'نکته محاسبه'
                }
              >
                {warning.message}
                {warning.hint ? (
                  <span className="mt-1 block opacity-80">{warning.hint}</span>
                ) : null}
              </Alert>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PreviewTile label="مزد روزانه" value={result.rates.dailyWage} />
          <PreviewTile label="مزد ساعتی" value={result.rates.hourlyWage} />
          <PreviewTile label="اضافه‌کار ساعتی" value={result.rates.overtimeHourly} />
          <PreviewTile label="شب‌کاری ساعتی" value={result.rates.nightHourly} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold text-[rgb(var(--dm-text-muted))]">
              مزایا و دریافتی‌ها
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان</TableHead>
                  <TableHead>مقدار</TableHead>
                  <TableHead>مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.earnings.map((line, index) => (
                  <TableRow key={`${line.key}-${index}`}>
                    <TableCell className="text-xs">{line.title}</TableCell>
                    <TableCell className="dm-numeric text-xs">
                      {line.quantity !== undefined
                        ? toPersianDigits(Math.round(line.quantity * 100) / 100)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Money value={line.amount} size="sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-[rgb(var(--dm-text-muted))]">کسورات</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان</TableHead>
                  <TableHead>مبنای محاسبه</TableHead>
                  <TableHead>مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.deductions.map((line, index) => (
                  <TableRow key={`${line.key}-${index}`}>
                    <TableCell className="text-xs">{line.title}</TableCell>
                    <TableCell className="dm-numeric text-xs">
                      {line.quantity !== undefined ? formatPersianNumber(line.quantity) : '—'}
                    </TableCell>
                    <TableCell>
                      <Money value={line.amount} size="sm" tone="negative" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PreviewTile label="جمع کل پرداختی" value={result.totals.grossEarnings} />
          <PreviewTile label="بیمه سهم کارمند (۷٪)" value={result.insurance.employeeShare} />
          <PreviewTile label="مالیات بر درآمد" value={result.tax.total} />
          <PreviewTile label="خالص پرداختی" value={result.totals.netPay} tone="positive" />
          <PreviewTile
            label="مبلغ قابل پرداخت (رند شده)"
            value={result.totals.payableAmount}
            tone="positive"
          />
          <PreviewTile
            label="هزینه تمام‌شده کارفرما"
            value={result.employerCost.total}
            tone="accent"
          />
        </div>

        <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs">
          <p className="mb-1 flex items-center gap-2 font-bold">
            <Badge tone="info">پایه محاسبه مالیات</Badge>
            <span className="dm-numeric">
              مشمول: {formatPersianNumber(result.tax.taxableIncome)} ریال · معافیت:{' '}
              {formatPersianNumber(result.tax.exemption)} ریال · نرخ مؤثر:{' '}
              {toPersianDigits(Math.round(result.tax.effectiveRate * 1000) / 10)}٪
            </span>
          </p>
          <p className="dm-numeric text-[rgb(var(--dm-text-muted))]">
            پایه بیمه: {formatPersianNumber(result.insurance.rawBase)} ریال · سقف بیمه:{' '}
            {formatPersianNumber(result.insurance.ceiling)} ریال · جمع سهم کارفرما:{' '}
            {formatPersianNumber(result.employerCost.employerInsurance)} ریال
          </p>
        </div>

        <details className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3">
          <summary className="cursor-pointer text-xs font-bold text-[rgb(var(--dm-text-muted))]">
            گزارش گام‌به‌گام محاسبه ({toPersianDigits(result.trace.length)} گام)
          </summary>
          <ol className="mt-3 space-y-1.5">
            {result.trace.map((step, index) => (
              <li key={`${step.code}-${index}`} className="text-xs">
                <span className="dm-numeric ml-1 text-[rgb(var(--dm-text-subtle))]">
                  {toPersianDigits(step.step)}.
                </span>
                <span className="font-semibold">{step.title}: </span>
                <span>{step.detail}</span>
                {step.formula ? (
                  <span className="dm-numeric mr-1 text-[rgb(var(--dm-text-muted))]">
                    ({step.formula})
                  </span>
                ) : null}
                {step.value ? (
                  <span className="dm-numeric mr-1 text-[rgb(var(--dm-text-subtle))]">
                    → {formatPersianNumber(step.value)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

function PreviewTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'positive' | 'accent';
}) {
  const color =
    tone === 'positive'
      ? 'text-[rgb(var(--dm-success))]'
      : tone === 'accent'
        ? 'text-[rgb(var(--dm-accent))]'
        : 'text-[rgb(var(--dm-text))]';
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-3">
      <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p className={`dm-numeric mt-1 font-bold ${color}`}>
        {formatPersianNumber(value)}
        <span className="mr-1 text-xs font-normal opacity-70">ریال</span>
      </p>
    </div>
  );
}
