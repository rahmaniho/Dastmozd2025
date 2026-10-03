'use client';

import {
  calculateEidi,
  formatNumber,
  formatPersianNumber,
  minutesBetween,
  toPersianDigits,
} from '@dastmozd/core';
import {
  ATTENDANCE_KIND_LABELS,
  db,
  exportAuditJson,
  latestAuditEntries,
  monthlyPayrollTrend,
  verifyAuditChain,
} from '@dastmozd/db';
import type { Employee, Payslip } from '@dastmozd/types';
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
  EmptyState,
  IllustrationReports,
  Money,
  MoneyShort,
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
  Tabs,
  useToast,
} from '@dastmozd/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  HardDriveDownload,
  Printer,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PayrollTrendChart, type TrendPoint } from '@/components/charts';
import {
  printPayslips,
  buildInsuranceDiskette,
  downloadInsuranceDiskette,
  downloadMonthlySummaryExcel,
  downloadPayslipsPdf,
  downloadTaxExcel,
} from '@/lib/documents';
import { downloadJson, exportToCsv, exportToExcel, type ExportColumn } from '@/lib/excel';
import {
  JALALI_MONTH_LABELS,
  useActiveEmployees,
  useAttendanceGrid,
  usePeriodNavigator,
  usePayrollRuns,
  usePayslips,
} from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

interface BuilderColumn<T> {
  id: string;
  header: string;
  value: (row: T) => string | number;
  width?: number;
}

type BuilderRow = Record<string, string | number>;

function ReportsPageInner() {
  const companyId = useAppStore((state) => state.companyId);
  const { jy, jm, monthLabel } = usePeriodNavigator();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { profile } = resolveLegalProfile(jy);

  const { runs, loading: runsLoading } = usePayrollRuns();
  const employees = useActiveEmployees();
  const { records } = useAttendanceGrid();

  const [tab, setTab] = useState('payslips');
  const requestedRun = searchParams.get('run');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(requestedRun);
  const [selectedSlipId, setSelectedSlipId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const company = useLiveQuery(
    async () => (companyId ? ((await db.companies.get(companyId)) ?? null) : null),
    [companyId],
    undefined,
  );

  const activeRunId = selectedRunId ?? runs[0]?.id ?? null;
  const { slips, enriched, loading: slipsLoading } = usePayslips(activeRunId);
  const activeRun = runs.find((run) => run.id === activeRunId) ?? null;

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const employee of employees) map.set(employee.id, employee);
    return map;
  }, [employees]);

  const selectedSlip = useMemo(
    () => slips.find((slip) => slip.id === selectedSlipId) ?? slips[0] ?? null,
    [slips, selectedSlipId],
  );

  const documentInputs = useMemo(
    () =>
      slips
        .filter((slip) => (checked.size === 0 ? false : checked.has(slip.id)))
        .map((slip) => {
          const employee = employeeById.get(slip.employeeId);
          if (!employee || !company) return null;
          return { payslip: slip, employee, company, profile };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [slips, checked, employeeById, company, profile],
  );

  const allDocuments = useMemo(
    () =>
      slips
        .map((slip) => {
          const employee = employeeById.get(slip.employeeId);
          if (!employee || !company) return null;
          return { payslip: slip, employee, company, profile };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [slips, employeeById, company, profile],
  );

  const totals = useMemo(
    () =>
      slips.reduce(
        (acc, slip) => ({
          gross: acc.gross + slip.totals.grossEarnings,
          tax: acc.tax + slip.tax.total,
          employeeInsurance: acc.employeeInsurance + slip.insurance.employeeShare,
          employerInsurance: acc.employerInsurance + slip.insurance.employerShare,
          net: acc.net + slip.totals.netPay,
          employerCost: acc.employerCost + slip.employerCost.total,
        }),
        { gross: 0, tax: 0, employeeInsurance: 0, employerInsurance: 0, net: 0, employerCost: 0 },
      ),
    [slips],
  );

  const trend = useLiveQuery(
    async () => (companyId ? monthlyPayrollTrend(companyId, jy) : []),
    [companyId, jy],
    undefined,
  );

  const eidiRows = useMemo(() => {
    const monthsElapsed = Math.max(1, Math.min(12, jm));
    return employees.map((employee) => {
      const result = calculateEidi({
        profile,
        monthsWorked: monthsElapsed,
        monthlyWage: employee.salary.baseMonthly,
      });
      return { employee, result };
    });
  }, [employees, profile, jm]);

  const insuranceFile = useMemo(() => {
    if (!company || slips.length === 0) return null;
    try {
      return {
        result: buildInsuranceDiskette({ payslips: slips, employees, company, jy, jm }),
        error: null as string | null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'خطا در ساخت فایل بیمه',
      };
    }
  }, [slips, employees, company, jy, jm]);

  const guard = async (label: string, action: () => Promise<void> | void): Promise<void> => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      toast({
        tone: 'error',
        title: 'عملیات ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(null);
    }
  };

  const builderDatasets = useMemo(() => {
    const employeeColumns: Array<BuilderColumn<BuilderRow>> = [
      { id: 'personnel', header: 'شماره پرسنلی', value: (row) => String(row.personnel ?? '') },
      {
        id: 'name',
        header: 'نام و نام خانوادگی',
        value: (row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
        width: 26,
      },
      { id: 'nationalId', header: 'کد ملی', value: (row) => String(row.nationalId ?? '') },
      { id: 'position', header: 'سمت', value: (row) => String(row.position ?? '') },
      { id: 'hireYear', header: 'سال استخدام', value: (row) => String(row.hireYear ?? '') },
      { id: 'baseSalary', header: 'پایه حقوق (ریال)', value: (row) => Number(row.baseSalary ?? 0) },
      { id: 'insurance', header: 'شماره بیمه', value: (row) => String(row.insurance ?? '') },
      { id: 'status', header: 'وضعیت', value: (row) => String(row.status ?? '') },
    ];
    const employeeRows: BuilderRow[] = employees.map((employee) => ({
      personnel: employee.personnelCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      nationalId: `="${employee.nationalId}"`,
      position: employee.position,
      hireYear: employee.hireDate.jy,
      baseSalary: employee.salary.baseMonthly,
      insurance: employee.insuranceNumber ?? '',
      status: employee.status === 'active' ? 'شاغل' : employee.status,
    }));

    const attendanceColumns: Array<BuilderColumn<BuilderRow>> = [
      { id: 'personnel', header: 'شماره پرسنلی', value: (row) => String(row.personnel ?? '') },
      {
        id: 'name',
        header: 'نام و نام خانوادگی',
        value: (row) => String(row.name ?? ''),
        width: 26,
      },
      { id: 'day', header: 'روز ماه', value: (row) => String(row.day ?? '') },
      { id: 'kind', header: 'نوع کارکرد', value: (row) => String(row.kind ?? '') },
      { id: 'checkIn', header: 'ورود', value: (row) => String(row.checkIn ?? '') },
      { id: 'checkOut', header: 'خروج', value: (row) => String(row.checkOut ?? '') },
      { id: 'hours', header: 'ساعت کارکرد', value: (row) => Number(row.hours ?? 0) },
    ];
    const attendanceRows: BuilderRow[] = records.map((record) => {
      const employee = employeeById.get(record.employeeId);
      return {
        personnel: employee?.personnelCode ?? '',
        name: employee ? `${employee.firstName} ${employee.lastName}` : '',
        day: record.jalali.jd,
        kind: ATTENDANCE_KIND_LABELS[record.kind],
        checkIn: record.checkIn ?? '',
        checkOut: record.checkOut ?? '',
        hours:
          record.checkIn && record.checkOut
            ? Math.round(
                ((minutesBetween(record.checkIn, record.checkOut) - (record.breakMinutes ?? 0)) /
                  60) *
                  100,
              ) / 100
            : 0,
      };
    });

    const payslipColumns: Array<BuilderColumn<BuilderRow>> = [
      { id: 'personnel', header: 'شماره پرسنلی', value: (row) => String(row.personnel ?? '') },
      {
        id: 'name',
        header: 'نام و نام خانوادگی',
        value: (row) => String(row.name ?? ''),
        width: 26,
      },
      { id: 'gross', header: 'جمع مزایا (ریال)', value: (row) => Number(row.gross ?? 0) },
      {
        id: 'insurance',
        header: 'بیمه سهم کارمند (ریال)',
        value: (row) => Number(row.insurance ?? 0),
      },
      { id: 'tax', header: 'مالیات (ریال)', value: (row) => Number(row.tax ?? 0) },
      { id: 'other', header: 'سایر کسورات (ریال)', value: (row) => Number(row.other ?? 0) },
      { id: 'net', header: 'خالص پرداختی (ریال)', value: (row) => Number(row.net ?? 0) },
      {
        id: 'employerCost',
        header: 'هزینه کارفرما (ریال)',
        value: (row) => Number(row.employerCost ?? 0),
      },
      { id: 'code', header: 'کد رهگیری', value: (row) => String(row.code ?? '') },
    ];
    const payslipRows: BuilderRow[] = slips.map((slip) => {
      const employee = employeeById.get(slip.employeeId);
      return {
        personnel: employee?.personnelCode ?? '',
        name: employee ? `${employee.firstName} ${employee.lastName}` : '',
        gross: slip.totals.grossEarnings,
        insurance: slip.insurance.employeeShare,
        tax: slip.tax.total,
        other: slip.totals.otherDeductions,
        net: slip.totals.netPay,
        employerCost: slip.employerCost.total,
        code: slip.verificationCode,
      };
    });

    return {
      employees: { label: 'پرونده کارکنان', columns: employeeColumns, rows: employeeRows },
      attendance: {
        label: `کارکرد ${monthLabel}`,
        columns: attendanceColumns,
        rows: attendanceRows,
      },
      payslips: { label: `فیش‌های دوره ${monthLabel}`, columns: payslipColumns, rows: payslipRows },
    };
  }, [employees, records, slips, employeeById, monthLabel]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="گزارش‌ها و خروجی‌های رسمی"
        description="فیش حقوقی PDF با کد رهگیری، دیسکت بیمه، لیست مالیات، خلاصه ماهانه و سازنده گزارش دلخواه."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <>
            <Select
              aria-label="انتخاب دوره حقوقی"
              className="min-w-56"
              value={activeRunId ?? ''}
              placeholder={runsLoading ? 'در حال بارگذاری دوره‌ها…' : 'دوره‌ای محاسبه نشده است'}
              options={runs.map((run) => ({
                value: run.id,
                label: `${JALALI_MONTH_LABELS[run.period.jm - 1]} ${toPersianDigits(run.period.jy)} — نسخه ${toPersianDigits(
                  run.version,
                )} ${run.status === 'locked' ? '(قفل‌شده)' : ''}`,
              }))}
              onChange={(event) => {
                setSelectedRunId(event.target.value);
                setChecked(new Set());
                setSelectedSlipId(null);
              }}
            />
            <Button
              variant="outline"
              disabled={allDocuments.length === 0 || busy !== null}
              onClick={() =>
                void guard('print-all', async () => {
                  await printPayslips(allDocuments);
                  toast({
                    tone: 'success',
                    title: 'فایل فیش‌ها در پنجره تازه باز شد',
                    description: 'برای چاپ یا ذخیره PDF از آنجا استفاده کنید.',
                  });
                })
              }
            >
              <Printer className="size-4" />
              چاپ همه فیش‌ها
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        ariaLabel="بخش‌های گزارش"
        tabs={[
          { value: 'payslips', label: 'فیش‌های حقوقی', badge: slips.length },
          { value: 'period', label: 'گزارش‌های دوره' },
          { value: 'builder', label: 'سازنده گزارش' },
          { value: 'audit', label: 'رهگیری تغییرات' },
        ]}
      />

      {tab === 'payslips' ? (
        slipsLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : runs.length === 0 ? (
          <EmptyState
            title="هنوز دوره حقوقی محاسبه نشده است"
            description="پس از اجرای محاسبه در صفحه «محاسبه حقوق»، فیش‌ها و خروجی‌های رسمی در این بخش در دسترس قرار می‌گیرند."
            illustration={<IllustrationReports />}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>فهرست فیش‌های دوره</CardTitle>
                <CardDescription>
                  {toPersianDigits(slips.length)} فیش ·{' '}
                  {activeRun ? `نسخه ${toPersianDigits(activeRun.version)}` : 'دوره نامشخص'} — برای
                  انتخاب چند فیش، کادر ابتدای هر سطر را علامت بزنید.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="dm-scroll max-h-[30rem] overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"> </TableHead>
                        <TableHead>کارمند</TableHead>
                        <TableHead>جمع مزایا</TableHead>
                        <TableHead>کسورات</TableHead>
                        <TableHead>خالص پرداختی</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enriched.map(({ slip, employee }) => (
                        <TableRow key={slip.id}>
                          <TableCell>
                            <Checkbox
                              aria-label={`انتخاب فیش ${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`}
                              checked={checked.has(slip.id)}
                              onChange={(event) =>
                                setChecked((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(slip.id);
                                  else next.delete(slip.id);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-right font-semibold hover:text-[rgb(var(--dm-primary))]"
                              onClick={() => setSelectedSlipId(slip.id)}
                            >
                              {employee
                                ? `${employee.firstName} ${employee.lastName}`
                                : slip.employeeId}
                              <span className="dm-numeric block text-xs font-normal opacity-70">
                                {employee ? toPersianDigits(employee.personnelCode) : ''}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Money value={slip.totals.grossEarnings} size="sm" />
                          </TableCell>
                          <TableCell>
                            <Money value={slip.totals.totalDeductions} size="sm" tone="negative" />
                          </TableCell>
                          <TableCell>
                            <Money value={slip.totals.netPay} size="sm" tone="positive" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={documentInputs.length === 0 || busy !== null}
                    onClick={() =>
                      void guard('pdf-selected', async () => {
                        await downloadPayslipsPdf(
                          documentInputs,
                          `dastmozd-payslips-${jy}-${String(jm).padStart(2, '0')}-selected.pdf`,
                        );
                        toast({ tone: 'success', title: 'PDF فیش‌های انتخابی آماده شد' });
                      })
                    }
                  >
                    <FileText className="size-4" />
                    PDF فیش‌های انتخابی ({toPersianDigits(documentInputs.length)})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={allDocuments.length === 0 || busy !== null}
                    onClick={() =>
                      void guard('pdf-all', async () => {
                        await downloadPayslipsPdf(
                          allDocuments,
                          `dastmozd-payslips-${jy}-${String(jm).padStart(2, '0')}.pdf`,
                        );
                        toast({ tone: 'success', title: 'PDF همه فیش‌های دوره آماده شد' });
                      })
                    }
                  >
                    <HardDriveDownload className="size-4" />
                    PDF همه فیش‌ها
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setChecked(new Set(slips.map((slip) => slip.id)))}
                  >
                    انتخاب همه
                  </Button>
                  <Button variant="ghost" onClick={() => setChecked(new Set())}>
                    پاک‌کردن انتخاب
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>جزئیات فیش</CardTitle>
                <CardDescription>
                  {selectedSlip
                    ? `کد رهگیری ${selectedSlip.verificationCode}`
                    : 'برای مشاهده جزئیات، یک فیش را انتخاب کنید.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedSlip ? (
                  <p className="text-sm text-[rgb(var(--dm-text-subtle))]">فیشی انتخاب نشده است.</p>
                ) : (
                  <PayslipDetails slip={selectedSlip} />
                )}
              </CardContent>
            </Card>
          </div>
        )
      ) : null}

      {tab === 'period' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="جمع ناخالص دوره" value={totals.gross} />
            <SummaryCard label="بیمه سهم کارکنان" value={totals.employeeInsurance} />
            <SummaryCard label="مالیات دوره" value={totals.tax} />
            <SummaryCard label="خالص پرداختی" value={totals.net} tone="positive" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>لیست بیمه تأمین اجتماعی</CardTitle>
                <CardDescription>
                  فایل دیسکت ثابت‌عرض با رکورد سرآیند، رکورد هر کارمند بیمه‌شده و رکورد جمع.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {insuranceFile?.error ? (
                  <Alert tone="danger" title="ساخت فایل بیمه ممکن نشد">
                    {insuranceFile.error}
                  </Alert>
                ) : insuranceFile?.result ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <MetricTile
                        label="تعداد بیمه‌شده"
                        value={toPersianDigits(insuranceFile.result.recordCount)}
                      />
                      <MetricTile
                        label="جمع حق بیمه"
                        value={`${formatPersianNumber(insuranceFile.result.totalInsurance)} ریال`}
                      />
                      <MetricTile label="نام فایل" value={insuranceFile.result.fileName} />
                    </div>
                    {insuranceFile.result.warnings.length > 0 ? (
                      <Alert tone="warning" title="هشدارهای فایل بیمه">
                        <ul className="mr-4 list-disc space-y-1">
                          {insuranceFile.result.warnings.slice(0, 6).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </Alert>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          if (!insuranceFile.result) return;
                          downloadInsuranceDiskette(insuranceFile.result);
                          toast({ tone: 'success', title: 'فایل دیسکت بیمه بارگیری شد' });
                        }}
                      >
                        <Download className="size-4" />
                        بارگیری فایل دیسکت
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(insuranceFile.result?.content ?? '')
                            .then(() =>
                              toast({ tone: 'success', title: 'محتوای فایل در حافظه موقت کپی شد' }),
                            )
                            .catch(() => toast({ tone: 'error', title: 'کپی محتوا ممکن نشد' }));
                        }}
                      >
                        کپی محتوا
                      </Button>
                    </div>
                    <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
                      ساختار فایل بر پایه قالب رایج دیسکت بیمه است؛ پیش از ارسال، آن را با نسخه روز
                      سامانه تأمین اجتماعی تطبیق دهید (شرح در docs/LEGAL.md).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[rgb(var(--dm-text-subtle))]">
                    برای ساخت فایل، ابتدا دوره را محاسبه کنید.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>خروجی‌های مالی و مالیاتی</CardTitle>
                <CardDescription>
                  فایل‌های آماده برای سامانه‌های رسمی و بایگانی داخلی.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={slips.length === 0}
                  onClick={() =>
                    guard('tax', () => {
                      downloadTaxExcel({
                        payslips: slips,
                        employees,
                        jy,
                        jm,
                        companyName: company?.name ?? 'شرکت',
                      });
                      toast({ tone: 'success', title: 'فایل مالیات حقوق آماده شد' });
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  لیست مالیات حقوق (اکسل سازمان امور مالیاتی)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={slips.length === 0}
                  onClick={() =>
                    guard('summary', () => {
                      downloadMonthlySummaryExcel({
                        payslips: slips,
                        employees,
                        jy,
                        jm,
                        companyName: company?.name ?? 'شرکت',
                      });
                      toast({ tone: 'success', title: 'خلاصه ماهانه آماده شد' });
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  خلاصه ماهانه و هزینه کارفرما
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={eidiRows.length === 0}
                  onClick={() =>
                    guard('eidi', () => {
                      const columns: Array<ExportColumn<(typeof eidiRows)[number]>> = [
                        { header: 'شماره پرسنلی', value: (row) => row.employee.personnelCode },
                        {
                          header: 'نام و نام خانوادگی',
                          value: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
                          width: 26,
                        },
                        {
                          header: 'پایه حقوق (ریال)',
                          value: (row) => row.employee.salary.baseMonthly,
                          width: 20,
                        },
                        {
                          header: 'عیدی پیشنهادی (ریال)',
                          value: (row) => row.result.recommended,
                          width: 22,
                        },
                        {
                          header: 'حداقل قانونی عیدی (ریال)',
                          value: (row) => row.result.min,
                          width: 22,
                        },
                        {
                          header: 'حداکثر قانونی عیدی (ریال)',
                          value: (row) => row.result.max,
                          width: 22,
                        },
                        {
                          header: 'بخش معاف از مالیات (ریال)',
                          value: (row) => row.result.taxExempt,
                          width: 22,
                        },
                        {
                          header: 'بخش مشمول مالیات (ریال)',
                          value: (row) => row.result.taxable,
                          width: 22,
                        },
                      ];
                      exportToExcel({
                        fileName: `dastmozd-eidi-${jy}.xlsx`,
                        sheetName: 'عیدی و پاداش',
                        columns,
                        rows: eidiRows,
                        title: `برآورد عیدی و پاداش پایان سال ${toPersianDigits(jy)} بر پایه ${toPersianDigits(
                          Math.max(1, Math.min(12, jm)),
                        )} ماه کارکرد`,
                      });
                      toast({ tone: 'success', title: 'فایل برآورد عیدی آماده شد' });
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  برآورد عیدی و پاداش (اکسل)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={records.length === 0}
                  onClick={() =>
                    guard('attendance-csv', () => {
                      exportToCsv({
                        fileName: `dastmozd-attendance-${jy}-${String(jm).padStart(2, '0')}.csv`,
                        columns: [
                          {
                            header: 'شماره پرسنلی',
                            value: (row: (typeof records)[number]) =>
                              employeeById.get(row.employeeId)?.personnelCode ?? '',
                          },
                          {
                            header: 'تاریخ',
                            value: (row: (typeof records)[number]) =>
                              `${row.jalali.jy}/${row.jalali.jm}/${row.jalali.jd}`,
                          },
                          {
                            header: 'نوع',
                            value: (row: (typeof records)[number]) =>
                              ATTENDANCE_KIND_LABELS[row.kind],
                          },
                          {
                            header: 'ورود',
                            value: (row: (typeof records)[number]) => row.checkIn ?? '',
                          },
                          {
                            header: 'خروج',
                            value: (row: (typeof records)[number]) => row.checkOut ?? '',
                          },
                        ],
                        rows: records,
                      });
                      toast({ tone: 'success', title: 'خروجی CSV کارکرد آماده شد' });
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  کارکرد دوره (CSV)
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>روند سالانه {toPersianDigits(jy)}</CardTitle>
              <CardDescription>
                خالص پرداختی و هزینه کارفرما در دوازده ماه سال؛ حقوق پایه برای اعتبارسنجی سریع نمایش
                داده می‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollTrendChart
                data={(trend ?? []).map<TrendPoint>((point) => ({
                  month: JALALI_MONTH_LABELS[point.month - 1] ?? String(point.month),
                  gross: point.gross,
                  net: point.net,
                  employerCost: point.employerCost,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>برآورد عیدی و پاداش پایان سال</CardTitle>
              <CardDescription>
                حداقل قانونی عیدی معادل دو برابر حداقل مزد ماهانه و حداکثر سه برابر آن است (ماده ۷۵
                قانون کار).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="dm-scroll max-h-80 overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>کارمند</TableHead>
                      <TableHead>پایه حقوق</TableHead>
                      <TableHead>حداقل قانونی</TableHead>
                      <TableHead>پیشنهاد (۲ برابر به‌نسبت کارکرد)</TableHead>
                      <TableHead>حداکثر قانونی</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eidiRows.map(({ employee, result }) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-semibold">
                          {employee.firstName} {employee.lastName}
                        </TableCell>
                        <TableCell>
                          <Money value={employee.salary.baseMonthly} size="sm" />
                        </TableCell>
                        <TableCell>
                          <Money value={result.min} size="sm" />
                        </TableCell>
                        <TableCell>
                          <Money value={result.recommended} size="sm" tone="positive" />
                        </TableCell>
                        <TableCell>
                          <Money value={result.max} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'builder' ? (
        <ReportBuilder datasets={builderDatasets} periodLabel={monthLabel} />
      ) : null}

      {tab === 'audit' ? <AuditPanel /> : null}

      <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
        پروفایل حقوقی فعال: {profile.label} — {profile.description}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'positive';
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
        <div
          className={`mt-1 text-lg font-black ${tone === 'positive' ? 'text-[rgb(var(--dm-success))]' : ''}`}
        >
          <MoneyShort value={value} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-3">
      <p className="text-xs text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p className="dm-numeric mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function PayslipDetails({ slip }: { slip: Payslip }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-bold text-[rgb(var(--dm-text-muted))]">مزایا</p>
        <div className="space-y-1">
          {slip.earnings.map((line, index) => (
            <div
              key={`${line.key}-${index}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>{line.title}</span>
              <Money value={line.amount} size="sm" />
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <p className="mb-1 text-xs font-bold text-[rgb(var(--dm-text-muted))]">کسورات</p>
        <div className="space-y-1">
          {slip.deductions.map((line, index) => (
            <div
              key={`${line.key}-${index}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>{line.title}</span>
              <Money value={line.amount} size="sm" tone="negative" />
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">خالص پرداختی</span>
        <Money value={slip.totals.netPay} tone="positive" />
      </div>
      <div className="rounded-[var(--dm-radius-lg)] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs">
        <div className="flex items-center justify-between">
          <span>پایه بیمه</span>
          <span className="dm-numeric">{formatNumber(slip.insurance.base)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>مشمول مالیات</span>
          <span className="dm-numeric">{formatNumber(slip.tax.taxableIncome)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>مالیات</span>
          <span className="dm-numeric">{formatNumber(slip.tax.total)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>هزینه تمام‌شده کارفرما</span>
          <span className="dm-numeric">{formatNumber(slip.employerCost.total)}</span>
        </div>
      </div>
      {slip.warnings.length > 0 ? (
        <Alert tone="warning" title="هشدارهای این فیش">
          <ul className="mr-4 list-disc space-y-1 text-xs">
            {slip.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <details className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3">
        <summary className="cursor-pointer text-xs font-bold text-[rgb(var(--dm-text-muted))]">
          گزارش گام‌به‌گام ({toPersianDigits(slip.trace.length)} گام)
        </summary>
        <ol className="mt-2 space-y-1">
          {slip.trace.map((step) => (
            <li key={`${step.code}-${step.step}`} className="text-[0.7rem] leading-relaxed">
              <span className="font-semibold">{step.title}</span> — {step.detail}
              {step.formula ? (
                <span className="dm-numeric opacity-70"> ({step.formula})</span>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function ReportBuilder({
  datasets,
  periodLabel,
}: {
  datasets: Record<
    string,
    { label: string; columns: Array<BuilderColumn<BuilderRow>>; rows: BuilderRow[] }
  >;
  periodLabel: string;
}) {
  const ids = Object.keys(datasets);
  const [datasetId, setDatasetId] = useState(ids[0] ?? 'employees');
  const dataset = datasets[datasetId] ?? Object.values(datasets)[0];
  const [orderedIds, setOrderedIds] = useState<string[]>(
    dataset?.columns.map((column) => column.id) ?? [],
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const { toast } = useToast();

  if (!dataset) return null;
  const columns = orderedIds
    .map((id) => dataset.columns.find((column) => column.id === id))
    .filter((column): column is BuilderColumn<BuilderRow> => Boolean(column));

  const move = (from: string, to: string): void => {
    setOrderedIds((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(from);
      const toIndex = next.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return current;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>سازنده گزارش</CardTitle>
          <CardDescription>
            مجموعه داده و ستون‌ها را انتخاب کنید؛ برای تغییر ترتیب ستون‌ها، هر ستون را بکشید و در
            جای تازه رها کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="sr-only" htmlFor="builder-dataset">
                مجموعه داده
              </label>
              <Select
                id="builder-dataset"
                value={datasetId}
                options={Object.entries(datasets).map(([id, item]) => ({
                  value: id,
                  label: item.label,
                }))}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setDatasetId(nextId);
                  setOrderedIds(datasets[nextId]?.columns.map((column) => column.id) ?? []);
                }}
              />
            </div>
            <Badge tone="neutral">{toPersianDigits(dataset.rows.length)} سطر</Badge>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-[rgb(var(--dm-text-muted))]">
              ستون‌های گزارش
            </p>
            <ul className="flex flex-wrap gap-2">
              {dataset.columns.map((column) => {
                const active = orderedIds.includes(column.id);
                return (
                  <li key={column.id}>
                    <button
                      type="button"
                      draggable={active}
                      aria-pressed={active}
                      onDragStart={() => setDragId(column.id)}
                      onDragOver={(event) => {
                        if (!dragId || dragId === column.id) return;
                        event.preventDefault();
                        move(dragId, column.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() =>
                        setOrderedIds((current) =>
                          active
                            ? current.filter((id) => id !== column.id)
                            : [...current, column.id],
                        )
                      }
                      className={`flex items-center gap-1.5 rounded-[var(--dm-radius-full,999px)] border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[rgb(var(--dm-primary))] bg-[rgb(var(--dm-primary-subtle))] text-[rgb(var(--dm-primary))]'
                          : 'border-[rgb(var(--dm-border))] text-[rgb(var(--dm-text-muted))]'
                      }`}
                    >
                      {active ? (
                        <GripVertical className="size-3.5" aria-hidden />
                      ) : (
                        <Table2 className="size-3.5" aria-hidden />
                      )}
                      {column.header}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={columns.length === 0 || dataset.rows.length === 0}
              onClick={() =>
                exportToExcel({
                  fileName: `dastmozd-report-${datasetId}-${periodLabel}.xlsx`,
                  sheetName: 'گزارش',
                  columns,
                  rows: dataset.rows,
                  title: `${dataset.label} — ${periodLabel}`,
                })
              }
            >
              <FileSpreadsheet className="size-4" />
              خروجی اکسل
            </Button>
            <Button
              variant="outline"
              disabled={columns.length === 0 || dataset.rows.length === 0}
              onClick={() =>
                exportToCsv({
                  fileName: `dastmozd-report-${datasetId}-${periodLabel}.csv`,
                  columns,
                  rows: dataset.rows,
                })
              }
            >
              <FileSpreadsheet className="size-4" />
              خروجی CSV
            </Button>
            <Button
              variant="outline"
              disabled={columns.length === 0 || dataset.rows.length === 0}
              onClick={() => {
                const printable = window.open('', '_blank', 'noopener');
                if (!printable) {
                  toast({ tone: 'error', title: 'باز کردن پنجره چاپ مسدود شد' });
                  return;
                }
                const header = columns.map((column) => `<th>${column.header}</th>`).join('');
                const body = dataset.rows
                  .slice(0, 500)
                  .map(
                    (row) =>
                      `<tr>${columns.map((column) => `<td>${column.value(row)}</td>`).join('')}</tr>`,
                  )
                  .join('');
                printable.document.write(
                  `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${dataset.label}</title>` +
                    '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:16px}table{width:100%;border-collapse:collapse;font-size:12px}' +
                    'th,td{border:1px solid #ccd;padding:6px;text-align:right}th{background:#e6f4f3}@page{size:A4 landscape;margin:12mm}</style>' +
                    `</head><body><h2>${dataset.label} — ${periodLabel}</h2><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`,
                );
                printable.document.close();
                printable.focus();
                printable.print();
                toast({ tone: 'success', title: 'پنجره چاپ گزارش باز شد' });
              }}
            >
              <Printer className="size-4" />
              چاپ / PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پیش‌نمایش گزارش</CardTitle>
          <CardDescription>
            حداکثر ۵۰ سطر نخست نمایش داده می‌شود؛ خروجی کامل شامل همه{' '}
            {toPersianDigits(dataset.rows.length)} سطر است.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-sm text-[rgb(var(--dm-text-subtle))]">
              برای مشاهده پیش‌نمایش، حداقل یک ستون انتخاب کنید.
            </p>
          ) : (
            <div className="dm-scroll max-h-[28rem] overflow-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.id}>{column.header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.rows.slice(0, 50).map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column.id} className="dm-numeric text-xs">
                          {typeof column.value(row) === 'number'
                            ? formatPersianNumber(Number(column.value(row)))
                            : column.value(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditPanel() {
  const [limit, setLimit] = useState(100);
  const [integrity, setIntegrity] = useState<{
    valid: boolean;
    checked: number;
    brokenAt?: string;
  } | null>(null);
  const { toast } = useToast();

  const entries = useLiveQuery(() => latestAuditEntries(limit), [limit], undefined);
  const counts = useLiveQuery(async () => db.auditLog.count(), [], undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>گزارش رهگیری تغییرات</CardTitle>
            <CardDescription>
              همه تغییرات حساس با زنجیره هش ثبت می‌شود؛ دست‌کاری هر رکورد، زنجیره را می‌شکند. مجموع
              رکوردها: {toPersianDigits(counts ?? 0)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="تعداد رکوردها"
              className="w-32"
              value={String(limit)}
              options={[50, 100, 200, 500].map((size) => ({
                value: String(size),
                label: `${toPersianDigits(size)} رکورد`,
              }))}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
            <Button
              variant="outline"
              onClick={async () => {
                const result = await verifyAuditChain();
                setIntegrity(result);
                toast({
                  tone: result.valid ? 'success' : 'error',
                  title: result.valid ? 'زنجیره رهگیری سالم است' : 'زنجیره رهگیری شکسته است',
                  description: `${toPersianDigits(result.checked)} رکورد بررسی شد.`,
                });
              }}
            >
              <ShieldCheck className="size-4" />
              بررسی صحت زنجیره
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void exportAuditJson().then((json) => {
                  downloadJson(
                    `dastmozd-audit-${new Date().toISOString().slice(0, 10)}.json`,
                    JSON.parse(json),
                  );
                  toast({ tone: 'success', title: 'خروجی JSON گزارش رهگیری آماده شد' });
                });
              }}
            >
              <Download className="size-4" />
              خروجی JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrity ? (
            <Alert
              tone={integrity.valid ? 'success' : 'danger'}
              title={integrity.valid ? 'صحت زنجیره تأیید شد' : 'ناسازگاری در زنجیره'}
            >
              {integrity.valid
                ? `${toPersianDigits(integrity.checked)} رکورد بدون تغییر بررسی شد.`
                : `نخستین رکورد ناسازگار: ${integrity.brokenAt ?? 'نامشخص'}`}
            </Alert>
          ) : null}

          {!entries ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="dm-scroll max-h-[32rem] overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>عملیات</TableHead>
                    <TableHead>موجودیت</TableHead>
                    <TableHead>شرح</TableHead>
                    <TableHead>هش</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="dm-numeric text-xs">
                        {toPersianDigits(entry.createdAt.slice(0, 19).replace('T', ' '))}
                      </TableCell>
                      <TableCell>
                        <Badge tone="neutral">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.entityType}</TableCell>
                      <TableCell className="text-xs">{entry.summary}</TableCell>
                      <TableCell className="dm-numeric text-[0.65rem] opacity-70">
                        {entry.hash.slice(0, 12)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>گزارش پوشش کارکرد</CardTitle>
          <CardDescription>نسبت روزهای ثبت‌شده به روزهای ماه برای هر کارمند فعال.</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceCoverageBars />
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceCoverageBars() {
  const { records } = useAttendanceGrid();
  const employees = useActiveEmployees();
  const { jm } = usePeriodNavigator();

  const coverage = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of records) {
      map.set(record.employeeId, (map.get(record.employeeId) ?? 0) + 1);
    }
    return map;
  }, [records]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {employees.map((employee) => {
        const filled = coverage.get(employee.id) ?? 0;
        return (
          <div
            key={employee.id}
            className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">
                {employee.firstName} {employee.lastName}
              </span>
              <span className="dm-numeric text-[rgb(var(--dm-text-muted))]">
                {toPersianDigits(filled)} روز ثبت‌شده در {JALALI_MONTH_LABELS[jm - 1]}
              </span>
            </div>
            <Progress value={filled} max={31} />
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsPageInner />
    </Suspense>
  );
}
