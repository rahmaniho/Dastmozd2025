'use client';

import { toPersianDigits } from '@dastmozd/core';
import { bulkUpsertAttendance } from '@dastmozd/db';
import type { Employee } from '@dastmozd/types';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  FormField,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@dastmozd/ui';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  ATTENDANCE_ADAPTERS,
  downloadAttendanceTemplate,
  readAttendanceWorkbook,
  type AttendanceImportResult,
} from '@/lib/attendance-import';
import { ATTENDANCE_KIND_LABELS } from '@dastmozd/db';

export interface AttendanceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  jy: number;
  jm: number;
  onImported: () => void;
}

/**
 * ورود کارکرد از فایل دستگاه حضور و غیاب (پارس‌پولیس، سپیدار، راهکاران یا قالب استاندارد).
 */
export function AttendanceImportDialog({
  open,
  onOpenChange,
  employees,
  jy,
  jm,
  onImported,
}: AttendanceImportDialogProps) {
  const [adapterId, setAdapterId] = useState(ATTENDANCE_ADAPTERS[0]?.id ?? 'generic');
  const [result, setResult] = useState<AttendanceImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const adapter = ATTENDANCE_ADAPTERS.find((item) => item.id === adapterId);

  const handleFile = async (file: File): Promise<void> => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = readAttendanceWorkbook(buffer, { employees, adapterId });
      setResult(parsed);
      setFileName(file.name);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'خواندن فایل ناموفق بود',
        description: error instanceof Error ? error.message : 'ساختار فایل پشتیبانی نمی‌شود.',
      });
    }
  };

  const importRows = async (): Promise<void> => {
    if (!result || result.rows.length === 0) return;
    setBusy(true);
    try {
      const count = await bulkUpsertAttendance(result.rows.map((row) => row.record));
      toast({
        tone: 'success',
        title: `${toPersianDigits(count)} رکورد کارکرد ثبت شد`,
        description: `دوره ${toPersianDigits(jm)}/${toPersianDigits(jy)} به‌روزرسانی شد.`,
      });
      onImported();
      onOpenChange(false);
      setResult(null);
      setFileName('');
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ثبت رکوردها ناموفق بود',
        description: error instanceof Error ? error.message : 'ممکن است دوره قفل شده باشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="wide"
        title="ورود کارکرد از فایل دستگاه حضور و غیاب"
        description="فایل اکسل یا CSV خروجی دستگاه را انتخاب کنید؛ سطرهای نامعتبر پیش از ثبت گزارش می‌شوند."
        footer={
          <>
            <Button variant="outline" onClick={downloadAttendanceTemplate}>
              <Download className="size-4" />
              قالب استاندارد
            </Button>
            <Button onClick={importRows} disabled={busy || !result || result.rows.length === 0}>
              {busy ? 'در حال ثبت…' : `ثبت ${toPersianDigits(result?.rows.length ?? 0)} رکورد`}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="نرم‌افزار مبدأ"
            htmlFor="attendance-adapter"
            hint={adapter?.description}
          >
            <Select
              id="attendance-adapter"
              value={adapterId}
              options={ATTENDANCE_ADAPTERS.map((item) => ({ value: item.id, label: item.label }))}
              onChange={(event) => {
                setAdapterId(event.target.value);
                setResult(null);
              }}
            />
          </FormField>
          <FormField label="فایل کارکرد" htmlFor="attendance-file">
            <input
              ref={inputRef}
              id="attendance-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm file:mr-3 file:rounded-[var(--dm-radius-md)] file:border file:border-[rgb(var(--dm-border))] file:bg-[rgb(var(--dm-surface-sunken))] file:px-3 file:py-2 file:text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </FormField>
        </div>

        <Alert tone="info" title="راهنمای تطبیق کارکنان">
          کارکنان بر پایه «شماره پرسنلی» تطبیق داده می‌شوند؛ شماره‌های ناشناخته در گزارش خطاها فهرست
          می‌شوند. ساعت‌ها می‌توانند به شکل ۸:۳۰، 08:30 یا 0830 در فایل باشند.
        </Alert>

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">
                <FileSpreadsheet className="size-3.5" aria-hidden /> {fileName}
              </Badge>
              <Badge tone="info">{toPersianDigits(result.totalRows)} سطر فایل</Badge>
              <Badge tone="success">{toPersianDigits(result.rows.length)} رکورد معتبر</Badge>
              <Badge tone={result.issues.length > 0 ? 'danger' : 'neutral'}>
                {toPersianDigits(result.issues.length)} خطا
              </Badge>
            </div>

            {result.rows.length > 0 ? (
              <div className="dm-scroll max-h-64 overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>سطر</TableHead>
                      <TableHead>کارمند</TableHead>
                      <TableHead>تاریخ</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>ورود</TableHead>
                      <TableHead>خروج</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.slice(0, 100).map((row) => (
                      <TableRow key={`${row.row}-${row.employeeId}-${row.record.date}`}>
                        <TableCell className="dm-numeric">{toPersianDigits(row.row)}</TableCell>
                        <TableCell>{row.fullName}</TableCell>
                        <TableCell className="dm-numeric">
                          {toPersianDigits(row.record.jalali.jy)}/
                          {toPersianDigits(String(row.record.jalali.jm).padStart(2, '0'))}/
                          {toPersianDigits(String(row.record.jalali.jd).padStart(2, '0'))}
                        </TableCell>
                        <TableCell>{ATTENDANCE_KIND_LABELS[row.record.kind]}</TableCell>
                        <TableCell className="dm-numeric">{row.record.checkIn ?? '—'}</TableCell>
                        <TableCell className="dm-numeric">{row.record.checkOut ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {result.issues.length > 0 ? (
              <div className="dm-scroll max-h-48 overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-danger))]/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">سطر</TableHead>
                      <TableHead>پیام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.issues.slice(0, 100).map((issue, index) => (
                      <TableRow key={`${issue.row}-${index}`}>
                        <TableCell className="dm-numeric">{toPersianDigits(issue.row)}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
