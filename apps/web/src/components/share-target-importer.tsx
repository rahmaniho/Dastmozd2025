'use client';

import { toPersianDigits } from '@dastmozd/core';
import {
  bulkUpsertAttendance,
  listDepartments,
  makeId,
  saveDepartment,
  saveEmployee,
} from '@dastmozd/db';
import type { Department, Employee } from '@dastmozd/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  IllustrationAttendance,
  IllustrationEmployees,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@dastmozd/ui';
import { Download, FileSpreadsheet, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readAttendanceWorkbook } from '@/lib/attendance-import';
import { previewEmployeeImport, type EmployeeImportPreview } from '@/lib/excel';
import { useActiveEmployees } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

const SHARE_CACHE = 'dastmozd-share-v1';
const SHARE_URL = '/share-target/payload';

interface SharedFile {
  name: string;
  type: string;
  buffer: ArrayBuffer;
}

type Detection =
  | { kind: 'employees'; preview: EmployeeImportPreview }
  | { kind: 'attendance'; count: number; issues: string[] }
  | { kind: 'unknown' };

/**
 * صفحه دریافت فایل اشتراک‌گذاری‌شده از گوشی یا دسکتاپ:
 * فایل اکسل کارکنان یا کارکرد را می‌خواند، نوع آن را تشخیص می‌دهد و امکان ثبت
 * گروهی را فراهم می‌کند.
 */
export function ShareTargetImporter() {
  const companyId = useAppStore((state) => state.companyId);
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const employees = useActiveEmployees();
  const { toast } = useToast();

  const [shared, setShared] = useState<SharedFile | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [busy, setBusy] = useState(false);

  const detect = useCallback(
    async (
      buffer: ArrayBuffer,
      list: Department[],
      employeeList: Employee[],
    ): Promise<Detection> => {
      const employeePreview = previewEmployeeImport(buffer, {
        companyId: companyId ?? '',
        departments: list,
        defaults: { departmentId: list[0]?.id ?? '' },
      });
      if (employeePreview.rows.length > 0) return { kind: 'employees', preview: employeePreview };

      const attendance = readAttendanceWorkbook(buffer, {
        employees: employeeList,
        adapterId: 'generic',
      });
      if (attendance.rows.length > 0) {
        return {
          kind: 'attendance',
          count: attendance.rows.length,
          issues: attendance.issues.map((issue) => `سطر ${issue.row}: ${issue.message}`),
        };
      }
      return { kind: 'unknown' };
    },
    [companyId],
  );

  useEffect(() => {
    void (async () => {
      if (typeof caches === 'undefined' || !companyId) return;
      const list = await ensureDepartments(companyId);
      const cache = await caches.open(SHARE_CACHE);
      const response = await cache.match(SHARE_URL);
      if (!response) return;
      const buffer = await response.arrayBuffer();
      const file: SharedFile = {
        name: decodeURIComponent(response.headers.get('x-file-name') ?? 'shared.xlsx'),
        type: response.headers.get('content-type') ?? 'application/octet-stream',
        buffer,
      };
      setShared(file);
      setDetection(await detect(buffer, list, employees));
    })();
  }, [companyId, detect, employees]);

  const importEmployees = async (): Promise<void> => {
    if (!detection || detection.kind !== 'employees') return;
    setBusy(true);
    let saved = 0;
    for (const row of detection.preview.rows) {
      try {
        await saveEmployee(row.input);
        saved += 1;
      } catch {
        // سطرهای تکراری یا نامعتبر نادیده گرفته می‌شوند؛ گزارش در صفحه کارکنان است.
      }
    }
    setBusy(false);
    toast({
      tone: 'success',
      title: `${toPersianDigits(saved)} پرونده ثبت شد`,
      description: 'برای بازبینی و اصلاح، به صفحه کارکنان بروید.',
    });
    await clearShare();
  };

  const importAttendance = async (): Promise<void> => {
    if (!shared) return;
    setBusy(true);
    const parsed = readAttendanceWorkbook(shared.buffer, { employees, adapterId: 'generic' });
    const count = await bulkUpsertAttendance(parsed.rows.map((row) => row.record));
    setBusy(false);
    toast({
      tone: 'success',
      title: `${toPersianDigits(count)} رکورد کارکرد ثبت شد`,
      description: 'برای بازبینی به شبکه حضور و غیاب مراجعه کنید.',
    });
    await clearShare();
  };

  const clearShare = async (): Promise<void> => {
    if (typeof caches !== 'undefined') {
      await caches.delete(SHARE_CACHE);
    }
    setShared(null);
    setDetection(null);
  };

  if (!shared) {
    return (
      <EmptyState
        title="فایلی برای ورود اشتراک‌گذاری نشده است"
        description="از گوشی اندروید، فایل اکسل کارکرد یا کارکنان را با گزینه «اشتراک‌گذاری» به برنامه دستمزد آرمانی بفرستید. همچنین می‌توانید فایل را از صفحه کارکنان یا حضور و غیاب بارگذاری کنید."
        illustration={<IllustrationAttendance />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/employees">صفحه کارکنان</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/attendance">حضور و غیاب</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-[rgb(var(--dm-primary))]" aria-hidden />
            فایل دریافت‌شده
          </CardTitle>
          <CardDescription>
            نام فایل: {shared.name} — اندازه{' '}
            {toPersianDigits(Math.round(shared.buffer.byteLength / 1024))} کیلوبایت
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!detection ? (
            <p className="text-sm text-[rgb(var(--dm-text-subtle))]">در حال بررسی ساختار فایل…</p>
          ) : detection.kind === 'employees' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">
                  {toPersianDigits(detection.preview.rows.length)} سطر معتبر کارمند
                </Badge>
                <Badge tone={detection.preview.issues.length > 0 ? 'warning' : 'neutral'}>
                  {toPersianDigits(detection.preview.issues.length)} خطا
                </Badge>
                <Badge tone="info">
                  دوره {toPersianDigits(currentMonth)}/{toPersianDigits(fiscalYear)}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>سطر</TableHead>
                    <TableHead>نام</TableHead>
                    <TableHead>شماره پرسنلی</TableHead>
                    <TableHead>پایه حقوق</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detection.preview.rows.slice(0, 20).map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="dm-numeric">{toPersianDigits(row.row)}</TableCell>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell className="dm-numeric">
                        {toPersianDigits(row.input.personnelCode)}
                      </TableCell>
                      <TableCell className="dm-numeric">
                        {toPersianDigits(row.input.salary.baseMonthly)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detection.preview.issues.length > 0 ? (
                <Alert tone="warning" title="خطاهای اعتبارسنجی">
                  <ul className="mr-4 list-disc space-y-1 text-xs">
                    {detection.preview.issues.slice(0, 8).map((issue) => (
                      <li key={`${issue.row}-${issue.field}`}>
                        سطر {toPersianDigits(issue.row)} — {issue.field}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={importEmployees}
                  disabled={busy || detection.preview.rows.length === 0}
                >
                  <Users className="size-4" />
                  {busy ? 'در حال ثبت…' : 'ثبت کارکنان این فایل'}
                </Button>
                <Button variant="ghost" onClick={clearShare}>
                  انصراف و پاک‌کردن فایل
                </Button>
              </div>
            </>
          ) : detection.kind === 'attendance' ? (
            <>
              <Alert
                tone="success"
                title={`${toPersianDigits(detection.count)} رکورد کارکرد شناسایی شد`}
              >
                رکوردها بر پایه شماره پرسنلی به کارکنان تطبیق داده شده‌اند.
              </Alert>
              {detection.issues.length > 0 ? (
                <Alert tone="warning" title="سطرهای نادیده‌گرفته‌شده">
                  <ul className="mr-4 list-disc space-y-1 text-xs">
                    {detection.issues.slice(0, 8).map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={importAttendance} disabled={busy}>
                  <Download className="size-4" />
                  {busy ? 'در حال ثبت…' : 'ثبت رکوردهای کارکرد'}
                </Button>
                <Button variant="ghost" onClick={clearShare}>
                  انصراف و پاک‌کردن فایل
                </Button>
              </div>
            </>
          ) : (
            <>
              <EmptyState
                title="ساختار فایل شناسایی نشد"
                description="فایل باید یکی از قالب‌های کارکنان یا کارکرد باشد. قالب‌های نمونه را از صفحه کارکنان یا حضور و غیاب بارگیری کنید."
                illustration={<IllustrationEmployees />}
              />
              <Button variant="outline" onClick={clearShare}>
                پاک‌کردن فایل دریافتی
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * فهرست دپارتمان‌های شرکت؛ اگر هیچ دپارتمانی ثبت نشده باشد، یک دپارتمان عمومی
 * ساخته می‌شود تا ورود گروهی کارکنان بدون خطا انجام شود.
 */
async function ensureDepartments(companyId: string): Promise<Department[]> {
  const list = await listDepartments(companyId);
  if (list.length > 0) return list;
  await saveDepartment({
    id: makeId('dep'),
    companyId,
    title: 'امور عمومی',
    costCenter: 'CC-000',
    createdAt: new Date().toISOString(),
  });
  return listDepartments(companyId);
}
